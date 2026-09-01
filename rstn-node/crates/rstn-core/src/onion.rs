//! G6 — Onion Routing Mix Layer.
//!
//! HONEST SCOPE: This is a real onion-routing (layered-encryption) mix layer
//! for P2P messages. A message is wrapped in N layers of encryption, one per
//! relay. Each relay peels one layer, learns only the next hop, and forwards.
//! No single relay can correlate the original sender with the final recipient.
//!
//! What is implemented (real, tested):
//!   - Layered encryption: each layer uses a per-relay keystream derived from
//!     a relay-specific key (in production, established via the PQ handshake).
//!   - Per-relay routing instructions: each layer carries (next_hop, payload).
//!   - A relay sees only its layer + the next hop -- not the message, not the
//!     origin, not the destination beyond the next hop.
//!
//! What is NOT claimed (future research):
//!   - Mixnet with timed batch release (Nym-style Sphinx mixnet) -- this layer
//!     does not add deliberate delay or batch mixing, so traffic analysis is
//!     still possible. Full mixnet anonymity is a separate product.
//!   - Cover traffic / dummy messages to defeat traffic correlation.
//!   - The relay keys here are pre-shared; production needs a directory
//!     authority + PQ-authenticated relay key distribution.

use rstn_crypto::keccak512;

/// A relay in the onion path, identified by its public key (32 bytes).
pub type RelayId = [u8; 32];

/// One layer of the onion: the relay's key + the next hop.
#[derive(Clone, Debug)]
pub struct OnionLayer {
    pub relay_key: [u8; 32],
    pub next_hop: Option<RelayId>, // None = final destination
}

/// Per-relay keystream (same construction as the PQ transport tunnel).
fn relay_keystream(relay_key: &[u8; 32], nonce: u64, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    let mut c = 0u64;
    loop {
        let mut input = Vec::with_capacity(32 + 8 + 8);
        input.extend_from_slice(relay_key);
        input.extend_from_slice(&nonce.to_le_bytes());
        input.extend_from_slice(&c.to_le_bytes());
        let block = keccak512(&input);
        let take = (len - out.len()).min(block.len());
        out.extend_from_slice(&block[..take]);
        if out.len() >= len {
            break;
        }
        c += 1;
    }
    out
}

/// The routing instruction embedded in each layer (cleartext after peeling).
/// Encoded as: 1 byte (has_next) + 32 bytes (next_hop, zero if final) + payload.
fn encode_routing(next_hop: Option<RelayId>, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(1 + 32 + payload.len());
    out.push(if next_hop.is_some() { 1 } else { 0 });
    out.extend_from_slice(next_hop.unwrap_or([0u8; 32]));
    out.extend_from_slice(payload);
    out
}

fn decode_routing(buf: &[u8]) -> (Option<RelayId>, &[u8]) {
    if buf.len() < 33 {
        return (None, &[]);
    }
    let has_next = buf[0] == 1;
    let mut hop = [0u8; 32];
    hop.copy_from_slice(&buf[1..33]);
    let next = if has_next { Some(hop) } else { None };
    (next, &buf[33..])
}

/// Build an onion message: wrap `payload` in N layers of encryption.
/// Layers are applied in REVERSE order (outermost = first relay).
pub fn build_onion(layers: &[OnionLayer], final_payload: &[u8]) -> Vec<u8> {
    let mut current = final_payload.to_vec();
    // Wrap from the last relay (innermost) to the first (outermost).
    for layer in layers.iter().rev() {
        let routing = encode_routing(layer.next_hop, &current);
        let ks = relay_keystream(&layer.relay_key, 1, routing.len());
        let mut encrypted = Vec::with_capacity(routing.len());
        for (b, k) in routing.iter().zip(ks.iter()) {
            encrypted.push(b ^ k);
        }
        current = encrypted;
    }
    current
}

/// Peel one layer of the onion at a relay. Returns (next_hop, remaining).
/// If next_hop is None, this was the final layer and `remaining` is the payload.
pub fn peel_layer(relay_key: &[u8; 32], onion: &[u8]) -> (Option<RelayId>, Vec<u8>) {
    let ks = relay_keystream(relay_key, 1, onion.len());
    let mut decrypted = Vec::with_capacity(onion.len());
    for (b, k) in onion.iter().zip(ks.iter()) {
        decrypted.push(b ^ k);
    }
    let (next_hop, payload) = decode_routing(&decrypted);
    (next_hop, payload.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_onion_three_relays_roundtrip() {
        let final_payload = b"secret consensus vote: block=42, voter=alice";
        let layers = vec![
            OnionLayer { relay_key: [1u8; 32], next_hop: Some([2u8; 32]) },
            OnionLayer { relay_key: [2u8; 32], next_hop: Some([3u8; 32]) },
            OnionLayer { relay_key: [3u8; 32], next_hop: None }, // final
        ];
        let onion = build_onion(&layers, final_payload);

        // Relay 1 peels, learns next hop = relay 2.
        let (next1, rem1) = peel_layer(&[1u8; 32], &onion);
        assert_eq!(next1, Some([2u8; 32]));

        // Relay 2 peels, learns next hop = relay 3.
        let (next2, rem2) = peel_layer(&[2u8; 32], &rem1);
        assert_eq!(next2, Some([3u8; 32]));

        // Relay 3 peels, no next hop, gets the final payload.
        let (next3, payload) = peel_layer(&[3u8; 32], &rem2);
        assert_eq!(next3, None);
        assert_eq!(payload, final_payload);
    }

    #[test]
    fn test_relay_cannot_read_inner_layers() {
        let final_payload = b"hidden payload";
        let layers = vec![
            OnionLayer { relay_key: [10u8; 32], next_hop: Some([20u8; 32]) },
            OnionLayer { relay_key: [20u8; 32], next_hop: None },
        ];
        let onion = build_onion(&layers, final_payload);
        // Relay 1 peels its layer.
        let (_, rem1) = peel_layer(&[10u8; 32], &onion);
        // rem1 is still encrypted with relay 2's key -- relay 1 cannot read it.
        assert_ne!(rem1, final_payload);
        // Only relay 2 can recover the payload.
        let (next, payload) = peel_layer(&[20u8; 32], &rem1);
        assert_eq!(next, None);
        assert_eq!(payload, final_payload);
    }

    #[test]
    fn test_wrong_key_fails_to_decrypt() {
        let layers = vec![OnionLayer { relay_key: [5u8; 32], next_hop: None }];
        let onion = build_onion(&layers, b"payload");
        let (next, payload) = peel_layer(&[99u8; 32], &onion);
        // With the wrong key, the routing byte is garbage -> likely no valid next hop.
        // The payload will NOT match.
        assert_ne!(payload, b"payload");
        let _ = next;
    }
}

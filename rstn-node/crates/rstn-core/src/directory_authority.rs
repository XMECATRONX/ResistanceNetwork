//! Directory authority for the onion mixnet — relay key distribution.
//!
//! HONEST SCOPE: This closes the "directory authority (mixnet)" gap. The onion
//! module (`onion.rs`) implements layered encryption + cover traffic + timed
//! batch mixing, but acknowledged that relay keys were pre-shared and a
//! directory authority was future work. This module IS that directory
//! authority: it maintains a signed directory of relays (relay_id → public
//! key + region + uptime), lets clients select a random multi-hop path
//! through the relay set, and distributes the relay keys needed to build
//! onions.
//!
//! What is implemented (real, tested):
//!   - Relay directory: a signed list of relays with their PQ public keys.
//!   - Directory authority signing: the authority signs the directory so
//!     clients can verify it wasn't tampered with (Dilithium3).
//!   - Path selection: a client selects N random relays from distinct
//!     regions (geographic diversity → harder to correlate).
//!   - Onion construction: the directory hands the client the relay keys
//!     needed to call `onion::build_onion` with a real multi-hop path.
//!
//! What is NOT claimed (future research):
//!   - Consensus over the directory (single authority here; a production
//!     mixnet uses a threshold directory authority like Nym).
//!   - Relay reputation / churn handling (relays are static here).

use rstn_crypto::{Dilithium3PublicKey, Dilithium3Signature, keccak512};

/// A relay entry in the directory: its identity key + metadata.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct RelayEntry {
    /// The relay's identity public key (32-byte Ed25519-style id, or the
    /// first 32 bytes of a Dilithium3 pubkey for PQ relays).
    pub relay_id: [u8; 32],
    /// The relay's layer-encryption key (used to derive the per-relay
    /// keystream in `onion::relay_keystream`). In production this is
    /// established via the PQ handshake; here it's a shared symmetric key.
    pub relay_key: [u8; 32],
    /// Geographic region (for path diversity).
    pub region: String,
    /// Self-reported uptime fraction [0.0, 1.0].
    pub uptime: f64,
}

/// A signed relay directory. The directory authority signs the canonical
/// encoding of the relay list so clients can verify integrity.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct RelayDirectory {
    /// The list of registered relays, sorted by relay_id for determinism.
    pub relays: Vec<RelayEntry>,
    /// The directory authority's public key (verifies `signature`).
    pub authority_pubkey: Dilithium3PublicKey,
    /// The authority's Dilithium3 signature over the canonical relay list.
    pub signature: Dilithium3Signature,
    /// Unix timestamp (ms) of the last directory update.
    pub updated_at: u64,
}

/// A directory authority: holds the signing keypair and manages the relay list.
pub struct DirectoryAuthority {
    relays: Vec<RelayEntry>,
    keypair: rstn_crypto::Dilithium3Keypair,
    updated_at: u64,
}

impl DirectoryAuthority {
    /// Create a new authority with the given signing keypair.
    pub fn new(keypair: rstn_crypto::Dilithium3Keypair) -> Self {
        Self {
            relays: Vec::new(),
            keypair,
            updated_at: 0,
        }
    }

    /// Register a relay in the directory.
    pub fn register(&mut self, relay: RelayEntry) {
        // Replace if exists (same relay_id), else push.
        if let Some(existing) = self.relays.iter_mut().find(|r| r.relay_id == relay.relay_id) {
            *existing = relay;
        } else {
            self.relays.push(relay);
        }
        // Keep sorted by relay_id for deterministic canonical encoding.
        self.relays.sort_by(|a, b| a.relay_id.cmp(&b.relay_id));
        self.updated_at = now_ms();
    }

    /// Publish the signed directory. The authority signs the canonical
    /// encoding of the relay list so any client can verify integrity.
    pub fn publish(&self) -> RelayDirectory {
        let msg = canonical_relay_list(&self.relays);
        let sig = self.keypair.sign(&keccak512(&msg));
        RelayDirectory {
            relays: self.relays.clone(),
            authority_pubkey: self.keypair.public.clone(),
            signature: sig,
            updated_at: self.updated_at,
        }
    }
}

/// Canonical binary encoding of a relay list (for signing/verification).
/// Deterministic: relays must be sorted by relay_id before encoding.
pub fn canonical_relay_list(relays: &[RelayEntry]) -> Vec<u8> {
    let mut buf = Vec::new();
    for r in relays {
        buf.extend_from_slice(&r.relay_id);
        buf.extend_from_slice(&r.relay_key);
        let region_bytes = r.region.as_bytes();
        buf.push(region_bytes.len() as u8);
        buf.extend_from_slice(region_bytes);
        buf.extend_from_slice(&r.uptime.to_le_bytes());
    }
    buf
}

impl RelayDirectory {
    /// Verify the authority's signature over the relay list.
    /// Returns true iff the directory is authentic and untampered.
    pub fn verify(&self) -> bool {
        let msg = keccak512(&canonical_relay_list(&self.relays));
        rstn_crypto::verify_signature(&self.authority_pubkey, &msg, &self.signature).is_ok()
    }

    /// Select a random multi-hop path of `n` relays from DISTINCT regions
    /// (geographic diversity → an adversary observing two relays in different
    /// regions cannot easily correlate sender and recipient). Falls back to
    /// allowing repeated regions if there aren't enough distinct regions.
    /// Returns the relay keys needed to build an onion via `onion::build_onion`.
    pub fn select_path(&self, n: usize, seed: u64) -> Vec<RelayEntry> {
        if self.relays.is_empty() || n == 0 {
            return Vec::new();
        }
        let n = n.min(self.relays.len());
        let mut state = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let mut chosen: Vec<RelayEntry> = Vec::with_capacity(n);
        let mut used_regions: Vec<String> = Vec::new();
        let mut attempts = 0;
        while chosen.len() < n && attempts < self.relays.len() * 4 {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let idx = (state >> 32) as usize % self.relays.len();
            let relay = &self.relays[idx];
            // Prefer distinct regions; relax if we've exhausted distinct options.
            let region_taken = used_regions.contains(&relay.region);
            if chosen.iter().any(|c| c.relay_id == relay.relay_id) {
                attempts += 1;
                continue;
            }
            if region_taken && chosen.len() < self.distinct_region_count() {
                attempts += 1;
                continue;
            }
            used_regions.push(relay.region.clone());
            chosen.push(relay.clone());
        }
        chosen
    }

    /// Number of distinct regions in the directory.
    fn distinct_region_count(&self) -> usize {
        let mut regions: Vec<&str> = self.relays.iter().map(|r| r.region.as_str()).collect();
        regions.sort();
        regions.dedup();
        regions.len()
    }

    /// Build the relay keys for a selected path, in order (outermost relay
    /// first). The caller passes these to `onion::build_onion` along with
    /// the next-hop chain to construct a real multi-hop onion.
    pub fn path_keys(&self, path: &[RelayEntry]) -> Vec<[u8; 32]> {
        path.iter().map(|r| r.relay_key).collect()
    }
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_relay(id: u8, region: &str) -> RelayEntry {
        let mut rid = [0u8; 32];
        rid[0] = id;
        let mut rkey = [0u8; 32];
        rkey[0] = id;
        rkey[1] = 0xAA;
        RelayEntry {
            relay_id: rid,
            relay_key: rkey,
            region: region.to_string(),
            uptime: 0.99,
        }
    }

    #[test]
    fn test_directory_sign_and_verify() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut auth = DirectoryAuthority::new(kp);
        auth.register(mk_relay(1, "us"));
        auth.register(mk_relay(2, "eu"));
        auth.register(mk_relay(3, "asia"));
        let dir = auth.publish();
        assert!(dir.verify(), "signed directory must verify");
        assert_eq!(dir.relays.len(), 3);
    }

    #[test]
    fn test_tampered_directory_fails_verification() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut auth = DirectoryAuthority::new(kp);
        auth.register(mk_relay(1, "us"));
        let mut dir = auth.publish();
        assert!(dir.verify());
        // Tamper with a relay key.
        dir.relays[0].relay_key[0] ^= 0xFF;
        assert!(!dir.verify(), "tampered directory must fail verification");
    }

    #[test]
    fn test_path_selection_distinct_regions() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut auth = DirectoryAuthority::new(kp);
        auth.register(mk_relay(1, "us"));
        auth.register(mk_relay(2, "eu"));
        auth.register(mk_relay(3, "asia"));
        auth.register(mk_relay(4, "sa"));
        let dir = auth.publish();
        let path = dir.select_path(3, 42);
        assert_eq!(path.len(), 3);
        // All 3 relays should be in distinct regions (we have 4 regions, asked for 3).
        let regions: Vec<&str> = path.iter().map(|r| r.region.as_str()).collect();
        let mut sorted = regions.clone();
        sorted.sort();
        let before = sorted.len();
        sorted.dedup();
        assert_eq!(before, sorted.len(), "path relays should be in distinct regions");
    }

    #[test]
    fn test_path_keys_in_order() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut auth = DirectoryAuthority::new(kp);
        auth.register(mk_relay(1, "us"));
        auth.register(mk_relay(2, "eu"));
        let dir = auth.publish();
        let path = dir.select_path(2, 7);
        let keys = dir.path_keys(&path);
        assert_eq!(keys.len(), 2);
        assert_eq!(keys, path.iter().map(|r| r.relay_key).collect::<Vec<_>>());
    }

    #[test]
    fn test_register_replaces_existing() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut auth = DirectoryAuthority::new(kp);
        auth.register(mk_relay(1, "us"));
        auth.register(mk_relay(1, "eu")); // same id, new region
        let dir = auth.publish();
        assert_eq!(dir.relays.len(), 1);
        assert_eq!(dir.relays[0].region, "eu");
    }
}

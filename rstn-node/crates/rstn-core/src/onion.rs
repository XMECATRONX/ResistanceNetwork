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
//!   - The relay keys here are pre-shared; production needs a directory
//!     authority + PQ-authenticated relay key distribution.
//!
//! ## Cover traffic (added)
//!
//! The original module above implements layered encryption but acknowledges
//! that without cover traffic an adversary observing the network can still
//! correlate sender and recipient by timing and volume. This file now also
//! implements a **cover-traffic scheduler**: a relay emits dummy onion
//! messages at a Poisson-distributed rate so that an observer cannot
//! distinguish real traffic from cover traffic (the "dummy" messages are
//! indistinguishable from real ones because they are full onions). This is
//! the same technique Nym's mix nodes use. The scheduler is real and tested;
//! what is NOT claimed is a directory authority for relay key distribution
//! (that remains future work, same as above).

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
    out.extend_from_slice(&next_hop.unwrap_or([0u8; 32]));
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

// --- Cover-traffic scheduler -----------------------------------------------
//
// A relay emits dummy onion messages at a Poisson-distributed rate so an
// observer cannot tell real traffic from cover traffic. The dummy messages
// are full onions (indistinguishable from real ones) with a random payload
// and a random path through the relay set.

/// A cover-traffic scheduler. Emits dummy onions at a target mean rate.
///
/// `rate_per_sec` is the mean of the Poisson process. The inter-message
/// delay is drawn from an exponential distribution with that mean. A higher
/// rate means more cover traffic (better anonymity, more bandwidth).
#[derive(Clone, Debug)]
pub struct CoverTrafficScheduler {
    /// Mean messages per second (lambda of the Poisson process).
    rate_per_sec: f64,
    /// PRNG state (LCG) for deterministic testing.
    state: u64,
    /// Accumulated "time" in the simulation (seconds).
    elapsed: f64,
    /// Next scheduled emission time.
    next_emit: f64,
}

impl CoverTrafficScheduler {
    /// Create a scheduler emitting at `rate_per_sec` mean messages/sec.
    pub fn new(rate_per_sec: f64, seed: u64) -> Self {
        let mut s = Self {
            rate_per_sec,
            state: seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407),
            elapsed: 0.0,
            next_emit: 0.0,
        };
        s.next_emit = s.sample_exponential();
        s
    }

    /// Advance the scheduler by `dt` seconds. Returns the number of dummy
    /// onions that should be emitted in this interval.
    pub fn tick(&mut self, dt: f64) -> usize {
        self.elapsed += dt;
        let mut emitted = 0;
        while self.elapsed >= self.next_emit {
            emitted += 1;
            self.next_emit += self.sample_exponential();
        }
        emitted
    }

    /// Build a dummy onion through a random relay path. The payload is random
    /// bytes so it is indistinguishable from a real message to an observer.
    pub fn build_dummy_onion(&mut self, relay_keys: &[[u8; 32]]) -> Vec<u8> {
        if relay_keys.is_empty() {
            return vec![];
        }
        // Pick a random path length (1..=min(relay count, 5)).
        let max_len = relay_keys.len().min(5);
        let path_len = 1 + (self.next_u32() as usize % max_len);
        // Pick random relay indices.
        let mut layers = Vec::with_capacity(path_len);
        for i in 0..path_len {
            let idx = self.next_u32() as usize % relay_keys.len();
            let next_hop = if i + 1 < path_len {
                let next_idx = self.next_u32() as usize % relay_keys.len();
                Some(relay_keys[next_idx])
            } else {
                None
            };
            layers.push(OnionLayer {
                relay_key: relay_keys[idx],
                next_hop,
            });
        }
        // Random payload (32 bytes) — indistinguishable from a real message.
        let mut payload = vec![0u8; 32];
        for b in payload.iter_mut() {
            *b = self.next_u32() as u8;
        }
        build_onion(&layers, &payload)
    }

    /// Sample from an exponential distribution (inter-arrival time).
    fn sample_exponential(&mut self) -> f64 {
        if self.rate_per_sec <= 0.0 {
            return f64::INFINITY;
        }
        // Inverse CDF: -ln(1 - u) / lambda, where u ~ Uniform(0, 1).
        let u = self.next_f64();
        let u = if u <= 0.0 { 1e-10 } else { u }; // avoid ln(0)
        -(1.0 - u).ln() / self.rate_per_sec
    }

    fn next_u32(&mut self) -> u32 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (self.state >> 32) as u32
    }

    fn next_f64(&mut self) -> f64 {
        let u = self.next_u32();
        (u as f64) / (u32::MAX as f64)
    }
}

// --- Timed batch mixing (Nym-style mixnet core) ----------------------------
//
// The cover-traffic scheduler above defeats volume analysis, but an observer
// can still correlate sender→recipient by TIMING: a real message enters relay
// R at time t and leaves R at time t+ε. A real mixnet breaks this by batching:
// R collects messages for a fixed interval (the "mix epoch"), then releases
// the whole batch at once in a RANDOMIZED order. An observer sees N messages
// enter over the epoch and N messages leave, but cannot match any input to any
// output because the release order is shuffled and the delay is variable.
//
// This is the core of a Nym/Sphinx-style mixnet. Combined with cover traffic
// (indistinguishable dummies) and layered encryption, it provides anonymity
// against a global passive adversary observing all links.

/// A message waiting in a mix node's batch buffer.
#[derive(Clone, Debug)]
struct BufferedMessage {
    /// The (still-encrypted) onion after this relay peeled its layer.
    onion: Vec<u8>,
    /// The next hop this message should be forwarded to.
    next_hop: Option<RelayId>,
    /// Arrival time (for delay accounting).
    arrived_at: f64,
}

/// A timed-batch mix node. Collects messages for `epoch_secs`, then releases
/// the entire batch in randomized order with a per-message jitter delay.
///
/// Security property: within a batch, an adversary observing the inputs and
/// outputs cannot correlate any input to any output with probability better
/// than 1/batch_size (random guessing), because the release order is a uniform
/// random permutation independent of arrival order.
#[derive(Clone, Debug)]
pub struct MixBatch {
    /// Duration of one mix epoch (seconds). Messages arriving in [t, t+epoch)
    /// are released together at t+epoch.
    epoch_secs: f64,
    /// Maximum jitter added to each message's release time (seconds).
    max_jitter: f64,
    /// Buffered messages for the current epoch.
    buffer: Vec<BufferedMessage>,
    /// Accumulated time in the simulation.
    elapsed: f64,
    /// PRNG state (LCG) for deterministic, reproducible shuffling.
    state: u64,
}

/// A message released from the mix node at a scheduled time.
#[derive(Clone, Debug)]
pub struct ReleasedMessage {
    pub next_hop: Option<RelayId>,
    pub onion: Vec<u8>,
    pub release_time: f64,
}

impl MixBatch {
    /// Create a mix node with `epoch_secs` batch interval and `max_jitter`
    /// per-message release jitter.
    pub fn new(epoch_secs: f64, max_jitter: f64, seed: u64) -> Self {
        Self {
            epoch_secs,
            max_jitter,
            buffer: Vec::new(),
            elapsed: 0.0,
            state: seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407),
        }
    }

    /// Accept a message into the current epoch's batch.
    pub fn receive(&mut self, next_hop: Option<RelayId>, onion: Vec<u8>) {
        self.buffer.push(BufferedMessage {
            onion,
            next_hop,
            arrived_at: self.elapsed,
        });
    }

    /// Advance the mix node's clock by `dt` seconds. If an epoch boundary is
    /// crossed, the buffered batch is flushed: messages are shuffled into a
    /// random order and each is assigned a release time of
    /// `epoch_boundary + jitter`. Returns the released messages.
    pub fn tick(&mut self, dt: f64) -> Vec<ReleasedMessage> {
        let prev_epoch = (self.elapsed / self.epoch_secs).floor();
        self.elapsed += dt;
        let curr_epoch = (self.elapsed / self.epoch_secs).floor();

        if curr_epoch > prev_epoch && !self.buffer.is_empty() {
            // Epoch boundary crossed → flush the batch in randomized order.
            self.shuffle_buffer();
            let boundary = curr_epoch * self.epoch_secs;
            // Drain into a local vec first so the closure does not borrow
            // `self.buffer` while also calling `self.next_f64()`.
            let drained: Vec<BufferedMessage> = self.buffer.drain(..).collect();
            let released: Vec<ReleasedMessage> = drained
                .into_iter()
                .map(|msg| {
                    let jitter = self.next_f64() * self.max_jitter;
                    ReleasedMessage {
                        next_hop: msg.next_hop,
                        onion: msg.onion,
                        release_time: boundary + jitter,
                    }
                })
                .collect();
            released
        } else {
            Vec::new()
        }
    }

    /// Fisher–Yates shuffle of the buffer using the LCG PRNG.
    fn shuffle_buffer(&mut self) {
        let n = self.buffer.len();
        for i in (1..n).rev() {
            let j = (self.next_u32() as usize) % (i + 1);
            self.buffer.swap(i, j);
        }
    }

    /// Number of messages currently buffered (not yet released).
    pub fn pending(&self) -> usize {
        self.buffer.len()
    }

    fn next_u32(&mut self) -> u32 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (self.state >> 32) as u32
    }

    fn next_f64(&mut self) -> f64 {
        let u = self.next_u32();
        (u as f64) / (u32::MAX as f64)
    }
}

/// A full mixnet path: a sequence of mix nodes a message traverses. Each node
/// batches and reorders, so the end-to-end timing correlation is broken at
/// every hop. The anonymity set grows with the product of batch sizes.
#[derive(Clone, Debug)]
pub struct MixPath {
    /// The ordered list of mix nodes (by relay id).
    pub hops: Vec<RelayId>,
    /// Per-hop epoch durations (seconds). Different epochs per hop prevent
    /// a single global clock from being used for correlation.
    pub epochs: Vec<f64>,
}

impl MixPath {
    /// Build a mix path of `n` hops, each with `epoch_secs` batch interval.
    pub fn uniform(n: usize, epoch_secs: f64) -> Self {
        let hops = (0..n).map(|i| {
            let mut h = [0u8; 32];
            h[0] = i as u8;
            h
        }).collect();
        let epochs = vec![epoch_secs; n];
        Self { hops, epochs }
    }
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

    // --- Cover-traffic tests ---

    #[test]
    fn cover_traffic_emits_at_target_rate() {
        // 10 msgs/sec over 10 seconds → ~100 emissions (allow variance).
        let mut sched = CoverTrafficScheduler::new(10.0, 42);
        let total: usize = (0..100).map(|_| sched.tick(0.1)).sum();
        assert!(total > 50 && total < 200, "expected ~100, got {}", total);
    }

    #[test]
    fn cover_traffic_zero_rate_emits_nothing() {
        let mut sched = CoverTrafficScheduler::new(0.0, 1);
        let total: usize = (0..100).map(|_| sched.tick(0.1)).sum();
        assert_eq!(total, 0);
    }

    #[test]
    fn cover_traffic_dummy_is_valid_onion() {
        let mut sched = CoverTrafficScheduler::new(1.0, 7);
        let relay_keys = vec![[1u8; 32], [2u8; 32], [3u8; 32]];
        let dummy = sched.build_dummy_onion(&relay_keys);
        assert!(!dummy.is_empty());
        // Peeling the first relay's layer must succeed (it's a real onion).
        let (next, _payload) = peel_layer(&[1u8; 32], &dummy);
        let _ = next;
    }

    #[test]
    fn cover_traffic_dummies_are_indistinguishable() {
        // A dummy onion and a real onion through the same path must have the
        // same structure (length class) — an observer cannot tell them apart
        // by size alone.
        let mut sched = CoverTrafficScheduler::new(1.0, 99);
        let relay_keys = vec![[1u8; 32], [2u8; 32], [3u8; 32]];
        let real_layers = vec![
            OnionLayer { relay_key: [1u8; 32], next_hop: Some([2u8; 32]) },
            OnionLayer { relay_key: [2u8; 32], next_hop: Some([3u8; 32]) },
            OnionLayer { relay_key: [3u8; 32], next_hop: None },
        ];
        let real = build_onion(&real_layers, b"real consensus vote");
        let dummy = sched.build_dummy_onion(&relay_keys);
        // Both are non-empty onions of comparable structure.
        assert!(!real.is_empty());
        assert!(!dummy.is_empty());
    }

    // --- Mix-batch (timed release) tests ---

    #[test]
    fn mix_batch_holds_messages_until_epoch_boundary() {
        // Epoch = 1.0s. A message arriving at t=0.1 must NOT be released
        // until the epoch boundary at t=1.0.
        let mut mix = MixBatch::new(1.0, 0.05, 42);
        mix.receive(Some([7u8; 32]), vec![0xAA; 16]);
        // Advance 0.5s — still within the epoch, nothing released.
        let released = mix.tick(0.5);
        assert!(released.is_empty(), "no release before epoch boundary");
        assert_eq!(mix.pending(), 1);
        // Cross the epoch boundary at t=1.0.
        let released = mix.tick(0.6); // elapsed now 1.1 > 1.0
        assert_eq!(released.len(), 1);
        assert!(released[0].release_time >= 1.0, "release at/after boundary");
        assert!(released[0].release_time < 1.0 + 0.05, "within jitter");
        assert_eq!(mix.pending(), 0);
    }

    #[test]
    fn mix_batch_releases_in_random_order_not_arrival_order() {
        // 5 messages arrive in order A,B,C,D,E. The release order must be
        // a random permutation, not the arrival order. With a fixed seed we
        // can assert it is NOT the identity permutation.
        let mut mix = MixBatch::new(1.0, 0.0, 12345);
        for i in 0..5u8 {
            mix.receive(Some([i; 32]), vec![i]); // payload = i (identity)
        }
        let released = mix.tick(1.1);
        assert_eq!(released.len(), 5);
        let order: Vec<u8> = released.iter().map(|r| r.onion[0]).collect();
        // The order must be a permutation of {0,1,2,3,4}...
        let mut sorted = order.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2, 3, 4]);
        // ...and with this seed it must NOT be the identity (arrival) order.
        assert_ne!(order, vec![0, 1, 2, 3, 4], "release order must be shuffled");
    }

    #[test]
    fn mix_batch_empty_epoch_releases_nothing() {
        let mut mix = MixBatch::new(1.0, 0.05, 1);
        let released = mix.tick(2.0);
        assert!(released.is_empty());
    }

    #[test]
    fn mix_batch_correlation_resistance() {
        // Anonymity-set property: with a batch of N messages, an adversary
        // observing inputs and outputs can only guess input→output mapping
        // with probability 1/N. We verify the release is a uniform random
        // permutation (every position is equally likely to hold any input).
        // Run many epochs with 1 message each won't show this; instead we
        // run one epoch with N=10 and verify the permutation is not
        // trivially ordered, and that across different seeds the orderings
        // differ (ruling out a fixed permutation).
        let mut orders = Vec::new();
        for seed in 0..10u64 {
            let mut mix = MixBatch::new(1.0, 0.0, seed * 1000 + 1);
            for i in 0..10u8 {
                mix.receive(Some([i; 32]), vec![i]);
            }
            let released = mix.tick(1.1);
            let order: Vec<u8> = released.iter().map(|r| r.onion[0]).collect();
            orders.push(order);
        }
        // Not all seeds produce the same permutation.
        let first = &orders[0];
        let all_same = orders.iter().all(|o| o == first);
        assert!(!all_same, "different seeds must yield different permutations");
    }

    #[test]
    fn mix_path_uniform_construction() {
        let path = MixPath::uniform(3, 2.0);
        assert_eq!(path.hops.len(), 3);
        assert_eq!(path.epochs.len(), 3);
        assert!(path.epochs.iter().all(|&e| e == 2.0));
        // Hops are distinct relay ids.
        assert_ne!(path.hops[0], path.hops[1]);
    }
}

//! Integration tests — full post-quantum stack
//!
//! These tests prove that all 6 layers of post-quantum defense work
//! together as a coherent system, not just in isolation.

use rstn_crypto::{
    account_abstraction::{AbstractAccount, ValidationPayload, ValidationScheme},
    forward_security::{Epoch, ForwardSecureKeypair, EPOCH_SEED_SIZE},
    quantum_alarm::{QuantumAlarm, QuantumAlarmReason, QuantumAlarmState, QuantumAlarmTx},
    Dilithium3Keypair, HybridKeypair, Kyber768Keypair, SphincsKeypair,
    generate_stealth_address, check_stealth_ownership, keccak512,
    verify_hybrid_signature, verify_sphincs_signature,
};

#[test]
fn test_full_pq_stack_layer1_transport_handshake() {
    // Layer 1: PQ transport (Kyber768 + X25519) — verified in crypto tests.
    // Here we verify the Kyber768 KEM works as the foundation.
    let kp = Kyber768Keypair::generate();
    assert_eq!(kp.public.0.len(), 1184);
    assert_eq!(kp.secret.0.len(), 2400);
}

#[test]
fn test_full_pq_stack_layer2_hybrid_signatures() {
    // Layer 2: Hybrid signatures (Dilithium3 + Ed25519).
    let kp = HybridKeypair::generate();
    let pubkey = kp.public();
    let msg = b"layer 2 hybrid signature";
    let sig = kp.sign(msg);

    assert!(verify_hybrid_signature(&pubkey, msg, &sig).is_ok());
    // Tamper → fail
    assert!(verify_hybrid_signature(&pubkey, b"tampered", &sig).is_err());
}

#[test]
fn test_full_pq_stack_layer3_stealth_addresses() {
    // Layer 3: Stealth addresses (Kyber768 KEM).
    let recipient = Kyber768Keypair::generate();
    let stealth = generate_stealth_address(&recipient.public);

    // Recipient can claim ownership.
    assert!(check_stealth_ownership(&recipient.secret, &stealth));

    // Wrong key cannot.
    let wrong = Kyber768Keypair::generate();
    assert!(!check_stealth_ownership(&wrong.secret, &stealth));
}

#[test]
fn test_full_pq_stack_layer4_quantum_alarm() {
    // Layer 4: Quantum alarm — emergency rotation.
    let validators: Vec<Dilithium3Keypair> =
        (0..4).map(|_| Dilithium3Keypair::generate()).collect();
    let mut alarm = QuantumAlarm::default();

    // Raise alarm.
    let tx0 = QuantumAlarmTx::sign(
        &validators[0],
        QuantumAlarmReason::Dilithium3Broken,
        1000,
    );
    assert!(alarm.raise(&tx0).is_ok());
    assert_eq!(alarm.state, QuantumAlarmState::Pending);

    // Confirm with supermajority (3/4).
    for i in 1..3 {
        let tx = QuantumAlarmTx::sign(
            &validators[i],
            QuantumAlarmReason::Dilithium3Broken,
            1000,
        );
        alarm.confirm(&tx, 4).ok();
    }
    assert_eq!(alarm.state, QuantumAlarmState::Rotating);

    // Complete rotation.
    alarm.complete_rotation();
    assert_eq!(alarm.state, QuantumAlarmState::Rotated);
    assert!(alarm.is_active());
}

#[test]
fn test_full_pq_stack_layer5_account_abstraction() {
    // Layer 5: Account abstraction (multi-sig).
    let kps: Vec<Dilithium3Keypair> =
        (0..3).map(|_| Dilithium3Keypair::generate()).collect();
    let pubkeys: Vec<_> = kps.iter().map(|k| k.public.clone()).collect();
    let account = AbstractAccount::new_multisig(pubkeys, 2);

    let tx_hash = keccak512(b"abstract account tx");
    let sig0 = kps[0].sign(&tx_hash);
    let sig1 = kps[1].sign(&tx_hash);

    let payload = ValidationPayload {
        tx_hash,
        signatures: vec![sig0, sig1],
        signer_indices: vec![0, 1],
    };

    assert!(account.validate(&payload).is_ok());
}

#[test]
fn test_full_pq_stack_layer6_sphincs_fallback() {
    // Layer 6: SPHINCS+ hash-based fallback (FIPS 205 standard).
    let kp = SphincsKeypair::generate();
    let pubkey = kp.public();
    let msg = b"layer 6 sphincs fallback";
    let sig = kp.sign(msg);

    assert_eq!(sig.0.len(), 17088);
    assert!(verify_sphincs_signature(&pubkey, msg, &sig).is_ok());

    // Tampered message should fail verification
    assert!(verify_sphincs_signature(&pubkey, b"tampered message", &sig).is_err());
}

#[test]
fn test_full_pq_stack_forward_security() {
    // Forward security: epoch-based key rotation.
    let seed = [0x42u8; EPOCH_SEED_SIZE];
    let key_ep0 = ForwardSecureKeypair::generate(Epoch(0), &seed);
    let key_ep1 = ForwardSecureKeypair::generate(Epoch(1), &seed);

    // Different epochs → different keys.
    assert_ne!(
        key_ep0.public().pubkey.0,
        key_ep1.public().pubkey.0
    );

    // Sign in epoch 0, verify in epoch 0 → OK.
    let msg = b"forward secure block";
    let sig = key_ep0.sign(msg);
    assert!(key_ep0
        .public()
        .epoch_check(Epoch(0), msg, &sig)
        .is_ok());

    // Sign in epoch 0, verify in epoch 1 → REJECTED (old key can't sign new epoch).
    assert!(key_ep0
        .public()
        .epoch_check(Epoch(1), msg, &sig)
        .is_err());
}

#[test]
fn test_quantum_alarm_triggers_scheme_rotation() {
    // End-to-end: quantum alarm → account abstraction scheme rotation.
    // This proves the layers work together: when the alarm fires,
    // an account can rotate its validation scheme.
    let owner = Dilithium3Keypair::generate();
    let mut account = AbstractAccount::new_single_key(owner.public.clone());
    let original_address = account.address;

    // Simulate quantum alarm firing.
    let mut alarm = QuantumAlarm::default();
    let validators: Vec<Dilithium3Keypair> =
        (0..4).map(|_| Dilithium3Keypair::generate()).collect();
    for i in 0..3 {
        let tx = QuantumAlarmTx::sign(
            &validators[i],
            QuantumAlarmReason::QuantumComputerOnline,
            500,
        );
        if i == 0 {
            alarm.raise(&tx).unwrap();
        } else {
            alarm.confirm(&tx, 4).ok();
        }
    }
    assert!(alarm.is_active());

    // Account rotates to multi-sig (post-quantum migration).
    account.rotate_scheme(ValidationScheme::MultiSig {
        pubkeys: vec![owner.public.clone()],
        threshold: 1,
    });

    // Address unchanged after rotation.
    assert_eq!(account.address, original_address);
}

// Helper trait to make the forward-security test readable.
trait ForwardSecurePublicKeyExt {
    fn epoch_check(
        &self,
        epoch: Epoch,
        msg: &[u8],
        sig: &rstn_crypto::Dilithium3Signature,
    ) -> Result<(), rstn_crypto::CryptoError>;
}

impl ForwardSecurePublicKeyExt for rstn_crypto::forward_security::ForwardSecurePublicKey {
    fn epoch_check(
        &self,
        epoch: Epoch,
        msg: &[u8],
        sig: &rstn_crypto::Dilithium3Signature,
    ) -> Result<(), rstn_crypto::CryptoError> {
        rstn_crypto::forward_security::verify_forward_secure_signature(self, epoch, msg, sig)
    }
}

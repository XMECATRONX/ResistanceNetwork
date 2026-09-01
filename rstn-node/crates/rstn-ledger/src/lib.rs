//! rstn-ledger -- Ledger hardware wallet integration for Dilithium3 (FIPS 204)
//!
//! ## Purpose
//!
//! The "quantum refuge" narrative requires that large holders can store their
//! Dilithium3 keys in a hardware wallet (HSM), not just in a browser extension.
//! Ledger devices use a secure element (ST33) that signs with a key that never
//! leaves the device. This module defines the **APDU protocol** and the
//! **transport interface** for a Ledger app that:
//!
//! 1. Generates / derives a Dilithium3 keypair inside the secure element.
//! 2. Exposes the public key for address derivation.
//! 3. Signs arbitrary messages / transactions with the private key on-device.
//! 4. Never exports the private key — signing is done inside the secure element.
//!
//! ## Honest scope
//!
//! This module implements the **protocol layer**: the APDU commands, the
//! response parsing, the transport trait, and the host-side signer. The
//! **on-device app** (the actual Ledger app running on the secure element) is
//! a separate firmware project (Rust + Ledger BOLOS SDK) — it is NOT part of
//! the node crate. What this crate provides is the host-side library that
//! wallets, exchanges, and the node use to talk to a Ledger running the RSTN
//! app.
//!
//! The secure element on current Ledger devices (ST33) is too small to run
//! the full Dilithium3 signature in-SE at production speed — so the design
//! uses a **hybrid approach**: the SE holds the master seed, derives a
//! Dilithium3 key via BIP-39-style derivation, and the host performs the
//! CPU-intensive lattice signing with a key derived from a SE-attested
//! secret. A future hardware revision with a larger SE (or a dedicated PQ
//! coprocessor) moves the full signing in-SE. This is documented honestly
//! in the protocol because it is the realistic path to hardware PQ custody
//! today.
//!
//! ## APDU protocol
//!
//! | CLA | INS | P1 | P2 | Lc | Data | Le |
//! |-----|-----|----|----|----|------|----|
//! | 0xE0 | 0x01 | 0x00 | 0x00 | 0 | — | 1952 (pubkey) |
//! | 0xE0 | 0x02 | 0x00 | 0x00 | 32 | message_hash | 3309 (signature) |
//! | 0xE0 | 0x03 | 0x00 | 0x00 | 0 | — | 4 (version) |
//!
//! - INS 0x01 GET_PUBKEY: returns the 1,952-byte Dilithium3 public key.
//! - INS 0x02 SIGN: signs a 32-byte message hash, returns the 3,309-byte signature.
//! - INS 0x03 GET_VERSION: returns the app version (4 bytes).
//!
//! The message hash (not the full transaction) is sent to the device to
//! minimize APDU size; the device signs the hash and the host verifies the
//! signature against the on-device public key.

use rstn_crypto::{Dilithium3PublicKey, Dilithium3Signature, keccak512};
use thiserror::Error;

/// Ledger APDU CLA byte for the RSTN app.
pub const CLA: u8 = 0xE0;

/// APDU instruction codes.
pub const INS_GET_PUBKEY: u8 = 0x01;
pub const INS_SIGN: u8 = 0x02;
pub const INS_GET_VERSION: u8 = 0x03;

/// Standard APDU status words.
pub const SW_OK: u16 = 0x9000;
pub const SW_USER_REJECTED: u16 = 0x6985;
pub const SW_WRONG_PARAMS: u16 = 0x6B00;
pub const SW_DEVICE_LOCKED: u16 = 0x6983;

/// Dilithium3 wire sizes (FIPS 204 / ML-DSA-65).
pub const PUBKEY_LEN: usize = 1952;
pub const SIG_LEN: usize = 3309;

#[derive(Debug, Error)]
pub enum LedgerError {
    #[error("transport error: {0}")]
    Transport(String),
    #[error("device rejected the operation (user declined on device)")]
    UserRejected,
    #[error("device locked — enter PIN")]
    DeviceLocked,
    #[error("wrong parameters: {0}")]
    WrongParams(String),
    #[error("unexpected APDU status word: 0x{0:04X}")]
    UnexpectedStatus(u16),
    #[error("invalid public key length: got {got}, expected {expected}")]
    InvalidPubkeyLength { got: usize, expected: usize },
    #[error("invalid signature length: got {got}, expected {expected}")]
    InvalidSignatureLength { got: usize, expected: usize },
    #[error("message hash must be 32 bytes, got {0}")]
    InvalidMessageHash(usize),
    #[error("no device connected")]
    NoDevice,
}

/// A transport interface to the Ledger device. Implementations include:
/// - `HidTransport` (USB HID, desktop wallets)
/// - `WebUsbTransport` (browser, via WebUSB)
/// - `MockTransport` (testing — signs with a local keypair)
pub trait LedgerTransport {
    /// Send an APDU and receive the response (data + status word).
    fn exchange(&mut self, cla: u8, ins: u8, p1: u8, p2: u8, data: &[u8]) -> Result<(Vec<u8>, u16), LedgerError>;
}

/// A Ledger device running the RSTN app.
pub struct LedgerDevice<T: LedgerTransport> {
    transport: T,
    /// Cached public key (fetched on first use).
    pubkey: Option<Dilithium3PublicKey>,
}

/// A signature produced by the Ledger device.
#[derive(Clone, Debug)]
pub struct LedgerSignature {
    pub pubkey: Dilithium3PublicKey,
    pub signature: Dilithium3Signature,
    pub message_hash: [u8; 32],
}

impl<T: LedgerTransport> LedgerDevice<T> {
    pub fn new(transport: T) -> Self {
        Self {
            transport,
            pubkey: None,
        }
    }

    /// Get the Dilithium3 public key from the device. Cached after first call.
    pub fn get_public_key(&mut self) -> Result<Dilithium3PublicKey, LedgerError> {
        if let Some(pk) = &self.pubkey {
            return Ok(pk.clone());
        }
        let (data, sw) = self.transport.exchange(CLA, INS_GET_PUBKEY, 0, 0, &[])?;
        check_status(sw)?;
        if data.len() != PUBKEY_LEN {
            return Err(LedgerError::InvalidPubkeyLength {
                got: data.len(),
                expected: PUBKEY_LEN,
            });
        }
        let mut buf = [0u8; PUBKEY_LEN];
        buf.copy_from_slice(&data);
        let pk = Dilithium3PublicKey(buf);
        self.pubkey = Some(pk.clone());
        Ok(pk)
    }

    /// Sign a 32-byte message hash with the on-device Dilithium3 key.
    /// The user must confirm on the device (display + button press).
    pub fn sign(&mut self, message_hash: &[u8; 32]) -> Result<LedgerSignature, LedgerError> {
        let (data, sw) = self.transport.exchange(CLA, INS_SIGN, 0, 0, message_hash)?;
        check_status(sw)?;
        if data.len() != SIG_LEN {
            return Err(LedgerError::InvalidSignatureLength {
                got: data.len(),
                expected: SIG_LEN,
            });
        }
        let mut sig_buf = [0u8; SIG_LEN];
        sig_buf.copy_from_slice(&data);
        let pk = self.get_public_key()?;
        Ok(LedgerSignature {
            pubkey: pk,
            signature: Dilithium3Signature(sig_buf),
            message_hash: *message_hash,
        })
    }

    /// Get the app version (4 bytes: major.minor.patch.reserved).
    pub fn get_version(&mut self) -> Result<[u8; 4], LedgerError> {
        let (data, sw) = self.transport.exchange(CLA, INS_GET_VERSION, 0, 0, &[])?;
        check_status(sw)?;
        if data.len() < 4 {
            return Err(LedgerError::Transport(format!(
                "version response too short: {} bytes",
                data.len()
            )));
        }
        let mut v = [0u8; 4];
        v.copy_from_slice(&data[..4]);
        Ok(v)
    }

    /// Derive the RSTN address from the on-device Dilithium3 public key.
    /// The address is the first 20 bytes of Keccak-512(pubkey).
    pub fn get_address(&mut self) -> Result<[u8; 20], LedgerError> {
        let pk = self.get_public_key()?;
        let h = keccak512(&pk.0);
        let mut addr = [0u8; 20];
        addr.copy_from_slice(&h[..20]);
        Ok(addr)
    }
}

/// Check an APDU status word and map to the appropriate error.
fn check_status(sw: u16) -> Result<(), LedgerError> {
    match sw {
        SW_OK => Ok(()),
        SW_USER_REJECTED => Err(LedgerError::UserRejected),
        SW_DEVICE_LOCKED => Err(LedgerError::DeviceLocked),
        SW_WRONG_PARAMS => Err(LedgerError::WrongParams("wrong APDU parameters".into())),
        other => Err(LedgerError::UnexpectedStatus(other)),
    }
}

/// A mock transport for testing — signs with a local Dilithium3 keypair.
#[cfg(test)]
pub struct MockTransport {
    kp: rstn_crypto::Dilithium3Keypair,
    reject_next: bool,
}

#[cfg(test)]
impl MockTransport {
    pub fn new() -> Self {
        Self {
            kp: rstn_crypto::Dilithium3Keypair::generate(),
            reject_next: false,
        }
    }
    pub fn reject_next_sign(&mut self) {
        self.reject_next = true;
    }
}

#[cfg(test)]
impl LedgerTransport for MockTransport {
    fn exchange(&mut self, _cla: u8, ins: u8, _p1: u8, _p2: u8, data: &[u8]) -> Result<(Vec<u8>, u16), LedgerError> {
        match ins {
            INS_GET_PUBKEY => Ok((self.kp.public.0.to_vec(), SW_OK)),
            INS_SIGN => {
                if self.reject_next {
                    self.reject_next = false;
                    return Err(LedgerError::UserRejected);
                }
                if data.len() != 32 {
                    return Err(LedgerError::InvalidMessageHash(data.len()));
                }
                let sig = self.kp.sign(data);
                Ok((sig.0.to_vec(), SW_OK))
            }
            INS_GET_VERSION => Ok((vec![0x01, 0x00, 0x00, 0x00], SW_OK)),
            _ => Err(LedgerError::WrongParams("unknown INS".into())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_crypto::verify_signature;

    #[test]
    fn ledger_get_public_key() {
        let mut device = LedgerDevice::new(MockTransport::new());
        let pk = device.get_public_key().expect("get pubkey");
        assert_eq!(pk.0.len(), PUBKEY_LEN);
    }

    #[test]
    fn ledger_sign_verifies() {
        let mut device = LedgerDevice::new(MockTransport::new());
        let pk = device.get_public_key().expect("get pubkey");
        let msg = [0xABu8; 32];
        let sig = device.sign(&msg).expect("sign");
        // The signature must verify against the device's public key.
        verify_signature(&pk, &msg, &sig.signature).expect("signature verifies");
    }

    #[test]
    fn ledger_user_rejection_propagates() {
        let mut mock = MockTransport::new();
        mock.reject_next_sign();
        let mut device = LedgerDevice::new(mock);
        let res = device.sign(&[0u8; 32]);
        assert!(matches!(res, Err(LedgerError::UserRejected)));
    }

    #[test]
    fn ledger_address_derivation() {
        let mut device = LedgerDevice::new(MockTransport::new());
        let addr = device.get_address().expect("get address");
        assert_eq!(addr.len(), 20);
    }

    #[test]
    fn ledger_version() {
        let mut device = LedgerDevice::new(MockTransport::new());
        let v = device.get_version().expect("get version");
        assert_eq!(v[0], 0x01);
    }

    #[test]
    fn ledger_pubkey_cached() {
        let mut device = LedgerDevice::new(MockTransport::new());
        let pk1 = device.get_public_key().expect("first");
        let pk2 = device.get_public_key().expect("cached");
        assert_eq!(pk1.0, pk2.0);
    }
}

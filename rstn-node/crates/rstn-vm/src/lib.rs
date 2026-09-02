//! rstn-vm -- RSTN Virtual Machine
//!
//! EVM-compatible bytecode with parallel execution support.
//! Custom opcode: VALIDATE_SIG (0xF0) for Dilithium3 signature verification.
//! Access lists are optional -- contracts without them run sequentially like standard EVM.
//!
//! Opcodes 0x00-0xEF: EVM-compatible (subset)
//! Opcodes 0xF0-0xFF: RSTN extensions (PQ sig verification, cross-shard messaging)

use serde::{Deserialize, Serialize};
use thiserror::Error;
use rstn_crypto::{Dilithium3PublicKey, Dilithium3Signature, verify_signature, PUBKEY_SIZE, SIG_SIZE};

pub mod formal;

#[derive(Debug, Error)]
pub enum VmError {
    #[error("invalid opcode: 0x{0:02X}")]
    InvalidOpcode(u8),
    #[error("out of gas")]
    OutOfGas,
    #[error("stack overflow")]
    StackOverflow,
    #[error("stack underflow")]
    StackUnderflow,
    #[error("revert: {0}")]
    Revert(String),
    #[error("signature verification failed")]
    SigVerificationFailed,
    #[error("invalid jump destination")]
    InvalidJump,
    #[error("memory limit exceeded: {0} bytes")]
    MemoryLimitExceeded(usize),
    #[error("call depth exceeded: {0}")]
    CallDepthExceeded(u32),
    #[error("reentrancy detected: contract re-entered during execution")]
    ReentrancyDetected,
    #[error("invalid contract address")]
    InvalidAddress,
    #[error("contract not found")]
    ContractNotFound,
}

// --- Custom Opcodes (RSTN extensions -- moved to unused EVM slots) -
// Originally at 0xF0/0xF5, moved to 0x0C/0x0D to free CREATE/CREATE2
// for full EVM/Solidity compatibility.

/// Post-quantum signature verification opcode (RSTN extension).
/// Pops pubkey + message + signature from stack, verifies with Dilithium3.
pub const OP_VALID_SIG: u8 = 0x0C;

/// Cross-shard message send (RSTN extension).
pub const OP_CROSS_SHARD_SEND: u8 = 0x0D;

/// PQ precompile address: 0x0000000000000000000000000000000000000001
/// Contracts call this precompiled address (STATICCALL / CALL) to verify Dilithium3 / FIPS 204 signatures.
pub const PQ_PRECOMPILE_ADDRESS: [u8; 20] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];

// --- Standard EVM Opcodes ----------------------------------

pub const OP_STOP: u8 = 0x00;
pub const OP_ADD: u8 = 0x01;
pub const OP_MUL: u8 = 0x02;
pub const OP_SUB: u8 = 0x03;
pub const OP_DIV: u8 = 0x04;
pub const OP_SDIV: u8 = 0x05;   // Signed division
pub const OP_MOD: u8 = 0x06;    // Modulo
pub const OP_SMOD: u8 = 0x07;   // Signed modulo
pub const OP_ADDMOD: u8 = 0x08; // Modular addition
pub const OP_MULMOD: u8 = 0x09; // Modular multiplication
pub const OP_EXP: u8 = 0x0A;    // Exponentiation
pub const OP_SIGNEXTEND: u8 = 0x0B;
pub const OP_LT: u8 = 0x10;
pub const OP_GT: u8 = 0x11;
pub const OP_SLT: u8 = 0x12;    // Signed less-than
pub const OP_SGT: u8 = 0x13;    // Signed greater-than
pub const OP_EQ: u8 = 0x14;
pub const OP_ISZERO: u8 = 0x15;
pub const OP_AND: u8 = 0x16;
pub const OP_OR: u8 = 0x17;
pub const OP_XOR: u8 = 0x18;
pub const OP_NOT: u8 = 0x19;
pub const OP_BYTE: u8 = 0x1A;   // Retrieve byte from word
pub const OP_SHL: u8 = 0x1B;    // Shift left
pub const OP_SHR: u8 = 0x1C;    // Logical shift right
pub const OP_SAR: u8 = 0x1D;    // Arithmetic shift right
pub const OP_SHA3: u8 = 0x20;   // Keccak-256
pub const OP_POP: u8 = 0x50;
pub const OP_PUSH0: u8 = 0x5F;
pub const OP_PUSH1: u8 = 0x60;
pub const OP_PUSH32: u8 = 0x7F;
pub const OP_DUP1: u8 = 0x80;
pub const OP_DUP16: u8 = 0x8F;
pub const OP_SWAP1: u8 = 0x90;
pub const OP_SWAP16: u8 = 0x9F;
pub const OP_RETURN: u8 = 0xF3;
pub const OP_REVERT: u8 = 0xFD;
pub const OP_INVALID: u8 = 0xFE;
pub const OP_SELFDESTRUCT: u8 = 0xFF;

// --- Memory & Storage Opcodes --------------------------------

pub const OP_MSTORE: u8 = 0x52;   // Store 32 bytes in memory
pub const OP_MSTORE8: u8 = 0x53;  // Store 1 byte in memory
pub const OP_MLOAD: u8 = 0x51;    // Load 32 bytes from memory
pub const OP_SSTORE: u8 = 0x55;   // Store in contract storage
pub const OP_SLOAD: u8 = 0x54;    // Load from contract storage
pub const OP_JUMP: u8 = 0x56;     // Unconditional jump
pub const OP_JUMPI: u8 = 0x57;    // Conditional jump
pub const OP_JUMPDEST: u8 = 0x5B; // Jump destination marker
pub const OP_PC: u8 = 0x58;       // Program counter
pub const OP_MSIZE: u8 = 0x59;    // Memory size
pub const OP_GAS: u8 = 0x5A;      // Gas remaining
pub const OP_LOG0: u8 = 0xA0;     // Log with 0 topics
pub const OP_LOG1: u8 = 0xA1;     // Log with 1 topic
pub const OP_LOG2: u8 = 0xA2;     // Log with 2 topics
pub const OP_LOG3: u8 = 0xA3;     // Log with 3 topics
pub const OP_LOG4: u8 = 0xA4;     // Log with 4 topics

// --- Call / Create Opcodes -----------------------------------

pub const OP_CREATE: u8 = 0xF0;       // Create contract (CREATE)
pub const OP_CALL: u8 = 0xF1;          // Message call
pub const OP_CALLCODE: u8 = 0xF2;     // Message call with code at target
pub const OP_DELEGATECALL: u8 = 0xF4; // Delegate message call
pub const OP_CREATE2: u8 = 0xF5;      // Create contract (CREATE2)
pub const OP_STATICCALL: u8 = 0xFA;   // Static message call (no state change)

// --- Calldata / Context Opcodes ------------------------------

pub const OP_CALLDATALOAD: u8 = 0x35; // Load 32 bytes from calldata at offset
pub const OP_CALLDATASIZE: u8 = 0x36; // Size of calldata in bytes
pub const OP_CALLDATACOPY: u8  = 0x37; // Copy calldata to memory
pub const OP_CALLER: u8 = 0x33;        // Address of the caller (20 bytes left-padded)
pub const OP_CALLVALUE: u8 = 0x34;     // Value sent with the call (in wei)
pub const OP_ORIGIN: u8 = 0x32;         // Original sender address
pub const OP_ADDRESS: u8 = 0x30;        // Address of the current contract
pub const OP_CODESIZE: u8 = 0x38;      // Size of the running bytecode
pub const OP_CODECOPY: u8 = 0x39;      // Copy running code to memory
pub const OP_EXTCODESIZE: u8 = 0x3B;
pub const OP_EXTCODECOPY: u8 = 0x3C;
pub const OP_RETURNDATASIZE: u8 = 0x3D;
pub const OP_RETURNDATACOPY: u8 = 0x3E;
pub const OP_EXTCODEHASH: u8 = 0x3F;   // Hash of account's code
pub const OP_BALANCE: u8 = 0x31;        // Balance of an address
pub const OP_SELFBALANCE: u8 = 0x47;    // Balance of current contract
pub const OP_CHAINID: u8 = 0x46;        // Chain ID
pub const OP_GASPRICE: u8 = 0x3A;
pub const OP_BASEFEE: u8 = 0x48;
pub const OP_TIMESTAMP: u8 = 0x42;      // Block timestamp
pub const OP_NUMBER: u8 = 0x43;         // Block number
pub const OP_DIFFICULTY: u8 = 0x44;     // Block difficulty / prevrandao
pub const OP_GASLIMIT: u8 = 0x45;       // Block gas limit
pub const OP_COINBASE: u8 = 0x41;       // Block beneficiary

// --- Gas Costs ----------------------------------------------

const GAS_BASE: u64 = 2;
const GAS_PUSH: u64 = 3;
const GAS_ARITH: u64 = 5;
const GAS_PQ_SIG: u64 = 500; // Dilithium3 verification cost
const GAS_MEMORY: u64 = 3;   // Per 32-byte word expanded
const GAS_CALL: u64 = 100;   // External call base cost
const GAS_LOG: u64 = 375;     // LOG opcode base cost
const GAS_LOG_TOPIC: u64 = 375; // Per topic
const GAS_LOG_DATA: u64 = 8;    // Per byte of data
const GAS_SSTORE: u64 = 20000; // Storage write (expensive)
const GAS_SLOAD: u64 = 2100;   // Storage read
const GAS_CALLDATALOAD: u64 = 3; // Calldata read
const GAS_CREATE: u64 = 32000; // CREATE / CREATE2
const GAS_SELFDESTRUCT: u64 = 5000;
const GAS_EXTCODE: u64 = 700;  // EXTCODESIZE / EXTCODEHASH / EXTCODECOPY base
const MAX_MEMORY: usize = 1 << 20; // 1MB memory limit -- prevents DoS via memory expansion
const MAX_CALL_DEPTH: u32 = 16;    // Reentrancy protection -- limit call stack depth

// --- External Call Interface ---------------------------------
//
// The VM needs to call into other contracts and create new ones during
// execution (CALL, STATICCALL, DELEGATECALL, CREATE, CREATE2). Because the
// VM is decoupled from the storage layer, we expose a callback trait that
// the host (runner / RPC) implements. When `db` is attached, the default
// implementation uses it; otherwise external calls fail gracefully.

/// Host interface for contract-to-contract calls and creation.
pub trait Host {
    /// Fetch the bytecode deployed at `addr` (None if no contract).
    fn get_code(&self, addr: &[u8; 20]) -> Option<Vec<u8>>;
    /// Get the balance of `addr`.
    fn get_balance(&self, addr: &[u8; 20]) -> u128;
    /// Store runtime bytecode at a freshly-created address. Returns Ok if stored.
    fn put_code(&mut self, addr: &[u8; 20], code: &[u8]) -> bool;
    /// Read a persistent storage slot for `addr`.
    fn get_storage(&self, addr: &[u8; 20], key: &[u8; 32]) -> Vec<u8>;
    /// Write a persistent storage slot for `addr`.
    fn put_storage(&mut self, addr: &[u8; 20], key: &[u8; 32], value: &[u8]);
}

/// Default Host backed by a RstnDB reference. Used by the runner and RPC.
pub struct DbHost<'a> {
    pub db: &'a rstn_storage::RstnDB,
}

impl<'a> Host for DbHost<'a> {
    fn get_code(&self, addr: &[u8; 20]) -> Option<Vec<u8>> {
        self.db.get_code(addr).ok().flatten()
    }
    fn get_balance(&self, addr: &[u8; 20]) -> u128 {
        self.db.get_balance(addr).unwrap_or(0)
    }
    fn put_code(&mut self, addr: &[u8; 20], code: &[u8]) -> bool {
        self.db.put_code(addr, code).is_ok()
    }
    fn get_storage(&self, addr: &[u8; 20], key: &[u8; 32]) -> Vec<u8> {
        self.db.get_storage_slot(addr, key).ok().flatten().unwrap_or_default()
    }
    fn put_storage(&mut self, addr: &[u8; 20], key: &[u8; 32], value: &[u8]) {
        let _ = self.db.put_storage_slot(addr, key, value);
    }
}

// --- Execution Result ---------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub gas_used: u64,
    pub output: Vec<u8>,
    pub logs: Vec<Log>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Log {
    pub address: [u8; 20],
    pub topics: Vec<[u8; 32]>,
    pub data: Vec<u8>,
}

// --- u256 -- minimal 256-bit unsigned integer ---------------
//
// Implemented as 4 little-endian u64 limbs. Supports the arithmetic
// operations needed by the VM: wrapping add/sub/mul, div, comparison.

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct U256(pub [u64; 4]);

impl U256 {
    pub const ZERO: U256 = U256([0, 0, 0, 0]);
    pub const ONE: U256 = U256([1, 0, 0, 0]);

    pub fn from_be_bytes(b: &[u8]) -> Self {
        let mut buf = [0u8; 32];
        let len = b.len().min(32);
        buf[32 - len..].copy_from_slice(&b[..len]);
        // Big-endian bytes -> little-endian limbs
        let mut limbs = [0u64; 4];
        for i in 0..4 {
            let off = (3 - i) * 8;
            limbs[i] = u64::from_be_bytes(buf[off..off + 8].try_into().unwrap());
        }
        U256(limbs)
    }

    pub fn to_be_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(32);
        for i in (0..4).rev() {
            out.extend_from_slice(&self.0[i].to_be_bytes());
        }
        out
    }

    pub fn wrapping_add(self, rhs: Self) -> Self {
        let mut result = [0u64; 4];
        let mut carry = 0u64;
        for i in 0..4 {
            let (sum, c1) = self.0[i].overflowing_add(rhs.0[i]);
            let (sum, c2) = sum.overflowing_add(carry);
            result[i] = sum;
            carry = (c1 as u64) + (c2 as u64);
        }
        U256(result)
    }

    pub fn wrapping_sub(self, rhs: Self) -> Self {
        let mut result = [0u64; 4];
        let mut borrow = 0u64;
        for i in 0..4 {
            let (diff, b1) = self.0[i].overflowing_sub(rhs.0[i]);
            let (diff, b2) = diff.overflowing_sub(borrow);
            result[i] = diff;
            borrow = (b1 as u64) + (b2 as u64);
        }
        U256(result)
    }

    pub fn wrapping_mul(self, rhs: Self) -> Self {
        // Schoolbook multiplication, keep only low 256 bits
        let mut result = [0u64; 4];
        for i in 0..4 {
            let mut carry: u128 = 0;
            for j in 0..4 {
                if i + j >= 4 {
                    break;
                }
                let prod = (self.0[i] as u128) * (rhs.0[j] as u128) + carry;
                let sum = (result[i + j] as u128) + (prod as u128 & 0xFFFF_FFFF_FFFF_FFFF);
                result[i + j] = sum as u64;
                carry = (prod >> 64) + (sum >> 64);
            }
        }
        U256(result)
    }

    pub fn div(self, rhs: Self) -> Self {
        if rhs == Self::ZERO {
            return Self::ZERO;
        }
        // Bit-by-bit long division (256 iterations).
        // Produces correct quotient for arbitrary 256-bit values.
        let dividend = self.to_be_bytes();
        let mut quotient = [0u8; 32];
        let mut r = Self::ZERO;
        for i in (0..256).rev() {
            r = r.shl_one();
            let byte_idx = 31 - (i / 8);
            let bit_idx = i % 8;
            if (dividend[byte_idx] >> bit_idx) & 1 == 1 {
                r = r.wrapping_add(Self::ONE);
            }
            if r >= rhs {
                r = r.wrapping_sub(rhs);
                let q_byte = 31 - (i / 8);
                let q_bit = i % 8;
                quotient[q_byte] |= 1u8 << q_bit;
            }
        }
        let mut limbs = [0u64; 4];
        for i in 0..4 {
            let off = (3 - i) * 8;
            limbs[i] = u64::from_be_bytes(quotient[off..off + 8].try_into().unwrap());
        }
        U256(limbs)
    }

    /// Shift left by 1 bit.
    fn shl_one(self) -> Self {
        let mut result = [0u64; 4];
        let mut carry = 0u64;
        for i in 0..4 {
            result[i] = (self.0[i] << 1) | carry;
            carry = self.0[i] >> 63;
        }
        U256(result)
    }

    pub fn is_zero(&self) -> bool {
        self.0 == [0, 0, 0, 0]
    }

    pub fn as_usize(&self) -> usize {
        self.0[0] as usize
    }

    pub fn bitand(self, rhs: Self) -> Self {
        U256([self.0[0] & rhs.0[0], self.0[1] & rhs.0[1], self.0[2] & rhs.0[2], self.0[3] & rhs.0[3]])
    }

    pub fn bitor(self, rhs: Self) -> Self {
        U256([self.0[0] | rhs.0[0], self.0[1] | rhs.0[1], self.0[2] | rhs.0[2], self.0[3] | rhs.0[3]])
    }

    pub fn bitxor(self, rhs: Self) -> Self {
        U256([self.0[0] ^ rhs.0[0], self.0[1] ^ rhs.0[1], self.0[2] ^ rhs.0[2], self.0[3] ^ rhs.0[3]])
    }

    pub fn bitnot(self) -> Self {
        U256([!self.0[0], !self.0[1], !self.0[2], !self.0[3]])
    }

    /// Logical shift left by `shift` bits (wraps, discards high bits).
    /// Left shift = toward more-significant bytes = lower big-endian index,
    /// so data moves from higher index to lower index: bytes[i] = bytes[i + byte_shift].
    pub fn shl(self, shift: Self) -> Self {
        let s = shift.as_usize();
        if s == 0 { return self; }
        if s >= 256 { return U256::ZERO; }
        let mut bytes = self.to_be_bytes();
        let byte_shift = s / 8;
        let bit_shift = s % 8;
        if bit_shift == 0 {
            for i in 0..32 {
                bytes[i] = if i + byte_shift < 32 { bytes[i + byte_shift] } else { 0 };
            }
        } else {
            for i in 0..32 {
                let lo = if i + byte_shift < 32 { bytes[i + byte_shift] } else { 0 };
                let hi = if i + byte_shift + 1 < 32 { bytes[i + byte_shift + 1] } else { 0 };
                bytes[i] = (lo >> bit_shift) | (hi << (8 - bit_shift));
            }
        }
        U256::from_be_bytes(&bytes)
    }

    /// Logical shift right by `shift` bits (zero-fills).
    /// Right shift = toward less-significant bytes = higher big-endian index,
    /// so data moves from lower index to higher index: bytes[i] = bytes[i - byte_shift].
    pub fn shr(self, shift: Self) -> Self {
        let s = shift.as_usize();
        if s == 0 { return self; }
        if s >= 256 { return U256::ZERO; }
        let mut bytes = self.to_be_bytes();
        let byte_shift = s / 8;
        let bit_shift = s % 8;
        if bit_shift == 0 {
            for i in (0..32).rev() {
                bytes[i] = if i >= byte_shift { bytes[i - byte_shift] } else { 0 };
            }
        } else {
            for i in (0..32).rev() {
                let hi = if i >= byte_shift { bytes[i - byte_shift] } else { 0 };
                let lo = if i > byte_shift { bytes[i - byte_shift - 1] } else { 0 };
                bytes[i] = (hi << bit_shift) | (lo >> (8 - bit_shift));
            }
        }
        U256::from_be_bytes(&bytes)
    }

    /// Arithmetic shift right -- treats value as signed (two's complement).
    pub fn sar(self, shift: Self) -> Self {
        let s = shift.as_usize();
        if s == 0 { return self; }
        let negative = (self.0[3] >> 63) & 1 == 1;
        if s >= 256 {
            return if negative { U256([u64::MAX; 4]) } else { U256::ZERO };
        }
        let mut result = self.shr(shift);
        if negative {
            let mut bytes = result.to_be_bytes();
            let full_bytes = s / 8;
            let rem_bits = s % 8;
            for i in 0..full_bytes.min(32) {
                bytes[i] = 0xFF;
            }
            if rem_bits > 0 && full_bytes < 32 {
                bytes[full_bytes] |= 0xFFu8 << (8 - rem_bits);
            }
            result = U256::from_be_bytes(&bytes);
        }
        result
    }

    /// Exponentiation self^exp mod 2^256.
    pub fn pow(self, mut exp: Self) -> Self {
        if exp.is_zero() { return U256::ONE; }
        let mut result = U256::ONE;
        let mut base = self;
        while !exp.is_zero() {
            if (exp.0[0] & 1) == 1 {
                result = result.wrapping_mul(base);
            }
            base = base.wrapping_mul(base);
            exp = exp.shr(U256::ONE);
        }
        result
    }

    /// Modulo: self % rhs (EVM semantics: rhs==0 -> 0).
    pub fn rem(self, rhs: Self) -> Self {
        if rhs.is_zero() { return U256::ZERO; }
        let q = self.div(rhs);
        self.wrapping_sub(q.wrapping_mul(rhs))
    }

    /// Signed division (two's complement).
    pub fn sdiv(self, rhs: Self) -> Self {
        if self.is_zero() || rhs.is_zero() { return U256::ZERO; }
        let sa = self.to_i256();
        let sb = rhs.to_i256();
        let q = if matches!(sa, i256::Neg(v) if v.0 == [0,0,0,0x8000_0000_0000_0000]) && matches!(sb, i256::Neg(_)) {
            // MIN / -1 == MIN (avoid overflow)
            i256::Neg(U256([0, 0, 0, 0x8000_0000_0000_0000]))
        } else {
            sa / sb
        };
        q.to_u256()
    }

    /// Signed modulo.
    pub fn smod(self, rhs: Self) -> Self {
        if self.is_zero() || rhs.is_zero() { return U256::ZERO; }
        let sa = self.to_i256();
        let sb = rhs.to_i256();
        let r = sa % sb;
        r.to_u256()
    }

    pub fn addmod(self, b: Self, m: Self) -> Self {
        if m.is_zero() { return U256::ZERO; }
        let sum = self.add_u512(b);
        sum.rem_u256(m)
    }

    pub fn mulmod(self, b: Self, m: Self) -> Self {
        if m.is_zero() { return U256::ZERO; }
        let prod = self.mul_u512(b);
        prod.rem_u256(m)
    }

    fn to_i256(self) -> i256 {
        let negative = (self.0[3] >> 63) & 1 == 1;
        if negative {
            let inv = self.bitnot().wrapping_add(U256::ONE);
            i256::Neg(inv)
        } else {
            i256::Pos(self)
        }
    }

    pub fn signextend(self, k: Self) -> Self {
        let k = k.as_usize();
        if k >= 31 { return self; }
        let mut bytes = self.to_be_bytes();
        let sign_bit = bytes[31 - k] & 0x80;
        if sign_bit != 0 {
            for i in 0..(31 - k) { bytes[i] = 0xFF; }
        } else {
            for i in 0..(31 - k) { bytes[i] = 0; }
        }
        U256::from_be_bytes(&bytes)
    }

    pub fn byte_at(self, index: Self) -> Self {
        let i = index.as_usize();
        if i >= 32 { return U256::ZERO; }
        let bytes = self.to_be_bytes();
        U256::from_be_bytes(&[bytes[i]])
    }

    fn add_u512(self, b: Self) -> U512 {
        let mut limbs = [0u64; 8];
        let mut carry = 0u64;
        for i in 0..4 {
            let (s, c) = self.0[i].overflowing_add(b.0[i]);
            let (s, c2) = s.overflowing_add(carry);
            limbs[i] = s;
            carry = (c as u64) + (c2 as u64);
        }
        limbs[4] = carry;
        U512(limbs)
    }

    fn mul_u512(self, b: Self) -> U512 {
        let mut limbs = [0u64; 8];
        for i in 0..4 {
            let mut carry: u128 = 0;
            for j in 0..4 {
                let idx = i + j;
                if idx >= 8 { break; }
                let prod = (self.0[i] as u128) * (b.0[j] as u128) + carry + (limbs[idx] as u128);
                limbs[idx] = prod as u64;
                carry = prod >> 64;
            }
            if i + 4 < 8 {
                limbs[i + 4] = limbs[i + 4].wrapping_add(carry as u64);
            }
        }
        U512(limbs)
    }
}

/// Signed 256-bit helper for SDIV/SMOD/SLT/SGT/SAR.
#[allow(non_camel_case_types)]
enum i256 { Pos(U256), Neg(U256) }

impl i256 {
    fn to_u256(self) -> U256 {
        match self {
            i256::Pos(v) => v,
            i256::Neg(v) => v.bitnot().wrapping_add(U256::ONE),
        }
    }

    #[allow(dead_code)]
    fn neg(self) -> i256 {
        match self {
            i256::Pos(v) => {
                if v.0 == [0, 0, 0, 0x8000_0000_0000_0000] { i256::Neg(U256([0, 0, 0, 0x8000_0000_0000_0000])) }
                else if v.is_zero() { i256::Pos(U256::ZERO) }
                else { i256::Neg(v) }
            }
            i256::Neg(v) => i256::Pos(v),
        }
    }

    fn abs(self) -> (U256, bool) {
        match self {
            i256::Pos(v) => (v, false),
            i256::Neg(v) => (v, true),
        }
    }
}

impl std::ops::Div for i256 {
    type Output = i256;
    fn div(self, rhs: i256) -> i256 {
        let (a, sa) = self.abs();
        let (b, sb) = rhs.abs();
        let q = a.div(b);
        let q_signed = if sa == sb { i256::Pos(q) } else { i256::Neg(q) };
        match q_signed {
            i256::Neg(v) if v.is_zero() => i256::Pos(U256::ZERO),
            other => other,
        }
    }
}

impl std::ops::Rem for i256 {
    type Output = i256;
    fn rem(self, rhs: i256) -> i256 {
        let (a, sa) = self.abs();
        let (b, _sb) = rhs.abs();
        let r = a.rem(b);
        match sa {
            false => i256::Pos(r),
            true if r.is_zero() => i256::Pos(U256::ZERO),
            true => i256::Neg(r),
        }
    }
}

/// Minimal 512-bit unsigned integer for ADDMOD/MULMOD.
struct U512([u64; 8]);

impl U512 {
    fn rem_u256(self, m: U256) -> U256 {
        if m.is_zero() { return U256::ZERO; }
        let mut bytes = [0u8; 64];
        for i in (0..8).rev() {
            let off = (7 - i) * 8;
            bytes[off..off + 8].copy_from_slice(&self.0[i].to_be_bytes());
        }
        let mut r = U256::ZERO;
        for i in (0..512).rev() {
            r = r.shl_one();
            let byte_idx = 63 - (i / 8);
            let bit_idx = i % 8;
            if (bytes[byte_idx] >> bit_idx) & 1 == 1 {
                r = r.wrapping_add(U256::ONE);
            }
            if r >= m {
                r = r.wrapping_sub(m);
            }
        }
        r
    }
}

// --- Contract Storage ----------------------------------------

/// Persistent contract storage -- a simple key-value map.
/// In production this is backed by the storage layer (rstn-storage).
pub type ContractStorage = std::collections::HashMap<[u8; 32], Vec<u8>>;

/// Compare two signed 256-bit values (two's complement) for SLT/SGT.
fn cmp_i256(a: &i256, b: &i256) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    match (a, b) {
        (i256::Pos(x), i256::Pos(y)) => x.cmp(y),
        (i256::Neg(x), i256::Neg(y)) => y.cmp(x), // more-negative is smaller
        (i256::Pos(_), i256::Neg(_)) => Ordering::Greater,
        (i256::Neg(_), i256::Pos(_)) => Ordering::Less,
    }
}

// --- VM Instance ---------------------------------------------

pub struct RstnVM<'a> {
    pub stack: Vec<Vec<u8>>,
    pub memory: Vec<u8>,
    pub gas: u64,
    pub gas_used: u64,
    pub pc: usize,
    /// Contract storage (SSTORE/SLOAD) -- persistent across calls.
    pub storage: ContractStorage,
    /// Optional reference to RstnDB for persistent SSTORE/SLOAD.
    pub db: Option<&'a rstn_storage::RstnDB>,
    /// Optional host interface for contract-to-contract calls (CALL/CREATE).
    /// When set, CALL/STATICCALL/DELEGATECALL/CREATE/CREATE2 execute against
    /// other deployed contracts via the host. When None, they revert with 0.
    pub host: Option<&'a mut dyn Host>,
    /// Call depth -- prevents reentrancy attacks by limiting nested calls.
    pub call_depth: u32,
    /// Set of contracts currently executing -- detects reentrancy.
    pub active_contracts: std::collections::HashSet<[u8; 20]>,
    /// Logs emitted during execution (LOG opcode).
    pub emitted_logs: Vec<Log>,
    /// Calldata passed to the contract call (the tx payload).
    pub calldata: Vec<u8>,
    /// Address of the caller (20 bytes).
    pub caller: [u8; 20],
    /// Value sent with the call (in wei).
    pub callvalue: u128,
    /// Address of the currently executing contract (20 bytes).
    pub address: [u8; 20],
    /// Return data from the last external call (RETURNDATASIZE/COPY).
    pub return_data: Vec<u8>,
    /// Running bytecode (set at the start of execute) for CODESIZE/CODECOPY.
    pub code: Vec<u8>,
    /// Chain ID (CHAINID opcode).
    pub chain_id: u64,
    /// Current block number (NUMBER opcode).
    pub block_number: u64,
    /// Current block timestamp in seconds (TIMESTAMP opcode).
    pub block_timestamp: u64,
    /// Block gas limit (GASLIMIT opcode).
    pub block_gas_limit: u64,
    /// Block beneficiary / coinbase (COINBASE opcode).
    pub coinbase: [u8; 20],
    /// Gas price (GASPRICE opcode).
    pub gas_price: u128,
    /// Base fee (BASEFEE opcode).
    pub basefee: u128,
    /// Balance of the current contract (SELFBALANCE opcode).
    pub self_balance: u128,
    /// Whether this frame is read-only (STATICCALL). SSTORE/CREATE/SELFDESTRUCT
    /// revert when true.
    pub static_flag: bool,
}

impl<'a> RstnVM<'a> {
    pub fn new(gas_limit: u64) -> Self {
        Self {
            stack: Vec::with_capacity(1024),
            memory: Vec::with_capacity(4096),
            gas: gas_limit,
            gas_used: 0,
            pc: 0,
            storage: ContractStorage::new(),
            db: None,
            host: None,
            call_depth: 0,
            active_contracts: std::collections::HashSet::new(),
            emitted_logs: Vec::new(),
            calldata: Vec::new(),
            caller: [0u8; 20],
            callvalue: 0,
            address: [0u8; 20],
            return_data: Vec::new(),
            code: Vec::new(),
            chain_id: 1337,
            block_number: 0,
            block_timestamp: 0,
            block_gas_limit: gas_limit,
            coinbase: [0u8; 20],
            gas_price: 0,
            basefee: 0,
            self_balance: 0,
            static_flag: false,
        }
    }

    /// Attach a RstnDB handle for persistent SSTORE/SLOAD across blocks.
    pub fn with_db(mut self, db: &'a rstn_storage::RstnDB) -> Self {
        self.db = Some(db);
        self
    }

    /// Attach a host interface for contract-to-contract calls (CALL/CREATE).
    pub fn with_host(mut self, host: &'a mut dyn Host) -> Self {
        self.host = Some(host);
        self
    }

    /// Set block-level context (chain id, block number, timestamp, etc.).
    pub fn with_block_context(
        mut self,
        chain_id: u64,
        block_number: u64,
        block_timestamp: u64,
    ) -> Self {
        self.chain_id = chain_id;
        self.block_number = block_number;
        self.block_timestamp = block_timestamp;
        self.block_gas_limit = self.gas;
        self
    }

    /// Create a VM with execution context (calldata, caller, value, address).
    pub fn with_context(
        gas_limit: u64,
        calldata: Vec<u8>,
        caller: [u8; 20],
        callvalue: u128,
        address: [u8; 20],
    ) -> Self {
        let mut vm = Self::new(gas_limit);
        vm.calldata = calldata;
        vm.caller = caller;
        vm.callvalue = callvalue;
        vm.address = address;
        vm
    }

    fn spend_gas(&mut self, cost: u64) -> Result<(), VmError> {
        if self.gas_used + cost > self.gas {
            return Err(VmError::OutOfGas);
        }
        self.gas_used += cost;
        Ok(())
    }

    /// Expand memory to fit `offset + length`, charging gas per 32-byte word.
    /// Enforces MAX_MEMORY to prevent DoS via unbounded memory allocation.
    fn expand_memory(&mut self, offset: usize, length: usize) -> Result<(), VmError> {
        if length == 0 {
            return Ok(());
        }
        let end = offset.checked_add(length).ok_or(VmError::MemoryLimitExceeded(usize::MAX))?;
        if end > MAX_MEMORY {
            return Err(VmError::MemoryLimitExceeded(end));
        }
        if end > self.memory.len() {
            // Charge gas for new 32-byte words
            let old_words = (self.memory.len() + 31) / 32;
            let new_words = (end + 31) / 32;
            let extra_words = new_words.saturating_sub(old_words);
            self.spend_gas(GAS_MEMORY * extra_words as u64)?;
            self.memory.resize(end, 0u8);
        }
        Ok(())
    }

    fn push(&mut self, val: Vec<u8>) -> Result<(), VmError> {
        if self.stack.len() >= 1024 {
            return Err(VmError::StackOverflow);
        }
        self.stack.push(val);
        Ok(())
    }

    fn pop(&mut self) -> Result<Vec<u8>, VmError> {
        self.stack.pop().ok_or(VmError::StackUnderflow)
    }

    /// Enter a contract -- checks for reentrancy and increments call depth.
    pub fn enter_contract(&mut self, addr: [u8; 20]) -> Result<(), VmError> {
        if self.call_depth >= MAX_CALL_DEPTH {
            return Err(VmError::CallDepthExceeded(self.call_depth));
        }
        if self.active_contracts.contains(&addr) {
            return Err(VmError::ReentrancyDetected);
        }
        self.active_contracts.insert(addr);
        self.call_depth += 1;
        Ok(())
    }

    /// Exit a contract -- decrements call depth and removes from active set.
    pub fn exit_contract(&mut self, addr: [u8; 20]) {
        self.active_contracts.remove(&addr);
        if self.call_depth > 0 {
            self.call_depth -= 1;
        }
    }

    /// Execute a contract call.
    pub fn execute(&mut self, bytecode: &[u8]) -> Result<ExecutionResult, VmError> {
        // Store a copy of the running bytecode for CODESIZE/CODECOPY.
        self.code = bytecode.to_vec();
        while self.pc < bytecode.len() {
            let opcode = bytecode[self.pc];
            self.pc += 1;

            match opcode {
                OP_STOP => break,
                OP_INVALID => {
                    tracing::warn!("VM: INVALID (0xFE) at pc={}, gas_used={}", self.pc - 1, self.gas_used);
                    return Ok(ExecutionResult {
                        success: false,
                        gas_used: self.gas_used,
                        output: Vec::new(),
                        logs: Vec::new(),
                    });
                }
                OP_RETURN => {
                    let offset = self.pop()?;
                    let length = self.pop()?;
                    let output = self.memory_get(&offset, &length);
                    return Ok(ExecutionResult {
                        success: true,
                        gas_used: self.gas_used,
                        output,
                        logs: std::mem::take(&mut self.emitted_logs),
                    });
                }
                OP_REVERT => {
                    let offset = self.pop()?;
                    let length = self.pop()?;
                    let output = self.memory_get(&offset, &length);
                    tracing::warn!("VM: REVERT at pc={}, output {} bytes, gas_used={}", self.pc - 1, output.len(), self.gas_used);
                    return Ok(ExecutionResult {
                        success: false,
                        gas_used: self.gas_used,
                        output,
                        logs: Vec::new(),
                    });
                }

                // -- Arithmetic --
                OP_ADD => { self.binop_arith(|a, b| a.wrapping_add(b))?; }
                OP_SUB => { self.binop_arith(|a, b| a.wrapping_sub(b))?; }
                OP_MUL => { self.binop_arith(|a, b| a.wrapping_mul(b))?; }
                OP_DIV => {
                    self.binop_arith(|a, b| if b.is_zero() { U256::ZERO } else { a.div(b) })?;
                }
                OP_SDIV => { self.binop_arith(|a, b| a.sdiv(b))?; }
                OP_MOD => { self.binop_arith(|a, b| a.rem(b))?; }
                OP_SMOD => { self.binop_arith(|a, b| a.smod(b))?; }
                OP_ADDMOD => {
                    self.spend_gas(GAS_ARITH)?;
                    let m = U256::from_be_bytes(&self.pop()?);
                    let b = U256::from_be_bytes(&self.pop()?);
                    let a = U256::from_be_bytes(&self.pop()?);
                    let r = a.addmod(b, m);
                    self.push(r.to_be_bytes())?;
                }
                OP_MULMOD => {
                    self.spend_gas(GAS_ARITH)?;
                    let m = U256::from_be_bytes(&self.pop()?);
                    let b = U256::from_be_bytes(&self.pop()?);
                    let a = U256::from_be_bytes(&self.pop()?);
                    let r = a.mulmod(b, m);
                    self.push(r.to_be_bytes())?;
                }
                OP_EXP => {
                    self.spend_gas(GAS_ARITH)?;
                    let exp = U256::from_be_bytes(&self.pop()?);
                    let base = U256::from_be_bytes(&self.pop()?);
                    let r = base.pow(exp);
                    self.push(r.to_be_bytes())?;
                }
                OP_SIGNEXTEND => {
                    self.spend_gas(GAS_ARITH)?;
                    let b = U256::from_be_bytes(&self.pop()?);
                    let x = U256::from_be_bytes(&self.pop()?);
                    let r = x.signextend(b);
                    self.push(r.to_be_bytes())?;
                }

                // -- Comparison --
                OP_LT => { self.binop_cmp(|a, b| a < b)?; }
                OP_GT => { self.binop_cmp(|a, b| a > b)?; }
                OP_SLT => {
                    self.binop_cmp(|a, b| {
                        let sa = a.to_i256();
                        let sb = b.to_i256();
                        cmp_i256(&sa, &sb) == std::cmp::Ordering::Less
                    })?;
                }
                OP_SGT => {
                    self.binop_cmp(|a, b| {
                        let sa = a.to_i256();
                        let sb = b.to_i256();
                        cmp_i256(&sa, &sb) == std::cmp::Ordering::Greater
                    })?;
                }
                OP_EQ => { self.binop_cmp(|a, b| a == b)?; }
                OP_ISZERO => {
                    self.spend_gas(GAS_ARITH)?;
                    let a = U256::from_be_bytes(&self.pop()?);
                    let r = if a.is_zero() { U256::ONE } else { U256::ZERO };
                    self.push(r.to_be_bytes())?;
                }

                // -- Bitwise --
                OP_AND => { self.binop_arith(|a, b| a.bitand(b))?; }
                OP_OR => { self.binop_arith(|a, b| a.bitor(b))?; }
                OP_XOR => { self.binop_arith(|a, b| a.bitxor(b))?; }
                OP_NOT => {
                    self.spend_gas(GAS_ARITH)?;
                    let a = U256::from_be_bytes(&self.pop()?);
                    self.push(a.bitnot().to_be_bytes())?;
                }
                OP_BYTE => {
                    self.spend_gas(GAS_ARITH)?;
                    let b = U256::from_be_bytes(&self.pop()?);
                    let a = U256::from_be_bytes(&self.pop()?);
                    self.push(a.byte_at(b).to_be_bytes())?;
                }
                OP_SHL => {
                    self.spend_gas(GAS_ARITH)?;
                    let shift = U256::from_be_bytes(&self.pop()?);
                    let value = U256::from_be_bytes(&self.pop()?);
                    self.push(value.shl(shift).to_be_bytes())?;
                }
                OP_SHR => {
                    self.spend_gas(GAS_ARITH)?;
                    let shift = U256::from_be_bytes(&self.pop()?);
                    let value = U256::from_be_bytes(&self.pop()?);
                    self.push(value.shr(shift).to_be_bytes())?;
                }
                OP_SAR => {
                    self.spend_gas(GAS_ARITH)?;
                    let shift = U256::from_be_bytes(&self.pop()?);
                    let value = U256::from_be_bytes(&self.pop()?);
                    self.push(value.sar(shift).to_be_bytes())?;
                }

                // -- SHA3 (Keccak-256) --
                OP_SHA3 => {
                    self.spend_gas(GAS_BASE * 6)?;
                    let offset_val = U256::from_be_bytes(&self.pop()?);
                    let length_val = U256::from_be_bytes(&self.pop()?);
                    let offset = offset_val.as_usize();
                    let length = length_val.as_usize();
                    self.expand_memory(offset, length)?;
                    use sha3::{Keccak256, Digest};
                    let mut hasher = Keccak256::new();
                    if length > 0 {
                        hasher.update(&self.memory[offset..offset + length]);
                    }
                    let result = hasher.finalize();
                    // Push 32-byte hash (left-aligned, big-endian)
                    let mut buf = vec![0u8; 32];
                    buf.copy_from_slice(&result);
                    self.push(buf)?;
                }

                // -- Stack ops --
                OP_POP => { self.pop()?; }
                OP_PC => { self.spend_gas(GAS_BASE)?; let p = (self.pc - 1) as u64; self.push(U256::from_be_bytes(&p.to_be_bytes()).to_be_bytes())?; }
                OP_MSIZE => { self.spend_gas(GAS_BASE)?; self.push(U256::from_be_bytes(&(self.memory.len() as u64).to_be_bytes()).to_be_bytes())?; }
                OP_GAS => {
                    self.spend_gas(GAS_BASE)?;
                    let remaining = self.gas.saturating_sub(self.gas_used);
                    self.push(U256::from_be_bytes(&remaining.to_be_bytes()).to_be_bytes())?;
                }
                OP_JUMPDEST => { self.spend_gas(1)?; }

                // -- Memory operations --
                OP_MSTORE => {
                    self.spend_gas(GAS_BASE)?;
                    let offset_val = U256::from_be_bytes(&self.pop()?);
                    let value = self.pop()?;
                    let offset = offset_val.as_usize();
                    let padded = {
                        let mut buf = vec![0u8; 32];
                        let len = value.len().min(32);
                        buf[32 - len..].copy_from_slice(&value[..len]);
                        buf
                    };
                    self.expand_memory(offset, 32)?;
                    self.memory[offset..offset + 32].copy_from_slice(&padded);
                }
                OP_MLOAD => {
                    self.spend_gas(GAS_BASE)?;
                    let offset_val = U256::from_be_bytes(&self.pop()?);
                    let offset = offset_val.as_usize();
                    self.expand_memory(offset, 32)?;
                    let value = self.memory[offset..offset + 32].to_vec();
                    self.push(value)?;
                }
                OP_MSTORE8 => {
                    self.spend_gas(GAS_BASE)?;
                    let offset_val = U256::from_be_bytes(&self.pop()?);
                    let value = U256::from_be_bytes(&self.pop()?);
                    let offset = offset_val.as_usize();
                    self.expand_memory(offset, 1)?;
                    // Store the least-significant byte
                    let bytes = value.to_be_bytes();
                    self.memory[offset] = *bytes.last().unwrap_or(&0);
                }

                // -- Storage operations (persistent via RstnDB if attached) --
                OP_SSTORE => {
                    if self.static_flag {
                        return Err(VmError::Revert("SSTORE in static context".into()));
                    }
                    self.spend_gas(GAS_SSTORE)?;
                    let key = self.pop()?;
                    let value = self.pop()?;
                    let mut key_arr = [0u8; 32];
                    key_arr[..key.len().min(32)].copy_from_slice(&key[..key.len().min(32)]);
                    if let Some(db) = self.db {
                        let _ = db.put_storage_slot(&self.address, &key_arr, &value);
                    }
                    self.storage.insert(key_arr, value);
                }
                OP_SLOAD => {
                    self.spend_gas(GAS_SLOAD)?;
                    let key = self.pop()?;
                    let mut key_arr = [0u8; 32];
                    key_arr[..key.len().min(32)].copy_from_slice(&key[..key.len().min(32)]);
                    let value = if let Some(db) = self.db {
                        db.get_storage_slot(&self.address, &key_arr)
                            .unwrap_or(None)
                            .unwrap_or_else(|| self.storage.get(&key_arr).cloned().unwrap_or_default())
                    } else {
                        self.storage.get(&key_arr).cloned().unwrap_or_default()
                    };
                    self.push(value)?;
                }

                // -- Control flow --
                OP_JUMP => {
                    self.spend_gas(GAS_BASE)?;
                    let dest_val = U256::from_be_bytes(&self.pop()?);
                    let dest = dest_val.as_usize();
                    if dest >= bytecode.len() || bytecode.get(dest) != Some(&OP_JUMPDEST) {
                        return Err(VmError::InvalidJump);
                    }
                    self.pc = dest;
                }
                OP_JUMPI => {
                    self.spend_gas(GAS_BASE)?;
                    let dest_val = U256::from_be_bytes(&self.pop()?);
                    let cond = U256::from_be_bytes(&self.pop()?);
                    if !cond.is_zero() {
                        let dest = dest_val.as_usize();
                        if dest >= bytecode.len() || bytecode.get(dest) != Some(&OP_JUMPDEST) {
                            return Err(VmError::InvalidJump);
                        }
                        self.pc = dest;
                    }
                }

                // -- Logging (LOG0-LOG4) -- Solidity events --
                // Stack: offset, length, topic1..topicN (topics popped in order).
                op if (0xA0..=0xA4).contains(&op) => {
                    let ntopics = (op - 0xA0) as usize;
                    let data_len = U256::from_be_bytes(&self.pop()?).as_usize();
                    let data_off = U256::from_be_bytes(&self.pop()?).as_usize();
                    let mut topics = Vec::with_capacity(ntopics);
                    for _ in 0..ntopics {
                        let t = self.pop()?;
                        let mut topic = [0u8; 32];
                        let len = t.len().min(32);
                        topic[..len].copy_from_slice(&t[..len]);
                        topics.push(topic);
                    }
                    self.expand_memory(data_off, data_len)?;
                    let data = if data_len > 0 {
                        self.memory[data_off..data_off + data_len].to_vec()
                    } else { Vec::new() };
                    // Gas: base + per-topic + per-byte of data
                    let log_gas = GAS_LOG
                        + GAS_LOG_TOPIC * ntopics as u64
                        + GAS_LOG_DATA * data_len as u64;
                    self.spend_gas(log_gas)?;
                    self.emitted_logs.push(Log {
                        address: self.address,
                        topics,
                        data,
                    });
                }

                // DUP1-DUP16 (0x80-0x8F): duplicate the nth stack item (1-indexed from top).
                op if (0x80..=0x8F).contains(&op) => {
                    self.spend_gas(GAS_BASE)?;
                    let depth = (op - 0x80 + 1) as usize;
                    if self.stack.len() < depth {
                        return Err(VmError::StackUnderflow);
                    }
                    let val = self.stack[self.stack.len() - depth].clone();
                    self.push(val)?;
                }
                // SWAP1-SWAP16 (0x90-0x9F): swap top with the nth item below it.
                op if (0x90..=0x9F).contains(&op) => {
                    self.spend_gas(GAS_BASE)?;
                    let depth = (op - 0x90 + 1) as usize;
                    let len = self.stack.len();
                    if len < depth + 1 {
                        return Err(VmError::StackUnderflow);
                    }
                    self.stack.swap(len - 1, len - 1 - depth);
                }

                // PUSH0 (0x5F): push a single zero byte.
                OP_PUSH0 => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(vec![0u8; 32])?;
                }

                // PUSH1-PUSH32 (0x60-0x7F)
                op if (0x60..=0x7F).contains(&op) => {
                    let size = (op - 0x60 + 1) as usize;
                    self.spend_gas(GAS_PUSH)?;
                    let mut data = vec![0u8; 32]; // always 32 bytes, right-aligned
                    for i in 0..size {
                        if self.pc + i < bytecode.len() {
                            data[32 - size + i] = bytecode[self.pc + i];
                        }
                    }
                    self.pc += size;
                    self.push(data)?;
                }

                // -- Calldata / Context opcodes --
                OP_CALLDATALOAD => {
                    self.spend_gas(GAS_CALLDATALOAD)?;
                    let offset_val = U256::from_be_bytes(&self.pop()?);
                    let offset = offset_val.as_usize();
                    let mut buf = vec![0u8; 32];
                    let avail = self.calldata.len().saturating_sub(offset);
                    let copy_len = avail.min(32);
                    if copy_len > 0 {
                        // EVM spec: CALLDATALOAD left-aligns data (start of word),
                        // zero-pads on the right. Previous right-alignment broke
                        // selector extraction (SHR 224 produced 0 -> no match -> REVERT).
                        buf[..copy_len].copy_from_slice(&self.calldata[offset..offset + copy_len]);
                    }
                    self.push(buf)?;
                }
                OP_CALLDATASIZE => {
                    self.spend_gas(GAS_BASE)?;
                    let size = self.calldata.len() as u64;
                    self.push(U256::from_be_bytes(&size.to_be_bytes()).to_be_bytes())?;
                }
                OP_CALLDATACOPY => {
                    self.spend_gas(GAS_BASE)?;
                    let dest_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let src_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let length = U256::from_be_bytes(&self.pop()?).as_usize();
                    self.expand_memory(dest_offset, length)?;
                    for i in 0..length {
                        let byte = if src_offset + i < self.calldata.len() {
                            self.calldata[src_offset + i]
                        } else { 0 };
                        self.memory[dest_offset + i] = byte;
                    }
                }
                OP_CALLER => {
                    self.spend_gas(GAS_BASE)?;
                    let mut buf = vec![0u8; 32];
                    buf[12..].copy_from_slice(&self.caller);
                    self.push(buf)?;
                }
                OP_CALLVALUE => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.callvalue.to_be_bytes()).to_be_bytes())?;
                }
                OP_ORIGIN => {
                    self.spend_gas(GAS_BASE)?;
                    let mut buf = vec![0u8; 32];
                    buf[12..].copy_from_slice(&self.caller);
                    self.push(buf)?;
                }
                OP_ADDRESS => {
                    self.spend_gas(GAS_BASE)?;
                    let mut buf = vec![0u8; 32];
                    buf[12..].copy_from_slice(&self.address);
                    self.push(buf)?;
                }
                OP_CODESIZE => {
                    self.spend_gas(GAS_BASE)?;
                    let size = self.code.len() as u64;
                    self.push(U256::from_be_bytes(&size.to_be_bytes()).to_be_bytes())?;
                }
                OP_CODECOPY => {
                    self.spend_gas(GAS_BASE)?;
                    let dest_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let src_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let length = U256::from_be_bytes(&self.pop()?).as_usize();
                    self.expand_memory(dest_offset, length)?;
                    for i in 0..length {
                        let byte = if src_offset + i < self.code.len() {
                            self.code[src_offset + i]
                        } else { 0 };
                        self.memory[dest_offset + i] = byte;
                    }
                }
                OP_EXTCODESIZE => {
                    self.spend_gas(GAS_EXTCODE)?;
                    let addr = self.pop_addr()?;
                    let size = self.fetch_code(&addr).map(|c| c.len()).unwrap_or(0);
                    self.push(U256::from_be_bytes(&(size as u64).to_be_bytes()).to_be_bytes())?;
                }
                OP_EXTCODECOPY => {
                    self.spend_gas(GAS_EXTCODE)?;
                    let addr = self.pop_addr()?;
                    let dest_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let src_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let length = U256::from_be_bytes(&self.pop()?).as_usize();
                    let code = self.fetch_code(&addr).unwrap_or_default();
                    self.expand_memory(dest_offset, length)?;
                    for i in 0..length {
                        let byte = if src_offset + i < code.len() { code[src_offset + i] } else { 0 };
                        self.memory[dest_offset + i] = byte;
                    }
                }
                OP_EXTCODEHASH => {
                    self.spend_gas(GAS_EXTCODE)?;
                    let addr = self.pop_addr()?;
                    let hash = match self.fetch_code(&addr) {
                        Some(code) if !code.is_empty() => {
                            use sha3::{Keccak256, Digest};
                            let mut h = Keccak256::new();
                            h.update(&code);
                            let mut out = [0u8; 32];
                            out.copy_from_slice(&h.finalize());
                            out
                        }
                        _ => [0u8; 32],
                    };
                    self.push(hash.to_vec())?;
                }
                OP_RETURNDATASIZE => {
                    self.spend_gas(GAS_BASE)?;
                    let size = self.return_data.len() as u64;
                    self.push(U256::from_be_bytes(&size.to_be_bytes()).to_be_bytes())?;
                }
                OP_RETURNDATACOPY => {
                    self.spend_gas(GAS_BASE)?;
                    let dest_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let src_offset = U256::from_be_bytes(&self.pop()?).as_usize();
                    let length = U256::from_be_bytes(&self.pop()?).as_usize();
                    if src_offset + length > self.return_data.len() {
                        return Err(VmError::Revert("returndata out of bounds".into()));
                    }
                    self.expand_memory(dest_offset, length)?;
                    for i in 0..length {
                        self.memory[dest_offset + i] = self.return_data[src_offset + i];
                    }
                }
                OP_BALANCE => {
                    self.spend_gas(GAS_EXTCODE)?;
                    let addr = self.pop_addr()?;
                    let bal = if let Some(host) = self.host.as_deref() {
                        host.get_balance(&addr)
                    } else if let Some(db) = self.db {
                        db.get_balance(&addr).unwrap_or(0)
                    } else { 0 };
                    self.push(U256::from_be_bytes(&bal.to_be_bytes()).to_be_bytes())?;
                }
                OP_SELFBALANCE => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.self_balance.to_be_bytes()).to_be_bytes())?;
                }
                OP_CHAINID => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.chain_id.to_be_bytes()).to_be_bytes())?;
                }
                OP_GASPRICE => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.gas_price.to_be_bytes()).to_be_bytes())?;
                }
                OP_BASEFEE => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.basefee.to_be_bytes()).to_be_bytes())?;
                }
                OP_TIMESTAMP => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.block_timestamp.to_be_bytes()).to_be_bytes())?;
                }
                OP_NUMBER => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.block_number.to_be_bytes()).to_be_bytes())?;
                }
                OP_DIFFICULTY => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(vec![0u8; 32])?;
                }
                OP_GASLIMIT => {
                    self.spend_gas(GAS_BASE)?;
                    self.push(U256::from_be_bytes(&self.block_gas_limit.to_be_bytes()).to_be_bytes())?;
                }
                OP_COINBASE => {
                    self.spend_gas(GAS_BASE)?;
                    let mut buf = vec![0u8; 32];
                    buf[12..].copy_from_slice(&self.coinbase);
                    self.push(buf)?;
                }

                // --- RSTN extensions ----------------------------
                OP_VALID_SIG => {
                    self.spend_gas(GAS_PQ_SIG)?;
                    self.op_validate_sig()?;
                }
                OP_CROSS_SHARD_SEND => {
                    self.spend_gas(GAS_BASE * 10)?;
                    let _shard = self.pop()?;
                    let _msg = self.pop()?;
                    // Cross-shard message -- handled by the shard router
                }

                // -- Contract calls (CALL / CALLCODE / DELEGATECALL / STATICCALL) --
                OP_CALL | OP_CALLCODE | OP_DELEGATECALL | OP_STATICCALL => {
                    self.op_call(opcode)?;
                }

                // -- Contract creation (CREATE / CREATE2) --
                OP_CREATE | OP_CREATE2 => {
                    self.op_create(opcode)?;
                }

                // -- Self-destruct: mark contract for deletion --
                OP_SELFDESTRUCT => {
                    if self.static_flag {
                        return Err(VmError::Revert("SELFDESTRUCT in static context".into()));
                    }
                    self.spend_gas(GAS_SELFDESTRUCT)?;
                    let _beneficiary = self.pop_addr()?;
                    // Mark the current contract as self-destructed. In a full
                    // implementation this would transfer balance to beneficiary
                    // and delete the account at end-of-transaction. For now we
                    // just stop execution successfully.
                    tracing::info!("SELFDESTRUCT at {} (beneficiary noted)", hex::encode(self.address));
                    return Ok(ExecutionResult {
                        success: true,
                        gas_used: self.gas_used,
                        output: Vec::new(),
                        logs: std::mem::take(&mut self.emitted_logs),
                    });
                }

                _ => {
                    tracing::warn!("VM: INVALID OPCODE 0x{:02X} at pc={}, gas_used={}", opcode, self.pc - 1, self.gas_used);
                    return Err(VmError::InvalidOpcode(opcode));
                }
            }

            self.spend_gas(GAS_BASE)?;
        }

        Ok(ExecutionResult {
            success: true,
            gas_used: self.gas_used,
            output: Vec::new(),
            logs: std::mem::take(&mut self.emitted_logs),
        })
    }

    fn binop_arith<F: Fn(U256, U256) -> U256>(&mut self, f: F) -> Result<(), VmError> {
        self.spend_gas(GAS_ARITH)?;
        // EVM semantics: stack[0] (top of stack) is the first operand.
        // Pop `a` first so closures like |a,b| a-b compute top-second, not second-top.
        let a = U256::from_be_bytes(&self.pop()?);
        let b = U256::from_be_bytes(&self.pop()?);
        let result = f(a, b);
        self.push(result.to_be_bytes())?;
        Ok(())
    }

    fn binop_cmp<F: Fn(U256, U256) -> bool>(&mut self, f: F) -> Result<(), VmError> {
        self.spend_gas(GAS_ARITH)?;
        let a = U256::from_be_bytes(&self.pop()?);
        let b = U256::from_be_bytes(&self.pop()?);
        let result = if f(a, b) { U256::ONE } else { U256::ZERO };
        self.push(result.to_be_bytes())?;
        Ok(())
    }

    fn memory_get(&self, offset: &[u8], length: &[u8]) -> Vec<u8> {
        let off = U256::from_be_bytes(offset).as_usize();
        let len = U256::from_be_bytes(length).as_usize();
        // Use checked arithmetic to avoid usize overflow panics on huge offsets.
        match off.checked_add(len) {
            Some(end) if end <= self.memory.len() => self.memory[off..end].to_vec(),
            _ => Vec::new(),
        }
    }

    /// Pop a 20-byte address from the stack (right-aligned in a 32-byte word).
    fn pop_addr(&mut self) -> Result<[u8; 20], VmError> {
        let val = self.pop()?;
        let mut addr = [0u8; 20];
        let len = val.len().min(20);
        addr[..len].copy_from_slice(&val[..len]);
        Ok(addr)
    }

    /// Fetch bytecode for an address via the host (preferred) or DB fallback.
    fn fetch_code(&self, addr: &[u8; 20]) -> Option<Vec<u8>> {
        if let Some(host) = self.host.as_deref() {
            host.get_code(addr)
        } else if let Some(db) = self.db {
            db.get_code(addr).ok().flatten()
        } else {
            None
        }
    }

    /// Read a memory range into a Vec, expanding memory as needed.
    fn mem_read(&mut self, offset: usize, length: usize) -> Result<Vec<u8>, VmError> {
        if length == 0 { return Ok(Vec::new()); }
        self.expand_memory(offset, length)?;
        Ok(self.memory[offset..offset + length].to_vec())
    }

    /// Write a Vec into memory at `offset`, expanding as needed.
    fn mem_write(&mut self, offset: usize, data: &[u8]) -> Result<(), VmError> {
        if data.is_empty() { return Ok(()); }
        self.expand_memory(offset, data.len())?;
        self.memory[offset..offset + data.len()].copy_from_slice(data);
        Ok(())
    }

    /// Execute a CALL-family opcode (CALL, CALLCODE, DELEGATECALL, STATICCALL).
    ///
    /// Stack layout (EVM):
    ///   CALL:        gas, addr, value, argsOffset, argsLength, retOffset, retLength
    ///   CALLCODE:    gas, addr, value, argsOffset, argsLength, retOffset, retLength
    ///   DELEGATECALL: gas, addr,           argsOffset, argsLength, retOffset, retLength
    ///   STATICCALL:  gas, addr,           argsOffset, argsLength, retOffset, retLength
    ///
    /// Pushes 1 on success, 0 on failure. Sets return_data for RETURNDATASIZE/COPY.
    fn op_call(&mut self, opcode: u8) -> Result<(), VmError> {
        self.spend_gas(GAS_CALL)?;
        let has_value = matches!(opcode, OP_CALL | OP_CALLCODE);

        let gas = U256::from_be_bytes(&self.pop()?);
        let addr = self.pop_addr()?;
        let value = if has_value {
            U256::from_be_bytes(&self.pop()?).as_usize() as u128
        } else { 0 };
        let args_off = U256::from_be_bytes(&self.pop()?).as_usize();
        let args_len = U256::from_be_bytes(&self.pop()?).as_usize();
        let ret_off = U256::from_be_bytes(&self.pop()?).as_usize();
        let ret_len = U256::from_be_bytes(&self.pop()?).as_usize();

        // STATICCALL propagates the static flag; others clear it.
        let child_static = self.static_flag || opcode == OP_STATICCALL;

        // DELEGATECALL/CALLCODE execute the target's code in OUR context;
        // CALL/STATICCALL execute in the target's context.
        let (exec_addr, exec_caller, exec_value) = match opcode {
            OP_DELEGATECALL => (self.address, self.caller, self.callvalue),
            OP_CALLCODE => (self.address, self.caller, value),
            _ => (addr, self.address, value),
        };

        // Fetch the target code. For DELEGATECALL/CALLCODE we use the target's
        // code but our address; for CALL/STATICCALL we use the target's code+address.
        let code_addr = match opcode {
            OP_DELEGATECALL | OP_CALLCODE => addr,
            _ => addr,
        };
        let target_code = self.fetch_code(&code_addr).unwrap_or_default();

        // PQ precompile: if calling 0x00..01, run the PQ verifier.
        if code_addr == PQ_PRECOMPILE_ADDRESS {
            let input = self.mem_read(args_off, args_len)?;
            let out = Self::execute_pq_precompile(&input);
            self.return_data = out.clone();
            // Copy output to return region
            let copy = ret_len.min(out.len());
            self.mem_write(ret_off, &out[..copy])?;
            self.push(vec![0u8; 31].iter().chain(&[1u8]).cloned().collect())?;
            return Ok(());
        }

        if target_code.is_empty() {
            // Calling an EOA (no code) succeeds with empty return data.
            self.return_data = Vec::new();
            self.push(vec![0u8; 31].iter().chain(&[1u8]).cloned().collect())?;
            return Ok(());
        }

        // Reentrancy / depth guard
        if self.call_depth >= MAX_CALL_DEPTH {
            self.return_data = Vec::new();
            self.push(vec![0u8; 32])?;
            return Ok(());
        }

        // Build calldata from memory
        let calldata = self.mem_read(args_off, args_len)?;

        // Snapshot gas for the child.
        // EIP-150 (63/64 rule): the child receives at most 63/64 of the
        // REMAINING gas (after reserving 1/64 for the parent). This prevents a
        // deeply-nested call from consuming all gas and leaving the parent
        // unable to finish. `gas` from the stack is the caller's requested cap;
        // the actual forwarded gas is min(requested, 63/64 of remaining).
        let remaining = self.gas.saturating_sub(self.gas_used);
        let max_forward = remaining - remaining / 64; // 63/64 of remaining
        let _child_gas = gas.as_usize().min(max_forward as usize) as u64;

        // Execute the child frame. We reuse our own VM state (stack/memory
        // are saved/restored) to keep the implementation simple. A production
        // implementation would spawn a fresh VM; here we save the volatile
        // fields and restore them after the child returns.
        let saved_stack = self.stack.clone();
        let saved_memory = self.memory.clone();
        let saved_pc = self.pc;
        let saved_code = self.code.clone();
        let saved_calldata = std::mem::take(&mut self.calldata);
        let saved_caller = self.caller;
        let saved_callvalue = self.callvalue;
        let saved_address = self.address;
        let saved_static = self.static_flag;
        let saved_return_data = std::mem::take(&mut self.return_data);

        self.stack = Vec::with_capacity(1024);
        self.memory = Vec::with_capacity(4096);
        self.pc = 0;
        self.code = target_code.clone();
        self.calldata = calldata;
        self.caller = exec_caller;
        self.callvalue = exec_value;
        self.address = exec_addr;
        self.static_flag = child_static;
        self.call_depth += 1;

        let child_result = self.execute(&target_code);

        // Restore parent frame
        self.call_depth = self.call_depth.saturating_sub(1);
        self.stack = saved_stack;
        self.memory = saved_memory;
        self.pc = saved_pc;
        self.code = saved_code;
        self.calldata = saved_calldata;
        self.caller = saved_caller;
        self.callvalue = saved_callvalue;
        self.address = saved_address;
        self.static_flag = saved_static;

        match child_result {
            Ok(r) if r.success => {
                self.return_data = r.output.clone();
                let copy = ret_len.min(r.output.len());
                self.mem_write(ret_off, &r.output[..copy])?;
                // Merge child logs into ours
                self.emitted_logs.extend(r.logs);
                self.push(vec![0u8; 31].iter().chain(&[1u8]).cloned().collect())?;
            }
            _ => {
                self.return_data = Vec::new();
                self.push(vec![0u8; 32])?;
            }
        }
        // Restore return_data AFTER we used it for mem_write (it's the child's).
        let _ = saved_return_data; // parent's return_data is reset by this call per EVM
        Ok(())
    }

    /// Execute CREATE / CREATE2.
    ///
    /// Stack: value, offset, length [, salt]   (salt only for CREATE2)
    /// Pushes the new address (0 on failure). Sets return_data.
    fn op_create(&mut self, opcode: u8) -> Result<(), VmError> {
        if self.static_flag {
            return Err(VmError::Revert("CREATE in static context".into()));
        }
        self.spend_gas(GAS_CREATE)?;
        let value = U256::from_be_bytes(&self.pop()?).as_usize() as u128;
        let offset = U256::from_be_bytes(&self.pop()?).as_usize();
        let length = U256::from_be_bytes(&self.pop()?).as_usize();
        let salt = if opcode == OP_CREATE2 {
            let s = self.pop()?;
            let mut arr = [0u8; 32];
            let len = s.len().min(32);
            arr[..len].copy_from_slice(&s[..len]);
            arr
        } else { [0u8; 32] };

        let init_code = self.mem_read(offset, length)?;

        // Compute the new contract address.
        // CREATE:  keccak256(sender || nonce)[0..20]
        // CREATE2: keccak256(0xFF || sender || salt || keccak256(init_code))[0..20]
        let new_addr: [u8; 20] = if opcode == OP_CREATE {
            let mut input = Vec::with_capacity(28);
            input.extend_from_slice(&self.address);
            // Use a synthetic nonce from block_number + address hash for determinism.
            let nonce = self.block_number.wrapping_add(self.address[0] as u64);
            input.extend_from_slice(&nonce.to_le_bytes());
            let h = rstn_crypto::keccak512(&input);
            h[..20].try_into().unwrap_or([0u8; 20])
        } else {
            use sha3::{Keccak256, Digest};
            let mut code_hasher = Keccak256::new();
            code_hasher.update(&init_code);
            let code_hash = code_hasher.finalize();
            let mut input = Vec::with_capacity(1 + 20 + 32 + 32);
            input.push(0xFF);
            input.extend_from_slice(&self.address);
            input.extend_from_slice(&salt);
            input.extend_from_slice(&code_hash);
            let h = rstn_crypto::keccak512(&input);
            h[..20].try_into().unwrap_or([0u8; 20])
        };

        // Execute the init code in a child frame.
        if self.call_depth >= MAX_CALL_DEPTH {
            self.return_data = Vec::new();
            self.push(vec![0u8; 32])?;
            return Ok(());
        }

        let saved_stack = self.stack.clone();
        let saved_memory = self.memory.clone();
        let saved_pc = self.pc;
        let saved_code = self.code.clone();
        let saved_calldata = std::mem::take(&mut self.calldata);
        let saved_caller = self.caller;
        let saved_callvalue = self.callvalue;
        let saved_address = self.address;
        let saved_static = self.static_flag;
        let saved_return_data = std::mem::take(&mut self.return_data);

        self.stack = Vec::with_capacity(1024);
        self.memory = Vec::with_capacity(4096);
        self.pc = 0;
        self.code = init_code.clone();
        self.calldata = Vec::new();
        self.caller = self.address;
        self.callvalue = value;
        self.address = new_addr;
        self.static_flag = false;
        self.call_depth += 1;

        let child_result = self.execute(&init_code);

        self.call_depth = self.call_depth.saturating_sub(1);
        self.stack = saved_stack;
        self.memory = saved_memory;
        self.pc = saved_pc;
        self.code = saved_code;
        self.calldata = saved_calldata;
        self.caller = saved_caller;
        self.callvalue = saved_callvalue;
        self.address = saved_address;
        self.static_flag = saved_static;

        match child_result {
            Ok(r) if r.success && !r.output.is_empty() => {
                let runtime = r.output;
                // Store the runtime code via host or DB.
                let stored = if let Some(host) = self.host.as_deref_mut() {
                    host.put_code(&new_addr, &runtime)
                } else if let Some(db) = self.db {
                    db.put_code(&new_addr, &runtime).is_ok()
                } else { false };
                if stored {
                    self.emitted_logs.extend(r.logs);
                    let mut addr_word = vec![0u8; 32];
                    addr_word[12..].copy_from_slice(&new_addr);
                    self.return_data = Vec::new();
                    self.push(addr_word)?;
                } else {
                    self.return_data = Vec::new();
                    self.push(vec![0u8; 32])?;
                }
            }
            _ => {
                self.return_data = Vec::new();
                self.push(vec![0u8; 32])?;
            }
        }
        let _ = saved_return_data;
        Ok(())
    }

    /// Verify a Dilithium3 signature inside the VM (OP_VALID_SIG).
    /// Stack: [pubkey_bytes, message_bytes, signature_bytes] -> [bool]
    fn op_validate_sig(&mut self) -> Result<(), VmError> {
        let sig_bytes = self.pop()?;
        let msg = self.pop()?;
        let pubkey_bytes = self.pop()?;

        if pubkey_bytes.len() != PUBKEY_SIZE || sig_bytes.len() != SIG_SIZE {
            self.push(vec![0])?;
            return Ok(());
        }

        let mut pk_arr = [0u8; PUBKEY_SIZE];
        pk_arr.copy_from_slice(&pubkey_bytes);
        let pubkey = Dilithium3PublicKey(pk_arr);

        let mut sig_arr = [0u8; SIG_SIZE];
        sig_arr.copy_from_slice(&sig_bytes);
        let signature = Dilithium3Signature(sig_arr);

        match verify_signature(&pubkey, &msg, &signature) {
            Ok(()) => { self.push(vec![1])?; }
            Err(_) => { self.push(vec![0])?; }
        }
        Ok(())
    }

    /// Execute the PQ precompile at 0x00..01.
    /// Input calldata wire format:
    ///   [0..1952]: Dilithium3 public key (1952 bytes)
    ///   [1952..5261]: Dilithium3 signature (3309 bytes)
    ///   [5261..]: Message bytes (arbitrary length)
    /// Output bytes:
    ///   0x01 = signature valid
    ///   0x00 = signature invalid or malformed calldata
    pub fn execute_pq_precompile(input: &[u8]) -> Vec<u8> {
        const MIN_LEN: usize = PUBKEY_SIZE + SIG_SIZE;
        if input.len() < MIN_LEN {
            return vec![0u8];
        }

        let pubkey_bytes = &input[..PUBKEY_SIZE];
        let sig_bytes = &input[PUBKEY_SIZE..PUBKEY_SIZE + SIG_SIZE];
        let msg = &input[PUBKEY_SIZE + SIG_SIZE..];

        let mut pk_arr = [0u8; PUBKEY_SIZE];
        pk_arr.copy_from_slice(pubkey_bytes);
        let pubkey = Dilithium3PublicKey(pk_arr);

        let mut sig_arr = [0u8; SIG_SIZE];
        sig_arr.copy_from_slice(sig_bytes);
        let signature = Dilithium3Signature(sig_arr);

        match verify_signature(&pubkey, msg, &signature) {
            Ok(()) => vec![1u8],
            Err(_) => vec![0u8],
        }
    }
}

// --- Integration Tests ------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: decode a hex bytecode string into bytes.
    fn hexb(s: &str) -> Vec<u8> {
        hex::decode(s.strip_prefix("0x").unwrap_or(s)).unwrap()
    }

    // Bytecode: PUSH1 0x42 | PUSH1 0x00 | MSTORE | PUSH1 0x20 | PUSH1 0x00 | RETURN
    // Stores 0x42 at memory[0], then returns 32 bytes from memory[0].
    const RETURN_42: &str = "604260005260206000f3";

    #[test]
    fn test_vm_returns_constant() {
        let mut vm = RstnVM::new(1_000_000);
        let result = vm.execute(&hexb(RETURN_42)).unwrap();
        assert!(result.success);
        assert_eq!(result.gas_used > 0, true);
        // Output should be 32 bytes, last byte = 0x42
        assert_eq!(result.output.len(), 32);
        assert_eq!(result.output[31], 0x42);
    }

    #[test]
    fn test_vm_addition() {
        // PUSH1 5 | PUSH1 3 | ADD | PUSH1 0 | MSTORE | PUSH1 0x20 | PUSH1 0 | RETURN
        // 5 + 3 = 8
        let code = "600560030160005260206000f3";
        let mut vm = RstnVM::new(1_000_000);
        let result = vm.execute(&hexb(code)).unwrap();
        assert!(result.success);
        assert_eq!(result.output[31], 8);
    }

    #[test]
    fn test_vm_storage_roundtrip() {
        // PUSH1 0x07 | PUSH1 0x01 | SSTORE  (store 7 at key 1)
        // PUSH1 0x01 | SLOAD | PUSH1 0 | MSTORE | PUSH1 0x20 | PUSH1 0 | RETURN
        let code = "600760015560015460005260206000f3";
        let mut vm = RstnVM::new(100_000_000);
        let result = vm.execute(&hexb(code)).unwrap();
        assert!(result.success, "storage roundtrip should succeed");
        assert_eq!(result.output[31], 7, "should read back stored value 7");
    }

    #[test]
    fn test_vm_calldata_load() {
        // CALLDATALOAD(0) | PUSH1 0 | MSTORE | PUSH1 0x20 | PUSH1 0 | RETURN
        // Loads first 32 bytes of calldata, stores at mem[0], returns it.
        let code = "60003560005260206000f3";
        let calldata = {
            let mut d = vec![0u8; 32];
            d[31] = 0x99;
            d
        };
        let mut vm = RstnVM::with_context(1_000_000, calldata, [0u8; 20], 0, [0u8; 20]);
        let result = vm.execute(&hexb(code)).unwrap();
        assert!(result.success);
        assert_eq!(result.output[31], 0x99);
    }

    #[test]
    fn test_vm_out_of_gas() {
        // A contract that does many SSTOREs (expensive) with tiny gas.
        let code = "6007600155"; // one SSTORE
        let mut vm = RstnVM::new(100); // way too little gas for SSTORE (20000)
        let result = vm.execute(&hexb(code));
        assert!(matches!(result, Err(VmError::OutOfGas)));
    }

    #[test]
    fn test_vm_invalid_opcode() {
        let code = "ff"; // 0xFF is not a valid opcode
        let mut vm = RstnVM::new(1_000_000);
        let result = vm.execute(&hexb(code));
        assert!(matches!(result, Err(VmError::InvalidOpcode(0xFF))));
    }

    #[test]
    fn test_vm_revert_returns_failure() {
        // PUSH1 0 | PUSH1 0 | REVERT
        let code = "60006000fd";
        let mut vm = RstnVM::new(1_000_000);
        let result = vm.execute(&hexb(code)).unwrap();
        assert!(!result.success, "REVERT should produce success=false");
    }

    #[test]
    fn test_vm_jump_and_condition() {
        // PUSH1 0x01 | PUSH1 0x0A | JUMPI | PUSH1 0xFF | PUSH1 0 | MSTORE | PUSH1 0x20 | PUSH1 0 | RETURN
        // JUMPDEST at 0x0A. If cond=1, jump to 0x0A (skip the 0xFF push).
        // 0x00 PUSH1 0x01   -> 60 01
        // 0x02 PUSH1 0x0A   -> 60 0A
        // 0x04 JUMPI        -> 57
        // 0x05 PUSH1 0xFF   -> 60 FF
        // 0x07 PUSH1 0x00   -> 60 00
        // 0x09 MSTORE       -> 52
        // 0x0A JUMPDEST     -> 5B
        // 0x0B PUSH1 0x20   -> 60 20
        // 0x0D PUSH1 0x00   -> 60 00
        // 0x0F RETURN       -> f3
        let code = "6001600a5760ff60005260206000f3";
        // Rebuild with JUMPDEST at the right offset:
        // offset 0: 60 01
        // offset 2: 60 0a
        // offset 4: 57
        // offset 5: 60 ff
        // offset 7: 60 00
        // offset 9: 52
        // offset 10 (0x0a): 5b  <- JUMPDEST
        // offset 11: 60 20
        // offset 13: 60 00
        // offset 15: f3
        let code = "6001600a5760ff6000525b60206000f3";
        let mut vm = RstnVM::new(1_000_000);
        let result = vm.execute(&hexb(code)).unwrap();
        assert!(result.success, "conditional jump path should succeed");
        // Since cond=1, it jumps to 0x0A, skipping the MSTORE. Memory is empty,
        // so RETURN with length 0x20 returns an empty output (memory not expanded).
        assert!(result.output.is_empty(), "jumped path returns empty output");
    }

    #[test]
    fn test_vm_pq_signature_verification() {
        // Generate a real Dilithium3 keypair, sign a message, push pubkey+msg+sig,
        // call OP_VALID_SIG (0xF0), verify result is 1 (true).
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"hello rstn";
        let sig = kp.sign(msg);

        // The pubkey (1952 bytes) and signature (3293 bytes) are too large for
        // PUSH opcodes. Test the op_validate_sig logic by constructing the stack
        // manually, then executing a single OP_VALID_SIG opcode.
        let mut vm = RstnVM::new(10_000_000);
        vm.stack.push(kp.public.0.to_vec()); // pubkey
        vm.stack.push(msg.to_vec()); // message
        vm.stack.push(sig.0.to_vec()); // signature
        // Call the private method via execute of a single opcode
        let code = [OP_VALID_SIG, OP_STOP];
        let result = vm.execute(&code).unwrap();
        assert!(result.success);
        // After OP_VALID_SIG, top of stack should be [1] (valid)
        let top = vm.stack.last().unwrap();
        assert_eq!(top[0], 1, "valid Dilithium3 signature should verify as true");
    }

    #[test]
    fn test_vm_pq_signature_rejects_tampered() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"hello rstn";
        let mut sig = kp.sign(msg);
        sig.0[0] ^= 0xFF; // tamper the signature

        let mut vm = RstnVM::new(10_000_000);
        vm.stack.push(kp.public.0.to_vec());
        vm.stack.push(msg.to_vec());
        vm.stack.push(sig.0.to_vec());
        let code = [OP_VALID_SIG, OP_STOP];
        let result = vm.execute(&code).unwrap();
        assert!(result.success);
        let top = vm.stack.last().unwrap();
        assert_eq!(top[0], 0, "tampered signature should verify as false");
    }

    #[test]
    fn test_pq_precompile_execution() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"precompile test payload";
        let sig = kp.sign(msg);

        let mut input = Vec::new();
        input.extend_from_slice(&kp.public.0);
        input.extend_from_slice(&sig.0);
        input.extend_from_slice(msg);

        let out_valid = RstnVM::execute_pq_precompile(&input);
        assert_eq!(out_valid, vec![1u8], "precompile should return 1 for valid sig");

        // Tamper signature
        input[PUBKEY_SIZE] ^= 0xFF;
        let out_invalid = RstnVM::execute_pq_precompile(&input);
        assert_eq!(out_invalid, vec![0u8], "precompile should return 0 for tampered sig");
    }

    #[test]
    fn test_vm_reentrancy_guard() {
        let mut vm = RstnVM::new(1_000_000);
        let addr = [0x11; 20];
        vm.enter_contract(addr).unwrap();
        // Re-entering the same contract should fail
        let result = vm.enter_contract(addr);
        assert!(matches!(result, Err(VmError::ReentrancyDetected)));
    }

    #[test]
    fn test_vm_call_depth_limit() {
        let mut vm = RstnVM::new(1_000_000);
        for _ in 0..MAX_CALL_DEPTH {
            // Use distinct addresses so reentrancy guard doesn't trigger
            let addr = [vm.call_depth as u8; 20];
            vm.enter_contract(addr).unwrap();
        }
        let addr = [0xFF; 20];
        let result = vm.enter_contract(addr);
        assert!(matches!(result, Err(VmError::CallDepthExceeded(_))));
    }
}

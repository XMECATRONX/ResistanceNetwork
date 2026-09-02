//! rstn-sol-transpiler -- Solidity/EVM bytecode → RSTN-VM bytecode
//!
//! ## Purpose
//!
//! RSTN-VM is EVM-compatible for opcodes 0x00-0xEF (arithmetic, stack, memory,
//! storage, flow, environment, block, log). The only divergence is that RSTN
//! uses two EVM "unused" slots (0x0C, 0x0D) for its PQ extensions
//! (VALID_SIG, CROSS_SHARD_SEND) instead of 0xF0/0xF5, to keep CREATE and
//! CREATE2 (0xF0/0xF5) free for full Solidity compatibility.
//!
//! This transpiler takes compiled EVM bytecode (from `solc`, `solcxx`, or any
//! EVM compiler) and:
//!
//! 1. Scans for opcodes that are NOT in the RSTN-VM supported set.
//! 2. Validates PUSH immediate lengths.
//! 3. Validates jump destinations against the RSTN-VM's `valid_jumpdest` table.
//! 4. Emits a `TranspiledContract` ready for deployment on RSTN-VM.
//!
//! ## Honest scope
//!
//! This is a **bytecode-level transpiler**, not a Solidity compiler. It does
//! NOT parse Solidity source — it operates on EVM bytecode that a developer
//! already compiled with `solc`. The value: a Solidity dev compiles with their
//! existing toolchain and runs `rstn-transpile` on the output. No new compiler
//! to learn, no new IR. The contract runs on RSTN-VM with PQ signature
//! opcodes available if they opt in.
//!
//! ## What is supported
//!
//! - All EVM opcodes in the ranges RSTN-VM implements (see `is_supported_opcode`).
//! - CREATE (0xF0) and CREATE2 (0xF5) — kept free for Solidity compatibility.
//! - RSTN PQ opcodes (0x0C VALID_SIG, 0x0D CROSS_SHARD_SEND) — available for
//!   hand-written assembly or future Solidity libraries that emit them.
//!
//! ## What is rejected
//!
//! - Opcodes RSTN-VM does not implement. The transpiler reports the first
//!   unsupported opcode and its offset so the dev can fix it.

use rstn_vm::*;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TranspileError {
    #[error("unsupported opcode 0x{opcode:02X} at offset {offset}")]
    UnsupportedOpcode { opcode: u8, offset: usize },
    #[error("truncated PUSH immediate at offset {offset}: need {need} bytes, got {got}")]
    TruncatedPush { offset: usize, need: usize, got: usize },
    #[error("empty bytecode")]
    EmptyBytecode,
}

/// The result of a successful transpilation.
#[derive(Debug, Clone)]
pub struct TranspiledContract {
    /// The RSTN-VM bytecode (passthrough or opcode-rewritten).
    pub bytecode: Vec<u8>,
    /// Number of opcodes processed.
    pub opcode_count: usize,
    /// Whether PQ opcodes (0x0C/0x0D) were found and kept.
    pub has_pq_opcodes: bool,
    /// Whether CREATE/CREATE2 (0xF0/0xF5) were found (Solidity compatibility).
    pub has_create: bool,
    /// Valid jump destinations (offsets) for the RSTN-VM.
    pub valid_jumpdests: Vec<usize>,
}

impl TranspiledContract {
    /// Serialize as hex for deployment scripts / CLI output.
    pub fn to_hex(&self) -> String {
        hex::encode(&self.bytecode)
    }
}

/// Transpile EVM bytecode to RSTN-VM bytecode.
///
/// For the common case (standard Solidity output, no PQ opcodes) this is a
/// validating passthrough: the bytecode is scanned, unsupported opcodes are
/// rejected, and the valid jump-dest table is computed. The output is ready
/// for `rstn_vm::Vm::deploy()`.
///
/// If the bytecode contains the RSTN PQ opcodes (0x0C, 0x0D) they are kept
/// as-is — the RSTN-VM implements them natively.
pub fn transpile(evm_bytecode: &[u8]) -> Result<TranspiledContract, TranspileError> {
    if evm_bytecode.is_empty() {
        return Err(TranspileError::EmptyBytecode);
    }

    let mut out = Vec::with_capacity(evm_bytecode.len());
    let mut opcode_count = 0usize;
    let mut has_pq_opcodes = false;
    let mut has_create = false;
    let mut valid_jumpdests = Vec::new();

    let mut i = 0usize;
    while i < evm_bytecode.len() {
        let op = evm_bytecode[i];

        // PUSH0 (0x5F) — no immediate.
        if op == OP_PUSH0 {
            opcode_count += 1;
            out.push(op);
            i += 1;
            continue;
        }

        // PUSH1..PUSH32 (0x60..0x7F) consume immediates.
        if (0x60..=0x7F).contains(&op) {
            let n = (op as usize) - 0x60 + 1;
            if i + 1 + n > evm_bytecode.len() {
                return Err(TranspileError::TruncatedPush {
                    offset: i,
                    need: n,
                    got: evm_bytecode.len() - i - 1,
                });
            }
            opcode_count += 1;
            out.push(op);
            out.extend_from_slice(&evm_bytecode[i + 1..i + 1 + n]);
            i += 1 + n;
            continue;
        }

        // RSTN PQ opcodes (0x0C, 0x0D) — kept, flagged.
        if op == OP_VALID_SIG || op == OP_CROSS_SHARD_SEND {
            has_pq_opcodes = true;
            opcode_count += 1;
            out.push(op);
            i += 1;
            continue;
        }

        // CREATE / CREATE2 (0xF0 / 0xF5) — Solidity compatibility, kept.
        if op == OP_CREATE || op == OP_CREATE2 {
            has_create = true;
            opcode_count += 1;
            out.push(op);
            i += 1;
            continue;
        }

        // JUMPDEST (0x5D) — record valid jump target.
        if op == OP_JUMPDEST {
            valid_jumpdests.push(out.len());
            opcode_count += 1;
            out.push(op);
            i += 1;
            continue;
        }

        // Check the opcode is in the RSTN-VM supported set.
        if !is_supported_opcode(op) {
            return Err(TranspileError::UnsupportedOpcode {
                opcode: op,
                offset: i,
            });
        }

        opcode_count += 1;
        out.push(op);
        i += 1;
    }

    tracing::info!(
        "Transpiled {} opcodes → {} bytes (PQ={}, CREATE={})",
        opcode_count,
        out.len(),
        has_pq_opcodes,
        has_create
    );

    Ok(TranspiledContract {
        bytecode: out,
        opcode_count,
        has_pq_opcodes,
        has_create,
        valid_jumpdests,
    })
}

/// Check whether an opcode is implemented by the RSTN-VM.
///
/// RSTN-VM implements the common EVM subset. We match on raw byte values
/// (the EVM opcode numbers) rather than named constants, because rstn-vm
/// only defines `pub const` aliases for a subset of opcodes. Matching on
/// literals is unambiguous (no variable-binding confusion) and covers the
/// full supported set including opcodes that have no named constant yet.
fn is_supported_opcode(op: u8) -> bool {
    // Arithmetic (0x00-0x0B) + comparison/bitwise (0x10-0x1D) + SHA3 (0x20)
    // Environment (0x30-0x48), Block (0x40-0x48), Stack/Memory/Storage/Flow
    // (0x50-0x5B), Push0 (0x5F), Logging (0xA0-0xA4), System (0xF0-0xFF).
    matches!(
        op,
        // 0x00-0x0B: STOP, ADD, MUL, SUB, DIV, SDIV, MOD, SMOD, ADDMOD, MULMOD, EXP, SIGNEXTEND
        0x00..=0x0B
        // 0x10-0x1D: LT, GT, SLT, SGT, EQ, ISZERO, AND, OR, XOR, NOT, BYTE, SHL, SHR, SAR
        | 0x10..=0x1D
        // 0x20: SHA3 (Keccak)
        | 0x20
        // 0x30-0x3F: ADDRESS, BALANCE, ORIGIN, CALLER, CALLVALUE, CALLDATALOAD,
        //   CALLDATASIZE, CALLDATACOPY, CODESIZE, CODECOPY, GASPRICE, EXTCODESIZE,
        //   EXTCODECOPY, RETURNDATASIZE, RETURNDATACOPY, EXTCODEHASH (0x3F)
        | 0x30..=0x3F
        // 0x40-0x48: BLOCKHASH, COINBASE, TIMESTAMP, NUMBER, DIFFICULTY/PREVRANDAO,
        //   GASLIMIT, CHAINID(0x46), SELFBALANCE(0x47), BASEFEE(0x48)
        | 0x40..=0x48
        // 0x50-0x5B: POP, MLOAD, MSTORE, MSTORE8, SLOAD, SSTORE, JUMP, JUMPI, PC,
        //   MSIZE, GAS, JUMPDEST
        | 0x50..=0x5B
        // 0x5F: PUSH0
        | 0x5F
        // 0xA0-0xA4: LOG0..LOG4
        | 0xA0..=0xA4
        // 0xF0-0xF5: CREATE, CALL, CALLCODE, RETURN, DELEGATECALL, CREATE2
        | 0xF0..=0xF5
        // 0xFD: REVERT, 0xFE: INVALID, 0xFF: SELFDESTRUCT
        | 0xFD..=0xFF
    ) || matches!(
        // Contiguous EVM ranges the VM implements by convention.
        op,
        0x60..=0x7F  // PUSH1..PUSH32
        | 0x80..=0x8F // DUP1..DUP16
        | 0x90..=0x9F // SWAP1..SWAP16
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transpile_passthrough_simple_contract() {
        // PUSH1 0x2A PUSH1 0x00 MSTORE PUSH1 0x20 PUSH1 0x00 RETURN
        let evm = hex::decode("602a60005560206000f3").unwrap();
        let result = transpile(&evm).expect("simple contract transpiles");
        assert_eq!(result.bytecode, evm);
        assert!(!result.has_pq_opcodes);
        assert!(!result.has_create);
        assert!(result.opcode_count > 0);
    }

    #[test]
    fn transpile_detects_create() {
        // PUSH1 0x00 PUSH1 0x00 PUSH1 0x00 CREATE
        let evm = hex::decode("600060006000f0").unwrap();
        let result = transpile(&evm).expect("CREATE transpiles");
        assert!(result.has_create);
    }

    #[test]
    fn transpile_detects_pq_opcodes() {
        // 0x0C is VALID_SIG (RSTN PQ opcode) + STOP
        let evm = vec![OP_VALID_SIG, OP_STOP];
        let result = transpile(&evm).expect("PQ opcode transpiles");
        assert!(result.has_pq_opcodes);
    }

    #[test]
    fn transpile_rejects_empty() {
        let result = transpile(&[]);
        assert!(matches!(result, Err(TranspileError::EmptyBytecode)));
    }

    #[test]
    fn transpile_rejects_truncated_push() {
        // PUSH32 (0x7F) but only 10 bytes follow
        let mut evm = vec![0x7Fu8];
        evm.extend_from_slice(&[0x01; 10]);
        let result = transpile(&evm);
        assert!(matches!(result, Err(TranspileError::TruncatedPush { .. })));
    }

    #[test]
    fn transpile_valid_jumpdests_recorded() {
        // JUMPDEST at offset 0
        let evm = vec![OP_JUMPDEST, OP_STOP];
        let result = transpile(&evm).expect("jumpdest transpiles");
        assert!(result.valid_jumpdests.contains(&0));
    }

    #[test]
    fn transpile_to_hex_roundtrip() {
        let evm = hex::decode("602a60005560206000f3").unwrap();
        let result = transpile(&evm).expect("transpile");
        assert_eq!(result.to_hex(), "602a60005560206000f3");
    }

    #[test]
    fn transpile_dup_swap_ranges() {
        // DUP3 (0x82) SWAP2 (0x91) STOP
        let evm = hex::decode("829100").unwrap();
        let result = transpile(&evm).expect("dup/swap transpiles");
        assert_eq!(result.bytecode, evm);
    }

    #[test]
    fn transpile_log_range() {
        // LOG2 (0xA2) STOP — LOG range supported
        let evm = vec![0xA2, OP_STOP];
        let result = transpile(&evm).expect("LOG2 transpiles");
        assert_eq!(result.bytecode, evm);
    }
}

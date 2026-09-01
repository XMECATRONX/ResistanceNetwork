//! Integration tests for the RSTN VM opcode semantics.
//!
//! These tests pin the exact behaviors of the 5 bugs that were found and
//! fixed during manual Solidity bring-up. They guard against regressions:
//! any change to the VM that re-introduces one of these bugs will fail CI.
//!
//! Bugs covered:
//!   1. CALLDATALOAD left-alignment (selector extraction)
//!   2. SHL / SHR direction (Solidity selector dispatch)
//!   3. binop operand order (top-of-stack is first operand)
//!   4. memory_get checked arithmetic (RETURN/REVERT overflow panic)
//!   5. i256::rem sign capture (E0382 move-before-use)
//!
//! IMPORTANT: EVM `RETURN` reads from MEMORY, not the stack. Every test that
//! wants to observe a computed value must `MSTORE` it into memory first,
//! then `RETURN` that memory range. The `run_ret` helper appends the
//! canonical return sequence (`PUSH1 0 | MSTORE | PUSH1 32 | PUSH1 0 | RETURN`)
//! to any "computation" bytecode that leaves the result on top of the stack.

use rstn_vm::{RstnVM, ExecutionResult, U256};

/// Helper: run bytecode with empty context and a generous gas limit.
fn run(code: &[u8]) -> ExecutionResult {
    let mut vm = RstnVM::new(10_000_000);
    vm.execute(code).expect("execution should not error")
}

/// Helper: run "computation" bytecode (leaves result on top of stack) and
/// return it by storing to memory[0..32] then RETURNing that range.
fn run_ret(code: &[u8]) -> ExecutionResult {
    let mut full = code.to_vec();
    // PUSH1 0 | MSTORE  (store stack-top at memory[0..32])
    // PUSH1 32 | PUSH1 0 | RETURN
    full.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    run(&full)
}

/// Helper: run bytecode with calldata (simulates an external call), returning
/// the stack-top via MSTORE + RETURN.
fn run_ret_calldata(code: &[u8], calldata: &[u8]) -> ExecutionResult {
    let mut full = code.to_vec();
    full.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    let mut vm = RstnVM::with_context(
        10_000_000,
        calldata.to_vec(),
        [0u8; 20],
        0,
        [0u8; 20],
    );
    vm.execute(&full).expect("execution should not error")
}

/// Decode the first 32 bytes of the output as a big-endian u64 (for asserts).
fn out_u64(res: &ExecutionResult) -> u64 {
    let mut buf = [0u8; 32];
    let len = res.output.len().min(32);
    buf[..len].copy_from_slice(&res.output[..len]);
    u64::from_be_bytes(buf[24..32].try_into().unwrap())
}

// ============================================================
// Bug 1: CALLDATALOAD left-alignment
// ============================================================

/// CALLDATALOAD(0) with a 4-byte calldata must left-align the bytes:
/// `0x6d4ce63c` -> `0x6d4ce63c000...000` (NOT `0x000...0006d4ce63c`).
/// This is what Solidity's selector extraction relies on.
#[test]
fn test_calldataload_left_aligns_short_data() {
    // PUSH1 0x00 | CALLDATALOAD  -> leaves the 32-byte word on the stack.
    let code = [0x60, 0x00, 0x35];
    let calldata = [0x6d, 0x4c, 0xe6, 0x3c]; // get() selector
    let res = run_ret_calldata(&code, &calldata);

    assert!(res.success, "CALLDATALOAD should succeed");
    assert_eq!(res.output.len(), 32, "should return exactly 32 bytes");
    // Left-aligned: selector sits at the start of the word.
    assert_eq!(&res.output[0..4], &[0x6d, 0x4c, 0xe6, 0x3c]);
    assert_eq!(&res.output[4..], &[0u8; 28], "right side zero-padded");
}

/// CALLDATALOAD with full 32-byte calldata copies all 32 bytes verbatim.
#[test]
fn test_calldataload_full_word() {
    let code = [0x60, 0x00, 0x35];
    let calldata = [0xAA; 32];
    let res = run_ret_calldata(&code, &calldata);
    assert!(res.success);
    assert_eq!(res.output, vec![0xAA; 32]);
}

/// CALLDATALOAD past the end of calldata returns 32 zero bytes.
#[test]
fn test_calldataload_past_end_is_zero() {
    let code = [0x60, 0x00, 0x35];
    let res = run_ret_calldata(&code, &[]); // empty calldata
    assert!(res.success);
    assert_eq!(res.output, vec![0u8; 32]);
}

// ============================================================
// Bug 2: SHL / SHR direction
// ============================================================

/// SHR by 224 on a left-aligned 4-byte selector must yield the 4-byte value.
/// This is the exact sequence Solidity uses to extract the function selector.
#[test]
fn test_shr_extracts_selector() {
    // PUSH1 0 | CALLDATALOAD | PUSH1 0xE0(224) | SHR
    let code = [0x60, 0x00, 0x35, 0x60, 0xE0, 0x1C];
    let calldata = [0x6d, 0x4c, 0xe6, 0x3c];
    let res = run_ret_calldata(&code, &calldata);
    assert!(res.success, "SHR selector extraction should succeed");
    // After SHR 224, the 4 selector bytes sit in the low 32 bits.
    assert_eq!(out_u64(&res), 0x6d4ce63c, "SHR 224 must extract the 4-byte selector");
}

/// SHL by 8 must shift bits left (multiply by 256), not right.
#[test]
fn test_shl_shifts_left() {
    // PUSH1 0x01 | PUSH1 0x08 | SHL
    let code = [0x60, 0x01, 0x60, 0x08, 0x1B];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 0x100, "1 << 8 == 256");
}

/// SHR by 8 must shift bits right (divide by 256), not left.
#[test]
fn test_shr_shifts_right() {
    // PUSH1 0xFF | PUSH1 0x08 | SHR
    let code = [0x60, 0xFF, 0x60, 0x08, 0x1C];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 0x00, "0xFF >> 8 == 0");
}

// ============================================================
// Bug 3: binop operand order (top-of-stack is first operand)
// ============================================================

/// SUB: top - second. Stack [10, 3] (3 on top) -> 3 - 10 = -7 (wrapping).
/// In EVM, PUSH1 10, PUSH1 3, SUB computes 3 - 10.
#[test]
fn test_sub_operand_order() {
    // PUSH1 0x0A | PUSH1 0x03 | SUB
    let code = [0x60, 0x0A, 0x60, 0x03, 0x03];
    let res = run_ret(&code);
    assert!(res.success);
    // 3 - 10 in U256 wrapping = 0xFFFF...FFF9 (two's complement of -7)
    let val = U256::from_be_bytes(&res.output);
    let ten = U256::from_be_bytes(&{
        let mut b = [0u8; 32];
        b[31] = 10;
        b
    });
    let three = U256::from_be_bytes(&{
        let mut b = [0u8; 32];
        b[31] = 3;
        b
    });
    assert_eq!(val, three.wrapping_sub(ten), "SUB must compute top - second");
}

/// LT: top < second. Stack [5, 3] (3 on top) -> 3 < 5 == true (1).
#[test]
fn test_lt_operand_order() {
    // PUSH1 0x05 | PUSH1 0x03 | LT
    let code = [0x60, 0x05, 0x60, 0x03, 0x10];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 1, "3 < 5 == 1 (true)");
}

/// GT: top > second. Stack [3, 5] (5 on top) -> 5 > 3 == true (1).
#[test]
fn test_gt_operand_order() {
    // PUSH1 0x03 | PUSH1 0x05 | GT
    let code = [0x60, 0x03, 0x60, 0x05, 0x11];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 1, "5 > 3 == 1 (true)");
}

/// DIV: top / second. Stack [10, 2] (2 on top) -> 2 / 10 == 0.
#[test]
fn test_div_operand_order() {
    // PUSH1 0x0A | PUSH1 0x02 | DIV
    let code = [0x60, 0x0A, 0x60, 0x02, 0x04];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 0, "2 / 10 == 0 (integer division, top/second)");
}

// ============================================================
// Bug 4: memory_get checked arithmetic (no panic on RETURN/REVERT)
// ============================================================

/// RETURN with a large offset must NOT panic. It should either return empty
/// output or fail gracefully (revert), but never abort the process.
/// Before the fix, `offset + length` overflowed usize and panicked.
#[test]
fn test_return_large_offset_does_not_panic() {
    // PUSH32 max_offset | PUSH1 0x20 | RETURN
    let mut code = vec![0x7F]; // PUSH32
    code.extend_from_slice(&[0xFF; 32]); // huge offset
    code.extend_from_slice(&[0x60, 0x20, 0xf3]); // PUSH1 32, RETURN

    // This must not panic. The VM should return a result (success=false
    // is acceptable, but a panic is a bug).
    let res = run(&code);
    // Either it reverts (success=false) or returns empty -- both are fine.
    // The critical assertion is that we got here at all (no panic).
    let _ = res.success;
}

/// REVERT with a large offset must NOT panic either.
#[test]
fn test_revert_large_offset_does_not_panic() {
    let mut code = vec![0x7F];
    code.extend_from_slice(&[0xFF; 32]);
    code.extend_from_slice(&[0x60, 0x20, 0xfd]); // PUSH1 32, REVERT
    let res = run(&code);
    assert!(!res.success, "REVERT must report failure, not panic");
}

// ============================================================
// Bug 5: i256::rem sign capture (no E0382 move-before-use)
// ============================================================

/// SMOD with a negative dividend must preserve the sign correctly.
/// This exercises the i256::rem path that had the E0382 bug.
/// Stack [10, -3] (-3 on top): SMOD computes -3 % 10 == -3.
#[test]
fn test_smod_preserves_sign() {
    // EVM SMOD: a % b where a = top-of-stack, b = second.
    // We want -3 % 10 == -3, so -3 must be on top. Push 10 first, then -3.
    // PUSH1 0x0A (10) | PUSH32 0xFF...FD (=-3) | SMOD
    let mut code = vec![0x60, 0x0A]; // PUSH1 10 (second operand)
    let mut neg3 = [0xFFu8; 32];
    neg3[31] = 0xFD; // -3 in two's complement
    code.push(0x7F); // PUSH32
    code.extend_from_slice(&neg3);
    code.push(0x07); // SMOD -> -3 % 10
    let res = run_ret(&code);
    assert!(res.success, "SMOD should not panic or revert");
    // -3 % 10 == -3 (sign of dividend preserved)
    let val = U256::from_be_bytes(&res.output);
    let expected = U256::from_be_bytes(&neg3);
    assert_eq!(val, expected, "SMOD must preserve the dividend's sign");
}

// ============================================================
// Basic opcode sanity (regression baseline)
// ============================================================

#[test]
fn test_stop_returns_empty() {
    let res = run(&[0x00]); // STOP
    assert!(res.success);
    assert!(res.output.is_empty());
}

#[test]
fn test_add_basic() {
    // PUSH1 2 | PUSH1 3 | ADD
    let code = [0x60, 0x02, 0x60, 0x03, 0x01];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 5);
}

#[test]
fn test_mul_basic() {
    let code = [0x60, 0x04, 0x60, 0x06, 0x02];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 24);
}

#[test]
fn test_iszero_true() {
    // PUSH1 0 | ISZERO -> 1
    let code = [0x60, 0x00, 0x15];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 1);
}

#[test]
fn test_iszero_false() {
    // PUSH1 5 | ISZERO -> 0
    let code = [0x60, 0x05, 0x15];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 0);
}

#[test]
fn test_mstore_mload_roundtrip() {
    // PUSH1 0x42 | PUSH1 0x00 | MSTORE | PUSH1 0x00 | MLOAD
    let code = [
        0x60, 0x42, // PUSH1 0x42
        0x60, 0x00, // PUSH1 0
        0x52,       // MSTORE
        0x60, 0x00, // PUSH1 0
        0x51,       // MLOAD
    ];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 0x42);
}

#[test]
fn test_sstore_sload_roundtrip() {
    // PUSH1 0x99 | PUSH1 0x00 | SSTORE | PUSH1 0x00 | SLOAD
    let code = [
        0x60, 0x99, // PUSH1 0x99
        0x60, 0x00, // PUSH1 0
        0x55,       // SSTORE
        0x60, 0x00, // PUSH1 0
        0x54,       // SLOAD
    ];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 0x99);
}

#[test]
fn test_jump_and_jumpdest() {
    // 0: PUSH1 6 -> stack [6]
    // 2: JUMP -> pc = 6
    // 3,4,5: filler
    // 6: JUMPDEST
    // 7: PUSH1 7
    // 9: PUSH1 3
    // 11: ADD -> 10
    // then MSTORE + RETURN
    let code = vec![
        0x60, 0x06, // 0: PUSH1 6
        0x56,       // 2: JUMP -> 6
        0x00,       // 3: STOP (skipped)
        0x00,       // 4: filler
        0x00,       // 5: filler
        0x5B,       // 6: JUMPDEST
        0x60, 0x07, // 7: PUSH1 7
        0x60, 0x03, // 9: PUSH1 3
        0x01,       // 11: ADD -> 10
    ];
    let res = run_ret(&code);
    assert!(res.success, "JUMP to JUMPDEST should succeed");
    assert_eq!(out_u64(&res), 10);
}

#[test]
fn test_jumpi_taken() {
    // 0: PUSH1 1 (cond)
    // 2: PUSH1 7 (dest)
    // 4: JUMPI -> jumps to 7 (cond nonzero)
    // 5,6: filler
    // 7: JUMPDEST
    // 8: PUSH1 42
    let code = vec![
        0x60, 0x01, // 0: PUSH1 1 (condition)
        0x60, 0x07, // 2: PUSH1 7 (destination)
        0x57,       // 4: JUMPI
        0x00,       // 5: STOP (skipped)
        0x00,       // 6: filler
        0x5B,       // 7: JUMPDEST
        0x60, 0x2A, // 8: PUSH1 42
    ];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 42);
}

#[test]
fn test_jumpi_not_taken() {
    // cond is 0 -> JUMPI does NOT jump -> falls through to JUMPDEST
    let code = vec![
        0x60, 0x00, // 0: PUSH1 0 (condition = 0)
        0x60, 0x07, // 2: PUSH1 7
        0x57,       // 4: JUMPI (not taken)
        0x5B,       // 5: JUMPDEST (fallthrough)
        0x60, 0x2A, // 6: PUSH1 42
    ];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 42);
}

#[test]
fn test_revert_reports_failure() {
    // PUSH1 0, PUSH1 0, REVERT (clean revert with empty reason)
    let code = [0x60, 0x00, 0x60, 0x00, 0xfd];
    let res = run(&code);
    assert!(!res.success, "REVERT must report success=false");
}

#[test]
fn test_invalid_opcode_reverts() {
    let res = run(&[0xfe]); // INVALID
    assert!(!res.success, "INVALID opcode must fail");
}

#[test]
fn test_out_of_gas() {
    // A tight loop that burns gas with a very small gas limit should OOG.
    // EVM JUMPI: pops dest (top), then cond (second). To loop forever we need
    // cond != 0 and dest = 0 (the JUMPDEST). Push cond=1 first, then dest=0.
    let mut vm = RstnVM::new(100); // very tight gas
    let loop_code = vec![
        0x5B,       // 0: JUMPDEST
        0x60, 0x01, // 1: PUSH1 1 (cond=1, pushed first -> second operand)
        0x60, 0x00, // 3: PUSH1 0 (dest=0, pushed second -> top of stack)
        0x57,       // 5: JUMPI -> pops dest=0, cond=1 -> jumps to 0 (infinite loop)
    ];
    let res = vm.execute(&loop_code);
    assert!(res.is_err(), "should run out of gas");
    match res {
        Err(rstn_vm::VmError::OutOfGas) => {}
        other => panic!("expected OutOfGas, got {:?}", other),
    }
}

#[test]
fn test_dup1() {
    // PUSH1 0x05 | DUP1 | ADD -> 10
    let code = [0x60, 0x05, 0x80, 0x01];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 10);
}

#[test]
fn test_swap1() {
    // PUSH1 0x02 | PUSH1 0x03 | SWAP1 | SUB
    // After SWAP1: stack [3, 2] (2 on top). SUB: 2 - 3 = wrapping(-1).
    let code = [0x60, 0x02, 0x60, 0x03, 0x90, 0x03];
    let res = run_ret(&code);
    assert!(res.success);
    // 2 - 3 = -1 (wrapping) = 0xFFFF...FFFF
    assert_eq!(&res.output, &[0xFFu8; 32]);
}

#[test]
fn test_pop() {
    // PUSH1 0x01 | PUSH1 0x02 | POP -> leaves 1 on stack
    let code = [0x60, 0x01, 0x60, 0x02, 0x50];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(out_u64(&res), 1);
}

#[test]
fn test_and_or_xor() {
    // PUSH1 0xF0 | PUSH1 0x0F | AND -> 0
    let code = [0x60, 0xF0, 0x60, 0x0F, 0x16];
    assert_eq!(out_u64(&run_ret(&code)), 0);

    // PUSH1 0xF0 | PUSH1 0x0F | OR -> 0xFF
    let code = [0x60, 0xF0, 0x60, 0x0F, 0x17];
    assert_eq!(out_u64(&run_ret(&code)), 0xFF);

    // PUSH1 0xFF | PUSH1 0x0F | XOR -> 0xF0
    let code = [0x60, 0xFF, 0x60, 0x0F, 0x18];
    assert_eq!(out_u64(&run_ret(&code)), 0xF0);
}

#[test]
fn test_not() {
    // PUSH1 0x00 | NOT -> all 1s
    let code = [0x60, 0x00, 0x19];
    let res = run_ret(&code);
    assert!(res.success);
    assert_eq!(&res.output, &[0xFFu8; 32]);
}

#[test]
fn test_eq_true() {
    // PUSH1 0x05 | PUSH1 0x05 | EQ -> 1
    let code = [0x60, 0x05, 0x60, 0x05, 0x14];
    assert_eq!(out_u64(&run_ret(&code)), 1);
}

#[test]
fn test_eq_false() {
    // PUSH1 0x05 | PUSH1 0x06 | EQ -> 0
    let code = [0x60, 0x05, 0x60, 0x06, 0x14];
    assert_eq!(out_u64(&run_ret(&code)), 0);
}

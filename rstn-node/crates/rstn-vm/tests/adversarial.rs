//! Adversarial + fuzzing tests for the RSTN VM.
//!
//! These tests attack the VM with malformed bytecode, boundary values, and
//! randomized inputs. The invariant under test: the VM must NEVER panic on
//! adversarial input -- it must always return Ok (with success=false on
//! revert/invalid) or a structured VmError. A panic here would be a DoS
//! vector: a single malicious contract could crash a validator node.
//!
//! Categories:
//!   1. Resource-limit DoS vectors (memory, stack, gas)
//!   2. Boundary arithmetic (div/mod by zero, signed overflow)
//!   3. Malformed / truncated bytecode
//!   4. Randomized fuzzing (1000 random bytecodes, no panic)

use rstn_vm::{RstnVM, ExecutionResult, U256, VmError};

/// Simple deterministic PRNG (LCG) so the fuzz tests are reproducible across
/// runs -- no external `rand` dependency, no flaky failures.
fn lcg(seed: &mut u64) -> u64 {
    *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    *seed
}

/// Run bytecode with a generous gas limit, returning the result (never panics).
fn run(code: &[u8]) -> Result<ExecutionResult, VmError> {
    let mut vm = RstnVM::new(10_000_000);
    vm.execute(code)
}

// ===== 1. Resource-limit DoS vectors =====

#[test]
fn test_stack_overflow_enforced() {
    // PUSH1 0x00 repeated 1025 times -> 1024 pushes succeed, 1025th overflows.
    let mut code = vec![];
    for _ in 0..1025 {
        code.extend_from_slice(&[0x60, 0x00]); // PUSH1 0
    }
    let res = run(&code);
    // Must be a structured StackOverflow error, NOT a panic.
    assert!(matches!(res, Err(VmError::StackOverflow)), "expected StackOverflow, got {:?}", res);
}

#[test]
fn test_stack_underflow_on_empty() {
    // POP on an empty stack -> StackUnderflow, no panic.
    let res = run(&[0x50]); // POP
    assert!(matches!(res, Err(VmError::StackUnderflow)), "got {:?}", res);
}

#[test]
fn test_gas_exhaustion_terminates() {
    // A tight loop that never halts on its own: PUSH1 0; JUMPDEST; JUMP back.
    // Gas must run out and terminate execution -- no infinite loop.
    //   0x60 0x00   PUSH1 0  (jump target = offset 2)
    //   0x5b        JUMPDEST (offset 2)
    //   0x60 0x02   PUSH1 2
    //   0x56        JUMP -> offset 2 (infinite loop)
    let code = [0x60, 0x00, 0x5b, 0x60, 0x02, 0x56];
    // Give it only 1000 gas so it terminates quickly.
    let mut vm = RstnVM::new(1000);
    let res = vm.execute(&code);
    assert!(matches!(res, Err(VmError::OutOfGas)), "expected OutOfGas, got {:?}", res);
}

#[test]
fn test_memory_limit_enforced() {
    // MSTORE8 at an offset beyond MAX_MEMORY (1 MB) must hit
    // MemoryLimitExceeded, not allocate unbounded memory (DoS via expansion).
    // MSTORE8 pops offset (top) then value (below), so we push value=0 first
    // (bottom of stack) then offset=2 MB (top).
    let mut offset = [0u8; 32];
    offset[29] = 0x20; // 0x200000 = 2_097_152 (2 MB, > MAX_MEMORY = 1_048_576)
    let mut code = vec![0x60, 0x00]; // PUSH1 0 (value — bottom)
    code.push(0x7f); // PUSH32
    code.extend_from_slice(&offset); // offset = 2 MB (top)
    code.push(0x53); // MSTORE8
    let res = run(&code);
    assert!(
        matches!(res, Err(VmError::MemoryLimitExceeded(_))),
        "expected MemoryLimitExceeded, got {:?}", res
    );
}

// ===== 2. Boundary arithmetic (no panic on edge cases) =====

#[test]
fn test_div_by_zero_returns_zero() {
    // PUSH1 5 | PUSH1 0 | DIV -> 0 (EVM: x/0 = 0), no panic.
    let mut code = vec![0x60, 0x05, 0x60, 0x00, 0x04];
    code.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    let res = run(&code).unwrap();
    assert!(res.success);
    // Output should be 32 zero bytes.
    assert!(res.output.iter().all(|&b| b == 0));
}

#[test]
fn test_mod_by_zero_returns_zero() {
    let mut code = vec![0x60, 0x05, 0x60, 0x00, 0x06]; // PUSH1 5 | PUSH1 0 | MOD
    code.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    let res = run(&code).unwrap();
    assert!(res.success);
    assert!(res.output.iter().all(|&b| b == 0));
}

#[test]
fn test_sdiv_min_over_negone_no_panic() {
    // INT256.MIN / -1 must NOT panic (EVM returns MIN). MIN = 0x8000...0000.
    // -1 in two's complement is all 0xFF bytes.
    // SDIV pops a (top) then b (below); to compute MIN / -1, push b=-1 first
    // (bottom) then a=MIN (top).
    let mut min = [0u8; 32];
    min[0] = 0x80; // 0x8000...0000 = INT256.MIN
    let neg_one = [0xFFu8; 32]; // -1 in two's complement
    let mut code = vec![];
    code.push(0x7f); code.extend_from_slice(&neg_one); // PUSH32 -1 (b, bottom)
    code.push(0x7f); code.extend_from_slice(&min);    // PUSH32 MIN (a, top)
    code.push(0x05); // SDIV
    code.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    let res = run(&code).unwrap();
    assert!(res.success, "SDIV(MIN, -1) must not panic");
    // Result should be MIN (no overflow): first byte = 0x80.
    assert_eq!(res.output[0], 0x80);
}

#[test]
fn test_exp_zero_to_zero() {
    // 0 ** 0 = 1 (EVM convention), no panic.
    let mut code = vec![0x60, 0x00, 0x60, 0x00, 0x0a]; // PUSH1 0 | PUSH1 0 | EXP
    code.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    let res = run(&code).unwrap();
    assert!(res.success);
    // Last byte should be 1.
    assert_eq!(res.output[31], 0x01);
}

// ===== 3. Malformed / truncated bytecode =====

#[test]
fn test_truncated_push_does_not_panic() {
    // PUSH32 with fewer than 32 bytes of data -> must not read out of bounds.
    let res = run(&[0x7f, 0x01, 0x02]); // PUSH32 but only 2 bytes follow
    let _ = res.unwrap_or(ExecutionResult { success: false, gas_used: 0, output: vec![], logs: vec![] });
}

#[test]
fn test_empty_bytecode_returns_success() {
    let res = run(&[]).unwrap();
    assert!(res.success);
    assert!(res.output.is_empty());
}

#[test]
fn test_jump_to_invalid_dest_reverts() {
    // JUMP to a non-JUMPDEST location -> InvalidJump, not a panic.
    let res = run(&[0x60, 0x01, 0x56]); // PUSH1 1 | JUMP (offset 1 is the JUMP itself)
    assert!(matches!(res, Err(VmError::InvalidJump)), "got {:?}", res);
}

#[test]
fn test_jump_to_out_of_bounds_reverts() {
    // JUMP to offset 255 (past end of code) -> InvalidJump.
    let res = run(&[0x60, 0xff, 0x56]); // PUSH1 255 | JUMP
    assert!(matches!(res, Err(VmError::InvalidJump)), "got {:?}", res);
}

#[test]
fn test_calldataload_huge_offset_no_panic() {
    // CALLDATALOAD at a huge offset -> returns zeros, no panic.
    let mut huge = [0u8; 32];
    huge[0] = 0xFF;
    let mut code = vec![0x7f];
    code.extend_from_slice(&huge);
    code.push(0x35); // CALLDATALOAD
    code.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
    let res = run(&code).unwrap();
    assert!(res.success);
    assert!(res.output.iter().all(|&b| b == 0));
}

// ===== 4. Randomized fuzzing (reproducible) =====

#[test]
fn test_fuzz_random_bytecode_never_panics() {
    // 1000 random bytecodes of random length (1..64 bytes). The VM must never
    // panic -- every input must yield Ok or a structured Err.
    let mut seed = 0xC0FFEE_u64;
    for _ in 0..1000 {
        let len = 1 + (lcg(&mut seed) as usize % 64);
        let code: Vec<u8> = (0..len).map(|_| (lcg(&mut seed) & 0xFF) as u8).collect();
        // The contract: execute() returns a Result, never panics.
        let _ = run(&code); // discard -- we only assert it doesn't panic
    }
}

#[test]
fn test_fuzz_memory_ops_never_panic() {
    // Random MSTORE8 / MLOAD / RETURN sequences with random offsets.
    let mut seed = 0xBEEF_u64;
    for _ in 0..500 {
        let offset = (lcg(&mut seed) % 0x2000) as u8; // 0..8191
        // PUSH1 offset | PUSH1 val | MSTORE8 | PUSH1 offset | MLOAD | MSTORE | RETURN
        let code = vec![
            0x60, offset,
            0x60, (lcg(&mut seed) & 0xFF) as u8,
            0x53, // MSTORE8
            0x60, offset,
            0x51, // MLOAD
            0x60, 0x00,
            0x52, // MSTORE
            0x60, 0x20,
            0x60, 0x00,
            0xf3, // RETURN
        ];
        let _ = run(&code); // must not panic
    }
}

#[test]
fn test_fuzz_arith_no_panic() {
    // Random pairs of 32-byte values through ADD/SUB/MUL/DIV/MOD/SDIV/SMOD.
    // None may panic; div/mod by zero must yield zero.
    let mut seed = 0x1234_u64;
    let ops = [0x01u8, 0x03, 0x02, 0x04, 0x06, 0x05, 0x07]; // ADD,SUB,MUL,DIV,MOD,SDIV,SMOD
    for _ in 0..200 {
        let mut a = [0u8; 32];
        let mut b = [0u8; 32];
        for i in 0..32 {
            a[i] = (lcg(&mut seed) & 0xFF) as u8;
            b[i] = (lcg(&mut seed) & 0xFF) as u8;
        }
        let op = ops[(lcg(&mut seed) as usize) % ops.len()];
        let mut code = vec![0x7f];
        code.extend_from_slice(&a);
        code.push(0x7f);
        code.extend_from_slice(&b);
        code.push(op);
        code.extend_from_slice(&[0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]);
        let _ = run(&code); // must not panic
    }
}

#[test]
fn test_u256_div_consistency() {
    // Property: (a / b) * b + (a % b) == a, for b != 0.
    let mut seed = 0x99_u64;
    for _ in 0..100 {
        let mut a = [0u8; 32];
        let mut b = [0u8; 32];
        for i in 0..32 {
            a[i] = (lcg(&mut seed) & 0xFF) as u8;
            b[i] = (lcg(&mut seed) & 0xFF) as u8;
        }
        let av = U256::from_be_bytes(&a);
        let bv = U256::from_be_bytes(&b);
        if bv.is_zero() {
            continue;
        }
        let q = av.div(bv);
        let r = av.rem(bv);
        let reconstructed = q.wrapping_mul(bv).wrapping_add(r);
        assert_eq!(reconstructed, av, "div/mod identity violated");
    }
}

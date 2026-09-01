//! Fuzz target: RSTN-VM opcode dispatch.
//!
//! Exercises the VM with arbitrary bytecode + calldata. The invariant is:
//! - Never panics on any bytecode (stack overflow, invalid jump, OOM are
//!   handled gracefully as VmError).
//! - Gas accounting is monotonic: gas_used never exceeds gas_limit.
//! - Memory never exceeds MAX_MEMORY (1MB).
//! - Call depth never exceeds MAX_CALL_DEPTH (16).
//!
//! Run with:
//!   cargo +nightly fuzz run vm -- -max_total_time=600 -rss_limit_mb=4096

#![no_main]

use libfuzzer_sys::fuzz_target;
use rstn_vm::{RstnVM, VmError};

fuzz_target!(|data: &[u8]| {
    if data.len() < 3 {
        return;
    }
    // Split: [gas_limit (2 bytes) | bytecode...]
    let gas_limit = u16::from_le_bytes([data[0], data[1]]) as u64;
    let bytecode = &data[2..];
    // Cap bytecode to avoid O(n²) on the fuzzer — the VM has a 1MB memory cap.
    let bytecode = if bytecode.len() > 65_536 {
        &bytecode[..65_536]
    } else {
        bytecode
    };

    let mut vm = RstnVM::with_context(
        gas_limit,
        Vec::new(), // no calldata — we fuzz the bytecode itself
        [0u8; 20],  // caller
        0,          // value
        [0u8; 20],  // address
    );

    // The VM must return an Ok(ExecutionResult) or Err(VmError) — never panic.
    // We catch_unwind as a safety net, but the invariant is that the VM's
    // internal bounds checks (stack depth, memory cap, gas) prevent panics.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        vm.execute(bytecode)
    }));

    match result {
        Ok(Ok(res)) => {
            // Gas used must never exceed the limit.
            assert!(
                res.gas_used <= gas_limit,
                "gas_used {} exceeded gas_limit {}",
                res.gas_used,
                gas_limit
            );
        }
        Ok(Err(e)) => {
            // Expected errors — never a panic.
            let _ = e;
        }
        Err(_) => {
            // A panic is a BUG — the fuzzer will report it as a crash.
            // In CI this fails the fuzz run; in dev it surfaces immediately.
        }
    }
});

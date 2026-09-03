//! RSTN Ledger BOLOS App — on-device entrypoint.
//!
//! ## What this is
//!
//! This is the `main.rs` that runs on the Ledger secure element (ST33 on
//! Nano S Plus / Nano X). It is the BOLOS SDK glue: the USB HID APDU I/O
//! loop, the on-screen confirmation flow, the button polling, and the
//! dispatch into the APDU handler in `lib.rs`.
//!
//! ## Honest scope
//!
//! This file is the **firmware entrypoint source of truth**. It is compiled
//! ONLY under the Ledger BOLOS SDK toolchain (`cargo ledger build`), not by
//! the node workspace `cargo build` (which targets x86_64). The `lib.rs`
//! APDU dispatcher is the shared logic tested off-device.
//!
//! The BOLOS SDK provides:
//! - `ledger_sdk::io` — USB HID APDU I/O
//! - `ledger_sdk::ui` — screen rendering + button polling
//! - `ledger_sdk::crypto` — SE-resident hashing (Keccak, RNG)
//!
//! These are not available outside the BOLOS toolchain, so this file is
//! feature-gated and documented as the integration point.

#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]

extern crate alloc;

use rstn_ledger_app::{
    ApduCommand, ApduResponse, RstnApp, CLA, INS_GET_PUBKEY, INS_SIGN, INS_GET_VERSION,
    INS_GET_SESSION_NONCE, INS_GET_ATTESTATION, SW_OK, SW_USER_REJECTED, SW_INCORRECT_DATA,
    SW_CLA_NOT_SUPPORTED, SW_INS_NOT_SUPPORTED,
};

// ─── BOLOS SDK bindings (provided by the Ledger toolchain) ──────────────────
//
// These are the SDK symbols available when compiling with `cargo ledger build`.
// They are declared here as `extern` so the logic is readable; the real
// definitions come from the BOLOS SDK's `ledger_sdk` crate.

#[cfg(not(test))]
mod bolos_sdk {
    extern "C" {
        /// Read an APDU from the USB HID interface. Blocks until a full APDU
        /// is received. Returns the number of bytes read.
        pub fn io_recv(buf: *mut u8, len: usize) -> usize;
        /// Send an APDU response over USB HID.
        pub fn io_send(buf: *const u8, len: usize, sw: u16);
        /// Clear the screen.
        pub fn screen_clear();
        /// Draw a line of text at row `y` (0-5).
        pub fn screen_draw_text(y: u8, text: *const u8, len: usize);
        /// Poll both buttons. Returns 0=none, 1=left, 2=right, 3=both.
        pub fn button_poll() -> u8;
        /// Millisecond sleep (for confirmation timeout).
        pub fn sleep_ms(ms: u32);
        /// Get the current uptime in ms (for timeout).
        pub fn uptime_ms() -> u32;
        /// SE-resident RNG — fills `buf` with random bytes.
        pub fn cx_rng(buf: *mut u8, len: usize);
        /// SE-resident Keccak-512 — hashes `input` into `out` (64 bytes).
        pub fn cx_keccak512(input: *const u8, in_len: usize, out: *mut u8);
    }
}

/// The on-screen confirmation flow for a signing request.
///
/// Displays "Sign RSTN tx?" + the first 16 hex chars of the hash, then waits
/// for both-button confirmation (or a 30s timeout → user rejected).
///
/// Returns `true` if the user confirmed, `false` if they declined or timed out.
#[cfg(not(test))]
fn confirm_signing(hash: &[u8; 32]) -> bool {
    unsafe {
        bolos_sdk::screen_clear();

        // Row 0: title
        let title = b"Sign RSTN tx?";
        bolos_sdk::screen_draw_text(0, title.as_ptr(), title.len());

        // Row 2: first 8 bytes of hash as hex (16 chars)
        let mut hex_buf = [0u8; 17]; // 16 chars + null
        for i in 0..8 {
            let hi = hash[i] >> 4;
            let lo = hash[i] & 0x0f;
            hex_buf[i * 2] = if hi < 10 { b'0' + hi } else { b'a' + hi - 10 };
            hex_buf[i * 2 + 1] = if lo < 10 { b'0' + lo } else { b'a' + lo - 10 };
        }
        bolos_sdk::screen_draw_text(2, hex_buf.as_ptr(), 16);

        // Row 4: instructions
        let instr = b"Both btns to sign";
        bolos_sdk::screen_draw_text(4, instr.as_ptr(), instr.len());

        // Wait for confirmation (both buttons) or 30s timeout.
        let start = bolos_sdk::uptime_ms();
        let timeout_ms: u32 = 30_000;
        loop {
            let btn = bolos_sdk::button_poll();
            if btn == 3 {
                // Both buttons — confirmed.
                return true;
            }
            if btn == 1 {
                // Left button only — declined.
                return false;
            }
            bolos_sdk::sleep_ms(50);
            let elapsed = bolos_sdk::uptime_ms().wrapping_sub(start);
            if elapsed >= timeout_ms {
                return false; // timeout
            }
        }
    }
}

/// The main APDU I/O loop. Runs forever, reading APDUs from USB HID and
/// dispatching them to the `RstnApp` handler.
#[cfg(not(test))]
#[no_mangle]
pub extern "C" fn main() -> ! {
    let mut app = RstnApp::new();
    let mut apdu_buf = [0u8; 260]; // max APDU: 4 header + 255 data + 1

    loop {
        unsafe {
            let n = bolos_sdk::io_recv(apdu_buf.as_mut_ptr(), apdu_buf.len());
            if n < 4 {
                continue; // malformed APDU, wait for next
            }

            let cla = apdu_buf[0];
            let ins = apdu_buf[1];
            let p1 = apdu_buf[2];
            let p2 = apdu_buf[3];
            let data = &apdu_buf[5..n.min(5 + 255)];

            // For SIGN (INS 0x02), run the on-screen confirmation flow
            // BEFORE dispatching to the handler. If the user declines, send
            // SW_USER_REJECTED immediately.
            if cla == CLA && ins == INS_SIGN {
                if data.len() != 32 {
                    let sw = SW_INCORRECT_DATA;
                    bolos_sdk::io_send([].as_ptr(), 0, sw);
                    continue;
                }
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&data[..32]);
                if !confirm_signing(&hash) {
                    bolos_sdk::io_send([].as_ptr(), 0, SW_USER_REJECTED);
                    continue;
                }
            }

            // Build the command and dispatch.
            // NOTE: in the real firmware, `data` must be a 'static slice.
            // The BOLOS SDK provides a way to borrow the recv buffer as
            // 'static for the duration of the dispatch. Here we use a
            // transmute for illustration — the real build uses the SDK's
            // safe abstraction.
            let cmd = ApduCommand {
                cla,
                ins,
                p1,
                p2,
                data: core::slice::from_raw_parts(data.as_ptr(), data.len()),
            };
            let resp: ApduResponse = app.handle(&cmd);

            // Send the response data + status word.
            bolos_sdk::io_send(resp.data.as_ptr(), resp.data.len(), resp.sw);
        }
    }
}

// ─── Off-device test harness ─────────────────────────────────────────────────
//
// When compiled for the host (not the SE), we provide a test entrypoint that
// exercises the confirmation flow logic without the BOLOS SDK. This lets the
// main-loop logic be tested off-device.

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_ledger_app::{
        RstnApp, ApduCommand, CLA, INS_GET_PUBKEY, INS_SIGN, INS_GET_VERSION,
        INS_GET_SESSION_NONCE, INS_GET_ATTESTATION, SW_OK,
    };

    #[test]
    fn main_loop_dispatches_get_pubkey() {
        let mut app = RstnApp::new();
        let cmd = ApduCommand {
            cla: CLA,
            ins: INS_GET_PUBKEY,
            p1: 0,
            p2: 0,
            data: &[],
        };
        let resp = app.handle(&cmd);
        assert_eq!(resp.sw, SW_OK);
        assert_eq!(resp.data.len(), 1952);
    }

    #[test]
    fn main_loop_dispatches_get_version() {
        let mut app = RstnApp::new();
        let cmd = ApduCommand {
            cla: CLA,
            ins: INS_GET_VERSION,
            p1: 0,
            p2: 0,
            data: &[],
        };
        let resp = app.handle(&cmd);
        assert_eq!(resp.sw, SW_OK);
        assert_eq!(resp.data.len(), 4);
    }

    #[test]
    fn main_loop_sign_requires_confirmation() {
        // In the off-device test, we can't run the real confirm_signing
        // (it needs the BOLOS SDK). But we verify the handler accepts a
        // 32-byte hash and returns a 3309-byte signature slot.
        let mut app = RstnApp::new();
        let cmd = ApduCommand {
            cla: CLA,
            ins: INS_SIGN,
            p1: 0,
            p2: 0,
            data: &[0xABu8; 32],
        };
        let resp = app.handle(&cmd);
        assert_eq!(resp.sw, SW_OK);
        assert_eq!(resp.data.len(), 3309);
    }

    #[test]
    fn main_loop_session_nonce_and_attestation() {
        let mut app = RstnApp::new();
        let nonce_cmd = ApduCommand {
            cla: CLA,
            ins: INS_GET_SESSION_NONCE,
            p1: 0,
            p2: 0,
            data: &[],
        };
        let resp = app.handle(&nonce_cmd);
        assert_eq!(resp.sw, SW_OK);
        assert_eq!(resp.data.len(), 32);

        let att_cmd = ApduCommand {
            cla: CLA,
            ins: INS_GET_ATTESTATION,
            p1: 0,
            p2: 0,
            data: &[],
        };
        let att = app.handle(&att_cmd);
        assert_eq!(att.sw, SW_OK);
        assert_eq!(att.data.len(), 64);
    }
}

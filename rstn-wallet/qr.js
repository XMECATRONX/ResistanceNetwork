/**
 * rstn-wallet/qr.js — Compact QR Code (Model 2) generator.
 *
 * Self-contained, no external dependencies, no network calls.
 * Supports byte-mode encoding with ECC level M, versions 1-5
 * (capacity up to 84 bytes — enough for any Resistance address).
 *
 * Exposes: global.rstnQR.generate(text) -> { size, matrix }
 *   matrix[r][c] === true  => dark module
 *   matrix[r][c] === false => light module
 *
 * Used to render receive-address QR codes locally so the address
 * is never leaked to a third-party API.
 */
(function (global) {
  "use strict";

  // ── GF(256) arithmetic (primitive polynomial 0x11D) ──
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  function rsGenPoly(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, eccLen) {
    const gen = rsGenPoly(eccLen);
    const res = new Array(eccLen).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      if (factor !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[j] ^= gfMul(gen[j], factor);
        }
      }
    }
    return res;
  }

  // ── ECC level M block structure for versions 1-5 ──
  // Each entry: array of blocks; each block = [dataCount, eccCount]
  const ECC_M = {
    1: [[16, 10]],
    2: [[28, 16]],
    3: [[44, 26]],
    4: [[32, 18], [32, 18]],
    5: [[43, 24], [43, 24]],
  };

  // Byte-mode capacity (bytes) for ECC M, versions 1-5.
  const CAPACITY = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84 };

  // Alignment pattern center positions per version.
  const ALIGN_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
  };

  function chooseVersion(byteLen) {
    for (let v = 1; v <= 5; v++) {
      if (byteLen <= CAPACITY[v]) return v;
    }
    throw new Error("QR: data too long for supported versions (max 84 bytes)");
  }

  // ── Bit stream helpers ──
  function BitStream() {
    this.bits = [];
  }
  BitStream.prototype.push = function (val, len) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >> i) & 1);
  };
  BitStream.prototype.bytes = function () {
    const out = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | (this.bits[i + j] || 0);
      }
      out.push(b);
    }
    return out;
  };

  function encodeData(text, version) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 0x80) bytes.push(code);
      else {
        // UTF-8 encode
        const enc = unescape(encodeURIComponent(text[i]));
        for (let j = 0; j < enc.length; j++) bytes.push(enc.charCodeAt(j));
      }
    }

    const bs = new BitStream();
    bs.push(0b0100, 4); // byte mode
    bs.push(bytes.length, 8); // char count (v1-9: 8 bits)
    for (const b of bytes) bs.push(b, 8);

    const blocks = ECC_M[version];
    const totalData = blocks.reduce((s, b) => s + b[0], 0);
    const totalBits = totalData * 8;

    // terminator (up to 4 zero bits)
    const term = Math.min(4, totalBits - bs.bits.length);
    for (let i = 0; i < term; i++) bs.bits.push(0);
    // pad to byte boundary
    while (bs.bits.length % 8 !== 0) bs.bits.push(0);

    let data = bs.bytes();
    // pad bytes
    const pad = [0xec, 0x11];
    let pi = 0;
    while (data.length < totalData) data.push(pad[pi++ % 2]);

    // split into blocks, encode each
    const dataBlocks = [];
    const eccBlocks = [];
    let off = 0;
    for (const [dc, ec] of blocks) {
      const blk = data.slice(off, off + dc);
      off += dc;
      dataBlocks.push(blk);
      eccBlocks.push(rsEncode(blk, ec));
    }

    // interleave data
    const interleaved = [];
    const maxData = Math.max(...blocks.map((b) => b[0]));
    for (let i = 0; i < maxData; i++) {
      for (const blk of dataBlocks) if (i < blk.length) interleaved.push(blk[i]);
    }
    const maxEcc = Math.max(...blocks.map((b) => b[1]));
    for (let i = 0; i < maxEcc; i++) {
      for (const blk of eccBlocks) if (i < blk.length) interleaved.push(blk[i]);
    }
    return interleaved;
  }

  // ── Matrix construction ──
  function buildMatrix(version, dataBytes) {
    const size = 4 * version + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    function setFn(r, c, dark) {
      m[r][c] = dark;
      reserved[r][c] = true;
    }

    function placeFinder(r0, c0) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = r0 + dr, c = c0 + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          const border =
            (dr === 0 || dr === 6) && dc >= 0 && dc <= 6;
          const side = (dc === 0 || dc === 6) && dr >= 0 && dr <= 6;
          const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          const dark = border || side || core;
          // separator is light (dark=false) but still reserved
          if (dr === -1 || dr === 7 || dc === -1 || dc === 7) {
            reserved[r][c] = true;
            m[r][c] = false;
          } else {
            setFn(r, c, dark);
          }
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // timing patterns
    for (let i = 8; i < size - 8; i++) {
      const dark = i % 2 === 0;
      m[6][i] = dark; reserved[6][i] = true;
      m[i][6] = dark; reserved[i][6] = true;
    }

    // alignment patterns
    const pos = ALIGN_POS[version];
    for (const r of pos) {
      for (const c of pos) {
        if ((r === 6 && c === 6) || (r === 6 && c === pos[pos.length - 1]) ||
            (r === pos[pos.length - 1] && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setFn(rr, cc, dark);
          }
        }
      }
    }

    // reserve format info areas
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) { reserved[8][i] = true; m[8][i] = false; }
      if (i !== 6) { reserved[i][8] = true; m[i][8] = false; }
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = true; m[8][size - 1 - i] = false;
      reserved[size - 1 - i][8] = true; m[size - 1 - i][8] = false;
    }
    // dark module
    reserved[size - 8][8] = true;
    m[size - 8][8] = true;

    // place data bits
    let bitIdx = 0;
    let col = size - 1;
    let goingUp = true;
    while (col > 0) {
      if (col === 6) col--; // skip vertical timing column
      for (let i = 0; i < size; i++) {
        const row = goingUp ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (!reserved[row][c]) {
            const bit = bitIdx < dataBytes.length * 8
              ? ((dataBytes[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
              : false;
            m[row][c] = bit;
            bitIdx++;
          }
        }
      }
      col -= 2;
      goingUp = !goingUp;
    }

    return { size, m, reserved };
  }

  // ── Masking ──
  function maskFn(id, r, c) {
    switch (id) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
    return false;
  }

  function applyMask(m, reserved, id) {
    const size = m.length;
    const out = m.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && maskFn(id, r, c)) out[r][c] = !out[r][c];
      }
    }
    return out;
  }

  function penalty(m) {
    const size = m.length;
    let p = 0;
    // N1: runs of 5+
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) { run++; }
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) { run++; }
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    // N2: 2x2 blocks
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
      }
    }
    // N3: 1010101 patterns
    const pat = [1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - 7; c++) {
        let ok = true;
        for (let i = 0; i < 7; i++) if ((m[r][c + i] ? 1 : 0) !== pat[i]) { ok = false; break; }
        if (ok) p += 40;
      }
    }
    for (let c = 0; c < size; c++) {
      for (let r = 0; r <= size - 7; r++) {
        let ok = true;
        for (let i = 0; i < 7; i++) if ((m[r + i][c] ? 1 : 0) !== pat[i]) { ok = false; break; }
        if (ok) p += 40;
      }
    }
    // N4: balance
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
    const pct = (dark * 100) / (size * size);
    p += 10 * Math.floor(Math.abs(pct - 50) / 5);
    return p;
  }

  // ── Format info (BCH 15,5) ──
  function formatBits(eccLevel, mask) {
    // eccLevel: M=0, L=1, H=2, Q=3  (we use M=0)
    const data = (eccLevel << 3) | mask; // 5 bits
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    }
    let bits = ((data << 10) | (rem & 0x3ff)) ^ 0x5412; // 15 bits, masked
    return bits;
  }

  function placeFormat(m, size, bits) {
    const f = [];
    for (let i = 0; i < 15; i++) f.push((bits >> (14 - i)) & 1);
    // top-left
    for (let i = 0; i < 6; i++) m[8][i] = !!f[i];
    m[8][7] = !!f[6];
    m[8][8] = !!f[7];
    m[7][8] = !!f[8];
    for (let i = 9; i < 15; i++) m[14 - i][8] = !!f[i];
    // top-right
    for (let i = 0; i < 8; i++) m[8][size - 1 - i] = !!f[i];
    // bottom-left
    for (let i = 0; i < 7; i++) m[size - 7 + i][8] = !!f[8 + i];
  }

  function generate(text) {
    const version = chooseVersion(
      unescape(encodeURIComponent(text)).length
    );
    const dataBytes = encodeData(text, version);
    const { size, m, reserved } = buildMatrix(version, dataBytes);

    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const masked = applyMask(m, reserved, mask);
      placeFormat(masked, size, formatBits(0, mask));
      const p = penalty(masked);
      if (!best || p < best.p) best = { p, mask, m: masked };
    }
    return { size, matrix: best.m };
  }

  global.rstnQR = { generate };
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : this);

//! Reed-Solomon erasure coding over GF(2^8) -- the foundation of Data
//! Availability Sampling (DAS).
//!
//! A block's data is split into K data shards + M parity shards. Any K of the
//! (K+M) shards reconstruct the full data. This means a proposer who withholds
//! any shard can't stall the network -- any node holding K shards rebuilds the
//! rest. Combined with random sampling by light clients, this is the Celestia
//! / EigenDA approach to data availability.
//!
//! This is a from-scratch GF(2^8) Reed-Solomon implementation using the
//! modulus polynomial 0x11D (x^8 + x^4 + x^3 + x + 1) and a systematic
//! Vandermonde generator matrix. The top K rows are identity (data passes
//! through unchanged), the bottom M rows are parity.
//!
//! Honest scope: this is the erasure-coding *primitive* that DAS rests on. It
//! does NOT implement the full DAS protocol (light-client random sampling,
//! NMT merkle trees, fraud proofs for bad extension). Those are marked as
//! future research in ROADMAP. This module is the real, tested, verifiable
//! foundation.

// GF(2^8) modulus: x^8 + x^4 + x^3 + x + 1. When the high bit overflows after
// a left shift, we reduce by XOR with the low 8 bits (0x1D).
const GF_MOD: u8 = 0x1D;

/// GF(2^8) multiplication using the shift-and-reduce method. Slow but
/// unconditionally correct -- no static-mutable lookup tables.
fn gf_mul(mut a: u8, mut b: u8) -> u8 {
    let mut result: u8 = 0;
    for _ in 0..8 {
        if b & 1 != 0 {
            result ^= a;
        }
        let hi = a & 0x80;
        a = a.wrapping_shl(1);
        if hi != 0 {
            a ^= GF_MOD;
        }
        b >>= 1;
    }
    result
}

/// GF(2^8) exponentiation: base^exp.
fn gf_pow(base: u8, exp: u32) -> u8 {
    if exp == 0 {
        return 1; // x^0 = 1 for any non-zero x; 0^0 is undefined, treat as 1
    }
    let mut result: u8 = 1;
    for _ in 0..exp {
        result = gf_mul(result, base);
    }
    result
}

/// GF(2^8) inverse of a non-zero element. Brute-force search -- GF(256)* has
/// only 255 elements, so this is cheap and always correct.
fn gf_inv(a: u8) -> u8 {
    if a == 0 {
        panic!("gf_inv(0) is undefined -- zero has no inverse in GF(2^8)");
    }
    for x in 1u8..=255 {
        if gf_mul(a, x) == 1 {
            return x;
        }
    }
    unreachable!("every non-zero GF(2^8) element has an inverse");
}

/// Build the (K+M) x K systematic generator matrix.
///
/// The matrix is a Vandermonde matrix V (rows indexed 0..K+M, cols 0..K,
/// entry V[i][j] = 2^(i*j)) multiplied by the inverse of its top K rows,
/// producing a systematic code where the top K rows are the identity matrix
/// (data shards pass through unchanged) and the bottom M rows are parity.
///
/// Any K rows of the resulting generator form an invertible K x K matrix,
/// which is the property that lets us reconstruct from any K surviving shards.
fn build_generator(k: usize, m: usize) -> Vec<Vec<u8>> {
    let n = k + m;

    // Vandermonde matrix V: n x k, V[i][j] = 2^(i*j)
    let mut v = vec![vec![0u8; k]; n];
    for i in 0..n {
        for j in 0..k {
            v[i][j] = gf_pow(2, (i as u32) * (j as u32));
        }
    }

    // Top k x k of V -- we need its inverse to make the code systematic.
    let v_top: Vec<Vec<u8>> = (0..k).map(|i| v[i].clone()).collect();
    let v_top_inv = invert_matrix(&v_top);

    // G = V * v_top_inv  (systematic: top k rows become identity)
    let mut g = vec![vec![0u8; k]; n];
    for i in 0..n {
        for j in 0..k {
            let mut acc: u8 = 0;
            for t in 0..k {
                acc ^= gf_mul(v[i][t], v_top_inv[t][j]);
            }
            g[i][j] = acc;
        }
    }
    g
}

/// Invert a k x k matrix over GF(2^8) via Gauss-Jordan elimination.
fn invert_matrix(mat: &[Vec<u8>]) -> Vec<Vec<u8>> {
    let k = mat.len();
    // Augmented [mat | identity]
    let mut aug = vec![vec![0u8; 2 * k]; k];
    for i in 0..k {
        for j in 0..k {
            aug[i][j] = mat[i][j];
        }
        aug[i][k + i] = 1;
    }
    // Forward + backward elimination
    for col in 0..k {
        // Find a pivot row with non-zero entry in this column
        let mut pivot = None;
        for r in col..k {
            if aug[r][col] != 0 {
                pivot = Some(r);
                break;
            }
        }
        let pivot = pivot.expect("matrix is singular -- Vandermonde over GF(2^8) should not be");
        // Swap pivot into place
        if pivot != col {
            aug.swap(col, pivot);
        }
        // Scale pivot row so the pivot becomes 1
        let inv = gf_inv(aug[col][col]);
        for j in 0..(2 * k) {
            aug[col][j] = gf_mul(aug[col][j], inv);
        }
        // Eliminate this column from all other rows
        for r in 0..k {
            if r == col {
                continue;
            }
            let factor = aug[r][col];
            if factor == 0 {
                continue;
            }
            for j in 0..(2 * k) {
                aug[r][j] ^= gf_mul(factor, aug[col][j]);
            }
        }
    }
    // Extract the right half = inverse
    aug.into_iter().map(|row| row[k..].to_vec()).collect()
}

/// Encode `data` (length K shards, each `shard_len` bytes) into K data + M
/// parity shards. Returns all K+M shards.
///
/// Panics if data is empty, shard lengths are inconsistent, or K/M are zero.
pub fn encode(data: &[Vec<u8>], m: usize) -> Vec<Vec<u8>> {
    assert!(!data.is_empty(), "cannot encode zero data shards");
    assert!(m > 0, "parity shard count must be > 0");
    let k = data.len();
    let shard_len = data[0].len();
    assert!(
        data.iter().all(|s| s.len() == shard_len),
        "all data shards must have equal length"
    );

    let g = build_generator(k, m);
    let mut out = vec![vec![0u8; shard_len]; k + m];

    for i in 0..(k + m) {
        for byte_idx in 0..shard_len {
            let mut acc: u8 = 0;
            for j in 0..k {
                acc ^= gf_mul(g[i][j], data[j][byte_idx]);
            }
            out[i][byte_idx] = acc;
        }
    }
    out
}

/// Reconstruct the original K data shards from any K surviving shards.
///
/// `surviving` is a slice of (shard_index, shard_bytes) pairs. Exactly K
/// distinct indices are required. The shard_index refers to the position in
/// the full K+M encoded array.
pub fn reconstruct(surviving: &[(usize, Vec<u8>)], k: usize, shard_len: usize) -> Vec<Vec<u8>> {
    assert_eq!(
        surviving.len(),
        k,
        "need exactly {} surviving shards to reconstruct, got {}",
        k,
        surviving.len()
    );
    // The generator rows are deterministic: row i of build_generator(k, m) is
    // the same for any m >= (i - k + 1). We infer the smallest m that includes
    // all surviving indices, so those rows exist and are identical to the
    // encoder's generator rows.
    let max_index = surviving.iter().map(|(i, _)| *i).max().unwrap();
    let inferred_m = (max_index + 1).saturating_sub(k).max(1);
    let full_g = build_generator(k, inferred_m);

    // Build the K x K sub-matrix from the surviving rows
    let sub_g: Vec<Vec<u8>> = surviving.iter().map(|(idx, _)| full_g[*idx].clone()).collect();
    let sub_g_inv = invert_matrix(&sub_g);

    // Reconstruct data = sub_g_inv * surviving_shards
    let mut data = vec![vec![0u8; shard_len]; k];
    for j in 0..k {
        for byte_idx in 0..shard_len {
            let mut acc: u8 = 0;
            for t in 0..k {
                acc ^= gf_mul(sub_g_inv[j][t], surviving[t].1[byte_idx]);
            }
            data[j][byte_idx] = acc;
        }
    }
    data
}

/// Convenience: encode a flat byte slice as a single logical block split into
/// K shards of `shard_len` each (last shard zero-padded). Returns encoded
/// shards. Useful for block-body data availability.
pub fn encode_bytes(data: &[u8], shard_len: usize, m: usize) -> Vec<Vec<u8>> {
    assert!(shard_len > 0, "shard_len must be > 0");
    let k = (data.len() + shard_len - 1) / shard_len;
    let k = k.max(1);
    let mut shards = vec![vec![0u8; shard_len]; k];
    for (i, &b) in data.iter().enumerate() {
        shards[i / shard_len][i % shard_len] = b;
    }
    encode(&shards, m)
}

/// Convenience: decode K surviving shards back to the original K data shards
/// (flattened, trailing zero-padding trimmed by `orig_len`).
pub fn reconstruct_bytes(
    surviving: &[(usize, Vec<u8>)],
    k: usize,
    shard_len: usize,
    orig_len: usize,
) -> Vec<u8> {
    let data = reconstruct(surviving, k, shard_len);
    let mut out = Vec::with_capacity(k * shard_len);
    for shard in data {
        out.extend_from_slice(&shard);
    }
    out.truncate(orig_len);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_no_loss() {
        let data = vec![
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
            vec![9, 10, 11, 12],
        ];
        let encoded = encode(&data, 2); // 3 data + 2 parity
        assert_eq!(encoded.len(), 5);
        // All 5 present -- reconstruct from the 3 data shards
        let surviving: Vec<(usize, Vec<u8>)> = (0..3).map(|i| (i, encoded[i].clone())).collect();
        let decoded = reconstruct(&surviving, 3, 4);
        assert_eq!(decoded, data);
    }

    #[test]
    fn roundtrip_lose_parity() {
        let data = vec![
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
            vec![9, 10, 11, 12],
        ];
        let encoded = encode(&data, 2);
        // Lose parity shard 4 -- reconstruct from data 0,1 and parity 3
        let surviving = vec![
            (0, encoded[0].clone()),
            (1, encoded[1].clone()),
            (3, encoded[3].clone()),
        ];
        let decoded = reconstruct(&surviving, 3, 4);
        assert_eq!(decoded, data);
    }

    #[test]
    fn roundtrip_lose_data() {
        let data = vec![
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
            vec![9, 10, 11, 12],
        ];
        let encoded = encode(&data, 2);
        // Lose data shard 1 -- reconstruct from 0, 2, parity 4
        let surviving = vec![
            (0, encoded[0].clone()),
            (2, encoded[2].clone()),
            (4, encoded[4].clone()),
        ];
        let decoded = reconstruct(&surviving, 3, 4);
        assert_eq!(decoded, data);
    }

    #[test]
    fn roundtrip_bytes() {
        let orig = b"hello rstn data availability layer -- post-quantum L1".to_vec();
        let encoded = encode_bytes(&orig, 16, 4);
        // Lose the first 2 data shards, keep 2 data + 2 parity
        let surviving = encoded
            .iter()
            .enumerate()
            .filter(|(i, _)| *i >= 2)
            .take(4)
            .map(|(i, s)| (i, s.clone()))
            .collect::<Vec<_>>();
        let k = (orig.len() + 15) / 16;
        let decoded = reconstruct_bytes(&surviving, k, 16, orig.len());
        assert_eq!(decoded, orig);
    }
}

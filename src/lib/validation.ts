// ─── Input validation helpers (frontend security) ─────────────
// Centralized validation for user-supplied inputs that flow into
// RPC calls or transaction payloads. Prevents malformed data from
// reaching the node and surfaces clear errors to the user.

/**
 * A RSTN address is "rstn1" + 20 bytes (40 hex chars).
 * Example: rstn1a27142f69bdd76a2548e69fd0f6e4fbe978f66a1
 */
export function isValidRstnAddress(addr: string): boolean {
  return /^rstn1[0-9a-fA-F]{40}$/.test(addr.trim());
}

/**
 * Validate a hex string (optionally 0x-prefixed) with even length.
 * Used for bytecode, calldata, and source txids.
 */
export function isValidHex(
  value: string,
  opts: {
    requirePrefix?: boolean;
    minLength?: number;
    maxLength?: number;
  } = {},
): boolean {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  if (opts.requirePrefix && !value.startsWith("0x")) return false;
  if (clean.length % 2 !== 0) return false;
  if (!/^[0-9a-fA-F]*$/.test(clean)) return false;
  if (opts.minLength !== undefined && clean.length < opts.minLength)
    return false;
  if (opts.maxLength !== undefined && clean.length > opts.maxLength)
    return false;
  return true;
}

/**
 * Validate a positive integer string (smallest-unit amount, e.g. satoshis).
 */
export function isValidPositiveInt(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const n = parseInt(value, 10);
  return !!n && n > 0;
}

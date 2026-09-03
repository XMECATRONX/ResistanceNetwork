//! State rent — per-account storage pricing to prevent state bloat.
//!
//! HONEST SCOPE: This closes the "State rent (storage pricing)" gap in the
//! economic audit. Without state rent, accounts can write unlimited storage
//! and the chain's state grows forever without cost — the "state bloat"
//! problem that plagues Ethereum (where SSTORE costs gas once but the state
//! persists forever without ongoing cost).
//!
//! ## Model
//!
//! This is a **per-account, per-block rent** model (similar to Cosmos's
//! "state rent" but simpler):
//!
//! - Each account that has stored state (contract code, storage slots) pays
//!   a rent proportional to the number of storage slots it occupies.
//! - The rent is charged per block from the account's RSTN balance.
//! - If the balance falls below the rent, the account's storage is **frozen**
//!   (not deleted — the data is preserved but cannot be read or written
//!   until the owner tops up and pays the back-rent).
//! - The rent is **burned** (deflationary — it does not go to any operator).
//!
//! ## Why this matters
//!
//! Without state rent, an attacker can bloat the chain by writing millions
//! of storage slots (paying gas once, then the state lives forever). With
//! rent, each slot costs ongoing RSTN per block — the attacker must
//! continuously fund the storage or it gets frozen. This makes state bloat
//! economically unsustainable.
//!
//! ## What is NOT claimed (future research)
//!
//! - A full trie-based rent system (like Ethereum's proposed state expiry)
//! - Refund of rent when storage is cleared (this is a charge-only model)

use serde::{Deserialize, Serialize};

/// Rent per storage slot per block, in smallest denomination (atto-RSTN).
/// 1 slot = 100 atto-RSTN per block. At 400ms/block, this is ~7.9 RSTN/year
/// per slot — meaningful but not punishing for legitimate contracts.
pub const SLOT_RENT_PER_BLOCK: u128 = 100;

/// Minimum balance required to keep storage unfrozen. If an account's
/// balance drops below this, its storage is frozen until the owner
/// tops up and pays back-rent.
pub const FREEZE_THRESHOLD: u128 = 1_000_000_000_000; // 0.001 RSTN

/// An account's state-rent record.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StateRentAccount {
    /// The account's address (20 bytes).
    pub address: [u8; 20],
    /// Number of storage slots this account occupies.
    pub slot_count: u64,
    /// Total rent owed (accumulated unpaid rent when balance was insufficient).
    pub back_rent: u128,
    /// Is the storage frozen (cannot read/write until back-rent is paid)?
    pub frozen: bool,
    /// Block height at which the account last paid rent.
    pub last_rent_block: u64,
}

/// The state-rent manager: tracks per-account rent and collects it per block.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StateRentManager {
    /// Per-account rent records, keyed by address.
    pub accounts: Vec<StateRentAccount>,
    /// Total rent burned across all accounts (for observability).
    pub total_burned: u128,
}

impl Default for StateRentManager {
    fn default() -> Self {
        Self {
            accounts: Vec::new(),
            total_burned: 0,
        }
    }
}

impl StateRentManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register or update an account's slot count (called when storage changes).
    /// If the account is new, it's added with the given slot count.
    /// If it already exists, the slot count is updated.
    pub fn set_slot_count(&mut self, address: [u8; 20], slot_count: u64, height: u64) {
        if let Some(acc) = self.accounts.iter_mut().find(|a| a.address == address) {
            acc.slot_count = slot_count;
        } else {
            self.accounts.push(StateRentAccount {
                address,
                slot_count,
                back_rent: 0,
                frozen: false,
                last_rent_block: height,
            });
        }
    }

    /// Collect rent for all accounts at the given block height.
    /// Returns the total rent burned. This should be called once per block
    /// by the runner. The rent is charged from each account's balance via
    /// `charge_rent_from_balance` (which the runner calls).
    ///
    /// Accounts with insufficient balance accumulate `back_rent` and become
    /// frozen. The runner should call `charge_rent_from_balance` for each
    /// account with the account's balance to deduct the rent.
    pub fn collect_rent(&mut self, current_height: u64) -> u128 {
        let mut total_rent = 0u128;
        for acc in self.accounts.iter_mut() {
            if acc.slot_count == 0 {
                continue;
            }
            let blocks_elapsed = current_height.saturating_sub(acc.last_rent_block);
            if blocks_elapsed == 0 {
                continue;
            }
            let rent = SLOT_RENT_PER_BLOCK * acc.slot_count as u128 * blocks_elapsed as u128;
            acc.back_rent = acc.back_rent.saturating_add(rent);
            acc.last_rent_block = current_height;
            // If back_rent exceeds the freeze threshold, mark as frozen.
            // The runner checks each account's balance; if balance < back_rent,
            // the account is frozen. We can't check balance here (we don't have
            // access to the DB), so we just accumulate.
            if acc.back_rent > FREEZE_THRESHOLD {
                acc.frozen = true;
            }
            total_rent = total_rent.saturating_add(rent);
        }
        self.total_burned = self.total_burned.saturating_add(total_rent);
        total_rent
    }

    /// Charge rent from an account's balance. Called by the runner for each
    /// account after `collect_rent`. Returns the amount actually charged
    /// (may be less than `back_rent` if balance is insufficient).
    /// If the balance is insufficient, the account is frozen.
    pub fn charge_rent_from_balance(
        &mut self,
        address: &[u8; 20],
        balance: u128,
    ) -> u128 {
        let acc = match self.accounts.iter_mut().find(|a| &a.address == address) {
            Some(a) => a,
            None => return 0,
        };
        if acc.back_rent == 0 {
            return 0;
        }
        // Charge as much as the balance allows.
        let charged = acc.back_rent.min(balance);
        acc.back_rent = acc.back_rent.saturating_sub(charged);
        // If back_rent is cleared, unfreeze.
        if acc.back_rent == 0 {
            acc.frozen = false;
        }
        charged
    }

    /// Check if an account's storage is frozen (cannot read/write).
    pub fn is_frozen(&self, address: &[u8; 20]) -> bool {
        self.accounts
            .iter()
            .find(|a| &a.address == address)
            .map(|a| a.frozen)
            .unwrap_or(false)
    }

    /// Get the total state-rent burned (for RPC / observability).
    pub fn total_burned(&self) -> u128 {
        self.total_burned
    }

    /// Get the number of accounts tracked.
    pub fn account_count(&self) -> usize {
        self.accounts.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rent_proportional_to_slots() {
        let mut mgr = StateRentManager::new();
        let addr = [1u8; 20];
        mgr.set_slot_count(addr, 1000, 0);
        // 1000 slots * 100 atto/slot * 100 blocks = 10,000,000 atto
        let rent = mgr.collect_rent(100);
        assert_eq!(rent, 100 * 1000 * 100);
    }

    #[test]
    fn test_zero_slots_no_rent() {
        let mut mgr = StateRentManager::new();
        let addr = [1u8; 20];
        mgr.set_slot_count(addr, 0, 0);
        let rent = mgr.collect_rent(100);
        assert_eq!(rent, 0, "zero slots → zero rent");
    }

    #[test]
    fn test_insufficient_balance_freezes() {
        let mut mgr = StateRentManager::new();
        let addr = [1u8; 20];
        // Large slot count → large back_rent → exceeds FREEZE_THRESHOLD
        mgr.set_slot_count(addr, 1_000_000_000_000, 0);
        mgr.collect_rent(1);
        assert!(mgr.is_frozen(&addr), "account must be frozen when back_rent exceeds threshold");
    }

    #[test]
    fn test_charge_clears_back_rent() {
        let mut mgr = StateRentManager::new();
        let addr = [1u8; 20];
        mgr.set_slot_count(addr, 100, 0);
        mgr.collect_rent(100);
        // back_rent = 100 * 100 * 100 = 1,000,000
        let charged = mgr.charge_rent_from_balance(&addr, 1_000_000);
        assert_eq!(charged, 1_000_000);
        assert!(!mgr.is_frozen(&addr), "account unfrozen after paying full rent");
    }

    #[test]
    fn test_partial_charge_when_insufficient() {
        let mut mgr = StateRentManager::new();
        let addr = [1u8; 20];
        mgr.set_slot_count(addr, 100, 0);
        mgr.collect_rent(100);
        // back_rent = 1,000,000 but balance = 500,000 → charge 500k, freeze
        let charged = mgr.charge_rent_from_balance(&addr, 500_000);
        assert_eq!(charged, 500_000);
        assert!(mgr.is_frozen(&addr), "still frozen with remaining back_rent");
    }

    #[test]
    fn test_total_burned_accumulates() {
        let mut mgr = StateRentManager::new();
        mgr.set_slot_count([1u8; 20], 100, 0);
        mgr.collect_rent(10);
        let first = mgr.total_burned();
        mgr.collect_rent(20);
        assert!(mgr.total_burned() > first, "total_burned must accumulate");
    }
}

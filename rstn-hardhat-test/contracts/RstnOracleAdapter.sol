// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RstnOracleAdapter — On-chain price feed for the RstnVault
/// @notice Bridges the RSTN L1 multi-source oracle (median + TWAP, in the Rust
///         node) to the EVM vault. The node's consensus engine computes the
///         median price from N independent sources and writes it here via a
///         special oracle-update transaction. No single party controls the
///         price — it is the consensus-aggregated median.
///
///         The adapter is intentionally simple: it stores the latest price
///         and the height at which it was set. The vault reads `collateralPrice()`.
///         A stale-price guard rejects reads older than `MAX_STALE_BLOCKS`.
contract RstnOracleAdapter {
    uint256 public constant MAX_STALE_BLOCKS = 50;

    /// Latest median price of 1 collateral unit in USD (18 decimals).
    uint256 public price;
    /// Block height at which the price was last updated.
    uint256 public lastUpdateHeight;
    /// The RSTN L1 block height (tracked via setPrice).
    uint256 public currentHeight;

    /// Only the consensus engine (via the node's oracle-update tx) may write.
    /// This is set once at construction to the bridge/consensus relayer address.
    /// In the RSTN L1 this is the system address (0xffff...ff), not a human key.
    address public immutable oracleWriter;

    event PriceUpdated(uint256 price, uint256 height);

    constructor(address _oracleWriter) {
        oracleWriter = _oracleWriter;
    }

    /// Called by the consensus engine after it aggregates the median from all
    /// oracle sources. `height` is the RSTN L1 block height.
    function setPrice(uint256 _price, uint256 _height) external {
        require(msg.sender == oracleWriter, "ORACLE: only writer");
        require(_price > 0, "ORACLE: zero price");
        price = _price;
        lastUpdateHeight = _height;
        currentHeight = _height;
        emit PriceUpdated(_price, _height);
    }

    /// Called by the consensus engine to advance the height (even if price
    /// is unchanged) so the stale guard works between price updates.
    function advanceHeight(uint256 _height) external {
        require(msg.sender == oracleWriter, "ORACLE: only writer");
        currentHeight = _height;
    }

    /// The collateral price, with a staleness guard. Reverts if the price has
    /// not been updated within MAX_STALE_BLOCKS — this prevents the vault from
    /// acting on a stale/manipulated price if the oracle feed goes down.
    function collateralPrice() external view returns (uint256) {
        require(currentHeight - lastUpdateHeight <= MAX_STALE_BLOCKS, "ORACLE: stale");
        return price;
    }
}

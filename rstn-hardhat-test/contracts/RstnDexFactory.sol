// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RstnDexPool.sol";

/// @title RstnDexFactory — Permissionless pool factory
/// @notice Anyone can create a pool for any two ERC-20 tokens. At genesis the
///         only meaningful pool is wRSTN/USDC, which is the canonical price
///         discovery pool that CoinGecko/CoinMarketCap read via VWAP.
///
///         No owner. No fee switch. No admin. Immutable.
contract RstnDexFactory {
    mapping(address => mapping(address => address)) public getPool;
    address[] public allPools;

    event PoolCreated(address indexed token0, address indexed token1, address pool, uint256 index);

    function createPool(address tokenA, address tokenB) external returns (address pool) {
        require(tokenA != tokenB, "RSTNDEX: identical tokens");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "RSTNDEX: zero address");
        require(getPool[token0][token1] == address(0), "RSTNDEX: pool exists");

        RstnDexPool newPool = new RstnDexPool(token0, token1);
        pool = address(newPool);
        getPool[token0][token1] = pool;
        getPool[token1][token0] = pool;
        allPools.push(pool);
        emit PoolCreated(token0, token1, pool, allPools.length);
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
}

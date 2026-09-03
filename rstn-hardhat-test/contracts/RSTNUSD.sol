// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RSTNUSD — Over-collateralized post-quantum stablecoin (rUSD)
/// @notice rUSD is a USD-pegged stablecoin minted ONLY against over-collateralized
///         debt positions in the RstnVault. There is NO fiat custody, NO central
///         issuer, NO admin key, NO freeze/pause. It is the DAI model: every rUSD
///         is backed by crypto collateral worth >=150% of its value, locked in a
///         permissionless vault that anyone can liquidate if undercollateralized.
///
///         Why this is SEC-safe for the "launch and disappear" model:
///           - The deployer mints NOTHING to themselves. rUSD is minted 1:1 only
///             when a user locks collateral. Supply = collateral / 1.5, always.
///           - There is no "issuer" controlling supply. The contract is immutable.
///           - There is no profit stream to any operator. The stability fee flows
///             to the community treasury (governance timelock), not to any person.
///           - Liquidation is permissionless and algorítmic — no human decides.
///
///         Tokenomics: 18 decimals, 1 rUSD = 1e18 = $1.00 (peg maintained by
///         arbitrage + over-collateralization, not by any reserve promise).
contract RSTNUSD {
    string public constant name = "Resistance USD";
    string public constant symbol = "rUSD";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    /// The vault is the ONLY authorized minter. Set once at construction and
    /// immutable thereafter — no mint authority can ever be added or rotated.
    address public immutable vault;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(address _vault) {
        vault = _vault;
    }

    /// @notice Mint rUSD. Only the vault calls this when a user opens/increases
    ///         a collateralized debt position. The vault enforces over-collateralization.
    function mint(address to, uint256 amount) external {
        require(msg.sender == vault, "rUSD: only vault");
        require(to != address(0), "rUSD: zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Burn rUSD. Only the vault calls this when a user repays debt.
    function burn(address from, uint256 amount) external {
        require(msg.sender == vault, "rUSD: only vault");
        require(balanceOf[from] >= amount, "rUSD: insufficient balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "rUSD: insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "rUSD: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

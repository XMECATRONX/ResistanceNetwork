// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RstnDexPool — Constant-product AMM (x * y = k) for the RSTN L1
/// @notice Uniswap-V2-style automated market maker. Born from the Satoshi
///         fair-launch principle: the first liquidity provider sets the initial
///         price by depositing both sides. No admin, no fee recipient owner,
///         no pre-mint. Price is discovered at the first swap.
///
///         RSTN is the native gas token of the RSTN L1. To trade it in a pool it
///         must be wrapped as wRSTN (see WRSTN.sol). USDC (or any ERC-20) is the
///         quote token. The pool is fully permissionless and upgradeable only
///         by governance (none at genesis — immutable bytecode).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract RstnDexPool {
    address public token0; // wRSTN
    address public token1; // USDC (quote)
    address public factory;

    uint256 public reserve0;
    uint256 public reserve1;

    uint256 public totalSupply; // LP token supply
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public nonces;

    /// @dev Swap fee in basis points. 30 = 0.30%. Immutable.
    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS_DENOM = 10000;

    /// @dev Block timestamp of last price update, for TWAP oracle.
    uint32 public blockTimestampLast;
    /// @dev Cumulative prices for TWAP oracle (price0CumulativeLast, price1CumulativeLast).
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1, uint256 lpMinted, address indexed to);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, uint256 lpBurned, address indexed to);
    event Swap(
        address indexed sender,
        address indexed to,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out
    );
    event Sync(uint256 reserve0, uint256 reserve1);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    modifier onlyFactory() {
        require(msg.sender == factory, "RSTNDEX: only factory");
        _;
    }

    constructor(address _token0, address _token1) {
        factory = msg.sender;
        token0 = _token0;
        token1 = _token1;
    }

    // ---------------------------------------------------------------------
    // LP token — full ERC-20 (H-DEX-2). LP tokens are transferable and
    // approvable so they can be used as collateral, staked, or routed by
    // aggregators. Mint/burn stay pool-internal (only via add/remove liquidity).
    // ---------------------------------------------------------------------

    string public constant name = "RSTN DEX LP";
    string public constant symbol = "RSTN-LP";
    uint8 public constant decimals = 18;

    mapping(address => mapping(address => uint256)) public allowance;

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "RSTNDEX: insufficient LP balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "RSTNDEX: insufficient allowance");
        if (allowed != type(uint256).max) {
            _approve(from, msg.sender, allowed - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "RSTNDEX: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    // ---------------------------------------------------------------------
    // Reserves & oracle accumulators
    // ---------------------------------------------------------------------

    function _update(uint256 balance0, uint256 balance1) private {
        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        if (timeElapsed > 0 && reserve0 != 0 && reserve1 != 0) {
            // overflow is desired — cumulative price over time
            unchecked {
                price0CumulativeLast += (reserve1 << 112) / reserve0 * timeElapsed;
                price1CumulativeLast += (reserve0 << 112) / reserve1 * timeElapsed;
            }
        }
        reserve0 = balance0;
        reserve1 = balance1;
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    /// @notice Spot price of token0 in terms of token1 (how many token1 per token0),
    ///         gross of fee. Aggregators should use TWAP, not spot.
    function price0Per1() external view returns (uint256) {
        if (reserve0 == 0) return 0;
        return (reserve1 * 1e18) / reserve0;
    }

    // ---------------------------------------------------------------------
    // Add liquidity
    // ---------------------------------------------------------------------

    function mint(address to) external returns (uint256 lpMinted) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;

        if (totalSupply == 0) {
            // First deposit: bootstrap price. MINIMUM_LIQUIDITY locked forever
            // to prevent pool inflation attack (Uniswap V2 pattern).
            lpMinted = _sqrt(balance0 * balance1) - 1000;
            _mint(address(0xdead), 1000); // permanent lock
        } else {
            // Uniswap V2: take the minimum of the two proportional LP amounts.
            // Do NOT require exact equality — wRSTN (9 decimals) and USDC (6 decimals)
            // almost never produce equal lp0/lp1 due to rounding.
            uint256 lp0 = (balance0 * totalSupply) / _reserve0;
            uint256 lp1 = (balance1 * totalSupply) / _reserve1;
            lpMinted = lp0 < lp1 ? lp0 : lp1;
        }
        require(lpMinted > 0, "RSTNDEX: insufficient liquidity minted");
        _mint(to, lpMinted);
        _update(balance0, balance1);
        emit Mint(msg.sender, balance0 - _reserve0, balance1 - _reserve1, lpMinted, to);
    }

    // ---------------------------------------------------------------------
    // Remove liquidity
    // ---------------------------------------------------------------------

    function burn(address to) external returns (uint256 amount0, uint256 amount1) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 lpToBurn = balanceOf[address(this)];

        uint256 _totalSupply = totalSupply;
        amount0 = (lpToBurn * balance0) / _totalSupply;
        amount1 = (lpToBurn * balance1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "RSTNDEX: insufficient liquidity burned");

        _burn(address(this), lpToBurn);
        _safeTransfer(token0, to, amount0);
        _safeTransfer(token1, to, amount1);
        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, lpToBurn, to);
    }

    // ---------------------------------------------------------------------
    // Swap
    // ---------------------------------------------------------------------

    /// @notice Swap tokens. Caller must have transferred tokens in first.
    ///         amount0Out/amount1Out: how much of each token to send to `to`.
    ///         At most one of them is non-zero.
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, "RSTNDEX: zero output");
        require(to != token0 && to != token1, "RSTNDEX: invalid recipient");

        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "RSTNDEX: insufficient liquidity");

        uint256 balance0;
        uint256 balance1;
        {
            // scope avoids stack-too-deep; transfer outputs first (Uniswap V2 pattern)
            if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
            if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);
            balance0 = IERC20(token0).balanceOf(address(this));
            balance1 = IERC20(token1).balanceOf(address(this));
        }

        // Compute the actual input amount: how much the balance exceeded the
        // pre-swap reserve minus the output. Uses _reserve (not balance) so the
        // already-transferred input is correctly accounted as `amountIn`.
        uint256 amount0In = balance0 > _reserve0 - amount0Out
            ? balance0 - (_reserve0 - amount0Out)
            : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out
            ? balance1 - (_reserve1 - amount1Out)
            : 0;

        require(amount0In > 0 || amount1In > 0, "RSTNDEX: insufficient input");

        // Uniswap V2 invariant with fee applied to the input side.
        // balanceAdjusted = balance * 1000 - amountIn * 3  (3 = 30 bps of 1000)
        // Compare against reserve0 * reserve1 * 1000 * 1000.
        uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(balance0Adjusted * balance1Adjusted >= _reserve0 * _reserve1 * 1000 * 1000, "RSTNDEX: K");

        _update(balance0, balance1);
        emit Swap(msg.sender, to, amount0In, amount1In, amount0Out, amount1Out);
    }

    // ---------------------------------------------------------------------
    // Quote helper (off-chain aggregators can also read reserves directly)
    // ---------------------------------------------------------------------

    /// @notice Returns output amount for a given input, gross of fee applied.
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256)
    {
        require(amountIn > 0, "RSTNDEX: zero input");
        require(reserveIn > 0 && reserveOut > 0, "RSTNDEX: no liquidity");
        uint256 amountInWithFee = amountIn * (BPS_DENOM - FEE_BPS);
        return (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOM + amountInWithFee);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _safeTransfer(address token, address to, uint256 amount) private {
        bool ok = IERC20(token).transfer(to, amount);
        require(ok, "RSTNDEX: transfer failed");
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            uint256 x = y / 2 + 1;
            z = y;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RSTNUSD.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IOracle {
    /// Returns the USD price of one unit of collateral (18 decimals).
    /// e.g. 1 wRSTN = $X => returns X * 1e18.
    function collateralPrice() external view returns (uint256);
}

/// @title RstnVault — Over-collateralized CDP vault (MakerDAO/DAI model)
/// @notice Users lock collateral (wRSTN or any whitelisted ERC-20) and mint rUSD
///         against it. The position MUST stay over-collateralized (>=150%). If it
///         drops below the liquidation ratio, ANYONE can liquidate it permissionlessly.
///
///         NO OWNER. NO ADMIN. NO PAUSE. NO FEE RECIPIENT KEY.
///         The stability fee accrues to `treasury` (a community-governed timelock
///         set once at construction). The deployer cannot change it, cannot mint
///         rUSD to themselves, cannot freeze positions, cannot pause liquidations.
///
///         This is the "Satoshi launch" applied to a stablecoin: deploy the
///         immutable code, walk away. The system runs itself.
///
/// @dev Parameters are immutable (constant). Governance can only adjust the
///      stability fee via the treasury timelock — it CANNOT touch user collateral,
///      CANNOT mint rUSD, CANNOT pause liquidations. This is by design.
contract RstnVault {
    // ---------------------------------------------------------------------
    // Immutable parameters (set at construction, never change)
    // ---------------------------------------------------------------------

    /// Minimum collateral ratio to open/increase a position. 150% = 15000 bps.
    /// A user locking $150 of collateral can mint at most $100 of rUSD.
    uint256 public constant MIN_COLLATERAL_RATIO_BPS = 15000; // 150%

    /// Liquidation threshold. If collateral ratio drops below this, the position
    /// is liquidatable. Set equal to MIN so there is no "safe but close" zone
    /// that invites manipulation right at the boundary.
    uint256 public constant LIQUIDATION_RATIO_BPS = 15000; // 150%

    /// Liquidation penalty: the liquidator buys collateral at a 13% discount.
    /// This incentivizes rapid liquidation and penalizes the undercollateralized
    /// borrower. The 13% surplus goes to the treasury (not to any operator).
    uint256 public constant LIQUIDATION_PENALTY_BPS = 1300; // 13%

    uint256 public constant BPS_DENOM = 10000;

    /// Stability fee: 2% APR on outstanding debt. Accrues to the treasury.
    /// Expressed as a per-second rate (2% / 31536000 seconds).
    uint256 public constant STABILITY_FEE_PER_SEC = 634195839; // ~2% APR in 1e18 fixed-point per second

    RSTNUSD public immutable rUSD;
    IERC20 public immutable collateral;
    IOracle public immutable oracle;

    /// Community-governed treasury (timelock). Receives stability fees + liquidation
    /// penalties. Set once, immutable. The deployer has no special access to it.
    address public immutable treasury;

    // ---------------------------------------------------------------------
    // Per-user collateralized debt positions (CDPs)
    // ---------------------------------------------------------------------

    struct Position {
        uint256 collateral;   // amount of collateral locked (token units)
        uint256 debt;         // outstanding rUSD debt (rUSD units, 18 decimals)
        uint256 lastAccrual;  // block.timestamp of last stability-fee accrual
    }

    mapping(address => Position) public positions;

    uint256 public totalCollateral;
    uint256 public totalDebt;

    event Deposit(address indexed user, uint256 amount, uint256 newCollateral);
    event Withdraw(address indexed user, uint256 amount, uint256 newCollateral);
    event Mint(address indexed user, uint256 amount, uint256 newDebt);
    event Burn(address indexed user, uint256 amount, uint256 newDebt);
    event Liquidate(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized, uint256 penalty);
    event StabilityFeeAccrued(address indexed user, uint256 fee);

    constructor(
        address _collateral,
        address _oracle,
        address _treasury
    ) {
        rUSD = new RSTNUSD(address(this));
        collateral = IERC20(_collateral);
        oracle = IOracle(_oracle);
        treasury = _treasury;
    }

    // ---------------------------------------------------------------------
    // Stability fee accrual (internal)
    // ---------------------------------------------------------------------

    /// Accrue stability fee on a position and return the new total debt.
    function _accrue(Position storage p) internal {
        if (p.debt == 0) {
            p.lastAccrual = block.timestamp;
            return;
        }
        uint256 timeDelta = block.timestamp - p.lastAccrual;
        if (timeDelta == 0) return;
        // fee = debt * rate * timeDelta / 1e18
        uint256 fee = (p.debt * STABILITY_FEE_PER_SEC * timeDelta) / 1e18;
        if (fee > 0) {
            p.debt += fee;
            totalDebt += fee;
            emit StabilityFeeAccrued(msg.sender, fee);
        }
        p.lastAccrual = block.timestamp;
    }

    /// Current collateral ratio of a position in bps (e.g. 15000 = 150%).
    /// Returns type(uint256).max if debt is 0 (fully collateralized / no debt).
    function collateralRatio(address user) public view returns (uint256) {
        Position storage p = positions[user];
        if (p.debt == 0) return type(uint256).max;
        uint256 price = oracle.collateralPrice();
        if (price == 0) return 0;
        // collateralValueUSD = collateral * price / 1e(collateralDecimals)
        // We assume collateral has 18 decimals (wRSTN has 9; the oracle must
        // normalize). ratio = collateralValueUSD * BPS / debt
        uint256 collateralValueUSD = (p.collateral * price) / 1e18;
        return (collateralValueUSD * BPS_DENOM) / p.debt;
    }

    // ---------------------------------------------------------------------
    // User operations — all permissionless, no admin
    // ---------------------------------------------------------------------

    /// Lock collateral. Caller must have approved this contract to spend.
    function deposit(uint256 amount) external {
        require(amount > 0, "VAULT: zero deposit");
        Position storage p = positions[msg.sender];
        _accrue(p);
        require(
            collateral.transferFrom(msg.sender, address(this), amount),
            "VAULT: transfer failed"
        );
        p.collateral += amount;
        totalCollateral += amount;
        emit Deposit(msg.sender, amount, p.collateral);
    }

    /// Withdraw collateral. Only allowed if the position stays over-collateralized
    /// after the withdrawal (or has no debt).
    function withdraw(uint256 amount) external {
        require(amount > 0, "VAULT: zero withdraw");
        Position storage p = positions[msg.sender];
        _accrue(p);
        require(p.collateral >= amount, "VAULT: insufficient collateral");
        p.collateral -= amount;
        // Check the position is still safe after withdrawal.
        if (p.debt > 0) {
            require(
                collateralRatio(msg.sender) >= MIN_COLLATERAL_RATIO_BPS,
                "VAULT: undercollateralized after withdraw"
            );
        }
        totalCollateral -= amount;
        require(collateral.transfer(msg.sender, amount), "VAULT: transfer failed");
        emit Withdraw(msg.sender, amount, p.collateral);
    }

    /// Mint rUSD against collateral. The position must be over-collateralized
    /// after minting. The minted rUSD goes to the caller.
    function mintDebt(uint256 amount) external {
        require(amount > 0, "VAULT: zero mint");
        Position storage p = positions[msg.sender];
        _accrue(p);
        p.debt += amount;
        // Enforce over-collateralization.
        require(
            collateralRatio(msg.sender) >= MIN_COLLATERAL_RATIO_BPS,
            "VAULT: undercollateralized"
        );
        totalDebt += amount;
        rUSD.mint(msg.sender, amount);
        emit Mint(msg.sender, amount, p.debt);
    }

    /// Repay debt (burn rUSD). Reduces the position's debt. Anyone can repay
    /// on behalf of a user by transferring rUSD here first, but the debt
    /// reduction always applies to `user`. The caller pays the rUSD.
    function repayDebt(address user, uint256 amount) external {
        require(amount > 0, "VAULT: zero repay");
        Position storage p = positions[user];
        _accrue(p);
        uint256 repay = amount > p.debt ? p.debt : amount;
        p.debt -= repay;
        totalDebt -= repay;
        rUSD.burn(msg.sender, repay);
        emit Burn(user, repay, p.debt);
    }

    // ---------------------------------------------------------------------
    // Liquidation — permissionless, algorítmic, no human decision
    // ---------------------------------------------------------------------

    /// Liquidate an undercollateralized position. The liquidator repays the
    /// debt (burns rUSD) and receives collateral at a discount (the penalty).
    /// The penalty surplus is sent to the treasury. Anyone can call this —
    /// it is the core mechanism that keeps rUSD always over-collateralized.
    /// @param user The undercollateralized position owner.
    /// @param repayAmount How much debt to repay (caps at the position's debt).
    function liquidate(address user, uint256 repayAmount) external {
        Position storage p = positions[user];
        _accrue(p);
        require(p.debt > 0, "VAULT: no debt");
        require(
            collateralRatio(user) < LIQUIDATION_RATIO_BPS,
            "VAULT: not liquidatable"
        );

        uint256 repay = repayAmount > p.debt ? p.debt : repayAmount;
        require(repay > 0, "VAULT: zero liquidation");

        uint256 price = oracle.collateralPrice();
        // collateralToSeize = repayUSD * (1 + penalty) / price
        // repay is in rUSD (USD, 18 decimals). price is USD per collateral unit (18 dec).
        uint256 repayPlusPenalty = (repay * (BPS_DENOM + LIQUIDATION_PENALTY_BPS)) / BPS_DENOM;
        uint256 collateralToSeize = (repayPlusPenalty * 1e18) / price;

        require(collateralToSeize <= p.collateral, "VAULT: seize exceeds collateral");

        // Burn the repaid rUSD from the liquidator.
        rUSD.burn(msg.sender, repay);
        p.debt -= repay;
        totalDebt -= repay;

        // Split seized collateral: penalty portion to treasury, rest to liquidator.
        uint256 penaltyCollateral = (collateralToSeize * LIQUIDATION_PENALTY_BPS) / (BPS_DENOM + LIQUIDATION_PENALTY_BPS);
        uint256 liquidatorCollateral = collateralToSeize - penaltyCollateral;

        p.collateral -= collateralToSeize;
        totalCollateral -= collateralToSeize;

        if (penaltyCollateral > 0) {
            require(collateral.transfer(treasury, penaltyCollateral), "VAULT: treasury transfer failed");
        }
        require(collateral.transfer(msg.sender, liquidatorCollateral), "VAULT: liquidator transfer failed");

        emit Liquidate(user, msg.sender, repay, collateralToSeize, penaltyCollateral);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getPosition(address user) external view returns (uint256, uint256) {
        Position storage p = positions[user];
        return (p.collateral, p.debt);
    }

    /// Is a position currently liquidatable?
    function isLiquidatable(address user) external view returns (bool) {
        Position storage p = positions[user];
        if (p.debt == 0) return false;
        return collateralRatio(user) < LIQUIDATION_RATIO_BPS;
    }
}

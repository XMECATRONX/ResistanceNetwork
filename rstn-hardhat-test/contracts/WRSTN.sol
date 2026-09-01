// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WRSTN — Wrapped RSTN (native gas token wrapper)
/// @notice RSTN is the native gas token of the RSTN L1. AMM pools operate on
///         ERC-20 balances, so native RSTN must be wrapped to wRSTN before it can
///         be deposited into a pool. This is the same pattern as WETH on
///         Ethereum: a thin ERC-20 wrapper around native balance.
///
///         Deposit: send native RSTN, receive wRSTN 1:1.
///         Withdraw: burn wRSTN, receive native RSTN 1:1.
contract WRSTN {
    string public name = "Wrapped RSTN";
    string public symbol = "wRSTN";
    uint8 public decimals = 9; // RSTN native decimals

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "WRSTN: zero deposit");
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Deposit(msg.sender, msg.value);
        emit Transfer(address(0), msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "WRSTN: insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "WRSTN: withdrawal failed");
        emit Withdrawal(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
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
        require(allowance[from][msg.sender] >= amount, "WRSTN: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "WRSTN: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RstnStorage — contrato de prueba para validar compatibilidad EVM
/// @notice Despliegalo contra http://localhost:9944 (chainId 1337)
contract RstnStorage {
    uint256 private value;
    address public owner;

    event ValueChanged(address indexed setter, uint256 oldValue, uint256 newValue);

    constructor() {
        owner = msg.sender;
        value = 42;
    }

    function set(uint256 newValue) external {
        require(msg.sender == owner, "only owner");
        uint256 old = value;
        value = newValue;
        emit ValueChanged(msg.sender, old, newValue);
    }

    function get() external view returns (uint256) {
        return value;
    }
}

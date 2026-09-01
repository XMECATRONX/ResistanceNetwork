require("@nomicfoundation/hardhat-toolbox");

// Clave privada de prueba del validador 0 (testnet local — sin valor real).
// Se genera en cada `local-testnet.sh up` y se guarda en .testnet/validator-0.json
// Copia aquí el campo `private_key` de ese archivo para firmar el deploy.
const TESTNET_PRIVATE_KEY =
  process.env.RSTN_TESTNET_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    rstn: {
      url: "http://localhost:9944",
      chainId: 1337,
      accounts: [TESTNET_PRIVATE_KEY],
    },
  },
};

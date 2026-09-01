/**
 * RSTN DEX — Bootstrap deployment script
 *
 * Deploys the canonical price-discovery stack for the RSTN L1:
 *   1. WRSTN          — wrapped native RSTN (ERC-20)
 *   2. RstnDexFactory — permissionless pool factory
 *   3. RstnDexPool    — wRSTN/USDC constant-product AMM (created via factory)
 *
 * The pool is created but NOT seeded with liquidity here. Liquidity is added
 * in a separate, publicly verifiable transaction so that the first swap — and
 * therefore the birth of the RSTN market price — is observable on-chain.
 *
 * Run:  npx hardhat run scripts/deploy-dex.js --network rstn
 */
const hre = require("hardhat");

// USDC address for the canonical wRSTN/USDC pool (M-DEX-1).
// On testnet this defaults to a placeholder; on mainnet set
//   USDC_ADDRESS=<real USDC ERC-20 address>
// The real USDC must be bridged/native to the RSTN L1 before mainnet deploy.
const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x" + "1".repeat(40);
if (USDC_ADDRESS === "0x" + "1".repeat(40)) {
  console.warn(
    "WARNING: USDC_ADDRESS not set — using placeholder 0x1..1.\n" +
      "Set USDC_ADDRESS=<real USDC ERC-20 address> for mainnet deploy."
  );
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RSTN DEX with account:", deployer.address);

  // 1. WRSTN
  const WRSTN = await hre.ethers.getContractFactory("WRSTN");
  const wrstn = await WRSTN.deploy();
  await wrstn.waitForDeployment();
  const wrstnAddr = await wrstn.getAddress();
  console.log("WRSTN deployed to:", wrstnAddr);

  // 2. Factory
  const Factory = await hre.ethers.getContractFactory("RstnDexFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("RstnDexFactory deployed to:", factoryAddr);

  // 3. Canonical pool: wRSTN / USDC
  const tx = await factory.createPool(wrstnAddr, USDC_ADDRESS);
  const receipt = await tx.wait();
  const createdEvent = receipt.logs
    .map((l) => {
      try {
        return factory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "PoolCreated");
  const poolAddr = createdEvent.args.pool;
  console.log("Canonical wRSTN/USDC pool deployed to:", poolAddr);

  console.log("\n--- DEX bootstrap complete ---");
  console.log("Next step: add initial liquidity to", poolAddr);
  console.log("Then: the first swap sets the RSTN market price (Satoshi model).");
  console.log("\nUpdate public/stats.json dex.pool_address with:", poolAddr);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

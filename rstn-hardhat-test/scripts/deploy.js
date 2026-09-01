// Despliegue del contrato RstnStorage contra el testnet local de RSTN
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Desplegando con la cuenta:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance del desplegador:", ethers.formatEther(balance), "RSTN");

  const RstnStorage = await ethers.getContractFactory("RstnStorage");
  const contract = await RstnStorage.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ RstnStorage desplegado en:", address);

  const value = await contract.get();
  console.log("Valor inicial:", value.toString());

  const tx = await contract.set(1337);
  await tx.wait();
  const newValue = await contract.get();
  console.log("Valor tras set(1337):", newValue.toString());
  console.log("🎉 Contrato funcionando en RSTN EVM!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

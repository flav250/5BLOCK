const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Déploiement des contrats...");

  // Récupérer le signataire (deployer)
  const [deployer] = await hre.ethers.getSigners();
  console.log(`📍 Déploiement depuis le compte: ${deployer.address}`);

  // Vérifier le solde
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Solde: ${hre.ethers.formatEther(balance)} ETH`);

  // Déployer CardCollectionNFT
  console.log("\n📦 Déploiement de CardCollectionNFT...");
  const CardCollectionNFT = await hre.ethers.getContractFactory("CardCollectionNFT");
  const cardContract = await CardCollectionNFT.deploy();
  await cardContract.waitForDeployment();

  const cardAddress = await cardContract.getAddress();
  console.log(`✅ CardCollectionNFT déployé à: ${cardAddress}`);

  // Déployer CardExchange
  console.log("\n📦 Déploiement de CardExchange...");
  const CardExchange = await hre.ethers.getContractFactory("CardExchange");
  const exchangeContract = await CardExchange.deploy(cardAddress);
  await exchangeContract.waitForDeployment();

  const exchangeAddress = await exchangeContract.getAddress();
  console.log(`✅ CardExchange déployé à: ${exchangeAddress}`);

  // Sauvegarder les adresses
  const deploymentInfo = {
    network: hre.network.name,
    cardCollectionNFT: cardAddress,
    cardExchange: exchangeAddress,
    deployer: deployer.address,
    deploymentBlock: await hre.ethers.provider.getBlockNumber(),
    deploymentDate: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "../artifacts/deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Déploiement terminé!");
  console.log("📋 Informations de déploiement:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Exporter les ABIs pour le frontend
  console.log("\n📤 Export des ABIs...");
  const abisDir = path.join(__dirname, "../abis");
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }

  // Copier les ABIs
  const cardArtifact = await hre.artifacts.readArtifact("CardCollectionNFT");
  const exchangeArtifact = await hre.artifacts.readArtifact("CardExchange");

  fs.writeFileSync(
    path.join(abisDir, "CardCollectionNFT.json"),
    JSON.stringify(cardArtifact.abi, null, 2)
  );

  fs.writeFileSync(
    path.join(abisDir, "CardExchange.json"),
    JSON.stringify(exchangeArtifact.abi, null, 2)
  );

  console.log("✅ ABIs exportées");

  // Générer un fichier .env.local pour le frontend
  const envContent = `# Adresses des smart contracts
VITE_CARD_CONTRACT_ADDRESS=${cardAddress}
VITE_EXCHANGE_CONTRACT_ADDRESS=${exchangeAddress}

# Configuration réseau
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
`;

  const envLocalPath = path.join(__dirname, "../frontend/.env.local.example");
  fs.writeFileSync(envLocalPath, envContent);

  console.log("📝 Fichier .env.local.example généré pour le frontend");
  console.log(
    "\n⚠️  N'oubliez pas de mettre à jour VITE_CARD_CONTRACT_ADDRESS et VITE_EXCHANGE_CONTRACT_ADDRESS dans frontend/.env.local"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const ArenaCards = await hre.ethers.getContractFactory("ArenaCards");
    const arenaCards = await ArenaCards.deploy();
    await arenaCards.waitForDeployment();
    const arenaAddr = await arenaCards.getAddress();

    console.log("\nDéploiement FreeBooster...");
    const FreeBooster = await hre.ethers.getContractFactory("FreeBooster");
    const freeBooster = await FreeBooster.deploy(arenaAddr);
    await freeBooster.waitForDeployment();
    const freeBoosterAddr = await freeBooster.getAddress();

    console.log("\nDéploiement PremiumBooster...");
    const PremiumBooster = await hre.ethers.getContractFactory("PremiumBooster");
    const premiumBooster = await PremiumBooster.deploy(arenaAddr);
    await premiumBooster.waitForDeployment();
    const premiumBoosterAddr = await premiumBooster.getAddress();

    console.log("\nAutorisation des boosters comme minters...");
    const tx1 = await arenaCards.setAuthorizedMinter(freeBoosterAddr, true);
    await tx1.wait();

    const tx2 = await arenaCards.setAuthorizedMinter(premiumBoosterAddr, true);
    await tx2.wait();

    console.log("\nDéploiement Marketplace...");
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(arenaAddr);
    await marketplace.waitForDeployment();
    const marketplaceAddr = await marketplace.getAddress();

    console.log("\nDéploiement CardFusion...");
    const CardFusion = await hre.ethers.getContractFactory("CardFusion");
    const cardFusion = await CardFusion.deploy(arenaAddr);
    await cardFusion.waitForDeployment();
    const fusionAddr = await cardFusion.getAddress();

    const tx3 = await arenaCards.setFusionContract(fusionAddr);
    await tx3.wait();

    console.log("\nMise à jour du fichier");

    const envPath = path.join(__dirname, "..", "..", "frontend", "ArenaCards", ".env");
    const envContent = `VITE_ARENA_CARDS_ADDRESS=${arenaAddr}
VITE_FREE_BOOSTER_ADDRESS=${freeBoosterAddr}
VITE_PREMIUM_BOOSTER_ADDRESS=${premiumBoosterAddr}
VITE_MARKETPLACE_ADDRESS=${marketplaceAddr}
VITE_CARDFUSION_ADDRESS=${fusionAddr}
`;

    fs.writeFileSync(envPath, envContent);
    console.log("Fichier créé/mis à jour avec succès !");

    console.log("\nDéploiement terminé !");
    console.log("\n Adresses des contrats :");
    console.log("ArenaCards     :", arenaAddr);
    console.log("FreeBooster    :", freeBoosterAddr);
    console.log("PremiumBooster :", premiumBoosterAddr);
    console.log("Marketplace    :", marketplaceAddr);
    console.log("CardFusion     :", fusionAddr);
    console.log("\nDeployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deploy failed:", error);
        process.exit(1);
    });
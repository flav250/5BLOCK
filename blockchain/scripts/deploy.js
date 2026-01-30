const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    // 1) Deploy ArenaCards
    console.log("\n📦 Déploiement ArenaCards...");

    const ArenaCards = await hre.ethers.getContractFactory("ArenaCards");
    const arenaCards = await ArenaCards.deploy();
    await arenaCards.waitForDeployment();
    const arenaAddr = await arenaCards.getAddress();
    console.log("✅ ArenaCards déployé à:", arenaAddr);

    // 2) Deploy FreeBooster
    console.log("\n📦 Déploiement FreeBooster...");
    const FreeBooster = await hre.ethers.getContractFactory("FreeBooster");
    const freeBooster = await FreeBooster.deploy(arenaAddr);
    await freeBooster.waitForDeployment();
    const freeBoosterAddr = await freeBooster.getAddress();
    console.log("✅ FreeBooster déployé à:", freeBoosterAddr);

    // 3) Deploy PremiumBooster
    console.log("\n📦 Déploiement PremiumBooster...");
    const PremiumBooster = await hre.ethers.getContractFactory("PremiumBooster");
    const premiumBooster = await PremiumBooster.deploy(arenaAddr);
    await premiumBooster.waitForDeployment();
    const premiumBoosterAddr = await premiumBooster.getAddress();
    console.log("✅ PremiumBooster déployé à:", premiumBoosterAddr);

    // 4) Authorize both boosters as minters (mapping(address=>bool))
    console.log("\n🔐 Autorisation des boosters comme minters...");
    const tx1 = await arenaCards.setAuthorizedMinter(freeBoosterAddr, true);
    await tx1.wait();
    console.log("✅ FreeBooster autorisé");
    const tx2 = await arenaCards.setAuthorizedMinter(premiumBoosterAddr, true);
    await tx2.wait();
    console.log("✅ PremiumBooster autorisé");
    // 5) Deploy Marketplace
    console.log("\n🛒 Déploiement Marketplace...");
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(arenaAddr);
    await marketplace.waitForDeployment();
    const marketplaceAddr = await marketplace.getAddress();
    // 4️⃣ Deploy CardFusion
    const CardFusion = await hre.ethers.getContractFactory("CardFusion");
    const cardFusion = await CardFusion.deploy(arenaAddr);
    await cardFusion.waitForDeployment();
    const fusionAddr = await cardFusion.getAddress();
    console.log("CardFusion deployed to:", fusionAddr);
    // 5️⃣ Authorize CardFusion
    tx = await arenaCards.setFusionContract(fusionAddr);
    await tx.wait();
    console.log("✅ CardFusion authorized");

    console.log("✅ Marketplace déployé à:", marketplaceAddr);
    console.log("\n🎉 Déploiement terminé !");
    console.log("VITE_ARENA_CARDS_ADDRESS=",arenaAddr);
    console.log("VITE_FREE_BOOSTER_ADDRESS=",freeBoosterAddr);
    console.log("VITE_PREMIUM_BOOSTER_ADDRESS=",premiumBoosterAddr);
    console.log("VITE_MARKETPLACE_ADDRESS=",marketplaceAddr);
    console.log("VITE_CARDFUSION_ADDRESS=",fusionAddr);
    console.log("Marketplace deployed to:", marketplaceAddr);
    console.log("🚀 Deployment completed successfully!");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deploy failed:", error);
        process.exit(1);
    });
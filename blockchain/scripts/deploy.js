const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // 1️⃣ Deploy ArenaCards
    const ArenaCards = await hre.ethers.getContractFactory("ArenaCards");
    const arenaCards = await ArenaCards.deploy();
    await arenaCards.waitForDeployment();
    const arenaAddr = await arenaCards.getAddress();
    console.log("ArenaCards deployed to:", arenaAddr);

    // 2️⃣ Deploy Booster
    const Booster = await hre.ethers.getContractFactory("Booster");
    const booster = await Booster.deploy(arenaAddr);
    await booster.waitForDeployment();
    const boosterAddr = await booster.getAddress();
    console.log("Booster deployed to:", boosterAddr);

    // 3️⃣ Authorize Booster
    let tx = await arenaCards.setAuthorizedMinter(boosterAddr);
    await tx.wait();
    console.log("✅ Booster authorized");

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

    // 6️⃣ Deploy Marketplace
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(arenaAddr);
    await marketplace.waitForDeployment();
    const marketplaceAddr = await marketplace.getAddress();
    console.log("Marketplace deployed to:", marketplaceAddr);

    // 7️⃣ Deploy Team
    const Team = await hre.ethers.getContractFactory("Team");
    const team = await Team.deploy(arenaAddr);
    await team.waitForDeployment();
    const teamAddr = await team.getAddress();
    console.log("Team deployed to:", teamAddr);

    console.log("🚀 Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

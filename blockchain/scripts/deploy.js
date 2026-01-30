const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // 1) Deploy ArenaCards
    const ArenaCards = await hre.ethers.getContractFactory("ArenaCards");
    const arenaCards = await ArenaCards.deploy();
    await arenaCards.waitForDeployment();
    const arenaAddr = await arenaCards.getAddress();
    console.log("ArenaCards deployed to:", arenaAddr);

    // 2) Deploy Booster
    const Booster = await hre.ethers.getContractFactory("Booster");
    const booster = await Booster.deploy(arenaAddr);
    await booster.waitForDeployment();
    const boosterAddr = await booster.getAddress();
    console.log("Booster deployed to:", boosterAddr);

    // 3) Authorize Booster as minter
    const tx = await arenaCards.setAuthorizedMinter(boosterAddr);
    await tx.wait();
    console.log("Authorized minter set to Booster");

    // 4) Deploy Marketplace
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(arenaAddr);
    await marketplace.waitForDeployment();
    const marketplaceAddr = await marketplace.getAddress();
    console.log("Marketplace deployed to:", marketplaceAddr);

    // 5) Deploy Team
    const Team = await hre.ethers.getContractFactory("Team");
    const team = await Team.deploy(arenaAddr);
    await team.waitForDeployment();
    const teamAddr = await team.getAddress();
    console.log("Team deployed to:", teamAddr);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
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

    // 2) Deploy Booster(arenaCardsAddress)
    const Booster = await hre.ethers.getContractFactory("Booster");
    const booster = await Booster.deploy(arenaAddr);
    await booster.waitForDeployment();
    const boosterAddr = await booster.getAddress();
    console.log("Booster deployed to:", boosterAddr);

    // 3) Authorize Booster as minter
    const tx = await arenaCards.setAuthorizedMinter(boosterAddr);
    await tx.wait();
    console.log("Authorized minter set to Booster:", boosterAddr);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArenaCards – Tests complets", function () {
  let ArenaCards, arena;
  let owner, player1;

  const URI1 = "ipfs://card1";
  const URI2 = "ipfs://card2";
  const URI3 = "ipfs://card3";

  beforeEach(async function () {
    [owner, player1] = await ethers.getSigners();

    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();
  });

  it("Should mint a card correctly", async function () {
    await arena.mintCard(URI1, "Guerrier", "Rare");

    expect(await arena.balanceOf(owner.address)).to.equal(1);

    const card = await arena.cardDetails(0);
    expect(card.level).to.equal(1);
    expect(card.name).to.equal("Guerrier");
    expect(card.rarity).to.equal("Rare");
  });

  it("Should not allow mint during cooldown", async function () {
    await arena.mintCard(URI1, "A", "Rare");

    await expect(
      arena.mintCard(URI2, "B", "Rare")
    ).to.be.revertedWith("Action on cooldown");
  });

  it("Should allow mint after cooldown", async function () {
    await arena.mintCard(URI1, "A", "Rare");

    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");

    await arena.mintCard(URI2, "B", "Rare");

    expect(await arena.balanceOf(owner.address)).to.equal(2);
  });

  it("Should not allow more than 4 cards", async function () {
    for (let i = 0; i < 4; i++) {
      await arena.mintCard(`ipfs://${i}`, `C${i}`, "Common");

      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
    }

    await expect(
      arena.mintCard("ipfs://5", "C5", "Common")
    ).to.be.revertedWith("Max cards reached");
  });

  it("Should lock card after mint", async function () {
    await arena.mintCard(URI1, "Locked", "Rare");

    await expect(
      arena.transferFrom(owner.address, player1.address, 0)
    ).to.be.revertedWith("Card locked");
  });

  it("Should allow transfer after lock time", async function () {
    await arena.mintCard(URI1, "Free", "Rare");

    await ethers.provider.send("evm_increaseTime", [600]);
    await ethers.provider.send("evm_mine");

    await arena.transferFrom(owner.address, player1.address, 0);

    expect(await arena.ownerOf(0)).to.equal(player1.address);
  });

  it("Should store previous owners", async function () {
    await arena.mintCard(URI1, "History", "Rare");

    await ethers.provider.send("evm_increaseTime", [600]);
    await ethers.provider.send("evm_mine");

    await arena.transferFrom(owner.address, player1.address, 0);

    const owners = await arena.getPreviousOwners(0);
    expect(owners[0]).to.equal(owner.address);
  });

  it("Should fuse two cards with same rarity", async function () {
    await arena.mintCard(URI1, "A", "Epic");

    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");

    await arena.mintCard(URI2, "B", "Epic");

    await ethers.provider.send("evm_increaseTime", [600]);
    await ethers.provider.send("evm_mine");

    await arena.fusecards(0, 1, URI3);

    expect(await arena.balanceOf(owner.address)).to.equal(1);

    const card = await arena.cardDetails(2);
    expect(card.level).to.equal(2);
    expect(card.rarity).to.equal("Epic");
  });

  it("Should reject fusion with different rarities", async function () {
    await arena.mintCard(URI1, "A", "Rare");

    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");

    await arena.mintCard(URI2, "B", "Common");

    await ethers.provider.send("evm_increaseTime", [600]);
    await ethers.provider.send("evm_mine");

    await expect(
      arena.fusecards(0, 1, URI3)
    ).to.be.revertedWith("Rarities must match");
  });

  it("Should not fuse same card", async function () {
    await arena.mintCard(URI1, "A", "Rare");

    await expect(
      arena.fusecards(0, 0, URI2)
    ).to.be.revertedWith("Cannot fuse same card");
  });
});

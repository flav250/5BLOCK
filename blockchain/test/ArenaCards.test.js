const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArenaCards – Tests complets", function () {
  let ArenaCards, arena;
  let owner, player1, player2, minter;

  const URI1 = "ipfs://card1";

  beforeEach(async function () {
    [owner, player1, player2, minter] = await ethers.getSigners();

    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await arena.name()).to.equal("Arena Cards");
      expect(await arena.symbol()).to.equal("ACARD");
    });

    it("Should set deployer as owner", async function () {
      expect(await arena.owner()).to.equal(owner.address);
    });

    it("Should initialize tokenCounter to 0", async function () {
      expect(await arena.tokenCounter()).to.equal(0);
    });

    it("Should have correct constants", async function () {
      expect(await arena.MAX_CARDS()).to.equal(30);
      expect(await arena.COOLDOWN()).to.equal(300); // 5 minutes
      expect(await arena.LOCK_TIME()).to.equal(600); // 10 minutes
    });
  });

  describe("Minting", function () {
    it("Should mint a card correctly", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      expect(await arena.balanceOf(owner.address)).to.equal(1);
      expect(await arena.ownerOf(0)).to.equal(owner.address);

      const card = await arena.cardDetails(0);
      expect(card.level).to.equal(1);
      expect(card.name).to.equal("Guerrier Brave");
      expect(card.rarity).to.equal("peu commune");
      expect(card.stats.attack).to.equal(55); // Base attack for "Guerrier Brave"
    });

    it("Should increment tokenCounter after mint", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");
      expect(await arena.tokenCounter()).to.equal(1);

      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await arena.mintCard(owner.address, "Archer Elfe", "rare");
      expect(await arena.tokenCounter()).to.equal(2);
    });

    it("Should emit CardMinted event", async function () {
      await expect(arena.mintCard(owner.address, "Dragon Dore", "legendaire"))
        .to.emit(arena, "CardMinted")
        .withArgs(0, owner.address, "Dragon Dore", "legendaire");
    });

    it("Should lock card after mint", async function () {
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");

      await expect(
        arena.transferFrom(owner.address, player1.address, 0)
      ).to.be.revertedWith("Card is temporarily locked");
    });

    it("Should emit CardLocked event on mint", async function () {
      const tx = await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(arena, "CardLocked")
        .withArgs(0, block.timestamp + 600);
    });

    it("Should not allow mint during cooldown", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      await expect(
        arena.mintCard(owner.address, "Archer Elfe", "rare")
      ).to.be.revertedWith("Action on cooldown");
    });

    it("Should allow mint after cooldown", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await arena.mintCard(owner.address, "Archer Elfe", "rare");

      expect(await arena.balanceOf(owner.address)).to.equal(2);
    });

    it("Should not allow more than MAX_CARDS (30)", async function () {
      // Mint 30 cards
      for (let i = 0; i < 30; i++) {
        await arena.mintCard(owner.address, "Gobelin Ruse", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      expect(await arena.balanceOf(owner.address)).to.equal(30);

      // Try to mint 31st card
      await expect(
        arena.mintCard(owner.address, "Gobelin Ruse", "commune")
      ).to.be.revertedWith("Max cards reached");
    });
  });

  describe("Authorized Minters", function () {
    it("Should allow owner to set authorized minter", async function () {
      await arena.setAuthorizedMinter(minter.address, true);
      expect(await arena.authorizedMinters(minter.address)).to.be.true;
    });

    it("Should not allow non-owner to set authorized minter", async function () {
      await expect(
        arena.connect(player1).setAuthorizedMinter(minter.address, true)
      ).to.be.revertedWithCustomError(arena, "OwnableUnauthorizedAccount");
    });

    it("Should allow authorized minter to mint without cooldown", async function () {
      await arena.setAuthorizedMinter(minter.address, true);

      // Mint first card
      await arena.connect(minter).mintCard(player1.address, "Guerrier Brave", "peu commune");
      
      // Mint second card immediately (no cooldown for authorized minters)
      await arena.connect(minter).mintCard(player1.address, "Archer Elfe", "rare");

      expect(await arena.balanceOf(player1.address)).to.equal(2);
    });

    it("Should allow owner to revoke minter authorization", async function () {
      await arena.setAuthorizedMinter(minter.address, true);
      expect(await arena.authorizedMinters(minter.address)).to.be.true;

      await arena.setAuthorizedMinter(minter.address, false);
      expect(await arena.authorizedMinters(minter.address)).to.be.false;
    });

    it("Should not allow unauthorized address to mint", async function () {
      await expect(
        arena.connect(player1).mintCard(player1.address, "Guerrier Brave", "peu commune")
      ).to.be.revertedWith("Not authorized to mint");
    });
  });

  describe("Card Stats System", function () {
    it("Should calculate attack correctly for level 1", async function () {
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      
      const card = await arena.cardDetails(0);
      expect(card.stats.attack).to.equal(150); // Base attack for Dragon Dore
    });

    it("Should return correct card stats via getCardStats", async function () {
      await arena.mintCard(owner.address, "Mage des Glaces", "epique");

      const [name, rarity, level, attack] = await arena.getCardStats(0);
      
      expect(name).to.equal("Mage des Glaces");
      expect(rarity).to.equal("epique");
      expect(level).to.equal(1);
      expect(attack).to.equal(90);
    });

    it("Should return correct base stats", async function () {
      const attack = await arena.getBaseStats("legendaire", "Phoenix Immortel");
      expect(attack).to.equal(140);
    });

    it("Should allow owner to modify base stats", async function () {
      await arena.setBaseStats("commune", "Gobelin Ruse", 50);
      
      const newAttack = await arena.getBaseStats("commune", "Gobelin Ruse");
      expect(newAttack).to.equal(50);
    });

    it("Should not allow non-owner to modify base stats", async function () {
      await expect(
        arena.connect(player1).setBaseStats("commune", "Gobelin Ruse", 50)
      ).to.be.revertedWithCustomError(arena, "OwnableUnauthorizedAccount");
    });

    it("Should have correct base stats for all rarities", async function () {
      // Legendaire
      expect(await arena.getBaseStats("legendaire", "Dragon Dore")).to.equal(150);
      expect(await arena.getBaseStats("legendaire", "Phoenix Immortel")).to.equal(140);

      // Epique
      expect(await arena.getBaseStats("epique", "Chevalier Noir")).to.equal(100);
      expect(await arena.getBaseStats("epique", "Mage des Glaces")).to.equal(90);

      // Rare
      expect(await arena.getBaseStats("rare", "Archer Elfe")).to.equal(75);
      expect(await arena.getBaseStats("rare", "Paladin Sacre")).to.equal(70);

      // Peu commune
      expect(await arena.getBaseStats("peu commune", "Guerrier Brave")).to.equal(55);
      expect(await arena.getBaseStats("peu commune", "Voleur Agile")).to.equal(50);

      // Commune
      expect(await arena.getBaseStats("commune", "Gobelin Ruse")).to.equal(45);
      expect(await arena.getBaseStats("commune", "Slime Gluant")).to.equal(30);
    });
  });

  describe("Token URI and Metadata", function () {
    it("Should generate valid tokenURI", async function () {
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      
      const uri = await arena.tokenURI(0);
      expect(uri).to.include("data:application/json;base64,");
    });

    it("Should revert tokenURI for non-existent token", async function () {
      await expect(arena.tokenURI(999)).to.be.revertedWith("Token does not exist");
    });

    it("Should return correct image URI", async function () {
      const imageURI = await arena.getImageURI("legendaire", "Dragon Dore");
      expect(imageURI).to.include("https://");
    });

    it("Should allow owner to set image URI", async function () {
      const newURI = "https://new-image-url.com/dragon.png";
      await arena.setImageURI("legendaire", "Dragon Dore", newURI);
      
      const imageURI = await arena.getImageURI("legendaire", "Dragon Dore");
      expect(imageURI).to.equal(newURI);
    });

    it("Should not allow non-owner to set image URI", async function () {
      await expect(
        arena.connect(player1).setImageURI("legendaire", "Dragon Dore", "https://test.com")
      ).to.be.revertedWithCustomError(arena, "OwnableUnauthorizedAccount");
    });
  });

  describe("Card Locking and Transfers", function () {
    it("Should allow transfer after lock time", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await arena.transferFrom(owner.address, player1.address, 0);

      expect(await arena.ownerOf(0)).to.equal(player1.address);
    });

    it("Should store previous owners", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await arena.transferFrom(owner.address, player1.address, 0);

      const owners = await arena.getPreviousOwners(0);
      expect(owners[0]).to.equal(owner.address);
    });

    it("Should store multiple previous owners", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // First transfer
      await arena.transferFrom(owner.address, player1.address, 0);

      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine");

      // Second transfer
      await arena.connect(player1).transferFrom(player1.address, player2.address, 0);

      const owners = await arena.getPreviousOwners(0);
      expect(owners.length).to.equal(2);
      expect(owners[0]).to.equal(owner.address);
      expect(owners[1]).to.equal(player1.address);
    });

    it("Should update lastTransferAt on transfer", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      const cardBefore = await arena.cardDetails(0);
      const lastTransferBefore = cardBefore.lastTransferAt;

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await arena.transferFrom(owner.address, player1.address, 0);

      const cardAfter = await arena.cardDetails(0);
      expect(cardAfter.lastTransferAt).to.be.greaterThan(lastTransferBefore);
    });
  });

  describe("Fusion Contract Integration", function () {
    it("Should allow owner to set fusion contract", async function () {
      await arena.setFusionContract(player1.address);
      expect(await arena.fusionContract()).to.equal(player1.address);
    });

    it("Should not allow non-owner to set fusion contract", async function () {
      await expect(
        arena.connect(player1).setFusionContract(player2.address)
      ).to.be.revertedWithCustomError(arena, "OwnableUnauthorizedAccount");
    });

    it("Should allow fusion contract to burn cards", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");
      await arena.setFusionContract(player1.address);

      await arena.connect(player1).burnFromFusion(0);

      await expect(arena.ownerOf(0)).to.be.revertedWithCustomError(arena, "ERC721NonexistentToken");
    });

    it("Should not allow non-fusion contract to burn", async function () {
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");
      await arena.setFusionContract(player1.address);

      await expect(
        arena.connect(player2).burnFromFusion(0)
      ).to.be.revertedWith("Not fusion contract");
    });

    it("Should allow fusion contract to mint with custom level", async function () {
      await arena.setFusionContract(player1.address);

      const tokenId = await arena.connect(player1).mintFusion.staticCall(
        owner.address,
        "Dragon Dore",
        "legendaire",
        3
      );

      await arena.connect(player1).mintFusion(
        owner.address,
        "Dragon Dore",
        "legendaire",
        3
      );

      const card = await arena.cardDetails(tokenId);
      expect(card.level).to.equal(3);
      expect(card.stats.attack).to.equal(150 * 3); // Base attack * level
      expect(await arena.ownerOf(tokenId)).to.equal(owner.address);
    });

    it("Should not allow non-fusion contract to mintFusion", async function () {
      await arena.setFusionContract(player1.address);

      await expect(
        arena.connect(player2).mintFusion(owner.address, "Dragon Dore", "legendaire", 2)
      ).to.be.revertedWith("Not fusion contract");
    });

    it("Should calculate attack correctly for higher levels", async function () {
      await arena.setFusionContract(owner.address);

      // Level 2
      await arena.mintFusion(owner.address, "Mage des Glaces", "epique", 2);
      let card = await arena.cardDetails(0);
      expect(card.stats.attack).to.equal(90 * 2);

      // Level 3
      await arena.mintFusion(owner.address, "Archer Elfe", "rare", 3);
      card = await arena.cardDetails(1);
      expect(card.stats.attack).to.equal(75 * 3);

      // Level 5
      await arena.mintFusion(owner.address, "Phoenix Immortel", "legendaire", 5);
      card = await arena.cardDetails(2);
      expect(card.stats.attack).to.equal(140 * 5);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle minting different rarities", async function () {
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await arena.mintCard(owner.address, "Chevalier Noir", "epique");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await arena.mintCard(owner.address, "Archer Elfe", "rare");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await arena.mintCard(owner.address, "Gobelin Ruse", "commune");

      expect(await arena.balanceOf(owner.address)).to.equal(5);
    });

    it("Should track createdAt timestamp", async function () {
      const tx = await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const card = await arena.cardDetails(0);
      expect(card.createdAt).to.equal(block.timestamp);
    });

    it("Should revert getCardStats for non-existent token", async function () {
      await expect(arena.getCardStats(999)).to.be.revertedWith("Token does not exist");
    });
  });
});

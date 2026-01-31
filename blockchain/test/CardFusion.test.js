const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CardFusion – Tests complets", function () {
  let ArenaCards, arena;
  let CardFusion, fusion;
  let owner, player1, player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy ArenaCards first
    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();

    // Deploy CardFusion
    CardFusion = await ethers.getContractFactory("CardFusion");
    fusion = await CardFusion.deploy(await arena.getAddress());
    await fusion.waitForDeployment();

    // Set fusion contract in ArenaCards
    await arena.setFusionContract(await fusion.getAddress());
  });

  describe("Deployment", function () {
    it("Should deploy with correct arena address", async function () {
      expect(await fusion.arena()).to.equal(await arena.getAddress());
    });

    it("Should have correct cooldown constant", async function () {
      expect(await fusion.COOLDOWN()).to.equal(300); // 5 minutes
    });

    it("Should initialize lastFusion to 0 for new users", async function () {
      expect(await fusion.lastFusion(owner.address)).to.equal(0);
    });
  });

  describe("Successful Fusion", function () {
    beforeEach(async function () {
      // Mint two identical cards for owner
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");

      // Wait for lock time to expire
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");
    });

    it("Should fuse two identical cards successfully", async function () {
      const balanceBefore = await arena.balanceOf(owner.address);
      
      await fusion.fuseCards(0, 1);

      const balanceAfter = await arena.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore - 1n); // 2 burned, 1 created = -1
    });

    it("Should create card with incremented level", async function () {
      await fusion.fuseCards(0, 1);

      const newTokenId = 2; // tokenIds 0 and 1 were burned, 2 is new
      const card = await arena.cardDetails(newTokenId);
      
      expect(card.level).to.equal(2);
      expect(card.name).to.equal("Dragon Dore");
      expect(card.rarity).to.equal("legendaire");
    });

    it("Should calculate attack correctly for fused card", async function () {
      await fusion.fuseCards(0, 1);

      const newTokenId = 2;
      const card = await arena.cardDetails(newTokenId);
      
      // Dragon Dore base attack is 150, level 2 should be 150 * 2 = 300
      expect(card.stats.attack).to.equal(300);
    });

    it("Should burn the two original cards", async function () {
      await fusion.fuseCards(0, 1);

      await expect(arena.ownerOf(0)).to.be.revertedWithCustomError(arena, "ERC721NonexistentToken");
      await expect(arena.ownerOf(1)).to.be.revertedWithCustomError(arena, "ERC721NonexistentToken");
    });

    it("Should emit CardsFused event", async function () {
      await expect(fusion.fuseCards(0, 1))
        .to.emit(fusion, "CardsFused")
        .withArgs(owner.address, 0, 1, 2, 2);
    });

    it("Should set lastFusion timestamp", async function () {
      const tx = await fusion.fuseCards(0, 1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      expect(await fusion.lastFusion(owner.address)).to.equal(block.timestamp);
    });

    it("Should return new token ID", async function () {
      const newTokenId = await fusion.fuseCards.staticCall(0, 1);
      expect(newTokenId).to.equal(2);
    });

    it("Should fuse cards of different rarities with same name and level", async function () {
      // Mint two Guerrier Brave (peu commune) cards
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");
      
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Guerrier Brave", "peu commune");

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await fusion.fuseCards(2, 3);

      const newTokenId = 4;
      const card = await arena.cardDetails(newTokenId);
      
      expect(card.level).to.equal(2);
      expect(card.name).to.equal("Guerrier Brave");
      expect(card.rarity).to.equal("peu commune");
    });
  });

  describe("Multi-level Fusion", function () {
    it("Should allow fusion up to level 5", async function () {
      // Create level 4 cards first
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Phoenix Immortel", "legendaire", 4);
      await arena.mintFusion(owner.address, "Phoenix Immortel", "legendaire", 4);
      
      // Reset fusion contract
      await arena.setFusionContract(await fusion.getAddress());

      // Fuse to level 5
      await fusion.fuseCards(0, 1);

      const newCard = await arena.cardDetails(2);
      expect(newCard.level).to.equal(5);
      expect(newCard.stats.attack).to.equal(140 * 5); // Phoenix base attack * 5
    });

    it("Should not allow fusion at level 5 (max level)", async function () {
      // Create level 5 cards
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Mage des Glaces", "epique", 5);
      await arena.mintFusion(owner.address, "Mage des Glaces", "epique", 5);
      
      await arena.setFusionContract(await fusion.getAddress());

      await expect(
        fusion.fuseCards(0, 1)
      ).to.be.revertedWith("Max level reached (5)");
    });

    it("Should correctly calculate attack for level 3 fusion", async function () {
      // Create level 2 cards
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Archer Elfe", "rare", 2);
      await arena.mintFusion(owner.address, "Archer Elfe", "rare", 2);
      
      await arena.setFusionContract(await fusion.getAddress());

      await fusion.fuseCards(0, 1);

      const newCard = await arena.cardDetails(2);
      expect(newCard.level).to.equal(3);
      expect(newCard.stats.attack).to.equal(75 * 3); // Archer Elfe base = 75
    });
  });

  describe("Fusion Cooldown", function () {
    beforeEach(async function () {
      // Mint all 4 cards upfront to avoid mintCard cooldown issues
      await arena.mintCard(owner.address, "Chevalier Noir", "epique");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Chevalier Noir", "epique");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Chevalier Noir", "epique");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Chevalier Noir", "epique");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");
    });

    it("Should not allow fusion during cooldown", async function () {
      // First fusion with cards 0 and 1
      await fusion.fuseCards(0, 1);

      // Try to immediately fuse cards 2 and 3 (should fail due to cooldown)
      await expect(
        fusion.fuseCards(2, 3)
      ).to.be.revertedWith("Fusion cooldown active");
    });

    it("Should allow fusion after cooldown expires", async function () {
      // First fusion with cards 0 and 1
      await fusion.fuseCards(0, 1);

      // Wait for cooldown
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      // Second fusion with cards 2 and 3 should succeed after cooldown
      await expect(fusion.fuseCards(2, 3)).to.not.be.reverted;
    });

    it("Should return correct time until next fusion", async function () {
      await fusion.fuseCards(0, 1);

      const timeRemaining = await fusion.getTimeUntilNextFusion(owner.address);
      expect(timeRemaining).to.be.closeTo(300, 5); // ~5 minutes, allow small variance
    });

    it("Should return 0 time remaining after cooldown", async function () {
      await fusion.fuseCards(0, 1);

      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      const timeRemaining = await fusion.getTimeUntilNextFusion(owner.address);
      expect(timeRemaining).to.equal(0);
    });

    it("Should return 0 time for user who never fused", async function () {
      const timeRemaining = await fusion.getTimeUntilNextFusion(player1.address);
      expect(timeRemaining).to.equal(0);
    });
  });

  describe("Error Cases", function () {
    beforeEach(async function () {
      // Mint test cards
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Phoenix Immortel", "legendaire");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Dragon Dore", "legendaire");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");
    });

    it("Should not allow fusing same card with itself", async function () {
      await expect(
        fusion.fuseCards(0, 0)
      ).to.be.revertedWith("Cannot fuse same card");
    });

    it("Should not allow fusing cards with different names", async function () {
      await expect(
        fusion.fuseCards(0, 1) // Dragon Dore vs Phoenix Immortel
      ).to.be.revertedWith("Cards must have same name");
    });

    it("Should not allow fusing cards with different rarities", async function () {
      // Create two cards with same name but different rarities using mintFusion
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Test Card", "legendaire", 1);
      await arena.mintFusion(owner.address, "Test Card", "epique", 1);
      await arena.setFusionContract(await fusion.getAddress());

      await expect(
        fusion.fuseCards(3, 4) // same name, same level, different rarity
      ).to.be.revertedWith("Cards must have same rarity");
    });

    it("Should not allow fusing cards with different levels", async function () {
      // Create a level 2 card
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Dragon Dore", "legendaire", 2);
      await arena.setFusionContract(await fusion.getAddress());

      await expect(
        fusion.fuseCards(0, 3) // level 1 vs level 2
      ).to.be.revertedWith("Cards must have same level");
    });

    it("Should not allow non-owner to fuse cards", async function () {
      await expect(
        fusion.connect(player1).fuseCards(0, 2)
      ).to.be.revertedWith("Not owner of card 1");
    });

    it("Should not allow fusing if user doesn't own second card", async function () {
      // Transfer card 2 to player1
      await arena.transferFrom(owner.address, player1.address, 2);

      await expect(
        fusion.fuseCards(0, 2)
      ).to.be.revertedWith("Not owner of card 2");
    });
  });

  describe("canFuseCards Function", function () {
    beforeEach(async function () {
      // Mint 4 test cards for owner (to test cooldown)
      await arena.mintCard(owner.address, "Paladin Sacre", "rare");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Paladin Sacre", "rare");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Paladin Sacre", "rare");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Paladin Sacre", "rare");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");
    });

    it("Should return true and 'Fusion possible' for valid fusion", async function () {
      const [canFuse, reason] = await fusion.canFuseCards(0, 1);
      expect(canFuse).to.be.true;
      expect(reason).to.equal("Fusion possible");
    });

    it("Should return false for same card fusion", async function () {
      const [canFuse, reason] = await fusion.canFuseCards(0, 0);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Cannot fuse same card");
    });

    it("Should return false during cooldown", async function () {
      // Fuse first two cards (0, 1) - creates token 4
      await fusion.fuseCards(0, 1);

      // Immediately check if we can fuse the remaining cards (2, 3)
      const [canFuse, reason] = await fusion.canFuseCards(2, 3);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Fusion cooldown active");
    });

    it("Should return false for non-owned cards", async function () {
      const [canFuse, reason] = await fusion.connect(player1).canFuseCards(0, 1);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Not owner of card 1");
    });

    it("Should return false for different card names", async function () {
      await arena.mintCard(owner.address, "Druide Ancien", "rare");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      const [canFuse, reason] = await fusion.canFuseCards(0, 4);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Cards must have same name");
    });

    it("Should return false for different rarities", async function () {
      // Create two cards with same name but different rarities
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Test Card", "legendaire", 1);
      await arena.mintFusion(owner.address, "Test Card", "epique", 1);
      await arena.setFusionContract(await fusion.getAddress());

      const [canFuse, reason] = await fusion.canFuseCards(4, 5);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Cards must have same rarity");
    });

    it("Should return false for different levels", async function () {
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Paladin Sacre", "rare", 2);
      await arena.setFusionContract(await fusion.getAddress());

      const [canFuse, reason] = await fusion.canFuseCards(0, 4);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Cards must have same level");
    });

    it("Should return false for max level cards", async function () {
      await arena.setFusionContract(owner.address);
      await arena.mintFusion(owner.address, "Paladin Sacre", "rare", 5);
      await arena.mintFusion(owner.address, "Paladin Sacre", "rare", 5);
      await arena.setFusionContract(await fusion.getAddress());

      const [canFuse, reason] = await fusion.canFuseCards(4, 5);
      expect(canFuse).to.be.false;
      expect(reason).to.equal("Max level reached (5)");
    });
  });

  describe("Multiple Users", function () {
    it("Should handle fusion cooldowns independently for different users", async function () {
      // Mint cards for owner
      await arena.mintCard(owner.address, "Assassin Fantome", "epique");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Assassin Fantome", "epique");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Mint cards for player1
      await arena.mintCard(player1.address, "Assassin Fantome", "epique");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(player1.address, "Assassin Fantome", "epique");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Owner fuses
      await fusion.fuseCards(0, 1);

      // Player1 should still be able to fuse (different cooldown)
      await expect(fusion.connect(player1).fuseCards(2, 3)).to.not.be.reverted;
    });

    it("Should track lastFusion separately for each user", async function () {
      // Mint and fuse for owner
      await arena.mintCard(owner.address, "Voleur Agile", "peu commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Voleur Agile", "peu commune");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await fusion.fuseCards(0, 1);

      const ownerLastFusion = await fusion.lastFusion(owner.address);
      const player1LastFusion = await fusion.lastFusion(player1.address);

      expect(ownerLastFusion).to.be.greaterThan(0);
      expect(player1LastFusion).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle fusion immediately after card unlock", async function () {
      await arena.mintCard(owner.address, "Pretre Sage", "peu commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Pretre Sage", "peu commune");

      // Wait exactly lock time (10 minutes)
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Should be able to fuse now
      await expect(fusion.fuseCards(0, 1)).to.not.be.reverted;
    });

    it("Should properly increment tokenCounter in ArenaCards", async function () {
      await arena.mintCard(owner.address, "Sorciere Noire", "commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Sorciere Noire", "commune");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      const counterBefore = await arena.tokenCounter();
      
      await fusion.fuseCards(0, 1);
      
      const counterAfter = await arena.tokenCounter();
      expect(counterAfter).to.equal(counterBefore + 1n);
    });

    it("Should handle fusion of common rarity cards", async function () {
      await arena.mintCard(owner.address, "Slime Gluant", "commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await arena.mintCard(owner.address, "Slime Gluant", "commune");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await fusion.fuseCards(0, 1);

      const newCard = await arena.cardDetails(2);
      expect(newCard.level).to.equal(2);
      expect(newCard.rarity).to.equal("commune");
      expect(newCard.stats.attack).to.equal(30 * 2); // Slime base = 30
    });
  });
});

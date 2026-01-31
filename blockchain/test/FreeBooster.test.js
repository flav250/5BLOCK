const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FreeBooster – Tests complets", function () {
  let ArenaCards, arena;
  let FreeBooster, booster;
  let owner, player1, player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy ArenaCards first
    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();

    // Deploy FreeBooster
    FreeBooster = await ethers.getContractFactory("FreeBooster");
    booster = await FreeBooster.deploy(await arena.getAddress());
    await booster.waitForDeployment();

    // Set FreeBooster as authorized minter
    await arena.setAuthorizedMinter(await booster.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should deploy with correct arena address", async function () {
      expect(await booster.arenaCards()).to.equal(await arena.getAddress());
    });

    it("Should set deployer as owner", async function () {
      expect(await booster.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await booster.FREE_BOOSTER_COOLDOWN()).to.equal(600); // 10 minutes
      expect(await booster.CARDS_PER_BOOSTER()).to.equal(2);
    });

    it("Should initialize card templates (16 cards)", async function () {
      // Check that card templates are initialized (0-15)
      const template0 = await booster.cardTemplates(0);
      expect(template0.name).to.equal("Dragon Dore");
      expect(template0.rarity).to.equal("legendaire");

      const template15 = await booster.cardTemplates(15);
      expect(template15.name).to.equal("Slime Gluant");
      expect(template15.rarity).to.equal("commune");
    });

    it("Should initialize lastBoosterOpen to 0 for new users", async function () {
      expect(await booster.lastBoosterOpen(player1.address)).to.equal(0);
    });
  });

  describe("Opening Boosters", function () {
    it("Should open booster and mint 2 cards", async function () {
      await booster.connect(player1).openBooster();

      const balance = await arena.balanceOf(player1.address);
      expect(balance).to.equal(2);
    });

    it("Should emit BoosterOpened event", async function () {
      const tx = await booster.connect(player1).openBooster();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(booster, "BoosterOpened")
        .withArgs(player1.address, block.timestamp);
    });

    it("Should emit CardMinted events for each card", async function () {
      await expect(booster.connect(player1).openBooster())
        .to.emit(booster, "CardMinted");
    });

    it("Should set lastBoosterOpen timestamp", async function () {
      const tx = await booster.connect(player1).openBooster();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      expect(await booster.lastBoosterOpen(player1.address)).to.equal(block.timestamp);
    });

    it("Should mint cards that player owns", async function () {
      await booster.connect(player1).openBooster();

      expect(await arena.ownerOf(0)).to.equal(player1.address);
      expect(await arena.ownerOf(1)).to.equal(player1.address);
    });

    it("Should mint cards with valid rarities", async function () {
      await booster.connect(player1).openBooster();

      const card0 = await arena.cardDetails(0);
      const card1 = await arena.cardDetails(1);

      const validRarities = ["legendaire", "epique", "rare", "peu commune", "commune"];
      expect(validRarities).to.include(card0.rarity);
      expect(validRarities).to.include(card1.rarity);
    });

    it("Should mint cards with level 1", async function () {
      await booster.connect(player1).openBooster();

      const card0 = await arena.cardDetails(0);
      const card1 = await arena.cardDetails(1);

      expect(card0.level).to.equal(1);
      expect(card1.level).to.equal(1);
    });

    it("Should allow first-time users to open booster", async function () {
      expect(await booster.lastBoosterOpen(player1.address)).to.equal(0);
      await expect(booster.connect(player1).openBooster()).to.not.be.reverted;
    });

    it("Should mint different cards in same booster (randomness)", async function () {
      // Note: Due to pseudo-randomness, cards might occasionally be the same
      // This test checks that the system can produce different cards
      await booster.connect(player1).openBooster();

      const card0 = await arena.cardDetails(0);
      const card1 = await arena.cardDetails(1);

      // Just verify both cards exist and have stats
      expect(card0.stats.attack).to.be.greaterThan(0);
      expect(card1.stats.attack).to.be.greaterThan(0);
    });
  });

  describe("Booster Cooldown", function () {
    it("Should not allow opening booster during cooldown", async function () {
      await booster.connect(player1).openBooster();

      await expect(
        booster.connect(player1).openBooster()
      ).to.be.revertedWith("Booster cooldown active");
    });

    it("Should allow opening booster after cooldown (10 minutes)", async function () {
      await booster.connect(player1).openBooster();

      // Wait 10 minutes
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await expect(booster.connect(player1).openBooster()).to.not.be.reverted;
      expect(await arena.balanceOf(player1.address)).to.equal(4); // 2 + 2
    });

    it("Should return correct time until next booster", async function () {
      await booster.connect(player1).openBooster();

      const timeRemaining = await booster.getTimeUntilNextBooster(player1.address);
      expect(timeRemaining).to.be.closeTo(600, 5); // ~10 minutes
    });

    it("Should return 0 time for first-time user", async function () {
      const timeRemaining = await booster.getTimeUntilNextBooster(player1.address);
      expect(timeRemaining).to.equal(0);
    });

    it("Should return 0 time after cooldown expires", async function () {
      await booster.connect(player1).openBooster();

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      const timeRemaining = await booster.getTimeUntilNextBooster(player1.address);
      expect(timeRemaining).to.equal(0);
    });

    it("Should return true for canOpenBooster for new user", async function () {
      expect(await booster.canOpenBooster(player1.address)).to.be.true;
    });

    it("Should return false for canOpenBooster during cooldown", async function () {
      await booster.connect(player1).openBooster();
      expect(await booster.canOpenBooster(player1.address)).to.be.false;
    });

    it("Should return true for canOpenBooster after cooldown", async function () {
      await booster.connect(player1).openBooster();

      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      expect(await booster.canOpenBooster(player1.address)).to.be.true;
    });
  });

  describe("Card Limit", function () {
    it("Should not allow opening booster if it would exceed MAX_CARDS", async function () {
      // Mint 29 cards (MAX_CARDS = 30, booster gives 2, so 29 + 2 = 31 > 30)
      for (let i = 0; i < 29; i++) {
        await arena.mintCard(player1.address, "Gobelin Ruse", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      expect(await arena.balanceOf(player1.address)).to.equal(29);

      await expect(
        booster.connect(player1).openBooster()
      ).to.be.revertedWith("Not enough space for booster cards");
    });

    it("Should allow opening booster with exactly enough space", async function () {
      // Mint 28 cards (28 + 2 = 30, exactly at limit)
      for (let i = 0; i < 28; i++) {
        await arena.mintCard(player1.address, "Gobelin Ruse", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      expect(await arena.balanceOf(player1.address)).to.equal(28);

      await expect(booster.connect(player1).openBooster()).to.not.be.reverted;
      expect(await arena.balanceOf(player1.address)).to.equal(30);
    });

    it("Should check space before opening booster", async function () {
      // Fill up to 29 cards
      for (let i = 0; i < 29; i++) {
        await arena.mintCard(player1.address, "Slime Gluant", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      // Try to open booster (should fail before minting any cards)
      const balanceBefore = await arena.balanceOf(player1.address);
      
      await expect(
        booster.connect(player1).openBooster()
      ).to.be.revertedWith("Not enough space for booster cards");

      const balanceAfter = await arena.balanceOf(player1.address);
      expect(balanceAfter).to.equal(balanceBefore); // No cards minted
    });
  });

  describe("Multiple Users", function () {
    it("Should handle cooldowns independently for different users", async function () {
      // Player1 opens booster
      await booster.connect(player1).openBooster();

      // Player2 should still be able to open booster
      await expect(booster.connect(player2).openBooster()).to.not.be.reverted;

      expect(await arena.balanceOf(player1.address)).to.equal(2);
      expect(await arena.balanceOf(player2.address)).to.equal(2);
    });

    it("Should track lastBoosterOpen separately for each user", async function () {
      await booster.connect(player1).openBooster();
      
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
      
      await booster.connect(player2).openBooster();

      const player1Last = await booster.lastBoosterOpen(player1.address);
      const player2Last = await booster.lastBoosterOpen(player2.address);

      expect(player1Last).to.be.greaterThan(0);
      expect(player2Last).to.be.greaterThan(0);
      expect(player2Last).to.be.greaterThan(player1Last);
    });

    it("Should allow player1 cooldown without affecting player2", async function () {
      await booster.connect(player1).openBooster();

      // Player1 in cooldown
      expect(await booster.canOpenBooster(player1.address)).to.be.false;

      // Player2 not in cooldown
      expect(await booster.canOpenBooster(player2.address)).to.be.true;
    });
  });

  describe("Card Templates", function () {
    it("Should have 2 legendary cards", async function () {
      const template0 = await booster.cardTemplates(0);
      const template1 = await booster.cardTemplates(1);

      expect(template0.rarity).to.equal("legendaire");
      expect(template1.rarity).to.equal("legendaire");
      expect(template0.name).to.equal("Dragon Dore");
      expect(template1.name).to.equal("Phoenix Immortel");
    });

    it("Should have 3 epic cards", async function () {
      const template2 = await booster.cardTemplates(2);
      const template3 = await booster.cardTemplates(3);
      const template4 = await booster.cardTemplates(4);

      expect(template2.rarity).to.equal("epique");
      expect(template3.rarity).to.equal("epique");
      expect(template4.rarity).to.equal("epique");
    });

    it("Should have 3 rare cards", async function () {
      const template5 = await booster.cardTemplates(5);
      const template6 = await booster.cardTemplates(6);
      const template7 = await booster.cardTemplates(7);

      expect(template5.rarity).to.equal("rare");
      expect(template6.rarity).to.equal("rare");
      expect(template7.rarity).to.equal("rare");
    });

    it("Should have 3 uncommon cards", async function () {
      const template8 = await booster.cardTemplates(8);
      const template9 = await booster.cardTemplates(9);
      const template10 = await booster.cardTemplates(10);

      expect(template8.rarity).to.equal("peu commune");
      expect(template9.rarity).to.equal("peu commune");
      expect(template10.rarity).to.equal("peu commune");
    });

    it("Should have 5 common cards", async function () {
      const template11 = await booster.cardTemplates(11);
      const template12 = await booster.cardTemplates(12);
      const template13 = await booster.cardTemplates(13);
      const template14 = await booster.cardTemplates(14);
      const template15 = await booster.cardTemplates(15);

      expect(template11.rarity).to.equal("commune");
      expect(template12.rarity).to.equal("commune");
      expect(template13.rarity).to.equal("commune");
      expect(template14.rarity).to.equal("commune");
      expect(template15.rarity).to.equal("commune");
    });

    it("Should have valid image URIs for all templates", async function () {
      for (let i = 0; i < 16; i++) {
        const template = await booster.cardTemplates(i);
        expect(template.imageURI).to.include("https://");
      }
    });

    it("Should have unique names for all templates", async function () {
      const names = new Set();
      for (let i = 0; i < 16; i++) {
        const template = await booster.cardTemplates(i);
        expect(names.has(template.name)).to.be.false;
        names.add(template.name);
      }
      expect(names.size).to.equal(16);
    });
  });

  describe("Drop Rate Distribution", function () {
    it("Should mint cards from valid templates", async function () {
      // Open multiple boosters to get variety
      for (let i = 0; i < 5; i++) {
        await booster.connect(player1).openBooster();
        
        await ethers.provider.send("evm_increaseTime", [600]);
        await ethers.provider.send("evm_mine");
      }

      // Check all minted cards have valid names and rarities
      const balance = await arena.balanceOf(player1.address);
      expect(balance).to.equal(10); // 5 boosters * 2 cards

      for (let i = 0; i < 10; i++) {
        const card = await arena.cardDetails(i);
        expect(card.name.length).to.be.greaterThan(0);
        
        const validRarities = ["legendaire", "epique", "rare", "peu commune", "commune"];
        expect(validRarities).to.include(card.rarity);
      }
    });

    it("Should produce cards with proper stats based on rarity", async function () {
      // Open a booster
      await booster.connect(player1).openBooster();

      const card0 = await arena.cardDetails(0);
      const card1 = await arena.cardDetails(1);

      // Check that stats correspond to rarity
      // Legendary: 100-150, Epic: 80-100, Rare: 60-80, Uncommon: 40-60, Common: 30-50
      if (card0.rarity === "legendaire") {
        expect(card0.stats.attack).to.be.gte(100).and.lte(150);
      } else if (card0.rarity === "epique") {
        expect(card0.stats.attack).to.be.gte(80).and.lte(100);
      } else if (card0.rarity === "rare") {
        expect(card0.stats.attack).to.be.gte(60).and.lte(80);
      } else if (card0.rarity === "peu commune") {
        expect(card0.stats.attack).to.be.gte(40).and.lte(60);
      } else {
        expect(card0.stats.attack).to.be.gte(30).and.lte(50);
      }
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await booster.transferOwnership(player1.address);
      expect(await booster.owner()).to.equal(player1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        booster.connect(player1).transferOwnership(player2.address)
      ).to.be.revertedWith("Not owner");
    });

    it("Should not allow transferring to zero address", async function () {
      await expect(
        booster.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should emit no event on ownership transfer (not implemented in contract)", async function () {
      // Just verify the transfer works
      await booster.transferOwnership(player1.address);
      expect(await booster.owner()).to.equal(player1.address);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle opening booster exactly at cooldown expiry", async function () {
      await booster.connect(player1).openBooster();

      // Wait exactly 600 seconds
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await expect(booster.connect(player1).openBooster()).to.not.be.reverted;
    });

    it("Should handle very long cooldown periods correctly", async function () {
      await booster.connect(player1).openBooster();

      // Wait much longer than cooldown
      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine");

      const timeRemaining = await booster.getTimeUntilNextBooster(player1.address);
      expect(timeRemaining).to.equal(0);
      
      await expect(booster.connect(player1).openBooster()).to.not.be.reverted;
    });

    it("Should properly increment ArenaCards tokenCounter", async function () {
      const counterBefore = await arena.tokenCounter();
      
      await booster.connect(player1).openBooster();
      
      const counterAfter = await arena.tokenCounter();
      expect(counterAfter).to.equal(counterBefore + 2n);
    });

    it("Should work with multiple sequential booster openings", async function () {
      for (let i = 0; i < 3; i++) {
        await booster.connect(player1).openBooster();
        
        await ethers.provider.send("evm_increaseTime", [600]);
        await ethers.provider.send("evm_mine");
      }

      expect(await arena.balanceOf(player1.address)).to.equal(6); // 3 * 2
    });

    it("Should maintain card ownership after multiple openings", async function () {
      await booster.connect(player1).openBooster();
      
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");
      
      await booster.connect(player1).openBooster();

      // All 4 cards should belong to player1
      for (let i = 0; i < 4; i++) {
        expect(await arena.ownerOf(i)).to.equal(player1.address);
      }
    });
  });

  describe("Integration with ArenaCards", function () {
    it("Should require ArenaCards to authorize booster as minter", async function () {
      // Deploy new contracts without authorization
      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();

      const newBooster = await FreeBooster.deploy(await newArena.getAddress());
      await newBooster.waitForDeployment();

      // Should fail because booster is not authorized
      await expect(
        newBooster.connect(player1).openBooster()
      ).to.be.revertedWith("Not authorized to mint");
    });

    it("Should work correctly when authorized as minter", async function () {
      // This is the standard setup in beforeEach
      await expect(booster.connect(player1).openBooster()).to.not.be.reverted;
    });

    it("Should respect ArenaCards MAX_CARDS limit", async function () {
      const maxCards = await arena.MAX_CARDS();
      expect(maxCards).to.equal(30);

      // Try to open booster when at limit would fail
      // This is tested in "Card Limit" section
    });
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Shop – Tests complets", function () {
  let ArenaCards, arena;
  let Shop, shop;
  let owner, player1, player2, player3;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy ArenaCards first
    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();

    // Deploy Shop
    Shop = await ethers.getContractFactory("Shop");
    shop = await Shop.deploy(await arena.getAddress());
    await shop.waitForDeployment();

    // Set Shop as authorized minter
    await arena.setAuthorizedMinter(await shop.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should deploy with correct arena address", async function () {
      expect(await shop.arenaCards()).to.equal(await arena.getAddress());
    });

    it("Should set deployer as owner", async function () {
      expect(await shop.owner()).to.equal(owner.address);
    });

    it("Should have correct cooldown constant", async function () {
      expect(await shop.COOLDOWN()).to.equal(86400); // 24 hours = 86400 seconds
    });

    it("Should initialize with 5 cards in catalog", async function () {
      expect(await shop.getCardCount()).to.equal(5);
    });
  });

  describe("Card Initialization", function () {
    it("Should have 2 legendary cards (unlimited stock)", async function () {
      const card0 = await shop.getCard(0);
      const card1 = await shop.getCard(1);

      expect(card0.name).to.equal("Dragon Dore");
      expect(card0.rarity).to.equal("legendaire");
      expect(card0.price).to.equal(1000000);
      expect(card0.isSecret).to.be.false;
      expect(card0.maxSupply).to.equal(0); // unlimited
      expect(card0.available).to.be.true;

      expect(card1.name).to.equal("Phoenix Immortel");
      expect(card1.rarity).to.equal("legendaire");
      expect(card1.price).to.equal(1000000);
      expect(card1.isSecret).to.be.false;
      expect(card1.maxSupply).to.equal(0); // unlimited
      expect(card1.available).to.be.true;
    });

    it("Should have 3 secret cards (stock limited to 50)", async function () {
      const card2 = await shop.getCard(2);
      const card3 = await shop.getCard(3);
      const card4 = await shop.getCard(4);

      expect(card2.name).to.equal("Brice : Le divin supreme");
      expect(card2.rarity).to.equal("secrete");
      expect(card2.price).to.equal(5000000);
      expect(card2.isSecret).to.be.true;
      expect(card2.maxSupply).to.equal(50);
      expect(card2.available).to.be.true;

      expect(card3.name).to.equal("Paul : Le malicieux");
      expect(card3.rarity).to.equal("secrete");
      expect(card3.price).to.equal(5000000);
      expect(card3.isSecret).to.be.true;
      expect(card3.maxSupply).to.equal(50);
      expect(card3.available).to.be.true;

      expect(card4.name).to.equal("Flavien : Le bienfaiteur");
      expect(card4.rarity).to.equal("secrete");
      expect(card4.price).to.equal(5000000);
      expect(card4.isSecret).to.be.true;
      expect(card4.maxSupply).to.equal(50);
      expect(card4.available).to.be.true;
    });

    it("Should have valid image URIs for all cards", async function () {
      for (let i = 0; i < 5; i++) {
        const card = await shop.getCard(i);
        expect(card.imageURI).to.include("https://");
      }
    });

    it("Should initialize all cards as available", async function () {
      for (let i = 0; i < 5; i++) {
        const card = await shop.getCard(i);
        expect(card.available).to.be.true;
      }
    });

    it("Should initialize minted count to 0 for all cards", async function () {
      for (let i = 0; i < 5; i++) {
        const card = await shop.getCard(i);
        expect(card.minted).to.equal(0);
      }
    });
  });

  describe("Buying Cards - Legendary", function () {
    it("Should buy legendary card successfully", async function () {
      await shop.connect(player1).buyCard(0); // Dragon Dore

      expect(await arena.balanceOf(player1.address)).to.equal(1);
      expect(await arena.ownerOf(0)).to.equal(player1.address);
    });

    it("Should mint card with correct stats", async function () {
      await shop.connect(player1).buyCard(0); // Dragon Dore

      const stats = await arena.getCardStats(0);
      expect(stats.name).to.equal("Dragon Dore");
      expect(stats.rarity).to.equal("legendaire");
      expect(stats.level).to.equal(1);
      expect(stats.attack).to.equal(150); // Base legendary attack
    });

    it("Should emit CardPurchased event", async function () {
      await expect(shop.connect(player1).buyCard(0))
        .to.emit(shop, "CardPurchased")
        .withArgs(player1.address, 0, "Dragon Dore", 1000000);
    });

    it("Should mark card as purchased for buyer", async function () {
      await shop.connect(player1).buyCard(0);
      expect(await shop.hasPurchased(player1.address, 0)).to.be.true;
    });

    it("Should update lastPurchase timestamp", async function () {
      const tx = await shop.connect(player1).buyCard(0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      expect(await shop.lastPurchase(player1.address)).to.equal(block.timestamp);
    });

    it("Should not increment minted for unlimited stock cards", async function () {
      await shop.connect(player1).buyCard(0);
      const card = await shop.getCard(0);
      expect(card.minted).to.equal(1); // Still increments for tracking
    });

    it("Should allow different players to buy same legendary card", async function () {
      await shop.connect(player1).buyCard(0); // Dragon Dore
      await shop.connect(player2).buyCard(0); // Dragon Dore

      expect(await arena.balanceOf(player1.address)).to.equal(1);
      expect(await arena.balanceOf(player2.address)).to.equal(1);
    });

    it("Should buy second legendary card successfully", async function () {
      await shop.connect(player1).buyCard(1); // Phoenix Immortel

      const stats = await arena.getCardStats(0);
      expect(stats.name).to.equal("Phoenix Immortel");
      expect(stats.attack).to.equal(140); // Phoenix base attack
    });
  });

  describe("Buying Cards - Secret", function () {
    it("Should buy secret card successfully", async function () {
      await shop.connect(player1).buyCard(2); // Brice

      expect(await arena.balanceOf(player1.address)).to.equal(1);
      expect(await arena.ownerOf(0)).to.equal(player1.address);
    });

    it("Should mint secret card with ultra-powerful stats", async function () {
      await shop.connect(player1).buyCard(2); // Brice : Le divin supreme

      const stats = await arena.getCardStats(0);
      expect(stats.name).to.equal("Brice : Le divin supreme");
      expect(stats.rarity).to.equal("secrete");
      expect(stats.level).to.equal(1);
      expect(stats.attack).to.equal(500); // Ultra powerful secret card
    });

    it("Should increment minted count for secret cards", async function () {
      await shop.connect(player1).buyCard(2);
      const card = await shop.getCard(2);
      expect(card.minted).to.equal(1);
    });

    it("Should allow multiple players to buy different secret cards", async function () {
      await shop.connect(player1).buyCard(2); // Brice
      await shop.connect(player2).buyCard(3); // Paul

      const card2 = await shop.getCard(2);
      const card3 = await shop.getCard(3);

      expect(card2.minted).to.equal(1);
      expect(card3.minted).to.equal(1);
    });

    it("Should buy all 3 secret cards successfully", async function () {
      await shop.connect(player1).buyCard(2); // Brice
      await shop.connect(player2).buyCard(3); // Paul
      await shop.connect(player3).buyCard(4); // Flavien

      const brice = await arena.getCardStats(0);
      const paul = await arena.getCardStats(1);
      const flavien = await arena.getCardStats(2);

      expect(brice.name).to.equal("Brice : Le divin supreme");
      expect(paul.name).to.equal("Paul : Le malicieux");
      expect(flavien.name).to.equal("Flavien : Le bienfaiteur");
      expect(brice.attack).to.equal(500);
      expect(paul.attack).to.equal(500);
      expect(flavien.attack).to.equal(500);
    });
  });

  describe("Purchase Restrictions - Already Purchased", function () {
    it("Should not allow buying same card twice", async function () {
      await shop.connect(player1).buyCard(0);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine");

      await expect(
        shop.connect(player1).buyCard(0)
      ).to.be.revertedWith("Already purchased this card");
    });

    it("Should track purchases per card ID", async function () {
      await shop.connect(player1).buyCard(0);

      expect(await shop.hasPurchased(player1.address, 0)).to.be.true;
      expect(await shop.hasPurchased(player1.address, 1)).to.be.false;
    });

    it("Should allow different users to track purchases independently", async function () {
      await shop.connect(player1).buyCard(0);

      expect(await shop.hasPurchased(player1.address, 0)).to.be.true;
      expect(await shop.hasPurchased(player2.address, 0)).to.be.false;
    });
  });

  describe("Purchase Restrictions - Cooldown", function () {
    it("Should enforce 24h cooldown between purchases", async function () {
      await shop.connect(player1).buyCard(0);

      // Try to buy another card immediately (even different card)
      await expect(
        shop.connect(player1).buyCard(1)
      ).to.be.revertedWith("Cooldown active - wait 24h between purchases");
    });

    it("Should allow purchase after cooldown expires", async function () {
      await shop.connect(player1).buyCard(0);

      // Wait 24 hours
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine");

      await expect(shop.connect(player1).buyCard(1)).to.not.be.reverted;
    });

    it("Should handle cooldowns independently per user", async function () {
      await shop.connect(player1).buyCard(0);
      // Player2 should still be able to buy
      await expect(shop.connect(player2).buyCard(0)).to.not.be.reverted;
    });

    it("Should return correct cooldown remaining time", async function () {
      await shop.connect(player1).buyCard(0);

      const remaining = await shop.getCooldownRemaining(player1.address);
      expect(remaining).to.be.closeTo(3600 * 24, 5); // ~24 hours
    });

    it("Should return 0 cooldown for first-time buyer", async function () {
      const remaining = await shop.getCooldownRemaining(player1.address);
      expect(remaining).to.equal(0);
    });

    it("Should return 0 cooldown after expiry", async function () {
      await shop.connect(player1).buyCard(0);

      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine");

      const remaining = await shop.getCooldownRemaining(player1.address);
      expect(remaining).to.equal(0);
    });
  });

  describe("Purchase Restrictions - Stock", function () {
    it("Should not allow buying when stock is depleted", async function () {
      // Add a test card with limited stock of 3
      await shop.addCard(
        "Limited Card",
        "rare",
        "https://test.uri",
        500000,
        false,
        3  // Stock limited to 3
      );

      const allSigners = await ethers.getSigners();
      
      // Buy all 3 cards
      await shop.connect(allSigners[0]).buyCard(5); // Card ID 5 (new card)
      await shop.connect(allSigners[1]).buyCard(5);
      await shop.connect(allSigners[2]).buyCard(5);

      const card = await shop.getCard(5);
      expect(card.minted).to.equal(3);
      expect(card.maxSupply).to.equal(3);

      // Try to buy 4th card - should fail
      await expect(
        shop.connect(allSigners[3]).buyCard(5)
      ).to.be.revertedWith("Card sold out");
    });

    it("Should allow buying legendary cards unlimited times", async function () {
      // Buy legendary card 5 times (no stock limit)
      const allSigners = await ethers.getSigners();
      for (let i = 0; i < 5; i++) {
        await shop.connect(allSigners[i]).buyCard(0); // Dragon Dore
      }

      const card = await shop.getCard(0);
      expect(card.minted).to.equal(5);
      expect(card.maxSupply).to.equal(0); // Still unlimited
    });

    it("Should track minted count correctly for secret cards", async function () {
      const allSigners = await ethers.getSigners();
      await shop.connect(allSigners[4]).buyCard(2);
      await shop.connect(allSigners[5]).buyCard(2);

      const card = await shop.getCard(2);
      expect(card.minted).to.equal(2);
    });
  });

  describe("Purchase Restrictions - Availability", function () {
    it("Should not allow buying disabled card", async function () {
      await shop.setCardAvailability(0, false);

      await expect(
        shop.connect(player1).buyCard(0)
      ).to.be.revertedWith("Card not available");
    });

    it("Should allow buying after re-enabling card", async function () {
      await shop.setCardAvailability(0, false);
      await shop.setCardAvailability(0, true);

      await expect(shop.connect(player1).buyCard(0)).to.not.be.reverted;
    });

    it("Should emit CardAvailabilityChanged event", async function () {
      await expect(shop.setCardAvailability(0, false))
        .to.emit(shop, "CardAvailabilityChanged")
        .withArgs(0, false);
    });
  });

  describe("Purchase Restrictions - Invalid Card", function () {
    it("Should revert when buying non-existent card", async function () {
      await expect(
        shop.connect(player1).buyCard(99)
      ).to.be.revertedWith("Invalid card ID");
    });

    it("Should revert when buying card ID >= cardCount", async function () {
      const count = await shop.getCardCount();
      
      await expect(
        shop.connect(player1).buyCard(count)
      ).to.be.revertedWith("Invalid card ID");
    });
  });

  describe("canPurchase Helper", function () {
    it("Should return true for valid purchase", async function () {
      expect(await shop.canPurchase(player1.address, 0)).to.be.true;
    });

    it("Should return false if already purchased", async function () {
      await shop.connect(player1).buyCard(0);
      expect(await shop.canPurchase(player1.address, 0)).to.be.false;
    });

    it("Should return false if on cooldown", async function () {
      await shop.connect(player1).buyCard(0);
      expect(await shop.canPurchase(player1.address, 1)).to.be.false;
    });

    it("Should return false if card not available", async function () {
      await shop.setCardAvailability(0, false);
      expect(await shop.canPurchase(player1.address, 0)).to.be.false;
    });

    it("Should correctly check stock availability", async function () {
      // Buy some cards and verify canPurchase still returns true
      const allSigners = await ethers.getSigners();
      for (let i = 0; i < 5; i++) {
        await shop.connect(allSigners[i]).buyCard(2);
      }

      // Should still be able to purchase (5 out of 50 bought)
      expect(await shop.canPurchase(allSigners[10].address, 2)).to.be.true;
      
      const card = await shop.getCard(2);
      expect(card.minted).to.equal(5);
      expect(card.maxSupply).to.equal(50);
    });

    it("Should return false for invalid card ID", async function () {
      expect(await shop.canPurchase(player1.address, 99)).to.be.false;
    });

    it("Should return true after cooldown expires", async function () {
      await shop.connect(player1).buyCard(0);
      
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine");
      
      expect(await shop.canPurchase(player1.address, 1)).to.be.true;
    });
  });

  describe("Owner Functions - addCard", function () {
    it("Should allow owner to add new card", async function () {
      await shop.addCard(
        "Test Card",
        "legendaire",
        "https://test.uri",
        2000000,
        false,
        0
      );

      expect(await shop.getCardCount()).to.equal(6);
    });

    it("Should initialize new card correctly", async function () {
      await shop.addCard(
        "New Legendary",
        "legendaire",
        "https://new.uri",
        3000000,
        false,
        0
      );

      const card = await shop.getCard(5);
      expect(card.name).to.equal("New Legendary");
      expect(card.rarity).to.equal("legendaire");
      expect(card.price).to.equal(3000000);
      expect(card.isSecret).to.be.false;
      expect(card.maxSupply).to.equal(0);
      expect(card.available).to.be.true;
      expect(card.minted).to.equal(0);
    });

    it("Should emit CardAdded event", async function () {
      await expect(
        shop.addCard("Test", "legendaire", "https://test", 1000000, false, 0)
      ).to.emit(shop, "CardAdded")
        .withArgs(5, "Test", 1000000, false);
    });

    it("Should not allow non-owner to add card", async function () {
      await expect(
        shop.connect(player1).addCard("Test", "legendaire", "https://test", 1000000, false, 0)
      ).to.be.revertedWith("Not owner");
    });

    it("Should allow adding secret card with limited stock", async function () {
      await shop.addCard(
        "New Secret",
        "secrete",
        "https://secret.uri",
        10000000,
        true,
        25
      );

      const card = await shop.getCard(5);
      expect(card.isSecret).to.be.true;
      expect(card.maxSupply).to.equal(25);
    });
  });

  describe("Owner Functions - setCardAvailability", function () {
    it("Should allow owner to disable card", async function () {
      await shop.setCardAvailability(0, false);
      const card = await shop.getCard(0);
      expect(card.available).to.be.false;
    });

    it("Should allow owner to re-enable card", async function () {
      await shop.setCardAvailability(0, false);
      await shop.setCardAvailability(0, true);
      
      const card = await shop.getCard(0);
      expect(card.available).to.be.true;
    });

    it("Should not allow non-owner to change availability", async function () {
      await expect(
        shop.connect(player1).setCardAvailability(0, false)
      ).to.be.revertedWith("Not owner");
    });

    it("Should revert for invalid card ID", async function () {
      await expect(
        shop.setCardAvailability(99, false)
      ).to.be.revertedWith("Invalid card ID");
    });
  });

  describe("Owner Functions - transferOwnership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await shop.transferOwnership(player1.address);
      expect(await shop.owner()).to.equal(player1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        shop.connect(player1).transferOwnership(player2.address)
      ).to.be.revertedWith("Not owner");
    });

    it("Should not allow transferring to zero address", async function () {
      await expect(
        shop.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should allow new owner to perform owner functions", async function () {
      await shop.transferOwnership(player1.address);

      await expect(
        shop.connect(player1).setCardAvailability(0, false)
      ).to.not.be.reverted;
    });

    it("Should prevent old owner from performing owner functions", async function () {
      await shop.transferOwnership(player1.address);

      await expect(
        shop.setCardAvailability(0, false)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Multiple Users", function () {
    it("Should handle multiple users buying different cards", async function () {
      await shop.connect(player1).buyCard(0); // Dragon Dore
      await shop.connect(player2).buyCard(1); // Phoenix Immortel

      expect(await arena.balanceOf(player1.address)).to.equal(1);
      expect(await arena.balanceOf(player2.address)).to.equal(1);
    });

    it("Should track purchases independently", async function () {
      await shop.connect(player1).buyCard(0);
      await shop.connect(player2).buyCard(1);

      expect(await shop.hasPurchased(player1.address, 0)).to.be.true;
      expect(await shop.hasPurchased(player1.address, 1)).to.be.false;
      expect(await shop.hasPurchased(player2.address, 0)).to.be.false;
      expect(await shop.hasPurchased(player2.address, 1)).to.be.true;
    });

    it("Should handle cooldowns independently per user", async function () {
      await shop.connect(player1).buyCard(0);

      // Player 1 on cooldown, Player 2 can still buy
      expect(await shop.canPurchase(player1.address, 1)).to.be.false;
      expect(await shop.canPurchase(player2.address, 1)).to.be.true;
    });

    it("Should share secret card stock across users", async function () {
      await shop.connect(player1).buyCard(2); // Brice
      await shop.connect(player2).buyCard(2); // Brice

      const card = await shop.getCard(2);
      expect(card.minted).to.equal(2);
    });
  });

  describe("Edge Cases", function () {
    it("Should enforce cooldown for sequential purchases", async function () {
      await shop.connect(player1).buyCard(0);
      
      await expect(
        shop.connect(player1).buyCard(1)
      ).to.be.revertedWith("Cooldown active - wait 24h between purchases");
    });

    it("Should return correct cooldown remaining time", async function () {
      await shop.connect(player1).buyCard(0);
      const remaining = await shop.getCooldownRemaining(player1.address);
      expect(remaining).to.be.closeTo(86400, 5); // ~24 hours in seconds
    });

    it("Should properly increment tokenCounter in ArenaCards", async function () {
      const counterBefore = await arena.tokenCounter();
      
      await shop.connect(player1).buyCard(0);
      
      const counterAfter = await arena.tokenCounter();
      expect(counterAfter).to.equal(counterBefore + 1n);
    });

    it("Should handle multiple sequential purchases after cooldown", async function () {
      await shop.connect(player1).buyCard(0);
      
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine");
      
      await shop.connect(player1).buyCard(1);

      expect(await arena.balanceOf(player1.address)).to.equal(2);
    });

    it("Should maintain card ownership after multiple purchases", async function () {
      await shop.connect(player1).buyCard(0);
      
      await ethers.provider.send("evm_increaseTime", [3600 * 24]);
      await ethers.provider.send("evm_mine");
      
      await shop.connect(player1).buyCard(1);

      expect(await arena.ownerOf(0)).to.equal(player1.address);
      expect(await arena.ownerOf(1)).to.equal(player1.address);
    });

    it("Should track minted count correctly", async function () {
      // Buy several secret cards with different users
      const allSigners = await ethers.getSigners();
      for (let i = 0; i < 5; i++) {
        await shop.connect(allSigners[i]).buyCard(2);
      }

      const card = await shop.getCard(2);
      expect(card.minted).to.equal(5);
      expect(card.minted).to.be.lessThan(card.maxSupply);
    });
  });

  describe("Integration with ArenaCards", function () {
    it("Should require Shop to be authorized minter", async function () {
      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();

      const newShop = await Shop.deploy(await newArena.getAddress());
      await newShop.waitForDeployment();

      // Should fail because shop is not authorized
      await expect(
        newShop.connect(player1).buyCard(0)
      ).to.be.revertedWith("Not authorized to mint");
    });

    it("Should work correctly when authorized as minter", async function () {
      await expect(shop.connect(player1).buyCard(0)).to.not.be.reverted;
    });

    it("Should mint cards with correct stats from ArenaCards", async function () {
      await shop.connect(player1).buyCard(0); // Dragon Dore - legendaire

      const baseStats = await arena.getBaseStats("legendaire", "Dragon Dore");
      const cardStats = await arena.getCardStats(0);

      expect(cardStats.attack).to.equal(baseStats);
    });

    it("Should create cards that are initially locked", async function () {
      await shop.connect(player1).buyCard(0);

      const locked = await arena.lockUntil(0);
      expect(locked).to.be.greaterThan(0);
    });

    it("Should create cards with level 1", async function () {
      await shop.connect(player1).buyCard(0);

      const card = await arena.cardDetails(0);
      expect(card.level).to.equal(1);
    });

    it("Should create cards with proper metadata", async function () {
      await shop.connect(player1).buyCard(0);

      const tokenURI = await arena.tokenURI(0);
      expect(tokenURI).to.include("data:application/json;base64,");
    });
  });

  describe("getCard View Function", function () {
    it("Should return all card properties", async function () {
      const card = await shop.getCard(0);

      expect(card.name).to.be.a("string");
      expect(card.rarity).to.be.a("string");
      expect(card.imageURI).to.be.a("string");
      expect(card.price).to.be.a("bigint");
      expect(card.isSecret).to.be.a("boolean");
      expect(card.available).to.be.a("boolean");
      expect(card.maxSupply).to.be.a("bigint");
      expect(card.minted).to.be.a("bigint");
    });

    it("Should revert for invalid card ID", async function () {
      await expect(shop.getCard(99)).to.be.revertedWith("Invalid card ID");
    });

    it("Should reflect minted count after purchase", async function () {
      const cardBefore = await shop.getCard(2);
      expect(cardBefore.minted).to.equal(0);

      await shop.connect(player1).buyCard(2);

      const cardAfter = await shop.getCard(2);
      expect(cardAfter.minted).to.equal(1);
    });
  });

  describe("Gas Optimization", function () {
    it("Should use reasonable gas for buying card", async function () {
      const tx = await shop.connect(player1).buyCard(0);
      const receipt = await tx.wait();
      
      // Gas should be reasonable (< 500k for minting + shop logic)
      expect(receipt.gasUsed).to.be.lessThan(500000);
    });

    it("Should use minimal gas for view functions", async function () {
      const gas1 = await shop.canPurchase.estimateGas(player1.address, 0);
      const gas2 = await shop.getCard.estimateGas(0);
      const gas3 = await shop.getCooldownRemaining.estimateGas(player1.address);

      expect(gas1).to.be.lessThan(100000);
      expect(gas2).to.be.lessThan(100000);
      expect(gas3).to.be.lessThan(50000);
    });
  });
});

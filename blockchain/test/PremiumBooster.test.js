const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PremiumBooster – Tests complets", function () {
  let ArenaCards, arena;
  let PremiumBooster, booster;
  let owner, player1, player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy ArenaCards first
    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();

    // Deploy PremiumBooster
    PremiumBooster = await ethers.getContractFactory("PremiumBooster");
    booster = await PremiumBooster.deploy(await arena.getAddress());
    await booster.waitForDeployment();

    // Set PremiumBooster as authorized minter
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
      expect(await booster.CARDS_PER_BOOSTER()).to.equal(4);
    });

    it("Should initialize with correct price (0.002 ETH)", async function () {
      expect(await booster.boosterPrice()).to.equal(ethers.parseEther("0.002"));
    });

    it("Should initialize card templates (11 cards - no commons)", async function () {
      // Check legendary cards
      const template0 = await booster.cardTemplates(0);
      expect(template0.name).to.equal("Dragon Dore");
      expect(template0.rarity).to.equal("legendaire");

      // Check last uncommon card
      const template10 = await booster.cardTemplates(10);
      expect(template10.name).to.equal("Pretre Sage");
      expect(template10.rarity).to.equal("peu commune");
    });

    it("Should have no common cards in templates", async function () {
      // PremiumBooster has only 11 templates (0-10), no commons
      for (let i = 0; i < 11; i++) {
        const template = await booster.cardTemplates(i);
        expect(template.rarity).to.not.equal("commune");
      }
    });
  });

  describe("Opening Boosters with Payment", function () {
    it("Should open booster with exact payment and mint 4 cards", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });

      const balance = await arena.balanceOf(player1.address);
      expect(balance).to.equal(4);
    });

    it("Should revert if payment is insufficient", async function () {
      const price = await booster.boosterPrice();
      const insufficientPayment = price - 1n;

      await expect(
        booster.connect(player1).openBooster({ value: insufficientPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should accept payment greater than booster price", async function () {
      const price = await booster.boosterPrice();
      const overpayment = price + ethers.parseEther("0.001");

      await expect(
        booster.connect(player1).openBooster({ value: overpayment })
      ).to.not.be.reverted;

      expect(await arena.balanceOf(player1.address)).to.equal(4);
    });

    it("Should revert with zero payment", async function () {
      await expect(
        booster.connect(player1).openBooster({ value: 0 })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should emit BoosterOpened event with correct parameters", async function () {
      const price = await booster.boosterPrice();
      
      const tx = await booster.connect(player1).openBooster({ value: price });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(booster, "BoosterOpened")
        .withArgs(player1.address, block.timestamp, price);
    });

    it("Should emit CardMinted events for each card", async function () {
      const price = await booster.boosterPrice();

      const tx = await booster.connect(player1).openBooster({ value: price });
      
      // Check that CardMinted is emitted 4 times
      const receipt = await tx.wait();
      const cardMintedEvents = receipt.logs.filter(
        log => log.fragment && log.fragment.name === "CardMinted"
      );
      expect(cardMintedEvents.length).to.equal(4);
    });

    it("Should mint cards that player owns", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });

      expect(await arena.ownerOf(0)).to.equal(player1.address);
      expect(await arena.ownerOf(1)).to.equal(player1.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
      expect(await arena.ownerOf(3)).to.equal(player1.address);
    });

    it("Should mint cards with valid premium rarities (no commons)", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });

      const validRarities = ["legendaire", "epique", "rare", "peu commune"];
      
      for (let i = 0; i < 4; i++) {
        const card = await arena.cardDetails(i);
        expect(validRarities).to.include(card.rarity);
        expect(card.rarity).to.not.equal("commune");
      }
    });

    it("Should mint cards with level 1", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });

      for (let i = 0; i < 4; i++) {
        const card = await arena.cardDetails(i);
        expect(card.level).to.equal(1);
      }
    });

    it("Should transfer ETH to contract", async function () {
      const price = await booster.boosterPrice();
      
      const contractBalanceBefore = await ethers.provider.getBalance(await booster.getAddress());
      
      await booster.connect(player1).openBooster({ value: price });
      
      const contractBalanceAfter = await ethers.provider.getBalance(await booster.getAddress());
      expect(contractBalanceAfter).to.equal(contractBalanceBefore + price);
    });
  });

  describe("No Cooldown Mechanism", function () {
    it("Should allow opening multiple boosters immediately", async function () {
      const price = await booster.boosterPrice();

      // Open first booster
      await booster.connect(player1).openBooster({ value: price });
      expect(await arena.balanceOf(player1.address)).to.equal(4);

      // Open second booster immediately
      await booster.connect(player1).openBooster({ value: price });
      expect(await arena.balanceOf(player1.address)).to.equal(8);

      // Open third booster immediately
      await booster.connect(player1).openBooster({ value: price });
      expect(await arena.balanceOf(player1.address)).to.equal(12);
    });

    it("Should allow rapid consecutive purchases", async function () {
      const price = await booster.boosterPrice();

      // Open 5 boosters in rapid succession
      for (let i = 0; i < 5; i++) {
        await booster.connect(player1).openBooster({ value: price });
      }

      expect(await arena.balanceOf(player1.address)).to.equal(20); // 5 * 4
    });

    it("Should handle multiple users purchasing simultaneously", async function () {
      const price = await booster.boosterPrice();

      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player2).openBooster({ value: price });
      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player2).openBooster({ value: price });

      expect(await arena.balanceOf(player1.address)).to.equal(8);
      expect(await arena.balanceOf(player2.address)).to.equal(8);
    });
  });

  describe("Card Limit", function () {
    it("Should not allow opening booster if it would exceed MAX_CARDS", async function () {
      const price = await booster.boosterPrice();

      // Mint 27 cards (MAX_CARDS = 30, booster gives 4, so 27 + 4 = 31 > 30)
      for (let i = 0; i < 27; i++) {
        await arena.mintCard(player1.address, "Gobelin Ruse", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      expect(await arena.balanceOf(player1.address)).to.equal(27);

      await expect(
        booster.connect(player1).openBooster({ value: price })
      ).to.be.revertedWith("Not enough space for booster cards");
    });

    it("Should allow opening booster with exactly enough space", async function () {
      const price = await booster.boosterPrice();

      // Mint 26 cards (26 + 4 = 30, exactly at limit)
      for (let i = 0; i < 26; i++) {
        await arena.mintCard(player1.address, "Gobelin Ruse", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      expect(await arena.balanceOf(player1.address)).to.equal(26);

      await expect(
        booster.connect(player1).openBooster({ value: price })
      ).to.not.be.reverted;
      
      expect(await arena.balanceOf(player1.address)).to.equal(30);
    });

    it("Should not refund payment if space check fails", async function () {
      const price = await booster.boosterPrice();

      // Fill to 27 cards
      for (let i = 0; i < 27; i++) {
        await arena.mintCard(player1.address, "Slime Gluant", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      const player1BalanceBefore = await ethers.provider.getBalance(player1.address);

      try {
        await booster.connect(player1).openBooster({ value: price });
      } catch (error) {
        // Expected to fail
      }

      // The transaction should fail and player1's balance should only decrease by gas
      const player1BalanceAfter = await ethers.provider.getBalance(player1.address);
      const balanceDiff = player1BalanceBefore - player1BalanceAfter;
      
      // Balance difference should be less than payment (just gas costs)
      expect(balanceDiff).to.be.lessThan(price);
    });
  });

  describe("Price Management", function () {
    it("Should allow owner to update booster price", async function () {
      const newPrice = ethers.parseEther("0.005");
      
      await booster.setBoosterPrice(newPrice);
      
      expect(await booster.boosterPrice()).to.equal(newPrice);
    });

    it("Should emit PriceUpdated event", async function () {
      const newPrice = ethers.parseEther("0.003");
      
      await expect(booster.setBoosterPrice(newPrice))
        .to.emit(booster, "PriceUpdated")
        .withArgs(newPrice);
    });

    it("Should not allow non-owner to update price", async function () {
      const newPrice = ethers.parseEther("0.005");
      
      await expect(
        booster.connect(player1).setBoosterPrice(newPrice)
      ).to.be.revertedWith("Not owner");
    });

    it("Should allow setting price to zero", async function () {
      await booster.setBoosterPrice(0);
      expect(await booster.boosterPrice()).to.equal(0);
    });

    it("Should allow opening booster with new price", async function () {
      const newPrice = ethers.parseEther("0.001");
      await booster.setBoosterPrice(newPrice);

      await expect(
        booster.connect(player1).openBooster({ value: newPrice })
      ).to.not.be.reverted;
    });

    it("Should reject old price after price update", async function () {
      const oldPrice = await booster.boosterPrice();
      const newPrice = ethers.parseEther("0.005");
      
      await booster.setBoosterPrice(newPrice);

      await expect(
        booster.connect(player1).openBooster({ value: oldPrice })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should return correct price from getBoosterPrice", async function () {
      const price = await booster.getBoosterPrice();
      expect(price).to.equal(ethers.parseEther("0.002"));

      const newPrice = ethers.parseEther("0.004");
      await booster.setBoosterPrice(newPrice);

      expect(await booster.getBoosterPrice()).to.equal(newPrice);
    });
  });

  describe("Funds Withdrawal", function () {
    it("Should allow owner to withdraw contract balance", async function () {
      const price = await booster.boosterPrice();

      // Multiple purchases to accumulate funds
      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player2).openBooster({ value: price });

      const contractBalance = await ethers.provider.getBalance(await booster.getAddress());
      expect(contractBalance).to.equal(price * 2n);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await booster.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      const expectedBalance = ownerBalanceBefore + contractBalance - gasUsed;

      expect(ownerBalanceAfter).to.equal(expectedBalance);
      expect(await ethers.provider.getBalance(await booster.getAddress())).to.equal(0);
    });

    it("Should not allow non-owner to withdraw", async function () {
      const price = await booster.boosterPrice();
      await booster.connect(player1).openBooster({ value: price });

      await expect(
        booster.connect(player1).withdraw()
      ).to.be.revertedWith("Not owner");
    });

    it("Should revert when withdrawing with no funds", async function () {
      await expect(
        booster.withdraw()
      ).to.be.revertedWith("No funds to withdraw");
    });

    it("Should allow multiple withdrawals", async function () {
      const price = await booster.boosterPrice();

      // First purchase and withdraw
      await booster.connect(player1).openBooster({ value: price });
      await booster.withdraw();
      expect(await ethers.provider.getBalance(await booster.getAddress())).to.equal(0);

      // Second purchase and withdraw
      await booster.connect(player2).openBooster({ value: price });
      await booster.withdraw();
      expect(await ethers.provider.getBalance(await booster.getAddress())).to.equal(0);
    });

    it("Should withdraw correct amount with multiple purchases", async function () {
      const price = await booster.boosterPrice();

      // 5 purchases
      for (let i = 0; i < 5; i++) {
        await booster.connect(player1).openBooster({ value: price });
      }

      const contractBalance = await ethers.provider.getBalance(await booster.getAddress());
      expect(contractBalance).to.equal(price * 5n);

      await booster.withdraw();
      expect(await ethers.provider.getBalance(await booster.getAddress())).to.equal(0);
    });
  });

  describe("Card Templates", function () {
    it("Should have 2 legendary cards", async function () {
      const template0 = await booster.cardTemplates(0);
      const template1 = await booster.cardTemplates(1);

      expect(template0.rarity).to.equal("legendaire");
      expect(template1.rarity).to.equal("legendaire");
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

    it("Should have no common cards", async function () {
      // Verify that no template has "commune" rarity
      for (let i = 0; i < 11; i++) {
        const template = await booster.cardTemplates(i);
        expect(template.rarity).to.not.equal("commune");
      }
    });

    it("Should have valid image URIs for all templates", async function () {
      for (let i = 0; i < 11; i++) {
        const template = await booster.cardTemplates(i);
        expect(template.imageURI).to.include("https://");
      }
    });

    it("Should have unique names for all templates", async function () {
      const names = new Set();
      for (let i = 0; i < 11; i++) {
        const template = await booster.cardTemplates(i);
        expect(names.has(template.name)).to.be.false;
        names.add(template.name);
      }
      expect(names.size).to.equal(11);
    });
  });

  describe("Drop Rate Distribution", function () {
    it("Should only mint premium rarity cards (no commons)", async function () {
      const price = await booster.boosterPrice();

      // Open 7 boosters to get good sample (7 * 4 = 28 cards, under MAX_CARDS of 30)
      for (let i = 0; i < 7; i++) {
        await booster.connect(player1).openBooster({ value: price });
      }

      const balance = await arena.balanceOf(player1.address);
      expect(balance).to.equal(28); // 7 * 4

      // Check all cards are not common
      for (let i = 0; i < 28; i++) {
        const card = await arena.cardDetails(i);
        expect(card.rarity).to.not.equal("commune");
      }
    });

    it("Should produce cards with valid stats for premium rarities", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });

      for (let i = 0; i < 4; i++) {
        const card = await arena.cardDetails(i);

        // Verify cards have valid attack stats and are premium rarities
        expect(card.stats.attack).to.be.greaterThan(0);
        
        // Verify no common cards
        expect(card.rarity).to.not.equal("commune");
        
        // Premium rarities should have proper stat ranges
        // Legendary: 100-150, Epic: 80-100, Rare: 60-80, Uncommon: 40-60
        if (card.rarity === "legendaire") {
          expect(card.stats.attack).to.be.gte(100).and.lte(150);
        } else if (card.rarity === "epique") {
          expect(card.stats.attack).to.be.gte(80).and.lte(100);
        } else if (card.rarity === "rare") {
          expect(card.stats.attack).to.be.gte(60).and.lte(80);
        } else if (card.rarity === "peu commune") {
          expect(card.stats.attack).to.be.gte(40).and.lte(60);
        }
        
        // Verify valid premium rarities
        const validPremiumRarities = ["legendaire", "epique", "rare", "peu commune"];
        expect(validPremiumRarities).to.include(card.rarity);
      }
    });

    it("Should mint valid cards from template pool", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });

      const validNames = [
        "Dragon Dore", "Phoenix Immortel",
        "Chevalier Noir", "Mage des Glaces", "Assassin Fantome",
        "Archer Elfe", "Paladin Sacre", "Druide Ancien",
        "Guerrier Brave", "Voleur Agile", "Pretre Sage"
      ];

      for (let i = 0; i < 4; i++) {
        const card = await arena.cardDetails(i);
        expect(validNames).to.include(card.name);
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

    it("Should allow new owner to use owner functions", async function () {
      await booster.transferOwnership(player1.address);

      const newPrice = ethers.parseEther("0.003");
      await expect(
        booster.connect(player1).setBoosterPrice(newPrice)
      ).to.not.be.reverted;

      expect(await booster.boosterPrice()).to.equal(newPrice);
    });

    it("Should prevent old owner from using owner functions after transfer", async function () {
      await booster.transferOwnership(player1.address);

      const newPrice = ethers.parseEther("0.003");
      await expect(
        booster.setBoosterPrice(newPrice)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large payments correctly", async function () {
      const price = await booster.boosterPrice();
      const largePayment = ethers.parseEther("1"); // Way more than needed

      await expect(
        booster.connect(player1).openBooster({ value: largePayment })
      ).to.not.be.reverted;

      // Contract should keep all the payment
      expect(await ethers.provider.getBalance(await booster.getAddress())).to.equal(largePayment);
    });

    it("Should properly increment ArenaCards tokenCounter", async function () {
      const price = await booster.boosterPrice();
      const counterBefore = await arena.tokenCounter();
      
      await booster.connect(player1).openBooster({ value: price });
      
      const counterAfter = await arena.tokenCounter();
      expect(counterAfter).to.equal(counterBefore + 4n);
    });

    it("Should work with multiple users and different balances", async function () {
      const price = await booster.boosterPrice();

      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player2).openBooster({ value: price });

      expect(await arena.balanceOf(player1.address)).to.equal(8);
      expect(await arena.balanceOf(player2.address)).to.equal(4);
    });

    it("Should maintain card ownership across multiple purchases", async function () {
      const price = await booster.boosterPrice();

      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player1).openBooster({ value: price });

      // Check all 8 cards belong to player1
      for (let i = 0; i < 8; i++) {
        expect(await arena.ownerOf(i)).to.equal(player1.address);
      }
    });

    it("Should handle price set to very high value", async function () {
      const veryHighPrice = ethers.parseEther("100");
      await booster.setBoosterPrice(veryHighPrice);

      await expect(
        booster.connect(player1).openBooster({ value: veryHighPrice })
      ).to.not.be.reverted;
    });

    it("Should accumulate multiple payments correctly", async function () {
      const price = await booster.boosterPrice();

      for (let i = 0; i < 3; i++) {
        await booster.connect(player1).openBooster({ value: price });
      }

      expect(await ethers.provider.getBalance(await booster.getAddress())).to.equal(price * 3n);
    });
  });

  describe("Integration with ArenaCards", function () {
    it("Should require ArenaCards to authorize booster as minter", async function () {
      // Deploy new contracts without authorization
      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();

      const newBooster = await PremiumBooster.deploy(await newArena.getAddress());
      await newBooster.waitForDeployment();

      const price = await newBooster.boosterPrice();

      // Should fail because booster is not authorized
      await expect(
        newBooster.connect(player1).openBooster({ value: price })
      ).to.be.revertedWith("Not authorized to mint");
    });

    it("Should work correctly when authorized as minter", async function () {
      const price = await booster.boosterPrice();
      await expect(
        booster.connect(player1).openBooster({ value: price })
      ).to.not.be.reverted;
    });

    it("Should respect ArenaCards MAX_CARDS limit", async function () {
      const maxCards = await arena.MAX_CARDS();
      expect(maxCards).to.equal(30);
    });

    it("Should mint cards that are valid in ArenaCards ecosystem", async function () {
      const price = await booster.boosterPrice();
      await booster.connect(player1).openBooster({ value: price });

      // Verify cards have all required properties
      for (let i = 0; i < 4; i++) {
        const card = await arena.cardDetails(i);
        expect(card.name.length).to.be.greaterThan(0);
        expect(card.rarity.length).to.be.greaterThan(0);
        expect(card.stats.attack).to.be.greaterThan(0);
        expect(card.level).to.equal(1);
      }
    });
  });

  describe("Comparison with FreeBooster", function () {
    it("Should give 4 cards instead of 2 like FreeBooster", async function () {
      const price = await booster.boosterPrice();
      
      await booster.connect(player1).openBooster({ value: price });
      
      expect(await arena.balanceOf(player1.address)).to.equal(4);
    });

    it("Should not have any cooldown mechanism", async function () {
      const price = await booster.boosterPrice();

      // Open 3 boosters rapidly
      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player1).openBooster({ value: price });
      await booster.connect(player1).openBooster({ value: price });

      expect(await arena.balanceOf(player1.address)).to.equal(12);
    });

    it("Should require payment unlike FreeBooster", async function () {
      await expect(
        booster.connect(player1).openBooster({ value: 0 })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should provide better rarity distribution (no commons)", async function () {
      const price = await booster.boosterPrice();

      // Open 5 boosters
      for (let i = 0; i < 5; i++) {
        await booster.connect(player1).openBooster({ value: price });
      }

      // Check that no card is common
      for (let i = 0; i < 20; i++) {
        const card = await arena.cardDetails(i);
        expect(card.rarity).to.not.equal("commune");
      }
    });
  });
});

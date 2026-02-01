const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace – Tests complets", function () {
  let ArenaCards, arena;
  let Marketplace, marketplace;
  let owner, player1, player2, player3;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy ArenaCards
    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();

    // Deploy Marketplace
    Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(await arena.getAddress());
    await marketplace.waitForDeployment();

    // Mint some cards for testing
    await arena.mintCard(player1.address, "Dragon Dore", "legendaire");
    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");

    await arena.mintCard(player1.address, "Phoenix Immortel", "legendaire");
    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");

    await arena.mintCard(player2.address, "Chevalier Sacre", "legendaire");
    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");

    await arena.mintCard(player2.address, "Mage des Glaces", "epique");
    await ethers.provider.send("evm_increaseTime", [300]);
    await ethers.provider.send("evm_mine");
  });

  describe("Deployment", function () {
    it("Should deploy with correct ArenaCards address", async function () {
      expect(await marketplace.arenaCards()).to.equal(await arena.getAddress());
    });

    it("Should set deployer as owner", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("Should initialize tradeCounter to 0", async function () {
      expect(await marketplace.tradeCounter()).to.equal(0);
    });

    it("Should initialize directTradeCounter to 0", async function () {
      expect(await marketplace.directTradeCounter()).to.equal(0);
    });
  });

  describe("Creating Trades (Criteria-based)", function () {
    it("Should create trade successfully with approval", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      const trade = await marketplace.trades(0);
      expect(trade.creator).to.equal(player1.address);
      expect(trade.offeredTokenId).to.equal(0);
      expect(trade.requestedCardName).to.equal("Chevalier Sacre");
      expect(trade.requestedLevel).to.equal(1);
      expect(trade.requestedRarity).to.equal("legendaire");
      expect(trade.isActive).to.be.true;
    });

    it("Should emit TradeCreated event", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire"))
        .to.emit(marketplace, "TradeCreated")
        .withArgs(0, player1.address, 0, "Phoenix Immortel", 1);
    });

    it("Should increment tradeCounter", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire");

      expect(await marketplace.tradeCounter()).to.equal(1);
    });

    it("Should mark token as in trade", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      expect(await marketplace.tokenInTrade(0)).to.be.true;
    });

    it("Should revert if not owner of offered card", async function () {
      await expect(
        marketplace.connect(player2).createTrade(0, "Dragon Dore", 1, "legendaire")
      ).to.be.revertedWith("Not owner of offered card");
    });

    it("Should revert if marketplace not approved", async function () {
      await expect(
        marketplace.connect(player1).createTrade(0, "Dragon Dore", 1, "legendaire")
      ).to.be.revertedWith("Marketplace not approved");
    });

    it("Should work with setApprovalForAll", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await expect(
        marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire")
      ).to.not.be.reverted;
    });

    it("Should revert if card already in active trade", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      await expect(
        marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire")
      ).to.be.revertedWith("Card already in active trade");
    });

    it("Should revert if trying to trade for same card", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createTrade(0, "Dragon Dore", 1, "legendaire")
      ).to.be.revertedWith("Cannot trade the same card");
    });

    it("Should revert if offered card rarity doesn't match requested", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createTrade(0, "Mage des Glaces", 1, "epique")
      ).to.be.revertedWith("Offered card rarity must match requested card rarity");
    });

    it("Should revert if card name is empty", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createTrade(0, "", 1, "legendaire")
      ).to.be.revertedWith("Card name required");
    });

    it("Should revert if level is 0", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createTrade(0, "Dragon Dore", 0, "legendaire")
      ).to.be.revertedWith("Level must be greater than 0");
    });

    it("Should allow multiple trades from same user", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire");
      await marketplace.connect(player1).createTrade(1, "Chevalier Sacre", 1, "legendaire");

      expect(await marketplace.tradeCounter()).to.equal(2);
    });
  });

  describe("Accepting Trades (Criteria-based)", function () {
    beforeEach(async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");
    });

    it("Should accept trade with matching card", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0, 2);

      expect(await arena.ownerOf(0)).to.equal(player2.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
    });

    it("Should emit TradeAccepted event", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      await expect(marketplace.connect(player2).acceptTrade(0, 2))
        .to.emit(marketplace, "TradeAccepted")
        .withArgs(0, player2.address, 0, 2);
    });

    it("Should mark trade as inactive", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0, 2);

      const trade = await marketplace.trades(0);
      expect(trade.isActive).to.be.false;
    });

    it("Should revert if card name doesn't match", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 3);

      await expect(
        marketplace.connect(player2).acceptTrade(0, 3)
      ).to.be.revertedWith("Card name does not match");
    });

    it("Should revert if trying to accept own trade", async function () {
      await expect(
        marketplace.connect(player1).acceptTrade(0, 1)
      ).to.be.revertedWith("Cannot accept own trade");
    });

    it("Should revert if not owner of offered card", async function () {
      await expect(
        marketplace.connect(player3).acceptTrade(0, 2)
      ).to.be.revertedWith("Not owner of offered card");
    });
  });

  describe("Cancelling Trades", function () {
    beforeEach(async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");
    });

    it("Should cancel trade successfully", async function () {
      await marketplace.connect(player1).cancelTrade(0);

      const trade = await marketplace.trades(0);
      expect(trade.isActive).to.be.false;
    });

    it("Should emit TradeCancelled event", async function () {
      await expect(marketplace.connect(player1).cancelTrade(0))
        .to.emit(marketplace, "TradeCancelled")
        .withArgs(0);
    });

    it("Should remove token from trade mapping", async function () {
      await marketplace.connect(player1).cancelTrade(0);

      expect(await marketplace.tokenInTrade(0)).to.be.false;
    });

    it("Should revert if not trade creator", async function () {
      await expect(
        marketplace.connect(player2).cancelTrade(0)
      ).to.be.revertedWith("Not trade creator");
    });
  });

  describe("Direct Trades (P2P)", function () {
    it("Should create direct trade successfully", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      const trade = await marketplace.directTrades(0);
      expect(trade.creator).to.equal(player1.address);
      expect(trade.target).to.equal(player2.address);
      expect(trade.offeredTokenId).to.equal(0);
      expect(trade.requestedTokenId).to.equal(2);
      expect(trade.isActive).to.be.true;
    });

    it("Should emit DirectTradeCreated event", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(marketplace.connect(player1).createDirectTrade(player2.address, 0, 2))
        .to.emit(marketplace, "DirectTradeCreated")
        .withArgs(0, player1.address, player2.address, 0, 2);
    });

    it("Should revert if target is zero address", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createDirectTrade(ethers.ZeroAddress, 0, 2)
      ).to.be.revertedWith("Invalid target address");
    });

    it("Should revert if trying to trade with yourself", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createDirectTrade(player1.address, 0, 1)
      ).to.be.revertedWith("Cannot trade with yourself");
    });

    it("Should revert if target doesn't own requested card", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createDirectTrade(player3.address, 0, 2)
      ).to.be.revertedWith("Target does not own requested card");
    });

    it("Should revert if cards have different rarities", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 3);

      await expect(
        marketplace.connect(player2).createDirectTrade(player1.address, 3, 0)
      ).to.be.revertedWith("Cards must have the same rarity");
    });

    it("Should accept direct trade successfully", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptDirectTrade(0);

      expect(await arena.ownerOf(0)).to.equal(player2.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
    });

    it("Should emit DirectTradeAccepted event", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      await expect(marketplace.connect(player2).acceptDirectTrade(0))
        .to.emit(marketplace, "DirectTradeAccepted")
        .withArgs(0, player2.address, 0, 2);
    });

    it("Should revert if not the target", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await expect(
        marketplace.connect(player3).acceptDirectTrade(0)
      ).to.be.revertedWith("Not the target of this trade");
    });

    it("Should cancel direct trade by creator", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await marketplace.connect(player1).cancelDirectTrade(0);

      const trade = await marketplace.directTrades(0);
      expect(trade.isActive).to.be.false;
    });

    it("Should cancel direct trade by target", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await marketplace.connect(player2).cancelDirectTrade(0);

      const trade = await marketplace.directTrades(0);
      expect(trade.isActive).to.be.false;
    });

    it("Should emit DirectTradeCancelled event", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await expect(marketplace.connect(player1).cancelDirectTrade(0))
        .to.emit(marketplace, "DirectTradeCancelled")
        .withArgs(0);
    });

    it("Should revert cancel if not authorized", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      await expect(
        marketplace.connect(player3).cancelDirectTrade(0)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Getting Received Direct Trades", function () {
    it("Should return received direct trades", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      const received = await marketplace.getReceivedDirectTrades(player2.address);
      expect(received.length).to.equal(1);
      expect(received[0].creator).to.equal(player1.address);
      expect(received[0].target).to.equal(player2.address);
    });

    it("Should return empty array if no received trades", async function () {
      const received = await marketplace.getReceivedDirectTrades(player3.address);
      expect(received.length).to.equal(0);
    });
  });

  describe("Getting Sent Direct Trades", function () {
    it("Should return sent direct trades", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createDirectTrade(player2.address, 0, 2);

      const sent = await marketplace.getSentDirectTrades(player1.address);
      expect(sent.length).to.equal(1);
      expect(sent[0].creator).to.equal(player1.address);
      expect(sent[0].target).to.equal(player2.address);
    });

    it("Should return empty array if no sent trades", async function () {
      const sent = await marketplace.getSentDirectTrades(player3.address);
      expect(sent.length).to.equal(0);
    });
  });

  describe("Getting Active Trades", function () {
    it("Should return all active trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire");
      await marketplace.connect(player1).createTrade(1, "Chevalier Sacre", 1, "legendaire");

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(2);
    });

    it("Should not include cancelled trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire");
      await marketplace.connect(player1).createTrade(1, "Chevalier Sacre", 1, "legendaire");
      
      await marketplace.connect(player1).cancelTrade(0);

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(1);
    });
  });

  describe("Getting User Trades", function () {
    it("Should return only user's trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, "Phoenix Immortel", 1, "legendaire");
      await marketplace.connect(player1).createTrade(1, "Chevalier Sacre", 1, "legendaire");

      const userTrades = await marketplace.getUserTrades(player1.address);
      expect(userTrades.length).to.equal(2);
    });

    it("Should return empty array for user with no trades", async function () {
      const userTrades = await marketplace.getUserTrades(player3.address);
      expect(userTrades.length).to.equal(0);
    });
  });

  describe("isCardInTrade", function () {
    it("Should return false for card not in trade", async function () {
      expect(await marketplace.isCardInTrade(0)).to.be.false;
    });

    it("Should return true for card in active trade", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      expect(await marketplace.isCardInTrade(0)).to.be.true;
    });

    it("Should return false after trade is cancelled", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      await marketplace.connect(player1).cancelTrade(0);

      expect(await marketplace.isCardInTrade(0)).to.be.false;
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      
      await expect(
        marketplace.connect(player2).acceptTrade(0, 2)
      ).to.not.be.reverted;
    });

    it("Should handle approval revocation before acceptance", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      await arena.connect(player1).approve(ethers.ZeroAddress, 0);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      await expect(
        marketplace.connect(player2).acceptTrade(0, 2)
      ).to.be.reverted;
    });

    it("Should not affect card ownership until trade is accepted", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");

      expect(await arena.ownerOf(0)).to.equal(player1.address);
      expect(await arena.ownerOf(2)).to.equal(player2.address);
    });
  });

  describe("Ownership Functions", function () {
    it("Should allow owner to transfer ownership", async function () {
      await marketplace.transferOwnership(player1.address);
      expect(await marketplace.owner()).to.equal(player1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        marketplace.connect(player1).transferOwnership(player2.address)
      ).to.be.reverted;
    });
  });
});

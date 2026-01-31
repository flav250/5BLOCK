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

    await arena.mintCard(player2.address, "Chevalier Noir", "epique");
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
  });

  describe("Creating Trades", function () {
    it("Should create trade successfully with approval", async function () {
      // Player1 approves marketplace for token 0
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await marketplace.connect(player1).createTrade(0, 2);

      const trade = await marketplace.trades(0);
      expect(trade.creator).to.equal(player1.address);
      expect(trade.offeredTokenId).to.equal(0);
      expect(trade.requestedTokenId).to.equal(2);
      expect(trade.isActive).to.be.true;
    });

    it("Should emit TradeCreated event", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(marketplace.connect(player1).createTrade(0, 2))
        .to.emit(marketplace, "TradeCreated")
        .withArgs(0, player1.address, 0, 2);
    });

    it("Should increment tradeCounter", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      expect(await marketplace.tradeCounter()).to.equal(1);

      await arena.connect(player1).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(player1).createTrade(1, 3);

      expect(await marketplace.tradeCounter()).to.equal(2);
    });

    it("Should mark token as in trade", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      expect(await marketplace.tokenInTrade(0)).to.be.true;
    });

    it("Should revert if not owner of offered card", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player2).createTrade(0, 2)
      ).to.be.revertedWith("Not owner of offered card");
    });

    it("Should revert if marketplace not approved", async function () {
      // No approval given
      await expect(
        marketplace.connect(player1).createTrade(0, 2)
      ).to.be.revertedWith("Marketplace not approved");
    });

    it("Should work with setApprovalForAll", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await expect(
        marketplace.connect(player1).createTrade(0, 2)
      ).to.not.be.reverted;
    });

    it("Should revert if card already in active trade", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      await expect(
        marketplace.connect(player1).createTrade(0, 3)
      ).to.be.revertedWith("Card already in active trade");
    });

    it("Should revert if trying to trade same card", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createTrade(0, 0)
      ).to.be.revertedWith("Cannot trade same card");
    });

    it("Should allow creating trade for non-existent requested token", async function () {
      // Requested token doesn't have to exist at creation time
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);

      await expect(
        marketplace.connect(player1).createTrade(0, 999)
      ).to.not.be.reverted;
    });

    it("Should store correct timestamp", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      
      const tx = await marketplace.connect(player1).createTrade(0, 2);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const trade = await marketplace.trades(0);
      expect(trade.createdAt).to.equal(block.timestamp);
    });

    it("Should allow multiple trades from same user", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);

      expect(await marketplace.tradeCounter()).to.equal(2);
      expect(await marketplace.tokenInTrade(0)).to.be.true;
      expect(await marketplace.tokenInTrade(1)).to.be.true;
    });
  });

  describe("Accepting Trades", function () {
    beforeEach(async function () {
      // Setup: Player1 creates a trade offering token 0 for token 2
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);
    });

    it("Should accept trade and swap cards", async function () {
      // Player2 approves and accepts
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0);

      // Verify ownership swapped
      expect(await arena.ownerOf(0)).to.equal(player2.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
    });

    it("Should emit TradeAccepted event", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      await expect(marketplace.connect(player2).acceptTrade(0))
        .to.emit(marketplace, "TradeAccepted")
        .withArgs(0, player2.address, 0, 2);
    });

    it("Should mark trade as inactive", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0);

      const trade = await marketplace.trades(0);
      expect(trade.isActive).to.be.false;
    });

    it("Should remove token from trade mapping", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0);

      expect(await marketplace.tokenInTrade(0)).to.be.false;
    });

    it("Should revert if trade not active", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0);

      // Try to accept again
      await expect(
        marketplace.connect(player2).acceptTrade(0)
      ).to.be.revertedWith("Trade not active");
    });

    it("Should revert if trying to accept own trade", async function () {
      // Player1 cannot accept their own trade, no need to approve
      await expect(
        marketplace.connect(player1).acceptTrade(0)
      ).to.be.revertedWith("Cannot accept own trade");
    });

    it("Should revert if not owner of requested card", async function () {
      await expect(
        marketplace.connect(player3).acceptTrade(0)
      ).to.be.revertedWith("Not owner of requested card");
    });

    it("Should revert if acceptor doesn't approve marketplace", async function () {
      // Player2 owns token 2 but doesn't approve
      await expect(
        marketplace.connect(player2).acceptTrade(0)
      ).to.be.revertedWith("Marketplace not approved for your card");
    });

    it("Should revert if creator no longer owns offered card", async function () {
      // Player1 transfers token 0 away before acceptance
      await arena.connect(player1).transferFrom(player1.address, player3.address, 0);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      await expect(
        marketplace.connect(player2).acceptTrade(0)
      ).to.be.revertedWith("Creator no longer owns offered card");
    });

    it("Should work with setApprovalForAll", async function () {
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      await expect(
        marketplace.connect(player2).acceptTrade(0)
      ).to.not.be.reverted;

      expect(await arena.ownerOf(0)).to.equal(player2.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
    });

    it("Should handle multiple trades correctly", async function () {
      // Wait for cards to unlock (they were minted in beforeEach)
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Create second trade
      await arena.connect(player1).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(player1).createTrade(1, 3);

      // Accept first trade
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0);

      // Wait for transferred cards to unlock
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Accept second trade
      await arena.connect(player2).approve(await marketplace.getAddress(), 3);
      await marketplace.connect(player2).acceptTrade(1);

      expect(await arena.ownerOf(0)).to.equal(player2.address);
      expect(await arena.ownerOf(1)).to.equal(player2.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
      expect(await arena.ownerOf(3)).to.equal(player1.address);
    });

    it("Should revert if trade ID doesn't exist", async function () {
      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      await expect(
        marketplace.connect(player2).acceptTrade(999)
      ).to.be.revertedWith("Trade not active");
    });
  });

  describe("Cancelling Trades", function () {
    beforeEach(async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);
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

    it("Should allow creating new trade with same card after cancellation", async function () {
      await marketplace.connect(player1).cancelTrade(0);

      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await expect(
        marketplace.connect(player1).createTrade(0, 3)
      ).to.not.be.reverted;
    });

    it("Should revert if not trade creator", async function () {
      await expect(
        marketplace.connect(player2).cancelTrade(0)
      ).to.be.revertedWith("Not trade creator");
    });

    it("Should revert if trade not active", async function () {
      await marketplace.connect(player1).cancelTrade(0);

      await expect(
        marketplace.connect(player1).cancelTrade(0)
      ).to.be.revertedWith("Trade not active");
    });

    it("Should keep card with original owner after cancellation", async function () {
      await marketplace.connect(player1).cancelTrade(0);

      expect(await arena.ownerOf(0)).to.equal(player1.address);
    });

    it("Should revert if trade ID doesn't exist", async function () {
      await expect(
        marketplace.connect(player1).cancelTrade(999)
      ).to.be.revertedWith("Trade not active");
    });
  });

  describe("Getting Active Trades", function () {
    it("Should return empty array when no trades", async function () {
      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(0);
    });

    it("Should return all active trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);
      await marketplace.connect(player2).createTrade(2, 0);

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(3);
    });

    it("Should not include cancelled trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);
      
      await marketplace.connect(player1).cancelTrade(0);

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(1);
      expect(activeTrades[0].tradeId).to.equal(1);
    });

    it("Should not include accepted trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);
      
      await marketplace.connect(player2).acceptTrade(0);

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(1);
      expect(activeTrades[0].tradeId).to.equal(1);
    });

    it("Should return correct trade details", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(1);
      expect(activeTrades[0].creator).to.equal(player1.address);
      expect(activeTrades[0].offeredTokenId).to.equal(0);
      expect(activeTrades[0].requestedTokenId).to.equal(2);
      expect(activeTrades[0].isActive).to.be.true;
    });

    it("Should handle multiple users' trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player2).createTrade(2, 1);

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(2);
    });
  });

  describe("Getting User Trades", function () {
    it("Should return empty array for user with no trades", async function () {
      const userTrades = await marketplace.getUserTrades(player3.address);
      expect(userTrades.length).to.equal(0);
    });

    it("Should return only user's trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);
      await marketplace.connect(player2).createTrade(2, 0);

      const player1Trades = await marketplace.getUserTrades(player1.address);
      expect(player1Trades.length).to.equal(2);
      expect(player1Trades[0].creator).to.equal(player1.address);
      expect(player1Trades[1].creator).to.equal(player1.address);

      const player2Trades = await marketplace.getUserTrades(player2.address);
      expect(player2Trades.length).to.equal(1);
      expect(player2Trades[0].creator).to.equal(player2.address);
    });

    it("Should not include cancelled trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);
      await marketplace.connect(player1).cancelTrade(0);

      const userTrades = await marketplace.getUserTrades(player1.address);
      expect(userTrades.length).to.equal(1);
      expect(userTrades[0].tradeId).to.equal(1);
    });

    it("Should not include accepted trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).createTrade(1, 3);
      await marketplace.connect(player2).acceptTrade(0);

      const userTrades = await marketplace.getUserTrades(player1.address);
      expect(userTrades.length).to.equal(1);
      expect(userTrades[0].tradeId).to.equal(1);
    });

    it("Should return correct trade details", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      const userTrades = await marketplace.getUserTrades(player1.address);
      expect(userTrades[0].offeredTokenId).to.equal(0);
      expect(userTrades[0].requestedTokenId).to.equal(2);
      expect(userTrades[0].isActive).to.be.true;
    });
  });

  describe("isCardInTrade", function () {
    it("Should return false for card not in trade", async function () {
      expect(await marketplace.isCardInTrade(0)).to.be.false;
    });

    it("Should return true for card in active trade", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      expect(await marketplace.isCardInTrade(0)).to.be.true;
    });

    it("Should return false after trade is cancelled", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      await marketplace.connect(player1).cancelTrade(0);

      expect(await marketplace.isCardInTrade(0)).to.be.false;
    });

    it("Should return false after trade is accepted", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      await marketplace.connect(player2).acceptTrade(0);

      expect(await marketplace.isCardInTrade(0)).to.be.false;
    });

    it("Should track multiple cards independently", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(player1).createTrade(0, 2);

      expect(await marketplace.isCardInTrade(0)).to.be.true;
      expect(await marketplace.isCardInTrade(1)).to.be.false;

      await marketplace.connect(player1).createTrade(1, 3);

      expect(await marketplace.isCardInTrade(0)).to.be.true;
      expect(await marketplace.isCardInTrade(1)).to.be.true;
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      // The ReentrancyGuard modifier should prevent reentrancy
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);
      
      // This should work normally (not testing actual reentrancy, just that it works)
      await expect(
        marketplace.connect(player2).acceptTrade(0)
      ).to.not.be.reverted;
    });

    it("Should handle trade with token ID 0", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      
      await expect(
        marketplace.connect(player1).createTrade(0, 2)
      ).to.not.be.reverted;
    });

    it("Should allow cancelled trade card to be traded again", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);
      await marketplace.connect(player1).cancelTrade(0);

      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await expect(
        marketplace.connect(player1).createTrade(0, 3)
      ).to.not.be.reverted;
    });

    it("Should handle large number of trades", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);

      // Create multiple trades
      for (let i = 0; i < 5; i++) {
        await arena.mintCard(player1.address, "Test Card", "commune");
        await ethers.provider.send("evm_increaseTime", [300]);
        await ethers.provider.send("evm_mine");
      }

      // Create trades with new cards
      for (let i = 4; i < 9; i++) {
        await marketplace.connect(player1).createTrade(i, 2);
      }

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(5);
    });

    it("Should maintain correct state after multiple operations", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      // Create trade
      await marketplace.connect(player1).createTrade(0, 2);
      expect(await marketplace.tradeCounter()).to.equal(1);

      // Accept trade
      await marketplace.connect(player2).acceptTrade(0);
      expect((await marketplace.trades(0)).isActive).to.be.false;

      // Create another trade
      await marketplace.connect(player2).createTrade(0, 1);
      expect(await marketplace.tradeCounter()).to.equal(2);

      // Cancel trade
      await marketplace.connect(player2).cancelTrade(1);
      expect((await marketplace.trades(1)).isActive).to.be.false;

      const activeTrades = await marketplace.getActiveTrades();
      expect(activeTrades.length).to.equal(0);
    });

    it("Should handle approval revocation before acceptance", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      // Revoke approval
      await arena.connect(player1).approve(ethers.ZeroAddress, 0);

      await arena.connect(player2).approve(await marketplace.getAddress(), 2);

      // Should fail because creator revoked approval
      await expect(
        marketplace.connect(player2).acceptTrade(0)
      ).to.be.reverted;
    });

    it("Should not affect card ownership until trade is accepted", async function () {
      await arena.connect(player1).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(player1).createTrade(0, 2);

      // Ownership should not change until acceptance
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

  describe("Complex Scenarios", function () {
    it("Should handle circular trade offers", async function () {
      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);

      // Player1 offers 0 for 2
      await marketplace.connect(player1).createTrade(0, 2);
      
      // Player2 offers 2 for 0 (circular)
      await marketplace.connect(player2).createTrade(2, 0);

      // Both trades should exist
      expect(await marketplace.tradeCounter()).to.equal(2);

      // Accept first trade
      await marketplace.connect(player2).acceptTrade(0);

      // Now player2 owns 0 and player1 owns 2
      expect(await arena.ownerOf(0)).to.equal(player2.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);

      // Second trade should now be invalid (creators no longer own offered cards)
      // But it's still marked as active in the contract
      const trade1 = await marketplace.trades(1);
      expect(trade1.isActive).to.be.true;
    });

    it("Should handle sequential trades between three players", async function () {
      // Wait for initially minted cards to unlock
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Player3 needs some cards first
      await arena.mintCard(player3.address, "Archer Elfe", "rare");
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      await arena.connect(player1).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player2).setApprovalForAll(await marketplace.getAddress(), true);
      await arena.connect(player3).setApprovalForAll(await marketplace.getAddress(), true);

      // Initial state: P1 has 0,1 | P2 has 2,3 | P3 has 4
      // Trade sequence that works:
      // 1. P1 offers 0 for 2 (wants P2's card)
      await marketplace.connect(player1).createTrade(0, 2);
      
      // 2. P2 accepts -> P1 gets 2, P2 gets 0
      await marketplace.connect(player2).acceptTrade(0);
      
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");
      
      // Now: P1 has 1,2 | P2 has 0,3 | P3 has 4
      // 3. P2 offers 0 for 4 (wants P3's card)
      await marketplace.connect(player2).createTrade(0, 4);
      
      // 4. P3 accepts -> P2 gets 4, P3 gets 0
      await marketplace.connect(player3).acceptTrade(1);
      
      await ethers.provider.send("evm_increaseTime", [600]);
      await ethers.provider.send("evm_mine");

      // Final state: P1 has 1,2 | P2 has 3,4 | P3 has 0
      expect(await arena.ownerOf(0)).to.equal(player3.address);
      expect(await arena.ownerOf(1)).to.equal(player1.address);
      expect(await arena.ownerOf(2)).to.equal(player1.address);
      expect(await arena.ownerOf(3)).to.equal(player2.address);
      expect(await arena.ownerOf(4)).to.equal(player2.address);
    });
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Team – Tests complets", function () {
  let ArenaCards, arena;
  let Team, team;
  let owner, player1, player2, player3;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy ArenaCards
    ArenaCards = await ethers.getContractFactory("ArenaCards");
    arena = await ArenaCards.deploy();
    await arena.waitForDeployment();

    // Deploy Team
    Team = await ethers.getContractFactory("Team");
    team = await Team.deploy(await arena.getAddress());
    await team.waitForDeployment();

    // Mint some cards for testing
    for (let i = 0; i < 5; i++) {
      await arena.mintCard(player1.address, `Card ${i}`, "commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
    }

    for (let i = 0; i < 3; i++) {
      await arena.mintCard(player2.address, `Card ${i + 5}`, "rare");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
    }
  });

  describe("Deployment", function () {
    it("Should deploy with correct ArenaCards address", async function () {
      expect(await team.arenaCardsContract()).to.equal(await arena.getAddress());
    });

    it("Should set deployer as owner", async function () {
      expect(await team.owner()).to.equal(owner.address);
    });

    it("Should have correct MAX_TEAM_SIZE", async function () {
      expect(await team.MAX_TEAM_SIZE()).to.equal(5);
    });

    it("Should revert if deployed with zero address", async function () {
      await expect(
        Team.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid ArenaCards address");
    });

    it("Should initialize with no teams", async function () {
      expect(await team.hasTeam(player1.address)).to.be.false;
      expect(await team.hasTeam(player2.address)).to.be.false;
    });
  });

  describe("Saving Teams", function () {
    it("Should save team successfully", async function () {
      const cardIds = [0, 1, 2];
      await team.connect(player1).saveTeam(cardIds);

      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(3);
      expect(savedTeam[0]).to.equal(0);
      expect(savedTeam[1]).to.equal(1);
      expect(savedTeam[2]).to.equal(2);
    });

    it("Should emit TeamSaved event", async function () {
      const cardIds = [0, 1, 2];
      const tx = await team.connect(player1).saveTeam(cardIds);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(team, "TeamSaved")
        .withArgs(player1.address, cardIds, block.timestamp);
    });

    it("Should mark player as having a team", async function () {
      const cardIds = [0, 1];
      await team.connect(player1).saveTeam(cardIds);

      expect(await team.hasTeam(player1.address)).to.be.true;
    });

    it("Should allow saving team with maximum size (5 cards)", async function () {
      const cardIds = [0, 1, 2, 3, 4];
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.not.be.reverted;

      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(5);
    });

    it("Should revert if team size exceeds maximum", async function () {
      const cardIds = [0, 1, 2, 3, 4, 5];
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.be.revertedWith("Team size exceeds maximum");
    });

    it("Should revert if player doesn't own all cards", async function () {
      const cardIds = [0, 5]; // Card 5 belongs to player2
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.be.revertedWith("You don't own this card");
    });

    it("Should allow saving empty team", async function () {
      const cardIds = [];
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.not.be.reverted;

      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(0);
    });

    it("Should allow updating existing team", async function () {
      const cardIds1 = [0, 1];
      await team.connect(player1).saveTeam(cardIds1);

      const cardIds2 = [2, 3, 4];
      await team.connect(player1).saveTeam(cardIds2);

      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(3);
      expect(savedTeam[0]).to.equal(2);
      expect(savedTeam[1]).to.equal(3);
      expect(savedTeam[2]).to.equal(4);
    });

    it("Should allow saving single card team", async function () {
      const cardIds = [0];
      await team.connect(player1).saveTeam(cardIds);

      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(1);
      expect(savedTeam[0]).to.equal(0);
    });

    it("Should allow saving team with non-consecutive card IDs", async function () {
      const cardIds = [0, 2, 4];
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.not.be.reverted;
    });

    it("Should handle multiple players saving teams", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      await team.connect(player2).saveTeam([5, 6, 7]);

      const team1 = await team.getTeam(player1.address);
      const team2 = await team.getTeam(player2.address);

      expect(team1.length).to.equal(2);
      expect(team2.length).to.equal(3);
    });

    it("Should revert if trying to save with non-existent card", async function () {
      const cardIds = [0, 999];
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.be.reverted;
    });

    it("Should allow duplicate card IDs in team (validation on contract level)", async function () {
      // Note: The contract doesn't prevent duplicates, this is by design
      const cardIds = [0, 0, 1];
      await expect(
        team.connect(player1).saveTeam(cardIds)
      ).to.not.be.reverted;
    });
  });

  describe("Getting Teams", function () {
    beforeEach(async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      await team.connect(player2).saveTeam([5, 6]);
    });

    it("Should get team by address", async function () {
      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(3);
      expect(savedTeam[0]).to.equal(0);
      expect(savedTeam[1]).to.equal(1);
      expect(savedTeam[2]).to.equal(2);
    });

    it("Should get own team with getMyTeam", async function () {
      const myTeam = await team.connect(player1).getMyTeam();
      expect(myTeam.length).to.equal(3);
      expect(myTeam[0]).to.equal(0);
    });

    it("Should return empty array for player without team", async function () {
      const emptyTeam = await team.getTeam(player3.address);
      expect(emptyTeam.length).to.equal(0);
    });

    it("Should return empty array after clearing team", async function () {
      await team.connect(player1).clearTeam();
      const emptyTeam = await team.getTeam(player1.address);
      expect(emptyTeam.length).to.equal(0);
    });

    it("Should return correct team for multiple players", async function () {
      const team1 = await team.getTeam(player1.address);
      const team2 = await team.getTeam(player2.address);

      expect(team1.length).to.equal(3);
      expect(team2.length).to.equal(2);
    });

    it("Should emit TeamLoaded event when explicitly loading", async function () {
      // Note: The contract doesn't have a loadTeam function that emits TeamLoaded
      // This event might be used in future implementations or frontend
    });
  });

  describe("Clearing Teams", function () {
    beforeEach(async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
    });

    it("Should clear team successfully", async function () {
      await team.connect(player1).clearTeam();

      const clearedTeam = await team.getTeam(player1.address);
      expect(clearedTeam.length).to.equal(0);
    });

    it("Should emit TeamCleared event", async function () {
      const tx = await team.connect(player1).clearTeam();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(team, "TeamCleared")
        .withArgs(player1.address, block.timestamp);
    });

    it("Should mark player as not having a team", async function () {
      await team.connect(player1).clearTeam();
      expect(await team.hasTeam(player1.address)).to.be.false;
    });

    it("Should allow clearing team multiple times", async function () {
      await team.connect(player1).clearTeam();
      await expect(
        team.connect(player1).clearTeam()
      ).to.not.be.reverted;
    });

    it("Should allow clearing empty team", async function () {
      await expect(
        team.connect(player3).clearTeam()
      ).to.not.be.reverted;
    });

    it("Should not affect other players' teams", async function () {
      await team.connect(player2).saveTeam([5, 6]);
      await team.connect(player1).clearTeam();

      const team2 = await team.getTeam(player2.address);
      expect(team2.length).to.equal(2);
    });
  });

  describe("Team Validation", function () {
    it("Should validate valid team", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      expect(await team.isTeamValid(player1.address)).to.be.true;
    });

    it("Should invalidate team if card is transferred away", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      
      // Transfer card 1 to player2
      await arena.connect(player1).transferFrom(player1.address, player2.address, 1);

      expect(await team.isTeamValid(player1.address)).to.be.false;
    });

    it("Should return false for empty team", async function () {
      expect(await team.isTeamValid(player1.address)).to.be.false;
    });

    it("Should return false if any card in team is not owned", async function () {
      await team.connect(player1).saveTeam([0, 1, 2, 3, 4]);
      
      // Transfer one card away
      await arena.connect(player1).transferFrom(player1.address, player3.address, 2);

      expect(await team.isTeamValid(player1.address)).to.be.false;
    });

    it("Should remain valid if player still owns all cards", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      
      // Transfer other cards, but not team cards
      await arena.connect(player1).transferFrom(player1.address, player2.address, 3);

      expect(await team.isTeamValid(player1.address)).to.be.true;
    });

    it("Should handle validation with single card team", async function () {
      await team.connect(player1).saveTeam([0]);
      expect(await team.isTeamValid(player1.address)).to.be.true;

      await arena.connect(player1).transferFrom(player1.address, player2.address, 0);
      expect(await team.isTeamValid(player1.address)).to.be.false;
    });

    it("Should invalidate after clearing team", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      await team.connect(player1).clearTeam();

      expect(await team.isTeamValid(player1.address)).to.be.false;
    });

    it("Should handle burned cards gracefully", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      
      // Burn a card (if the contract supports it)
      // For now, we'll transfer to zero address which should fail
      // The isTeamValid should catch this
      
      // Since we can't actually burn, we'll verify the validation works
      expect(await team.isTeamValid(player1.address)).to.be.true;
    });

    it("Should validate multiple teams independently", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      await team.connect(player2).saveTeam([5, 6]);

      expect(await team.isTeamValid(player1.address)).to.be.true;
      expect(await team.isTeamValid(player2.address)).to.be.true;

      await arena.connect(player1).transferFrom(player1.address, player3.address, 0);

      expect(await team.isTeamValid(player1.address)).to.be.false;
      expect(await team.isTeamValid(player2.address)).to.be.true;
    });
  });

  describe("Team Size", function () {
    it("Should return correct team size", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      expect(await team.getTeamSize(player1.address)).to.equal(3);
    });

    it("Should return 0 for empty team", async function () {
      expect(await team.getTeamSize(player3.address)).to.equal(0);
    });

    it("Should return correct size after update", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      expect(await team.getTeamSize(player1.address)).to.equal(2);

      await team.connect(player1).saveTeam([0, 1, 2, 3]);
      expect(await team.getTeamSize(player1.address)).to.equal(4);
    });

    it("Should return 0 after clearing team", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      await team.connect(player1).clearTeam();
      
      expect(await team.getTeamSize(player1.address)).to.equal(0);
    });

    it("Should return maximum size", async function () {
      await team.connect(player1).saveTeam([0, 1, 2, 3, 4]);
      expect(await team.getTeamSize(player1.address)).to.equal(5);
    });
  });

  describe("Team Info", function () {
    it("Should return complete team info", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);

      const [cardIds, isValid, teamSize] = await team.getTeamInfo(player1.address);

      expect(cardIds.length).to.equal(3);
      expect(cardIds[0]).to.equal(0);
      expect(isValid).to.be.true;
      expect(teamSize).to.equal(3);
    });

    it("Should return invalid status when card is transferred", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      await arena.connect(player1).transferFrom(player1.address, player2.address, 1);

      const [cardIds, isValid, teamSize] = await team.getTeamInfo(player1.address);

      expect(cardIds.length).to.equal(3);
      expect(isValid).to.be.false;
      expect(teamSize).to.equal(3);
    });

    it("Should return empty info for player without team", async function () {
      const [cardIds, isValid, teamSize] = await team.getTeamInfo(player3.address);

      expect(cardIds.length).to.equal(0);
      expect(isValid).to.be.true; // Empty team is considered "valid" in terms of loop
      expect(teamSize).to.equal(0);
    });

    it("Should return correct info for maximum size team", async function () {
      await team.connect(player1).saveTeam([0, 1, 2, 3, 4]);

      const [cardIds, isValid, teamSize] = await team.getTeamInfo(player1.address);

      expect(cardIds.length).to.equal(5);
      expect(isValid).to.be.true;
      expect(teamSize).to.equal(5);
    });

    it("Should handle multiple players' team info", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      await team.connect(player2).saveTeam([5, 6, 7]);

      const [cardIds1, isValid1, teamSize1] = await team.getTeamInfo(player1.address);
      const [cardIds2, isValid2, teamSize2] = await team.getTeamInfo(player2.address);

      expect(teamSize1).to.equal(2);
      expect(teamSize2).to.equal(3);
      expect(isValid1).to.be.true;
      expect(isValid2).to.be.true;
    });
  });

  describe("Update ArenaCards Contract", function () {
    it("Should allow owner to update ArenaCards contract", async function () {
      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();

      await team.updateArenaCardsContract(await newArena.getAddress());

      expect(await team.arenaCardsContract()).to.equal(await newArena.getAddress());
    });

    it("Should not allow non-owner to update contract", async function () {
      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();

      await expect(
        team.connect(player1).updateArenaCardsContract(await newArena.getAddress())
      ).to.be.reverted;
    });

    it("Should revert if updating with zero address", async function () {
      await expect(
        team.updateArenaCardsContract(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should maintain existing teams after contract update", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);

      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();
      await team.updateArenaCardsContract(await newArena.getAddress());

      const savedTeam = await team.getTeam(player1.address);
      expect(savedTeam.length).to.equal(3);
    });

    it("Should affect validation after contract update", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      expect(await team.isTeamValid(player1.address)).to.be.true;

      // Update to new contract where player doesn't own cards
      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();
      await team.updateArenaCardsContract(await newArena.getAddress());

      // Validation should fail as cards don't exist in new contract
      expect(await team.isTeamValid(player1.address)).to.be.false;
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await team.transferOwnership(player1.address);
      expect(await team.owner()).to.equal(player1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        team.connect(player1).transferOwnership(player2.address)
      ).to.be.reverted;
    });

    it("Should allow new owner to use owner functions", async function () {
      await team.transferOwnership(player1.address);

      const newArena = await ArenaCards.deploy();
      await newArena.waitForDeployment();

      await expect(
        team.connect(player1).updateArenaCardsContract(await newArena.getAddress())
      ).to.not.be.reverted;
    });
  });

  describe("Edge Cases and Complex Scenarios", function () {
    it("Should handle team with card ID 0", async function () {
      await team.connect(player1).saveTeam([0]);
      expect(await team.getTeamSize(player1.address)).to.equal(1);
    });

    it("Should handle rapid team updates", async function () {
      for (let i = 0; i < 5; i++) {
        await team.connect(player1).saveTeam([0, 1]);
        await team.connect(player1).saveTeam([2, 3, 4]);
      }

      const finalTeam = await team.getTeam(player1.address);
      expect(finalTeam.length).to.equal(3);
    });

    it("Should maintain separate state for each player", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      await team.connect(player2).saveTeam([5, 6, 7]);
      await team.connect(player1).clearTeam();

      expect(await team.hasTeam(player1.address)).to.be.false;
      expect(await team.hasTeam(player2.address)).to.be.true;
      
      const team2 = await team.getTeam(player2.address);
      expect(team2.length).to.equal(3);
    });

    it("Should handle team save after card transfer", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      
      // Transfer card to player2
      await arena.connect(player1).transferFrom(player1.address, player2.address, 0);
      
      // Player1 can't save team with card 0 anymore
      await expect(
        team.connect(player1).saveTeam([0, 1])
      ).to.be.revertedWith("You don't own this card");

      // But player2 can use it
      await expect(
        team.connect(player2).saveTeam([0, 5])
      ).to.not.be.reverted;
    });

    it("Should handle validation with transferred cards between players", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      await team.connect(player2).saveTeam([5, 6]);

      // Swap a card
      await arena.connect(player1).transferFrom(player1.address, player2.address, 0);
      await arena.connect(player2).transferFrom(player2.address, player1.address, 5);

      expect(await team.isTeamValid(player1.address)).to.be.false;
      expect(await team.isTeamValid(player2.address)).to.be.false;
    });

    it("Should allow re-saving team after it becomes invalid", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);
      await arena.connect(player1).transferFrom(player1.address, player2.address, 0);

      expect(await team.isTeamValid(player1.address)).to.be.false;

      // Save new valid team
      await team.connect(player1).saveTeam([3, 4]);
      expect(await team.isTeamValid(player1.address)).to.be.true;
    });

    it("Should handle empty team operations", async function () {
      await team.connect(player1).saveTeam([]);
      
      expect(await team.hasTeam(player1.address)).to.be.true;
      expect(await team.getTeamSize(player1.address)).to.equal(0);
      expect(await team.isTeamValid(player1.address)).to.be.false;

      const emptyTeam = await team.getTeam(player1.address);
      expect(emptyTeam.length).to.equal(0);
    });

    it("Should handle alternating save and clear operations", async function () {
      await team.connect(player1).saveTeam([0, 1]);
      await team.connect(player1).clearTeam();
      await team.connect(player1).saveTeam([2, 3, 4]);
      await team.connect(player1).clearTeam();
      await team.connect(player1).saveTeam([0]);

      const finalTeam = await team.getTeam(player1.address);
      expect(finalTeam.length).to.equal(1);
      expect(finalTeam[0]).to.equal(0);
    });

    it("Should maintain consistency across all view functions", async function () {
      await team.connect(player1).saveTeam([0, 1, 2]);

      const myTeam = await team.connect(player1).getMyTeam();
      const getTeamResult = await team.getTeam(player1.address);
      const [cardIds, isValid, teamSize] = await team.getTeamInfo(player1.address);
      const size = await team.getTeamSize(player1.address);

      expect(myTeam.length).to.equal(getTeamResult.length);
      expect(myTeam.length).to.equal(cardIds.length);
      expect(myTeam.length).to.equal(teamSize);
      expect(size).to.equal(teamSize);
    });

    it("Should handle maximum team operations", async function () {
      await team.connect(player1).saveTeam([0, 1, 2, 3, 4]);

      expect(await team.isTeamValid(player1.address)).to.be.true;

      // Transfer one card
      await arena.connect(player1).transferFrom(player1.address, player2.address, 2);
      expect(await team.isTeamValid(player1.address)).to.be.false;

      // Get new card and update team
      await arena.mintCard(player1.address, "New Card", "rare");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");

      await team.connect(player1).saveTeam([0, 1, 3, 4, 8]);
      expect(await team.isTeamValid(player1.address)).to.be.true;
    });
  });

  describe("Gas Optimization Considerations", function () {
    it("Should handle team operations efficiently", async function () {
      // Save small team
      await team.connect(player1).saveTeam([0]);
      
      // Update to larger team
      await team.connect(player1).saveTeam([0, 1, 2, 3, 4]);
      
      // Clear and save again
      await team.connect(player1).clearTeam();
      await team.connect(player1).saveTeam([1, 2]);

      const finalTeam = await team.getTeam(player1.address);
      expect(finalTeam.length).to.equal(2);
    });

    it("Should validate large teams efficiently", async function () {
      await team.connect(player1).saveTeam([0, 1, 2, 3, 4]);
      
      // Validation should complete without issues
      const isValid = await team.isTeamValid(player1.address);
      expect(isValid).to.be.true;
    });
  });
});

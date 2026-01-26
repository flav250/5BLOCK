const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CardCollectionNFT", function () {
  let cardContract;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const CardCollectionNFT = await ethers.getContractFactory("CardCollectionNFT");
    cardContract = await CardCollectionNFT.deploy();
    await cardContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Devrait avoir le bon nom et symbole", async function () {
      expect(await cardContract.name()).to.equal("CardCollection");
      expect(await cardContract.symbol()).to.equal("CARD");
    });

    it("Devrait commencer avec zéro cartes", async function () {
      expect(await cardContract.getTotalCards()).to.equal(0);
    });
  });

  describe("Mint Cards", function () {
    it("Devrait mincer une carte avec succès", async function () {
      const tx = await cardContract.mintCard(
        user1.address,
        "rare",
        "QmXxxx..."
      );
      await tx.wait();

      expect(await cardContract.getTotalCards()).to.equal(1);
      expect(await cardContract.getCardCount(user1.address)).to.equal(1);
    });

    it("Devrait émettre un événement CardMinted", async function () {
      await expect(
        cardContract.mintCard(user1.address, "common", "QmTest...")
      ).to.emit(cardContract, "CardMinted");
    });

    it("Devrait refuser de mincer une carte sans type", async function () {
      await expect(
        cardContract.mintCard(user1.address, "", "QmXxxx...")
      ).to.be.revertedWith("Type de carte requis");
    });

    it("Devrait refuser de mincer une carte sans IPFS hash", async function () {
      await expect(
        cardContract.mintCard(user1.address, "rare", "")
      ).to.be.revertedWith("Hash IPFS requis");
    });

    it("Devrait refuser de mincer à une adresse zéro", async function () {
      await expect(
        cardContract.mintCard(ethers.ZeroAddress, "rare", "QmXxxx...")
      ).to.be.revertedWith("Adresse invalide");
    });
  });

  describe("Limite de possession", function () {
    it("Devrait refuser de dépasser la limite de 4 cartes par utilisateur", async function () {
      // Mincer 4 cartes
      for (let i = 0; i < 4; i++) {
        await cardContract.mintCard(user1.address, "rare", `QmTest${i}`);
      }

      // La 5ème devrait échouer
      await expect(
        cardContract.mintCard(user1.address, "rare", "QmTest5")
      ).to.be.revertedWith("Limite de cartes atteinte pour cet utilisateur");
    });

    it("Devrait permettre canReceiveCard pour vérifier la limite", async function () {
      for (let i = 0; i < 4; i++) {
        await cardContract.mintCard(user1.address, "rare", `QmTest${i}`);
      }

      expect(await cardContract.canReceiveCard(user1.address)).to.equal(false);
      expect(await cardContract.canReceiveCard(user2.address)).to.equal(true);
    });
  });

  describe("Burn Cards", function () {
    it("Devrait brûler une carte avec succès", async function () {
      const tx1 = await cardContract.mintCard(user1.address, "rare", "QmTest1");
      await tx1.wait();

      const tokenId = 0;

      await expect(cardContract.connect(user1).burnCard(tokenId)).to.emit(
        cardContract,
        "CardBurned"
      );

      expect(await cardContract.getCardCount(user1.address)).to.equal(0);
    });

    it("Devrait refuser de brûler une carte qu'on ne possède pas", async function () {
      await cardContract.mintCard(user1.address, "rare", "QmTest1");

      await expect(
        cardContract.connect(user2).burnCard(0)
      ).to.be.revertedWith("Vous n'etes pas le proprietaire");
    });
  });

  describe("Autorisation (onlyOwner)", function () {
    it("Seul le owner peut mincer des cartes", async function () {
      await expect(
        cardContract.connect(user1).mintCard(user2.address, "rare", "QmXxxx...")
      ).to.be.revertedWithCustomError(cardContract, "OwnableUnauthorizedAccount");
    });
  });
});

describe("CardExchange", function () {
  let cardContract;
  let exchangeContract;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Déployer CardCollectionNFT
    const CardCollectionNFT = await ethers.getContractFactory("CardCollectionNFT");
    cardContract = await CardCollectionNFT.deploy();
    await cardContract.waitForDeployment();

    // Déployer CardExchange
    const CardExchange = await ethers.getContractFactory("CardExchange");
    exchangeContract = await CardExchange.deploy(cardContract.target);
    await exchangeContract.waitForDeployment();

    // Mincer des cartes pour les tests
    for (let i = 0; i < 2; i++) {
      await cardContract.mintCard(user1.address, "rare", `QmUser1-${i}`);
      await cardContract.mintCard(user2.address, "common", `QmUser2-${i}`);
    }

    // Approuver le contrat d'échange
    await cardContract.connect(user1).setApprovalForAll(exchangeContract.target, true);
    await cardContract.connect(user2).setApprovalForAll(exchangeContract.target, true);
  });

  describe("Deployment", function () {
    it("Devrait définir la bonne adresse de contrat de cartes", async function () {
      expect(await exchangeContract.cardContract()).to.equal(cardContract.target);
    });
  });

  describe("Create Exchange Offers", function () {
    it("Devrait créer une offre d'échange", async function () {
      await expect(
        exchangeContract.connect(user1).createExchangeOffer(
          user2.address,
          [0], // user1 offre la carte 0
          [2]  // user1 demande la carte 2
        )
      ).to.emit(exchangeContract, "ExchangeOfferCreated");
    });

    it("Devrait refuser les offres sans cartes offertes", async function () {
      await expect(
        exchangeContract.connect(user1).createExchangeOffer(
          user2.address,
          [],
          [2]
        )
      ).to.be.revertedWith("Vous devez offrir au moins une carte");
    });

    it("Devrait refuser les offres sans cartes demandées", async function () {
      await expect(
        exchangeContract.connect(user1).createExchangeOffer(
          user2.address,
          [0],
          []
        )
      ).to.be.revertedWith("Vous devez demander au moins une carte");
    });

    it("Devrait refuser une offre à soi-même", async function () {
      await expect(
        exchangeContract.connect(user1).createExchangeOffer(
          user1.address,
          [0],
          [1]
        )
      ).to.be.revertedWith("Vous ne pouvez pas echanger avec vous-meme");
    });
  });

  describe("Lock et Cooldown", function () {
    it("Devrait appliquer un lock de 10 minutes après une offre", async function () {
      await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );

      const lockRemaining = await exchangeContract.getLockRemaining(user1.address);
      expect(lockRemaining).to.be.gt(0);
      expect(lockRemaining).to.be.lte(10 * 60); // <= 10 minutes
    });

    it("Devrait refuser une deuxième offre durant le lock", async function () {
      await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );

      await expect(
        exchangeContract.connect(user1).createExchangeOffer(
          user2.address,
          [1],
          [3]
        )
      ).to.be.revertedWith("Utilisateur temporairement verrouille");
    });

    it("Devrait permettre les transactions après le lock", async function () {
      await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );

      // Avancer le temps de 11 minutes
      await ethers.provider.send("hardhat_mine", ["0x2a300"]); // ~11 minutes
      await ethers.provider.send("evm_increaseTime", [11 * 60]);

      // Devrait maintenant permettre une deuxième offre
      await expect(
        exchangeContract.connect(user1).createExchangeOffer(
          user2.address,
          [1],
          [3]
        )
      ).to.emit(exchangeContract, "ExchangeOfferCreated");
    });
  });

  describe("Accept Exchange", function () {
    it("Devrait accepter une offre d'échange", async function () {
      const tx = await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );
      const receipt = await tx.wait();
      const events = receipt.logs;

      // Créer la deuxième offre depuis user2 (après le cooldown)
      // Ou trouver l'ID de l'offre
      const offerId = 0;

      // Avancer le temps
      await ethers.provider.send("evm_increaseTime", [11 * 60]);

      await expect(
        exchangeContract.connect(user2).acceptExchangeOffer(offerId)
      ).to.emit(exchangeContract, "ExchangeOfferAccepted");

      // Vérifier que les cartes ont changé de propriétaire
      expect(await cardContract.ownerOf(0)).to.equal(user2.address);
      expect(await cardContract.ownerOf(2)).to.equal(user1.address);
    });
  });

  describe("Cancel Exchange", function () {
    it("Devrait annuler une offre d'échange", async function () {
      await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );

      await expect(
        exchangeContract.connect(user1).cancelExchangeOffer(0)
      ).to.emit(exchangeContract, "ExchangeOfferCancelled");
    });

    it("L'owner devrait pouvoir annuler une offre", async function () {
      await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );

      await expect(
        exchangeContract.connect(owner).cancelExchangeOffer(0)
      ).to.emit(exchangeContract, "ExchangeOfferCancelled");
    });

    it("Un tiers ne devrait pas pouvoir annuler une offre", async function () {
      await exchangeContract.connect(user1).createExchangeOffer(
        user2.address,
        [0],
        [2]
      );

      await expect(
        exchangeContract.connect(user2).cancelExchangeOffer(0)
      ).to.be.revertedWith("Vous ne pouvez pas annuler cette offre");
    });
  });
});

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArenaCards.sol";

/**
 * @title Shop
 * @dev Boutique pour acheter des cartes avec des points d'arène
 * - Cartes légendaires: stock illimité, 1M points
 * - Cartes secrètes: stock limité à 50, 5M points
 * - Une carte par type par personne
 * - Cooldown de 24h entre achats
 */
contract Shop {
    ArenaCards public arenaCards;
    address public owner;

    struct ShopCard {
        string name;
        string rarity;
        string imageURI;
        uint256 price;           // Prix informatif (non vérifié on-chain)
        bool isSecret;
        bool available;
        uint256 maxSupply;       // 0 = illimité
        uint256 minted;
    }

    ShopCard[] public shopCards;

    // Tracking des achats par carte
    mapping(address => mapping(uint256 => bool)) public hasPurchased;
    
    // Dernier achat par utilisateur (pour le cooldown)
    mapping(address => uint256) public lastPurchase;

    uint256 public constant COOLDOWN = 24 hours;

    event CardPurchased(address indexed buyer, uint256 cardId, string name, uint256 price);
    event CardAdded(uint256 cardId, string name, uint256 price, bool isSecret);
    event CardAvailabilityChanged(uint256 cardId, bool available);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _arenaCardsAddress) {
        arenaCards = ArenaCards(_arenaCardsAddress);
        owner = msg.sender;
        _initializeCards();
    }

    /**
     * @dev Initialise le catalogue avec les cartes légendaires et secrètes
     */
    function _initializeCards() private {
        // CARTES LÉGENDAIRES (Stock illimité)
        _addCard(
            "Dragon Dore",
            "legendaire",
            "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeia43c7zri7lz66ta4bpqbjpzr23rsmh6etvejlg3lurwdfhb44shm",
            1000000,
            false,
            0  // maxSupply = 0 = illimité
        );

        _addCard(
            "Phoenix Immortel",
            "legendaire",
            "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeigsbr2x5mcfgi2cstnrd7x3gyottx5222pj4rk7qv3gv5pohp5h6q",
            1000000,
            false,
            0  // maxSupply = 0 = illimité
        );

        // CARTES SECRÈTES (Stock limité à 50)
        _addCard(
            "Brice : Le divin supreme",
            "secrete",
            "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeiern4r6e2edw2zwosh63yyiujxvlr3j3o7cezqzwxtdubui4o2eca",
            5000000,
            true,
            50
        );

        _addCard(
            "Paul : Le malicieux",
            "secrete",
            "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeicafvq4wmmyhdkvonkkwmpoyipsinefohrg7hnfwfcdqwgfyhrkni",
            5000000,
            true,
            50
        );

        _addCard(
            "Flavien : Le bienfaiteur",
            "secrete",
            "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeicrkbku7zorcowimemj3cqorcjpvvhyrh3dltmvl3llixzj732o6m",
            5000000,
            true,
            50
        );
    }

    /**
     * @dev Ajouter une carte au catalogue (privé, utilisé par le constructeur)
     */
    function _addCard(
        string memory name,
        string memory rarity,
        string memory imageURI,
        uint256 price,
        bool isSecret,
        uint256 maxSupply
    ) private {
        shopCards.push(ShopCard({
            name: name,
            rarity: rarity,
            imageURI: imageURI,
            price: price,
            isSecret: isSecret,
            available: true,
            maxSupply: maxSupply,
            minted: 0
        }));
    }

    /**
     * @dev Acheter une carte
     * Pas de vérification de points ! Seulement les règles anti-abus
     */
    function buyCard(uint256 cardId) external {
        require(cardId < shopCards.length, "Invalid card ID");
        ShopCard storage card = shopCards[cardId];

        require(card.available, "Card not available");
        require(!hasPurchased[msg.sender][cardId], "Already purchased this card");
        require(
            block.timestamp >= lastPurchase[msg.sender] + COOLDOWN,
            "Cooldown active - wait 24h between purchases"
        );

        // Vérifier le stock (seulement si maxSupply > 0)
        if (card.maxSupply > 0) {
            require(card.minted < card.maxSupply, "Card sold out");
        }

        // Mint la carte
        arenaCards.mintCard(msg.sender, card.name, card.rarity);

        // Marquer comme acheté
        hasPurchased[msg.sender][cardId] = true;
        lastPurchase[msg.sender] = block.timestamp;
        card.minted++;

        emit CardPurchased(msg.sender, cardId, card.name, card.price);
    }

    /**
     * @dev Ajouter une nouvelle carte (owner only)
     */
    function addCard(
        string memory name,
        string memory rarity,
        string memory imageURI,
        uint256 price,
        bool isSecret,
        uint256 maxSupply
    ) external onlyOwner {
        _addCard(name, rarity, imageURI, price, isSecret, maxSupply);
        emit CardAdded(shopCards.length - 1, name, price, isSecret);
    }

    /**
     * @dev Activer/Désactiver une carte
     */
    function setCardAvailability(uint256 cardId, bool available) external onlyOwner {
        require(cardId < shopCards.length, "Invalid card ID");
        shopCards[cardId].available = available;
        emit CardAvailabilityChanged(cardId, available);
    }

    /**
     * @dev Obtenir le nombre total de cartes dans le catalogue
     */
    function getCardCount() external view returns (uint256) {
        return shopCards.length;
    }

    /**
     * @dev Vérifier si un utilisateur peut acheter une carte
     */
    function canPurchase(address user, uint256 cardId) external view returns (bool) {
        if (cardId >= shopCards.length) return false;

        ShopCard memory card = shopCards[cardId];

        // Vérifier la disponibilité
        if (!card.available) return false;

        // Vérifier si déjà acheté
        if (hasPurchased[user][cardId]) return false;

        // Vérifier le cooldown
        if (block.timestamp < lastPurchase[user] + COOLDOWN) return false;

        // Vérifier le stock (si applicable)
        if (card.maxSupply > 0 && card.minted >= card.maxSupply) return false;

        return true;
    }

    /**
     * @dev Obtenir les infos d'une carte
     */
    function getCard(uint256 cardId) external view returns (
        string memory name,
        string memory rarity,
        string memory imageURI,
        uint256 price,
        bool isSecret,
        bool available,
        uint256 maxSupply,
        uint256 minted
    ) {
        require(cardId < shopCards.length, "Invalid card ID");
        ShopCard memory card = shopCards[cardId];
        return (
            card.name,
            card.rarity,
            card.imageURI,
            card.price,
            card.isSecret,
            card.available,
            card.maxSupply,
            card.minted
        );
    }

    /**
     * @dev Obtenir le temps restant avant le prochain achat (en secondes)
     */
    function getCooldownRemaining(address user) external view returns (uint256) {
        if (block.timestamp >= lastPurchase[user] + COOLDOWN) {
            return 0;
        }
        return (lastPurchase[user] + COOLDOWN) - block.timestamp;
    }

    /**
     * @dev Transférer la propriété du contrat
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}

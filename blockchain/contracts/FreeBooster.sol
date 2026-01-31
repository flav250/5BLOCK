// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArenaCards.sol";

/**
 * @title FreeBooster
 * @dev Boosters GRATUITS avec cooldown
 * - 2 cartes par booster
 * - Cooldown de 10 minutes
 * - Drop rates: 0.1% legendaire, 10% epique, 20% rare, 25% peu commune, 44.9% commune
 */
contract FreeBooster {
    ArenaCards public arenaCards;
    address public owner;

    uint256 public constant FREE_BOOSTER_COOLDOWN = 10 minutes;
    uint256 public constant CARDS_PER_BOOSTER = 2;

    mapping(address => uint256) public lastBoosterOpen;

    struct CardTemplate {
        string name;
        string rarity;
        string imageURI;
    }

    CardTemplate[] public cardTemplates;

    event BoosterOpened(address indexed user, uint256 timestamp);
    event CardMinted(address indexed user, uint256 tokenId, string name, string rarity);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _arenaCardsAddress) {
        arenaCards = ArenaCards(_arenaCardsAddress);
        owner = msg.sender;
        _initializeCardTemplates();
    }

    /**
     * @dev Initialise tous les templates de cartes
     */
    function _initializeCardTemplates() private {
        // LÉGENDAIRES (0-1) - 2 cartes
        cardTemplates.push(CardTemplate({
            name: "Dragon Dore",
            rarity: "legendaire",
            imageURI: "https://via.placeholder.com/300x400/FF4500/FFFFFF?text=Dragon"
        }));

        cardTemplates.push(CardTemplate({
            name: "Phoenix Immortel",
            rarity: "legendaire",
            imageURI: "https://via.placeholder.com/300x400/FF6347/FFFFFF?text=Phoenix"
        }));

        // ÉPIQUES (2-4) - 3 cartes
        cardTemplates.push(CardTemplate({
            name: "Chevalier Noir",
            rarity: "epique",
            imageURI: "https://via.placeholder.com/300x400/800080/FFFFFF?text=Chevalier"
        }));

        cardTemplates.push(CardTemplate({
            name: "Mage des Glaces",
            rarity: "epique",
            imageURI: "https://via.placeholder.com/300x400/4169E1/FFFFFF?text=Mage"
        }));

        cardTemplates.push(CardTemplate({
            name: "Assassin Fantome",
            rarity: "epique",
            imageURI: "https://via.placeholder.com/300x400/9370DB/FFFFFF?text=Assassin"
        }));

        // RARES (5-7) - 3 cartes
        cardTemplates.push(CardTemplate({
            name: "Archer Elfe",
            rarity: "rare",
            imageURI: "https://via.placeholder.com/300x400/1E90FF/FFFFFF?text=Archer"
        }));

        cardTemplates.push(CardTemplate({
            name: "Paladin Sacre",
            rarity: "rare",
            imageURI: "https://via.placeholder.com/300x400/00CED1/000000?text=Paladin"
        }));

        cardTemplates.push(CardTemplate({
            name: "Druide Ancien",
            rarity: "rare",
            imageURI: "https://via.placeholder.com/300x400/32CD32/000000?text=Druide"
        }));

        // PEU COMMUNES (8-10) - 3 cartes
        cardTemplates.push(CardTemplate({
            name: "Guerrier Brave",
            rarity: "peu commune",
            imageURI: "https://via.placeholder.com/300x400/90EE90/000000?text=Guerrier"
        }));

        cardTemplates.push(CardTemplate({
            name: "Voleur Agile",
            rarity: "peu commune",
            imageURI: "https://via.placeholder.com/300x400/98FB98/000000?text=Voleur"
        }));

        cardTemplates.push(CardTemplate({
            name: "Pretre Sage",
            rarity: "peu commune",
            imageURI: "https://via.placeholder.com/300x400/AFEEEE/000000?text=Pretre"
        }));

        // COMMUNES (11-15) - 5 cartes
        cardTemplates.push(CardTemplate({
            name: "Gobelin Ruse",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/808080/FFFFFF?text=Gobelin"
        }));

        cardTemplates.push(CardTemplate({
            name: "Sorciere Noire",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/696969/FFFFFF?text=Sorciere"
        }));

        cardTemplates.push(CardTemplate({
            name: "Barbare Sauvage",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/778899/FFFFFF?text=Barbare"
        }));

        cardTemplates.push(CardTemplate({
            name: "Squelette Soldat",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/A9A9A9/FFFFFF?text=Squelette"
        }));

        cardTemplates.push(CardTemplate({
            name: "Slime Gluant",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/98FB98/000000?text=Slime"
        }));
    }

    function _random(uint256 seed) private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            seed
        )));
    }

    /**
     * @dev Sélectionne une carte selon les taux de drop
     */
    function _selectRandomCard(uint256 seed) private view returns (CardTemplate memory) {
        uint256 randomNum = _random(seed) % 1000;

        if (randomNum < 1) {
            // Légendaire: 0.1% (1/1000)
            uint256 index = _random(seed + 1) % 2;
            return cardTemplates[index];
        }
        else if (randomNum < 101) {
            // Épique: 10% (100/1000)
            uint256 index = 2 + (_random(seed + 2) % 3);
            return cardTemplates[index];
        }
        else if (randomNum < 301) {
            // Rare: 20% (200/1000)
            uint256 index = 5 + (_random(seed + 3) % 3);
            return cardTemplates[index];
        }
        else if (randomNum < 551) {
            // Peu Commune: 25% (250/1000)
            uint256 index = 8 + (_random(seed + 4) % 3);
            return cardTemplates[index];
        }
        else {
            // Commune: 44.9% (449/1000)
            uint256 index = 11 + (_random(seed + 5) % 5);
            return cardTemplates[index];
        }
    }

    function _mintBoosterCards(address user) private {
        for (uint256 i = 0; i < CARDS_PER_BOOSTER; i++) {
            CardTemplate memory selectedCard = _selectRandomCard(i);

            arenaCards.mintCard(
                user,
                selectedCard.name,
                selectedCard.rarity
            );

            emit CardMinted(user, arenaCards.tokenCounter() - 1, selectedCard.name, selectedCard.rarity);
        }
    }

    function openBooster() external {
        require(
            lastBoosterOpen[msg.sender] == 0 ||
            block.timestamp >= lastBoosterOpen[msg.sender] + FREE_BOOSTER_COOLDOWN,
            "Booster cooldown active"
        );

        uint256 currentBalance = arenaCards.balanceOf(msg.sender);
        require(
            currentBalance + CARDS_PER_BOOSTER <= arenaCards.MAX_CARDS(),
            "Not enough space for booster cards"
        );

        lastBoosterOpen[msg.sender] = block.timestamp;
        _mintBoosterCards(msg.sender);

        emit BoosterOpened(msg.sender, block.timestamp);
    }

    function getTimeUntilNextBooster(address user) external view returns (uint256) {
        if (lastBoosterOpen[user] == 0) {
            return 0;
        }

        uint256 nextAvailable = lastBoosterOpen[user] + FREE_BOOSTER_COOLDOWN;

        if (block.timestamp >= nextAvailable) {
            return 0;
        }

        return nextAvailable - block.timestamp;
    }

    function canOpenBooster(address user) external view returns (bool) {
        if (lastBoosterOpen[user] == 0) {
            return true;
        }

        return block.timestamp >= lastBoosterOpen[user] + FREE_BOOSTER_COOLDOWN;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}

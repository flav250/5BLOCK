// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArenaCards.sol";

/**
 * @title PremiumBooster
 * @dev Boosters PREMIUM payants
 * - 4 cartes par booster
 * - Pas de cooldown
 * - Drop rates: 1% legendaire, 20% epique, 40% rare, 39% peu commune, 0% commune
 * - Prix: 0.002 ETH
 */
contract PremiumBooster {
    ArenaCards public arenaCards;
    address public owner;

    uint256 public constant CARDS_PER_BOOSTER = 4;
    uint256 public boosterPrice = 0.002 ether;

    struct CardTemplate {
        string name;
        string rarity;
        string imageURI;
    }

    CardTemplate[] public cardTemplates;

    event BoosterOpened(address indexed user, uint256 timestamp, uint256 pricePaid);
    event CardMinted(address indexed user, uint256 tokenId, string name, string rarity);
    event PriceUpdated(uint256 newPrice);

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
     * @dev Initialise les templates (PAS de communes)
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
     * @dev Sélectionne une carte selon les taux premium (pas de communes)
     */
    function _selectRandomCard(uint256 seed) private view returns (CardTemplate memory) {
        uint256 randomNum = _random(seed) % 100;

        if (randomNum < 1) {
            // Légendaire: 1%
            uint256 index = _random(seed + 1) % 2;
            return cardTemplates[index];
        }
        else if (randomNum < 21) {
            // Épique: 20%
            uint256 index = 2 + (_random(seed + 2) % 3);
            return cardTemplates[index];
        }
        else if (randomNum < 61) {
            // Rare: 40%
            uint256 index = 5 + (_random(seed + 3) % 3);
            return cardTemplates[index];
        }
        else {
            // Peu Commune: 39%
            uint256 index = 8 + (_random(seed + 4) % 3);
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

    function openBooster() external payable {
        require(msg.value >= boosterPrice, "Insufficient payment");

        uint256 currentBalance = arenaCards.balanceOf(msg.sender);
        require(
            currentBalance + CARDS_PER_BOOSTER <= arenaCards.MAX_CARDS(),
            "Not enough space for booster cards"
        );

        _mintBoosterCards(msg.sender);

        emit BoosterOpened(msg.sender, block.timestamp, msg.value);
    }

    function setBoosterPrice(uint256 newPrice) external onlyOwner {
        boosterPrice = newPrice;
        emit PriceUpdated(newPrice);
    }

    function getBoosterPrice() external view returns (uint256) {
        return boosterPrice;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner).transfer(balance);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}

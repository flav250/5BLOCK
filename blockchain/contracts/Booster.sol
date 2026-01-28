// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArenaCards.sol";

/**
 * @title Booster
 * @dev Système de boosters pour mint des cartes NFT
 * Un booster contient 2 cartes aléatoires
 * Cooldown de 10 minutes entre chaque ouverture
 */
contract Booster {
    ArenaCards public arenaCards;
    
    uint256 public constant BOOSTER_COOLDOWN = 10 minutes;
    uint256 public constant CARDS_PER_BOOSTER = 2;
    
    // Dernière ouverture de booster par utilisateur
    mapping(address => uint256) public lastBoosterOpen;
    
    // Templates de cartes disponibles
    struct CardTemplate {
        string name;
        string rarity;
        string imageURI;
    }
    
    CardTemplate[] public cardTemplates;
    
    // Événements
    event BoosterOpened(address indexed user, uint256 timestamp);
    event CardMinted(address indexed user, uint256 tokenId, string name, string rarity);
    
    constructor(address _arenaCardsAddress) {
        arenaCards = ArenaCards(_arenaCardsAddress);
        
        // Initialiser les templates de cartes
        _initializeCardTemplates();
    }
    
    /**
     * @dev Initialise les templates de cartes avec des placeholders
     */
    function _initializeCardTemplates() private {
        // Légendaires (10%)
        cardTemplates.push(CardTemplate({
            name: "Dragon Dore",
            rarity: "legendaire",
            imageURI: "https://via.placeholder.com/300x400/FFD700/000000?text=Dragon+Dore"
        }));
        
        cardTemplates.push(CardTemplate({
            name: "Phoenix Immortel",
            rarity: "legendaire",
            imageURI: "https://via.placeholder.com/300x400/FF4500/FFFFFF?text=Phoenix"
        }));
        
        // Épiques (20%)
        cardTemplates.push(CardTemplate({
            name: "Chevalier Noir",
            rarity: "epique",
            imageURI: "https://via.placeholder.com/300x400/800080/FFFFFF?text=Chevalier+Noir"
        }));
        
        cardTemplates.push(CardTemplate({
            name: "Mage des Glaces",
            rarity: "epique",
            imageURI: "https://via.placeholder.com/300x400/4169E1/FFFFFF?text=Mage+Glaces"
        }));
        
        cardTemplates.push(CardTemplate({
            name: "Assassin Fantome",
            rarity: "epique",
            imageURI: "https://via.placeholder.com/300x400/9370DB/FFFFFF?text=Assassin"
        }));
        
        // Rares (30%)
        cardTemplates.push(CardTemplate({
            name: "Archer Elfe",
            rarity: "rare",
            imageURI: "https://via.placeholder.com/300x400/1E90FF/FFFFFF?text=Archer+Elfe"
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
        
        // Communes (40%)
        cardTemplates.push(CardTemplate({
            name: "Guerrier Brave",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/808080/FFFFFF?text=Guerrier"
        }));
        
        cardTemplates.push(CardTemplate({
            name: "Gobelin Ruse",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/A9A9A9/000000?text=Gobelin"
        }));
        
        cardTemplates.push(CardTemplate({
            name: "Squelette Soldat",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/696969/FFFFFF?text=Squelette"
        }));
        
        cardTemplates.push(CardTemplate({
            name: "Slime Gluant",
            rarity: "commune",
            imageURI: "https://via.placeholder.com/300x400/90EE90/000000?text=Slime"
        }));
    }
    
    /**
     * @dev Génère un nombre pseudo-aléatoire
     * Note: Ce n'est PAS sécurisé pour de vrais NFTs de valeur
     * Utiliser Chainlink VRF en production
     */
    function _random(uint256 seed) private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            seed
        )));
    }
    
    /**
     * @dev Sélectionne un template de carte aléatoire basé sur les probabilités
     * Légendaire: 10%, Épique: 20%, Rare: 30%, Commune: 40%
     */
    function _selectRandomCard(uint256 seed) private view returns (CardTemplate memory) {
        uint256 randomNum = _random(seed) % 100; // 0-99
        
        // Légendaire (0-9) = 10%
        if (randomNum < 10) {
            uint256 index = _random(seed + 1) % 2; // 0-1 (2 cartes légendaires)
            return cardTemplates[index];
        }
        // Épique (10-29) = 20%
        else if (randomNum < 30) {
            uint256 index = 2 + (_random(seed + 2) % 3); // 2-4 (3 cartes épiques)
            return cardTemplates[index];
        }
        // Rare (30-59) = 30%
        else if (randomNum < 60) {
            uint256 index = 5 + (_random(seed + 3) % 3); // 5-7 (3 cartes rares)
            return cardTemplates[index];
        }
        // Commune (60-99) = 40%
        else {
            uint256 index = 8 + (_random(seed + 4) % 4); // 8-11 (4 cartes communes)
            return cardTemplates[index];
        }
    }
    
    /**
     * @dev Ouvre un booster et mint 2 cartes aléatoires
     */
    function openBooster() external {
        // Vérifier le cooldown
        require(
            lastBoosterOpen[msg.sender] == 0 || 
            block.timestamp >= lastBoosterOpen[msg.sender] + BOOSTER_COOLDOWN,
            "Booster cooldown active"
        );
        
        // Vérifier que l'utilisateur peut recevoir 2 cartes supplémentaires
        uint256 currentBalance = arenaCards.balanceOf(msg.sender);
        require(
            currentBalance + CARDS_PER_BOOSTER <= arenaCards.MAX_CARDS(),
            "Not enough space for booster cards"
        );
        
        // Mettre à jour le cooldown
        lastBoosterOpen[msg.sender] = block.timestamp;
        
        emit BoosterOpened(msg.sender, block.timestamp);
        
        // Mint 2 cartes aléatoires
        for (uint256 i = 0; i < CARDS_PER_BOOSTER; i++) {
            CardTemplate memory card = _selectRandomCard(i);
            
            // Mint la carte via le contrat ArenaCards
            arenaCards.mintCard(
                msg.sender,
                card.imageURI,
                card.name,
                card.rarity
            );
            
            // Note: Le tokenId sera disponible dans les events du contrat ArenaCards
            emit CardMinted(msg.sender, arenaCards.tokenCounter() - 1, card.name, card.rarity);
        }
    }
    
    /**
     * @dev Retourne le temps restant avant le prochain booster
     */
    function getTimeUntilNextBooster(address user) external view returns (uint256) {
        if (lastBoosterOpen[user] == 0) {
            return 0; // Peut ouvrir immédiatement
        }
        
        uint256 nextAvailable = lastBoosterOpen[user] + BOOSTER_COOLDOWN;
        
        if (block.timestamp >= nextAvailable) {
            return 0; // Peut ouvrir maintenant
        }
        
        return nextAvailable - block.timestamp;
    }
    
    /**
     * @dev Vérifie si un utilisateur peut ouvrir un booster
     */
    function canOpenBooster(address user) external view returns (bool) {
        // Vérifier le cooldown
        if (lastBoosterOpen[user] != 0 && block.timestamp < lastBoosterOpen[user] + BOOSTER_COOLDOWN) {
            return false;
        }
        
        // Vérifier l'espace disponible
        uint256 currentBalance = arenaCards.balanceOf(user);
        if (currentBalance + CARDS_PER_BOOSTER > arenaCards.MAX_CARDS()) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Retourne le nombre de templates de cartes disponibles
     */
    function getTemplatesCount() external view returns (uint256) {
        return cardTemplates.length;
    }
    
    /**
     * @dev Retourne un template de carte par index
     */
    function getTemplate(uint256 index) external view returns (string memory name, string memory rarity, string memory imageURI) {
        require(index < cardTemplates.length, "Index out of bounds");
        CardTemplate memory template = cardTemplates[index];
        return (template.name, template.rarity, template.imageURI);
    }
}

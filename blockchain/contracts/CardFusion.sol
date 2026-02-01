// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArenaCards.sol";

/**
 * @title CardFusion
 * @dev Système de fusion de cartes
 * - Fusionne 2 cartes identiques (même nom, rareté, level)
 * - Crée une carte de level supérieur
 * - Cooldown de 5 minutes
 */
contract CardFusion {

    event CardsFused(
        address indexed player,
        uint256 tokenId1,
        uint256 tokenId2,
        uint256 newTokenId,
        uint256 newLevel
    );

    ArenaCards public arena;

    mapping(address => uint256) public lastFusion;
    uint256 public constant COOLDOWN = 5 minutes;

    constructor(address arenaAddress) {
        arena = ArenaCards(arenaAddress);
    }

    /**
     * @dev Fusionne deux cartes identiques
     * @param id1 Token ID de la première carte
     * @param id2 Token ID de la deuxième carte
     * @return newTokenId Token ID de la nouvelle carte fusionnée
     */
    function fuseCards(uint256 id1, uint256 id2) external returns (uint256) {

        require(block.timestamp >= lastFusion[msg.sender] + COOLDOWN, "Fusion cooldown active");
        require(id1 != id2, "Cannot fuse same card");

        require(arena.ownerOf(id1) == msg.sender, "Not owner of card 1");
        require(arena.ownerOf(id2) == msg.sender, "Not owner of card 2");

        (
            string memory name1,
            string memory rarity1,
            uint256 level1,
            // uint256 attack1 - pas besoin
        ) = arena.getCardStats(id1);

        (
            string memory name2,
            string memory rarity2,
            uint256 level2,
            // uint256 attack2 - pas besoin
        ) = arena.getCardStats(id2);

        require(
            keccak256(bytes(name1)) == keccak256(bytes(name2)),
            "Cards must have same name"
        );

        require(
            keccak256(bytes(rarity1)) == keccak256(bytes(rarity2)),
            "Cards must have same rarity"
        );

        require(level1 == level2, "Cards must have same level");
        require(level1 < 5, "Max level reached (5)");

        uint256 newLevel = level1 + 1;

        // Brûler les deux cartes
        arena.burnFromFusion(id1);
        arena.burnFromFusion(id2);

        // Créer la nouvelle carte fusionnée
        uint256 newTokenId = arena.mintFusion(
            msg.sender,
            name1,
            rarity1,
            newLevel
        );

        lastFusion[msg.sender] = block.timestamp;

        emit CardsFused(
            msg.sender,
            id1,
            id2,
            newTokenId,
            newLevel
        );

        return newTokenId;
    }

    /**
     * @dev Vérifie si une fusion est possible entre deux cartes
     * @param id1 Token ID de la première carte
     * @param id2 Token ID de la deuxième carte
     * @return canFuse True si la fusion est possible
     * @return reason Raison si la fusion n'est pas possible
     */
    function canFuseCards(uint256 id1, uint256 id2) external view returns (bool canFuse, string memory reason) {
        // Vérifier cooldown
        if (block.timestamp < lastFusion[msg.sender] + COOLDOWN) {
            return (false, "Fusion cooldown active");
        }

        // Vérifier que ce ne sont pas les mêmes cartes
        if (id1 == id2) {
            return (false, "Cannot fuse same card");
        }

        // Vérifier la propriété
        address owner1 = arena.ownerOf(id1);
        address owner2 = arena.ownerOf(id2);

        if (owner1 != msg.sender) {
            return (false, "Not owner of card 1");
        }

        if (owner2 != msg.sender) {
            return (false, "Not owner of card 2");
        }

        // Récupérer les stats
        (
            string memory name1,
            string memory rarity1,
            uint256 level1,
            // uint256 attack1
        ) = arena.getCardStats(id1);

        (
            string memory name2,
            string memory rarity2,
            uint256 level2,
            // uint256 attack2
        ) = arena.getCardStats(id2);

        // Vérifier le nom
        if (keccak256(bytes(name1)) != keccak256(bytes(name2))) {
            return (false, "Cards must have same name");
        }

        // Vérifier la rareté
        if (keccak256(bytes(rarity1)) != keccak256(bytes(rarity2))) {
            return (false, "Cards must have same rarity");
        }

        // Vérifier le level
        if (level1 != level2) {
            return (false, "Cards must have same level");
        }

        if (level1 >= 5) {
            return (false, "Max level reached (5)");
        }

        return (true, "Fusion possible");
    }

    /**
     * @dev Retourne le temps restant avant la prochaine fusion
     * @param user Adresse de l'utilisateur
     * @return timeRemaining Temps restant en secondes (0 si disponible)
     */
    function getTimeUntilNextFusion(address user) external view returns (uint256) {
        if (lastFusion[user] == 0) {
            return 0;
        }

        uint256 nextAvailable = lastFusion[user] + COOLDOWN;

        if (block.timestamp >= nextAvailable) {
            return 0;
        }

        return nextAvailable - block.timestamp;
    }
}

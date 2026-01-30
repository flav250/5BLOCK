// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArenaCards
 * @dev Contrat de cartes NFT avec système de fusion, cooldown et support booster
 */
contract ArenaCards is ERC721URIStorage, Ownable {

    uint256 public tokenCounter;

    uint256 public constant MAX_CARDS = 30;
    uint256 public constant COOLDOWN = 5 minutes;
    uint256 public constant LOCK_TIME = 10 minutes;

    // Adresse autorisée à mint (le contrat Booster)
    address public authorizedMinter;

    struct CardData {
        uint256 level;  
        string rarity;
        string name;
        uint256 createdAt;
        uint256 lastTransferAt;
    }

    // Mapping des détails de chaque carte
    mapping(uint256 => CardData) public cardDetails;
    
    // Historique des propriétaires pour chaque carte
    mapping(uint256 => address[]) public previousOwners;

    // Dernière action de chaque utilisateur (pour cooldown)
    mapping(address => uint256) public lastAction;
    
    // Timestamp jusqu'auquel une carte est verrouillée
    mapping(uint256 => uint256) public lockUntil;

    // Événements
    event CardMinted(uint256 indexed tokenId, address indexed owner, string name, string rarity);
    event CardsFused(uint256 indexed tokenId1, uint256 indexed tokenId2, uint256 indexed newTokenId, uint256 newLevel);
    event CardLocked(uint256 indexed tokenId, uint256 unlockTime);
    event AuthorizedMinterUpdated(address indexed newMinter);

    constructor() ERC721("Arena Cards", "ACARD") Ownable(msg.sender) {}

    /**
     * @dev Définit l'adresse autorisée à mint (contrat Booster)
     */
    function setAuthorizedMinter(address _minter) external onlyOwner {
        authorizedMinter = _minter;
        emit AuthorizedMinterUpdated(_minter);
    }

    /**
     * @dev Vérifie le cooldown de l'utilisateur
     */
    modifier cooldown(address user) {
        require(
            lastAction[user] == 0 || block.timestamp >= lastAction[user] + COOLDOWN,
            "Action on cooldown"
        );
        _;
    }

    /**
     * @dev Vérifie qu'une carte n'est pas verrouillée
     */
    modifier notLocked(uint256 tokenId) {
        require(block.timestamp >= lockUntil[tokenId], "Card is temporarily locked");
        _;
    }   

    /**
     * @dev Vérifie qu'un utilisateur n'a pas atteint le maximum de cartes
     */
    modifier maxCards(address user) {
        require(balanceOf(user) < MAX_CARDS, "Max cards reached");
        _;
    }   

    /**
     * @dev Mint une nouvelle carte
     * Peut être appelé par le owner OU le contrat autorisé (Booster)
     */
    function mintCard(
        address to,
        string memory tokenURI, 
        string memory name, 
        string memory rarity
    ) 
        external 
        maxCards(to)
    {
        // Vérifier que l'appelant est soit le owner, soit le minter autorisé
        require(
            msg.sender == owner() || msg.sender == authorizedMinter,
            "Not authorized to mint"
        );

        // Pas de cooldown pour le contrat Booster
        if (msg.sender != authorizedMinter) {
            require(
                lastAction[to] == 0 || block.timestamp >= lastAction[to] + COOLDOWN,
                "Action on cooldown"
            );
        }

        uint256 tokenId = tokenCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        cardDetails[tokenId] = CardData({
            level: 1,
            rarity: rarity,
            name: name,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });

        //lockUntil[tokenId] = block.timestamp + LOCK_TIME;
        
        // Mettre à jour lastAction seulement si ce n'est pas le Booster
        if (msg.sender != authorizedMinter) {
            lastAction[to] = block.timestamp;
        }

        tokenCounter++;

        emit CardMinted(tokenId, to, name, rarity);
    }

    /**
     * @dev Fusionne deux cartes pour en créer une plus puissante
     */
    function fusecards(
        uint256 tokenId1,
        uint256 tokenId2,
        string memory newTokenURI
    ) 
        external 
        cooldown(msg.sender)
        maxCards(msg.sender)
        notLocked(tokenId1)
        notLocked(tokenId2)
    {
        require(ownerOf(tokenId1) == msg.sender, "Not owner of card 1");
        require(ownerOf(tokenId2) == msg.sender, "Not owner of card 2");
        require(tokenId1 != tokenId2, "Cannot fuse same card");

        CardData memory card1 = cardDetails[tokenId1];
        CardData memory card2 = cardDetails[tokenId2];

        require(
            keccak256(bytes(card1.rarity)) == keccak256(bytes(card2.rarity)),
            "Rarities must match"
        );

        uint256 newLevel = card1.level + card2.level;
        string memory fusedName = string(abi.encodePacked(card1.name, "-", card2.name));

        _burn(tokenId1);
        _burn(tokenId2);

        delete cardDetails[tokenId1];
        delete cardDetails[tokenId2];

        uint256 newTokenId = tokenCounter;
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, newTokenURI);

        cardDetails[newTokenId] = CardData({
            level: newLevel,
            rarity: card1.rarity,
            name: fusedName,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });

        lockUntil[newTokenId] = block.timestamp + LOCK_TIME;
        lastAction[msg.sender] = block.timestamp;

        tokenCounter++;

        emit CardsFused(tokenId1, tokenId2, newTokenId, newLevel);
        emit CardLocked(newTokenId, lockUntil[newTokenId]);
    }

    /**
     * @dev Retourne l'historique des propriétaires d'une carte
     */
    function getPreviousOwners(uint256 tokenId) external view returns (address[] memory) {
        return previousOwners[tokenId];
    }

    /**
     * @dev Override de la fonction _update pour gérer les transferts
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0)) {
            require(block.timestamp >= lockUntil[tokenId], "Card is temporarily locked");

            previousOwners[tokenId].push(from);
            cardDetails[tokenId].lastTransferAt = block.timestamp;
        }

        return super._update(to, tokenId, auth);
    }
}

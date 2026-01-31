// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ArenaCards
 * @dev Contrat de cartes NFT avec système de stats
 * Actuellement: Attaque uniquement (structure prête pour expansion)
 */
contract ArenaCards is ERC721, Ownable {
    using Strings for uint256;

    uint256 public tokenCounter;

    uint256 public constant MAX_CARDS = 30;
    uint256 public constant COOLDOWN = 5 minutes;
    uint256 public constant LOCK_TIME = 10 minutes;

    mapping(address => bool) public authorizedMinters;

    modifier onlyAuthorized() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    function setAuthorizedMinter(address _minter, bool _authorized) external onlyOwner {
        authorizedMinters[_minter] = _authorized;
    }

    address public fusionContract;

    // Stats de la carte (extensible)
    struct CardStats {
        uint256 attack;
        // Prêt pour expansion future:
        // uint256 defense;
        // uint256 health;
        // uint256 speed;
    }

    struct CardData {
        uint256 level;
        string rarity;
        string name;
        uint256 createdAt;
        uint256 lastTransferAt;
        CardStats stats;
    }

    // Stats de base par carte
    struct BaseStats {
        uint256 attack;
        // Prêt pour expansion:
        // uint256 defense;
        // uint256 health;
        // uint256 speed;
    }

    mapping(string => mapping(string => BaseStats)) private baseStats;
    mapping(uint256 => CardData) public cardDetails;
    mapping(string => mapping(string => string)) private imageURIs;
    mapping(uint256 => address[]) public previousOwners;
    mapping(address => uint256) public lastAction;
    mapping(uint256 => uint256) public lockUntil;

    event CardMinted(uint256 indexed tokenId, address indexed owner, string name, string rarity);
    event CardsFused(uint256 indexed tokenId1, uint256 indexed tokenId2, uint256 indexed newTokenId, uint256 newLevel);
    event CardLocked(uint256 indexed tokenId, uint256 unlockTime);

    constructor() ERC721("Arena Cards", "ACARD") Ownable(msg.sender) {
        _initializeImageURIs();
        _initializeBaseStats();
    }

    /**
     * @dev Initialise les URLs des images
     */
    function _initializeImageURIs() private {
        string memory defaultURI = "https://plum-wrong-dog-715.mypinata.cloud/ipfs/bafkreidmuc2dqodhwfozbl6thnbr4bhvpmqf6xhvwmnn45m7qfycphtxvy";

        // Légendaires
        imageURIs["legendaire"]["Dragon Dore"] = defaultURI;
        imageURIs["legendaire"]["Phoenix Immortel"] = defaultURI;

        // Épiques
        imageURIs["epique"]["Chevalier Noir"] = defaultURI;
        imageURIs["epique"]["Mage des Glaces"] = defaultURI;
        imageURIs["epique"]["Assassin Fantome"] = defaultURI;

        // Rares
        imageURIs["rare"]["Archer Elfe"] = defaultURI;
        imageURIs["rare"]["Paladin Sacre"] = defaultURI;
        imageURIs["rare"]["Druide Ancien"] = defaultURI;

        // Peu communes
        imageURIs["peu commune"]["Guerrier Brave"] = defaultURI;
        imageURIs["peu commune"]["Voleur Agile"] = defaultURI;
        imageURIs["peu commune"]["Pretre Sage"] = defaultURI;

        // Communes
        imageURIs["commune"]["Gobelin Ruse"] = defaultURI;
        imageURIs["commune"]["Sorciere Noire"] = defaultURI;
        imageURIs["commune"]["Barbare Sauvage"] = defaultURI;
        imageURIs["commune"]["Squelette Soldat"] = defaultURI;
        imageURIs["commune"]["Slime Gluant"] = defaultURI;
    }

    /**
     * @dev Initialise les stats de base pour chaque carte
     */
    function _initializeBaseStats() private {
        // LÉGENDAIRES - ATK 100-150
        baseStats["legendaire"]["Dragon Dore"] = BaseStats({
            attack: 150
        });

        baseStats["legendaire"]["Phoenix Immortel"] = BaseStats({
            attack: 140
        });

        // ÉPIQUES - ATK 80-100
        baseStats["epique"]["Chevalier Noir"] = BaseStats({
            attack: 100
        });

        baseStats["epique"]["Mage des Glaces"] = BaseStats({
            attack: 90
        });

        baseStats["epique"]["Assassin Fantome"] = BaseStats({
            attack: 95
        });

        // RARES - ATK 60-80
        baseStats["rare"]["Archer Elfe"] = BaseStats({
            attack: 75
        });

        baseStats["rare"]["Paladin Sacre"] = BaseStats({
            attack: 70
        });

        baseStats["rare"]["Druide Ancien"] = BaseStats({
            attack: 65
        });

        // PEU COMMUNES - ATK 40-60
        baseStats["peu commune"]["Guerrier Brave"] = BaseStats({
            attack: 55
        });

        baseStats["peu commune"]["Voleur Agile"] = BaseStats({
            attack: 50
        });

        baseStats["peu commune"]["Pretre Sage"] = BaseStats({
            attack: 45
        });

        // COMMUNES - ATK 30-50
        baseStats["commune"]["Gobelin Ruse"] = BaseStats({
            attack: 45
        });

        baseStats["commune"]["Sorciere Noire"] = BaseStats({
            attack: 40
        });

        baseStats["commune"]["Barbare Sauvage"] = BaseStats({
            attack: 50
        });

        baseStats["commune"]["Squelette Soldat"] = BaseStats({
            attack: 35
        });

        baseStats["commune"]["Slime Gluant"] = BaseStats({
            attack: 30
        });
    }

    modifier cooldown(address user) {
        require(
            lastAction[user] == 0 || block.timestamp >= lastAction[user] + COOLDOWN,
            "Action on cooldown"
        );
        _;
    }

    modifier notLocked(uint256 tokenId) {
        require(block.timestamp >= lockUntil[tokenId], "Card is temporarily locked");
        _;
    }

    modifier maxCards(address user) {
        require(balanceOf(user) < MAX_CARDS, "Max cards reached");
        _;
    }

    modifier onlyFusion() {
        require(msg.sender == fusionContract, "Not fusion contract");
        _;
    }

    function setFusionContract(address _fusion) external onlyOwner {
        fusionContract = _fusion;
    }

    function burnFromFusion(uint256 tokenId) external onlyFusion {
        _burn(tokenId);
        delete cardDetails[tokenId];
    }

    /**
     * @dev Mint une carte depuis la fusion
     */
    function mintFusion(
        address to,
        string memory name,
        string memory rarity,
        uint256 level
    ) external onlyFusion returns (uint256) {
        uint256 tokenId = tokenCounter;
        _safeMint(to, tokenId);

        BaseStats memory base = baseStats[rarity][name];

        cardDetails[tokenId] = CardData({
            level: level,
            rarity: rarity,
            name: name,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp,
            stats: CardStats({
                attack: base.attack * level
            })
        });

        tokenCounter++;
        return tokenId;
    }

    /**
     * @dev Mint une nouvelle carte
     */
    function mintCard(
        address to,
        string memory name,
        string memory rarity
    ) external maxCards(to) {
        bool isMinter = authorizedMinters[msg.sender];
        require(msg.sender == owner() || isMinter, "Not authorized to mint");

        if (!isMinter) {
            require(
                lastAction[to] == 0 || block.timestamp >= lastAction[to] + COOLDOWN,
                "Action on cooldown"
            );
            lastAction[to] = block.timestamp;
        }

        uint256 tokenId = tokenCounter;

        lockUntil[tokenId] = block.timestamp + LOCK_TIME;
        emit CardLocked(tokenId, lockUntil[tokenId]);

        _safeMint(to, tokenId);

        BaseStats memory base = baseStats[rarity][name];

        cardDetails[tokenId] = CardData({
            level: 1,
            rarity: rarity,
            name: name,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp,
            stats: CardStats({
                attack: base.attack
            })
        });

        tokenCounter++;

        emit CardMinted(tokenId, to, name, rarity);
    }

    /**
     * @dev Override tokenURI pour générer les métadonnées on-chain
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        CardData memory card = cardDetails[tokenId];
        string memory imageURL = imageURIs[card.rarity][card.name];

        string memory json = string(abi.encodePacked(
            '{"name":"',
            card.name,
            ' #',
            tokenId.toString(),
            '","image":"',
            imageURL,
            '","attributes":[',
            '{"trait_type":"Rarity","value":"',
            card.rarity,
            '"},',
            '{"trait_type":"Level","value":',
            card.level.toString(),
            '},',
            '{"trait_type":"Attack","value":',
            card.stats.attack.toString(),
            '}',
            ']}'
        ));

        string memory base64Json = Base64.encode(bytes(json));
        return string(abi.encodePacked('data:application/json;base64,', base64Json));
    }

    /**
     * @dev Retourne les stats d'une carte
     */
    function getCardStats(uint256 tokenId) external view returns (
        string memory name,
        string memory rarity,
        uint256 level,
        uint256 attack
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        CardData memory card = cardDetails[tokenId];
        
        return (
            card.name,
            card.rarity,
            card.level,
            card.stats.attack
        );
    }

    /**
     * @dev Retourne les stats de base d'une carte
     */
    function getBaseStats(string memory rarity, string memory name) external view returns (
        uint256 attack
    ) {
        BaseStats memory stats = baseStats[rarity][name];
        return stats.attack;
    }

    /**
     * @dev Permet de modifier les stats de base (owner only)
     */
    function setBaseStats(
        string memory rarity,
        string memory name,
        uint256 attack
    ) external onlyOwner {
        baseStats[rarity][name] = BaseStats({
            attack: attack
        });
    }

    function getPreviousOwners(uint256 tokenId) external view returns (address[] memory) {
        return previousOwners[tokenId];
    }

    function setImageURI(string memory rarity, string memory name, string memory newImageURI) external onlyOwner {
        imageURIs[rarity][name] = newImageURI;
    }

    function getImageURI(string memory rarity, string memory name) external view returns (string memory) {
        return imageURIs[rarity][name];
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            require(block.timestamp >= lockUntil[tokenId], "Card is temporarily locked");
            previousOwners[tokenId].push(from);
            cardDetails[tokenId].lastTransferAt = block.timestamp;
        }

        return super._update(to, tokenId, auth);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ArenaCards
 * @dev Contrat de cartes NFT avec système de fusion, cooldown et support booster
 * Métadonnées on-chain pour affichage dans MetaMask
 */
contract ArenaCards is ERC721, Ownable {
    using Strings for uint256;

    uint256 public tokenCounter;

    uint256 public constant MAX_CARDS = 30;
    uint256 public constant COOLDOWN = 5 minutes;
    uint256 public constant LOCK_TIME = 10 minutes;

    // Adresse autorisée à mint (le contrat Booster)
    address public authorizedMinter;

    address public fusionContract;

    struct CardData {
        uint256 level;  
        string rarity;
        string name;
        uint256 createdAt;
        uint256 lastTransferAt;
    }

    // Mapping des détails de chaque carte
    mapping(uint256 => CardData) public cardDetails;
    
    // Mapping pour stocker les URLs des images: rarity => name => imageURI
    mapping(string => mapping(string => string)) private imageURIs;
    
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

    constructor() ERC721("Arena Cards", "ACARD") Ownable(msg.sender) {
        _initializeImageURIs();
    }
    
    /**
     * @dev Initialise les URLs des images pour chaque carte
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
        
        // Communes
        imageURIs["commune"]["Guerrier Brave"] = defaultURI;
        imageURIs["commune"]["Gobelin Ruse"] = defaultURI;
        imageURIs["commune"]["Squelette Soldat"] = defaultURI;
        imageURIs["commune"]["Slime Gluant"] = defaultURI;
    }

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

    function mintFusion(
        address to,
        string memory name,
        string memory rarity,
        uint256 level
    ) external onlyFusion returns (uint256){

        uint256 tokenId = tokenCounter;
        _safeMint(to, tokenId);

        cardDetails[tokenId] = CardData({
            level: level,
            rarity: rarity,
            name: name,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });


    tokenCounter++;
        return tokenId;
    }

    /**
     * @dev Mint une nouvelle carte
     * Peut être appelé par le owner OU le contrat autorisé (Booster)
     */
    function mintCard(
        address to,
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
     * @dev Override tokenURI pour générer les métadonnées on-chain
     * Retourne un JSON encodé en base64 compatible avec le standard ERC721
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        CardData memory card = cardDetails[tokenId];
        
        // Récupérer l'URL de l'image
        string memory imageURL = imageURIs[card.rarity][card.name];
        
        
        // Construire le JSON des métadonnées
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
            '{"trait_type":"Created At","value":',
            card.createdAt.toString(),
            '}',
            ']}'
        ));
        
        // Encoder en base64
        string memory base64Json = Base64.encode(bytes(json));
        
        // Retourner avec le préfixe data URI
        return string(abi.encodePacked('data:application/json;base64,', base64Json));
    }
    
    /**
     * @dev Retourne l'historique des propriétaires d'une carte
     */
    function getPreviousOwners(uint256 tokenId) external view returns (address[] memory) {
        return previousOwners[tokenId];
    }
    
    /**
     * @dev Permet de mettre à jour l'URL d'une image (owner seulement)
     */
    function setImageURI(string memory rarity, string memory name, string memory newImageURI) external onlyOwner {
        imageURIs[rarity][name] = newImageURI;
    }
    
    /**
     * @dev Retourne l'URL de l'image pour une carte donnée
     */
    function getImageURI(string memory rarity, string memory name) external view returns (string memory) {
        return imageURIs[rarity][name];
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

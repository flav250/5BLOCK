// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CardCollectionNFT
 * @dev Contrat ERC721 pour les cartes de collection avec métadonnées IPFS
 */
contract CardCollectionNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    // Identifiant unique pour chaque token
    uint256 private _tokenIdCounter;

    // Limite de possession par utilisateur (max 4 cartes)
    uint256 public constant MAX_CARDS_PER_USER = 4;

    // Mapping pour compter les cartes possédées par chaque utilisateur
    mapping(address => uint256) public cardCountPerUser;

    // Événement émis lors de la création d'une nouvelle carte
    event CardMinted(
        uint256 indexed tokenId,
        address indexed minter,
        string cardType,
        string ipfsHash
    );

    // Événement émis lors de la destruction d'une carte
    event CardBurned(uint256 indexed tokenId, address indexed owner);

    /**
     * @dev Initialise le contrat avec le nom et le symbole
     */
    constructor() ERC721("CardCollection", "CARD") {}

    /**
     * @dev Mint une nouvelle carte
     * @param to Adresse du propriétaire de la carte
     * @param cardType Type de carte (ex: "rare", "common", etc.)
     * @param ipfsHash Hash IPFS des métadonnées
     */
    function mintCard(
        address to,
        string memory cardType,
        string memory ipfsHash
    ) public onlyOwner nonReentrant returns (uint256) {
        require(to != address(0), "Adresse invalide");
        require(bytes(cardType).length > 0, "Type de carte requis");
        require(bytes(ipfsHash).length > 0, "Hash IPFS requis");
        require(
            cardCountPerUser[to] < MAX_CARDS_PER_USER,
            "Limite de cartes atteinte pour cet utilisateur"
        );

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, ipfsHash);

        cardCountPerUser[to]++;

        emit CardMinted(tokenId, to, cardType, ipfsHash);

        return tokenId;
    }

    /**
     * @dev Brûle une carte (la supprime du circulation)
     * @param tokenId ID du token à brûler
     */
    function burnCard(uint256 tokenId) public nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Vous n'etes pas le proprietaire");

        address owner = msg.sender;
        _burn(tokenId);
        cardCountPerUser[owner]--;

        emit CardBurned(tokenId, owner);
    }

    /**
     * @dev Retourne le nombre total de cartes créées
     */
    function getTotalCards() public view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Retourne le nombre de cartes possédées par un utilisateur
     */
    function getCardCount(address user) public view returns (uint256) {
        return cardCountPerUser[user];
    }

    /**
     * @dev Retourne true si un utilisateur peut recevoir une autre carte
     */
    function canReceiveCard(address user) public view returns (bool) {
        return cardCountPerUser[user] < MAX_CARDS_PER_USER;
    }

    /**
     * @dev Surchage de _update pour gérer le comptage lors des transferts
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = ownerOf(tokenId);

        // Décrémenter le compteur du propriétaire précédent
        if (from != address(0)) {
            cardCountPerUser[from]--;
        }

        // Incrémenter le compteur du nouveau propriétaire
        if (to != address(0)) {
            require(
                cardCountPerUser[to] < MAX_CARDS_PER_USER,
                "Limite de cartes atteinte"
            );
            cardCountPerUser[to]++;
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Retourne le URI de base pour les métadonnées
     */
    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://";
    }
}

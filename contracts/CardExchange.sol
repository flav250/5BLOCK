// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CardExchange
 * @dev Contrat pour gérer les échanges de cartes avec cooldown et lock temporaires
 */
contract CardExchange is ReentrancyGuard, Ownable {
    // Interface vers le contrat de cartes
    IERC721 public cardContract;

    // Cooldown: délai minimum entre deux transactions d'un utilisateur (5 minutes)
    uint256 public constant COOLDOWN_DURATION = 5 minutes;

    // Lock: durée du verrou après une action critique (10 minutes)
    uint256 public constant LOCK_DURATION = 10 minutes;

    // Mapping pour suivre le dernier temps de transaction par utilisateur (cooldown)
    mapping(address => uint256) public lastTransactionTime;

    // Mapping pour suivre le temps de déverrouillage par utilisateur
    mapping(address => uint256) public lockUntilTime;

    // Mapping pour les offres d'échange en attente
    struct ExchangeOffer {
        address offerer;
        uint256[] offeredTokenIds;
        address receiver;
        uint256[] requestedTokenIds;
        uint256 createdAt;
        bool isActive;
    }

    uint256 private _offerIdCounter;
    mapping(uint256 => ExchangeOffer) public exchangeOffers;

    // Événements
    event ExchangeOfferCreated(
        uint256 indexed offerId,
        address indexed offerer,
        address indexed receiver,
        uint256[] offeredTokenIds,
        uint256[] requestedTokenIds
    );

    event ExchangeOfferAccepted(
        uint256 indexed offerId,
        address indexed offerer,
        address indexed receiver
    );

    event ExchangeOfferCancelled(uint256 indexed offerId);

    event UserLocked(address indexed user, uint256 unlockedAt);

    event CooldownApplied(address indexed user, uint256 availableAt);

    /**
     * @dev Initialise le contrat avec l'adresse du contrat de cartes
     */
    constructor(address _cardContractAddress) {
        require(_cardContractAddress != address(0), "Adresse invalide");
        cardContract = IERC721(_cardContractAddress);
    }

    /**
     * @dev Modifie le contrat de cartes (admin seulement)
     */
    function setCardContract(address _newCardContract) public onlyOwner {
        require(_newCardContract != address(0), "Adresse invalide");
        cardContract = IERC721(_newCardContract);
    }

    /**
     * @dev Modifie pour vérifier que l'utilisateur n'est pas verrouillé
     */
    modifier notLocked() {
        require(
            block.timestamp >= lockUntilTime[msg.sender],
            "Utilisateur temporairement verrouille"
        );
        _;
    }

    /**
     * @dev Modifie pour vérifier le cooldown
     */
    modifier checkCooldown() {
        require(
            block.timestamp >= lastTransactionTime[msg.sender] + COOLDOWN_DURATION,
            "Cooldown en cours, attendez avant la prochaine transaction"
        );
        _;
    }

    /**
     * @dev Crée une offre d'échange
     */
    function createExchangeOffer(
        address receiver,
        uint256[] memory offeredTokenIds,
        uint256[] memory requestedTokenIds
    ) public notLocked checkCooldown nonReentrant returns (uint256) {
        require(receiver != address(0), "Adresse invalide");
        require(receiver != msg.sender, "Vous ne pouvez pas echanger avec vous-meme");
        require(offeredTokenIds.length > 0, "Vous devez offrir au moins une carte");
        require(requestedTokenIds.length > 0, "Vous devez demander au moins une carte");

        // Vérifier que l'utilisateur possède les cartes offertes
        for (uint256 i = 0; i < offeredTokenIds.length; i++) {
            require(
                cardContract.ownerOf(offeredTokenIds[i]) == msg.sender,
                "Vous ne possedez pas la carte"
            );
        }

        uint256 offerId = _offerIdCounter;
        _offerIdCounter++;

        exchangeOffers[offerId] = ExchangeOffer({
            offerer: msg.sender,
            offeredTokenIds: offeredTokenIds,
            receiver: receiver,
            requestedTokenIds: requestedTokenIds,
            createdAt: block.timestamp,
            isActive: true
        });

        // Appliquer cooldown et lock
        lastTransactionTime[msg.sender] = block.timestamp;
        lockUntilTime[msg.sender] = block.timestamp + LOCK_DURATION;

        emit ExchangeOfferCreated(
            offerId,
            msg.sender,
            receiver,
            offeredTokenIds,
            requestedTokenIds
        );
        emit UserLocked(msg.sender, lockUntilTime[msg.sender]);
        emit CooldownApplied(msg.sender, lastTransactionTime[msg.sender] + COOLDOWN_DURATION);

        return offerId;
    }

    /**
     * @dev Accepte une offre d'échange
     */
    function acceptExchangeOffer(uint256 offerId)
        public
        notLocked
        checkCooldown
        nonReentrant
    {
        ExchangeOffer storage offer = exchangeOffers[offerId];

        require(offer.isActive, "L'offre n'est pas active");
        require(offer.receiver == msg.sender, "Vous n'etes pas le destinataire");

        // Vérifier que le récepteur possède les cartes demandées
        for (uint256 i = 0; i < offer.requestedTokenIds.length; i++) {
            require(
                cardContract.ownerOf(offer.requestedTokenIds[i]) == msg.sender,
                "Vous ne possedez pas la carte demandee"
            );
        }

        // Effectuer les transferts
        // Offerer envoie ses cartes au receiver
        for (uint256 i = 0; i < offer.offeredTokenIds.length; i++) {
            cardContract.transferFrom(
                offer.offerer,
                msg.sender,
                offer.offeredTokenIds[i]
            );
        }

        // Receiver envoie ses cartes à l'offerer
        for (uint256 i = 0; i < offer.requestedTokenIds.length; i++) {
            cardContract.transferFrom(
                msg.sender,
                offer.offerer,
                offer.requestedTokenIds[i]
            );
        }

        // Appliquer cooldown et lock au récepteur
        lastTransactionTime[msg.sender] = block.timestamp;
        lockUntilTime[msg.sender] = block.timestamp + LOCK_DURATION;

        // Désactiver l'offre
        offer.isActive = false;

        emit ExchangeOfferAccepted(offerId, offer.offerer, msg.sender);
        emit UserLocked(msg.sender, lockUntilTime[msg.sender]);
        emit CooldownApplied(msg.sender, lastTransactionTime[msg.sender] + COOLDOWN_DURATION);
    }

    /**
     * @dev Annule une offre d'échange
     */
    function cancelExchangeOffer(uint256 offerId) public {
        ExchangeOffer storage offer = exchangeOffers[offerId];

        require(offer.isActive, "L'offre n'est pas active");
        require(
            offer.offerer == msg.sender || msg.sender == owner(),
            "Vous ne pouvez pas annuler cette offre"
        );

        offer.isActive = false;

        emit ExchangeOfferCancelled(offerId);
    }

    /**
     * @dev Retourne les détails d'une offre
     */
    function getExchangeOffer(uint256 offerId)
        public
        view
        returns (ExchangeOffer memory)
    {
        return exchangeOffers[offerId];
    }

    /**
     * @dev Retourne le temps restant du cooldown pour un utilisateur
     */
    function getCooldownRemaining(address user) public view returns (uint256) {
        uint256 availableTime = lastTransactionTime[user] + COOLDOWN_DURATION;
        if (block.timestamp >= availableTime) {
            return 0;
        }
        return availableTime - block.timestamp;
    }

    /**
     * @dev Retourne le temps restant du lock pour un utilisateur
     */
    function getLockRemaining(address user) public view returns (uint256) {
        if (block.timestamp >= lockUntilTime[user]) {
            return 0;
        }
        return lockUntilTime[user] - block.timestamp;
    }

    /**
     * @dev Retourne true si l'utilisateur peut effectuer une transaction
     */
    function canTransaction(address user) public view returns (bool) {
        return block.timestamp >= lockUntilTime[user] &&
               block.timestamp >= lastTransactionTime[user] + COOLDOWN_DURATION;
    }
}

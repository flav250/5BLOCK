// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IArenaCards
 * @dev Interface pour interagir avec le contrat ArenaCards
 */
interface IArenaCards is IERC721 {
    function getCardStats(uint256 tokenId) external view returns (
        string memory name,
        string memory rarity,
        uint256 level,
        uint256 attack
    );
}

/**
 * @title Marketplace
 * @dev Marketplace pour échanger des cartes NFT P2P
 */
contract Marketplace is Ownable, ReentrancyGuard {

    IArenaCards public arenaCards;

    uint256 public tradeCounter;
    uint256 public directTradeCounter;

    struct Trade {
        uint256 tradeId;
        address creator;
        uint256 offeredTokenId;
        string requestedCardName;
        uint256 requestedLevel;
        string requestedRarity;
        bool isActive;
        uint256 createdAt;
    }

    struct DirectTrade {
        uint256 tradeId;
        address creator;
        address target;
        uint256 offeredTokenId;
        uint256 requestedTokenId;
        bool isActive;
        uint256 createdAt;
    }

    mapping(uint256 => Trade) public trades;

    mapping(uint256 => DirectTrade) public directTrades;

    mapping(uint256 => bool) public tokenInTrade;

    // Events
    event TradeCreated(
        uint256 indexed tradeId,
        address indexed creator,
        uint256 offeredTokenId,
        string requestedCardName,
        uint256 requestedLevel
    );
    
    event TradeAccepted(
        uint256 indexed tradeId,
        address indexed acceptor,
        uint256 offeredTokenId,
        uint256 acceptedTokenId
    );
    
    event TradeCancelled(uint256 indexed tradeId);

    event DirectTradeCreated(
        uint256 indexed tradeId,
        address indexed creator,
        address indexed target,
        uint256 offeredTokenId,
        uint256 requestedTokenId
    );

    event DirectTradeAccepted(
        uint256 indexed tradeId,
        address indexed acceptor,
        uint256 offeredTokenId,
        uint256 requestedTokenId
    );

    event DirectTradeCancelled(uint256 indexed tradeId);

    constructor(address _arenaCardsAddress) Ownable(msg.sender) {
        arenaCards = IArenaCards(_arenaCardsAddress);
    }

    /**
     * @dev Créer une offre d'échange
     * @param offeredTokenId Token que tu offres
     * @param requestedCardName Nom de la carte demandée
     * @param requestedLevel Niveau de la carte demandée
     * @param requestedRarity Rareté de la carte demandée
     */
    function createTrade(
        uint256 offeredTokenId,
        string memory requestedCardName,
        uint256 requestedLevel,
        string memory requestedRarity
    ) external nonReentrant {
        require(arenaCards.ownerOf(offeredTokenId) == msg.sender, "Not owner of offered card");
        require(!tokenInTrade[offeredTokenId], "Card already in active trade");
        require(bytes(requestedCardName).length > 0, "Card name required");
        require(requestedLevel > 0, "Level must be greater than 0");
        require(bytes(requestedRarity).length > 0, "Rarity required");

        require(
            arenaCards.getApproved(offeredTokenId) == address(this) ||
            arenaCards.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        (string memory offeredName, string memory offeredRarity, uint256 offeredLevel, ) = arenaCards.getCardStats(offeredTokenId);
        
        require(
            keccak256(bytes(offeredName)) != keccak256(bytes(requestedCardName)),
            "Cannot trade the same card"
        );
        
        require(
            keccak256(bytes(offeredRarity)) == keccak256(bytes(requestedRarity)),
            "Offered card rarity must match requested card rarity"
        );
        require(offeredLevel == requestedLevel, "Offered card level must match requested card level");

        uint256 tradeId = tradeCounter;

        trades[tradeId] = Trade({
            tradeId: tradeId,
            creator: msg.sender,
            offeredTokenId: offeredTokenId,
            requestedCardName: requestedCardName,
            requestedLevel: requestedLevel,
            requestedRarity: requestedRarity,
            isActive: true,
            createdAt: block.timestamp
        });

        tokenInTrade[offeredTokenId] = true;
        tradeCounter++;

        emit TradeCreated(tradeId, msg.sender, offeredTokenId, requestedCardName, requestedLevel);
    }

    /**
     * @dev Accepter un échange
     * @param tradeId ID du trade à accepter
     * @param offeredCardTokenId Token de la carte que tu offres pour cet échange
     */
    function acceptTrade(uint256 tradeId, uint256 offeredCardTokenId) external nonReentrant {
        Trade storage trade = trades[tradeId];

        require(trade.isActive, "Trade not active");
        require(trade.creator != msg.sender, "Cannot accept own trade");
        require(arenaCards.ownerOf(offeredCardTokenId) == msg.sender, "Not owner of offered card");

        require(arenaCards.ownerOf(trade.offeredTokenId) == trade.creator, "Creator no longer owns offered card");

        (string memory name, string memory rarity, uint256 level, ) = arenaCards.getCardStats(offeredCardTokenId);
        
        require(
            keccak256(bytes(name)) == keccak256(bytes(trade.requestedCardName)),
            "Card name does not match"
        );
        require(level == trade.requestedLevel, "Card level does not match");
        require(
            keccak256(bytes(rarity)) == keccak256(bytes(trade.requestedRarity)),
            "Card rarity does not match"
        );

        require(
            arenaCards.getApproved(offeredCardTokenId) == address(this) ||
            arenaCards.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved for your card"
        );

        address creator = trade.creator;
        uint256 offeredToken = trade.offeredTokenId;

        trade.isActive = false;
        tokenInTrade[offeredToken] = false;

        arenaCards.safeTransferFrom(creator, msg.sender, offeredToken);
        arenaCards.safeTransferFrom(msg.sender, creator, offeredCardTokenId);

        emit TradeAccepted(tradeId, msg.sender, offeredToken, offeredCardTokenId);
    }

    /**
     * @dev Annuler un trade
     * @param tradeId ID du trade à annuler
     */
    function cancelTrade(uint256 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];

        require(trade.isActive, "Trade not active");
        require(trade.creator == msg.sender, "Not trade creator");

        trade.isActive = false;
        tokenInTrade[trade.offeredTokenId] = false;

        emit TradeCancelled(tradeId);
    }

    /**
     * @dev Récupérer tous les trades actifs
     * Note: En production, utiliser plutôt une pagination
     */
    function getActiveTrades() external view returns (Trade[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < tradeCounter; i++) {
            if (trades[i].isActive) {
                activeCount++;
            }
        }

        Trade[] memory activeTrades = new Trade[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < tradeCounter; i++) {
            if (trades[i].isActive) {
                activeTrades[currentIndex] = trades[i];
                currentIndex++;
            }
        }

        return activeTrades;
    }

    /**
     * @dev Récupérer les trades d'un utilisateur
     */
    function getUserTrades(address user) external view returns (Trade[] memory) {
        uint256 userTradeCount = 0;
        
        for (uint256 i = 0; i < tradeCounter; i++) {
            if (trades[i].creator == user && trades[i].isActive) {
                userTradeCount++;
            }
        }

        Trade[] memory userTrades = new Trade[](userTradeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < tradeCounter; i++) {
            if (trades[i].creator == user && trades[i].isActive) {
                userTrades[currentIndex] = trades[i];
                currentIndex++;
            }
        }

        return userTrades;
    }

    /**
     * @dev Vérifier si une carte est dans un trade actif
     */
    function isCardInTrade(uint256 tokenId) external view returns (bool) {
        return tokenInTrade[tokenId];
    }

    // ========== DIRECT P2P TRADES ==========

    /**
     * @dev Créer une offre d'échange direct P2P
     * @param target Adresse du destinataire
     * @param offeredTokenId Token que tu offres
     * @param requestedTokenId Token que tu veux recevoir
     */
    function createDirectTrade(
        address target,
        uint256 offeredTokenId,
        uint256 requestedTokenId
    ) external nonReentrant {
        require(target != address(0), "Invalid target address");
        require(target != msg.sender, "Cannot trade with yourself");
        require(arenaCards.ownerOf(offeredTokenId) == msg.sender, "Not owner of offered card");
        require(!tokenInTrade[offeredTokenId], "Card already in active trade");
        
        require(arenaCards.ownerOf(requestedTokenId) == target, "Target does not own requested card");

        require(
            arenaCards.getApproved(offeredTokenId) == address(this) ||
            arenaCards.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        (string memory offeredName, string memory offeredRarity, uint256 offeredLevel, ) = arenaCards.getCardStats(offeredTokenId);
        (string memory requestedName, string memory requestedRarity, uint256 requestedLevel, ) = arenaCards.getCardStats(requestedTokenId);
        
        require(
            keccak256(bytes(offeredName)) != keccak256(bytes(requestedName)),
            "Cannot trade the same card"
        );
        
        require(
            keccak256(bytes(offeredRarity)) == keccak256(bytes(requestedRarity)),
            "Cards must have the same rarity"
        );
        require(offeredLevel == requestedLevel, "Cards must have the same level");

        uint256 tradeId = directTradeCounter;

        directTrades[tradeId] = DirectTrade({
            tradeId: tradeId,
            creator: msg.sender,
            target: target,
            offeredTokenId: offeredTokenId,
            requestedTokenId: requestedTokenId,
            isActive: true,
            createdAt: block.timestamp
        });

        tokenInTrade[offeredTokenId] = true;
        directTradeCounter++;

        emit DirectTradeCreated(tradeId, msg.sender, target, offeredTokenId, requestedTokenId);
    }

    /**
     * @dev Accepter un échange direct P2P
     * @param tradeId ID du trade à accepter
     */
    function acceptDirectTrade(uint256 tradeId) external nonReentrant {
        DirectTrade storage trade = directTrades[tradeId];

        require(trade.isActive, "Trade not active");
        require(trade.target == msg.sender, "Not the target of this trade");
        require(arenaCards.ownerOf(trade.requestedTokenId) == msg.sender, "You no longer own the requested card");
        require(arenaCards.ownerOf(trade.offeredTokenId) == trade.creator, "Creator no longer owns offered card");

        require(
            arenaCards.getApproved(trade.requestedTokenId) == address(this) ||
            arenaCards.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved for your card"
        );

        address creator = trade.creator;
        uint256 offeredToken = trade.offeredTokenId;
        uint256 requestedToken = trade.requestedTokenId;

        trade.isActive = false;
        tokenInTrade[offeredToken] = false;

        arenaCards.safeTransferFrom(creator, msg.sender, offeredToken);
        arenaCards.safeTransferFrom(msg.sender, creator, requestedToken);

        emit DirectTradeAccepted(tradeId, msg.sender, offeredToken, requestedToken);
    }

    /**
     * @dev Annuler un trade direct P2P
     * @param tradeId ID du trade à annuler
     */
    function cancelDirectTrade(uint256 tradeId) external nonReentrant {
        DirectTrade storage trade = directTrades[tradeId];

        require(trade.isActive, "Trade not active");
        require(trade.creator == msg.sender || trade.target == msg.sender, "Not authorized");

        trade.isActive = false;
        tokenInTrade[trade.offeredTokenId] = false;

        emit DirectTradeCancelled(tradeId);
    }

    /**
     * @dev Récupérer les trades directs reçus par un utilisateur
     * @param user Adresse de l'utilisateur
     */
    function getReceivedDirectTrades(address user) external view returns (DirectTrade[] memory) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < directTradeCounter; i++) {
            if (directTrades[i].target == user && directTrades[i].isActive) {
                count++;
            }
        }

        DirectTrade[] memory receivedTrades = new DirectTrade[](count);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < directTradeCounter; i++) {
            if (directTrades[i].target == user && directTrades[i].isActive) {
                receivedTrades[currentIndex] = directTrades[i];
                currentIndex++;
            }
        }

        return receivedTrades;
    }

    /**
     * @dev Récupérer les trades directs envoyés par un utilisateur
     * @param user Adresse de l'utilisateur
     */
    function getSentDirectTrades(address user) external view returns (DirectTrade[] memory) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < directTradeCounter; i++) {
            if (directTrades[i].creator == user && directTrades[i].isActive) {
                count++;
            }
        }

        DirectTrade[] memory sentTrades = new DirectTrade[](count);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < directTradeCounter; i++) {
            if (directTrades[i].creator == user && directTrades[i].isActive) {
                sentTrades[currentIndex] = directTrades[i];
                currentIndex++;
            }
        }

        return sentTrades;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Marketplace
 * @dev Marketplace pour échanger des cartes NFT P2P
 */
contract Marketplace is Ownable, ReentrancyGuard {

    IERC721 public arenaCards;

    uint256 public tradeCounter;

    struct Trade {
        uint256 tradeId;
        address creator;
        uint256 offeredTokenId;
        uint256 requestedTokenId;
        bool isActive;
        uint256 createdAt;
    }

    // Mapping tradeId => Trade
    mapping(uint256 => Trade) public trades;

    // Mapping pour vérifier qu'un token n'est pas déjà dans un trade actif
    mapping(uint256 => bool) public tokenInTrade;

    // Events
    event TradeCreated(
        uint256 indexed tradeId,
        address indexed creator,
        uint256 offeredTokenId,
        uint256 requestedTokenId
    );
    
    event TradeAccepted(
        uint256 indexed tradeId,
        address indexed acceptor,
        uint256 offeredTokenId,
        uint256 requestedTokenId
    );
    
    event TradeCancelled(uint256 indexed tradeId);

    constructor(address _arenaCardsAddress) Ownable(msg.sender) {
        arenaCards = IERC721(_arenaCardsAddress);
    }

    /**
     * @dev Créer une offre d'échange
     * @param offeredTokenId Token que tu offres
     * @param requestedTokenId Token que tu demandes
     */
    function createTrade(
        uint256 offeredTokenId,
        uint256 requestedTokenId
    ) external nonReentrant {
        // Vérifications
        require(arenaCards.ownerOf(offeredTokenId) == msg.sender, "Not owner of offered card");
        require(!tokenInTrade[offeredTokenId], "Card already in active trade");
        require(offeredTokenId != requestedTokenId, "Cannot trade same card");

        // Vérifier que le contrat a l'approval
        require(
            arenaCards.getApproved(offeredTokenId) == address(this) ||
            arenaCards.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        uint256 tradeId = tradeCounter;

        trades[tradeId] = Trade({
            tradeId: tradeId,
            creator: msg.sender,
            offeredTokenId: offeredTokenId,
            requestedTokenId: requestedTokenId,
            isActive: true,
            createdAt: block.timestamp
        });

        tokenInTrade[offeredTokenId] = true;
        tradeCounter++;

        emit TradeCreated(tradeId, msg.sender, offeredTokenId, requestedTokenId);
    }

    /**
     * @dev Accepter un échange
     * @param tradeId ID du trade à accepter
     */
    function acceptTrade(uint256 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];

        // Vérifications
        require(trade.isActive, "Trade not active");
        require(trade.creator != msg.sender, "Cannot accept own trade");
        require(arenaCards.ownerOf(trade.requestedTokenId) == msg.sender, "Not owner of requested card");

        // Vérifier que les deux cartes existent toujours et appartiennent aux bonnes personnes
        require(arenaCards.ownerOf(trade.offeredTokenId) == trade.creator, "Creator no longer owns offered card");

        // Vérifier les approvals
        require(
            arenaCards.getApproved(trade.requestedTokenId) == address(this) ||
            arenaCards.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved for your card"
        );

        // Effectuer l'échange
        address creator = trade.creator;
        uint256 offeredToken = trade.offeredTokenId;
        uint256 requestedToken = trade.requestedTokenId;

        // Marquer le trade comme inactif
        trade.isActive = false;
        tokenInTrade[offeredToken] = false;

        // Transférer les cartes
        arenaCards.safeTransferFrom(creator, msg.sender, offeredToken);
        arenaCards.safeTransferFrom(msg.sender, creator, requestedToken);

        emit TradeAccepted(tradeId, msg.sender, offeredToken, requestedToken);
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
        // Compter les trades actifs
        uint256 activeCount = 0;
        for (uint256 i = 0; i < tradeCounter; i++) {
            if (trades[i].isActive) {
                activeCount++;
            }
        }

        // Créer le tableau
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
        
        // Compter les trades de l'utilisateur
        for (uint256 i = 0; i < tradeCounter; i++) {
            if (trades[i].creator == user && trades[i].isActive) {
                userTradeCount++;
            }
        }

        // Créer le tableau
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
}

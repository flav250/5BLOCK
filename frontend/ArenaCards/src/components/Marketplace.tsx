// components/Marketplace.tsx - Marketplace P2P avec drag & drop

import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards, getCardDetails } from '../utils/contractHelpers';
import {
  getActiveTrades,
  createTrade,
  acceptTrade,
  cancelTrade,
  approveMarketplace,
  getUserTrades,
  type Trade
} from '../utils/marketplaceHelpers';
import type { ArenaCard } from '../types/ArenaCard';
import './Marketplace.css';

const Marketplace: React.FC = () => {
  const { account, signer } = useWeb3();
  
  // States
  const [myCards, setMyCards] = useState<ArenaCard[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [myTrades, setMyTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  
  // Create trade modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOffered, setSelectedOffered] = useState<ArenaCard | null>(null);
  const [requestedTokenId, setRequestedTokenId] = useState('');
  
  // Trade details
  const [tradeCards, setTradeCards] = useState<Map<string, { offered: ArenaCard | null, requested: ArenaCard | null }>>(new Map());

  // Charger les données
  const loadData = useCallback(async () => {
    if (!signer || !account) return;

    try {
      setIsLoading(true);

      const [cards, trades, userTrades] = await Promise.all([
        loadUserCards(signer, account),
        getActiveTrades(signer),
        getUserTrades(signer, account)
      ]);

      setMyCards(cards.filter(c => !c.isLocked));
      setAllTrades(trades);
      setMyTrades(userTrades);

      // Charger les détails des cartes pour chaque trade
      const cardsMap = new Map();
      for (const trade of trades) {
        const [offered, requested] = await Promise.all([
          getCardDetails(signer, trade.offeredTokenId),
          getCardDetails(signer, trade.requestedTokenId)
        ]);
        cardsMap.set(trade.tradeId, { offered, requested });
      }
      setTradeCards(cardsMap);

    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  useEffect(() => {
    if (account && signer) {
      loadData();
    }
  }, [account, signer, loadData]);

  // Approuver le marketplace
  const handleApprove = async () => {
    if (!signer) return;
    
    const success = await approveMarketplace(signer);
    if (success) {
      setIsApproved(true);
    }
  };

  // Créer un trade
  const handleCreateTrade = async () => {
    if (!signer || !selectedOffered || !requestedTokenId) return;

    const success = await createTrade(signer, selectedOffered.tokenId, requestedTokenId);
    
    if (success) {
      setShowCreateModal(false);
      setSelectedOffered(null);
      setRequestedTokenId('');
      loadData();
    }
  };

  // Accepter un trade
  const handleAcceptTrade = async (tradeId: string) => {
    if (!signer) return;

    const success = await acceptTrade(signer, tradeId);
    
    if (success) {
      loadData();
    }
  };

  // Annuler un trade
  const handleCancelTrade = async (tradeId: string) => {
    if (!signer) return;

    const success = await cancelTrade(signer, tradeId);
    
    if (success) {
      loadData();
    }
  };

  // Drag & drop
  const handleDragStart = (card: ArenaCard) => {
    setSelectedOffered(card);
  };

  const handleDrop = (e: React.DragEvent, tradeId: string) => {
    e.preventDefault();
    if (selectedOffered) {
      handleAcceptTrade(tradeId);
      setSelectedOffered(null);
    }
  };

  if (!account) {
    return (
      <div className="marketplace-container">
        <div className="marketplace-message">
          <h2>🏪 Marketplace</h2>
          <p>Connecte ton wallet pour échanger des cartes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      {/* Header */}
      <div className="marketplace-header">
        <h2>🏪 Marketplace P2P</h2>
        <p>Échange tes cartes avec d'autres joueurs</p>
        
        {!isApproved && (
          <button onClick={handleApprove} className="btn-approve">
            🔐 Approuver le Marketplace
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="marketplace-actions">
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn-create-trade"
          disabled={myCards.length === 0}
        >
          ➕ Créer un Échange
        </button>
        <button onClick={loadData} className="btn-refresh">
          🔄 Rafraîchir
        </button>
      </div>

      {/* My Trades */}
      {myTrades.length > 0 && (
        <div className="trades-section">
          <h3>📋 Mes Offres ({myTrades.length})</h3>
          <div className="trades-grid">
            {myTrades.map((trade) => {
              const cards = tradeCards.get(trade.tradeId);
              if (!cards) return null;

              return (
                <div key={trade.tradeId} className="trade-card my-trade">
                  <div className="trade-header">
                    <span className="trade-id">Trade #{trade.tradeId}</span>
                    <button 
                      onClick={() => handleCancelTrade(trade.tradeId)}
                      className="btn-cancel-small"
                    >
                      ❌
                    </button>
                  </div>

                  <div className="trade-content">
                    <div className="trade-side">
                      <span className="trade-label">J'offre</span>
                      {cards.offered && (
                        <div className="mini-card">
                          <img src={cards.offered.imageURI} alt={cards.offered.name} />
                          <span>{cards.offered.name}</span>
                          <span className="card-rarity">{cards.offered.rarity}</span>
                        </div>
                      )}
                    </div>

                    <div className="trade-arrow">⇄</div>

                    <div className="trade-side">
                      <span className="trade-label">Je demande</span>
                      {cards.requested && (
                        <div className="mini-card">
                          <img src={cards.requested.imageURI} alt={cards.requested.name} />
                          <span>{cards.requested.name}</span>
                          <span className="card-rarity">{cards.requested.rarity}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Trades */}
      <div className="trades-section">
        <h3>🌍 Tous les Échanges ({allTrades.filter(t => t.creator !== account).length})</h3>
        
        {isLoading ? (
          <div className="loading">Chargement...</div>
        ) : (
          <div className="trades-grid">
            {allTrades
              .filter(trade => trade.creator !== account)
              .map((trade) => {
                const cards = tradeCards.get(trade.tradeId);
                if (!cards) return null;

                const canAccept = myCards.some(c => c.tokenId === trade.requestedTokenId);

                return (
                  <div 
                    key={trade.tradeId} 
                    className={`trade-card ${canAccept ? 'can-accept' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, trade.tradeId)}
                  >
                    <div className="trade-header">
                      <span className="trade-id">Trade #{trade.tradeId}</span>
                      <span className="trade-creator">
                        {trade.creator.substring(0, 6)}...
                      </span>
                    </div>

                    <div className="trade-content">
                      <div className="trade-side">
                        <span className="trade-label">Offre</span>
                        {cards.offered && (
                          <div className="mini-card">
                            <img src={cards.offered.imageURI} alt={cards.offered.name} />
                            <span>{cards.offered.name}</span>
                            <span className="card-rarity">{cards.offered.rarity}</span>
                          </div>
                        )}
                      </div>

                      <div className="trade-arrow">⇄</div>

                      <div className="trade-side">
                        <span className="trade-label">Demande</span>
                        {cards.requested && (
                          <div className="mini-card drop-zone">
                            <img src={cards.requested.imageURI} alt={cards.requested.name} />
                            <span>{cards.requested.name}</span>
                            <span className="card-rarity">{cards.requested.rarity}</span>
                            {canAccept && (
                              <div className="drop-hint">
                                Glisse ta carte ici
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {canAccept && (
                      <button 
                        onClick={() => handleAcceptTrade(trade.tradeId)}
                        className="btn-accept"
                      >
                        ✅ Accepter l'Échange
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Create Trade Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>➕ Créer un Échange</h3>
            
            <div className="modal-section">
              <label>Carte que tu offres :</label>
              <div className="cards-select">
                {myCards.map((card) => (
                  <div
                    key={card.tokenId}
                    className={`selectable-card ${selectedOffered?.tokenId === card.tokenId ? 'selected' : ''}`}
                    onClick={() => setSelectedOffered(card)}
                    draggable
                    onDragStart={() => handleDragStart(card)}
                  >
                    <img src={card.imageURI} alt={card.name} />
                    <span>{card.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <label>ID de la carte demandée :</label>
              <input
                type="number"
                value={requestedTokenId}
                onChange={(e) => setRequestedTokenId(e.target.value)}
                placeholder="Ex: 5"
                className="input-token-id"
              />
              <small>Entre l'ID de la carte que tu veux recevoir</small>
            </div>

            <div className="modal-actions">
              <button onClick={handleCreateTrade} className="btn-submit">
                Créer l'Offre
              </button>
              <button onClick={() => setShowCreateModal(false)} className="btn-cancel">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;

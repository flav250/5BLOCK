// components/Marketplace.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards, getCardDetails, ALL_GAME_CARDS } from '../utils/contractHelpers';
import {
  getActiveTrades,
  createTrade,
  acceptTrade,
  cancelTrade,
  approveMarketplace,
  getUserTrades,
  createDirectTrade,
  acceptDirectTrade,
  cancelDirectTrade,
  getReceivedDirectTrades,
  getSentDirectTrades,
  type Trade,
  type DirectTrade
} from '../utils/marketplaceHelpers';
import type { ArenaCard } from '../types/ArenaCard';
import './Marketplace.css';

const Marketplace: React.FC = () => {
  const { account, signer } = useWeb3();

  const [tradeMode, setTradeMode] = useState<'public' | 'p2p'>('public');
  const [myCards, setMyCards] = useState<ArenaCard[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [myTrades, setMyTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  const [receivedDirectTrades, setReceivedDirectTrades] = useState<DirectTrade[]>([]);
  const [sentDirectTrades, setSentDirectTrades] = useState<DirectTrade[]>([]);
  const [directTradeCards, setDirectTradeCards] = useState<Map<string, { offered: ArenaCard | null; requested: ArenaCard | null }>>(new Map());

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOffered, setSelectedOffered] = useState<ArenaCard | null>(null);
  const [selectedRequestedCardName, setSelectedRequestedCardName] = useState<string | null>(null);
  const [selectedRequestedLevel, setSelectedRequestedLevel] = useState<number | null>(null);

  const [targetAddress, setTargetAddress] = useState<string>('');
  const [selectedRequestedCard, setSelectedRequestedCard] = useState<ArenaCard | null>(null);
  const [allUserCards, setAllUserCards] = useState<ArenaCard[]>([]);
  const [isLoadingTargetCards, setIsLoadingTargetCards] = useState(false);

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [selectedCardToOffer, setSelectedCardToOffer] = useState<ArenaCard | null>(null);

  const [showAcceptDirectModal, setShowAcceptDirectModal] = useState(false);
  const [selectedDirectTrade, setSelectedDirectTrade] = useState<DirectTrade | null>(null);

  const [tradeCards, setTradeCards] = useState<Map<string, { offered: ArenaCard | null }>>(new Map());

  const loadData = useCallback(async () => {
    if (!signer || !account) return;

    try {
      setIsLoading(true);

      const [cards, trades, userTrades] = await Promise.all([
        loadUserCards(signer, account),
        getActiveTrades(signer),
        getUserTrades(signer, account),
      ]);

      setMyCards(cards.filter((c) => !c.isLocked));
      setAllTrades(trades);
      setMyTrades(userTrades);

      const cardsMap = new Map();
      for (const trade of trades) {
        const offered = await getCardDetails(signer, trade.offeredTokenId);
        cardsMap.set(trade.tradeId, { offered });
      }
      setTradeCards(cardsMap);
    } catch (error) {
      console.error('Erreur chargement :', error);
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  useEffect(() => {
    if (account && signer) loadData();
  }, [account, signer, loadData]);

  const loadP2PData = useCallback(async () => {
    if (!signer || !account) return;

    try {
      setIsLoading(true);

      const [cards, received, sent] = await Promise.all([
        loadUserCards(signer, account),
        getReceivedDirectTrades(signer, account),
        getSentDirectTrades(signer, account),
      ]);

      setMyCards(cards.filter((c) => !c.isLocked));
      setReceivedDirectTrades(received);
      setSentDirectTrades(sent);

      const cardsMap = new Map();
      for (const trade of [...received, ...sent]) {
        const offered = await getCardDetails(signer, trade.offeredTokenId);
        const requested = await getCardDetails(signer, trade.requestedTokenId);
        cardsMap.set(trade.tradeId, { offered, requested });
      }
      setDirectTradeCards(cardsMap);
    } catch (error) {
      console.error('Erreur chargement P2P :', error);
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  useEffect(() => {
    if (account && signer) {
      if (tradeMode === 'public') {
        loadData();
      } else {
        loadP2PData();
      }
    }
  }, [account, signer, tradeMode, loadData, loadP2PData]);

  const handleApprove = async () => {
    if (!signer) return;
    const success = await approveMarketplace(signer);
    if (success) setIsApproved(true);
  };

  const handleCreateTrade = async () => {
    if (!signer || !selectedOffered || !selectedRequestedCardName || selectedRequestedLevel === null) return;

    const requestedCard = ALL_GAME_CARDS.find(c => c.name === selectedRequestedCardName);
    if (!requestedCard) return;

    const success = await createTrade(
        signer,
        selectedOffered.tokenId,
        selectedRequestedCardName,
        selectedRequestedLevel,
        requestedCard.rarity
    );

    if (success) {
      setShowCreateModal(false);
      setSelectedOffered(null);
      setSelectedRequestedCardName(null);
      setSelectedRequestedLevel(null);
      loadData();
    }
  };

  const handleAcceptTrade = async () => {
    if (!signer || !selectedTrade || !selectedCardToOffer) return;
    const success = await acceptTrade(signer, selectedTrade.tradeId, selectedCardToOffer.tokenId);
    if (success) {
      setShowAcceptModal(false);
      setSelectedTrade(null);
      setSelectedCardToOffer(null);
      loadData();
    }
  };

  const openAcceptModal = (trade: Trade) => {
    setSelectedTrade(trade);
    setShowAcceptModal(true);
  };

  const handleCancelTrade = async (tradeId: string) => {
    if (!signer) return;
    const success = await cancelTrade(signer, tradeId);
    if (success) loadData();
  };

  const handleCreateDirectTrade = async () => {
    if (!signer || !selectedOffered || !targetAddress || !selectedRequestedCard) return;

    const success = await createDirectTrade(
        signer,
        targetAddress,
        selectedOffered.tokenId,
        selectedRequestedCard.tokenId
    );

    if (success) {
      setShowCreateModal(false);
      setSelectedOffered(null);
      setTargetAddress('');
      setSelectedRequestedCard(null);
      setAllUserCards([]);
      loadP2PData();
    }
  };

  const handleAcceptDirectTrade = async () => {
    if (!signer || !selectedDirectTrade) return;
    const success = await acceptDirectTrade(signer, selectedDirectTrade.tradeId);
    if (success) {
      setShowAcceptDirectModal(false);
      setSelectedDirectTrade(null);
      loadP2PData();
    }
  };

  const openAcceptDirectModal = (trade: DirectTrade) => {
    setSelectedDirectTrade(trade);
    setShowAcceptDirectModal(true);
  };

  const handleCancelDirectTrade = async (tradeId: string) => {
    if (!signer) return;
    const success = await cancelDirectTrade(signer, tradeId);
    if (success) loadP2PData();
  };

  const handleLoadTargetCards = async () => {
    if (!signer || !targetAddress) return;

    try {
      setIsLoadingTargetCards(true);
      const cards = await loadUserCards(signer, targetAddress);
      setAllUserCards(cards.filter((c) => !c.isLocked));
    } catch (error) {
      console.error('Erreur chargement cartes utilisateur:', error);
      alert('Impossible de charger les cartes de cet utilisateur. Vérifie l\'adresse.');
    } finally {
      setIsLoadingTargetCards(false);
    }
  };

  const rarityClass = (rarity?: string) => {
    if (!rarity) return '';
    const r = rarity.toLowerCase();
    if (r.includes('légendaire') || r.includes('legendary'))
      return 'rarity--legendary';
    if (r.includes('rare')) return 'rarity--rare';
    return 'rarity--common';
  };

  if (!account) {
    return (
        <div className="marketplace-container">
          <div className="marketplace-empty">
            <h2>🏪 Marketplace</h2>
            <p>Connecte ton wallet pour échanger des cartes</p>
          </div>
        </div>
    );
  }

  return (
      <div className="marketplace-container">
        <header className="marketplace-header">
          <h2 className="marketplace-header__title">MarketPlace</h2>
          <p className="marketplace-header__sub">
            Échange tes cartes avec d'autres joueurs
          </p>

          {!isApproved && (
              <button onClick={handleApprove} className="btn btn--approve">
                🔐 Approuver le Marketplace
              </button>
          )}
        </header>

        <div className="marketplace-mode-toggle">
          <button
              onClick={() => setTradeMode('public')}
              className={`btn ${tradeMode === 'public' ? 'btn--mode-active' : 'btn--mode-inactive'}`}
          >
            🌍 Échanges Publics
          </button>
          <button
              onClick={() => setTradeMode('p2p')}
              className={`btn ${tradeMode === 'p2p' ? 'btn--mode-active' : 'btn--mode-inactive'}`}
          >
            🤝 Échanges Directs (P2P)
          </button>
        </div>

        <div className="marketplace-actions">
          <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn--create"
              disabled={myCards.length === 0}
          >
            ➕ Créer un Échange {tradeMode === 'p2p' ? 'Direct' : ''}
          </button>

          <button 
              onClick={tradeMode === 'public' ? loadData : loadP2PData} 
              className="btn btn--refresh" 
              aria-label="Rafraîchir"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.5 9a9 9 0 0114.1-3.4L23 10" />
              <path d="M20.5 15a9 9 0 01-14.1 3.4L1 14" />
            </svg>
          </button>
        </div>

        {tradeMode === 'public' && (
            <>
              {myTrades.length > 0 && (
                  <section className="trades-section">
                    <h3 className="trades-section__title">
                      📋 Mes Offres <span className="trades-section__count">({myTrades.length})</span>
                    </h3>

                    <div className="trades-grid">
                      {myTrades.map((trade) => {
                        const cards = tradeCards.get(trade.tradeId);
                        if (!cards) return null;

                        return (
                            <article key={trade.tradeId} className="trade-card trade-card--mine">
                              <div className="trade-card__header">
                                <span className="trade-card__id">Trade #{trade.tradeId}</span>
                                <button
                                    onClick={() => handleCancelTrade(trade.tradeId)}
                                    className="btn btn--cancel-small"
                                    aria-label="Annuler ce trade"
                                >
                                  ❌
                                </button>
                              </div>

                              <div className="trade-card__body">
                                <div className="trade-card__side">
                                  <span className="trade-card__label">J'offre</span>
                                  {cards.offered && (
                                      <div className={`mini-card ${rarityClass(cards.offered.rarity)}`}>
                                        <img src={cards.offered.imageURI} alt={cards.offered.name} />
                                        <span className="mini-card__name">{cards.offered.name}</span>
                                        <span className={`mini-card__rarity ${rarityClass(cards.offered.rarity)}`}>
                                  {cards.offered.rarity}
                                </span>
                                      </div>
                                  )}
                                </div>

                                <div className="trade-card__arrow">⇄</div>

                                <div className="trade-card__side">
                                  <span className="trade-card__label">Je demande</span>
                                  <div className="mini-card-text">
                                    <div className="mini-card-text__name">{trade.requestedCardName}</div>
                                    <div className="mini-card-text__level">Niveau {trade.requestedLevel}</div>
                                  </div>
                                </div>
                              </div>
                            </article>
                        );
                      })}
                    </div>
                  </section>
              )}

              <section className="trades-section">
                <h3 className="trades-section__title">
                  🌍 Tous les Échanges{' '}
                  <span className="trades-section__count">
                  ({allTrades.length})
                </span>
                </h3>

                {isLoading ? (
                    <div className="marketplace-loading">Chargement…</div>
                ) : (
                    <div className="trades-grid">
                      {allTrades
                          .map((trade) => {
                            const cards = tradeCards.get(trade.tradeId);
                            if (!cards) return null;

                            const isMyTrade = trade.creator.toLowerCase() === account?.toLowerCase();
                            const canAccept = !isMyTrade && myCards.some(
                                (c) => c.name === trade.requestedCardName && c.level === trade.requestedLevel
                            );

                            return (
                                <article
                                    key={trade.tradeId}
                                    className={`trade-card ${canAccept ? 'trade-card--acceptible' : ''}`}
                                >
                                  <div className="trade-card__header">
                                    <span className="trade-card__id">Trade #{trade.tradeId}</span>
                                    <span className="trade-card__creator">
                              {trade.creator.substring(0, 6)}…
                            </span>
                                  </div>

                                  <div className="trade-card__body">
                                    <div className="trade-card__side">
                                      <span className="trade-card__label">Offre</span>
                                      {cards.offered && (
                                          <div className={`mini-card ${rarityClass(cards.offered.rarity)}`}>
                                            <img src={cards.offered.imageURI} alt={cards.offered.name} />
                                            <span className="mini-card__name">{cards.offered.name}</span>
                                            <span className={`mini-card__rarity ${rarityClass(cards.offered.rarity)}`}>
                                    {cards.offered.rarity}
                                  </span>
                                          </div>
                                      )}
                                    </div>

                                    <div className="trade-card__arrow">⇄</div>

                                    <div className="trade-card__side">
                                      <span className="trade-card__label">Demande</span>
                                      <div className="mini-card-text">
                                        <div className="mini-card-text__name">{trade.requestedCardName}</div>
                                        <div className="mini-card-text__level">Niveau {trade.requestedLevel}</div>
                                      </div>
                                    </div>
                                  </div>

                                  {canAccept && (
                                      <button
                                          onClick={() => openAcceptModal(trade)}
                                          className="btn btn--accept"
                                      >
                                        ✅ Accepter l'Échange
                                      </button>
                                  )}
                                </article>
                            );
                          })}
                    </div>
                )}
              </section>
            </>
        )}

        {tradeMode === 'p2p' && (
            <>
              {receivedDirectTrades.length > 0 && (
                  <section className="trades-section">
                    <h3 className="trades-section__title">
                      📨 Échanges Reçus <span className="trades-section__count">({receivedDirectTrades.length})</span>
                    </h3>

                    <div className="trades-grid">
                      {receivedDirectTrades.map((trade) => {
                        const cards = directTradeCards.get(trade.tradeId);
                        if (!cards) return null;

                        return (
                            <article key={trade.tradeId} className="trade-card trade-card--acceptible">
                              <div className="trade-card__header">
                                <span className="trade-card__id">Trade P2P #{trade.tradeId}</span>
                                <span className="trade-card__creator">
                            De: {trade.creator.substring(0, 6)}…
                          </span>
                              </div>

                              <div className="trade-card__body">
                                <div className="trade-card__side">
                                  <span className="trade-card__label">Tu reçois</span>
                                  {cards.offered && (
                                      <div className={`mini-card ${rarityClass(cards.offered.rarity)}`}>
                                        <img src={cards.offered.imageURI} alt={cards.offered.name} />
                                        <span className="mini-card__name">{cards.offered.name}</span>
                                        <span className={`mini-card__rarity ${rarityClass(cards.offered.rarity)}`}>
                                  {cards.offered.rarity}
                                </span>
                                      </div>
                                  )}
                                </div>

                                <div className="trade-card__arrow">⇄</div>

                                <div className="trade-card__side">
                                  <span className="trade-card__label">Tu donnes</span>
                                  {cards.requested && (
                                      <div className={`mini-card ${rarityClass(cards.requested.rarity)}`}>
                                        <img src={cards.requested.imageURI} alt={cards.requested.name} />
                                        <span className="mini-card__name">{cards.requested.name}</span>
                                        <span className={`mini-card__rarity ${rarityClass(cards.requested.rarity)}`}>
                                  {cards.requested.rarity}
                                </span>
                                      </div>
                                  )}
                                </div>
                              </div>

                              <button
                                  onClick={() => openAcceptDirectModal(trade)}
                                  className="btn btn--accept"
                              >
                                ✅ Accepter l'Échange
                              </button>
                            </article>
                        );
                      })}
                    </div>
                  </section>
              )}

              {sentDirectTrades.length > 0 && (
                  <section className="trades-section">
                    <h3 className="trades-section__title">
                      📤 Échanges Envoyés <span className="trades-section__count">({sentDirectTrades.length})</span>
                    </h3>

                    <div className="trades-grid">
                      {sentDirectTrades.map((trade) => {
                        const cards = directTradeCards.get(trade.tradeId);
                        if (!cards) return null;

                        return (
                            <article key={trade.tradeId} className="trade-card trade-card--mine">
                              <div className="trade-card__header">
                                <span className="trade-card__id">Trade P2P #{trade.tradeId}</span>
                                <button
                                    onClick={() => handleCancelDirectTrade(trade.tradeId)}
                                    className="btn btn--cancel-small"
                                    aria-label="Annuler ce trade"
                                >
                                  ❌
                                </button>
                              </div>

                              <div className="trade-card__body">
                                <div className="trade-card__side">
                                  <span className="trade-card__label">J'offre</span>
                                  {cards.offered && (
                                      <div className={`mini-card ${rarityClass(cards.offered.rarity)}`}>
                                        <img src={cards.offered.imageURI} alt={cards.offered.name} />
                                        <span className="mini-card__name">{cards.offered.name}</span>
                                        <span className={`mini-card__rarity ${rarityClass(cards.offered.rarity)}`}>
                                  {cards.offered.rarity}
                                </span>
                                      </div>
                                  )}
                                </div>

                                <div className="trade-card__arrow">⇄</div>

                                <div className="trade-card__side">
                                  <span className="trade-card__label">Je demande</span>
                                  {cards.requested && (
                                      <div className={`mini-card ${rarityClass(cards.requested.rarity)}`}>
                                        <img src={cards.requested.imageURI} alt={cards.requested.name} />
                                        <span className="mini-card__name">{cards.requested.name}</span>
                                        <span className={`mini-card__rarity ${rarityClass(cards.requested.rarity)}`}>
                                  {cards.requested.rarity}
                                </span>
                                      </div>
                                  )}
                                </div>
                              </div>

                              <div className="trade-card__footer">
                                <span className="trade-card__target">
                            À: {trade.target.substring(0, 6)}…
                          </span>
                              </div>
                            </article>
                        );
                      })}
                    </div>
                  </section>
              )}

              {!isLoading && receivedDirectTrades.length === 0 && sentDirectTrades.length === 0 && (
                  <div className="marketplace-empty">
                    <p>Aucun échange direct pour le moment</p>
                  </div>
              )}
            </>
        )}

        {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__accent" />

                <div className="modal__header">
                  <h3 className="modal__title">
                    <span className="modal__title-icon">+</span>
                    Créer un Échange {tradeMode === 'p2p' ? 'Direct (P2P)' : ''}
                  </h3>
                  <button
                      className="modal__close"
                      onClick={() => setShowCreateModal(false)}
                      aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal__body">
                  <div className="modal-step">
                    <div className="modal-step__label">
                  <span className={`modal-step__dot ${selectedOffered ? 'modal-step__dot--done' : ''}`}>
                    {selectedOffered ? '✓' : '1'}
                  </span>
                      <span className="modal-step__text">Carte que tu offres</span>
                    </div>

                    <div className="modal-step__panel">
                      <div className="cards-select">
                        {myCards.map((card) => (
                            <div
                                key={card.tokenId}
                                className={`selectable-card ${rarityClass(card.rarity)} ${
                                    selectedOffered?.tokenId === card.tokenId ? 'selectable-card--selected' : ''
                                }`}
                                onClick={() => setSelectedOffered(card)}
                            >
                              <span className={`selectable-card__badge ${rarityClass(card.rarity)}`}>
                          {card.rarity}
                        </span>

                              <div className="selectable-card__art">
                                <img src={card.imageURI} alt={card.name} />
                                {selectedOffered?.tokenId === card.tokenId && (
                                    <div className="selectable-card__shimmer" />
                                )}
                              </div>

                              <span className="selectable-card__name">{card.name}</span>
                              <span className="selectable-card__level">Niv. {card.level}</span>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="modal-divider">
                    <span className="modal-divider__line modal-divider__line--left" />
                    <span className="modal-divider__arrow">⇄</span>
                    <span className="modal-divider__line modal-divider__line--right" />
                  </div>

                  {tradeMode === 'public' && (
                      <div className="modal-step">
                        <div className="modal-step__label">
                      <span className={`modal-step__dot ${selectedRequestedCardName ? 'modal-step__dot--done' : ''}`}>
                        {selectedRequestedCardName ? '✓' : '2'}
                      </span>
                          <span className="modal-step__text">Carte que tu demandes (même rareté et niveau)</span>
                        </div>

                        <div className="modal-step__panel">
                          {(() => {
                            if (!selectedOffered) return null;
                            
                            const availableCards = ALL_GAME_CARDS.filter(
                              card => card.rarity === selectedOffered.rarity && card.name !== selectedOffered.name
                            );
                            
                            if (availableCards.length === 0) {
                              return (
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                                  ❌ Aucune autre carte de cette rareté disponible
                                </p>
                              );
                            }
                            
                            return (
                              <div className="cards-select">
                                {availableCards.map((card) => (
                                    <div
                                        key={card.name}
                                        className={`selectable-card ${rarityClass(card.rarity)} ${
                                            selectedRequestedCardName === card.name ? 'selectable-card--selected' : ''
                                        }`}
                                        onClick={() => {
                                          setSelectedRequestedCardName(card.name);
                                          setSelectedRequestedLevel(selectedOffered.level);
                                        }}
                                    >
                                  <span className={`selectable-card__badge ${rarityClass(card.rarity)}`}>
                                    {card.rarity}
                                  </span>

                                      <div className="selectable-card__art">
                                        <img src={card.imageURI} alt={card.name} />
                                        {selectedRequestedCardName === card.name && (
                                            <div className="selectable-card__shimmer" />
                                        )}
                                      </div>

                                      <span className="selectable-card__name">{card.name}</span>
                                      <span className="selectable-card__level">Niv. {selectedOffered.level}</span>
                                    </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                  )}

                  {tradeMode === 'p2p' && (
                      <>
                        <div className="modal-step">
                          <div className="modal-step__label">
                        <span className={`modal-step__dot ${targetAddress && allUserCards.length > 0 ? 'modal-step__dot--done' : ''}`}>
                          {targetAddress && allUserCards.length > 0 ? '✓' : '2'}
                        </span>
                            <span className="modal-step__text">Adresse du destinataire</span>
                          </div>

                          <div className="modal-step__panel">
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                              <input
                                  type="text"
                                  placeholder="0x..."
                                  value={targetAddress}
                                  onChange={(e) => setTargetAddress(e.target.value)}
                                  style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '2px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    fontSize: '14px'
                                  }}
                              />
                              <button
                                  onClick={handleLoadTargetCards}
                                  className="btn btn--submit"
                                  disabled={!targetAddress || isLoadingTargetCards}
                                  style={{ minWidth: '120px' }}
                              >
                                {isLoadingTargetCards ? 'Chargement...' : 'Charger'}
                              </button>
                            </div>

                            {isLoadingTargetCards && (
                                <div style={{ 
                                  textAlign: 'center', 
                                  padding: '20px', 
                                  color: 'rgba(255,255,255,0.7)', 
                                  fontSize: '14px' 
                                }}>
                                  <div style={{ 
                                    display: 'inline-block',
                                    animation: 'spin 1s linear infinite',
                                    fontSize: '24px',
                                    marginBottom: '10px'
                                  }}>
                                    ⏳
                                  </div>
                                  <p>Chargement des cartes du destinataire...</p>
                                </div>
                            )}

                            {!isLoadingTargetCards && allUserCards.length > 0 && (
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginTop: '10px' }}>
                                  ✅ {allUserCards.length} carte(s) disponible(s)
                                </p>
                            )}
                          </div>
                        </div>

                        {allUserCards.length > 0 && selectedOffered && (
                            <div className="modal-step">
                              <div className="modal-step__label">
                            <span className={`modal-step__dot ${selectedRequestedCard ? 'modal-step__dot--done' : ''}`}>
                              {selectedRequestedCard ? '✓' : '3'}
                            </span>
                                <span className="modal-step__text">Carte que tu demandes (même rareté et niveau)</span>
                              </div>

                              <div className="modal-step__panel">
                                {(() => {
                                  const compatibleCards = allUserCards.filter(
                                    card => card.rarity === selectedOffered.rarity && 
                                            card.level === selectedOffered.level && 
                                            card.name !== selectedOffered.name
                                  );
                                  
                                  if (compatibleCards.length === 0) {
                                    return (
                                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                                        ❌ Aucune carte compatible trouvée (même rareté: {selectedOffered.rarity}, même niveau: {selectedOffered.level}, carte différente)
                                      </p>
                                    );
                                  }
                                  
                                  return (
                                    <div className="cards-select">
                                      {compatibleCards.map((card) => (
                                      <div
                                          key={card.tokenId}
                                          className={`selectable-card ${rarityClass(card.rarity)} ${
                                              selectedRequestedCard?.tokenId === card.tokenId ? 'selectable-card--selected' : ''
                                          }`}
                                          onClick={() => setSelectedRequestedCard(card)}
                                      >
                                    <span className={`selectable-card__badge ${rarityClass(card.rarity)}`}>
                                      {card.rarity}
                                    </span>

                                        <div className="selectable-card__art">
                                          <img src={card.imageURI} alt={card.name} />
                                          {selectedRequestedCard?.tokenId === card.tokenId && (
                                              <div className="selectable-card__shimmer" />
                                          )}
                                        </div>

                                        <span className="selectable-card__name">{card.name}</span>
                                        <span className="selectable-card__level">Niv. {card.level}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                        )}
                      </>
                  )}

                  <div className="modal__actions">
                    <button
                        onClick={() => setShowCreateModal(false)}
                        className="btn btn--ghost"
                    >
                      Annuler
                    </button>
                    <button
                        onClick={tradeMode === 'public' ? handleCreateTrade : handleCreateDirectTrade}
                        className="btn btn--submit"
                        disabled={
                          tradeMode === 'public'
                              ? !selectedOffered || !selectedRequestedCardName || selectedRequestedLevel === null
                              : !selectedOffered || !targetAddress || !selectedRequestedCard
                        }
                    >
                      Créer l'Offre
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {showAcceptModal && selectedTrade && (
            <div className="modal-overlay" onClick={() => setShowAcceptModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__accent" />

                <div className="modal__header">
                  <h3 className="modal__title">
                    <span className="modal__title-icon">✓</span>
                    Accepter l'Échange
                  </h3>
                  <button
                      className="modal__close"
                      onClick={() => setShowAcceptModal(false)}
                      aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal__body">
                  <p className="modal__info">
                    Sélectionne la carte {selectedTrade.requestedCardName} (Niveau {selectedTrade.requestedLevel}) que tu veux échanger :
                  </p>

                  <div className="modal-step__panel">
                    <div className="cards-select">
                      {myCards
                          .filter((c) => c.name === selectedTrade.requestedCardName && c.level === selectedTrade.requestedLevel)
                          .map((card) => (
                              <div
                                  key={card.tokenId}
                                  className={`selectable-card ${rarityClass(card.rarity)} ${
                                      selectedCardToOffer?.tokenId === card.tokenId ? 'selectable-card--selected' : ''
                                  }`}
                                  onClick={() => setSelectedCardToOffer(card)}
                              >
                                <span className={`selectable-card__badge ${rarityClass(card.rarity)}`}>
                            {card.rarity}
                          </span>

                                <div className="selectable-card__art">
                                  <img src={card.imageURI} alt={card.name} />
                                  {selectedCardToOffer?.tokenId === card.tokenId && (
                                      <div className="selectable-card__shimmer" />
                                  )}
                                </div>

                                <span className="selectable-card__name">{card.name}</span>
                                <span className="selectable-card__level">Niv. {card.level}</span>
                              </div>
                          ))}
                    </div>
                  </div>

                  <div className="modal__actions">
                    <button
                        onClick={() => setShowAcceptModal(false)}
                        className="btn btn--ghost"
                    >
                      Annuler
                    </button>
                    <button
                        onClick={handleAcceptTrade}
                        className="btn btn--submit"
                        disabled={!selectedCardToOffer}
                    >
                      Accepter l'Échange
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {showAcceptDirectModal && selectedDirectTrade && (
            <div className="modal-overlay" onClick={() => setShowAcceptDirectModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__accent" />

                <div className="modal__header">
                  <h3 className="modal__title">
                    <span className="modal__title-icon">✓</span>
                    Accepter l'Échange Direct
                  </h3>
                  <button
                      className="modal__close"
                      onClick={() => setShowAcceptDirectModal(false)}
                      aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal__body">
                  <p className="modal__info">
                    Confirme cet échange direct :
                  </p>

                  <div className="modal-step__panel">
                    {(() => {
                      const cards = directTradeCards.get(selectedDirectTrade.tradeId);
                      if (!cards) return null;

                      return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ marginBottom: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                                Tu reçois
                              </p>
                              {cards.offered && (
                                  <div className={`mini-card ${rarityClass(cards.offered.rarity)}`} style={{ margin: '0 auto' }}>
                                    <img src={cards.offered.imageURI} alt={cards.offered.name} />
                                    <span className="mini-card__name">{cards.offered.name}</span>
                                    <span className={`mini-card__rarity ${rarityClass(cards.offered.rarity)}`}>
                                      {cards.offered.rarity}
                                    </span>
                                    <span className="mini-card__level">Niv. {cards.offered.level}</span>
                                  </div>
                              )}
                            </div>

                            <div style={{ fontSize: '32px', color: 'rgba(255,255,255,0.5)' }}>
                              ⇄
                            </div>

                            <div style={{ textAlign: 'center' }}>
                              <p style={{ marginBottom: '10px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                                Tu donnes
                              </p>
                              {cards.requested && (
                                  <div className={`mini-card ${rarityClass(cards.requested.rarity)}`} style={{ margin: '0 auto' }}>
                                    <img src={cards.requested.imageURI} alt={cards.requested.name} />
                                    <span className="mini-card__name">{cards.requested.name}</span>
                                    <span className={`mini-card__rarity ${rarityClass(cards.requested.rarity)}`}>
                                      {cards.requested.rarity}
                                    </span>
                                    <span className="mini-card__level">Niv. {cards.requested.level}</span>
                                  </div>
                              )}
                            </div>
                          </div>
                      );
                    })()}
                  </div>

                  <div className="modal__actions">
                    <button
                        onClick={() => setShowAcceptDirectModal(false)}
                        className="btn btn--ghost"
                    >
                      Annuler
                    </button>
                    <button
                        onClick={handleAcceptDirectTrade}
                        className="btn btn--submit"
                    >
                      Confirmer l'Échange
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default Marketplace;

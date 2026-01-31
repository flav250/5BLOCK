// components/Marketplace.tsx

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

  // ── States ────────────────────────────────────────────────────
  const [myCards, setMyCards] = useState<ArenaCard[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [myTrades, setMyTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  // Create-trade modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOffered, setSelectedOffered] = useState<ArenaCard | null>(null);
  const [requestedTokenId, setRequestedTokenId] = useState('');

  // Trade card-details cache
  const [tradeCards, setTradeCards] = useState<
      Map<string, { offered: ArenaCard | null; requested: ArenaCard | null }>
  >(new Map());

  // ── Load data ─────────────────────────────────────────────────
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
        const [offered, requested] = await Promise.all([
          getCardDetails(signer, trade.offeredTokenId),
          getCardDetails(signer, trade.requestedTokenId),
        ]);
        cardsMap.set(trade.tradeId, { offered, requested });
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

  // ── Handlers ──────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!signer) return;
    const success = await approveMarketplace(signer);
    if (success) setIsApproved(true);
  };

  const handleCreateTrade = async () => {
    if (!signer || !selectedOffered || !requestedTokenId) return;

    const success = await createTrade(
        signer,
        selectedOffered.tokenId,
        requestedTokenId
    );

    if (success) {
      setShowCreateModal(false);
      setSelectedOffered(null);
      setRequestedTokenId('');
      loadData();
    }
  };

  const handleAcceptTrade = async (tradeId: string) => {
    if (!signer) return;
    const success = await acceptTrade(signer, tradeId);
    if (success) loadData();
  };

  const handleCancelTrade = async (tradeId: string) => {
    if (!signer) return;
    const success = await cancelTrade(signer, tradeId);
    if (success) loadData();
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

  // ── Helper: rarity class ──────────────────────────────────────
  const rarityClass = (rarity?: string) => {
    if (!rarity) return '';
    const r = rarity.toLowerCase();
    if (r.includes('légendaire') || r.includes('legendary'))
      return 'rarity--legendary';
    if (r.includes('rare')) return 'rarity--rare';
    return 'rarity--common';
  };

  // ── No wallet ─────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────
  return (
      <div className="marketplace-container">
        {/* ── Header ──────────────────────────────────────────── */}
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

        {/* ── Actions bar ─────────────────────────────────────── */}
        <div className="marketplace-actions">
          <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn--create"
              disabled={myCards.length === 0}
          >
            ➕ Créer un Échange
          </button>

          <button onClick={loadData} className="btn btn--refresh" aria-label="Rafraîchir">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.5 9a9 9 0 0114.1-3.4L23 10" />
              <path d="M20.5 15a9 9 0 01-14.1 3.4L1 14" />
            </svg>
          </button>
        </div>

        {/* ── My trades ───────────────────────────────────────── */}
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
                      </article>
                  );
                })}
              </div>
            </section>
        )}

        {/* ── All trades ──────────────────────────────────────── */}
        <section className="trades-section">
          <h3 className="trades-section__title">
            🌍 Tous les Échanges{' '}
            <span className="trades-section__count">
            ({allTrades.filter((t) => t.creator !== account).length})
          </span>
          </h3>

          {isLoading ? (
              <div className="marketplace-loading">Chargement…</div>
          ) : (
              <div className="trades-grid">
                {allTrades
                    .filter((trade) => trade.creator !== account)
                    .map((trade) => {
                      const cards = tradeCards.get(trade.tradeId);
                      if (!cards) return null;

                      const canAccept = myCards.some(
                          (c) => c.tokenId === trade.requestedTokenId
                      );

                      return (
                          <article
                              key={trade.tradeId}
                              className={`trade-card ${canAccept ? 'trade-card--acceptible' : ''}`}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, trade.tradeId)}
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
                                {cards.requested && (
                                    <div className={`mini-card mini-card--drop-zone ${rarityClass(cards.requested.rarity)}`}>
                                      <img src={cards.requested.imageURI} alt={cards.requested.name} />
                                      <span className="mini-card__name">{cards.requested.name}</span>
                                      <span className={`mini-card__rarity ${rarityClass(cards.requested.rarity)}`}>
                              {cards.requested.rarity}
                            </span>
                                      {canAccept && (
                                          <span className="mini-card__drop-hint">Glisse ta carte ici</span>
                                      )}
                                    </div>
                                )}
                              </div>
                            </div>

                            {canAccept && (
                                <button
                                    onClick={() => handleAcceptTrade(trade.tradeId)}
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

        {/* ── Create-trade modal ──────────────────────────────── */}
        {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>

                {/* top accent */}
                <div className="modal__accent" />

                {/* header */}
                <div className="modal__header">
                  <h3 className="modal__title">
                    <span className="modal__title-icon">+</span>
                    Créer un Échange
                  </h3>
                  <button
                      className="modal__close"
                      onClick={() => setShowCreateModal(false)}
                      aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>

                {/* body */}
                <div className="modal__body">

                  {/* ── Step 1 : carte offerte ── */}
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
                                draggable
                                onDragStart={() => handleDragStart(card)}
                            >
                              {/* rarity badge */}
                              <span className={`selectable-card__badge ${rarityClass(card.rarity)}`}>
                          {card.rarity}
                        </span>

                              {/* art */}
                              <div className="selectable-card__art">
                                <img src={card.imageURI} alt={card.name} />
                                {selectedOffered?.tokenId === card.tokenId && (
                                    <div className="selectable-card__shimmer" />
                                )}
                              </div>

                              {/* info */}
                              <span className="selectable-card__name">{card.name}</span>
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── divider ── */}
                  <div className="modal-divider">
                    <span className="modal-divider__line modal-divider__line--left" />
                    <span className="modal-divider__arrow">⇄</span>
                    <span className="modal-divider__line modal-divider__line--right" />
                  </div>

                  {/* ── Step 2 : ID demandée ── */}
                  <div className="modal-step">
                    <div className="modal-step__label">
                  <span className={`modal-step__dot ${requestedTokenId ? 'modal-step__dot--done' : ''}`}>
                    {requestedTokenId ? '✓' : '2'}
                  </span>
                      <span className="modal-step__text">ID de la carte demandée</span>
                    </div>

                    <div className="modal-step__panel">
                      <input
                          type="number"
                          value={requestedTokenId}
                          onChange={(e) => setRequestedTokenId(e.target.value)}
                          placeholder="Ex : 5"
                          className="modal-input"
                      />
                      <p className="modal-input__hint">
                        Entre l'ID de la carte que tu veux recevoir en retour
                      </p>
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="modal__actions">
                    <button
                        onClick={() => setShowCreateModal(false)}
                        className="btn btn--ghost"
                    >
                      Annuler
                    </button>
                    <button
                        onClick={handleCreateTrade}
                        className="btn btn--submit"
                        disabled={!selectedOffered || !requestedTokenId}
                    >
                      Créer l'Offre
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
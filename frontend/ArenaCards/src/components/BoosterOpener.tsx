// components/BoosterOpener.tsx - VERSION AVEC BARRE DE PROGRESSION

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { openBooster, getTimeUntilNextBooster, canOpenBooster } from '../utils/boosterHelpers';
import './BoosterOpener.css';

const BoosterOpener: React.FC = () => {
  const { account, signer } = useWeb3();
  const [isOpening, setIsOpening] = useState(false);
  const [canOpen, setCanOpen] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState(0);
  const [newCards, setNewCards] = useState<Array<{ name: string; rarity: string }>>([]);
  const [showAnimation, setShowAnimation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initialTimeRef = useRef<number>(0);
  const initialTimestampRef = useRef<number>(0);
  const totalCooldownRef = useRef<number>(600); // 10 minutes = 600 secondes

  const loadTimeFromContract = useCallback(async () => {
    if (!signer || !account) return;

    try {
      setIsLoading(true);

      const [timeRemaining, canOpenNow] = await Promise.all([
        getTimeUntilNextBooster(signer, account),
        canOpenBooster(signer, account)
      ]);

      initialTimeRef.current = timeRemaining;
      initialTimestampRef.current = Date.now();

      // Si on vient d'ouvrir un booster, le cooldown total est le temps retourné
      if (timeRemaining > 0 && timeRemaining <= 600) {
        totalCooldownRef.current = 600; // Toujours 10 minutes
      }

      setTimeUntilNext(timeRemaining);
      setCanOpen(canOpenNow);
    } catch (error) {
      console.error('Erreur lors de la récupération:', error);
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  useEffect(() => {
    if (!account || !signer) return;

    loadTimeFromContract();
  }, [account, signer, loadTimeFromContract]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (initialTimeRef.current > 0 && initialTimestampRef.current > 0) {
        const elapsed = Math.floor((Date.now() - initialTimestampRef.current) / 1000);
        const remaining = Math.max(0, initialTimeRef.current - elapsed);

        setTimeUntilNext(remaining);

        if (remaining === 0 && initialTimeRef.current > 0) {
          initialTimeRef.current = 0;
          loadTimeFromContract();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loadTimeFromContract]);

  // Calculer le pourcentage de progression (0-100)
  const getProgressPercentage = (): number => {
    if (timeUntilNext === 0) return 100;
    const elapsed = totalCooldownRef.current - timeUntilNext;
    return Math.min(100, Math.max(0, (elapsed / totalCooldownRef.current) * 100));
  };

  // Formater l'heure d'availability
  const getAvailableTime = (): string => {
    if (timeUntilNext === 0) return 'Maintenant';

    const now = new Date();
    const availableDate = new Date(now.getTime() + timeUntilNext * 1000);

    const hours = availableDate.getHours().toString().padStart(2, '0');
    const minutes = availableDate.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  };

  const handleOpenBooster = async () => {
    if (!signer || !canOpen || timeUntilNext > 0) return;

    setIsOpening(true);
    setShowAnimation(true);
    setNewCards([]);

    try {
      const result = await openBooster(signer);

      if (result.success) {
        setTimeout(() => {
          setNewCards(result.cards);
          setShowAnimation(false);
        }, 2000);

        setTimeout(() => {
          loadTimeFromContract();
        }, 2500);
      } else {
        setShowAnimation(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture:', error);
      setShowAnimation(false);
    } finally {
      setIsOpening(false);
    }
  };

  const closeCardsModal = () => {
    setNewCards([]);
  };

  if (!account) {
    return (
        <div className="booster-opener">
          <div className="booster-message">
            <h2>🎁 Boosters Arena Cards</h2>
            <p>Connecte ton wallet pour ouvrir des boosters</p>
          </div>
        </div>
    );
  }

  const progressPercentage = getProgressPercentage();
  const availableTime = getAvailableTime();

  return (
      <div className="booster-opener">
        <div className="booster-header">
          <h2>🎁 Ouvrir un Booster</h2>
          <p>Reçois 2 cartes aléatoires toutes les 10 minutes</p>
        </div>

        <div className="booster-container">
          {/* Booster Pack Visual */}
          <div className={`booster-pack ${showAnimation ? 'opening' : ''}`}>
            <div className="booster-front">
              <div className="booster-shine"></div>
              <div className="booster-logo">🎴</div>
              <div className="booster-title">Arena Cards</div>
              <div className="booster-subtitle">Booster Pack</div>
              <div className="booster-stars">⭐⭐</div>
            </div>
          </div>

          <div className="booster-status">
            {isLoading ? (
                <div className="status-loading">
                  <span className="status-icon">⏳</span>
                  <span className="status-text">Synchronisation...</span>
                </div>
            ) : canOpen && timeUntilNext === 0 ? (
                <div className="status-ready">
                  <span className="status-icon">✅</span>
                  <span className="status-text">Booster disponible maintenant !</span>
                </div>
            ) : (
                <div className="status-cooldown-new">
                  <div className="cooldown-info">
                    <span className="cooldown-label">Prochain booster disponible à :</span>
                    <span className="cooldown-time">🕐 {availableTime}</span>
                  </div>

                  <div className="progress-container">
                    <div className="progress-bar-wrapper">
                      <div
                          className="progress-bar-fill"
                          style={{ width: `${progressPercentage}%` }}
                      >
                        <div className="progress-shimmer"></div>
                      </div>
                    </div>
                    <div className="progress-label">
                      {Math.round(progressPercentage)}%
                    </div>
                  </div>
                </div>
            )}
          </div>

          <button
              onClick={handleOpenBooster}
              className="btn-open-booster"
              disabled={isLoading || !canOpen || isOpening || timeUntilNext > 0}
          >
            {isOpening ? (
                <>
                  <span className="button-spinner"></span>
                  Ouverture...
                </>
            ) : isLoading ? (
                <>
                  <span className="button-spinner"></span>
                  Chargement...
                </>
            ) : (
                <>
                  🎁 Ouvrir le Booster
                </>
            )}
          </button>

          <div className="booster-info">
            <h3>📋 Informations</h3>
            <ul>
              <li><strong>Contenu :</strong> 2 cartes aléatoires</li>
              <li><strong>Cooldown :</strong> 10 minutes</li>
              <li><strong>Raretés :</strong>
                <ul>
                  <li>Commune: 40% de chance</li>
                  <li>Rare: 30% de chance</li>
                  <li>Épique: 20% de chance</li>
                  <li>Légendaire: 10% de chance</li>
                </ul>
              </li>
              <li><strong>Limite :</strong> Maximum 4 cartes par compte</li>
            </ul>
          </div>
        </div>

        {newCards.length > 0 && (
            <div className="cards-modal-overlay" onClick={closeCardsModal}>
              <div className="cards-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={closeCardsModal}>✕</button>
                <h2>🎉 Félicitations !</h2>
                <p>Tu as obtenu {newCards.length} nouvelles cartes :</p>

                <div className="new-cards-grid">
                  {newCards.map((card, index) => (
                      <div key={index} className={`new-card rarity-${card.rarity}`}>
                        <div className="card-rarity-badge">{card.rarity}</div>
                        <div className="card-placeholder">🃏</div>
                        <div className="card-name">{card.name}</div>
                      </div>
                  ))}
                </div>

                <button onClick={closeCardsModal} className="btn-modal-close">
                  Continuer
                </button>
              </div>
            </div>
        )}

        {showAnimation && (
            <div className="opening-animation">
              <div className="pack-opening">
                <div className="burst"></div>
                <div className="sparkles">✨✨✨</div>
              </div>
            </div>
        )}
      </div>
  );
};

export default BoosterOpener;
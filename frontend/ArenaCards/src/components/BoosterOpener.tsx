// components/BoosterOpener.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import {
  openFreeBooster,
  openPremiumBooster,
  getTimeUntilNextFreeBooster,
  canOpenFreeBooster,
  getPremiumBoosterPrice
} from '../utils/boosterHelpers';
import './BoosterOpener.css';

type BoosterType = 'free' | 'premium';

type OpeningAnimPhase = 'idle' | 'free' | 'premium';

const PREMIUM_ANIM_MS = 2800;
const FREE_ANIM_MS = 1700;

const BoosterOpener: React.FC = () => {
  const { account, signer } = useWeb3();
  const [isOpening, setIsOpening] = useState(false);
  const [canOpenFree, setCanOpenFree] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState(0);
  const [premiumPrice, setPremiumPrice] = useState('0');
  const [newCards, setNewCards] = useState<Array<{ name: string; rarity: string; imageURI: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<BoosterType>('free');

  const [showAnimation, setShowAnimation] = useState(false);
  const [openingPhase, setOpeningPhase] = useState<OpeningAnimPhase>('idle');
  const [animKey, setAnimKey] = useState(0);

  const initialTimeRef = useRef<number>(0);
  const initialTimestampRef = useRef<number>(0);

  const timeoutsRef = useRef<number[]>([]);
  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  };

  const loadData = useCallback(async () => {
    if (!signer || !account) return;

    try {
      setIsLoading(true);

      const [timeRemaining, canOpen, price] = await Promise.all([
        getTimeUntilNextFreeBooster(signer, account),
        canOpenFreeBooster(signer, account),
        getPremiumBoosterPrice(signer)
      ]);

      initialTimeRef.current = timeRemaining;
      initialTimestampRef.current = Date.now();

      setTimeUntilNext(timeRemaining);
      setCanOpenFree(canOpen);
      setPremiumPrice(price);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  useEffect(() => {
    if (account && signer) loadData();
  }, [account, signer, loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (initialTimeRef.current > 0 && initialTimestampRef.current > 0) {
        const elapsed = Math.floor((Date.now() - initialTimestampRef.current) / 1000);
        const remaining = Math.max(0, initialTimeRef.current - elapsed);

        setTimeUntilNext(remaining);

        if (remaining === 0 && initialTimeRef.current > 0) {
          initialTimeRef.current = 0;
          loadData();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  const getProgressPercentage = (): number => {
    if (timeUntilNext === 0) return 100;
    const elapsed = 600 - timeUntilNext;
    return Math.min(100, Math.max(0, (elapsed / 600) * 100));
  };

  const getAvailableTime = (): string => {
    if (timeUntilNext === 0) return 'Maintenant';

    const now = new Date();
    const availableDate = new Date(now.getTime() + timeUntilNext * 1000);

    const hours = availableDate.getHours().toString().padStart(2, '0');
    const minutes = availableDate.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  };

  const startOpeningAnimation = (type: BoosterType) => {
    setAnimKey((k) => k + 1); // force key-based re-mount of anim nodes
    setOpeningPhase(type);
    setShowAnimation(true);
  };

  const stopOpeningAnimation = () => {
    setShowAnimation(false);
    setOpeningPhase('idle');
  };

  const handleOpenBooster = async () => {
    if (!signer) return;

    clearAllTimeouts();
    setIsOpening(true);
    setNewCards([]);

    startOpeningAnimation(selectedType);

    try {
      const result = selectedType === 'free'
          ? await openFreeBooster(signer)
          : await openPremiumBooster(signer);

      if (result.success) {
        const animMs = selectedType === 'premium' ? PREMIUM_ANIM_MS : FREE_ANIM_MS;

        const t1 = window.setTimeout(() => {
          setNewCards(result.cards);
          stopOpeningAnimation();
        }, animMs);
        timeoutsRef.current.push(t1);

        const t2 = window.setTimeout(() => {
          loadData();
        }, animMs + 250);
        timeoutsRef.current.push(t2);
      } else {
        stopOpeningAnimation();
      }
    } catch (error) {
      console.error('Erreur ouverture:', error);
      stopOpeningAnimation();
    } finally {
      setIsOpening(false);
    }
  };

  const closeCardsModal = () => setNewCards([]);

  if (!account) {
    return (
        <div className="booster-opener">
          <div className="booster-message">
            <h2>Boosters Arena Cards</h2>
            <p>Connecte ton wallet pour ouvrir des boosters</p>
          </div>
        </div>
    );
  }

  const progressPercentage = getProgressPercentage();
  const availableTime = getAvailableTime();
  const canOpenCurrent = selectedType === 'free' ? canOpenFree : true;

  return (
      <div className="booster-opener">
        <div className="booster-header">
          <h2>Ouvrir un Booster</h2>
          <p>Choisis entre booster gratuit ou premium</p>
        </div>

        <div className="booster-container">
          <div className="booster-type-selector">
            <button
                className={`type-btn ${selectedType === 'free' ? 'active' : ''}`}
                onClick={() => setSelectedType('free')}
                disabled={isOpening}
            >
              <div className="type-icon">🆓</div>
              <div className="type-name">Booster Gratuit</div>
              <div className="type-desc">Cooldown 10 min • 2 cartes</div>
            </button>

            <button
                className={`type-btn ${selectedType === 'premium' ? 'active' : ''}`}
                onClick={() => setSelectedType('premium')}
                disabled={isOpening}
            >
              <div className="type-icon">💎</div>
              <div className="type-name">Booster Premium</div>
              <div className="type-desc">{premiumPrice} ETH • 4 cartes</div>
            </button>
          </div>

          <div
              className={`booster-pack ${showAnimation ? 'opening' : ''}`}
              onClick={() => {
                if (!isLoading && canOpenCurrent && !isOpening) handleOpenBooster();
              }}
              role="button"
              tabIndex={0}
          >
            <div className={`booster-front ${selectedType}`}>
              <img
                  src={
                    selectedType === 'free'
                        ? '/assets/boosters/booster-2-stars.png'
                        : '/assets/boosters/booster-3-stars.png'
                  }
                  alt={`${selectedType === 'free' ? 'Free' : 'Premium'} Booster`}
                  className="booster-image"
              />
            </div>
          </div>

          <div className="booster-status">
            {isLoading ? (
                <div className="status-loading">
                  <span className="status-icon">⏳</span>
                  <span className="status-text">Synchronisation...</span>
                </div>
            ) : selectedType === 'premium' ? (
                <div className="status-ready premium">
                  <span className="status-icon">💎</span>
                  <span className="status-text">Booster premium disponible !</span>
                </div>
            ) : canOpenFree ? (
                <div className="status-ready">
                  <span className="status-icon">✅</span>
                  <span className="status-text">Booster gratuit disponible !</span>
                </div>
            ) : (
                <div className="status-cooldown-new">
                  <div className="cooldown-info">
                    <span className="cooldown-label">Prochain booster gratuit à :</span>
                    <span className="cooldown-time">🕐 {availableTime}</span>
                  </div>

                  <div className="progress-container">
                    <div className="progress-bar-wrapper">
                      <div
                          className="progress-bar-fill"
                          style={{ width: `${progressPercentage}%` }}
                      >
                        <div className="progress-shimmer" />
                      </div>
                    </div>
                    <div className="progress-label">{Math.round(progressPercentage)}%</div>
                  </div>
                </div>
            )}
          </div>

          <button
              onClick={handleOpenBooster}
              className={`btn-open-booster ${selectedType}`}
              disabled={isLoading || !canOpenCurrent || isOpening}
          >
            {isOpening ? (
                <>
                  <span className="button-spinner" />
                  Ouverture...
                </>
            ) : isLoading ? (
                <>
                  <span className="button-spinner" />
                  Chargement...
                </>
            ) : selectedType === 'premium' ? (
                <>💎 Acheter ({premiumPrice} ETH)</>
            ) : (
                <>🎁 Ouvrir le Booster</>
            )}
          </button>

          <div className="booster-info">
            <h3>📋 {selectedType === 'free' ? 'Booster Gratuit' : 'Booster Premium'}</h3>
            {selectedType === 'free' ? (
                <ul>
                  <li><strong>Contenu :</strong> 2 cartes aléatoires</li>
                  <li><strong>Cooldown :</strong> 10 minutes</li>
                  <li><strong>Prix :</strong> Gratuit</li>
                  <li><strong>Taux de drop :</strong>
                    <ul>
                      <li>💎 Légendaire: 0.1%</li>
                      <li>🟣 Épique: 10%</li>
                      <li>🔵 Rare: 20%</li>
                      <li>🟢 Peu Commune: 25%</li>
                      <li>⚪ Commune: 44.9%</li>
                    </ul>
                  </li>
                </ul>
            ) : (
                <ul>
                  <li><strong>Contenu :</strong> 4 cartes aléatoires</li>
                  <li><strong>Cooldown :</strong> Aucun</li>
                  <li><strong>Prix :</strong> {premiumPrice} ETH</li>
                  <li><strong>Taux de drop :</strong>
                    <ul>
                      <li>💎 Légendaire: 1%</li>
                      <li>🟣 Épique: 20%</li>
                      <li>🔵 Rare: 40%</li>
                      <li>🟢 Peu Commune: 39%</li>
                      <li>⚪ Commune: 0% (pas de communes !)</li>
                    </ul>
                  </li>
                </ul>
            )}
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
                      <div key={index} className={`new-card rarity-${card.rarity.replace(' ', '-')}`}>
                        <div className="card-rarity-badge">{card.rarity}</div>
                        <div className="card-image-container">
                          {card.imageURI ? (
                            <img 
                              src={card.imageURI} 
                              alt={card.name}
                              className="card-image"
                            />
                          ) : (
                            <div className="card-placeholder">🃏</div>
                          )}
                        </div>
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
            <div
                key={animKey}
                className={`opening-overlay ${openingPhase}`}
                aria-hidden="true"
            >
              <div className="opening-stage">
                <div className="opening-pack">
                  <img
                      src={
                        openingPhase === 'premium'
                            ? '/assets/boosters/booster-3-stars.png'
                            : '/assets/boosters/booster-2-stars.png'
                      }
                      alt=""
                      className="opening-pack-img"
                  />
                  <div className="opening-glow" />
                  <div className="opening-sparkle-layer" />
                  {openingPhase === 'premium' && (
                      <>
                        <div className="premium-ring premium-ring-1" />
                        <div className="premium-ring premium-ring-2" />
                        <div className="premium-ring premium-ring-3" />
                        <div className="premium-burst" />
                        <div className="premium-stars">
                          {Array.from({ length: 18 }).map((_, i) => (
                              <span
                                  key={i}
                                  className="premium-star"
                                  style={{ ['--i' as never]: i }}
                              />
                          ))}
                        </div>
                      </>
                  )}
                  {openingPhase === 'free' && (
                      <>
                        <div className="free-pop" />
                        <div className="free-sparkles">✨✨✨</div>
                      </>
                  )}
                </div>

                <div className="opening-caption">
                  {openingPhase === 'premium' ? 'Ouverture du booster premium…' : 'Ouverture…'}
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default BoosterOpener;

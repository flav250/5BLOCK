import React, { useState, useEffect, useCallback } from 'react';
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

  const checkCanOpen = useCallback(async () => {
    if (!signer || !account) return;

    try {
      const canOpenNow = await canOpenBooster(signer, account);
      setCanOpen(canOpenNow);

      const timeRemaining = await getTimeUntilNextBooster(signer, account);
      setTimeUntilNext(timeRemaining);
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
    }
  }, [signer, account]);

  // Vérifier toutes les secondes
  useEffect(() => {
    if (!account || !signer) return;

    checkCanOpen();
    const interval = setInterval(checkCanOpen, 1000);

    return () => clearInterval(interval);
  }, [account, signer, checkCanOpen]);

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenBooster = async () => {
    if (!signer || !canOpen) return;

    setIsOpening(true);
    setShowAnimation(true);
    setNewCards([]);

    try {
      const result = await openBooster(signer);

      if (result.success) {
        // Simuler l'animation d'ouverture
        setTimeout(() => {
          setNewCards(result.cards);
          setShowAnimation(false);
        }, 2000);

        // Rafraîchir le statut
        setTimeout(() => {
          checkCanOpen();
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

        {/* Status */}
        <div className="booster-status">
          {canOpen ? (
            <div className="status-ready">
              <span className="status-icon">✅</span>
              <span className="status-text">Booster prêt !</span>
            </div>
          ) : (
            <div className="status-cooldown">
              <span className="status-icon">⏱️</span>
              <span className="status-text">
                Prochain booster dans : <strong>{formatTime(timeUntilNext)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Button */}
        <button
          onClick={handleOpenBooster}
          className="btn-open-booster"
          disabled={!canOpen || isOpening}
        >
          {isOpening ? (
            <>
              <span className="button-spinner"></span>
              Ouverture...
            </>
          ) : (
            <>
              🎁 Ouvrir le Booster
            </>
          )}
        </button>

        {/* Info Box */}
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
                <li>Légendaire: 1% de chance</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      {/* Modal des cartes obtenues */}
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

      {/* Animation d'ouverture */}
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

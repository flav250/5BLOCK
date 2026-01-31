// components/InventoryCard.tsx - VERSION AVEC ATTACK STAT ✅

import React, { useState, useEffect, useRef } from 'react';
import type { ArenaCard } from '../types/ArenaCard';
import { RARITY_GRADIENT } from '../types/ArenaCard';
import './InventoryCard.css';

interface InventoryCardProps {
  card: ArenaCard;
  onDragStart: (card: ArenaCard) => void;
  onDragEnd: () => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
                                                       card,
                                                       onDragStart,
                                                       onDragEnd,
                                                     }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!card.isLocked) {
      setTimeRemaining('');
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now() / 1000;
      const remaining = card.unlockTime - now;

      if (remaining <= 0) {
        setTimeRemaining('');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);

      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [card.isLocked, card.unlockTime]);

  const handleDragStart = () => {
    setIsDragging(true);
    onDragStart(card);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd();
  };

  return (
      <div
          className={`inventory-card ${isDragging ? 'dragging' : ''} ${
              card.isLocked ? 'locked' : ''
          }`}
          draggable={!card.isLocked}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
      >
        {/* Badge de rareté */}
        <div
            className={`rarity-badge bg-gradient-to-r ${
                RARITY_GRADIENT[card.rarity.toLowerCase()] ||
                'from-gray-400 to-gray-600'
            }`}
        >
          {card.rarity}
        </div>

        {/* Image */}
        <div className="card-image-wrapper">
          <div className="card-image">
            {card.imageURI ? (
                <img src={card.imageURI} alt={card.name} />
            ) : (
                <div className="placeholder-image">
                  <span className="placeholder-icon">🃏</span>
                </div>
            )}
          </div>

          {card.isLocked && (
              <div className="lock-overlay">
                <div className="lock-icon">🔒</div>
                <div className="lock-timer">{timeRemaining}</div>
              </div>
          )}
        </div>

        {/* Infos */}
        <div className="card-details">
          <h4 className="card-name" title={card.name}>
            {card.name}
          </h4>

          <div className="card-stats">
            <div className="stat">
              <span className="stat-label">Niveau</span>
              <span className="stat-value">{card.level}</span>
            </div>
            <div className="stat">
              <span className="stat-label">⚔️ Attack</span>
              <span className="stat-value attack">{card.attack}</span>
            </div>
          </div>

          <div className="card-id">#{card.tokenId}</div>
        </div>

        {!card.isLocked && (
            <div className="drag-hint">
              <span className="drag-icon">⇅</span>
            </div>
        )}
      </div>
  );
};

export default InventoryCard;
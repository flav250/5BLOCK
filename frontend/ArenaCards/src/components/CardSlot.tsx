// components/CardSlot.tsx

import React, { useState } from 'react';
import type { TeamSlot, ArenaCard } from '../types/ArenaCard';
import { RARITY_GRADIENT } from '../types/ArenaCard';
import './CardSlot.css';

interface CardSlotProps {
  slot: TeamSlot;
  slotIndex: number;
  onDragStart: (card: ArenaCard) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onRemove: () => void;
  isDragOver: boolean;
}

const CardSlot: React.FC<CardSlotProps> = ({
                                             slot,
                                             slotIndex,
                                             onDragStart,
                                             onDragEnd,
                                             onDrop,
                                             onRemove,
                                             isDragOver,
                                           }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovered(true);
  };

  const handleDragLeave = () => {
    setIsHovered(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovered(false);
    onDrop();
  };

  const isEmpty = slot.card === null;

  return (
      <div
          className={`card-slot ${isEmpty ? 'empty' : 'filled'} ${
              isHovered && isDragOver ? 'drag-over' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
      >
        {isEmpty ? (
            // Slot vide
            <div className="empty-slot-content">
              <div className="slot-number">{slotIndex + 1}</div>
              <div className="slot-placeholder">
                <div className="placeholder-icon">🃏</div>
                <p>Glisse une carte ici</p>
              </div>
            </div>
        ) : (
            // Slot avec carte
            <div
                className="filled-slot-content"
                draggable
                onDragStart={() => slot.card && onDragStart(slot.card)}
                onDragEnd={onDragEnd}
            >
              {/* Badge de position */}
              <div className="position-badge">{slotIndex + 1}</div>

              {/* Bouton de suppression */}
              <button
                  className="remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  title="Retirer de l'équipe"
              >
                ✕
              </button>

              {/* Image de la carte */}
              <div className="card-image-container">
                <div className="card-image">
                  {slot.card!.imageURI ? (
                      <img src={slot.card!.imageURI} alt={slot.card!.name} />
                  ) : (
                      <div className="placeholder-image">🃏</div>
                  )}
                </div>
              </div>

              {/* Badge de rareté */}
              <div
                  className={`rarity-badge bg-gradient-to-r ${
                      RARITY_GRADIENT[slot.card!.rarity.toLowerCase()] || 'from-gray-400 to-gray-600'
                  }`}
              >
                {slot.card!.rarity}
              </div>

              {/* Informations de la carte */}
              <div className="card-info">
                <h3 className="card-name">{slot.card!.name}</h3>
                <div className="card-stats-row">
                  <div className="stat-item">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-text">Niv. {slot.card!.level}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">💪</span>
                    <span className="stat-text">{slot.card!.level * 10}</span>
                  </div>
                </div>
              </div>

              {/* Indicateur de lock */}
              {slot.card!.isLocked && (
                  <div className="lock-indicator">
                    🔒 Verrouillée
                  </div>
              )}
            </div>
        )}
      </div>
  );
};

export default CardSlot;
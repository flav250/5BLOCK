import React, { useState, useEffect, useCallback } from 'react';
import type { ArenaCard, TeamSlot } from '../types/ArenaCard';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards } from '../utils/contractHelpers';
import CardSlot from './CardSlot';
import InventoryCard from './InventoryCard';
import './TeamBuilder.css';

const MAX_TEAM_SIZE = 5;

const TeamBuilder: React.FC = () => {
  const { account, signer } = useWeb3();

  // État de l'équipe (5 slots)
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>(
      Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
        position: i,
        card: null,
      }))
  );

  // Cartes dans l'inventaire
  const [inventory, setInventory] = useState<ArenaCard[]>([]);

  // Carte en cours de drag
  const [draggedCard, setDraggedCard] = useState<ArenaCard | null>(null);
  const [dragSource, setDragSource] = useState<'inventory' | 'team' | null>(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState<number | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fonction de chargement des cartes (useCallback pour éviter recréation)
  const loadCards = useCallback(async () => {
    if (!signer || !account) return;

    setIsLoading(true);
    try {
      const cards = await loadUserCards(signer, account);
      setInventory(cards);
    } catch (error) {
      console.error('Erreur lors du chargement des cartes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [signer, account]);

  // Charger les cartes au montage et quand account/signer change
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Calculer la puissance totale de l'équipe
  const getTotalPower = (): number => {
    return teamSlots.reduce((total, slot) => {
      return total + (slot.card ? slot.card.level * 10 : 0);
    }, 0);
  };

  // Compter les cartes dans l'équipe
  const getTeamCount = (): number => {
    return teamSlots.filter(slot => slot.card !== null).length;
  };

  // --- DRAG & DROP HANDLERS ---

  const handleDragStart = (
      card: ArenaCard,
      source: 'inventory' | 'team',
      slotIndex?: number
  ) => {
    setDraggedCard(card);
    setDragSource(source);
    if (source === 'team' && slotIndex !== undefined) {
      setDraggedFromSlot(slotIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragSource(null);
    setDraggedFromSlot(null);
  };

  const handleDropOnSlot = (slotIndex: number) => {
    if (!draggedCard) return;

    // Vérifier si la carte est verrouillée
    if (draggedCard.isLocked) {
      alert('Cette carte est encore verrouillée !');
      handleDragEnd();
      return;
    }

    const newTeamSlots = [...teamSlots];

    if (dragSource === 'inventory') {
      // Déposer depuis l'inventaire vers un slot

      // Si le slot est occupé, échanger
      if (newTeamSlots[slotIndex].card) {
        const cardToSwap = newTeamSlots[slotIndex].card;
        newTeamSlots[slotIndex].card = draggedCard;

        // Remettre l'ancienne carte dans l'inventaire
        if (cardToSwap) {
          setInventory(prev => [...prev, cardToSwap]);
        }

        // Retirer la nouvelle carte de l'inventaire
        setInventory(prev =>
            prev.filter(c => c.tokenId !== draggedCard.tokenId)
        );
      } else {
        // Slot vide
        newTeamSlots[slotIndex].card = draggedCard;

        // Retirer de l'inventaire
        setInventory(prev =>
            prev.filter(c => c.tokenId !== draggedCard.tokenId)
        );
      }
    } else if (dragSource === 'team' && draggedFromSlot !== null) {
      // Déplacer d'un slot à un autre

      const fromSlot = newTeamSlots[draggedFromSlot];
      const toSlot = newTeamSlots[slotIndex];

      // Échanger les cartes
      newTeamSlots[slotIndex].card = fromSlot.card;
      newTeamSlots[draggedFromSlot].card = toSlot.card;
    }

    setTeamSlots(newTeamSlots);
    handleDragEnd();
  };

  const handleDropOnInventory = () => {
    if (!draggedCard || dragSource !== 'team' || draggedFromSlot === null) {
      handleDragEnd();
      return;
    }

    // Retirer la carte du slot et la remettre dans l'inventaire
    const newTeamSlots = [...teamSlots];
    newTeamSlots[draggedFromSlot].card = null;
    setTeamSlots(newTeamSlots);

    setInventory(prev => [...prev, draggedCard]);
    handleDragEnd();
  };

  const removeCardFromSlot = (slotIndex: number) => {
    const newTeamSlots = [...teamSlots];
    const card = newTeamSlots[slotIndex].card;

    if (card) {
      newTeamSlots[slotIndex].card = null;
      setTeamSlots(newTeamSlots);
      setInventory(prev => [...prev, card]);
    }
  };

  // Sauvegarder l'équipe on-chain (optionnel)
  const saveTeam = async () => {
    if (!signer) return;

    setIsSaving(true);
    try {
      const teamCardIds = teamSlots
          .filter(slot => slot.card !== null)
          .map(slot => slot.card!.tokenId);

      // Appeler le contrat Team.sol (si tu l'as intégré)
      console.log('Sauvegarde de l\'équipe:', teamCardIds);

      // TODO: Implémenter l'appel au contrat
      // const teamContract = getTeamContract(signer);
      // await teamContract.setTeam(teamCardIds);

      alert('Équipe sauvegardée !');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de l\'équipe');
    } finally {
      setIsSaving(false);
    }
  };

  const resetTeam = () => {
    // Remettre toutes les cartes dans l'inventaire
    const cardsToReturn = teamSlots
        .filter(slot => slot.card !== null)
        .map(slot => slot.card!);

    setInventory(prev => [...prev, ...cardsToReturn]);

    // Réinitialiser les slots
    setTeamSlots(
        Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
          position: i,
          card: null,
        }))
    );
  };

  if (!account) {
    return (
        <div className="team-builder-container">
          <div className="connect-prompt">
            <h2>🦊 Connecte ton wallet</h2>
            <p>Pour voir tes cartes et composer ton équipe</p>
          </div>
        </div>
    );
  }

  return (
      <div className="team-builder-container">
        {/* En-tête avec statistiques */}
        <div className="team-header">
          <h1>⚔️ Composition d'Équipe</h1>
          <div className="team-stats">
            <div className="stat-box">
              <span className="stat-label">Cartes</span>
              <span className="stat-value">{getTeamCount()}/{MAX_TEAM_SIZE}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Puissance</span>
              <span className="stat-value power">{getTotalPower()}</span>
            </div>
          </div>
        </div>

        {/* Zone des 5 slots d'équipe */}
        <div className="team-slots-section">
          <h2>🎯 Mon Équipe</h2>
          <div className="team-slots-grid">
            {teamSlots.map((slot, index) => (
                <CardSlot
                    key={slot.position}
                    slot={slot}
                    slotIndex={index}
                    onDragStart={(card) => handleDragStart(card, 'team', index)}
                    onDragEnd={handleDragEnd}
                    onDrop={() => handleDropOnSlot(index)}
                    onRemove={() => removeCardFromSlot(index)}
                    isDragOver={draggedCard !== null}
                />
            ))}
          </div>

          {/* Boutons d'action */}
          <div className="team-actions">
            <button
                onClick={resetTeam}
                className="btn-secondary"
                disabled={getTeamCount() === 0}
            >
              🔄 Réinitialiser
            </button>
            <button
                onClick={saveTeam}
                className="btn-primary"
                disabled={isSaving || getTeamCount() === 0}
            >
              {isSaving ? '💾 Sauvegarde...' : '💾 Sauvegarder l\'équipe'}
            </button>
          </div>
        </div>

        {/* Inventaire des cartes */}
        <div
            className="inventory-section"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnInventory}
        >
          <div className="inventory-header">
            <h2>🎒 Mon Inventaire</h2>
            <button onClick={loadCards} className="btn-refresh" disabled={isLoading}>
              {isLoading ? '⏳' : '🔄'}
            </button>
          </div>

          {isLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Chargement de tes cartes...</p>
              </div>
          ) : inventory.length === 0 ? (
              <div className="empty-inventory">
                <p>📭 Ton inventaire est vide</p>
                <p>Ouvre des boosters pour obtenir des cartes !</p>
              </div>
          ) : (
              <div className="inventory-grid">
                {inventory.map((card) => (
                    <InventoryCard
                        key={card.tokenId}
                        card={card}
                        onDragStart={(card) => handleDragStart(card, 'inventory')}
                        onDragEnd={handleDragEnd}
                    />
                ))}
              </div>
          )}
        </div>
      </div>
  );
};

export default TeamBuilder;
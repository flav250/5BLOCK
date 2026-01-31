import React, { useState, useEffect, useCallback } from 'react';
import type { ArenaCard, TeamSlot } from '../types/ArenaCard';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards, saveTeam as saveTeamOnChain, loadTeam as loadTeamFromChain } from '../utils/contractHelpers';
import CardSlot from './CardSlot';
import InventoryCard from './InventoryCard';
import './TeamBuilder.css';

const MAX_TEAM_SIZE = 5;

const TeamBuilder: React.FC = () => {
  const { account, signer } = useWeb3();

  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>(
      Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
        position: i,
        card: null,
      }))
  );

  const [inventory, setInventory] = useState<ArenaCard[]>([]);
  const [draggedCard, setDraggedCard] = useState<ArenaCard | null>(null);
  const [dragSource, setDragSource] = useState<'inventory' | 'team' | null>(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const loadSavedTeam = useCallback(async () => {
    if (!signer || !account) return;
    try {
      const savedCardIds = await loadTeamFromChain(signer);
      if (savedCardIds.length === 0) return;

      const allCards = await loadUserCards(signer, account);
      const newTeamSlots: TeamSlot[] = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
        position: i,
        card: null,
      }));

      const cardsInTeam: ArenaCard[] = [];
      savedCardIds.forEach((tokenId, index) => {
        const card = allCards.find(c => c.tokenId === tokenId);
        if (card && index < MAX_TEAM_SIZE) {
          newTeamSlots[index] = { position: index, card: card };
          cardsInTeam.push(card);
        }
      });

      setTeamSlots(newTeamSlots);
      setInventory(allCards.filter(card =>
          !cardsInTeam.some(teamCard => teamCard.tokenId === card.tokenId)
      ));
    } catch (error) {
      console.error('Erreur chargement équipe:', error);
    }
  }, [signer, account]);

  useEffect(() => {
    const init = async () => {
      await loadCards();
      await loadSavedTeam();
    };
    init();
  }, [loadCards, loadSavedTeam]);

  const getTotalAttack = (): number => {
    return teamSlots.reduce((total, slot) => total + (slot.card ? slot.card.attack : 0), 0);
  };

  const getTeamCount = (): number => {
    return teamSlots.filter(slot => slot.card !== null).length;
  };

  const handleDragStart = (card: ArenaCard, source: 'inventory' | 'team', slotIndex?: number) => {
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

    if (draggedCard.isLocked) {
      alert('Cette carte est encore verrouillée !');
      handleDragEnd();
      return;
    }

    if (dragSource === 'inventory') {
      // Déposer depuis inventaire
      const newTeamSlots = [...teamSlots];
      const targetCard = newTeamSlots[slotIndex].card;

      newTeamSlots[slotIndex].card = draggedCard;
      setTeamSlots(newTeamSlots);

      // Retirer de l'inventaire
      setInventory(prev => prev.filter(c => c.tokenId !== draggedCard.tokenId));

      // Si slot occupé, remettre ancienne carte
      if (targetCard) {
        setInventory(prev => [...prev, targetCard]);
      }

    } else if (dragSource === 'team' && draggedFromSlot !== null) {
      // Déplacer entre slots
      if (draggedFromSlot === slotIndex) {
        handleDragEnd();
        return;
      }

      const newTeamSlots = [...teamSlots];
      const temp = newTeamSlots[slotIndex].card;
      newTeamSlots[slotIndex].card = newTeamSlots[draggedFromSlot].card;
      newTeamSlots[draggedFromSlot].card = temp;
      setTeamSlots(newTeamSlots);
    }

    handleDragEnd();
  };

  const handleDropOnInventory = () => {
    if (!draggedCard || dragSource !== 'team' || draggedFromSlot === null) {
      handleDragEnd();
      return;
    }

    const newTeamSlots = [...teamSlots];
    newTeamSlots[draggedFromSlot].card = null;
    setTeamSlots(newTeamSlots);

    setInventory(prev => {
      if (prev.some(c => c.tokenId === draggedCard.tokenId)) {
        console.warn('⚠️ Duplication évitée');
        return prev;
      }
      return [...prev, draggedCard];
    });

    handleDragEnd();
  };

  const removeCardFromSlot = (slotIndex: number) => {
    const card = teamSlots[slotIndex].card;
    if (!card) return;

    const newTeamSlots = [...teamSlots];
    newTeamSlots[slotIndex].card = null;
    setTeamSlots(newTeamSlots);

    setInventory(prev => {
      if (prev.some(c => c.tokenId === card.tokenId)) {
        console.warn('⚠️ Duplication évitée');
        return prev;
      }
      return [...prev, card];
    });
  };

  const saveTeam = async () => {
    if (!signer) return;
    setIsSaving(true);
    try {
      const teamCardIds = teamSlots.filter(s => s.card).map(s => s.card!.tokenId);
      const success = await saveTeamOnChain(signer, teamCardIds);
      if (success) alert('✅ Équipe sauvegardée !');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('❌ Erreur sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const resetTeam = () => {
    const cardsToReturn = teamSlots.filter(s => s.card).map(s => s.card!);

    setInventory(prev => {
      const existingIds = new Set(prev.map(c => c.tokenId));
      const newCards = cardsToReturn.filter(card => !existingIds.has(card.tokenId));
      return [...prev, ...newCards];
    });

    setTeamSlots(Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({ position: i, card: null })));
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
        <div className="team-header">
          <h1>⚔️ Composition d'Équipe</h1>
          <div className="team-stats">
            <div className="stat-box">
              <span className="stat-label">Cartes</span>
              <span className="stat-value">{getTeamCount()}/{MAX_TEAM_SIZE}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">⚔️ Attack Total</span>
              <span className="stat-value power">{getTotalAttack()}</span>
            </div>
          </div>
        </div>

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

          <div className="team-actions">
            <button onClick={resetTeam} className="btn-secondary" disabled={getTeamCount() === 0}>
              🔄 Réinitialiser
            </button>
            <button onClick={saveTeam} className="btn-primary" disabled={isSaving || getTeamCount() === 0}>
              {isSaving ? '💾 Sauvegarde...' : '💾 Sauvegarder l\'équipe'}
            </button>
          </div>
        </div>

        <div className="inventory-section" onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnInventory}>
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
                <p>🔭 Ton inventaire est vide</p>
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
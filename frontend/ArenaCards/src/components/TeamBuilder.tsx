import React, { useState, useEffect, useCallback } from 'react';
import type { ArenaCard, TeamSlot } from '../types/ArenaCard';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards } from '../utils/contractHelpers';
import CardSlot from './CardSlot';
import InventoryCard from './InventoryCard';
import './TeamBuilder.css';

const MAX_TEAM_SIZE = 5;
const LOCAL_STORAGE_KEY = 'arenaCards_team_';

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [dragY, setDragY] = useState<number>(0);

  // Auto-scroll pendant le drag
  useEffect(() => {
    if (!draggedCard) return;

    let animationFrameId: number;
    const scrollSpeed = 10;
    const edgeSize = 100;

    const autoScroll = () => {
      const windowHeight = window.innerHeight;
      
      if (dragY < edgeSize && dragY > 0) {
        const intensity = 1 - (dragY / edgeSize);
        window.scrollBy(0, -scrollSpeed * intensity);
      }
      else if (dragY > windowHeight - edgeSize && dragY < windowHeight) {
        const intensity = 1 - ((windowHeight - dragY) / edgeSize);
        window.scrollBy(0, scrollSpeed * intensity);
      }

      animationFrameId = requestAnimationFrame(autoScroll);
    };

    animationFrameId = requestAnimationFrame(autoScroll);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggedCard, dragY]);

  // Tracker la position Y du curseur pendant le drag
  useEffect(() => {
    if (!draggedCard) return;

    const handleDragMove = (e: DragEvent) => {
      setDragY(e.clientY);
    };

    document.addEventListener('drag', handleDragMove);
    document.addEventListener('dragover', handleDragMove);

    return () => {
      document.removeEventListener('drag', handleDragMove);
      document.removeEventListener('dragover', handleDragMove);
    };
  }, [draggedCard]);

  // --- LOCAL STORAGE FUNCTIONS ---

  /**
   * Sauvegarde l'équipe dans localStorage (auto-sauvegarde locale)
   */
  const saveTeamToLocalStorage = useCallback((slots: TeamSlot[]) => {
    if (!account) return;

    const teamData = {
      cardIds: slots
          .filter(slot => slot.card !== null)
          .map(slot => slot.card!.tokenId),
      timestamp: Date.now(),
    };

    localStorage.setItem(LOCAL_STORAGE_KEY + account, JSON.stringify(teamData));
    console.log('💾 Auto-sauvegarde locale effectuée');
  }, [account]);

  /**
   * Charge l'équipe depuis localStorage
   */
  const loadTeamFromLocalStorage = useCallback(async (): Promise<string[] | null> => {
    if (!account || !signer) return null;

    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY + account);
    if (!savedData) return null;

    try {
      const teamData = JSON.parse(savedData);
      console.log('📂 Équipe trouvée dans localStorage:', teamData);
      return teamData.cardIds as string[];
    } catch (error) {
      console.error('Erreur lors du chargement depuis localStorage:', error);
      return null;
    }
  }, [account, signer]);

  /**
   * Efface l'équipe du localStorage
   */
  const clearTeamFromLocalStorage = useCallback(() => {
    if (!account) return;
    localStorage.removeItem(LOCAL_STORAGE_KEY + account);
    console.log('🗑️ Équipe locale effacée');
  }, [account]);

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

  // Chargement initial
  useEffect(() => {
    const init = async () => {
      if (!signer || !account) {
        setIsInitialLoading(false);
        return;
      }

      try {
        setIsInitialLoading(true);
        
        // 1. Charger toutes les cartes de l'utilisateur
        const allCards = await loadUserCards(signer, account);
        
        // 2. Charger l'équipe depuis localStorage
        const localTeam = await loadTeamFromLocalStorage();
        
        if (localTeam && localTeam.length > 0) {
          // 3. Reconstituer l'équipe
          const newTeamSlots: TeamSlot[] = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
            position: i,
            card: null,
          }));

          const cardsInTeam: ArenaCard[] = [];
          
          localTeam.forEach((tokenId: string, index: number) => {
            const card = allCards.find(c => c.tokenId === tokenId);
            if (card && index < MAX_TEAM_SIZE) {
              newTeamSlots[index] = {
                position: index,
                card: card
              };
              cardsInTeam.push(card);
            }
          });

          setTeamSlots(newTeamSlots);
          setInventory(allCards.filter(card =>
              !cardsInTeam.some(teamCard => teamCard.tokenId === card.tokenId)
          ));
          
          console.log('💾 Équipe chargée depuis localStorage');
        } else {
          // Pas d'équipe sauvegardée, toutes les cartes vont dans l'inventaire
          setInventory(allCards);
        }
      } catch (error) {
        console.error('Erreur lors du chargement initial:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    init();
  }, [signer, account, loadTeamFromLocalStorage]);

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

    let newTeamSlots = [...teamSlots];

    if (dragSource === 'inventory') {
      // Déposer depuis inventaire
      const targetCard = newTeamSlots[slotIndex].card;

      newTeamSlots[slotIndex].card = draggedCard;

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

      const temp = newTeamSlots[slotIndex].card;
      newTeamSlots[slotIndex].card = newTeamSlots[draggedFromSlot].card;
      newTeamSlots[draggedFromSlot].card = temp;
    }

    setTeamSlots(newTeamSlots);

    // Auto-sauvegarde locale
    saveTeamToLocalStorage(newTeamSlots);
    
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

    // Auto-sauvegarde locale
    saveTeamToLocalStorage(newTeamSlots);
    
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

    // Auto-sauvegarde locale
    saveTeamToLocalStorage(newTeamSlots);
  };

  const resetTeam = () => {
    // Remettre toutes les cartes dans l'inventaire
    const cardsToReturn = teamSlots
        .filter(slot => slot.card !== null)
        .map(slot => slot.card!);

    setInventory(prev => {
      const existingIds = new Set(prev.map(c => c.tokenId));
      const newCards = cardsToReturn.filter(card => !existingIds.has(card.tokenId));
      return [...prev, ...newCards];
    });

    // Réinitialiser les slots
    const emptySlots = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
      position: i,
      card: null,
    }));
    setTeamSlots(emptySlots);

    // Effacer le localStorage
    clearTeamFromLocalStorage();

    console.log('✅ Équipe réinitialisée');
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

  if (isInitialLoading) {
    return (
        <div className="team-builder-container">
          <div className="team-header">
            <h1>Composition d'Équipe</h1>
          </div>
          <div className="initial-loading-container">
            <div className="loading-state">
              <div className="spinner"></div>
              <h2>⏳ Chargement en cours...</h2>
              <p>📦 Récupération de tes cartes</p>
              <p>💾 Restauration de ton équipe</p>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="team-builder-container">
        <div className="team-header">
          <h1>Composition d'Équipe</h1>
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
            <button
                onClick={resetTeam}
                className="btn-secondary"
                disabled={getTeamCount() === 0}
            >
               Réinitialiser
            </button>
          </div>
          
          {getTeamCount() > 0 && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              backgroundColor: 'rgba(52, 152, 219, 0.1)', 
              borderRadius: '8px',
              border: '1px solid rgba(52, 152, 219, 0.3)'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#3498db' }}>
                💾 <strong>Auto-sauvegarde locale active</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#95a5a6', marginTop: '0.25rem' }}>
                Ton équipe est automatiquement sauvegardée sur cet appareil
              </div>
            </div>
          )}
        </div>

        <div className="inventory-section" onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnInventory}>
          <div className="inventory-header">
            <h2>🎒 Mon Inventaire</h2>
            <button onClick={loadCards} className="btn-refresh" disabled={isLoading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.5 9a9 9 0 0114.1-3.4L23 10" />
                <path d="M20.5 15a9 9 0 01-14.1 3.4L1 14" />
              </svg>
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
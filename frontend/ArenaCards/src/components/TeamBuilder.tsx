import React, { useState, useEffect, useCallback } from 'react';
import type { ArenaCard, TeamSlot } from '../types/ArenaCard';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards, saveTeam as saveTeamOnChain, loadTeam as loadTeamFromChain, clearTeam as clearTeamOnChain } from '../utils/contractHelpers';
import CardSlot from './CardSlot';
import InventoryCard from './InventoryCard';
import './TeamBuilder.css';

const MAX_TEAM_SIZE = 5;
const LOCAL_STORAGE_KEY = 'arenaCards_team_';

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // État de synchronisation
  const [isSyncedWithBlockchain, setIsSyncedWithBlockchain] = useState(false);

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
  const loadTeamFromLocalStorage = useCallback(async () => {
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
   * Compare et synchronise localStorage avec blockchain
   */
  const checkSyncStatus = useCallback(async () => {
    if (!signer || !account) return;

    try {
      // Récupérer l'équipe de la blockchain
      const blockchainTeam = await loadTeamFromChain(signer);
      
      // Récupérer l'équipe locale
      const localTeam = await loadTeamFromLocalStorage();

      if (!localTeam || localTeam.length === 0) {
        setIsSyncedWithBlockchain(blockchainTeam.length === 0);
        return;
      }

      // Comparer les équipes
      const areSynced = 
        blockchainTeam.length === localTeam.length &&
        blockchainTeam.every((id, index) => id === localTeam[index]);

      setIsSyncedWithBlockchain(areSynced);
      
      if (!areSynced) {
        console.log('⚠️ Équipe locale non synchronisée avec la blockchain');
      } else {
        console.log('✅ Équipe synchronisée avec la blockchain');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la synchronisation:', error);
    }
  }, [signer, account, loadTeamFromLocalStorage]);

  /**
   * Efface l'équipe du localStorage
   */
  const clearTeamFromLocalStorage = useCallback(() => {
    if (!account) return;
    localStorage.removeItem(LOCAL_STORAGE_KEY + account);
    console.log('🗑️ Équipe locale effacée');
  }, [account]);

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

  // Charger l'équipe sauvegardée depuis la blockchain
  const loadSavedTeam = useCallback(async () => {
    if (!signer || !account) return;

    try {
      const savedCardIds = await loadTeamFromChain(signer);
      
      if (savedCardIds.length === 0) {
        console.log('Aucune équipe sauvegardée');
        return;
      }

      // Charger toutes les cartes de l'utilisateur
      const allCards = await loadUserCards(signer, account);
      
      // Créer les nouveaux slots avec les cartes sauvegardées
      const newTeamSlots: TeamSlot[] = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
        position: i,
        card: null,
      }));

      const cardsInTeam: ArenaCard[] = [];
      
      savedCardIds.forEach((tokenId, index) => {
        const card = allCards.find(c => c.tokenId === tokenId);
        if (card && index < MAX_TEAM_SIZE) {
          newTeamSlots[index] = {
            position: index,
            card: card
          };
          cardsInTeam.push(card);
        }
      });

      // Mettre à jour l'état
      setTeamSlots(newTeamSlots);
      
      // Retirer les cartes de l'équipe de l'inventaire
      setInventory(allCards.filter(card => 
        !cardsInTeam.some(teamCard => teamCard.tokenId === card.tokenId)
      ));

      console.log('✅ Équipe chargée avec succès');
    } catch (error) {
      console.error('Erreur lors du chargement de l\'équipe:', error);
    }
  }, [signer, account]);

  // Charger les cartes et l'équipe sauvegardée au montage
  useEffect(() => {
    const init = async () => {
      if (!signer || !account) {
        setIsInitialLoading(false);
        return;
      }
      
      try {
        setIsInitialLoading(true);
        
        // 1. Charger les cartes
        const allCards = await loadUserCards(signer, account);
        setInventory(allCards);
        
        // 2. Essayer de charger depuis localStorage d'abord (rapide)
        const localTeam = await loadTeamFromLocalStorage();
        
        // 3. Charger depuis la blockchain (plus lent, source de vérité)
        const blockchainTeam = await loadTeamFromChain(signer);
        
        // 4. Déterminer quelle version utiliser
        let teamToLoad: string[] = [];
        
        if (blockchainTeam.length > 0) {
          // La blockchain a une équipe, utiliser celle-ci
          teamToLoad = blockchainTeam;
          console.log('📦 Chargement de l\'équipe depuis la blockchain');
        } else if (localTeam && localTeam.length > 0) {
          // Seulement localStorage a une équipe
          teamToLoad = localTeam;
          console.log('💾 Chargement de l\'équipe depuis localStorage');
        }
        
        // 5. Appliquer l'équipe
        if (teamToLoad.length > 0) {
          const newTeamSlots: TeamSlot[] = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
            position: i,
            card: null,
          }));

          const cardsInTeam: ArenaCard[] = [];
          
          teamToLoad.forEach((tokenId, index) => {
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
          
          // Si on a chargé depuis localStorage, le sauvegarder aussi
          if (localTeam && localTeam.length > 0) {
            saveTeamToLocalStorage(newTeamSlots);
          }
        }
        
        // 6. Vérifier le statut de synchronisation
        await checkSyncStatus();
      } catch (error) {
        console.error('Erreur lors du chargement initial:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    init();
  }, [signer, account, loadTeamFromLocalStorage, checkSyncStatus, saveTeamToLocalStorage]);

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
    
    // Auto-sauvegarde locale
    saveTeamToLocalStorage(newTeamSlots);
    setIsSyncedWithBlockchain(false);
    
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
    
    // Auto-sauvegarde locale
    saveTeamToLocalStorage(newTeamSlots);
    setIsSyncedWithBlockchain(false);
    
    handleDragEnd();
  };

  const removeCardFromSlot = (slotIndex: number) => {
    const newTeamSlots = [...teamSlots];
    const card = newTeamSlots[slotIndex].card;

    if (card) {
      newTeamSlots[slotIndex].card = null;
      setTeamSlots(newTeamSlots);
      setInventory(prev => [...prev, card]);
      
      // Auto-sauvegarde locale
      saveTeamToLocalStorage(newTeamSlots);
      setIsSyncedWithBlockchain(false);
    }
  };

  // Sauvegarder l'équipe on-chain
  const saveTeam = async () => {
    if (!signer) return;

    setIsSaving(true);
    try {
      const teamCardIds = teamSlots
          .filter(slot => slot.card !== null)
          .map(slot => slot.card!.tokenId);

      console.log('Sauvegarde de l\'équipe:', teamCardIds);

      // Appeler le contrat Team.sol
      const success = await saveTeamOnChain(signer, teamCardIds);

      if (success) {
        // Synchroniser le localStorage avec la blockchain
        saveTeamToLocalStorage(teamSlots);
        setIsSyncedWithBlockchain(true);
        
        alert('✅ Équipe sauvegardée sur la blockchain !');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde de l\'équipe');
    } finally {
      setIsSaving(false);
    }
  };

  const resetTeam = async () => {
    if (!signer) return;

    setIsResetting(true);
    try {
      console.log('Réinitialisation de l\'équipe sur la blockchain...');

      // Appeler le contrat Team.sol pour effacer l'équipe
      const success = await clearTeamOnChain(signer);

      if (success) {
        // Remettre toutes les cartes dans l'inventaire
        const cardsToReturn = teamSlots
            .filter(slot => slot.card !== null)
            .map(slot => slot.card!);

        setInventory(prev => [...prev, ...cardsToReturn]);

        // Réinitialiser les slots
        const emptySlots = Array.from({ length: MAX_TEAM_SIZE }, (_, i) => ({
          position: i,
          card: null,
        }));
        setTeamSlots(emptySlots);

        // Effacer le localStorage et synchroniser
        clearTeamFromLocalStorage();
        setIsSyncedWithBlockchain(true);

        alert('✅ Équipe réinitialisée sur la blockchain !');
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      alert('❌ Erreur lors de la réinitialisation de l\'équipe');
    } finally {
      setIsResetting(false);
    }
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
            <h1>⚔️ Composition d'Équipe</h1>
          </div>
          <div className="initial-loading-container">
            <div className="loading-state">
              <div className="spinner"></div>
              <h2>⏳ Chargement en cours...</h2>
              <p>📦 Récupération de tes cartes depuis la blockchain</p>
              <p>🎯 Restauration de ton équipe sauvegardée</p>
            </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>🎯 Mon Équipe</h2>
            {/* Indicateur de synchronisation compact */}
            {getTeamCount() > 0 && (
              <div className={`sync-badge ${isSyncedWithBlockchain ? 'synced' : 'not-synced'}`}>
                <span className="sync-badge-icon">
                  {isSyncedWithBlockchain ? '✅' : '⚠️'}
                </span>
                <div className="sync-badge-tooltip">
                  {isSyncedWithBlockchain ? (
                    <>
                      <div className="tooltip-title">✅ Équipe synchronisée</div>
                      <div className="tooltip-text">
                        Ton équipe est enregistrée sur la blockchain et liée à ton compte. 
                        Tu peux la retrouver depuis n'importe quel appareil.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="tooltip-title">⚠️ Sauvegarde locale uniquement</div>
                      <div className="tooltip-text">
                        <strong>💾 Auto-sauvegarde locale :</strong> Tes modifications sont automatiquement 
                        sauvegardées sur cet appareil.
                      </div>
                      <div className="tooltip-text">
                        <strong>🔗 Sauvegarde blockchain :</strong> Pour enregistrer ton équipe sur la blockchain 
                        et la lier à ton compte, clique sur "Sauvegarder l'équipe" ci-dessous.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
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
                disabled={isResetting || getTeamCount() === 0}
            >
              {isResetting ? '🔄 Réinitialisation...' : '🔄 Réinitialiser'}
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

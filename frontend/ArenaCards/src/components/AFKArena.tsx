// components/AFKArena.tsx - VERSION CLEAN

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards } from '../utils/contractHelpers';
import type { ArenaCard, TeamSlot } from '../types/ArenaCard';
import type { Monster, GameProgress, BattleResult } from '../types/AFKArena';
import { generateMonster, simulateBattle, getTotalAttack, formatNumber } from '../utils/afkArenaLogic';
import './AFKArena.css';

const TEAM_STORAGE_KEY = 'arenaCards_team_';
const PROGRESS_STORAGE_KEY = 'afkArena_progress_';

const AFKArena: React.FC = () => {
  const { account, signer } = useWeb3();

  // Cartes
  const [cards, setCards] = useState<ArenaCard[]>([]);
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>(
    Array.from({ length: 5 }, (_, i) => ({
      position: i,
      card: null,
    }))
  );
  const [inventory, setInventory] = useState<ArenaCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);

  // Drag and Drop states
  const [draggedCard, setDraggedCard] = useState<ArenaCard | null>(null);
  const [dragSource, setDragSource] = useState<'inventory' | 'team' | null>(null);
  const [draggedFromSlot, setDraggedFromSlot] = useState<number | null>(null);

  // Jeu
  const [progress, setProgress] = useState<GameProgress>(() => {
    const saved = localStorage.getItem(PROGRESS_STORAGE_KEY + account);
    if (saved) return JSON.parse(saved);
    return {
      wave: 1,
      totalPoints: 0,
      highestWave: 1,
      totalKills: 0,
      isRunning: false,
    };
  });

  const [currentMonster, setCurrentMonster] = useState<Monster>(() => generateMonster(1));
  const [lastResult, setLastResult] = useState<BattleResult | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Charger les cartes ET l'équipe depuis TeamBuilder
  useEffect(() => {
    const loadCardsAndTeam = async () => {
      if (!signer || !account) return;
      setIsLoadingCards(true);
      try {
        const userCards = await loadUserCards(signer, account);
        setCards(userCards);

        const teamData = localStorage.getItem(TEAM_STORAGE_KEY + account);
        if (teamData) {
          const parsed = JSON.parse(teamData);
          const teamCardIds = parsed.cardIds || [];

          const newTeamSlots: TeamSlot[] = Array.from({ length: 5 }, (_, i) => ({
            position: i,
            card: null,
          }));

          const cardsInTeam: ArenaCard[] = [];
          
          teamCardIds.forEach((tokenId: string, index: number) => {
            const card = userCards.find(c => c.tokenId === tokenId);
            if (card && index < 5) {
              newTeamSlots[index] = {
                position: index,
                card: card
              };
              cardsInTeam.push(card);
            }
          });

          setTeamSlots(newTeamSlots);
          setInventory(userCards.filter(card =>
            !cardsInTeam.some(teamCard => teamCard.tokenId === card.tokenId)
          ));
          
          console.log('✅ Équipe synchronisée:', cardsInTeam.length, 'cartes');
        } else {
          setInventory(userCards);
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setIsLoadingCards(false);
      }
    };
    loadCardsAndTeam();
  }, [signer, account]);

  // Sauvegarder progression
  useEffect(() => {
    if (account) {
      localStorage.setItem(PROGRESS_STORAGE_KEY + account, JSON.stringify(progress));
    }
  }, [progress, account]);

  // Synchronisation avec TeamBuilder
  useEffect(() => {
    if (!account || !signer) return;

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === TEAM_STORAGE_KEY + account && e.newValue) {
        console.log('🔄 Changement détecté depuis TeamBuilder !');

        try {
          const teamData = JSON.parse(e.newValue);
          const teamCardIds = teamData.cardIds || [];

          const userCards = await loadUserCards(signer, account);

          const newTeamSlots: TeamSlot[] = Array.from({ length: 5 }, (_, i) => ({
            position: i,
            card: null,
          }));

          const cardsInTeam: ArenaCard[] = [];
          
          teamCardIds.forEach((tokenId: string, index: number) => {
            const card = userCards.find(c => c.tokenId === tokenId);
            if (card && index < 5) {
              newTeamSlots[index] = {
                position: index,
                card: card
              };
              cardsInTeam.push(card);
            }
          });

          setTeamSlots(newTeamSlots);
          setInventory(userCards.filter(card =>
            !cardsInTeam.some(teamCard => teamCard.tokenId === card.tokenId)
          ));
          setCards(userCards);
        } catch (error) {
          console.error('Erreur sync:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [account, signer]);

  // Timer et combat automatique
  useEffect(() => {
    const selectedTeam = teamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
    if (!progress.isRunning || selectedTeam.length !== 5) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          performBattle();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.isRunning, teamSlots, currentMonster]);

  // Combat
  const performBattle = () => {
    const selectedTeam = teamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
    const result = simulateBattle(selectedTeam, currentMonster);

    setLastResult(result);

    const newWave = result.victory ? progress.wave + 1 : 1;

    setProgress(prev => ({
      ...prev,
      wave: newWave,
      totalPoints: prev.totalPoints + result.points,
      highestWave: result.victory ? Math.max(prev.highestWave, prev.wave) : prev.highestWave,
      totalKills: result.victory ? prev.totalKills + 1 : prev.totalKills,
    }));

    setCurrentMonster(generateMonster(newWave));

    setTimeout(() => setLastResult(null), 2000);
  };

  // Drag and Drop handlers
  const handleDragStart = (card: ArenaCard, source: 'inventory' | 'team', slotIndex?: number) => {
    if (progress.isRunning) {
      alert('Arrête le jeu pour changer ton équipe !');
      return;
    }
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
    if (!draggedCard || progress.isRunning) return;

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
    const selectedTeam = newTeamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
    saveTeamToLocalStorage(selectedTeam);
    
    handleDragEnd();
  };

  const handleDropOnInventory = () => {
    if (!draggedCard || dragSource !== 'team' || draggedFromSlot === null || progress.isRunning) {
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
    const selectedTeam = newTeamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
    saveTeamToLocalStorage(selectedTeam);
    
    handleDragEnd();
  };

  const removeCardFromSlot = (slotIndex: number) => {
    if (progress.isRunning) {
      alert('Arrête le jeu pour changer ton équipe !');
      return;
    }

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
    const selectedTeam = newTeamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
    saveTeamToLocalStorage(selectedTeam);
  };

  // Sauvegarder l'équipe (reçoit un array d'ArenaCard)
  const saveTeamToLocalStorage = (team: ArenaCard[]) => {
    if (!account) return;

    const teamData = {
      cardIds: team.map(c => c.tokenId),
      timestamp: Date.now(),
    };

    localStorage.setItem(TEAM_STORAGE_KEY + account, JSON.stringify(teamData));
    console.log('💾 Équipe sauvegardée:', teamData.cardIds);

    window.dispatchEvent(new StorageEvent('storage', {
      key: TEAM_STORAGE_KEY + account,
      newValue: JSON.stringify(teamData),
      url: window.location.href
    }));
  };

  // Start/Stop
  const toggleGame = () => {
    const selectedTeam = teamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
    if (selectedTeam.length < 5) {
      alert(`Sélectionne 5 cartes ! (${selectedTeam.length}/5)`);
      return;
    }

    setProgress(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
    }));

    if (!progress.isRunning) {
      setCountdown(5);
    }
  };

  // Reset
  const reset = () => {
    if (!confirm('Réinitialiser ? (Tu gardes tes points)')) return;

    setProgress(prev => ({
      ...prev,
      wave: 1,
      isRunning: false,
    }));
    setCurrentMonster(generateMonster(1));
    setCountdown(5);
  };

  if (!account) {
    return (
        <div className="afk-arena">
          <div className="message-box">
            <h2>🎮 AFK Arena</h2>
            <p>Connecte ton wallet pour jouer !</p>
          </div>
        </div>
    );
  }

  if (isLoadingCards) {
    return (
        <div className="afk-arena">
          <div className="message-box">
            <div className="spinner"></div>
            <p>Chargement...</p>
          </div>
        </div>
    );
  }

  const selectedTeam = teamSlots.filter(slot => slot.card !== null).map(slot => slot.card!);
  const teamAttack = getTotalAttack(selectedTeam);
  const teamCount = selectedTeam.length;

  return (
      <div className="afk-arena">
        {/* GAME OVERLAY - Popup quand le jeu tourne */}
        {progress.isRunning && (
            <div className="game-overlay">
              <div className="game-overlay-backdrop" onClick={toggleGame}></div>
              <div className="game-overlay-panel">
                <div className="overlay-header">
                  <h2>🎮 Combat en cours</h2>
                  <button className="overlay-close" onClick={toggleGame}>✕</button>
                </div>

                <div className="overlay-body">
                  {/* Stats */}
                  <div className="overlay-stats">
                    <div className="overlay-stat">
                      <span className="stat-icon">💰</span>
                      <span className="stat-value">{formatNumber(progress.totalPoints)}</span>
                      <span className="stat-label">Points</span>
                    </div>
                    <div className="overlay-stat">
                      <span className="stat-icon">🌊</span>
                      <span className="stat-value">{progress.wave}</span>
                      <span className="stat-label">Vague</span>
                    </div>
                    <div className="overlay-stat">
                      <span className="stat-icon">🏆</span>
                      <span className="stat-value">{progress.highestWave}</span>
                      <span className="stat-label">Record</span>
                    </div>
                    <div className="overlay-stat">
                      <span className="stat-icon">💀</span>
                      <span className="stat-value">{progress.totalKills}</span>
                      <span className="stat-label">Kills</span>
                    </div>
                  </div>

                  {/* Result */}
                  {lastResult && (
                      <div className={`overlay-result ${lastResult.victory ? 'win' : 'lose'}`}>
                        <div className="result-title">
                          {lastResult.victory ? '✅ VICTOIRE !' : '💀 DÉFAITE !'}
                        </div>
                        <div className="result-points">+{formatNumber(lastResult.points)} pts</div>
                      </div>
                  )}

                  {/* Monster */}
                  <div className="overlay-section">
                    <h3>👹 Vague {progress.wave}</h3>
                    <div className="monster-display">
                      <div className="monster-icon">👹</div>
                      <div className="monster-info">
                        <div className="monster-name">{currentMonster.name}</div>
                        <div className="monster-level">Niveau {currentMonster.level}</div>
                        <div className="monster-stats">
                          <span>❤️ {formatNumber(currentMonster.health)}</span>
                          <span>⚔️ {currentMonster.attack}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team */}
                  <div className="overlay-section">
                    <h3>👥 Équipe (💪 {teamAttack} ATK)</h3>
                    <div className="team-display">
                      {selectedTeam.map(card => (
                          <div key={card.tokenId} className="team-card-mini">
                            <div className="card-mini-img">
                              {card.imageURI ? (
                                  <img src={card.imageURI} alt={card.name} />
                              ) : (
                                  <span>🃏</span>
                              )}
                            </div>
                            <div className="card-mini-name">{card.name}</div>
                            <div className="card-mini-atk">⚔️ {card.attack}</div>
                          </div>
                      ))}
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="overlay-timer">
                    <div className="timer-label">⏱️ Prochain combat</div>
                    <div className="timer-countdown">{countdown}s</div>
                  </div>

                  {/* Stop button */}
                  <button className="overlay-stop-btn" onClick={toggleGame}>
                    ⏸️ ARRÊTER
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Header */}
        <div className="afk-header">
          <h1>🎮 AFK Arena</h1>
          <p>Combat automatique toutes les 5 secondes</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-icon">💰</div>
            <div className="stat-value">{formatNumber(progress.totalPoints)}</div>
            <div className="stat-label">Points</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">🌊</div>
            <div className="stat-value">{progress.wave}</div>
            <div className="stat-label">Vague</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{progress.highestWave}</div>
            <div className="stat-label">Record</div>
          </div>
          <div className="stat-box">
            <div className="stat-icon">💀</div>
            <div className="stat-value">{progress.totalKills}</div>
            <div className="stat-label">Kills</div>
          </div>
        </div>

        {/* Result */}
        {lastResult && (
            <div className={`battle-result ${lastResult.victory ? 'win' : 'lose'}`}>
              <div className="result-text">
                {lastResult.victory ? '✅ VICTOIRE !' : '💀 DÉFAITE !'}
              </div>
              <div className="result-points">+{formatNumber(lastResult.points)} points</div>
            </div>
        )}

        {/* Monster */}
        <div className="monster-section">
          <h2>👹 Vague {progress.wave}</h2>
          <div className="monster-card">
            <div className="monster-image">
              <div className="monster-emoji">👹</div>
            </div>
            <div className="monster-name">{currentMonster.name}</div>
            <div className="monster-level">Niveau {currentMonster.level}</div>
            <div className="monster-stats">
              <div className="monster-stat">
                <span>❤️</span>
                <span>{formatNumber(currentMonster.health)}</span>
              </div>
              <div className="monster-stat">
                <span>⚔️</span>
                <span>{currentMonster.attack}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="team-section">
          <div className="team-header">
            <h2>👥 Ton Équipe ({teamCount}/5)</h2>
            <div className="team-power">💪 {teamAttack} ATK Total</div>
          </div>

          <div className="team-grid">
            {teamSlots.map((slot, index) => (
              <div 
                key={slot.position} 
                className="team-slot"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnSlot(index)}
              >
                {slot.card ? (
                  <div 
                    className="team-card"
                    draggable={!progress.isRunning}
                    onDragStart={(e) => {
                      if (!progress.isRunning && slot.card) {
                        handleDragStart(slot.card, 'team', index);
                      } else {
                        e.preventDefault();
                      }
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <button
                      className="remove-btn"
                      onClick={() => removeCardFromSlot(index)}
                      disabled={progress.isRunning}
                    >
                      ✕
                    </button>
                    <div className="card-img">
                      {slot.card.imageURI ? (
                        <img src={slot.card.imageURI} alt={slot.card.name} />
                      ) : (
                        <div className="placeholder">🃏</div>
                      )}
                    </div>
                    <div className="card-name">{slot.card.name}</div>
                    <div className="card-attack">⚔️ {slot.card.attack}</div>
                  </div>
                ) : (
                  <div className="empty-slot">Slot {index + 1}</div>
                )}
              </div>
            ))}
          </div>

          <div className="controls">
            <button
                className={`btn-start ${progress.isRunning ? 'active' : ''}`}
                onClick={toggleGame}
                disabled={teamCount < 5}
            >
              {progress.isRunning ? (
                  <>⏸️ ARRÊTER</>
              ) : teamCount === 0 ? (
                  <>📋 Glisse 5 cartes</>
              ) : teamCount < 5 ? (
                  <>📋 {teamCount}/5 cartes</>
              ) : (
                  <>▶️ DÉMARRER</>
              )}
            </button>

            {progress.isRunning && (
                <div className="timer">
                  ⏱️ Prochain combat dans <strong>{countdown}s</strong>
                </div>
            )}

            <button
                className="btn-reset"
                onClick={reset}
                disabled={progress.isRunning}
            >
              🔄 Reset
            </button>
          </div>
        </div>

        {/* Inventaire */}
        <div className="inventory-section" onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnInventory}>
          <h2>🎴 Inventaire ({inventory.length} cartes)</h2>
          <p style={{ fontSize: '0.9rem', color: '#95a5a6', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            ✨ Glisse-dépose les cartes pour composer ton équipe
          </p>
          {inventory.length === 0 ? (
              <div className="empty-message">
                <p>Aucune carte disponible !</p>
                <p>Toutes tes cartes sont dans l'équipe ou ouvre des boosters.</p>
              </div>
          ) : (
              <div className="inventory-grid">
                {inventory.map(card => (
                  <div
                    key={card.tokenId}
                    className="inv-card"
                    draggable={!progress.isRunning}
                    onDragStart={(e) => {
                      if (!progress.isRunning) {
                        handleDragStart(card, 'inventory');
                      } else {
                        e.preventDefault();
                      }
                    }}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: progress.isRunning ? 'not-allowed' : 'grab' }}
                  >
                    <div className="inv-img">
                      {card.imageURI ? (
                        <img src={card.imageURI} alt={card.name} />
                      ) : (
                        <div className="placeholder">🃏</div>
                      )}
                    </div>
                    <div className="inv-name">{card.name}</div>
                    <div className="inv-attack">⚔️ {card.attack}</div>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
  );
};

export default AFKArena;

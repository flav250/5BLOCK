// components/AFKArena.tsx

import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards } from '../utils/contractHelpers';
import type { ArenaCard } from '../types/ArenaCard';
import type { Monster, GameProgress, BattleResult } from '../types/AFKArena';
import { generateMonster, simulateBattle, getTotalAttack, formatNumber } from '../utils/afkArenaLogic';
import './AFKArena.css';

const TEAM_STORAGE_KEY = 'arenaCards_team_';
const PROGRESS_STORAGE_KEY = 'afkArena_progress_';

const AFKArena: React.FC = () => {
  const { account, signer } = useWeb3();

  // Cartes
  const [cards, setCards] = useState<ArenaCard[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<ArenaCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);

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
        // 1. Charger toutes les cartes
        const userCards = await loadUserCards(signer, account);
        setCards(userCards);

        // 2. Charger l'équipe depuis le MÊME localStorage que TeamBuilder
        const teamData = localStorage.getItem(TEAM_STORAGE_KEY + account);
        if (teamData) {
          const parsed = JSON.parse(teamData);
          const teamCardIds = parsed.cardIds || [];

          // 3. Reconstituer l'équipe avec les cartes chargées
          const team = userCards
              .filter(card => teamCardIds.includes(card.tokenId))
              .slice(0, 5); // Max 5 cartes pour AFK Arena

          setSelectedTeam(team);
          console.log('✅ Équipe synchronisée depuis TeamBuilder:', team.length, 'cartes');
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setIsLoadingCards(false);
      }
    };
    loadCardsAndTeam();
  }, [signer, account]);

  // Sauvegarder progression (séparé de l'équipe)
  useEffect(() => {
    if (account) {
      localStorage.setItem(PROGRESS_STORAGE_KEY + account, JSON.stringify(progress));
    }
  }, [progress, account]);

  // 🔄 SYNCHRONISATION EN TEMPS RÉEL avec TeamBuilder
  useEffect(() => {
    if (!account || !signer) return;

    const handleStorageChange = async (e: StorageEvent) => {
      // Écouter les changements du localStorage de TeamBuilder
      if (e.key === TEAM_STORAGE_KEY + account && e.newValue) {
        console.log('🔄 Changement détecté dans TeamBuilder !');

        try {
          const teamData = JSON.parse(e.newValue);
          const teamCardIds = teamData.cardIds || [];

          // Recharger les cartes pour être sûr d'avoir les bonnes
          const userCards = await loadUserCards(signer, account);

          // Reconstituer l'équipe
          const newTeam = userCards
              .filter(card => teamCardIds.includes(card.tokenId))
              .slice(0, 5);

          setSelectedTeam(newTeam);
          setCards(userCards);
          console.log('✅ Équipe mise à jour automatiquement:', newTeam.length, 'cartes');
        } catch (error) {
          console.error('Erreur sync:', error);
        }
      }
    };

    // Écouter les changements de localStorage
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [account, signer]);

  // Timer et combat automatique
  useEffect(() => {
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
  }, [progress.isRunning, selectedTeam, currentMonster]);

  // Combat
  const performBattle = () => {
    const result = simulateBattle(selectedTeam, currentMonster);

    setLastResult(result);

    // Calculer la nouvelle vague AVANT de mettre à jour l'état
    const newWave = result.victory ? progress.wave + 1 : 1;

    setProgress(prev => ({
      ...prev,
      wave: newWave,
      totalPoints: prev.totalPoints + result.points,
      highestWave: result.victory ? Math.max(prev.highestWave, prev.wave) : prev.highestWave,
      totalKills: result.victory ? prev.totalKills + 1 : prev.totalKills,
    }));

    // Utiliser newWave au lieu de progress.wave
    setCurrentMonster(generateMonster(newWave));

    setTimeout(() => setLastResult(null), 2000);
  };

  // Sélection/Désélection de carte
  const toggleCard = (card: ArenaCard) => {
    if (progress.isRunning) {
      alert('Arrête le jeu pour changer ton équipe !');
      return;
    }

    const isSelected = selectedTeam.find(c => c.tokenId === card.tokenId);

    if (isSelected) {
      // Retirer la carte
      const newTeam = selectedTeam.filter(c => c.tokenId !== card.tokenId);
      setSelectedTeam(newTeam);
      saveTeamToLocalStorage(newTeam);
    } else if (selectedTeam.length < 5) {
      // Ajouter la carte
      const newTeam = [...selectedTeam, card];
      setSelectedTeam(newTeam);
      saveTeamToLocalStorage(newTeam);
    } else {
      alert('Tu as déjà 5 cartes !');
    }
  };

  // Sauvegarder l'équipe dans localStorage (même clé que TeamBuilder)
  const saveTeamToLocalStorage = (team: ArenaCard[]) => {
    if (!account) return;

    const teamData = {
      cardIds: team.map(c => c.tokenId),
      timestamp: Date.now(),
    };

    localStorage.setItem(TEAM_STORAGE_KEY + account, JSON.stringify(teamData));
    console.log('💾 Équipe sauvegardée:', teamData.cardIds);

    // Déclencher un événement storage pour notifier TeamBuilder
    window.dispatchEvent(new StorageEvent('storage', {
      key: TEAM_STORAGE_KEY + account,
      newValue: JSON.stringify(teamData),
      url: window.location.href
    }));
  };

  // Start/Stop
  const toggleGame = () => {
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

  const teamAttack = getTotalAttack(selectedTeam);

  return (
      <div className="afk-arena">
        {/* Header */}
        {/* Header + Info */}
        <div className="afk-top">
          <div className="afk-header">
            <h1>🎮 AFK Arena</h1>
            <p>Combat automatique toutes les 5 secondes</p>
          </div>

          <div className="howto-card">
            <div className="howto-title">📘 Comment ça marche ?</div>

            <ul className="howto-list">
              <li><strong>1)</strong> Connecte ton wallet.</li>
              <li><strong>2)</strong> Ton équipe est synchronisée depuis <em>Mon Équipe</em>.</li>
              <li><strong>3)</strong> Sélectionne <strong>5 cartes</strong> (sinon tu ne peux pas démarrer).</li>
              <li><strong>4)</strong> Clique <strong>▶️ DÉMARRER</strong> : un combat se lance toutes les <strong>5s</strong>.</li>
              <li><strong>5)</strong> En cas de victoire : <strong>vague +1</strong> et tu gagnes des <strong>points</strong>.</li>
              <li><strong>6)</strong> En cas de défaite : retour à la <strong>vague 1</strong> (tu gardes tes points).</li>
            </ul>

            <div className="howto-tip">
              💡 Astuce : augmente l’ATK total de ton équipe pour battre plus de vagues.
            </div>
          </div>
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
            <h2>👥 Ton Équipe</h2>
            <div className="team-power">
              💪 {teamAttack} ATK Total
            </div>
          </div>

          <div className="team-grid">
            {[0, 1, 2, 3, 4].map(index => {
              const card = selectedTeam[index];
              return (
                  <div key={index} className="team-slot">
                    {card ? (
                        <div className="team-card">
                          <button
                              className="remove-btn"
                              onClick={() => toggleCard(card)}
                              disabled={progress.isRunning}
                          >
                            ✕
                          </button>
                          <div className="card-img">
                            {card.imageURI ? (
                                <img src={card.imageURI} alt={card.name} />
                            ) : (
                                <div className="placeholder">🃏</div>
                            )}
                          </div>
                          <div className="card-name">{card.name}</div>
                          <div className="card-attack">⚔️ {card.attack}</div>
                        </div>
                    ) : (
                        <div className="empty-slot">Slot {index + 1}</div>
                    )}
                  </div>
              );
            })}
          </div>

          <div className="controls">
            <button
                className={`btn-start ${progress.isRunning ? 'active' : ''}`}
                onClick={toggleGame}
                disabled={selectedTeam.length < 5}
            >
              {progress.isRunning ? (
                  <>⏸️ ARRÊTER</>
              ) : selectedTeam.length === 0 ? (
                  <>📋 Sélectionne 5 cartes</>
              ) : selectedTeam.length < 5 ? (
                  <>📋 {selectedTeam.length}/5 cartes</>
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
        <div className="inventory-section">
          <h2>🎴 Inventaire ({cards.length} cartes)</h2>
          {cards.length === 0 ? (
              <div className="empty-message">
                <p>Aucune carte !</p>
                <p>Ouvre des boosters pour en obtenir.</p>
              </div>
          ) : (
              <div className="inventory-grid">
                {cards.map(card => {
                  const isSelected = selectedTeam.find(c => c.tokenId === card.tokenId);
                  return (
                      <div
                          key={card.tokenId}
                          className={`inv-card ${isSelected ? 'selected' : ''} ${progress.isRunning ? 'disabled' : ''}`}
                          onClick={() => !progress.isRunning && toggleCard(card)}
                          style={{ cursor: progress.isRunning ? 'not-allowed' : 'pointer' }}
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
                        {isSelected && <div className="selected-badge">✓</div>}
                      </div>
                  );
                })}
              </div>
          )}
        </div>
      </div>
  );
};

export default AFKArena;
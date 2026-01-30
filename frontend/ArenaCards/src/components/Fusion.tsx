import React, { useState, useEffect, useCallback } from 'react';
import type { ArenaCard } from '../types/ArenaCard';
import { useWeb3 } from '../hooks/useWeb3';
import { loadUserCards } from '../utils/contractHelpers';
import { fuseCards, getFusionCooldown } from '../utils/FusionHelpers';
import './Fusion.css';

interface FusionSlot {
    position: 1 | 2;
    card: ArenaCard | null;
}

const FUSION_RULES = {
    'commune': 'rare',
    'rare': 'epique',
    'epique': 'legendaire',
};

const RARITY_COLORS = {
    'commune': '#808080',
    'rare': '#1E90FF',
    'epique': '#800080',
    'legendaire': '#FF4500',
};

const Fusion: React.FC = () => {
    const { account, signer } = useWeb3();

    // Slots de fusion (2 cartes)
    const [fusionSlots, setFusionSlots] = useState<FusionSlot[]>([
        { position: 1, card: null },
        { position: 2, card: null },
    ]);

    // Inventaire des cartes
    const [inventory, setInventory] = useState<ArenaCard[]>([]);
    const [filteredInventory, setFilteredInventory] = useState<ArenaCard[]>([]);

    // Filtre de rareté
    const [selectedRarity, setSelectedRarity] = useState<string>('all');

    // États de fusion
    const [isFusing, setIsFusing] = useState(false);
    const [fusionResult, setFusionResult] = useState<ArenaCard | null>(null);
    const [showResult, setShowResult] = useState(false);

    // Cooldown
    const [cooldownTime, setCooldownTime] = useState(0);

    // Drag & Drop
    const [draggedCard, setDraggedCard] = useState<ArenaCard | null>(null);

    // Loading
    const [isLoading, setIsLoading] = useState(false);

    // Charger les cartes
    const loadCards = useCallback(async () => {
        if (!signer || !account) return;

        setIsLoading(true);
        try {
            const cards = await loadUserCards(signer, account);
            setInventory(cards);
            setFilteredInventory(cards);
        } catch (error) {
            console.error('Erreur lors du chargement des cartes:', error);
        } finally {
            setIsLoading(false);
        }
    }, [signer, account]);

    // Charger le cooldown
    const loadCooldown = useCallback(async () => {
        if (!signer || !account) return;

        try {
            const timeLeft = await getFusionCooldown(signer, account);
            setCooldownTime(timeLeft);
        } catch (error) {
            console.error('Erreur lors du chargement du cooldown:', error);
        }
    }, [signer, account]);

    useEffect(() => {
        loadCards();
        loadCooldown();
    }, [loadCards, loadCooldown]);

    // Filtrer l'inventaire par rareté
    useEffect(() => {
        if (selectedRarity === 'all') {
            setFilteredInventory(inventory);
        } else {
            setFilteredInventory(inventory.filter(card => card.rarity === selectedRarity));
        }
    }, [selectedRarity, inventory]);

    // Countdown du cooldown
    useEffect(() => {
        if (cooldownTime <= 0) return;

        const interval = setInterval(() => {
            setCooldownTime(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [cooldownTime]);

    // Vérifier si on peut fusionner
    const canFuse = (): { canFuse: boolean; reason: string } => {
        if (cooldownTime > 0) {
            return { canFuse: false, reason: `Cooldown: ${formatTime(cooldownTime)}` };
        }

        const card1 = fusionSlots[0].card;
        const card2 = fusionSlots[1].card;

        if (!card1 || !card2) {
            return { canFuse: false, reason: 'Sélectionne 2 cartes' };
        }

        if (card1.rarity !== card2.rarity) {
            return { canFuse: false, reason: 'Les cartes doivent avoir la même rareté' };
        }

        if (card1.name !== card2.name) {
            return { canFuse: false, reason: 'Les cartes doivent avoir le même nom' };
        }

        if (card1.rarity === 'legendaire') {
            return { canFuse: false, reason: 'Les cartes légendaires ne peuvent pas être fusionnées' };
        }

        if (card1.isLocked || card2.isLocked) {
            return { canFuse: false, reason: 'Une carte est verrouillée' };
        }

        return { canFuse: true, reason: '' };
    };

    const handleFusion = async () => {
        if (!signer || !fusionSlots[0].card || !fusionSlots[1].card) return;

        const { canFuse: canDoFusion, reason } = canFuse();
        if (!canDoFusion) {
            alert(reason);
            return;
        }

        setIsFusing(true);
        try {
            console.log('🔥 Fusion en cours...', {
                card1: fusionSlots[0].card.tokenId,
                card2: fusionSlots[1].card.tokenId,
            });

            const newTokenId = await fuseCards(
                signer,
                Number(fusionSlots[0].card.tokenId),
                Number(fusionSlots[1].card.tokenId)
            );
            console.log('✅ Fusion réussie ! Nouvelle carte:', newTokenId);

            // Recharger les cartes pour obtenir la nouvelle
            await loadCards();

            // Afficher le résultat
            const newCards = await loadUserCards(signer, account!);
            const newCard = newCards.find(
                c => c.tokenId === newTokenId.toString()
            );

            if (newCard) {
                setFusionResult(newCard);
                setShowResult(true);
            }

            // Réinitialiser les slots
            setFusionSlots([
                { position: 1, card: null },
                { position: 2, card: null },
            ]);

            // Recharger le cooldown
            await loadCooldown();

        } catch (error: any) {
            console.error('❌ Erreur lors de la fusion:', error);
            alert(`Erreur: ${error.message || 'Fusion impossible'}`);
        } finally {
            setIsFusing(false);
        }
    };

    // Drag & Drop handlers
    const handleDragStart = (card: ArenaCard) => {
        setDraggedCard(card);
    };

    const handleDragEnd = () => {
        setDraggedCard(null);
    };

    const handleDropOnSlot = (slotIndex: number) => {
        if (!draggedCard) return;

        const newSlots = [...fusionSlots];

        // Si le slot est déjà occupé, échanger
        if (newSlots[slotIndex].card) {
            const oldCard = newSlots[slotIndex].card;
            if (oldCard) {
                setInventory(prev => [...prev, oldCard]);
            }
        }

        newSlots[slotIndex].card = draggedCard;
        setFusionSlots(newSlots);

        // Retirer de l'inventaire
        setInventory(prev => prev.filter(c => c.tokenId !== draggedCard.tokenId));
        setDraggedCard(null);
    };

    const handleRemoveFromSlot = (slotIndex: number) => {
        const newSlots = [...fusionSlots];
        const card = newSlots[slotIndex].card;

        if (card) {
            newSlots[slotIndex].card = null;
            setFusionSlots(newSlots);
            setInventory(prev => [...prev, card]);
        }
    };

    // Utilitaires
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getResultRarity = (): string | null => {
        if (!fusionSlots[0].card) return null;
        return FUSION_RULES[fusionSlots[0].card.rarity as keyof typeof FUSION_RULES] || null;
    };

    if (!account) {
        return (
            <div className="fusion-container">
                <div className="connect-prompt">
                    <h2>🦊 Connecte ton wallet</h2>
                    <p>Pour fusionner tes cartes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fusion-container">
            {/* Header */}
            <div className="fusion-header">
                <h1>Fusion de Cartes</h1>
                <p className="fusion-subtitle">
                    Combine 2 cartes identiques pour faire évoluer leur rareté et leur niveau !
                </p>
            </div>

            {/* Règles de fusion */}
            <div className="fusion-rules">

                <h3 className="fusion-rules-title">
                    📜 Règles de Fusion
                </h3>

                {/* règle principale */}
                <div className="fusion-rule-main">
                    <span>🧬 2 cartes <strong>identiques</strong></span>
                    <span className="arrow">→</span>
                    <span>🔥 1 carte évoluée</span>
                </div>

                {/* progression */}
                <div className="fusion-progression">
                    <span style={{ color: RARITY_COLORS.commune }}>Commune</span>
                    <span className="arrow">→</span>
                    <span style={{ color: RARITY_COLORS.rare }}>Rare</span>
                    <span className="arrow">→</span>
                    <span style={{ color: RARITY_COLORS.epique }}>Épique</span>
                    <span className="arrow">→</span>
                    <span style={{ color: RARITY_COLORS.legendaire }}>Légendaire</span>
                </div>

                {/* règles secondaires */}
                <div className="fusion-rules-bottom">

                    <div className="fusion-rule warning">
                        ❌ Les cartes <strong>légendaires</strong> ne peuvent pas être fusionnées
                    </div>

                    <div className="fusion-rule bonus">
                        ⭐ Le niveau augmente après chaque fusion
                    </div>

                </div>

            </div>

            {/* Zone de fusion */}
            <div className="fusion-zone">
                <h2>Zone de Fusion</h2>

                <div className="fusion-slots-container">
                    {/* Slot 1 */}
                    <div
                        className={`fusion-slot ${draggedCard ? 'drag-over' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropOnSlot(0)}
                    >
                        {fusionSlots[0].card ? (
                            <div className="fusion-card">
                                <img
                                    src={fusionSlots[0].card.imageURI}
                                    alt={fusionSlots[0].card.name}
                                />
                                <div className="fusion-card-info">
                                    <h4>{fusionSlots[0].card.name}</h4>
                                    <span
                                        className="fusion-card-rarity"
                                        style={{ color: RARITY_COLORS[fusionSlots[0].card.rarity as keyof typeof RARITY_COLORS] }}
                                    >
                    {fusionSlots[0].card.rarity}
                  </span>
                                    <span className="fusion-card-level">Niv. {fusionSlots[0].card.level}</span>
                                </div>
                                <button
                                    className="remove-btn"
                                    onClick={() => handleRemoveFromSlot(0)}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="empty-slot">
                                <span className="slot-number">1</span>
                                <p>Glisse une carte ici</p>
                            </div>
                        )}
                    </div>

                    {/* Icône de fusion */}
                    <div className="fusion-icon">
                        <div className="fusion-plus">+</div>
                        {getResultRarity() && (
                            <div className="fusion-arrow-down">
                                <span>↓</span>
                                <span
                                    className="result-rarity-hint"
                                    style={{ color: RARITY_COLORS[getResultRarity() as keyof typeof RARITY_COLORS] }}
                                >
                  {getResultRarity()}
                </span>
                            </div>
                        )}
                    </div>

                    {/* Slot 2 */}
                    <div
                        className={`fusion-slot ${draggedCard ? 'drag-over' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropOnSlot(1)}
                    >
                        {fusionSlots[1].card ? (
                            <div className="fusion-card">
                                <img
                                    src={fusionSlots[1].card.imageURI}
                                    alt={fusionSlots[1].card.name}
                                />
                                <div className="fusion-card-info">
                                    <h4>{fusionSlots[1].card.name}</h4>
                                    <span
                                        className="fusion-card-rarity"
                                        style={{ color: RARITY_COLORS[fusionSlots[1].card.rarity as keyof typeof RARITY_COLORS] }}
                                    >
                    {fusionSlots[1].card.rarity}
                  </span>
                                    <span className="fusion-card-level">Niv. {fusionSlots[1].card.level}</span>
                                </div>
                                <button
                                    className="remove-btn"
                                    onClick={() => handleRemoveFromSlot(1)}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="empty-slot">
                                <span className="slot-number">2</span>
                                <p>Glisse une carte ici</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bouton de fusion */}
                <div className="fusion-action">
                    {cooldownTime > 0 ? (
                        <button className="btn-fusion" disabled>
                            ⏱️ Cooldown: {formatTime(cooldownTime)}
                        </button>
                    ) : (
                        <button
                            className="btn-fusion"
                            onClick={handleFusion}
                            disabled={!canFuse().canFuse || isFusing}
                        >
                            {isFusing ? '🔥 Fusion en cours...' : '🔥 FUSIONNER !'}
                        </button>
                    )}
                    {!canFuse().canFuse && cooldownTime === 0 && (
                        <p className="fusion-error">{canFuse().reason}</p>
                    )}
                </div>
            </div>

            {/* Inventaire */}
            <div className="fusion-inventory">
                <div className="inventory-header">
                    <h2>🎒 Mon Inventaire</h2>
                    <div className="rarity-filters">
                        <button
                            className={selectedRarity === 'all' ? 'active' : ''}
                            onClick={() => setSelectedRarity('all')}
                        >
                            Toutes
                        </button>
                        <button
                            className={selectedRarity === 'commune' ? 'active' : ''}
                            onClick={() => setSelectedRarity('commune')}
                            style={{ borderColor: RARITY_COLORS.commune }}
                        >
                            Communes
                        </button>
                        <button
                            className={selectedRarity === 'rare' ? 'active' : ''}
                            onClick={() => setSelectedRarity('rare')}
                            style={{ borderColor: RARITY_COLORS.rare }}
                        >
                            Rares
                        </button>
                        <button
                            className={selectedRarity === 'epique' ? 'active' : ''}
                            onClick={() => setSelectedRarity('epique')}
                            style={{ borderColor: RARITY_COLORS.epique }}
                        >
                            Épiques
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Chargement...</p>
                    </div>
                ) : filteredInventory.length === 0 ? (
                    <div className="empty-inventory">
                        <p>📭 Aucune carte {selectedRarity !== 'all' ? selectedRarity : ''}</p>
                    </div>
                ) : (
                    <div className="inventory-grid">
                        {filteredInventory.map((card) => (
                            <div
                                key={card.tokenId}
                                className={`inventory-card ${card.isLocked ? 'locked' : ''}`}
                                draggable={!card.isLocked}
                                onDragStart={() => handleDragStart(card)}
                                onDragEnd={handleDragEnd}
                            >
                                <img src={card.imageURI} alt={card.name} />
                                <div className="card-info">
                                    <h4>{card.name}</h4>
                                    <span
                                        className="card-rarity"
                                        style={{ color: RARITY_COLORS[card.rarity as keyof typeof RARITY_COLORS] }}
                                    >
                    {card.rarity}
                  </span>
                                    <span className="card-level">Niv. {card.level}</span>
                                    {card.isLocked && <span className="locked-badge">🔒</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de résultat */}
            {showResult && fusionResult && (
                <div className="fusion-result-modal" onClick={() => setShowResult(false)}>
                    <div className="result-content" onClick={(e) => e.stopPropagation()}>
                        <h2>🎉 Fusion Réussie !</h2>
                        <div className="result-card">
                            <img src={fusionResult.imageURI} alt={fusionResult.name} />
                            <h3>{fusionResult.name}</h3>
                            <span
                                className="result-rarity"
                                style={{ color: RARITY_COLORS[fusionResult.rarity as keyof typeof RARITY_COLORS] }}
                            >
                {fusionResult.rarity}
              </span>
                            <span className="result-level">Niveau {fusionResult.level}</span>
                        </div>
                        <button className="btn-close" onClick={() => setShowResult(false)}>
                            Continuer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Fusion;
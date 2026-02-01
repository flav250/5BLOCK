import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './Shop.css';
import { useWeb3 } from '../hooks/useWeb3';
import type { ShopCard } from '../utils/shopHelpers';
import {
  loadShopCards,
  buyCard,
  getCooldownRemaining,
  formatCooldown,
  loadArenaPoints,
  deductArenaPoints,
  hasEnoughPoints,
  formatPoints,
  getRemainingStock,
  isSoldOut,
  canPurchaseCard,
  getShopContract
} from '../utils/shopHelpers';

const Shop: React.FC = () => {
  const { account, signer } = useWeb3();
  const [shopContract, setShopContract] = useState<ethers.Contract | null>(null);
  const [cards, setCards] = useState<ShopCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [arenaPoints, setArenaPoints] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [purchaseEligibility, setPurchaseEligibility] = useState<Record<number, boolean>>({});

  // Initialiser le contrat Shop
  useEffect(() => {
    if (signer) {
      const contract = getShopContract(signer);
      setShopContract(contract);
    }
  }, [signer]);

  // Charger les cartes et infos utilisateur
  useEffect(() => {
    if (shopContract && account) {
      loadData();
      
      // Écouter les événements storage pour update les points
      const handleStorageChange = () => {
        const points = loadArenaPoints(account);
        setArenaPoints(points);
      };
      
      window.addEventListener('storage', handleStorageChange);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [shopContract, account]);

  // Timer pour le cooldown
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            loadData(); // Recharger quand le cooldown se termine
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  const loadData = async () => {
    if (!shopContract || !account) return;
    
    try {
      setLoading(true);
      
      // Charger les cartes
      const shopCards = await loadShopCards(shopContract);
      setCards(shopCards);
      
      // Charger les points
      const points = loadArenaPoints(account);
      setArenaPoints(points);
      
      // Charger le cooldown
      const cooldown = await getCooldownRemaining(shopContract, account);
      setCooldownRemaining(cooldown);
      
      // Vérifier l'éligibilité pour chaque carte
      const eligibility: Record<number, boolean> = {};
      for (const card of shopCards) {
        const canPurchase = await canPurchaseCard(shopContract, account, card.id);
        eligibility[card.id] = canPurchase;
      }
      setPurchaseEligibility(eligibility);
      
    } catch (error) {
      console.error('Error loading shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCard = async (card: ShopCard) => {
    if (!shopContract || !account || !signer) return;
    
    // Vérifier les points (frontend)
    if (!hasEnoughPoints(account, card.price)) {
      alert(`Vous n'avez pas assez de points ! Nécessaire: ${formatPoints(card.price)}`);
      return;
    }
    
    const success = await buyCard(shopContract, card.id, card.name, card.price);
    
    if (success) {
      // Déduire les points
      deductArenaPoints(account, card.price);
      
      // Recharger les données
      await loadData();
    }
  };

  const legendaryCards = cards.filter(c => c.rarity === 'legendaire');
  const secretCards = cards.filter(c => c.rarity === 'secrete');

  if (!account) {
    return (
      <div className="shop-container">
        <div className="shop-connect-message">
          <h2>🔒 Connexion Requise</h2>
          <p>Connectez votre wallet pour accéder à la boutique exclusive</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="shop-container">
        <div className="shop-loading">
          <div className="shop-loading-spinner"></div>
          <p className="shop-loading-text">Chargement de la boutique...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-container">
      {/* Header */}
      <div className="shop-header">
        <h1>🏪 Boutique Exclusive</h1>
        <p>Échangez vos points d'arène contre des cartes légendaires et secrètes</p>
        
        <div className="shop-points-display">
          <span className="shop-points-icon">⚡</span>
          <span className="shop-points-amount">{formatPoints(arenaPoints)}</span>
          <span className="shop-points-label">Points</span>
        </div>
        
        {cooldownRemaining > 0 && (
          <div className="shop-cooldown-status active">
            <span className="shop-cooldown-text">
              ⏰ Prochain achat dans {formatCooldown(cooldownRemaining)}
            </span>
          </div>
        )}
        
        {cooldownRemaining === 0 && (
          <div className="shop-cooldown-status ready">
            <span className="shop-cooldown-text ready">✓ Prêt à acheter</span>
          </div>
        )}
      </div>

      {/* Cartes Légendaires */}
      {legendaryCards.length > 0 && (
        <div className="shop-section">
          <div className="shop-section-header legendary">
            <span className="shop-section-icon">⭐</span>
            <div className="shop-section-title">
              <h2>Cartes Légendaires</h2>
              <p>Cartes d'exception à 1,000,000 points - Stock illimité</p>
            </div>
          </div>
          
          <div className="shop-cards-grid">
            {legendaryCards.map(card => {
              const canAfford = account ? hasEnoughPoints(account, card.price) : false;
              const canBuy = purchaseEligibility[card.id] && canAfford && cooldownRemaining === 0;
              const alreadyPurchased = !purchaseEligibility[card.id] && cooldownRemaining === 0;
              
              return (
                <div key={card.id} className={`shop-card legendary ${!canBuy ? 'disabled' : ''}`}>
                  {/* Rarity Badge */}
                  <div className="rarity-badge">Légendaire</div>
                  
                  {/* Owned Badge */}
                  {alreadyPurchased && (
                    <div className="shop-card-badge owned">✓ Possédée</div>
                  )}
                  
                  {/* Card Image */}
                  <div className="card-image-wrapper">
                    <div className="card-image">
                      {card.imageURI ? (
                        <img src={card.imageURI} alt={card.name} />
                      ) : (
                        <div className="placeholder-image">
                          <span className="shop-card-placeholder">🃏</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Card Details */}
                  <div className="card-details">
                    <h3 className="card-name">{card.name}</h3>
                    
                    {/* Price Display */}
                    <div className="shop-card-price">
                      <span className="shop-card-price-icon">⚡</span>
                      <span className="shop-card-price-amount">{formatPoints(card.price)}</span>
                    </div>
                    
                    {/* Buy Button */}
                    <button
                      className={`shop-buy-button legendary`}
                      onClick={() => handleBuyCard(card)}
                      disabled={!canBuy}
                    >
                      {alreadyPurchased ? '✓ Déjà achetée' :
                       cooldownRemaining > 0 ? '⏰ Cooldown actif' :
                       !canAfford ? '💎 Pas assez de points' :
                       '🛒 Acheter'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cartes Secrètes */}
      {secretCards.length > 0 && (
        <div className="shop-section">
          <div className="shop-section-header secret">
            <span className="shop-section-icon">🌟</span>
            <div className="shop-section-title">
              <h2>Cartes Secrètes</h2>
              <p>Édition ultra limitée à 5,000,000 points - Seulement 50 exemplaires</p>
            </div>
          </div>
          
          <div className="shop-cards-grid">
            {secretCards.map(card => {
              const remainingStock = getRemainingStock(card);
              const soldOut = isSoldOut(card);
              const canAfford = account ? hasEnoughPoints(account, card.price) : false;
              const canBuy = purchaseEligibility[card.id] && canAfford && !soldOut && cooldownRemaining === 0;
              const alreadyPurchased = !purchaseEligibility[card.id] && cooldownRemaining === 0;
              const lowStock = remainingStock !== null && remainingStock <= 10;
              
              return (
                <div key={card.id} className={`shop-card secret ${!canBuy || soldOut ? 'disabled' : ''}`}>
                  {/* Rarity Badge */}
                  <div className="rarity-badge">Secrète</div>
                  
                  {/* Status Badges */}
                  {soldOut && (
                    <div className="shop-card-badge sold-out">ÉPUISÉ</div>
                  )}
                  {!soldOut && alreadyPurchased && (
                    <div className="shop-card-badge owned">✓ Possédée</div>
                  )}
                  
                  {/* Card Image */}
                  <div className="card-image-wrapper">
                    <div className="card-image">
                      {card.imageURI ? (
                        <img src={card.imageURI} alt={card.name} />
                      ) : (
                        <div className="placeholder-image">
                          <span className="shop-card-placeholder">🃏</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Card Details */}
                  <div className="card-details">
                    <h3 className="card-name">{card.name}</h3>
                    
                    {/* Stock Info */}
                    {!soldOut && remainingStock !== null && (
                      <div className={`shop-card-stock ${lowStock ? 'low' : 'limited'}`}>
                        <span className="shop-card-stock-icon">📦</span>
                        <span>{remainingStock} / {card.maxSupply} restantes</span>
                      </div>
                    )}
                    
                    {/* Price Display */}
                    <div className="shop-card-price">
                      <span className="shop-card-price-icon">⚡</span>
                      <span className="shop-card-price-amount">{formatPoints(card.price)}</span>
                    </div>
                    
                    {/* Buy Button */}
                    <button
                      className={`shop-buy-button secret`}
                      onClick={() => handleBuyCard(card)}
                      disabled={!canBuy || soldOut}
                    >
                      {soldOut ? '❌ Épuisée' :
                       alreadyPurchased ? '✓ Déjà achetée' :
                       cooldownRemaining > 0 ? '⏰ Cooldown actif' :
                       !canAfford ? '💎 Pas assez de points' :
                       '🛒 Acheter'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {cards.length === 0 && (
        <div className="shop-empty">
          <div className="shop-empty-icon">🏪</div>
          <p className="shop-empty-text">Aucune carte disponible pour le moment</p>
        </div>
      )}

      {/* Shop Rules */}
      <div className="shop-info">
        <h3>📋 Règles de la Boutique</h3>
        <ul>
          <li>✅ Une carte par type maximum par utilisateur</li>
          <li>⏰ Cooldown de 24 heures entre chaque achat</li>
          <li>⭐ <strong>Cartes Légendaires</strong>: 1,000,000 points - Stock illimité</li>
          <li>🌟 <strong>Cartes Secrètes</strong>: 5,000,000 points - Édition limitée à 50 exemplaires</li>
          <li>💎 Gagnez des points en jouant à l'AFK Arena</li>
          <li>🎯 Les cartes achetées sont ajoutées automatiquement à votre inventaire</li>
        </ul>
      </div>
    </div>
  );
};

export default Shop;

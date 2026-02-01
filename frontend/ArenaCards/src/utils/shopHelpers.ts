import { ethers } from 'ethers';
import type { Signer } from 'ethers';
import { notifySuccess, notifyError, notifyInfo } from './notificationService';
import ShopABI from '../abis/Shop.json';

const SHOP_ADDRESS = import.meta.env.VITE_SHOP_ADDRESS || '';

/**
 * Obtenir le contrat Shop
 */
export function getShopContract(signer: Signer): ethers.Contract {
  return new ethers.Contract(SHOP_ADDRESS, ShopABI.abi, signer);
}

export interface ShopCard {
  id: number;
  name: string;
  rarity: string;
  imageURI: string;
  price: number;
  isSecret: boolean;
  available: boolean;
  maxSupply: number;
  minted: number;
}

/**
 * Charger toutes les cartes du catalogue
 */
export async function loadShopCards(
  shopContract: ethers.Contract
): Promise<ShopCard[]> {
  try {
    const count = await shopContract.getCardCount();
    const cards: ShopCard[] = [];

    for (let i = 0; i < Number(count); i++) {
      const cardData = await shopContract.getCard(i);
      cards.push({
        id: i,
        name: cardData[0],
        rarity: cardData[1],
        imageURI: cardData[2],
        price: Number(cardData[3]),
        isSecret: cardData[4],
        available: cardData[5],
        maxSupply: Number(cardData[6]),
        minted: Number(cardData[7])
      });
    }

    return cards;
  } catch (error) {
    console.error('Error loading shop cards:', error);
    throw error;
  }
}

/**
 * Vérifier si un utilisateur peut acheter une carte
 */
export async function canPurchaseCard(
  shopContract: ethers.Contract,
  userAddress: string,
  cardId: number
): Promise<boolean> {
  try {
    return await shopContract.canPurchase(userAddress, cardId);
  } catch (error) {
    console.error('Error checking purchase eligibility:', error);
    return false;
  }
}

/**
 * Obtenir le temps restant avant le prochain achat (en secondes)
 */
export async function getCooldownRemaining(
  shopContract: ethers.Contract,
  userAddress: string
): Promise<number> {
  try {
    const remaining = await shopContract.getCooldownRemaining(userAddress);
    return Number(remaining);
  } catch (error) {
    console.error('Error getting cooldown:', error);
    return 0;
  }
}

/**
 * Formater le temps de cooldown en format lisible
 */
export function formatCooldown(seconds: number): string {
  if (seconds === 0) return 'Disponible';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Acheter une carte
 */
export async function buyCard(
  shopContract: ethers.Contract,
  cardId: number,
  cardName: string,
  price: number
): Promise<boolean> {
  try {
    notifyInfo('Transaction en cours...');
    
    const tx = await shopContract.buyCard(cardId);
    
    notifyInfo('Attente de confirmation...');
    await tx.wait();
    
    notifySuccess(`${cardName} acheté avec succès !`);
    return true;
  } catch (error: any) {
    console.error('Error buying card:', error);
    notifyError(error);
    return false;
  }
}

/**
 * Charger les points d'arène depuis localStorage
 */
export function loadArenaPoints(userAddress: string): number {
  try {
    const saved = localStorage.getItem(`afkArena_progress_${userAddress}`);
    if (saved) {
      const data = JSON.parse(saved);
      return data.totalPoints || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error loading arena points:', error);
    return 0;
  }
}

/**
 * Déduire les points après un achat
 */
export function deductArenaPoints(userAddress: string, amount: number): void {
  try {
    const saved = localStorage.getItem(`afkArena_progress_${userAddress}`);
    if (saved) {
      const data = JSON.parse(saved);
      data.totalPoints = Math.max(0, (data.totalPoints || 0) - amount);
      localStorage.setItem(`afkArena_progress_${userAddress}`, JSON.stringify(data));
      
      // Déclencher un événement storage pour mettre à jour l'UI
      window.dispatchEvent(new Event('storage'));
    }
  } catch (error) {
    console.error('Error deducting arena points:', error);
  }
}

/**
 * Vérifier si l'utilisateur a assez de points (vérification frontend)
 */
export function hasEnoughPoints(userAddress: string, price: number): boolean {
  const currentPoints = loadArenaPoints(userAddress);
  return currentPoints >= price;
}

/**
 * Formater les points avec séparateurs
 */
export function formatPoints(points: number): string {
  return points.toLocaleString('fr-FR');
}

/**
 * Vérifier si une carte a été achetée par l'utilisateur
 */
export async function hasUserPurchasedCard(
  shopContract: ethers.Contract,
  userAddress: string,
  cardId: number
): Promise<boolean> {
  try {
    return await shopContract.hasPurchased(userAddress, cardId);
  } catch (error) {
    console.error('Error checking if card purchased:', error);
    return false;
  }
}

/**
 * Obtenir le stock restant d'une carte
 */
export function getRemainingStock(card: ShopCard): number | null {
  if (card.maxSupply === 0) return null; // Illimité
  return card.maxSupply - card.minted;
}

/**
 * Vérifier si une carte est épuisée
 */
export function isSoldOut(card: ShopCard): boolean {
  if (card.maxSupply === 0) return false; // Illimité
  return card.minted >= card.maxSupply;
}

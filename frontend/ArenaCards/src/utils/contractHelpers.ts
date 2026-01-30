// utils/contractHelpers.ts - VERSION FINALE ✅

import { ethers } from 'ethers';
import type { Signer, Contract } from 'ethers';
import type { ArenaCard } from '../types/ArenaCard';
import ArenaCardsABI from '../abis/ArenaCards.json';


const ARENA_CARDS_ADDRESS = import.meta.env.VITE_ARENA_CARDS_ADDRESS as string;

if (!ARENA_CARDS_ADDRESS) {
  throw new Error("❌ VITE_BOOSTER_ADDRESS non défini dans .env");
}

/**
 * Parse le tokenURI (format base64 JSON) et extrait l'URL de l'image
 */
const parseTokenURI = (tokenURI: string): string => {
  try {
    // Vérifier si c'est un data URI en base64
    if (tokenURI.startsWith('data:application/json;base64,')) {
      // Extraire la partie base64
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      
      // Décoder le base64
      const jsonString = atob(base64Data);
      
      // Parser le JSON
      const metadata = JSON.parse(jsonString);
      
      // Retourner l'URL de l'image
      return metadata.image || '';
    }
    
    // Si ce n'est pas un data URI, retourner tel quel (ancien format)
    return tokenURI;
  } catch (error) {
    console.error('Erreur lors du parsing du tokenURI:', error);
    return '';
  }
};

export const getArenaCardsContract = (signerOrProvider: Signer): Contract => {
  return new ethers.Contract(
      ARENA_CARDS_ADDRESS,
      ArenaCardsABI.abi,
      signerOrProvider
  );
};

/**
 * Charge toutes les cartes d'un utilisateur
 */
export const loadUserCards = async (
    signer: Signer,
    userAddress: string
): Promise<ArenaCard[]> => {
  try {
    const contract = getArenaCardsContract(signer);

    // Récupérer le balance de l'utilisateur
    const balance = await contract.balanceOf(userAddress);
    const balanceNum = Number(balance);

    if (balanceNum === 0) {
      return [];
    }

    // Récupérer tous les tokenIds
    const tokenCounter = await contract.tokenCounter();
    const cards: ArenaCard[] = [];

    for (let i = 0; i < Number(tokenCounter); i++) {
      try {
        const owner = await contract.ownerOf(i);

        if (owner.toLowerCase() === userAddress.toLowerCase()) {
          // Cette carte appartient à l'utilisateur
          const cardData = await contract.cardDetails(i);
          const tokenURI = await contract.tokenURI(i);
          const lockUntil = await contract.lockUntil(i);

          const now = Math.floor(Date.now() / 1000);
          const isLocked = Number(lockUntil) > now;

          cards.push({
            tokenId: i.toString(),
            name: cardData.name,
            rarity: cardData.rarity,
            level: Number(cardData.level),
            imageURI: parseTokenURI(tokenURI),
            createdAt: Number(cardData.createdAt),
            lastTransferAt: Number(cardData.lastTransferAt),
            isLocked: isLocked,
            unlockTime: Number(lockUntil),
          });
        }
      } catch (error) {
        // Token brûlé ou n'existe pas, continuer
        continue;
      }
    }

    return cards;
  } catch (error) {
    console.error('Erreur lors du chargement des cartes:', error);
    throw error;
  }
};

/**
 * Récupère les détails d'une carte spécifique
 */
export const getCardDetails = async (
    signer: Signer,
    tokenId: string
): Promise<ArenaCard | null> => {
  try {
    const contract = getArenaCardsContract(signer);

    const cardData = await contract.cardDetails(tokenId);
    const tokenURI = await contract.tokenURI(tokenId);
    const lockUntil = await contract.lockUntil(tokenId);

    const now = Math.floor(Date.now() / 1000);
    const isLocked = Number(lockUntil) > now;

    return {
      tokenId: tokenId,
      name: cardData.name,
      rarity: cardData.rarity,
      level: Number(cardData.level),
      imageURI: tokenURI,
      createdAt: Number(cardData.createdAt),
      lastTransferAt: Number(cardData.lastTransferAt),
      isLocked: isLocked,
      unlockTime: Number(lockUntil),
    };
  } catch (error) {
    console.error('Erreur lors du chargement de la carte:', error);
    return null;
  }
};

/**
 * Mint une nouvelle carte (owner seulement)
 */
export const mintCard = async (
    signer: Signer,
    tokenURI: string,
    name: string,
    rarity: string
): Promise<boolean> => {
  try {
    const contract = getArenaCardsContract(signer);

    const tx = await contract.mintCard(tokenURI, name, rarity);
    await tx.wait();

    console.log('✅ Carte mintée avec succès!');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du mint:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Max cards reached')) {
      alert('Tu as déjà le maximum de cartes (4) !');
    } else if (errorMessage.includes('Action on cooldown')) {
      alert('Tu dois attendre 5 minutes entre chaque action !');
    } else {
      alert('Erreur: ' + errorMessage);
    }

    return false;
  }
};

/**
 * Fusionne deux cartes
 */
export const fuseCards = async (
    signer: Signer,
    tokenId1: string,
    tokenId2: string,
    newTokenURI: string
): Promise<boolean> => {
  try {
    const contract = getArenaCardsContract(signer);

    const tx = await contract.fusecards(tokenId1, tokenId2, newTokenURI);
    await tx.wait();

    console.log('✅ Cartes fusionnées avec succès!');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la fusion:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Not owner')) {
      alert('Tu ne possèdes pas ces cartes !');
    } else if (errorMessage.includes('Rarities must match')) {
      alert('Les raretés des cartes doivent correspondre !');
    } else if (errorMessage.includes('Action on cooldown')) {
      alert('Tu dois attendre 5 minutes entre chaque action !');
    } else if (errorMessage.includes('Card locked')) {
      alert('Une des cartes est encore verrouillée !');
    } else {
      alert('Erreur: ' + errorMessage);
    }

    return false;
  }
};

/**
 * Récupère l'historique des propriétaires
 */
export const getPreviousOwners = async (
    signer: Signer,
    tokenId: string
): Promise<string[]> => {
  try {
    const contract = getArenaCardsContract(signer);
    const owners = await contract.getPreviousOwners(tokenId);
    return owners;
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error);
    return [];
  }
};

/**
 * Vérifie si une carte est verrouillée
 */
export const isCardLocked = async (
    signer: Signer,
    tokenId: string
): Promise<boolean> => {
  try {
    const contract = getArenaCardsContract(signer);
    const lockUntil = await contract.lockUntil(tokenId);
    const now = Math.floor(Date.now() / 1000);
    return Number(lockUntil) > now;
  } catch (error) {
    console.error('Erreur lors de la vérification du lock:', error);
    return false;
  }
};

/**
 * Récupère le temps restant avant déverrouillage
 */
export const getTimeUntilUnlock = async (
    signer: Signer,
    tokenId: string
): Promise<number> => {
  try {
    const contract = getArenaCardsContract(signer);
    const lockUntil = await contract.lockUntil(tokenId);
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(lockUntil) - now;
    return Math.max(0, remaining);
  } catch (error) {
    console.error('Erreur lors du calcul du temps restant:', error);
    return 0;
  }
};

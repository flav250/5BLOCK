// utils/contractHelpers.ts - VERSION AVEC ATTACK STAT ✅

import { ethers } from 'ethers';
import type { Signer, Contract } from 'ethers';
import type { ArenaCard } from '../types/ArenaCard';
import ArenaCardsABI from '../abis/ArenaCards.json';


const ARENA_CARDS_ADDRESS = import.meta.env.VITE_ARENA_CARDS_ADDRESS as string;

if (!ARENA_CARDS_ADDRESS) {
  throw new Error("❌ VITE_ARENA_CARDS_ADDRESS non défini dans .env");
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
          const tokenURI = await contract.tokenURI(i);
          const lockUntil = await contract.lockUntil(i);

          // Récupérer les stats via getCardStats (retourne: name, rarity, level, attack)
          const stats = await contract.getCardStats(i);

          const now = Math.floor(Date.now() / 1000);
          const isLocked = Number(lockUntil) > now;

          cards.push({
            tokenId: i.toString(),
            name: stats.name || stats[0],           // stats.name ou stats[0]
            rarity: stats.rarity || stats[1],       // stats.rarity ou stats[1]
            level: Number(stats.level || stats[2]), // stats.level ou stats[2]
            attack: Number(stats.attack || stats[3]), // stats.attack ou stats[3] ← NOUVELLE STAT
            imageURI: parseTokenURI(tokenURI),
            createdAt: 0, // Non disponible via getCardStats
            lastTransferAt: 0, // Non disponible via getCardStats
            isLocked: isLocked,
            unlockTime: Number(lockUntil),
          });
        }
      } catch (error) {
        // Token brûlé ou n'existe pas, continuer
        console.warn(`Token ${i} skip:`, error);
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

    const stats = await contract.getCardStats(tokenId);
    const tokenURI = await contract.tokenURI(tokenId);
    const lockUntil = await contract.lockUntil(tokenId);

    const now = Math.floor(Date.now() / 1000);
    const isLocked = Number(lockUntil) > now;

    return {
      tokenId: tokenId,
      name: stats.name || stats[0],
      rarity: stats.rarity || stats[1],
      level: Number(stats.level || stats[2]),
      attack: Number(stats.attack || stats[3]), // ← NOUVELLE STAT
      imageURI: parseTokenURI(tokenURI),
      createdAt: 0,
      lastTransferAt: 0,
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
  name: string,
  rarity: string
): Promise<boolean> => {
  try {
    const contract = getArenaCardsContract(signer);

    const userAddress = await signer.getAddress();
    const tx = await contract.mintCard(userAddress, name, rarity);
    await tx.wait();

    console.log('✅ Carte mintée avec succès!');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du mint:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Max cards reached')) {
      alert('Tu as déjà le maximum de cartes !');
    } else if (errorMessage.includes('Action on cooldown')) {
      alert('Tu dois attendre 5 minutes entre chaque action !');
    } else {
      alert('Erreur: ' + errorMessage);
    }

    return false;
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

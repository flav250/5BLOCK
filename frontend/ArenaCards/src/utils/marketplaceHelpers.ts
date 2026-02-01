// utils/marketplaceHelpers.ts - VERSION SANS ANY

import { ethers } from 'ethers';
import type { Signer } from 'ethers';
import MarketplaceABI from '../abis/Marketplace.json';
import { getArenaCardsContract } from './contractHelpers';
import { notifyError} from './notificationService';

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS as string;

if (!MARKETPLACE_ADDRESS) {
  throw new Error("❌ VITE_BOOSTER_ADDRESS non défini dans .env");
}

export interface Trade {
  tradeId: string;
  creator: string;
  offeredTokenId: string;
  requestedCardName: string;
  requestedLevel: number;
  requestedRarity: string;
  isActive: boolean;
  createdAt: number;
}

export interface DirectTrade {
  tradeId: string;
  creator: string;
  target: string;
  offeredTokenId: string;
  requestedTokenId: string;
  isActive: boolean;
  createdAt: number;
}

interface ContractTrade {
  tradeId: bigint;
  creator: string;
  offeredTokenId: bigint;
  requestedCardName: string;
  requestedLevel: bigint;
  requestedRarity: string;
  isActive: boolean;
  createdAt: bigint;
}

interface ContractDirectTrade {
  tradeId: bigint;
  creator: string;
  target: string;
  offeredTokenId: bigint;
  requestedTokenId: bigint;
  isActive: boolean;
  createdAt: bigint;
}

export const getMarketplaceContract = (signer: Signer) => {
  return new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);
};

/**
 * Approuver le marketplace pour utiliser nos cartes
 */
export const approveMarketplace = async (signer: Signer): Promise<boolean> => {
  try {
    const arenaCards = getArenaCardsContract(signer);

    const address = await signer.getAddress();
    const isApproved = await arenaCards.isApprovedForAll(address, MARKETPLACE_ADDRESS);

    if (isApproved) {
      return true;
    }

    const tx = await arenaCards.setApprovalForAll(MARKETPLACE_ADDRESS, true);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur approbation:', error);
    return false;
  }
};

/**
 * Créer une offre d'échange
 */
export const createTrade = async (
    signer: Signer,
    offeredTokenId: string,
    requestedCardName: string,
    requestedLevel: number,
    requestedRarity: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const tx = await marketplace.createTrade(offeredTokenId, requestedCardName, requestedLevel, requestedRarity);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur création trade:', error);
    notifyError(error);
    return false;
  }
};

/**
 * Accepter un échange
 */
export const acceptTrade = async (
    signer: Signer,
    tradeId: string,
    offeredCardTokenId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const tx = await marketplace.acceptTrade(tradeId, offeredCardTokenId);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur acceptation:', error);
    notifyError(error);
    return false;
  }
};

/**
 * Annuler un trade
 */
export const cancelTrade = async (
    signer: Signer,
    tradeId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const tx = await marketplace.cancelTrade(tradeId);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur annulation:', error);
    notifyError(error);
    return false;
  }
};

/**
 * Convertir un trade du contrat en Trade formaté
 */
const formatTrade = (trade: ContractTrade): Trade => ({
  tradeId: trade.tradeId.toString(),
  creator: trade.creator,
  offeredTokenId: trade.offeredTokenId.toString(),
  requestedCardName: trade.requestedCardName,
  requestedLevel: Number(trade.requestedLevel),
  requestedRarity: trade.requestedRarity,
  isActive: trade.isActive,
  createdAt: Number(trade.createdAt),
});

/**
 * Récupérer tous les trades actifs
 */
export const getActiveTrades = async (signer: Signer): Promise<Trade[]> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const trades = await marketplace.getActiveTrades() as ContractTrade[];

    const formattedTrades: Trade[] = trades.map(formatTrade);

    return formattedTrades;
  } catch (error) {
    console.error('❌ Erreur chargement trades:', error);
    return [];
  }
};

/**
 * Récupérer les trades d'un utilisateur
 */
export const getUserTrades = async (
    signer: Signer,
    userAddress: string
): Promise<Trade[]> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const trades = await marketplace.getUserTrades(userAddress) as ContractTrade[];

    return trades.map(formatTrade);
  } catch (error) {
    console.error('❌ Erreur chargement user trades:', error);
    return [];
  }
};

/**
 * Vérifier si une carte est dans un trade actif
 */
export const isCardInTrade = async (
    signer: Signer,
    tokenId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);
    return await marketplace.isCardInTrade(tokenId) as boolean;
  } catch (error) {
    console.error('❌ Erreur vérification trade:', error);
    return false;
  }
};

/**
 * Convertir un DirectTrade du contrat en DirectTrade formaté
 */
const formatDirectTrade = (trade: ContractDirectTrade): DirectTrade => ({
  tradeId: trade.tradeId.toString(),
  creator: trade.creator,
  target: trade.target,
  offeredTokenId: trade.offeredTokenId.toString(),
  requestedTokenId: trade.requestedTokenId.toString(),
  isActive: trade.isActive,
  createdAt: Number(trade.createdAt),
});

/**
 * Créer une offre d'échange direct P2P
 */
export const createDirectTrade = async (
    signer: Signer,
    targetAddress: string,
    offeredTokenId: string,
    requestedTokenId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const tx = await marketplace.createDirectTrade(targetAddress, offeredTokenId, requestedTokenId);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur création trade direct:', error);
    notifyError(error);
    return false;
  }
};

/**
 * Accepter un échange direct P2P
 */
export const acceptDirectTrade = async (
    signer: Signer,
    tradeId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const tx = await marketplace.acceptDirectTrade(tradeId);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur acceptation trade direct:', error);
    notifyError(error);
    return false;
  }
};

/**
 * Annuler un trade direct P2P
 */
export const cancelDirectTrade = async (
    signer: Signer,
    tradeId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const tx = await marketplace.cancelDirectTrade(tradeId);
    await tx.wait();

    return true;
  } catch (error) {
    console.error('❌ Erreur annulation trade direct:', error);
    notifyError(error);
    return false;
  }
};

/**
 * Récupérer les trades directs reçus par l'utilisateur
 */
export const getReceivedDirectTrades = async (
    signer: Signer,
    userAddress: string
): Promise<DirectTrade[]> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const trades = await marketplace.getReceivedDirectTrades(userAddress) as ContractDirectTrade[];

    const formattedTrades: DirectTrade[] = trades.map(formatDirectTrade);

    return formattedTrades;
  } catch (error) {
    console.error('❌ Erreur chargement trades directs reçus:', error);
    return [];
  }
};

/**
 * Récupérer les trades directs envoyés par l'utilisateur
 */
export const getSentDirectTrades = async (
    signer: Signer,
    userAddress: string
): Promise<DirectTrade[]> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    const trades = await marketplace.getSentDirectTrades(userAddress) as ContractDirectTrade[];

    const formattedTrades: DirectTrade[] = trades.map(formatDirectTrade);

    return formattedTrades;
  } catch (error) {
    console.error('❌ Erreur chargement trades directs envoyés:', error);
    return [];
  }
};

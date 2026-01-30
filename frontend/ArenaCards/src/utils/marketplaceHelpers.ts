// utils/marketplaceHelpers.ts - VERSION SANS ANY

import { ethers } from 'ethers';
import type { Signer } from 'ethers';
import MarketplaceABI from '../abis/Marketplace.json';
import { getArenaCardsContract } from './contractHelpers';

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS as string;

if (!MARKETPLACE_ADDRESS) {
  throw new Error("❌ VITE_BOOSTER_ADDRESS non défini dans .env");
}

export interface Trade {
  tradeId: string;
  creator: string;
  offeredTokenId: string;
  requestedTokenId: string;
  isActive: boolean;
  createdAt: number;
}

// Type pour les trades retournés par le contrat
interface ContractTrade {
  tradeId: bigint;
  creator: string;
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
      console.log('✅ Marketplace déjà approuvé');
      return true;
    }

    console.log('🔐 Approbation du marketplace...');
    const tx = await arenaCards.setApprovalForAll(MARKETPLACE_ADDRESS, true);
    await tx.wait();

    console.log('✅ Marketplace approuvé !');
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
    requestedTokenId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    console.log('📝 Création du trade...');
    const tx = await marketplace.createTrade(offeredTokenId, requestedTokenId);
    await tx.wait();

    console.log('✅ Trade créé avec succès !');
    return true;
  } catch (error) {
    console.error('❌ Erreur création trade:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Not owner')) {
      alert('Tu ne possèdes pas cette carte !');
    } else if (errorMessage.includes('already in active trade')) {
      alert('Cette carte est déjà dans un échange actif !');
    } else if (errorMessage.includes('not approved')) {
      alert('Tu dois d\'abord approuver le marketplace !');
    } else {
      alert('Erreur: ' + errorMessage);
    }

    return false;
  }
};

/**
 * Accepter un échange
 */
export const acceptTrade = async (
    signer: Signer,
    tradeId: string
): Promise<boolean> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    console.log('🤝 Acceptation du trade #' + tradeId);
    const tx = await marketplace.acceptTrade(tradeId);
    await tx.wait();

    console.log('✅ Trade accepté ! Échange effectué !');
    return true;
  } catch (error) {
    console.error('❌ Erreur acceptation:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Not owner of requested card')) {
      alert('Tu ne possèdes pas la carte demandée !');
    } else if (errorMessage.includes('not approved')) {
      alert('Tu dois d\'abord approuver le marketplace !');
    } else if (errorMessage.includes('not active')) {
      alert('Ce trade n\'est plus actif !');
    } else {
      alert('Erreur: ' + errorMessage);
    }

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

    console.log('❌ Annulation du trade #' + tradeId);
    const tx = await marketplace.cancelTrade(tradeId);
    await tx.wait();

    console.log('✅ Trade annulé !');
    return true;
  } catch (error) {
    console.error('❌ Erreur annulation:', error);
    alert('Erreur: ' + (error instanceof Error ? error.message : String(error)));
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
  requestedTokenId: trade.requestedTokenId.toString(),
  isActive: trade.isActive,
  createdAt: Number(trade.createdAt),
});

/**
 * Récupérer tous les trades actifs
 */
export const getActiveTrades = async (signer: Signer): Promise<Trade[]> => {
  try {
    const marketplace = getMarketplaceContract(signer);

    console.log('🔍 Chargement des trades actifs...');
    const trades = await marketplace.getActiveTrades() as ContractTrade[];

    const formattedTrades: Trade[] = trades.map(formatTrade);

    console.log('✅ Trades chargés:', formattedTrades.length);
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
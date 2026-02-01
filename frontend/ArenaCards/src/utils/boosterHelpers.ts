// utils/boosterHelpers.ts
import { ethers } from "ethers";
import type { Signer } from "ethers";

import FreeBoosterABI from "../abis/FreeBooster.json";
import PremiumBoosterABI from "../abis/PremiumBooster.json";
import ArenaCardsABI from "../abis/ArenaCards.json";
import { notifyError, notifySuccess } from "./notificationService";

const FREE_BOOSTER_ADDRESS = import.meta.env.VITE_FREE_BOOSTER_ADDRESS as string;
const PREMIUM_BOOSTER_ADDRESS = import.meta.env.VITE_PREMIUM_BOOSTER_ADDRESS as string;
const ARENA_CARDS_ADDRESS = import.meta.env.VITE_ARENA_CARDS_ADDRESS as string;

if (!FREE_BOOSTER_ADDRESS) throw new Error("❌ VITE_FREE_BOOSTER_ADDRESS manquant dans .env");
if (!PREMIUM_BOOSTER_ADDRESS) throw new Error("❌ VITE_PREMIUM_BOOSTER_ADDRESS manquant dans .env");
if (!ARENA_CARDS_ADDRESS) throw new Error("❌ VITE_ARENA_CARDS_ADDRESS manquant dans .env");

export const getFreeBoosterContract = (signer: Signer) =>
    new ethers.Contract(FREE_BOOSTER_ADDRESS, FreeBoosterABI.abi, signer);

export const getPremiumBoosterContract = (signer: Signer) =>
    new ethers.Contract(PREMIUM_BOOSTER_ADDRESS, PremiumBoosterABI.abi, signer);

export const getArenaCardsContract = (signer: Signer) =>
    new ethers.Contract(ARENA_CARDS_ADDRESS, ArenaCardsABI.abi, signer);

/** Récupère l'imageURI d'une carte depuis le contrat */
const getCardImageURI = async (signer: Signer, rarity: string, name: string): Promise<string> => {
  try {
    const arenaContract = getArenaCardsContract(signer);
    const imageURI = await arenaContract.getImageURI(rarity, name);
    return imageURI;
  } catch (error) {
    console.error(`Erreur récupération imageURI pour ${name} (${rarity}):`, error);
    return '';
  }
};

/** Ouvrir un booster GRATUIT (cooldown) */
export const openFreeBooster = async (signer: Signer) => {
  try {
    const contract = getFreeBoosterContract(signer);

    const tx = await contract.openBooster({ gasLimit: 1_500_000 });
    const receipt = await tx.wait();

    const cards: Array<{ name: string; rarity: string; imageURI: string }> = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === "CardMinted") {
          const imageURI = await getCardImageURI(signer, parsed.args.rarity, parsed.args.name);
          cards.push({ 
            name: parsed.args.name, 
            rarity: parsed.args.rarity,
            imageURI
          });
        }
      } catch {}
    }

    return { success: true, cards };
  } catch (error) {
    console.error('❌ Erreur ouverture booster gratuit:', error);
    notifyError(error);
    return { success: false, cards: [] };
  }
};

/** Ouvrir un booster PREMIUM (payant) */
export const openPremiumBooster = async (signer: Signer) => {
  try {
    const contract = getPremiumBoosterContract(signer);

    const price = await contract.getBoosterPrice();
    const tx = await contract.openBooster({
      value: price,
      gasLimit: 1_500_000,
    });
    const receipt = await tx.wait();

    const cards: Array<{ name: string; rarity: string; imageURI: string }> = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === "CardMinted") {
          const imageURI = await getCardImageURI(signer, parsed.args.rarity, parsed.args.name);
          cards.push({ 
            name: parsed.args.name, 
            rarity: parsed.args.rarity,
            imageURI
          });
        }
      } catch {}
    }

    return { success: true, cards };
  } catch (error) {
    console.error('❌ Erreur ouverture booster premium:', error);
    notifyError(error);
    return { success: false, cards: [] };
  }
};

/** Cooldown FREE : temps restant */
export const getTimeUntilNextFreeBooster = async (signer: Signer, user: string): Promise<number> => {
  try {
    const contract = getFreeBoosterContract(signer);
    const t = await contract.getTimeUntilNextBooster(user);
    return Number(t);
  } catch (e) {
    console.error("getTimeUntilNextFreeBooster:", e);
    return 0;
  }
};

/** FREE : est-ce que je peux ouvrir ? */
export const canOpenFreeBooster = async (signer: Signer, user: string): Promise<boolean> => {
  try {
    const contract = getFreeBoosterContract(signer);
    return await contract.canOpenBooster(user);
  } catch (e) {
    console.error("canOpenFreeBooster:", e);
    return false;
  }
};

/** Prix du premium (en ETH string) */
export const getPremiumBoosterPrice = async (signer: Signer): Promise<string> => {
  try {
    const contract = getPremiumBoosterContract(signer);
    const price: bigint = await contract.getBoosterPrice();
    return ethers.formatEther(price);
  } catch (e) {
    console.error("getPremiumBoosterPrice:", e);
    return "0";
  }
};

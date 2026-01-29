// utils/boosterHelpers.ts

import { ethers } from 'ethers';
import type { Signer } from 'ethers';
import BoosterABI from '../abis/Booster.json';

const BOOSTER_ADDRESS = import.meta.env.VITE_BOOSTER_ADDRESS as string;

if (!BOOSTER_ADDRESS) {
  throw new Error("❌ VITE_BOOSTER_ADDRESS non défini dans .env");
}


export const getBoosterContract = (signer: Signer) => {
  return new ethers.Contract(BOOSTER_ADDRESS, BoosterABI.abi, signer);
};

export const openBooster = async (signer: Signer) => {
  try {
    const contract = getBoosterContract(signer);
    const tx = await contract.openBooster({ gasLimit: 1_500_500});
    const receipt = await tx.wait();

    // Extraire les cartes des events
    const cards: Array<{ name: string; rarity: string }> = [];
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog(log);
        if (parsedLog && parsedLog.name === 'CardMinted') {
          cards.push({
            name: parsedLog.args.name,
            rarity: parsedLog.args.rarity
          });
        }
      } catch (e) {
        // Skip logs that aren't from our contract
      }
    }

    return { success: true, cards };
  } catch (error) {
    console.error('Erreur ouverture booster:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('Booster cooldown active')) {
      alert('Attends 10 minutes avant d\'ouvrir le prochain booster !');
    } else if (errorMessage.includes('Not enough space')) {
      alert('Tu as déjà 4 cartes ! Fusionne-les ou transfère-les.');
    } else {
      alert('Erreur: ' + errorMessage);
    }
    
    return { success: false, cards: [] };
  }
};

export const getTimeUntilNextBooster = async (signer: Signer, address: string): Promise<number> => {
  try {
    const contract = getBoosterContract(signer);
    const time = await contract.getTimeUntilNextBooster(address);
    return Number(time);
  } catch (error) {
    console.error('Erreur temps restant:', error);
    return 0;
  }
};

export const canOpenBooster = async (signer: Signer, address: string): Promise<boolean> => {
  try {
    const contract = getBoosterContract(signer);
    return await contract.canOpenBooster(address);
  } catch (error) {
    console.error('Erreur vérification:', error);
    return false;
  }
};

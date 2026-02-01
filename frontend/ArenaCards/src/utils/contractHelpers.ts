// utils/contractHelpers.ts - VERSION AVEC ATTACK STAT ✅

import { ethers } from 'ethers';
import type { Signer, Contract } from 'ethers';
import type { ArenaCard } from '../types/ArenaCard';
import ArenaCardsABI from '../abis/ArenaCards.json';
import { notifyError } from './notificationService';


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
    notifyError(error);
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

/**
 * Interface pour une carte unique (nom + niveau)
 */
export interface UniqueCard {
  name: string;
  level: number;
  rarity: string;
  imageURI: string;
}

/**
 * Interface pour une carte statique du jeu (définition complète)
 */
export interface GameCard {
  name: string;
  rarity: string;
  imageURI: string;
}

/**
 * Liste statique de toutes les cartes du jeu
 * Cette liste définit toutes les cartes possibles, indépendamment de celles qui ont été mintées
 */
export const ALL_GAME_CARDS: GameCard[] = [
  // LÉGENDAIRES (2)
  {
    name: "Dragon Dore",
    rarity: "legendaire",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeia43c7zri7lz66ta4bpqbjpzr23rsmh6etvejlg3lurwdfhb44shm"
  },
  {
    name: "Phoenix Immortel",
    rarity: "legendaire",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeigsbr2x5mcfgi2cstnrd7x3gyottx5222pj4rk7qv3gv5pohp5h6q"
  },
  
  // ÉPIQUES (3)
  {
    name: "Chevalier Noir",
    rarity: "epique",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeidum46xrosdt4dkefhlaketrqg45s6tluh7evrzihwzlvolp3nstq"
  },
  {
    name: "Mage des Glaces",
    rarity: "epique",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeicud2dj6mo5dmpbto7jeoalhpdkjawxkva5omvyvrelrnsowcmuae"
  },
  {
    name: "Assassin Fantome",
    rarity: "epique",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeihhh4pnl6pt2udkzaqmhrplzwuwfox3ew34ezpy7s4nd32mo6s7zi"
  },
  
  // RARES (3)
  {
    name: "Archer Elfe",
    rarity: "rare",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeic522zqehxs73b7abqqsuq533xcjh4vgthqhkfotomnf6oega5ic4"
  },
  {
    name: "Paladin Sacre",
    rarity: "rare",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeidsl2aey225cdyn6l7fhg4ndkqn24rtckxmy5tloheq5k4bpo5oxy"
  },
  {
    name: "Druide Ancien",
    rarity: "rare",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeidzn5kxyxjlf5glprjyp2trm5zpl46kl3wjx4x4sxkduandrfkh5q"
  },
  
  // PEU COMMUNES (3)
  {
    name: "Guerrier Brave",
    rarity: "peu commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeigovwwksezfwbbbrd63qhfeezqgxwnxn7acv2r5qbrsxnc3fr4n5i"
  },
  {
    name: "Voleur Agile",
    rarity: "peu commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeih5kflnip2ck7qirtlsda55l3aejqph4sq63v6zlg2zdqmdwyilcm"
  },
  {
    name: "Pretre Sage",
    rarity: "peu commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeih5smlhdwqf44lby2mzevq6jhov5cu3exxo2ddkzujpnstn6q7p34"
  },
  
  // COMMUNES (5)
  {
    name: "Gobelin Ruse",
    rarity: "commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeievkzzzu73l5xdonrv62nd2jwhuugcxi3ljvecbdnyuwn7rognzfy"
  },
  {
    name: "Sorciere Noire",
    rarity: "commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeidv6iqhv2mq7km6t5m4wyjkayptnh76uw333fkalrz3kyb6lz2qma"
  },
  {
    name: "Barbare Sauvage",
    rarity: "commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeibzxkvxmmxxd366bmenxs6iqpqjnbmdfqvxufte5i64232hafxuny"
  },
  {
    name: "Squelette Soldat",
    rarity: "commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeid37l65fyisxqbaz53an3zaqpozcfrlkhcahjdktbetdgvsnuh3dy"
  },
  {
    name: "Slime Gluant",
    rarity: "commune",
    imageURI: "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeigv2gtaeq2htdrpadaewbjhdth2j6kcgolgmbhq57knvssdmospe4"
  }
];

/**
 * Récupère toutes les cartes uniques existantes (basé sur nom + niveau)
 * Utile pour afficher les options de cartes demandées dans le marketplace
 */
export const loadAllUniqueCards = async (signer: Signer): Promise<UniqueCard[]> => {
  try {
    const contract = getArenaCardsContract(signer);
    const tokenCounter = await contract.tokenCounter();
    
    const uniqueCardsMap = new Map<string, UniqueCard>();

    // Parcourir tous les tokens pour trouver les combinaisons uniques
    for (let i = 0; i < Number(tokenCounter); i++) {
      try {
        // Vérifier que le token existe (pas brûlé)
        await contract.ownerOf(i);
        
        const stats = await contract.getCardStats(i);
        const tokenURI = await contract.tokenURI(i);
        
        const name = stats.name || stats[0];
        const level = Number(stats.level || stats[2]);
        const rarity = stats.rarity || stats[1];
        
        // Créer une clé unique basée sur nom + niveau
        const key = `${name}-${level}`;
        
        // Si cette combinaison n'existe pas encore, l'ajouter
        if (!uniqueCardsMap.has(key)) {
          uniqueCardsMap.set(key, {
            name,
            level,
            rarity,
            imageURI: parseTokenURI(tokenURI),
          });
        }
      } catch (error) {
        // Token brûlé ou n'existe pas, continuer
        continue;
      }
    }

    // Convertir la Map en tableau et trier par nom puis niveau
    return Array.from(uniqueCardsMap.values()).sort((a, b) => {
      if (a.name !== b.name) {
        return a.name.localeCompare(b.name);
      }
      return a.level - b.level;
    });
  } catch (error) {
    console.error('Erreur lors du chargement des cartes uniques:', error);
    return [];
  }
};

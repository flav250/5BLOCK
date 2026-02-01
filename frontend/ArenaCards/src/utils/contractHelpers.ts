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
    if (tokenURI.startsWith('data:application/json;base64,')) {
      const base64Data = tokenURI.replace('data:application/json;base64,', '');

      const jsonString = atob(base64Data);

      const metadata = JSON.parse(jsonString);

      return metadata.image || '';
    }

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

    const balance = await contract.balanceOf(userAddress);
    const balanceNum = Number(balance);

    if (balanceNum === 0) {
      return [];
    }

    const tokenCounter = await contract.tokenCounter();
    const cards: ArenaCard[] = [];

    for (let i = 0; i < Number(tokenCounter); i++) {
      try {
        const owner = await contract.ownerOf(i);

        if (owner.toLowerCase() === userAddress.toLowerCase()) {
          const tokenURI = await contract.tokenURI(i);
          const lockUntil = await contract.lockUntil(i);

          const stats = await contract.getCardStats(i);

          const now = Math.floor(Date.now() / 1000);
          const isLocked = Number(lockUntil) > now;

          cards.push({
            tokenId: i.toString(),
            name: stats.name || stats[0],
            rarity: stats.rarity || stats[1],
            level: Number(stats.level || stats[2]),
            attack: Number(stats.attack || stats[3]),
            imageURI: parseTokenURI(tokenURI),
            createdAt: 0,
            lastTransferAt: 0,
            isLocked: isLocked,
            unlockTime: Number(lockUntil),
          });
        }
      } catch (error) {
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
      attack: Number(stats.attack || stats[3]),
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

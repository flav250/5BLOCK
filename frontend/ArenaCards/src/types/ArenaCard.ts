// types/ArenaCard.ts

export interface ArenaCard {
  tokenId: string;
  name: string;
  rarity: string;
  level: number;
  imageURI: string;
  createdAt: number;
  lastTransferAt: number;
  isLocked: boolean;
  unlockTime: number;
}

export interface TeamSlot {
  position: number;
  card: ArenaCard | null;
}

export type RarityType = 'commune' | 'rare' | 'épique' | 'légendaire';

export const RARITY_COLORS: Record<string, string> = {
  'commune': '#9CA3AF',
  'rare': '#3B82F6',
  'épique': '#A855F7',
  'légendaire': '#F59E0B',
};

export const RARITY_GRADIENT: Record<string, string> = {
  'commune': 'from-gray-400 to-gray-600',
  'rare': 'from-blue-400 to-blue-600',
  'épique': 'from-purple-400 to-purple-600',
  'légendaire': 'from-amber-400 to-amber-600',
};

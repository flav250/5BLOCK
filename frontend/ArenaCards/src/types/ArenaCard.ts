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
  attack: number;
}

export interface TeamSlot {
  position: number;
  card: ArenaCard | null;
}
export const RARITY_GRADIENT: Record<string, string> = {
  'commune': 'from-gray-400 to-gray-600',
  'peu commune': 'from-green-400 to-green-600',
  'rare': 'from-blue-400 to-blue-600',
  'epique': 'from-purple-400 to-purple-600',
  'legendaire': 'from-amber-400 to-amber-600',
};
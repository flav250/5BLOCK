// types/AFKArena.ts

export interface Monster {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  attack: number;
  level: number;
}

export interface BattleResult {
  victory: boolean;
  damage: number;
  points: number;
}

export interface GameProgress {
  wave: number;
  totalPoints: number;
  highestWave: number;
  totalKills: number;
  isRunning: boolean;
}

export const MONSTER_NAMES = [
  'Slime', 'Goblin', 'Rat', 'Loup', 'Orc',
  'Troll', 'Ogre', 'Dragon', 'Démon', 'Titan'
];

export const GAME_CONFIG = {
  BATTLE_INTERVAL: 5000, // 5 secondes
  BASE_MONSTER_HP: 100,
  BASE_MONSTER_ATK: 20,
  HP_SCALING: 1.15, // +15% par vague
  ATK_SCALING: 1.1, // +10% par vague
  POINTS_BASE: 10,
  POINTS_SCALING: 1.2, // +20% par vague
};

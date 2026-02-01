// utils/afkArenaLogic.ts

import type { ArenaCard } from '../types/ArenaCard';
import type { Monster, BattleResult } from '../types/AFKArena';
import { MONSTER_NAMES, GAME_CONFIG } from '../types/AFKArena';

/**
 * Génère un monstre pour une vague
 */
export const generateMonster = (wave: number): Monster => {
  const healthScaling = Math.pow(GAME_CONFIG.HP_SCALING, wave - 1);
  const attackScaling = Math.pow(GAME_CONFIG.ATK_SCALING, wave - 1);

  const health = Math.floor(GAME_CONFIG.BASE_MONSTER_HP * healthScaling);
  const attack = Math.floor(GAME_CONFIG.BASE_MONSTER_ATK * attackScaling);

  const nameIndex = Math.min(wave - 1, MONSTER_NAMES.length - 1);
  const name = MONSTER_NAMES[nameIndex];

  return {
    id: `monster-${wave}-${Date.now()}`,
    name,
    health,
    maxHealth: health,
    attack,
    level: wave,
  };
};

/**
 * Simule un combat automatique
 */
export const simulateBattle = (team: ArenaCard[], monster: Monster): BattleResult => {
  const teamAttack = team.reduce((sum, card) => sum + card.attack, 0);
  const teamHealth = teamAttack * 2; // HP = ATK × 2

  const turnsToKill = Math.ceil(monster.health / teamAttack);
  const turnsToLose = Math.ceil(teamHealth / monster.attack);

  const victory = turnsToKill <= turnsToLose;

  const pointsBase = GAME_CONFIG.POINTS_BASE;
  const pointsScaled = Math.floor(pointsBase * Math.pow(GAME_CONFIG.POINTS_SCALING, monster.level - 1));
  const points = victory ? pointsScaled : Math.floor(pointsScaled * 0.1);

  return {
    victory,
    damage: victory ? monster.health : teamAttack * turnsToLose,
    points,
  };
};

/**
 * Calcule l'attack totale de l'équipe
 */
export const getTotalAttack = (team: ArenaCard[]): number => {
  return team.reduce((sum, card) => sum + card.attack, 0);
};

/**
 * Formate les nombres
 */
export const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

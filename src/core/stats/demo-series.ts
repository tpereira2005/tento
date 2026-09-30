import type { MonthKey } from '../types';

/**
 * Série sintética de 12 meses (out 2025 → set 2026), igual à das pranchas aprovadas.
 * Fonte única para o conjunto de aceitação dos testes e para os dados de demonstração.
 * Totais: depositado 4 280,00 €, levantado 3 615,50 €.
 */
export const DEMO_DEPOSITS_EUR = [300, 285, 460, 320, 410, 240, 345, 390, 280, 420, 315, 515];
export const DEMO_WITHDRAWALS_CENTS = [
  42000, 20000, 25000, 36500, 25000, 55000, 25000, 25000, 34000, 16000, 35000, 23050,
];
export const DEMO_FIRST_MONTH = '2025-10' as MonthKey;
export const DEMO_LAST_MONTH = '2026-09' as MonthKey;

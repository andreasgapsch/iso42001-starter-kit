// Varianten des S4-Prototyps (Einbettung von Worker-Code und Katalogen).
export const VARIANTEN = ['naiv', 'roh', 'gemischt', 'komprimiert'] as const;
export type Variante = (typeof VARIANTEN)[number];

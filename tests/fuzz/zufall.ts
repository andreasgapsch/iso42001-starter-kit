// Eigener, deterministischer Zufallsgenerator des Fuzz-Werkzeugs (mulberry32). Keine Abhängigkeit, kein Math.random:
// gleicher Seed ergibt auf jeder Maschine dieselbe Folge. Jeder Fall bekommt einen eigenen Strom aus (Seed, Ziel, Nummer),
// damit sich ein einzelner Fall ohne die davor liegenden wiederholen lässt.

/** FNV-1a über die Teile, als 32-Bit-Zahl */
export function seedAus(...teile: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const c of teile.join('\u0001')) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class Zufall {
  private zustand: number;

  constructor(seed: number) {
    this.zustand = seed >>> 0;
  }

  /** Gleichverteilt in [0, 1) */
  naechste(): number {
    this.zustand = (this.zustand + 0x6d2b79f5) >>> 0;
    let t = this.zustand;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [0, n) */
  ganz(n: number): number {
    return Math.floor(this.naechste() * n);
  }

  /** Ganzzahl in [von, bis], beide eingeschlossen */
  zwischen(von: number, bis: number): number {
    return von + this.ganz(bis - von + 1);
  }

  /** Wahr mit Wahrscheinlichkeit p */
  mit(p: number): boolean {
    return this.naechste() < p;
  }

  wahl<T>(liste: readonly T[]): T {
    if (liste.length === 0) throw new Error('wahl: leere Liste');
    return liste[this.ganz(liste.length)]!;
  }

  bytes(n: number): Uint8Array {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = this.ganz(256);
    return b;
  }
}

/** Zufallsstrom eines Falls: hängt nur von Seed, Ziel und Nummer ab */
export const fallZufall = (seed: number, ziel: string, nummer: number): Zufall => new Zufall(seedAus(seed, ziel, nummer));

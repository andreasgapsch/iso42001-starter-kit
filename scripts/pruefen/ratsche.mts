// Tor G35 Abdeckungs-Ratsche (AF-047, QK-27): vergleicht den Bericht von `npm run test:cov` (coverage/coverage-summary.json)
// mit der Basis tests/abdeckung-basis.json. Die Abdeckung darf nicht unter die Basis fallen; jede Quelldatei unter src/
// (ohne src/generiert und .d.ts) muss einen Wert haben. Die Basis steigt nur: `--anheben` übernimmt höhere Werte.
// Aufruf: npx tsx scripts/pruefen/ratsche.mts [--anheben]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, relativ } from './gemeinsam.mts';

const TOR = 'G35';
const BASIS = 'tests/abdeckung-basis.json';
const BERICHT = 'coverage/coverage-summary.json';
export const KENNZAHLEN = ['lines', 'statements', 'functions', 'branches'] as const;
type Kennzahl = (typeof KENNZAHLEN)[number];

export interface Basis {
  stand: string;
  hinweis?: string;
  gesamt: Record<Kennzahl, number>;
}
type Summary = Record<string, Partial<Record<Kennzahl, { pct: number | string }>>>;

/** Abdeckung auf zwei Stellen abgerundet, damit eine Messung auf der Basis nicht an Rundung scheitert. */
const abrunden = (x: number): number => Math.floor(x * 100) / 100;

/** Quelldateien, die einen Abdeckungswert haben müssen. */
export function quelldateien(): string[] {
  return dateienUnter(join(REPO, 'src'), (p) => /\.(?:ts|tsx|mts)$/.test(p) && !/\.d\.m?ts$/.test(p))
    .map((p) => relativ(p))
    .filter((p) => !p.startsWith('src/generiert/'));
}

/** Bewertet Bericht gegen Basis; `quellen` sind die erwarteten Dateien (relativ zum Repo). */
export function bewerte(summary: Summary, basis: Basis, quellen: string[]): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (datei: string, meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  const gemessen = new Set(Object.keys(summary).filter((k) => k !== 'total').map((k) => (k.startsWith('/') ? relativ(k) : k)));
  const ohne = quellen.filter((q) => !gemessen.has(q));
  if (ohne.length > 0) fehler(BERICHT, `${ohne.length} Quelldateien ohne Abdeckungswert, z. B. ${ohne.slice(0, 3).join(', ')}`);
  for (const k of KENNZAHLEN) {
    const wert = Number(summary.total?.[k]?.pct);
    if (!Number.isFinite(wert)) fehler(BERICHT, `${k}: kein Gesamtwert`);
    else if (abrunden(wert) < basis.gesamt[k]) fehler(BASIS, `Abdeckung ${k} gesunken: ${wert} % gegen Basis ${basis.gesamt[k]} %`);
  }
  return befunde;
}

/** Neue Basis: je Kennzahl das Maximum aus alter Basis und Messung (nur steigend). */
export function angehoben(summary: Summary, basis: Basis, heute: string): Basis {
  const gesamt = { ...basis.gesamt };
  for (const k of KENNZAHLEN) gesamt[k] = Math.max(basis.gesamt[k], abrunden(Number(summary.total?.[k]?.pct ?? 0)));
  return { ...basis, stand: heute, gesamt };
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const bericht = join(REPO, BERICHT);
  if (!existsSync(bericht)) return [{ tor: TOR, datei: BERICHT, meldung: 'fehlt: zuerst `npm run test:cov` ausführen', schwere: 'fehler' }];
  const summary = JSON.parse(readFileSync(bericht, 'utf8')) as Summary;
  const basis = JSON.parse(readFileSync(join(REPO, BASIS), 'utf8')) as Basis;
  const befunde = bewerte(summary, basis, quelldateien());
  if (process.argv.includes('--anheben') && befunde.length === 0) {
    const neu = angehoben(summary, basis, new Date().toISOString().slice(0, 10));
    writeFileSync(join(REPO, BASIS), `${JSON.stringify(neu, null, 2)}\n`);
    console.log(`Basis angehoben: ${JSON.stringify(neu.gesamt)}`);
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);

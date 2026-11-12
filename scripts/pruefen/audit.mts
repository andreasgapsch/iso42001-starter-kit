// Tor G34 Abhängigkeitsprüfung (AF-038, QK-21): `npm audit --omit=dev` mit Schwelle high. Hinweise ab der Schwelle
// brechen, ausser eine gültige Ausnahme in audit-ausnahmen.json deckt die Kennung (GHSA) ab. Ausnahmen brauchen
// Kennung, Paket, Grund, Erfassungs- und Ablaufdatum; abgelaufene, unvollständige oder auf mehr als 180 Tage ab Erfassung befristete Ausnahmen brechen, ebenso
// Ausnahmen, die nichts mehr ausnehmen (Warnung). Mit `--signaturen` zusätzlich `npm audit signatures`.
// Braucht Netz (Registry). Läuft deshalb in CI und lokal von Hand, nicht im Sammelaufruf alle.mts.
// Aufruf: npx tsx scripts/pruefen/audit.mts [--signaturen]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';

const TOR = 'G34';
const DATEI = 'audit-ausnahmen.json';

export type Schwelle = 'low' | 'moderate' | 'high' | 'critical';
const STUFEN: Schwelle[] = ['low', 'moderate', 'high', 'critical'];

export interface Ausnahme {
  advisory: string;
  paket: string;
  grund: string;
  erfasst: string;
  ablauf: string;
  schwere?: string;
}

/** Ausschnitt des Berichts von `npm audit --json` (auditReportVersion 2). */
export interface AuditBericht {
  vulnerabilities?: Record<string, { name: string; via: (string | { source?: number; name?: string; title?: string; url?: string; severity?: string })[] }>;
}

interface Hinweis {
  advisory: string;
  paket: string;
  schwere: string;
  titel: string;
}

/** Alle Hinweise (Advisories) des Berichts; Verweise auf andere Pakete (Zeichenketten) zählen nicht doppelt. */
export function hinweise(bericht: AuditBericht): Hinweis[] {
  const liste = new Map<string, Hinweis>();
  for (const v of Object.values(bericht.vulnerabilities ?? {})) {
    for (const via of v.via) {
      if (typeof via === 'string') continue;
      const id = via.url?.split('/').pop() ?? String(via.source ?? 'unbekannt');
      liste.set(`${id}|${via.name ?? v.name}`, { advisory: id, paket: via.name ?? v.name, schwere: via.severity ?? 'unbekannt', titel: via.title ?? '' });
    }
  }
  return [...liste.values()];
}

/** Höchstfrist einer Ausnahme in Tagen ab Eintragsdatum (`erfasst`). */
export const HOECHSTFRIST_TAGE = 180;
const tage = (von: string, bis: string): number => Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Bewertet Bericht und Ausnahmen. `heute` als JJJJ-MM-TT; Ausnahmen gelten bis einschliesslich `ablauf`. */
export function bewerte(bericht: AuditBericht, ausnahmen: Ausnahme[], heute: string, schwelle: Schwelle = 'high'): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (meldung: string) => befunde.push({ tor: TOR, datei: DATEI, meldung, schwere: 'fehler' });
  const warnung = (meldung: string) => befunde.push({ tor: TOR, datei: DATEI, meldung, schwere: 'warnung' });

  const gueltig = new Map<string, Ausnahme>();
  for (const a of ausnahmen) {
    const name = `${a.advisory ?? '?'} (${a.paket ?? '?'})`;
    const fehlt = (['advisory', 'paket', 'grund', 'erfasst', 'ablauf'] as const).filter((k) => typeof a[k] !== 'string' || a[k].trim() === '');
    if (fehlt.length > 0) fehler(`Ausnahme ${name} unvollständig: ${fehlt.join(', ')}`);
    else if (!DATUM.test(a.ablauf) || !DATUM.test(a.erfasst)) fehler(`Ausnahme ${name}: Datum nicht im Format JJJJ-MM-TT`);
    else if (tage(a.erfasst, a.ablauf) > HOECHSTFRIST_TAGE) fehler(`Ausnahme ${name}: Frist ${a.ablauf} liegt mehr als ${HOECHSTFRIST_TAGE} Tage nach der Erfassung ${a.erfasst}`);
    else if (a.ablauf < heute) fehler(`Ausnahme ${name} abgelaufen seit ${a.ablauf}: Befund beheben oder begründet verlängern`);
    else gueltig.set(a.advisory, a);
  }

  const benutzt = new Set<string>();
  for (const h of hinweise(bericht)) {
    const stufe = STUFEN.indexOf(h.schwere as Schwelle);
    const ausnahme = gueltig.get(h.advisory);
    if (ausnahme) {
      benutzt.add(h.advisory);
      continue;
    }
    const text = `${h.paket}: ${h.titel} (${h.advisory}, ${h.schwere})`;
    if (stufe >= STUFEN.indexOf(schwelle) || stufe < 0) fehler(`Hinweis ab ${schwelle} ohne gültige Ausnahme: ${text}`);
    else warnung(`Hinweis unter der Schwelle ${schwelle}: ${text}`);
  }
  for (const a of gueltig.values()) if (!benutzt.has(a.advisory)) warnung(`Ausnahme ${a.advisory} (${a.paket}) nimmt nichts mehr aus: entfernen`);
  return befunde;
}

function npm(argumente: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('npm', argumente, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const heute = new Date().toISOString().slice(0, 10);
  const ausnahmen = (JSON.parse(readFileSync(join(REPO, DATEI), 'utf8')) as { ausnahmen: Ausnahme[] }).ausnahmen;
  const lauf = npm(['audit', '--omit=dev', '--json']);
  let bericht: AuditBericht;
  try {
    bericht = JSON.parse(lauf.stdout) as AuditBericht;
  } catch {
    return [{ tor: TOR, datei: 'npm audit', meldung: `Ausgabe nicht lesbar (Netz oder Registry?): ${lauf.stderr.slice(0, 300)}`, schwere: 'fehler' }];
  }
  const befunde = bewerte(bericht, ausnahmen, heute);
  if (process.argv.includes('--signaturen')) {
    const s = npm(['audit', 'signatures']);
    if (s.status !== 0) befunde.push({ tor: TOR, datei: 'npm audit signatures', meldung: `Signaturprüfung fehlgeschlagen: ${(s.stdout + s.stderr).trim().slice(0, 400)}`, schwere: 'fehler' });
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);

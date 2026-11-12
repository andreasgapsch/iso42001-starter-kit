// Tor G31 Schema-Versionstor: Das erzeugte Projektschema (src/generiert/projekt.schema.json) darf sich nur ändern, wenn
// SCHEMA_VERSION steigt, ein Migrationsschritt dazukommt und die Beispieldateien der neuen Version vorliegen.
// Gemessen wird der SHA-256 des normalisierten Schemas (Schlüssel sortiert, Beschreibungstexte «description» entfernt,
// damit eine Kommentarkorrektur in typen.ts das Tor nicht auslöst) gegen tests/fixtures/migration/schema-v<N>.sha256.
// Prüft ausserdem: Referenz je Version 1 bis N, Beispieldatei je Version (v<N>.<beispiel>.<sprache>.aims.json mit passender
// schemaVersion), Migrationskette lückenlos von 1 bis N.
// Aufruf: npx tsx scripts/pruefen/schema-version.mts            Prüfung (setzt `npm run schema` voraus)
//         npx tsx scripts/pruefen/schema-version.mts --schreiben  Referenz der aktuellen Version anlegen (nie überschreiben)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONEN, pruefeKette, type Migration } from '../../src/model/migrationen.ts';
import { SCHEMA_VERSION } from '../../src/model/typen.ts';
import { REPO, relativ, type Befund, type Optionen } from './gemeinsam.mts';

const TOR = 'G31';
const FIXTURE_ORDNER = join(REPO, 'tests', 'fixtures', 'migration');
const SCHEMA_DATEI = join(REPO, 'src', 'generiert', 'projekt.schema.json');
/** Quellen des Schemas (scripts/schema.mts liest typen.ts und was es importiert): neuer als die erzeugte Datei = Schema veraltet */
const SCHEMA_QUELLEN = ['src/model/typen.ts', 'src/bibliothek/modell.ts', 'src/prozesse/typen.ts'].map((d) => join(REPO, d));
/** Schlüssel, deren Kinder Namen von Feldern sind (kein Schlüsselwort): dort bleibt auch ein Feld «description» erhalten */
const NAMENSTABELLEN = new Set(['properties', 'definitions', 'patternProperties']);

export interface Eingabe {
  /** Text des Schemas statt der erzeugten Datei (Gegenprobe im Test) */
  schemaText?: string;
  version?: number;
  migrationen?: Migration[];
  /** Ordner mit v<N>-Beispielen und schema-v<N>.sha256 */
  ordner?: string;
  /** Erzeugte Schemadatei und Quelldateien für die Frischeprüfung (Test); gilt nur, wenn schemaText fehlt */
  schemaDatei?: string;
  quellen?: string[];
}

function normalisiere(w: unknown, inTabelle = false): unknown {
  if (Array.isArray(w)) return w.map((x) => normalisiere(x));
  if (w && typeof w === 'object') {
    const o = w as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .filter((k) => inTabelle || k !== 'description')
        .sort()
        .map((k) => [k, normalisiere(o[k], NAMENSTABELLEN.has(k) && !inTabelle)]),
    );
  }
  return w;
}

/** SHA-256 (hex) des normalisierten Schemas */
export function hashSchema(schemaText: string): string {
  return createHash('sha256').update(JSON.stringify(normalisiere(JSON.parse(schemaText)))).digest('hex');
}

const referenzDatei = (ordner: string, v: number) => join(ordner, `schema-v${v}.sha256`);
const lies = (datei: string) => readFileSync(datei, 'utf8').trim().split(/\s+/)[0] ?? '';

export async function pruefe(_o: Optionen = {}, e: Eingabe = {}): Promise<Befund[]> {
  const version = e.version ?? SCHEMA_VERSION;
  const ordner = e.ordner ?? FIXTURE_ORDNER;
  const befunde: Befund[] = [];
  const fehler = (datei: string, meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });

  let schemaText = e.schemaText;
  if (schemaText === undefined) {
    const datei = e.schemaDatei ?? SCHEMA_DATEI;
    if (!existsSync(datei)) return [{ tor: TOR, datei: relativ(datei), meldung: 'Schema nicht erzeugt: zuerst `npm run schema` ausführen', schwere: 'fehler' }];
    // Ein veraltetes erzeugtes Schema würde die Änderung am Modell verdecken: lieber abbrechen als falsch grün
    const neuer = (e.quellen ?? SCHEMA_QUELLEN).filter((q) => existsSync(q) && statSync(q).mtimeMs > statSync(datei).mtimeMs + 1000);
    if (neuer.length) return [{ tor: TOR, datei: relativ(datei), meldung: `Das erzeugte Schema ist älter als ${neuer.map((q) => relativ(q)).join(', ')}: zuerst \`npm run schema\` ausführen`, schwere: 'fehler' }];
    schemaText = readFileSync(datei, 'utf8');
  }
  const ist = hashSchema(schemaText);

  for (let v = 1; v <= version; v++) {
    const datei = referenzDatei(ordner, v);
    if (!existsSync(datei)) fehler(relativ(datei), `Referenz für Schemaversion ${v} fehlt. Neue Version: \`npx tsx scripts/pruefen/schema-version.mts --schreiben\``);
  }
  const aktuell = referenzDatei(ordner, version);
  if (existsSync(aktuell) && lies(aktuell) !== ist) {
    fehler(
      relativ(aktuell),
      `Das Projektschema weicht von der Referenz der Schemaversion ${version} ab (${ist.slice(0, 12)} statt ${lies(aktuell).slice(0, 12)}). ` +
        `Eine Änderung am Datenmodell braucht eine höhere SCHEMA_VERSION, einen Migrationsschritt und Beispieldateien der neuen Version (siehe src/model/migrationen.ts).`,
    );
  }

  for (const p of pruefeKette(e.migrationen ?? MIGRATIONEN, version)) fehler('src/model/migrationen.ts', p);

  const dateien = existsSync(ordner) ? readdirSync(ordner).filter((d) => /^v\d+\..+\.aims\.json$/.test(d)) : [];
  const vorhanden = new Set<number>();
  for (const d of dateien) {
    const v = Number(/^v(\d+)\./.exec(d)![1]);
    vorhanden.add(v);
    if (v > version) fehler(relativ(join(ordner, d)), `Beispieldatei einer Version über SCHEMA_VERSION ${version}`);
    let inhalt: unknown;
    try {
      inhalt = JSON.parse(readFileSync(join(ordner, d), 'utf8'));
    } catch {
      fehler(relativ(join(ordner, d)), 'Beispieldatei ist kein gültiges JSON');
      continue;
    }
    const sv = (inhalt as { schemaVersion?: unknown } | null)?.schemaVersion;
    if (sv !== v) fehler(relativ(join(ordner, d)), `schemaVersion ${String(sv)} passt nicht zum Dateinamen (v${v})`);
  }
  for (let v = 1; v <= version; v++) if (!vorhanden.has(v)) fehler(relativ(ordner), `Beispieldatei der Schemaversion ${v} fehlt (v${v}.<beispiel>.<sprache>.aims.json)`);
  return befunde;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  if (process.argv.includes('--schreiben')) {
    const datei = referenzDatei(FIXTURE_ORDNER, SCHEMA_VERSION);
    if (existsSync(datei)) {
      console.error(`${relativ(datei)} besteht schon und wird nie überschrieben: eine veröffentlichte Version bleibt unverändert.`);
      process.exitCode = 1;
    } else {
      writeFileSync(datei, `${hashSchema(readFileSync(SCHEMA_DATEI, 'utf8'))}\n`);
      console.log(`Referenz geschrieben: ${relativ(datei)}`);
    }
  } else {
    const befunde = await pruefe();
    for (const b of befunde) console.log(`${b.tor} ${b.datei}: ${b.meldung}`);
    console.log(`${TOR} Schema-Versionstor: ${befunde.length} Verstösse`);
    process.exitCode = befunde.length ? 1 : 0;
  }
}

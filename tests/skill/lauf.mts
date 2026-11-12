// Skill-Tests (Tor G16): führt die Fälle aus tests/skill/testfaelle.yaml mit Claude Code headless aus.
//
// Aufruf:
//   npx tsx tests/skill/lauf.mts                      alle Fälle
//   npx tsx tests/skill/lauf.mts T01 T03              nur diese Fälle
//   npx tsx tests/skill/lauf.mts --auswerten <ordner> gespeicherte Antworten erneut prüfen (keine API-Kosten)
// Umgebung:
//   SKILL_TEST_MODELL    Modell für claude -p (Standard: sonnet)
//   SKILL_TEST_PARALLEL  gleichzeitige Fälle (Standard: 4)
//   SKILL_TEST_BUDGET    Kostengrenze je Aufruf in USD (Standard: 2)
//   SKILL_TEST_AUSGABE   Ordner für Antworten (Standard: neuer Ordner im Temp-Verzeichnis)
//
// Ablauf je Lauf: Skill-Ordner iso42001-kmu einmal mit scripts/skill.mts bauen wie im Kit (handgeschriebene Teile,
// erzeugte Referenzen und Schema der Projektdatei, ohne Vorlagen und ohne PROJEKT-ANWEISUNG.md), je Fall in ein
// temporäres Projekt unter .claude/skills/ kopieren und
// claude -p --output-format json aufrufen; Folgezüge mit --resume. Benutzer-Einstellungen und
// Benutzer-CLAUDE.md werden nicht geladen (--setting-sources project), MCP-Server ebenfalls nicht.
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parse } from 'yaml';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAELLE_DATEI = join(REPO, 'tests', 'skill', 'testfaelle.yaml');
const MODELL = process.env.SKILL_TEST_MODELL ?? 'sonnet';
const PARALLEL = Number(process.env.SKILL_TEST_PARALLEL ?? 4);
const BUDGET = process.env.SKILL_TEST_BUDGET ?? '2';

type Bereich = 'erste' | 'letzte' | 'alle';
interface Pruefung {
  art: string;
  in?: Bereich;
  muster?: string;
  max?: number;
  min?: number;
  pfad?: string;
  wert?: unknown;
  ohne_code?: boolean;
}
interface Fall {
  id: string;
  titel: string;
  zuege: string[];
  projektdatei?: string;
  pruefungen: Pruefung[];
}
interface Zug {
  eingabe: string;
  antwort: string;
  sessionId: string;
  kostenUsd: number;
  dauerMs: number;
  fehler?: string;
}
interface Lauf {
  id: string;
  modell: string;
  zuege: Zug[];
}
interface Befund {
  pruefung: Pruefung;
  ok: boolean;
  detail: string;
}

// ---------- Schema und Skill bauen ----------

function schemaErzeugen(): object {
  const ausgabe = execFileSync(
    'npx',
    ['ts-json-schema-generator', '-p', 'src/model/typen.ts', '-t', 'Projekt', '--tsconfig', 'tsconfig.json', '--no-type-check'],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(ausgabe) as object;
}

/**
 * Skill wie im Kit bauen (scripts/skill.mts: handgeschriebene Teile, erzeugte Referenzen wie controls-42001.md,
 * rmf-subkategorien.md, genai-profil.md und das Schema der Projektdatei), ohne Vorlagen unter assets/.
 */
function skillBauen(ziel: string): void {
  const ordner = join(ziel, '.claude', 'skills', 'iso42001-kmu');
  const bau = mkdtempSync(join(tmpdir(), 'skill-bau-'));
  try {
    execFileSync('npx', ['tsx', 'scripts/skill.mts', '--ziel', bau], { cwd: REPO, stdio: 'ignore' });
    mkdirSync(dirname(ordner), { recursive: true });
    cpSync(join(bau, 'iso42001-kmu'), ordner, { recursive: true });
  } finally {
    rmSync(bau, { recursive: true, force: true });
  }
}

// ---------- Claude aufrufen ----------

function claude(cwd: string, eingabe: string, sessionId?: string): Promise<Zug> {
  const argumente = [
    '-p', eingabe,
    '--output-format', 'json',
    '--model', MODELL,
    '--setting-sources', 'project',
    '--strict-mcp-config',
    '--tools', 'Skill,Read,Glob,Grep',
    '--allowedTools', 'Skill Read Glob Grep',
    '--max-budget-usd', BUDGET,
  ];
  if (sessionId) argumente.push('--resume', sessionId);
  const start = Date.now();
  return new Promise((resolve) => {
    const p = spawn('claude', argumente, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let aus = '';
    let err = '';
    p.stdout.on('data', (d: Buffer) => (aus += d.toString()));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    const zeit = setTimeout(() => p.kill('SIGTERM'), 15 * 60 * 1000);
    p.on('close', (code) => {
      clearTimeout(zeit);
      const dauerMs = Date.now() - start;
      try {
        const j = JSON.parse(aus) as { result?: string; session_id?: string; total_cost_usd?: number; is_error?: boolean; subtype?: string };
        resolve({
          eingabe,
          antwort: j.result ?? '',
          sessionId: j.session_id ?? sessionId ?? '',
          kostenUsd: j.total_cost_usd ?? 0,
          dauerMs,
          fehler: j.is_error ? `Fehler: ${j.subtype ?? ''}` : undefined,
        });
      } catch {
        resolve({ eingabe, antwort: '', sessionId: sessionId ?? '', kostenUsd: 0, dauerMs, fehler: `Exit ${code}: ${err.slice(0, 500)} ${aus.slice(0, 500)}` });
      }
    });
  });
}

async function fallAusfuehren(fall: Fall, cwd: string): Promise<Lauf> {
  const zuege: Zug[] = [];
  let sessionId: string | undefined;
  for (let i = 0; i < fall.zuege.length; i++) {
    let eingabe = fall.zuege[i]!;
    if (i === 0 && fall.projektdatei) eingabe += '\n\n```json\n' + fall.projektdatei.trim() + '\n```';
    const zug = await claude(cwd, eingabe, sessionId);
    zuege.push(zug);
    process.stdout.write(`  ${fall.id} Zug ${i + 1}: ${zug.fehler ?? 'ok'} (${(zug.dauerMs / 1000).toFixed(0)} s, ${zug.kostenUsd.toFixed(3)} USD)\n`);
    if (zug.fehler || !zug.sessionId) break;
    sessionId = zug.sessionId;
  }
  return { id: fall.id, modell: MODELL, zuege };
}

// ---------- Prüfen ----------

function textIn(lauf: Lauf, bereich: Bereich = 'letzte'): string {
  const a = lauf.zuege.map((z) => z.antwort);
  if (bereich === 'erste') return a[0] ?? '';
  if (bereich === 'alle') return a.join('\n\n');
  return a[a.length - 1] ?? '';
}

/** Alle ```json-Blöcke, die wie eine Projektdatei aussehen (enthalten schemaVersion). */
export function projektdateien(text: string): { roh: string; daten?: unknown; fehler?: string }[] {
  const bloecke = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)].map((m) => m[1]!);
  return bloecke
    .filter((b) => b.includes('"schemaVersion"'))
    .map((roh) => {
      try {
        return { roh, daten: JSON.parse(roh) as unknown };
      } catch (e) {
        return { roh, fehler: (e as Error).message };
      }
    });
}

/** Pfad wie «kiSysteme[*].aiAct.rollen[*]» oder «kiSysteme[0].name» auflösen. */
export function pfadWerte(daten: unknown, pfad: string): unknown[] {
  let aktuell: unknown[] = [daten];
  for (const teil of pfad.split('.')) {
    const m = /^([^[\]]+)((?:\[(?:\*|\d+)\])*)$/.exec(teil);
    if (!m) throw new Error(`Pfad ungültig: ${pfad}`);
    aktuell = aktuell.flatMap((w) => (w !== null && typeof w === 'object' && m[1]! in (w as object) ? [(w as Record<string, unknown>)[m[1]!]] : []));
    for (const idx of m[2]!.match(/\[(\*|\d+)\]/g) ?? []) {
      const i = idx.slice(1, -1);
      aktuell = aktuell.flatMap((w) => (Array.isArray(w) ? (i === '*' ? w : i in w ? [w[Number(i)]] : []) : []));
    }
  }
  return aktuell;
}

/** Fragen zählen: Fragezeichen ausserhalb von Code, Zitaten («…», "…", „…") und Beispielen. */
export function fragenZaehlen(text: string): number {
  const ohne = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/«[^»]*»/g, '')
    .replace(/„[^“"]*[“"]/g, '')
    .replace(/"[^"\n]*"/g, '')
    .replace(/“[^”]*”/g, '')
    .replace(/\((?:Beispiel|z\. B\.|e\.g\.|Example)[^)]*\)/gi, '');
  return (ohne.match(/\?/g) ?? []).length;
}

function pruefen(fall: Fall, lauf: Lauf, validieren: (d: unknown) => { ok: boolean; fehler: string }): Befund[] {
  const befunde: Befund[] = [];
  const fehlerZug = lauf.zuege.find((z) => z.fehler);
  if (fehlerZug || lauf.zuege.length < fall.zuege.length) {
    befunde.push({ pruefung: { art: 'lauf' }, ok: false, detail: fehlerZug?.fehler ?? 'nicht alle Züge ausgeführt' });
  }
  for (const p of fall.pruefungen) {
    const roh = textIn(lauf, p.in);
    const text = p.ohne_code ? roh.replace(/```[\s\S]*?```/g, '') : roh;
    const re = p.muster ? new RegExp(p.muster, 'i') : undefined;
    let ok = false;
    let detail = '';
    switch (p.art) {
      case 'enthaelt':
        ok = re!.test(text);
        detail = ok ? '' : 'nicht gefunden';
        break;
      case 'enthaelt_nicht': {
        const m = re!.exec(text);
        ok = !m;
        detail = m ? `gefunden: «${text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\n/g, ' ')}»` : '';
        break;
      }
      case 'anzahl_max': {
        const n = (text.match(new RegExp(p.muster!, 'gi')) ?? []).length;
        ok = n <= p.max!;
        detail = `${n} Treffer`;
        break;
      }
      case 'fragen_max': {
        const n = fragenZaehlen(text);
        ok = n <= p.max!;
        detail = `${n} Fragen`;
        break;
      }
      default: {
        const dateien = projektdateien(roh);
        const letzte = dateien.at(-1);
        if (p.art === 'json_gueltig') {
          if (dateien.length === 0) {
            detail = 'keine Projektdatei ausgegeben';
            break;
          }
          const probleme = dateien.flatMap((d, i) => {
            if (d.fehler) return [`Block ${i + 1}: JSON nicht lesbar (${d.fehler})`];
            const v = validieren(d.daten);
            return v.ok ? [] : [`Block ${i + 1}: ${v.fehler}`];
          });
          ok = probleme.length === 0;
          detail = probleme.join('; ').slice(0, 600);
          break;
        }
        if (!letzte?.daten) {
          detail = 'keine lesbare Projektdatei';
          break;
        }
        const werte = pfadWerte(letzte.daten, p.pfad!);
        if (p.art === 'json_enthaelt') {
          ok = werte.some((w) => re!.test(String(w)));
          detail = ok ? '' : `Werte: ${JSON.stringify(werte).slice(0, 200)}`;
        } else if (p.art === 'json_enthaelt_nicht') {
          ok = !werte.some((w) => re!.test(String(w)));
          detail = ok ? '' : `Werte: ${JSON.stringify(werte).slice(0, 200)}`;
        } else if (p.art === 'json_gleich') {
          ok = werte.length > 0 && JSON.stringify(werte[0]) === JSON.stringify(p.wert);
          detail = ok ? '' : `Wert: ${JSON.stringify(werte[0])}`;
        } else if (p.art === 'json_anzahl') {
          ok = werte.length >= p.min!;
          detail = `${werte.length} Werte`;
        } else {
          detail = `unbekannte Prüfart ${p.art}`;
        }
      }
    }
    befunde.push({ pruefung: p, ok, detail });
  }
  return befunde;
}

function beschreibe(p: Pruefung): string {
  const teile = [p.art, p.in ? `[${p.in}]` : '', p.pfad ?? '', p.muster ? `/${p.muster}/` : '', p.max !== undefined ? `max ${p.max}` : '', p.min !== undefined ? `min ${p.min}` : '', p.wert !== undefined ? `= ${JSON.stringify(p.wert)}` : ''];
  return teile.filter(Boolean).join(' ');
}

// ---------- Hauptprogramm ----------

async function parallel<T, R>(liste: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const ergebnis: R[] = new Array(liste.length);
  let naechster = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, liste.length) }, async () => {
      while (naechster < liste.length) {
        const i = naechster++;
        ergebnis[i] = await f(liste[i]!);
      }
    }),
  );
  return ergebnis;
}

async function main(): Promise<void> {
  const argumente = process.argv.slice(2);
  const auswertenIdx = argumente.indexOf('--auswerten');
  const auswertenOrdner = auswertenIdx >= 0 ? argumente[auswertenIdx + 1] : undefined;
  const filter = argumente.filter((a, i) => !a.startsWith('--') && (auswertenIdx < 0 || i !== auswertenIdx + 1));
  const { faelle: alle } = parse(readFileSync(FAELLE_DATEI, 'utf8')) as { faelle: Fall[] };
  const faelle = filter.length ? alle.filter((f) => filter.includes(f.id)) : alle;

  const schema = schemaErzeugen();
  const ajv = new Ajv({ allErrors: true, strict: false });
  const pruefer = ajv.compile(schema);
  const validieren = (d: unknown): { ok: boolean; fehler: string } => {
    const ok = pruefer(d) as boolean;
    return { ok, fehler: ok ? '' : ajv.errorsText(pruefer.errors, { separator: '; ' }) };
  };

  // Vorab: Projektdateien der Fälle müssen selbst gültig sein.
  for (const f of faelle) {
    if (!f.projektdatei) continue;
    const v = validieren(JSON.parse(f.projektdatei));
    if (!v.ok) throw new Error(`Projektdatei in ${f.id} ungültig: ${v.fehler}`);
  }

  let laeufe: Lauf[];
  let ausgabe: string;
  if (auswertenOrdner) {
    ausgabe = auswertenOrdner;
    laeufe = faelle
      .filter((f) => existsSync(join(ausgabe, `${f.id}.json`)))
      .map((f) => JSON.parse(readFileSync(join(ausgabe, `${f.id}.json`), 'utf8')) as Lauf);
  } else {
    ausgabe = process.env.SKILL_TEST_AUSGABE ?? mkdtempSync(join(tmpdir(), 'skill-test-'));
    mkdirSync(ausgabe, { recursive: true });
    console.log(`Modell ${MODELL}, ${faelle.length} Fälle, Ausgabe ${ausgabe}`);
    const vorlage = mkdtempSync(join(tmpdir(), 'skill-vorlage-'));
    skillBauen(vorlage);
    laeufe = await parallel(faelle, PARALLEL, async (f) => {
      // Je Fall ein eigenes Projektverzeichnis, damit sich Sitzungen nicht vermischen.
      const projekt = mkdtempSync(join(tmpdir(), `skill-projekt-${f.id}-`));
      cpSync(join(vorlage, '.claude'), join(projekt, '.claude'), { recursive: true });
      const lauf = await fallAusfuehren(f, projekt);
      writeFileSync(join(ausgabe, `${f.id}.json`), JSON.stringify(lauf, null, 2));
      writeFileSync(join(ausgabe, `${f.id}.md`), lauf.zuege.map((z, i) => `## Zug ${i + 1}: Eingabe\n\n${z.eingabe}\n\n## Zug ${i + 1}: Antwort\n\n${z.antwort}\n`).join('\n'));
      rmSync(projekt, { recursive: true, force: true });
      return lauf;
    });
    rmSync(vorlage, { recursive: true, force: true });
  }

  let bestanden = 0;
  let kosten = 0;
  const zusammenfassung: { id: string; titel: string; ok: boolean; fehler: string[] }[] = [];
  for (const f of faelle) {
    const lauf = laeufe.find((l) => l.id === f.id);
    if (!lauf) continue;
    kosten += lauf.zuege.reduce((s, z) => s + z.kostenUsd, 0);
    const befunde = pruefen(f, lauf, validieren);
    const fehler = befunde.filter((b) => !b.ok);
    const ok = fehler.length === 0;
    if (ok) bestanden++;
    zusammenfassung.push({ id: f.id, titel: f.titel, ok, fehler: fehler.map((b) => `${beschreibe(b.pruefung)}: ${b.detail}`) });
    console.log(`${ok ? 'BESTANDEN' : 'NICHT BESTANDEN'}  ${f.id} ${f.titel} (${befunde.length - fehler.length}/${befunde.length})`);
    for (const b of fehler) console.log(`    x ${beschreibe(b.pruefung)}: ${b.detail}`);
  }
  writeFileSync(join(ausgabe, 'ergebnis.json'), JSON.stringify({ modell: MODELL, bestanden, gesamt: zusammenfassung.length, kostenUsd: kosten, faelle: zusammenfassung }, null, 2));
  console.log(`\n${bestanden}/${zusammenfassung.length} Fälle bestanden, Kosten ${kosten.toFixed(2)} USD, Antworten in ${ausgabe}`);
  if (readdirSync(ausgabe).length === 0) rmSync(ausgabe, { recursive: true, force: true });
  process.exitCode = bestanden === zusammenfassung.length ? 0 : 1;
}

await main();

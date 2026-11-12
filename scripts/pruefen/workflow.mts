// Tor G32 Workflows (AF-040, QK-22): Syntax und Härtung der Dateien unter .github/workflows/.
// - Aufbau: gültiges YAML mit `on` und `jobs`; jeder Job hat `runs-on` und `steps`; jeder Schritt hat `run` oder `uses`.
// - `uses:` auf einen 40-stelligen SHA mit Versionskommentar (`# v7.0.1`, genaue Version); lokale Aktionen (`./`) sind ausgenommen.
// - `permissions` je Job; `concurrency` mit `cancel-in-progress` nur für Nicht-main-Zweige (`${{ github.ref != 'refs/heads/main' }}`) auf Workflow- oder Jobebene.
// - `timeout-minutes` je Schritt.
// Dependabot: .github/dependabot.yml deckt npm und github-actions wöchentlich ab (AF-039).
// Aufruf: npx tsx scripts/pruefen/workflow.mts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, relativ } from './gemeinsam.mts';

const TOR = 'G32';

type Dict = Record<string, unknown>;
const istDict = (x: unknown): x is Dict => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Prüft den Text einer Workflow-Datei. */
export function pruefeWorkflow(datei: string, text: string): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (meldung: string, zeile?: number) => befunde.push({ tor: TOR, datei, ...(zeile ? { zeile } : {}), meldung, schwere: 'fehler' });
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (e) {
    fehler(`kein gültiges YAML: ${(e as Error).message.split('\n')[0]}`);
    return befunde;
  }
  if (!istDict(doc)) {
    fehler('Wurzel ist kein Objekt');
    return befunde;
  }
  // YAML 1.2: `on` bleibt ein Schlüssel; ältere Parser machen daraus true
  if (!('on' in doc) && !('true' in doc)) fehler('Auslöser `on` fehlt');
  if (!istDict(doc.jobs) || Object.keys(doc.jobs).length === 0) {
    fehler('`jobs` fehlt oder ist leer');
    return befunde;
  }

  // uses: zeilenweise (Versionskommentar steht hinter dem SHA)
  text.split('\n').forEach((z, i) => {
    const m = /^\s*-?\s*uses:\s*(\S+)(.*)$/.exec(z);
    if (!m || m[1]!.startsWith('./')) return;
    if (!/@[0-9a-f]{40}$/.test(m[1]!)) fehler(`uses ohne 40-stelligen SHA: ${m[1]}`, i + 1);
    else if (!/#\s*v\d+\.\d+\.\d+\b/.test(m[2]!)) fehler(`uses ohne Versionskommentar mit genauer Version (# v1.2.3): ${m[1]}`, i + 1);
  });

  const abbruch = (c: unknown): boolean => istDict(c) && typeof c.group === 'string' && typeof c['cancel-in-progress'] === 'string' && /github\.ref\s*!=\s*'refs\/heads\/main'/.test(c['cancel-in-progress']);
  const wurzelAbbruch = abbruch(doc.concurrency);
  for (const [name, job] of Object.entries(doc.jobs)) {
    if (!istDict(job)) {
      fehler(`Job ${name}: kein Objekt`);
      continue;
    }
    if (!('uses' in job)) {
      if (typeof job['runs-on'] !== 'string' && !Array.isArray(job['runs-on']) && !istDict(job['runs-on'])) fehler(`Job ${name}: runs-on fehlt`);
      if (!Array.isArray(job.steps) || job.steps.length === 0) fehler(`Job ${name}: steps fehlt oder ist leer`);
    }
    if (job.permissions === undefined) fehler(`Job ${name}: permissions fehlt`);
    if (!wurzelAbbruch && !abbruch(job.concurrency)) fehler(`Job ${name}: concurrency mit group und cancel-in-progress nur für Nicht-main-Zweige fehlt (Workflow oder Job)`);
    (Array.isArray(job.steps) ? (job.steps as unknown[]) : []).forEach((s, i) => {
      if (!istDict(s)) return fehler(`Job ${name}, Schritt ${i + 1}: kein Objekt`);
      const bez = `Job ${name}, Schritt ${i + 1}${typeof s.name === 'string' ? ` «${s.name}»` : ''}`;
      if (typeof s.run !== 'string' && typeof s.uses !== 'string') fehler(`${bez}: weder run noch uses`);
      if (typeof s['timeout-minutes'] !== 'number') fehler(`${bez}: timeout-minutes fehlt`);
    });
  }
  return befunde;
}

/** Prüft dependabot.yml: npm und github-actions, wöchentlich. */
export function pruefeDependabot(text: string): Befund[] {
  const befunde: Befund[] = [];
  const datei = '.github/dependabot.yml';
  const fehler = (meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (e) {
    fehler(`kein gültiges YAML: ${(e as Error).message.split('\n')[0]}`);
    return befunde;
  }
  const liste = istDict(doc) && Array.isArray(doc.updates) ? (doc.updates as unknown[]) : [];
  for (const oekosystem of ['npm', 'github-actions']) {
    const e = liste.find((u) => istDict(u) && u['package-ecosystem'] === oekosystem);
    if (!e || !istDict(e)) fehler(`Ökosystem ${oekosystem} fehlt`);
    else if (!istDict(e.schedule) || e.schedule.interval !== 'weekly') fehler(`Ökosystem ${oekosystem}: Takt ist nicht weekly`);
  }
  return befunde;
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const dateien = dateienUnter(join(REPO, '.github', 'workflows'), (p) => /\.ya?ml$/.test(p));
  if (dateien.length === 0) befunde.push({ tor: TOR, datei: '.github/workflows', meldung: 'keine Workflow-Datei', schwere: 'fehler' });
  for (const p of dateien) befunde.push(...pruefeWorkflow(relativ(p), readFileSync(p, 'utf8')));
  const dep = join(REPO, '.github', 'dependabot.yml');
  if (existsSync(dep)) befunde.push(...pruefeDependabot(readFileSync(dep, 'utf8')));
  else befunde.push({ tor: TOR, datei: '.github/dependabot.yml', meldung: 'fehlt', schwere: 'fehler' });
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);

// Tor G15 ID-Abdeckung: Jede verlangte dokumentierte Information (Kapitel 4 bis 10) und jedes Control aus Anhang A
// ist mit derselben ID in Vorlagen, SoA (D-11), Werkzeug (Katalog im Bundle), Skill und Beispielprojekten abgedeckt.
// Zusätzlich jedes Zusatz-Control EUAIA-xx in D-11 (mit Modul), Werkzeug und Skill; Modul NIST AI RMF: alle 72
// Subkategorien und 23 Zusatz-Controls RMF-xx in N-02, RMF-xx in D-11 (leer mit Modul), Werkzeug und Skill-Referenz.
// Aufruf: npx tsx scripts/pruefen/abdeckung.mts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { alleAbschnitte42001, alleControls42001 } from '../../src/kataloge/typen.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { KIT_VERSION, leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { klartext } from '../../src/vorlagen/kontext.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter } from './gemeinsam.mts';

const TOR = 'G15';

/** Alle Zellen einer Mappe als Text */
function zellen(m: XlsxMappe): Set<string> {
  const s = new Set<string>();
  for (const b of m.blaetter)
    for (const z of b.zeilen)
      for (const w of z) if (w !== null && w !== undefined) s.add(typeof w === 'number' || typeof w === 'boolean' ? String(w) : typeof w === 'object' && !Array.isArray(w) && 'formel' in w ? '' : klartext(w as never).trim());
  return s;
}

/** Skill-Referenzen: gebauter Skill (dist/skill oder im Kit), sonst Quelle */
function skillReferenzen(): string | undefined {
  const kandidaten = [join(REPO, 'dist', 'skill', 'iso42001-kmu', 'references'), ...dateienUnter(join(REPO, 'dist', 'kit'), (p) => p.endsWith('iso42001-kmu/references/controls-42001.md')).map((p) => p.replace(/\/controls-42001\.md$/, ''))];
  return kandidaten.find((k) => existsSync(join(k, 'controls-42001.md')));
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const fehler = (datei: string, meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  const warnung = (datei: string, meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'warnung' });

  const kataloge = ladeKataloge();
  const dokIds = new Set(kataloge.dokumente.dokumente.map((d) => d.id));
  const controls = alleControls42001(kataloge);
  const euaia = ((kataloge['aiact_euaiaControls'] as { controls?: { id: string }[] }).controls ?? []).map((c) => c.id);
  const rmf = (kataloge.nistrmf_rmfControls?.controls ?? []).map((c) => c.id);
  const subkategorien = (kataloge.nistrmf_subkategorien?.subkategorien ?? []).map((s) => s.id);
  if (rmf.length !== 23) fehler('src/nist-rmf/rmf-controls.yaml', `${rmf.length} statt 23 Zusatz-Controls`);
  if (subkategorien.length !== 72) fehler('src/nist-rmf/subkategorien.yaml', `${subkategorien.length} statt 72 Subkategorien`);

  // 1. Kapitel 4 bis 10: verlangte DI hat Vorlagen, die es gibt
  for (const a of alleAbschnitte42001(kataloge)) {
    for (const v of a.vorlagen ?? []) {
      if (!dokIds.has(v)) fehler('src/kataloge/iso42001-anforderungen.yaml', `${a.id}: Vorlage ${v} nicht im Dokumentenkatalog`);
      else if (!VORLAGEN[v]) fehler('src/vorlagen/index.ts', `${a.id}: Vorlage ${v} ohne Vorlagenfunktion`);
    }
    if (a.di !== 'keine' && !(a.vorlagen ?? []).length) fehler('src/kataloge/iso42001-anforderungen.yaml', `${a.id}: dokumentierte Information ohne Vorlage`);
  }

  // 2. Controls: Vorlagen, Texte DE/EN
  const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
  for (const c of controls) {
    if (c.dokumentpflicht && !(c.vorlagen ?? []).length) fehler('src/kataloge/iso42001-controls.yaml', `${c.id}: Dokumentpflicht ohne Vorlage`);
    for (const v of c.vorlagen ?? []) if (!dokIds.has(v)) fehler('src/kataloge/iso42001-controls.yaml', `${c.id}: Vorlage ${v} nicht im Dokumentenkatalog`);
    for (const s of ['de', 'en'] as const) if (!erstelleUebersetzer(s, texte[s]).tOpt(`controls42001.controls.${c.id}.titel`)) fehler(`src/i18n/${s}/controls42001.yaml`, `${c.id}: Kurztitel fehlt`);
  }

  // 3. SoA D-11 (leere Vorlage mit Modul) enthält jedes Control und jedes EUAIA-Control, DE und EN
  for (const s of ['de', 'en'] as const) {
    const u = erstelleUebersetzer(s, texte[s]);
    const projekt = leeresProjekt({ sprache: s, modulAiAct: true, projektId: 'g15' });
    const m = VORLAGEN['D-11']!({ u, modus: 'leer', form: 'dokument', projekt, kataloge, kitVersion: KIT_VERSION }) as XlsxMappe;
    const z = zellen(m);
    for (const id of [...controls.map((c) => c.id), ...euaia]) if (![...z].some((t) => t === id || t.startsWith(`${id} `))) fehler('src/vorlagen/D-11.ts', `SoA ${s.toUpperCase()}: ${id} fehlt`);
  }

  // 3a. Modul NIST AI RMF: SoA D-11 (leer mit Modul) mit allen RMF-xx; N-02 (leer) mit allen Subkategorien und RMF-xx
  for (const s of ['de', 'en'] as const) {
    const u = erstelleUebersetzer(s, texte[s]);
    const projekt = leeresProjekt({ sprache: s, projektId: 'g15' });
    projekt.meta.modulNistRmf = true;
    const ctx = { u, modus: 'leer' as const, form: 'dokument' as const, projekt, kataloge, kitVersion: KIT_VERSION };
    const soa = zellen(VORLAGEN['D-11']!(ctx) as XlsxMappe);
    for (const id of rmf) if (![...soa].includes(id)) fehler('src/vorlagen/D-11.ts', `SoA mit Modul NIST AI RMF ${s.toUpperCase()}: ${id} fehlt`);
    const n02 = VORLAGEN['N-02'];
    if (!n02) {
      fehler('src/vorlagen/index.ts', 'N-02 ohne Vorlagenfunktion');
      continue;
    }
    const z = zellen(n02(ctx) as XlsxMappe);
    for (const id of [...subkategorien, ...rmf]) if (![...z].includes(id)) fehler('src/vorlagen/N-02.ts', `Abdeckungsmatrix ${s.toUpperCase()}: ${id} fehlt`);
    for (const id of ['N-01', 'N-02', 'N-03', 'N-04']) if (!dokIds.has(id) || !VORLAGEN[id]) fehler('src/kataloge/dokumente.yaml', `${id} fehlt im Dokumentenkatalog oder ohne Vorlagenfunktion`);
  }

  // 4. Werkzeug: Katalog im Bundle (src/generiert/kataloge.json wird eingebettet)
  const kj = join(REPO, 'src', 'generiert', 'kataloge.json');
  if (!existsSync(kj)) warnung('src/generiert/kataloge.json', 'fehlt (npx tsx scripts/kataloge.mts)');
  else {
    const text = readFileSync(kj, 'utf8');
    for (const id of [...controls.map((c) => c.id), ...euaia, ...rmf, ...subkategorien, ...alleAbschnitte42001(kataloge).map((a) => a.id)]) if (!text.includes(`"${id}"`)) fehler('src/generiert/kataloge.json', `Werkzeug-Katalog: ${id} fehlt`);
  }

  // 5. Skill: Controls und EUAIA in den Referenzen, Abschnitte mit DI in den Audit-Checklisten
  const ref = skillReferenzen();
  if (!ref) warnung('dist/skill', 'gebauter Skill fehlt (npx tsx scripts/skill.mts)');
  else {
    const c42 = readFileSync(join(ref, 'controls-42001.md'), 'utf8');
    for (const c of controls) if (!new RegExp(`^## ${c.id.replaceAll('.', '\\.')} `, 'm').test(c42)) fehler('skill/references/controls-42001.md', `${c.id} fehlt`);
    const eu = readFileSync(join(ref, 'euaia-controls.md'), 'utf8');
    for (const id of euaia) if (!new RegExp(`^## ${id} `, 'm').test(eu)) fehler('skill/references/euaia-controls.md', `${id} fehlt`);
    // Referenz der RMF-Controls (scripts/skill.mts), falls der gebaute Skill sie enthält
    const rmfRef = join(ref, 'rmf-controls.md');
    if (!existsSync(rmfRef)) warnung('skill/references/rmf-controls.md', 'fehlt (Skill neu bauen: npx tsx scripts/skill.mts)');
    else {
      const rm = readFileSync(rmfRef, 'utf8');
      for (const id of rmf) if (!new RegExp(`^## ${id} `, 'm').test(rm)) fehler('skill/references/rmf-controls.md', `${id} fehlt`);
    }
    const audit = readFileSync(join(ref, 'audit-checklisten.md'), 'utf8');
    for (const a of alleAbschnitte42001(kataloge).filter((x) => x.di !== 'keine')) {
      const nr = a.id.replace(/^K-/, '');
      if (!new RegExp(`\\|[^|\\n]*\\b${nr.replaceAll('.', '\\.')}\\b[^|\\n]*\\|`).test(audit)) fehler('skill/references/audit-checklisten.md', `Abschnitt ${nr} (dokumentierte Information) ohne Prüfpunkt`);
    }
  }

  // 6. Beispielprojekte: SoA-Einträge für alle 38 Controls mit Entscheid
  for (const datei of dateienUnter(join(REPO, 'src', 'beispiele'), (p) => p.endsWith('.aims.json'))) {
    const p = JSON.parse(readFileSync(datei, 'utf8')) as Projekt;
    const ids = new Set(p.controls.filter((c) => c.anwendbar !== 'offen').map((c) => c.id));
    for (const c of controls) if (!ids.has(c.id)) fehler(datei.replace(`${REPO}/`, ''), `${c.id} ohne SoA-Entscheid`);
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);

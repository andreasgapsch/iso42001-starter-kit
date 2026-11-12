// Erzeugt die Browser-Daten des Werkzeugs aus den YAML-Quellen:
// src/generiert/texte.de.json, texte.en.json, kataloge.json, gefuehrt.json, regeln.json
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ladeTexte } from '../src/i18n/laden-node.ts';
import { ladeKataloge } from '../src/kataloge/laden-node.ts';

const ZIEL = 'src/generiert';
mkdirSync(ZIEL, { recursive: true });
const schreibe = (name: string, daten: unknown) => writeFileSync(join(ZIEL, name), JSON.stringify(daten));

/**
 * Das Werkzeug arbeitet offline und enthält keine externen URLs (Tor G7). Quellenangaben aus Katalogen und Texten
 * (DOI, Fundstellen von NIST, OWASP, Amtsblatt) bleiben als Text erhalten, aber ohne Schema: «https://doi.org/10.6028/…»
 * wird zu «doi.org/10.6028/…». So zeigen Werkzeug und daraus erzeugte Dokumente die Quelle ohne Link. Die Vorlagen im Kit
 * (scripts/build.mts) lesen die YAML-Quellen direkt und behalten die vollständigen URLs.
 */
function ohneUrlSchema<T>(wert: T): T {
  if (typeof wert === 'string') return wert.replace(/\bhttps?:\/\//g, '') as T;
  if (Array.isArray(wert)) return wert.map((x) => ohneUrlSchema(x)) as T;
  if (wert && typeof wert === 'object') return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, ohneUrlSchema(v)])) as T;
  return wert;
}

// Faktplatzhalter {{fakt:<id>}} (src/kataloge/fakten.yaml, AF-072) setzt ladeTexte ein; bleibt einer stehen, bricht der Build
for (const s of ['de', 'en'] as const) {
  const texte = ohneUrlSchema(ladeTexte(s));
  const rest = JSON.stringify(texte).match(/\{\{fakt:[^}]*\}\}/g);
  if (rest) throw new Error(`Faktplatzhalter nicht eingesetzt (${s}): ${[...new Set(rest)].join(', ')}`);
  schreibe(`texte.${s}.json`, texte);
}
const kataloge = ohneUrlSchema(ladeKataloge() as Record<string, unknown>);
const seiten = join('src/gefuehrt/seiten');
const gefuehrt = {
  etappen: parse(readFileSync('src/gefuehrt/etappen.yaml', 'utf8')),
  optionen: existsSync('src/gefuehrt/optionen.yaml') ? (parse(readFileSync('src/gefuehrt/optionen.yaml', 'utf8'))?.optionen ?? {}) : {},
  seiten: existsSync(seiten) ? readdirSync(seiten).filter((d) => d.endsWith('.yaml')).sort().flatMap((d) => (parse(readFileSync(join(seiten, d), 'utf8'))?.seiten ?? [])) : [],
};
schreibe('kataloge.json', {
  ...kataloge,
  artikelSeiten: JSON.parse(readFileSync('src/ai-act/artikel-seiten.json', 'utf8')),
  nistrmf_seiten: JSON.parse(readFileSync('src/nist-rmf/seiten.json', 'utf8')),
});
schreibe('gefuehrt.json', gefuehrt);
schreibe('regeln.json', parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')));
console.log('Browser-Daten erzeugt in', ZIEL);

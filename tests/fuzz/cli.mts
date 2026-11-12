// Befehl `npm run fuzz`: Fuzz und Rundreise über alle Ziele ohne Browser.
//   npm run fuzz -- --seed 77123 --faelle 50                 Pflichtteil (Standard)
//   npm run fuzz -- --faelle 500                             Release-Lauf
//   npm run fuzz -- --ziel drawio --seed 77123 --fall 17     genau ein Fall wiederholen
//   npm run fuzz -- --ziel svg-logo --datei tests/fixtures/runde2/eingaben/css_umgehung.svg   eine feste Datei durch ein Ziel schicken
//   npm run fuzz -- --regression                             Dateien früherer Runden und Fall-Dateien der bekannten Funde
//   npm run fuzz -- --klasse alle                            Mutationsklassen (AF-022), eine Klasse mit ihrer Kennung
//   Weitere: --zeitlimit <ms>, --funde-ablegen (Fälle mit Fehler nach tests/fixtures/fuzz), --json <Datei>
import { writeFileSync } from 'node:fs';
import { BEKANNTE_FUNDE } from './bekannte-funde.ts';
import { PFLICHT_FAELLE, STANDARD_SEED } from './kern.ts';
import { laufeZiel, type ZielErgebnis } from './lauf.ts';
import { bewerteRegression, regressionsDateien } from './regression.ts';
import { EINGABEARTEN, type Eingabeart } from './typen.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);
const zahl = (name: string, standard: number): number => {
  const w = arg(name);
  if (w === undefined) return standard;
  const n = Number(w);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} erwartet eine ganze Zahl, nicht «${w}»`);
  return n;
};

const seed = zahl('seed', STANDARD_SEED);
const faelle = zahl('faelle', PFLICHT_FAELLE);
const fall = arg('fall') !== undefined ? zahl('fall', 1) : undefined;
const zeitlimit = arg('zeitlimit') !== undefined ? zahl('zeitlimit', 5000) : undefined;
const ziel = arg('ziel') as Eingabeart | undefined;
const datei = arg('datei');
if (ziel && !EINGABEARTEN.includes(ziel)) throw new Error(`Unbekanntes Ziel «${ziel}». Gültig: ${EINGABEARTEN.join(', ')}`);
if (datei !== undefined && !ziel) throw new Error('--datei braucht --ziel');
const ziele: Eingabeart[] = ziel ? [ziel] : [...EINGABEARTEN];
const reihenfolge: readonly string[] = EINGABEARTEN;

/** Aufgaben mit höchstens drei Arbeitern gleichzeitig (Speicher der VM) */
async function parallel<T>(aufgaben: (() => Promise<T>)[]): Promise<T[]> {
  const aus: T[] = [];
  const warteschlange = [...aufgaben];
  await Promise.all(
    Array.from({ length: Math.min(3, aufgaben.length) }, async () => {
      for (let a = warteschlange.shift(); a; a = warteschlange.shift()) aus.push(await a());
    }),
  );
  return aus;
}

// ---------------------------------------------------------------------------------------------------------------------
// Mutationsklassen (AF-022): eine Klasse oder alle (`--klasse alle`), Varianten wie --faelle (mindestens 50)
const klasse = arg('klasse');
if (klasse !== undefined) {
  const { KLASSEN, MIN_VARIANTEN, klassenFehlerText, laufeKlasse } = await import('./klassen/index.ts');
  const auswahl = klasse === 'alle' ? KLASSEN : KLASSEN.filter((k) => k.id === klasse);
  if (!auswahl.length) throw new Error(`Unbekannte Klasse «${klasse}». Gültig: alle, ${KLASSEN.map((k) => k.id).join(', ')}`);
  let rueckfaelle = 0;
  for (const k of auswahl) {
    const e = await laufeKlasse(k, seed, Math.max(MIN_VARIANTEN, faelle));
    const fehler = [...e.fehler, ...(e.regression.status === 'fehler' ? [e.regression] : [])];
    rueckfaelle += fehler.length;
    console.log(`${k.id.padEnd(28)} ${String(e.varianten).padStart(4)} Varianten, Rückfälle ${fehler.length}, Gegenprobe (Modellwert) ${e.gegenprobe}/${e.varianten}, Regressionsdatei ${e.regression.status}`);
    for (const f of fehler) console.log(`FEHLER ${klassenFehlerText(k, seed, f)}`);
  }
  console.log(`Klassen ${auswahl.length}, Rückfälle ${rueckfaelle}`);
  process.exit(rueckfaelle > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Regressionsmodus: feste Dateien
if (flag('regression')) {
  const liste = regressionsDateien();
  const fehler: string[] = [];
  await parallel(
    liste.map((r) => async () => {
      const e = await laufeZiel({ art: r.art, seed, faelle: 1, datei: r.datei, ...(zeitlimit ? { zeitlimitMs: zeitlimit } : {}) });
      const f = bewerteRegression(r, e);
      if (f) fehler.push(f);
    }),
  );
  for (const f of fehler.sort()) console.log(`FEHLER ${f}`);
  console.log(`Regression: ${liste.length} Dateien, Fehler ${fehler.length}`);
  process.exit(fehler.length > 0 ? 1 : 0);
}

const ergebnisse: ZielErgebnis[] = await parallel(
  ziele.map((art) => () =>
    laufeZiel({
      art,
      seed,
      faelle,
      ...(fall !== undefined ? { nur: fall } : {}),
      ...(datei !== undefined ? { datei } : {}),
      ...(zeitlimit ? { zeitlimitMs: zeitlimit } : {}),
      ...(flag('funde-ablegen') ? { fundeOrdner: 'tests/fixtures/fuzz' } : {}),
    }),
  ),
);
ergebnisse.sort((a, b) => reihenfolge.indexOf(a.art) - reihenfolge.indexOf(b.art));

console.log(`Fuzz, Seed ${seed}, ${datei !== undefined ? `Datei ${datei}` : fall !== undefined ? `Fall ${fall}` : `${faelle} Fälle je Ziel`}`);
console.log('Ziel               Fälle angenommen abgelehnt Fehler Hänger  Zeit');
for (const e of ergebnisse) {
  console.log(`${e.art.padEnd(18)} ${String(e.faelle).padStart(5)} ${String(e.angenommen).padStart(9)} ${String(e.abgelehnt).padStart(9)} ${String(e.fehler).padStart(6)} ${String(e.haenger).padStart(6)} ${(e.ms / 1000).toFixed(1).padStart(5)} s`);
}

// Bekannte Funde (tests/fuzz/bekannte-funde.ts) sind erwartete Fehlschläge mit Paket; sie bleiben in der Zählung, lassen den Befehl
// aber nicht scheitern. Ein Fund gilt nur als bekannt, wenn Ziel, Seed, Nummer und Meldung passen.
const bekannt = (art: string, nummer: number, meldung: string): string | undefined =>
  BEKANNTE_FUNDE.find((f) => f.art === art && f.seed === seed && f.nummer === nummer && meldung.includes(f.meldung))?.paket;
let unbekannt = 0;
let bekannteZahl = 0;
const gesehen = new Set<string>();
for (const e of ergebnisse) {
  for (const f of e.fehlerFaelle) {
    const paket = datei === undefined ? bekannt(e.art, f.nummer, f.meldung ?? '') : undefined;
    if (paket) {
      bekannteZahl++;
      gesehen.add(`${e.art}/${f.nummer}`);
    } else unbekannt++;
    console.log(`${paket ? `BEKANNT (${paket})` : 'FEHLER'} ${f.text}${f.datei ? ` (Datei ${f.datei})` : ''}`);
  }
}
// Veraltete Einträge: Ein bekannter Fund im gelaufenen Bereich, der nicht mehr fehlschlägt, ist behoben und gehört aus der Liste
let veraltet = 0;
if (datei === undefined) {
  for (const f of BEKANNTE_FUNDE) {
    const imBereich = f.seed === seed && ziele.includes(f.art) && (fall !== undefined ? f.nummer === fall : f.nummer <= faelle);
    if (imBereich && !gesehen.has(`${f.art}/${f.nummer}`)) {
      veraltet++;
      console.log(`VERALTET ${f.art} Fall ${f.nummer} (${f.datei}, ${f.paket}): schlägt nicht mehr mit «${f.meldung}» fehl, Eintrag aus tests/fuzz/bekannte-funde.ts entfernen`);
    }
  }
}
const summe = (k: 'fehler' | 'haenger'): number => ergebnisse.reduce((s, e) => s + e[k], 0);
console.log(`Ziele ${ergebnisse.length} von ${EINGABEARTEN.length}, Fehlerfälle ${summe('fehler')}, Hänger ${summe('haenger')}, davon bekannt ${bekannteZahl}, neu ${unbekannt}, veraltete Einträge ${veraltet}`);
const json = arg('json');
if (json) {
  const aus = ergebnisse.map((e): Omit<ZielErgebnis, 'hashes' | 'liste'> => {
    const { hashes: _hashes, liste: _liste, ...rest } = e;
    return rest;
  });
  writeFileSync(json, `${JSON.stringify({ seed, faelle, ergebnisse: aus }, null, 2)}\n`);
}
process.exit(unbekannt > 0 || veraltet > 0 ? 1 : 0);

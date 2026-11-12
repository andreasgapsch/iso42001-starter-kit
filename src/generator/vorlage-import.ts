// Vorschlag aus einer Word-Vorlage der Firma (.dotx/.docx): Designfarben (word/theme/theme1.xml, accent1 bis accent6, dk2),
// Design-Schriften (majorFont/minorFont, lateinisch) und das erste Bild aus einer Kopfzeile. Nur ein Vorschlag zum
// Übernehmen; das Layout der Vorlage wird nicht übernommen. Rein (fflate), läuft im Hauptthread, Worker und in Node.
import { strFromU8 } from 'fflate';
import { GRENZEN } from '../eingang/grenzen.ts';
import { hexNormal } from './farbe.ts';
import { entpackeBegrenzt, ZipGrenzenFehler } from './zip-grenzen.ts';

export type BildFormat = 'png' | 'jpeg' | 'gif' | 'svg' | 'webp';

export interface VorlagenVorschlag {
  /** Designfarben mit Namen aus dem Design (accent1 … accent6, dk2, lt2) */
  farben: { name: string; hex: string }[];
  /** Vorschlag Primär, Sekundär, Akzent: accent1 bis accent3 (fast graue Töne übersprungen) */
  primaer?: string;
  sekundaer?: string;
  akzent?: string;
  schrift?: { titel?: string; text?: string };
  logo?: { daten: Uint8Array; format: BildFormat; name: string };
  /** Kopfzeilenbild in einem Format, das das Werkzeug nicht liest (EMF, WMF, TIFF) */
  logoNichtLesbar?: string;
}

export class VorlagenFehler extends Error {}

const FORMAT: Map<string, BildFormat> = new Map([['png', 'png'], ['jpg', 'jpeg'], ['jpeg', 'jpeg'], ['gif', 'gif'], ['svg', 'svg'], ['webp', 'webp']]);

/** Schutz vor ZIP-Bomben: Grenzen aus den Kopfdaten, vor dem Entpacken (je Teil, Summe, Zahl der Einträge) */
const MAX_TEIL = GRENZEN['word-vorlage'].maxTeil;
const MAX_SUMME = GRENZEN['word-vorlage'].maxEntpackt;
const MAX_EINTRAEGE = GRENZEN['word-vorlage'].maxEintraege;
/** Grösser ist kein Design und keine Kopfzeile: nicht auswerten (auch Schutz vor Rechenaufwand) */
const MAX_XML = 2 * 1024 * 1024;

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Inhalt des ersten Elements: linear über indexOf, ohne Regex über den ganzen Text */
function innenVon(xml: string, element: string): string | undefined {
  const auf = xml.indexOf(`<${element}>`);
  if (auf < 0) return undefined;
  const zu = xml.indexOf(`</${element}>`, auf);
  return zu < 0 ? undefined : xml.slice(auf + element.length + 2, zu);
}

/** Alle öffnenden Tags eines Elements: linear, Tags ohne Ende werden nicht weiter gesucht */
function tags(xml: string, element: string): string[] {
  const aus: string[] = [];
  const kopf = `<${element}`;
  for (let i = xml.indexOf(kopf); i >= 0; i = xml.indexOf(kopf, i + kopf.length)) {
    const ende = xml.indexOf('>', i);
    if (ende < 0) break;
    aus.push(xml.slice(i, ende + 1));
  }
  return aus;
}

/** Farbe eines Designfarbe-Elements: srgbClr val oder sysClr lastClr */
function designfarbe(xml: string, name: string): string | undefined {
  const m = innenVon(xml, `a:${name}`);
  if (m === undefined) return undefined;
  const srgb = tags(m, 'a:srgbClr').map((t) => attr(t, 'val')).find((w) => w && /^[0-9A-Fa-f]{6}$/.test(w));
  const sys = tags(m, 'a:sysClr').map((t) => attr(t, 'lastClr')).find((w) => w && /^[0-9A-Fa-f]{6}$/.test(w));
  return hexNormal(srgb ?? sys);
}

function bunt(hex: string): boolean {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(r!, g!, b!) - Math.min(r!, g!, b!) > 24;
}

/** Ziel einer Beziehung relativ zum Teil auflösen (word/header1.xml + media/image1.png -> word/media/image1.png) */
function aufloesen(von: string, ziel: string): string {
  if (ziel.startsWith('/')) return ziel.slice(1);
  const teile = von.split('/').slice(0, -1);
  for (const s of ziel.split('/')) {
    if (s === '..') teile.pop();
    else if (s !== '.') teile.push(s);
  }
  return teile.join('/');
}

export function ausWordVorlage(daten: Uint8Array): VorlagenVorschlag {
  let teile: Record<string, Uint8Array>;
  try {
    teile = entpackeBegrenzt(daten, {
      maxBytes: MAX_SUMME,
      maxEintraege: MAX_EINTRAEGE,
      maxTeil: MAX_TEIL,
      waehlen: (n) => /^word\/(theme\/theme\d*\.xml|header\d*\.xml|_rels\/header\d*\.xml\.rels|_rels\/document\.xml\.rels|document\.xml)$/.test(n) || /^word\/media\//.test(n),
    });
  } catch (e) {
    throw new VorlagenFehler(e instanceof ZipGrenzenFehler && e.art !== 'lesbar' ? 'Word-Datei zu gross oder unzulässig aufgebaut' : 'Keine Word-Datei (ZIP nicht lesbar)');
  }
  if (!teile['word/document.xml']) throw new VorlagenFehler('Keine Word-Datei (word/document.xml fehlt)');
  const v: VorlagenVorschlag = { farben: [] };
  const themaPfad = Object.keys(teile).filter((p) => p.startsWith('word/theme/')).sort()[0];
  if (themaPfad && teile[themaPfad]!.length <= MAX_XML) {
    const xml = strFromU8(teile[themaPfad]!);
    for (const name of ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'dk2', 'lt2']) {
      const hex = designfarbe(xml, name);
      if (hex) v.farben.push({ name, hex });
    }
    const akzente = v.farben.filter((f) => f.name.startsWith('accent') && bunt(f.hex)).map((f) => f.hex);
    const dk2 = v.farben.find((f) => f.name === 'dk2' && bunt(f.hex))?.hex;
    [v.primaer, v.sekundaer, v.akzent] = [...(dk2 && akzente.length < 3 ? [...akzente, dk2] : akzente)];
    if (!v.primaer) delete v.primaer;
    if (!v.sekundaer) delete v.sekundaer;
    if (!v.akzent) delete v.akzent;
    const schrift = (art: 'major' | 'minor') => tags(innenVon(xml, `a:${art}Font`) ?? '', 'a:latin').map((t) => attr(t, 'typeface')).find(Boolean)?.trim();
    const titel = schrift('major');
    const text = schrift('minor');
    if (titel || text) v.schrift = { ...(titel ? { titel } : {}), ...(text ? { text } : {}) };
  }
  // Kopfzeilen in Reihenfolge der Nummer; erstes Bild (SVG vor dem PNG-Ersatz, wenn Word beide speichert)
  const koepfe = Object.keys(teile)
    .filter((p) => /^word\/header\d*\.xml$/.test(p))
    .sort((a, b) => Number(/(\d*)\.xml$/.exec(a)![1] || 0) - Number(/(\d*)\.xml$/.exec(b)![1] || 0));
  for (const kopf of koepfe) {
    if (teile[kopf]!.length > MAX_XML) continue;
    const xml = strFromU8(teile[kopf]!);
    const relsPfad = kopf.replace(/^word\//, 'word/_rels/') + '.rels';
    const rels = teile[relsPfad] && teile[relsPfad]!.length <= MAX_XML ? strFromU8(teile[relsPfad]!) : '';
    const ziel = new Map(tags(rels, 'Relationship').map((m) => [attr(m, 'Id') ?? '', attr(m, 'Target') ?? '']));
    const ids = [
      ...tags(xml, 'asvg:svgBlip').map((m) => attr(m, 'r:embed')),
      ...tags(xml, 'a:blip').map((m) => attr(m, 'r:embed')),
      ...tags(xml, 'v:imagedata').map((m) => attr(m, 'r:id')),
    ].filter((x): x is string => !!x);
    for (const id of ids) {
      const t = ziel.get(id);
      if (!t) continue;
      const pfad = aufloesen(kopf, t);
      const endung = (/\.([a-z0-9]+)$/i.exec(pfad)?.[1] ?? '').toLowerCase();
      const format = FORMAT.get(endung);
      const bytes = Object.hasOwn(teile, pfad) ? teile[pfad] : undefined;
      if (!bytes) continue;
      if (!format) {
        v.logoNichtLesbar ??= endung.toUpperCase();
        continue;
      }
      v.logo = { daten: bytes, format, name: pfad.split('/').pop()! };
      return v;
    }
  }
  return v;
}

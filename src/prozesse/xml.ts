// Kleiner, verlustfreier XML-Leser und -Schreiber ohne DOM (Generator-Worker, Vitest, Trusted Types). Der Baum behält
// Reihenfolge, Attributreihenfolge, Anführungszeichen, Leerraum, Kommentare, CDATA, Verarbeitungsanweisungen und die
// XML-Deklaration: serialisiere(parseXml(x)) === x für wohlgeformte Eingaben. Schutz: keine DTD, nur die fünf
// Standard-Entitäten und Zeichenreferenzen, Grössen- und Tiefengrenze.
import { XML_MAX_TIEFE } from '../eingang/grenzen.ts';

/** Höchste Verschachtelung (Konfiguration des Eingangsmoduls), für Spezifikation und Tests */
export { XML_MAX_TIEFE };
import { xmlBereinigen } from '../generator/xml-zeichen.ts';

export type XmlFehlerCode = 'zu-gross' | 'kein-xml' | 'dtd' | 'entitaet' | 'tiefe';

export class XmlFehler extends Error {
  constructor(
    readonly code: XmlFehlerCode,
    meldung: string,
  ) {
    super(meldung);
  }
}

export interface XmlAttribut {
  name: string;
  /** dekodierter Wert */
  wert: string;
  /** Rohtext mit führendem Leerraum, Name, Gleichheitszeichen und Anführungszeichen */
  roh: string;
}

export interface XmlElement {
  art: 'element';
  name: string;
  attribute: XmlAttribut[];
  kinder: XmlKnoten[];
  /** selbstschliessend (<x/>) */
  leer: boolean;
  /** Leerraum nach dem letzten Attribut vor > bzw. /> */
  kopfEnde: string;
  /** schliessendes Tag roh (</x>), leer bei selbstschliessenden Elementen */
  schluss: string;
}

export interface XmlText {
  art: 'text';
  roh: string;
}

export interface XmlSonst {
  art: 'kommentar' | 'cdata' | 'pi';
  roh: string;
}

export type XmlKnoten = XmlElement | XmlText | XmlSonst;

export interface XmlDokument {
  kinder: XmlKnoten[];
}

export interface XmlOptionen {
  /** höchstens so viele Zeichen (Standard 2 MB) */
  maxZeichen?: number;
  /** höchste Verschachtelung (Standard 200) */
  maxTiefe?: number;
}

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const ATTRIBUT = /(\s+)([A-Za-z_:][-A-Za-z0-9_:.]*)(\s*=\s*)("([^"]*)"|'([^']*)')/y;
const ENTITAET = /&(?:(lt|gt|amp|quot|apos)|#(\d+)|#x([0-9a-fA-F]+));/y;
const STANDARD: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Text mit Entitäten dekodieren; unbekannte Entitäten und lose & sind Fehler (Schutz gegen Entitätsbomben) */
export function dekodiere(roh: string): string {
  if (!roh.includes('&')) return roh;
  let aus = '';
  let i = 0;
  for (;;) {
    const j = roh.indexOf('&', i);
    if (j < 0) return aus + roh.slice(i);
    aus += roh.slice(i, j);
    ENTITAET.lastIndex = j;
    const m = ENTITAET.exec(roh);
    if (!m) throw new XmlFehler('entitaet', `Unbekannte Entität bei ${roh.slice(j, j + 12)}`);
    if (m[1]) aus += STANDARD[m[1]];
    else {
      const cp = m[2] ? Number(m[2]) : parseInt(m[3]!, 16);
      if (!(cp > 0 && cp <= 0x10ffff) || (cp >= 0xd800 && cp <= 0xdfff)) throw new XmlFehler('entitaet', `Ungültige Zeichenreferenz ${m[0]}`);
      aus += String.fromCodePoint(cp);
    }
    i = j + m[0].length;
  }
}

export const maskiereText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const maskiereAttr = (s: string, q = '"'): string =>
  maskiereText(xmlBereinigen(s)).replace(q === '"' ? /"/g : /'/g, q === '"' ? '&quot;' : '&apos;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');

export function parseXml(text: string, o: XmlOptionen = {}): XmlDokument {
  const max = o.maxZeichen ?? 2 * 1024 * 1024;
  const maxTiefe = o.maxTiefe ?? XML_MAX_TIEFE;
  if (text.length > max) throw new XmlFehler('zu-gross', `Datei grösser als ${max} Zeichen`);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new XmlFehler('dtd', 'DTD und eigene Entitäten sind nicht erlaubt');
  const dok: XmlDokument = { kinder: [] };
  const stapel: XmlElement[] = [];
  const ziel = (): XmlKnoten[] => stapel.at(-1)?.kinder ?? dok.kinder;
  const bis = (i: number, ende: string, was: string): number => {
    const j = text.indexOf(ende, i);
    if (j < 0) throw new XmlFehler('kein-xml', `${was} nicht abgeschlossen`);
    return j + ende.length;
  };
  let elemente = 0;
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt !== i) {
      const ende = lt < 0 ? text.length : lt;
      const roh = text.slice(i, ende);
      dekodiere(roh);
      if (!stapel.length && roh.trim()) throw new XmlFehler('kein-xml', 'Text ausserhalb des Wurzelelements');
      ziel().push({ art: 'text', roh });
      i = ende;
      continue;
    }
    if (text.startsWith('<!--', i)) {
      const e = bis(i + 4, '-->', 'Kommentar');
      ziel().push({ art: 'kommentar', roh: text.slice(i, e) });
      i = e;
    } else if (text.startsWith('<![CDATA[', i)) {
      const e = bis(i + 9, ']]>', 'CDATA');
      ziel().push({ art: 'cdata', roh: text.slice(i, e) });
      i = e;
    } else if (text.startsWith('<?', i)) {
      const e = bis(i + 2, '?>', 'Verarbeitungsanweisung');
      ziel().push({ art: 'pi', roh: text.slice(i, e) });
      i = e;
    } else if (text.startsWith('</', i)) {
      const e = bis(i + 2, '>', 'Schliessendes Tag');
      const name = text.slice(i + 2, e - 1).trim();
      const el = stapel.pop();
      if (!el || el.name !== name) throw new XmlFehler('kein-xml', `Unerwartetes </${name}>`);
      el.schluss = text.slice(i, e);
      i = e;
    } else if (text[i + 1] === '!') {
      throw new XmlFehler('dtd', 'Deklarationen sind nicht erlaubt');
    } else {
      NAME.lastIndex = i + 1;
      const n = NAME.exec(text);
      if (!n) throw new XmlFehler('kein-xml', `Ungültiges Tag an Stelle ${i}`);
      let p = i + 1 + n[0].length;
      const attribute: XmlAttribut[] = [];
      for (;;) {
        ATTRIBUT.lastIndex = p;
        const a = ATTRIBUT.exec(text);
        if (!a) break;
        if (attribute.some((x) => x.name === a[2])) throw new XmlFehler('kein-xml', `Attribut ${a[2]} doppelt`);
        attribute.push({ name: a[2]!, wert: dekodiere(a[5] ?? a[6] ?? ''), roh: a[0] });
        p += a[0].length;
      }
      const rest = /\s*/y;
      rest.lastIndex = p;
      const ws = rest.exec(text)![0];
      p += ws.length;
      const leer = text.startsWith('/>', p);
      if (!leer && text[p] !== '>') throw new XmlFehler('kein-xml', `Tag <${n[0]}> nicht lesbar`);
      const el: XmlElement = { art: 'element', name: n[0], attribute, kinder: [], leer, kopfEnde: ws, schluss: '' };
      ziel().push(el);
      if (++elemente > 500_000) throw new XmlFehler('zu-gross', 'Zu viele Elemente');
      if (!leer) {
        stapel.push(el);
        if (stapel.length > maxTiefe) throw new XmlFehler('tiefe', `Verschachtelung tiefer als ${maxTiefe}`);
      }
      i = p + (leer ? 2 : 1);
    }
  }
  if (stapel.length) throw new XmlFehler('kein-xml', `<${stapel.at(-1)!.name}> nicht geschlossen`);
  if (!dok.kinder.some((k) => k.art === 'element')) throw new XmlFehler('kein-xml', 'Kein XML-Element gefunden');
  return dok;
}

/** Öffnendes Tag roh */
export function kopfText(e: XmlElement): string {
  return `<${e.name}${e.attribute.map((a) => a.roh).join('')}${e.kopfEnde}${e.leer ? '/>' : '>'}`;
}

export function serialisiere(k: XmlDokument | XmlKnoten | readonly XmlKnoten[]): string {
  if (Array.isArray(k)) return k.map((x) => serialisiere(x)).join('');
  if ('art' in (k as XmlKnoten)) {
    const x = k as XmlKnoten;
    if (x.art !== 'element') return x.roh;
    return x.leer ? kopfText(x) : `${kopfText(x)}${serialisiere(x.kinder)}${x.schluss || `</${x.name}>`}`;
  }
  return serialisiere((k as XmlDokument).kinder);
}

export const istElement = (k: XmlKnoten | undefined): k is XmlElement => k?.art === 'element';
export const wurzel = (d: XmlDokument): XmlElement | undefined => d.kinder.find(istElement);
export const elemente = (e: XmlElement | XmlDokument, name?: string): XmlElement[] => e.kinder.filter((k): k is XmlElement => istElement(k) && (!name || k.name === name));
export const kind = (e: XmlElement | undefined, name: string): XmlElement | undefined => (e ? elemente(e, name)[0] : undefined);
export const attr = (e: XmlElement | undefined, name: string): string | undefined => e?.attribute.find((a) => a.name === name)?.wert;

/** Setzt ein Attribut; bestehende behalten Stelle, Leerraum und Anführungszeichen, neue kommen ans Ende. Gleicher Wert: unverändert. */
export function setzeAttr(e: XmlElement, name: string, wert: string): void {
  const a = e.attribute.find((x) => x.name === name);
  if (a) {
    if (a.wert === wert) return;
    const m = /^(\s+[^=\s]+\s*=\s*)(["'])/.exec(a.roh)!;
    a.wert = wert;
    a.roh = `${m[1]}${m[2]}${maskiereAttr(wert, m[2])}${m[2]}`;
  } else e.attribute.push({ name, wert, roh: ` ${name}="${maskiereAttr(wert)}"` });
}

export function entferneAttr(e: XmlElement, name: string): void {
  e.attribute = e.attribute.filter((a) => a.name !== name);
}

/** Textinhalt (dekodiert, mit CDATA) eines Elements und seiner Kinder */
export function textInhalt(e: XmlElement): string {
  return e.kinder.map((k) => (k.art === 'text' ? dekodiere(k.roh) : k.art === 'cdata' ? k.roh.slice(9, -3) : k.art === 'element' ? textInhalt(k) : '')).join('');
}

/** Element aus Name, Attributen und Kindern (für neue Knoten) */
export function neuesElement(name: string, attribute: [string, string][], kinder: XmlKnoten[] = []): XmlElement {
  return { art: 'element', name, attribute: attribute.map(([n, w]) => ({ name: n, wert: w, roh: ` ${n}="${maskiereAttr(w)}"` })), kinder, leer: !kinder.length, kopfEnde: '', schluss: kinder.length ? `</${name}>` : '' };
}

/** Für Vergleiche: Kopie ohne Text aus reinem Leerraum, Attribute als Name und Wert, ohne Rohformen */
export function normalisiere(k: XmlDokument | XmlKnoten): unknown {
  if ('art' in k) {
    if (k.art === 'element')
      return { n: k.name, a: k.attribute.map((a) => [a.name, a.wert]), k: k.kinder.filter((x) => !(x.art === 'text' && !x.roh.trim())).map((x) => normalisiere(x)) };
    return k.art === 'text' ? dekodiere(k.roh) : k.roh;
  }
  return k.kinder.filter((x) => !(x.art === 'text' && !x.roh.trim())).map((x) => normalisiere(x));
}

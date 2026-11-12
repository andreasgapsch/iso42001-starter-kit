// Daten des Bereichs Wissen im AIMS-Manager (R5): Kapitel des Leitfadens (src/leitfaden/<sprache>/*.md mit denselben
// Bausteinen wie die Druckfassung) und die Auszüge aus dem EU AI Act (src/ai-act/auszuege/<sprache>/*.md).
// Das Werkzeug setzt kein innerHTML (Trusted Types): Markdown und Bausteine werden hier zu einem kompakten Baum
// [tag, attribute | 0, ...kinder] umgewandelt, den src/app/ui/Baum.tsx mit Preact zeichnet. Abbildungen (SVG) bleiben der
// Druckfassung vorbehalten; an ihrer Stelle steht ihr Titel mit Hinweis. Adressen ohne Schema (offline, Tor G7).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { parse } from 'yaml';
import { ersetzeBausteine, ladeDaten, leitfadenOrdner, REPO, type Sprache } from './leitfaden.mts';

export type Knoten = string | [string, Record<string, string> | 0, ...Knoten[]];

export interface KapitelInfo {
  id: string;
  titel: string;
  abschnitte: { id: string; titel: string }[];
}

export interface AiActAuszug {
  id: string;
  titel: string;
  umfang: string;
  seiten: string;
  quelle: string;
  fassung: string;
  hinweis: string;
  knoten: Knoten[];
}

export interface WissenDaten {
  kapitel: Record<Sprache, KapitelInfo[]>;
  leitfaden: Record<Sprache, Record<string, Knoten[]>>;
  aiact: Record<Sprache, AiActAuszug[]>;
}

const ERLAUBT = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br', 'hr', 'span', 'sup', 'sub', 'dl', 'dt', 'dd', 'a', 'caption',
]);
const LEER = new Set(['br', 'hr', 'img', 'col', 'wbr']);
const ATTRIBUTE = new Set(['id', 'class', 'colspan', 'rowspan', 'href']);

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
export function entitaeten(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITAETEN[e.toLowerCase()] ?? m;
  });
}

const ohneSchema = (s: string) => s.replace(/\bhttps?:\/\//g, '');

/**
 * Wandelt wohlgeformtes HTML (Ausgabe von markdown-it und der Bausteine) in Knoten. Unbekannte Elemente werden durch
 * ihre Kinder ersetzt; <figure> wird zu ["abb", {titel}] (Titel aus figcaption); <svg>, <style>, <script> entfallen.
 */
export function htmlZuKnoten(html: string): Knoten[] {
  const wurzel: [string, Record<string, string> | 0, ...Knoten[]] = ['#', 0];
  const stapel: [string, Record<string, string> | 0, ...Knoten[]][] = [wurzel];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let ueberspringen = 0;
  let figur: { tiefe: number; titel: string; inCaption: boolean } | null = null;
  for (const m of html.matchAll(re)) {
    const [ganz, zu, auf, attrs, selbst, text] = m;
    if (ganz.startsWith('<!--')) continue;
    if (auf) {
      const tag = auf.toLowerCase();
      if (ueberspringen) {
        if (tag === 'svg' || tag === 'style' || tag === 'script') ueberspringen++;
        continue;
      }
      if (tag === 'svg' || tag === 'style' || tag === 'script') {
        if (!selbst) ueberspringen = 1;
        continue;
      }
      if (tag === 'figure') {
        figur = { tiefe: 1, titel: '', inCaption: false };
        continue;
      }
      if (figur) {
        if (tag === 'figcaption') figur.inCaption = true;
        else if (!LEER.has(tag) && !selbst) figur.tiefe++;
        continue;
      }
      if (!ERLAUBT.has(tag)) continue;
      const a: Record<string, string> = {};
      for (const x of (attrs ?? '').matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const name = x[1]!.toLowerCase();
        const wert = entitaeten(x[2] ?? x[3] ?? x[4] ?? '');
        if (!ATTRIBUTE.has(name)) continue;
        if (name === 'href' && !wert.startsWith('#')) continue;
        a[name] = wert;
      }
      const knoten: [string, Record<string, string> | 0, ...Knoten[]] = [tag, Object.keys(a).length ? a : 0];
      stapel.at(-1)!.push(knoten);
      if (!LEER.has(tag) && !selbst) stapel.push(knoten);
    } else if (zu) {
      const tag = zu.toLowerCase();
      if (ueberspringen) {
        if (tag === 'svg' || tag === 'style' || tag === 'script') ueberspringen--;
        continue;
      }
      if (figur) {
        if (tag === 'figcaption') figur.inCaption = false;
        else if (tag === 'figure' || !LEER.has(tag)) figur.tiefe--;
        if (figur.tiefe === 0) {
          stapel.at(-1)!.push(['abb', { titel: figur.titel.replace(/\s+/g, ' ').trim() }]);
          figur = null;
        }
        continue;
      }
      if (!ERLAUBT.has(tag)) continue;
      // Schliessen bis zum passenden offenen Element (tolerant gegenüber fehlenden Endtags)
      const i = stapel.map((k) => k[0]).lastIndexOf(tag);
      if (i > 0) stapel.length = i;
    } else if (text) {
      if (ueberspringen) continue;
      const t = ohneSchema(entitaeten(text));
      if (figur) {
        if (figur.inCaption) figur.titel += t;
        continue;
      }
      // Reine Zeilenumbrüche zwischen Blöcken entfallen
      if (!t.trim() && t.includes('\n')) continue;
      const ziel = stapel.at(-1)!;
      const letzt = ziel.at(-1);
      if (ziel.length > 2 && typeof letzt === 'string') ziel[ziel.length - 1] = letzt + t;
      else ziel.push(t);
    }
  }
  return wurzel.slice(2) as Knoten[];
}

function slug(text: string, vergeben: Set<string>): string {
  let s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'abschnitt';
  const basis = s;
  for (let i = 2; vergeben.has(s); i++) s = `${basis}-${i}`;
  vergeben.add(s);
  return s;
}

/** Markdown zu HTML mit IDs an den Überschriften; ohne automatische Links (offline). */
export function markdownHtml(md: string): { html: string; ueberschriften: { ebene: number; text: string; id: string }[] } {
  const mdi = new MarkdownIt({ html: true, linkify: false, typographer: false });
  const ueberschriften: { ebene: number; text: string; id: string }[] = [];
  const vergeben = new Set<string>();
  mdi.core.ruler.push('ueberschrift-ids', (state) => {
    for (let i = 0; i < state.tokens.length; i++) {
      const tok = state.tokens[i]!;
      if (tok.type !== 'heading_open') continue;
      const text = (state.tokens[i + 1]?.children ?? []).map((c) => c.content).join('') || state.tokens[i + 1]?.content || '';
      const id = slug(text, vergeben);
      tok.attrSet('id', id);
      ueberschriften.push({ ebene: Number(tok.tag.slice(1)), text, id });
    }
  });
  return { html: mdi.render(md), ueberschriften };
}

function leitfaden(sprache: Sprache): { kapitel: KapitelInfo[]; inhalt: Record<string, Knoten[]> } {
  const d = ladeDaten(sprache);
  const ordner = leitfadenOrdner(sprache);
  const kapitel: KapitelInfo[] = [];
  const inhalt: Record<string, Knoten[]> = {};
  d.abbNr = 0;
  for (const datei of d.t.kapitel as string[]) {
    const id = datei.slice(0, 2);
    const md = ersetzeBausteine(readFileSync(join(ordner, datei), 'utf8'), d);
    const { html, ueberschriften } = markdownHtml(md);
    const h1 = ueberschriften.find((u) => u.ebene === 1);
    kapitel.push({ id, titel: h1?.text ?? id, abschnitte: ueberschriften.filter((u) => u.ebene === 2).map((u) => ({ id: u.id, titel: u.text })) });
    inhalt[id] = htmlZuKnoten(html);
  }
  return { kapitel, inhalt };
}

function aiact(sprache: Sprache): AiActAuszug[] {
  const ordner = join(REPO, 'src', 'ai-act', 'auszuege', sprache);
  return readdirSync(ordner)
    .filter((d) => d.endsWith('.md'))
    .sort()
    .map((datei) => {
      const roh = readFileSync(join(ordner, datei), 'utf8');
      const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(roh);
      if (!m) throw new Error(`Auszug ohne Kopf: ${datei}`);
      const kopf = parse(m[1]!) as Record<string, string>;
      return {
        id: datei.replace(/\.md$/, ''),
        titel: kopf['auszug'] ?? datei,
        umfang: kopf['umfang'] ?? '',
        seiten: String(kopf['seiten_pdf'] ?? ''),
        quelle: kopf['quelle'] ?? '',
        fassung: kopf['fassung'] ?? '',
        hinweis: kopf['hinweis'] ?? '',
        knoten: htmlZuKnoten(markdownHtml(m[2]!).html),
      };
    });
}

export function baueWissen(): WissenDaten {
  const de = leitfaden('de');
  const en = leitfaden('en');
  return {
    kapitel: { de: de.kapitel, en: en.kapitel },
    leitfaden: { de: de.inhalt, en: en.inhalt },
    aiact: { de: aiact('de'), en: aiact('en') },
  };
}

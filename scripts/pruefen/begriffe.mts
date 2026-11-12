// Tor G43 Begriffe (AF-134, QK-74): Fachbegriffe werden dort erklärt, wo sie zum ersten Mal vorkommen.
// Grundlage ist die Begriffsliste: alle Einträge von src/kataloge/glossar.yaml mit `liste: true`. Je Sprache gehören dazu
// in src/i18n/<sprache>/glossar.yaml die Kurzerklärung `kurz` (höchstens 20 Wörter, eigene Worte, W16) und `formen`
// (Schreibweisen, durch | getrennt). Das Tor prüft:
//   1. Jeder Eintrag der Liste hat in DE und EN `kurz` (höchstens 20 Wörter) und `formen`.
//   2. Erstnennung je Text: Das erste Vorkommen eines Begriffs braucht eine Erklärung oder einen Glossar-Verweis. Geprüfte
//      Texte: die Seite START (Texte im Datenblock, in Reihenfolge des Markups im Hauptteil), Kapitel 1 des Leitfadens
//      (src/leitfaden/<sprache>/01-minimal-viable-aims.md, ohne Überschriften) und je Seite des Guides
//      (src/i18n/<sprache>/gefuehrt/*.yaml, ein Schlüssel der obersten Ebene ist eine Seite).
// Als erklärt gilt ein Vorkommen, wenn (a) es innerhalb von [[g:id]] steht, (b) unmittelbar danach eine Klammer mit
// mindestens drei Wörtern, ein Einschub («, also …», «, das …», «, the …»), eine Definition («ist», «steht für», «is», «means»)
// oder (c) ein Verweis auf das Glossar im Satz steht. Der folgende Satz zählt mit, damit eine
// Erklärung auch als eigener Satz folgen darf. Die Heuristik ist bewusst einfach; sie ersetzt keine Durchsicht (AF-135).
// Guide-Seiten (AF-135): Fehler. Seitentitel und Feldbezeichnungen (Schlüssel titel, label) zählen wie Überschriften nicht als Erstnennung;
// der Begriff wird in Frage, Warum, Fehlerhinweis oder Feldhilfe der Seite mit [[g:id|Text]] erklärt (Tooltip, Liste «Begriffe»).
// Hinweis (W16, kein hartes Tor): Sätze mit mehr als LANGER_SATZ Wörtern in START und Kapitel 1 erscheinen als Warnung
// (Ausreisserliste); der Fachbegriff bleibt, er wird erklärt.
// Aufruf: npx tsx scripts/pruefen/begriffe.mts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';

const TOR = 'G43';
export const MAX_WOERTER_KURZ = 20;
export const LANGER_SATZ = 35;
const SPRACHEN = ['de', 'en'] as const;
export type Sprache = (typeof SPRACHEN)[number];

export interface Begriff {
  id: string;
  /** Anzeigename aus dem Glossar (für [[g:id]]) */
  begriff: string;
  kurz: string;
  formen: string[];
}

interface GlossarEintrag {
  begriff?: string;
  kurz?: string;
  formen?: string;
}

/** Texteinheit: Zeilen in Lesereihenfolge; Datei und Zeilennummer für die Meldung. */
export interface Text {
  name: string;
  datei: string;
  /** roh: Wortlaut für Hinweise zur Lesbarkeit, wenn text für die Prüfung umgeformt ist (Tabellenzeilen) */
  zeilen: { text: string; zeile?: number; roh?: string }[];
  /** Überschriften der Seite (titel, label): zählen nicht als Erstnennung, der Begriff braucht aber irgendwo im Text eine Erklärung */
  kopf?: string[];
}

const lies = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

/** Einträge der Begriffsliste einer Sprache; fehlende Pflichtfelder meldet `pruefeListe`. */
export function ladeBegriffe(sprache: Sprache, katalog?: string, texte?: string): { liste: Begriff[]; befunde: Befund[] } {
  const kat = parse(katalog ?? lies('src/kataloge/glossar.yaml')) as { begriffe: { id: string; liste?: boolean }[] };
  const tx = parse(texte ?? lies(`src/i18n/${sprache}/glossar.yaml`)) as Record<string, GlossarEintrag>;
  const datei = `src/i18n/${sprache}/glossar.yaml`;
  const liste: Begriff[] = [];
  const befunde: Befund[] = [];
  for (const b of kat.begriffe.filter((e) => e.liste)) {
    const t = tx[b.id];
    if (!t?.kurz || !t.formen) {
      befunde.push({ tor: TOR, datei, meldung: `Begriffsliste «${b.id}»: kurz und formen fehlen in ${sprache.toUpperCase()}`, schwere: 'fehler' });
      continue;
    }
    const woerter = t.kurz.trim().split(/\s+/).length;
    if (woerter > MAX_WOERTER_KURZ) {
      befunde.push({ tor: TOR, datei, meldung: `Begriffsliste «${b.id}»: Kurzerklärung hat ${woerter} Wörter, höchstens ${MAX_WOERTER_KURZ}`, schwere: 'fehler' });
    }
    liste.push({ id: b.id, begriff: t.begriff ?? b.id, kurz: t.kurz, formen: t.formen.split('|').map((f) => f.trim()).filter(Boolean) });
  }
  return { liste, befunde };
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Abkürzungen, nach denen kein Satz endet. */
const ABKUERZUNGEN = /\b(?:z\.\s?B|d\.\s?h|u\.\s?a|u\.\s?U|bzw|ca|vgl|Art|Nr|Abs|inkl|ggf|usw|etc|e\.\s?g|i\.\s?e|approx|incl|cf|No|vs)\./g;

/** Zerlegt eine Zeile in Sätze (Ende bei . ! ? vor Leerzeichen und Grossbuchstabe, Zahl oder Anführungszeichen). */
export function saetze(zeile: string): string[] {
  const geschuetzt = zeile.replace(ABKUERZUNGEN, (m) => m.replace(/\./g, '\u0001'));
  return geschuetzt
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9‘“«(\[*])/u)
    .map((s) => s.replace(/\u0001/g, '.').trim())
    .filter(Boolean);
}

/** Entfernt Auszeichnung: **fett**, `code`, Links; [[g:id|Anzeige]] bleibt als Marke erhalten. */
function bereinige(zeile: string): string {
  return zeile
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\((?!#)[^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const DEFINITION = new RegExp(
  [
    String.raw`^\s{0,3}\(\s*[^()]*\S+\s+\S+\s+\S+[^()]*\)`, // Klammer mit mindestens drei Wörtern
    String.raw`^[^.!?]{0,40}?,\s*(?:also|das|die|der|ein|eine|dem|den|englisch|d\.\s?h\.|that is|i\.\s?e\.|which|the|a|an)\s`,
    String.raw`^[^.!?]{0,12}?\s(?:ist|sind|heisst|bedeutet|steht für|is|are|means|stands for)\s`,
  ].join('|'),
  'iu',
);

const GLOSSAR_HINWEIS = /\b(?:Glossar|glossary)\b/i;

/** Allgemeine Wortverwendungen, die keine Nennung des Fachbegriffs sind (zum Beispiel «document control», «under control»). */
export const AUSSCHLUSS: Record<string, { vor?: RegExp; nach?: RegExp }> = {
  control: {
    vor: /\b(?:machine|operation and|document|export|access|quality|version|change|risk|internal|configuration|source|process|inventory|financial|statistical|under(?:\s+(?:their|your|its|our|the))?|out of|in|take|keep|have|lose|you|they|we)\s+$/i,
    nach: /^\s+(?:of|over)\b/i,
  },
};

/** Überlappungsfreie Treffer aller Begriffe in einer bereinigten Zeile (längster Treffer zuerst). */
export function treffer(zeile: string, liste: Begriff[]): { id: string; von: number; bis: number; verweis: boolean }[] {
  const alle: { id: string; von: number; bis: number; verweis: boolean }[] = [];
  // [[g:id|Anzeige]] und [[g:id]]: Verweis auf das Glossar
  const verweise = [...zeile.matchAll(/\[\[g:([\w-]+)(?:\|([^\]]+))?\]\]/g)];
  let text = zeile;
  const ersetzt: { von: number; bis: number; id: string }[] = [];
  let versatz = 0;
  for (const m of verweise) {
    const b = liste.find((x) => x.id === m[1]);
    const anzeige = m[2] ?? b?.begriff ?? m[1]!;
    const von = m.index! + versatz;
    text = text.slice(0, von) + anzeige + text.slice(von + m[0].length);
    ersetzt.push({ von, bis: von + anzeige.length, id: m[1]! });
    versatz += anzeige.length - m[0].length;
  }
  for (const b of liste) {
    for (const f of b.formen) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_-])${esc(f)}(?:s|n|en|e|es)?(?![\\p{L}\\p{N}_])`, 'giu');
      for (const m of text.matchAll(re)) {
        const von = m.index!;
        const bis = von + m[0].length;
        const aus = AUSSCHLUSS[b.id];
        if (aus && ((aus.vor && aus.vor.test(text.slice(0, von))) || (aus.nach && aus.nach.test(text.slice(bis))))) continue;
        alle.push({ id: b.id, von, bis, verweis: ersetzt.some((v) => v.id === b.id && von >= v.von && bis <= v.bis) });
      }
    }
  }
  // Verweise auf Einträge ausserhalb der Liste ignorieren; innerhalb der Liste zählt auch ein Verweis, dessen Anzeige keine Form trifft
  for (const v of ersetzt) {
    if (liste.some((x) => x.id === v.id) && !alle.some((a) => a.id === v.id && a.von >= v.von && a.bis <= v.bis)) alle.push({ id: v.id, von: v.von, bis: v.bis, verweis: true });
  }
  alle.sort((a, b) => a.von - b.von || b.bis - a.bis);
  const frei: typeof alle = [];
  for (const a of alle) {
    const letzter = frei[frei.length - 1];
    if (letzter && a.von < letzter.bis) continue;
    frei.push(a);
  }
  return frei;
}

/** Erstnennungen ohne Erklärung in einem Text. */
export function pruefeText(t: Text, liste: Begriff[], schwere: 'fehler' | 'warnung' = 'fehler'): Befund[] {
  const befunde: Befund[] = [];
  const gesehen = new Set<string>();
  const einheiten = t.zeilen.map((z) => ({ zeile: z.zeile, roh: bereinige(z.text) }));
  for (const e of einheiten) {
    const s = saetze(e.roh);
    for (let i = 0; i < s.length; i++) {
      const ts = treffer(s[i]!, liste);
      for (const a of ts) {
        if (gesehen.has(a.id)) continue;
        gesehen.add(a.id);
        const fenster = [s[i]!, s[i + 1]].filter((x): x is string => !!x);
        const erklaert = fenster.some((f, k) => {
          const hs = treffer(f, liste).filter((x) => x.id === a.id);
          if (k === 0 && GLOSSAR_HINWEIS.test(f)) return true;
          return hs.some((h) => h.verweis || DEFINITION.test(f.slice(h.bis)));
        });
        if (!erklaert) {
          const begriff = liste.find((x) => x.id === a.id)!;
          befunde.push({
            tor: TOR,
            datei: t.datei,
            zeile: e.zeile,
            meldung: `${t.name}: «${s[i]!.slice(a.von, a.bis)}» (${begriff.id}) bei der Erstnennung ohne Erklärung oder Glossar-Verweis. Vorschlag: ${begriff.kurz}`,
            schwere,
          });
        }
      }
    }
  }
  return befunde;
}

/** Ausreisserliste (Hinweis, W16): Sätze über LANGER_SATZ Wörter. */
export function langeSaetze(t: Text, grenze: number = LANGER_SATZ): Befund[] {
  const befunde: Befund[] = [];
  for (const z of t.zeilen) {
    for (const s of saetze(bereinige(z.roh ?? z.text))) {
      const n = s.split(/\s+/).length;
      if (n > grenze) befunde.push({ tor: TOR, datei: t.datei, zeile: z.zeile, meldung: `${t.name}: Satz mit ${n} Wörtern (Hinweis zur Lesbarkeit, Grenze ${grenze}): «${s.slice(0, 70)}…»`, schwere: 'warnung' });
    }
  }
  return befunde;
}

/** Texte des Datenblocks von START in Reihenfolge des Markups im Hauptteil (data-t, ohne Versionszeile). */
export function startTexte(vorlage: string, sprache: Sprache): Text {
  const block = vorlage.match(/<script type="application\/json" id="texte">\s*([\s\S]*?)\s*<\/script>/);
  if (!block) throw new Error('START: Datenblock «texte» fehlt');
  const texte = JSON.parse(block[1]!) as Record<Sprache, Record<string, string>>;
  const haupt = vorlage.slice(vorlage.indexOf('<main'), vorlage.indexOf('</main>'));
  const schluessel = [...haupt.matchAll(/data-t="([\w-]+)"/g)].map((m) => m[1]!).filter((k) => !k.startsWith('stand_'));
  return { name: `START (${sprache.toUpperCase()})`, datei: 'src/start/START.html.tpl', zeilen: schluessel.map((k) => ({ text: texte[sprache][k] ?? '' })) };
}

/** Zeile einer Tabelle: Die erste Zelle gilt als Begriff, die übrigen als dessen Beschreibung («erste Zelle ist Rest»). */
function tabellenzeile(zeile: string): string {
  if (!zeile.trimStart().startsWith('|')) return zeile;
  const zellen = zeile.replace(/^\s*\|\s*|\s*\|\s*$/g, '').split(/\s*\|\s*/);
  return zellen.length < 2 ? zellen[0]! : `${zellen[0]} ist ${zellen.slice(1).join('. ')}`;
}

/** Kapitel 1 ohne Überschriften, Tabellentrennzeilen und Leerzeilen. */
export function kapitelTexte(md: string, sprache: Sprache): Text {
  const datei = `src/leitfaden/${sprache}/01-minimal-viable-aims.md`;
  const zeilen = md
    .split('\n')
    .map((text, i) => ({ text, zeile: i + 1 }))
    .filter((z) => z.text.trim() && !z.text.startsWith('#') && !/^\|[\s|:-]+\|$/.test(z.text.trim()))
    .map((z) => ({ text: tabellenzeile(z.text), zeile: z.zeile, roh: z.text.replace(/^\s*\|\s*|\s*\|\s*$/g, '').split(/\s*\|\s*/).join('. ') }));
  return { name: `Kapitel 1 (${sprache.toUpperCase()})`, datei, zeilen };
}

/**
 * Schlüssel, die wie Überschriften gelten (AF-135): Seitentitel und Feldbezeichnungen tragen keine Erklärung; Kapitel 1 lässt
 * Überschriften ebenso aus. Sie zählen nicht als Erstnennung. Kommt ein Begriff aber nur dort vor, fehlt die Erklärung auf der
 * Seite (`pruefeKopf`): Der Begriff muss im Text der Seite (Frage, Warum, Fehlerhinweis, Feldhilfe) erklärt sein.
 */
export const UEBERSCHRIFT_SCHLUESSEL = new Set(['titel', 'label']);

/** Texte einer Guide-Seite: alle Zeichenketten in Reihenfolge der Datei (YAML-Werte); Überschriften getrennt in `kopf`. */
export function seitenTexte(datei: string, inhalt: Record<string, unknown>): Text[] {
  return Object.entries(inhalt).map(([id, wert]) => {
    const zeilen: { text: string }[] = [];
    const kopf: string[] = [];
    const sammle = (v: unknown, ueberschrift = false): void => {
      if (typeof v === 'string') { if (ueberschrift) kopf.push(v); else zeilen.push({ text: v }); }
      else if (Array.isArray(v)) v.forEach((x) => sammle(x, ueberschrift));
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => sammle(x, ueberschrift || UEBERSCHRIFT_SCHLUESSEL.has(k)));
    };
    sammle(wert);
    return { name: `Guide-Seite ${id}`, datei, zeilen, kopf };
  });
}

/** Begriffe, die nur in Überschriften der Seite vorkommen, im Text aber weder genannt noch erklärt werden */
export function pruefeKopf(t: Text, liste: Begriff[], schwere: 'fehler' | 'warnung' = 'fehler'): Befund[] {
  const ids = (texte: string[]) => new Set(texte.flatMap((x) => treffer(bereinige(x), liste).map((a) => a.id)));
  const imText = ids(t.zeilen.map((z) => z.text));
  return [...ids(t.kopf ?? [])].filter((id) => !imText.has(id)).map((id) => ({
    tor: TOR,
    datei: t.datei,
    meldung: `${t.name}: «${liste.find((b) => b.id === id)!.begriff}» (${id}) steht nur in Titel oder Bezeichnung, im Text der Seite fehlt die Erklärung. Vorschlag: ${liste.find((b) => b.id === id)!.kurz}`,
    schwere,
  }));
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  for (const sprache of SPRACHEN) {
    const { liste, befunde: b } = ladeBegriffe(sprache);
    befunde.push(...b);
    const start = startTexte(lies('src/start/START.html.tpl'), sprache);
    befunde.push(...pruefeText(start, liste), ...langeSaetze(start));
    const kap = kapitelTexte(lies(`src/leitfaden/${sprache}/01-minimal-viable-aims.md`), sprache);
    befunde.push(...pruefeText(kap, liste), ...langeSaetze(kap));
    const ordner = join(REPO, `src/i18n/${sprache}/gefuehrt`);
    if (existsSync(ordner)) {
      for (const d of readdirSync(ordner).filter((n) => n.endsWith('.yaml')).sort()) {
        const rel = `src/i18n/${sprache}/gefuehrt/${d}`;
        const inhalt = parse(readFileSync(join(REPO, rel), 'utf8')) as Record<string, unknown>;
        const offen: string[] = [];
        for (const t of seitenTexte(rel, inhalt)) {
          const b = [...pruefeText(t, liste, GUIDE_SCHWERE), ...pruefeKopf(t, liste, GUIDE_SCHWERE)];
          if (b.length > 0) offen.push(`${t.name.replace('Guide-Seite ', '')}: ${b.map((x) => /\(([\w-]+)\)/.exec(x.meldung)?.[1]).join(', ')}`);
        }
        if (offen.length > 0) befunde.push({ tor: TOR, datei: rel, meldung: `Guide: ${offen.length} Seiten mit Erstnennung ohne Erklärung oder Verweis: ${offen.join('; ')}`, schwere: GUIDE_SCHWERE });
      }
    }
  }
  return befunde;
}

/** Guide-Seiten: ab AF-135 (Kurzerklärungen an den Fundstellen) ein Fehler; die Erklärungen stehen auf allen Seiten. */
export const GUIDE_SCHWERE: 'fehler' | 'warnung' = 'fehler';

await alsHauptprogramm(import.meta.url, pruefe);

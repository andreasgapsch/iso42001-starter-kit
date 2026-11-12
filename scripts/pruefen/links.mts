// Tor G7 Links und offline: externe URLs finden, keine externen Skripte, Stylesheets oder
// Abrufe im Werkzeug-Bundle, relative Links im Kit müssen existieren, #page=N muss im
// Seitenbereich der PDF liegen und zur Artikelangabe im Linktext passen. Diagrammansicht: eigene, enge Prüfung
// (pruefeDiagrammansicht: CSP, Prüfsumme des Viewers, URL-Hosts im Viewer nur mit Begründung).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { basename, dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, hatEndung, quellenDir, relativ } from './gemeinsam.mts';
import { pruefeCsp } from '../csp.mts';
import { TT_POLICIES, VIEWER } from '../diagrammansicht.mts';

const TOR = 'G7';

export interface Link {
  url: string;
  zeile: number;
  /** Art des Fundes: Attribut (href/src/…), Markdown-Link, CSS url(), Code-Aufruf oder Text. */
  art: 'attribut' | 'markdown' | 'css' | 'code' | 'text';
  /** Name des Attributs oder Aufrufs, z. B. href, src, fetch, import. */
  quelle?: string;
  /** Linktext bei <a> und Markdown-Links. */
  linktext?: string;
  /** Tag des HTML-Elements bei Attributen. */
  tag?: string;
  /** rel-Attribut bei <link>. */
  rel?: string;
}

function zeileVon(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Findet alle Links und URLs in HTML oder Markdown. */
export function findeLinks(text: string): Link[] {
  const links: Link[] = [];
  const belegt = new Set<number>();
  const neu = (index: number, l: Omit<Link, 'zeile'>): void => {
    belegt.add(index);
    links.push({ ...l, zeile: zeileVon(text, index) });
  };
  // HTML-Elemente mit Attributen
  for (const m of text.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const tag = m[1]!.toLowerCase();
    const attrs = m[2]!;
    const rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
    for (const a of attrs.matchAll(/\b(href|src|action|data|poster|srcset|formaction)\s*=\s*(["'])(.*?)\2/gi)) {
      let linktext: string | undefined;
      if (tag === 'a') {
        const ende = text.indexOf('</a>', m.index! + m[0].length);
        if (ende > 0) linktext = text.slice(m.index! + m[0].length, ende).replace(/<[^>]+>/g, '').trim();
      }
      const idx = m.index! + m[0].indexOf(a[0]) + a[0].indexOf(a[3]!);
      neu(idx, { url: a[3]!, art: 'attribut', quelle: a[1]!.toLowerCase(), tag, rel, linktext });
    }
  }
  // Markdown-Links und -Bilder
  for (const m of text.matchAll(/!?\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    neu(m.index! + m[0].indexOf(m[2]!), { url: m[2]!, art: 'markdown', linktext: m[1]! });
  }
  // CSS url() und @import
  for (const m of text.matchAll(/(?:url\(\s*["']?|@import\s+["'])(https?:\/\/[^"')\s]+)/gi)) {
    neu(m.index! + m[0].indexOf(m[1]!), { url: m[1]!, art: 'css', quelle: 'url' });
  }
  // Code: fetch, import, Worker, sendBeacon, WebSocket, EventSource, XMLHttpRequest.open
  for (const m of text.matchAll(/\b(fetch|import|importScripts|Worker|SharedWorker|sendBeacon|WebSocket|EventSource)\s*\(\s*["'`]((?:https?|wss?):\/\/[^"'`]+)/g)) {
    neu(m.index! + m[0].indexOf(m[2]!), { url: m[2]!, art: 'code', quelle: m[1]! });
  }
  for (const m of text.matchAll(/\.open\s*\(\s*["'][A-Za-z]+["']\s*,\s*["'`]((?:https?):\/\/[^"'`]+)/g)) {
    neu(m.index! + m[0].indexOf(m[1]!), { url: m[1]!, art: 'code', quelle: 'XMLHttpRequest' });
  }
  for (const m of text.matchAll(/\bfrom\s+["']((?:https?):\/\/[^"']+)["']/g)) {
    neu(m.index! + m[0].indexOf(m[1]!), { url: m[1]!, art: 'code', quelle: 'import' });
  }
  // übrige nackte URLs
  for (const m of text.matchAll(/(?:https?|wss?):\/\/[^\s"'<>()`\]]+/g)) {
    if (!belegt.has(m.index!)) neu(m.index!, { url: m[0].replace(/[.,;:]+$/, ''), art: 'text' });
  }
  return links.sort((a, b) => a.zeile - b.zeile);
}

export function istExtern(url: string): boolean {
  return /^(https?|wss?):\/\//i.test(url) || url.startsWith('//');
}

/** XML-Namensräume (SVG, XHTML) sind Kennungen, keine Abrufe. */
export function istNamensraum(url: string): boolean {
  return /^http:\/\/www\.w3\.org\//i.test(url);
}

/** Erlaubte Ziele für gewöhnliche Hyperlinks (<a href>) im Werkzeug. */
export const ERLAUBTE_LINKZIELE = [/^https:\/\/(www\.)?kmu-cio\.ch(\/|$)/i, /^https:\/\/eur-lex\.europa\.eu\//i];

/** Prüft das Werkzeug-Bundle: keine nachgeladenen externen Ressourcen. */
export function pruefeBundle(datei: string, text: string): Befund[] {
  const befunde: Befund[] = [];
  for (const l of findeLinks(text)) {
    if (!istExtern(l.url) || istNamensraum(l.url)) continue;
    if (l.art === 'text') {
      befunde.push({ tor: TOR, datei, zeile: l.zeile, meldung: `externe URL im Werkzeug-Bundle (Text oder Kommentar): ${l.url}`, schwere: 'warnung' });
      continue;
    }
    const istNavigation = (l.art === 'attribut' && l.tag === 'a' && l.quelle === 'href') || l.art === 'markdown';
    if (istNavigation) {
      if (!ERLAUBTE_LINKZIELE.some((r) => r.test(l.url))) {
        befunde.push({ tor: TOR, datei, zeile: l.zeile, meldung: `externer Link im Werkzeug: ${l.url}`, schwere: 'warnung' });
      }
      continue;
    }
    const was = l.art === 'code' ? `Abruf (${l.quelle})` : l.tag === 'script' ? 'Skript' : l.tag === 'link' && /stylesheet/i.test(l.rel ?? '') ? 'Stylesheet' : l.art === 'css' ? 'CSS-Ressource' : `Ressource <${l.tag ?? '?'} ${l.quelle ?? ''}>`;
    befunde.push({ tor: TOR, datei, zeile: l.zeile, meldung: `externe ${was} im Werkzeug-Bundle: ${l.url}`, schwere: 'fehler' });
  }
  return befunde;
}

export interface ArtikelSeiten {
  quelle: { de: string; en: string };
  de: Record<string, number>;
  en: Record<string, number>;
  seitenzahl?: { de: number; en: number };
}

export function ladeArtikelSeiten(repo: string = REPO): ArtikelSeiten | undefined {
  const p = join(repo, 'src', 'ai-act', 'artikel-seiten.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as ArtikelSeiten) : undefined;
}

const pdfSeitenCache = new Map<string, number | undefined>();

/** Seitenzahl einer PDF über pdfinfo; undefined, wenn pdfinfo fehlt oder die Datei nicht lesbar ist. */
export function pdfSeitenzahl(pdf: string): number | undefined {
  if (pdfSeitenCache.has(pdf)) return pdfSeitenCache.get(pdf);
  let n: number | undefined;
  try {
    const m = /^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    n = m ? Number(m[1]) : undefined;
  } catch {
    n = undefined;
  }
  pdfSeitenCache.set(pdf, n);
  return n;
}

/** Schlüssel aus Linktext wie «Art. 26», «Artikel 4a», «Article 50», «Anhang III», «Annex IV». */
export function artikelAusText(text: string): string | undefined {
  const a = /\b(?:Art\.|Artikel|Article)\s*(\d{1,3}[a-z]?)\b/.exec(text);
  if (a) return `art-${a[1]}`;
  const b = /\b(?:Anhang|Annex|ANHANG|ANNEX)\s+([IVX]+)\b/.exec(text);
  return b ? `anhang-${b[1]!.toLowerCase()}` : undefined;
}

/**
 * Prüft relative Links (Ziel muss existieren) und PDF-Sprungmarken einer Datei.
 * `pruefeZiele` schaltet die Existenzprüfung zu (für dist/kit).
 */
export function pruefeRelativeLinks(datei: string, text: string, optionen: { basis: string; pruefeZiele: boolean; seiten?: ArtikelSeiten; repo?: string }): Befund[] {
  const befunde: Befund[] = [];
  const rel = relativ(datei, optionen.repo ?? REPO);
  for (const l of findeLinks(text)) {
    if (istExtern(l.url) || /^(#|mailto:|tel:|data:|blob:|javascript:|about:)/i.test(l.url) || l.art === 'text' || l.art === 'code') continue;
    if (l.quelle === 'srcset') continue;
    const [pfadTeil, fragment = ''] = l.url.split('#', 2) as [string, string?];
    const pfad = decodeURIComponent(pfadTeil.split('?')[0]!);
    if (pfad === '') continue;
    const ziel = resolve(optionen.basis, pfad);
    const vorhanden = existsSync(ziel);
    if (optionen.pruefeZiele && !vorhanden) {
      // In CI fehlen die Rechtstexte (nie im Repo) und der Drittlizenz-Cache; dort nur Warnung, lokal Fehler
      const nurCi = process.env.CI && /^(Rechtstexte_Legal-Texts\/|LIZENZ_LICENCE\/DRITTLIZENZEN)/.test(pfad);
      befunde.push({ tor: TOR, datei: rel, zeile: l.zeile, meldung: `relativer Link ins Leere: ${l.url}`, schwere: nurCi ? 'warnung' : 'fehler' });
    }
    const seite = /(?:^|&)page=(\d+)/.exec(fragment)?.[1];
    if (!seite || !/\.pdf$/i.test(pfad)) continue;
    const n = Number(seite);
    const sprache = /_EN\.pdf$/i.test(pfad) ? 'en' : /_DE\.pdf$/i.test(pfad) ? 'de' : undefined;
    const ausJson = optionen.seiten && sprache && basename(pfad) === optionen.seiten.quelle[sprache];
    const max = vorhanden ? pdfSeitenzahl(ziel) : ausJson ? optionen.seiten!.seitenzahl?.[sprache!] : undefined;
    if (max === undefined) {
      befunde.push({ tor: TOR, datei: rel, zeile: l.zeile, meldung: `Seitenzahl von ${basename(pfad)} unbekannt, #page=${n} nicht prüfbar`, schwere: 'warnung' });
    } else if (n < 1 || n > max) {
      befunde.push({ tor: TOR, datei: rel, zeile: l.zeile, meldung: `#page=${n} ausserhalb von 1 bis ${max} (${basename(pfad)})`, schwere: 'fehler' });
    }
    if (ausJson && l.linktext) {
      const schluessel = artikelAusText(l.linktext);
      const soll = schluessel ? optionen.seiten![sprache!][schluessel] : undefined;
      if (schluessel && soll !== undefined && soll !== n) {
        befunde.push({ tor: TOR, datei: rel, zeile: l.zeile, meldung: `«${l.linktext}» zeigt auf Seite ${n}, laut artikel-seiten.json Seite ${soll}`, schwere: 'fehler' });
      }
    }
  }
  return befunde;
}

interface StandFristen {
  fassung: { aenderungen?: { id: string; datei?: { de?: string; en?: string } }[] };
  fristen: { id: string; artikel: string; dokument?: string; seite?: { de?: number; en?: number } }[];
}

/**
 * Linkziele der Fristen (src/ai-act/stand.yaml, Reiter Fristen im Werkzeug, E-09): Fundstellen in einem anderen Rechtsakt
 * brauchen ein eigenes Linkziel (dokument mit Datei je Sprache und seite), sonst zeigt der Link auf die konsolidierte
 * Fassung des AI Act. Die Seite muss in der PDF liegen, wenn die PDF lokal vorhanden ist (Quellordner oder dist/kit).
 */
export function pruefeFristLinks(stand: StandFristen, pdfOrdner: string[], rel = 'src/ai-act/stand.yaml'): Befund[] {
  const befunde: Befund[] = [];
  for (const f of stand.fristen) {
    const fremd = /VO \(EU\)|Verordnung|Richtlinie|Regulation|Directive/.test(f.artikel);
    if (!f.dokument) {
      if (fremd) befunde.push({ tor: TOR, datei: rel, meldung: `${f.id}: Fundstelle in einem anderen Rechtsakt ohne Linkziel (dokument, seite)`, schwere: 'fehler' });
      continue;
    }
    const akt = stand.fassung.aenderungen?.find((a) => a.id === f.dokument);
    if (!akt) {
      befunde.push({ tor: TOR, datei: rel, meldung: `${f.id}: dokument ${f.dokument} fehlt unter fassung.aenderungen`, schwere: 'fehler' });
      continue;
    }
    for (const sprache of ['de', 'en'] as const) {
      const datei = akt.datei?.[sprache];
      const seite = f.seite?.[sprache];
      if (!datei || !seite) {
        befunde.push({ tor: TOR, datei: rel, meldung: `${f.id}: Datei oder Seite für ${sprache.toUpperCase()} fehlt`, schwere: 'fehler' });
        continue;
      }
      const pdf = pdfOrdner.map((o) => join(o, datei)).find((x) => existsSync(x));
      const max = pdf ? pdfSeitenzahl(pdf) : undefined;
      if (max === undefined) befunde.push({ tor: TOR, datei: rel, meldung: `${f.id}: ${datei} nicht vorhanden, Seite ${seite} nicht prüfbar`, schwere: 'warnung' });
      else if (seite < 1 || seite > max) befunde.push({ tor: TOR, datei: rel, meldung: `${f.id}: Seite ${seite} ausserhalb von 1 bis ${max} (${datei})`, schwere: 'fehler' });
    }
  }
  return befunde;
}

/** Diagrammansicht: eigene Datei mit dem unveränderten Viewer von draw.io (scripts/diagrammansicht.mts). */
export function istDiagrammansicht(rel: string): boolean {
  return /(^|\/)Diagrammansicht\.html$/.test(rel);
}

/**
 * Ausnahme für die Diagrammansicht, eng gefasst: Der eingebettete Viewer (nur mit der gepinnten Prüfsumme VIEWER.sha256)
 * enthält URL-Zeichenketten, die die Ansicht nie lädt. Erlaubt sind nur diese Hosts, je mit Begründung; ein neuer Host
 * (etwa nach einem Update des Viewers) ist ein Fehler, bis er geprüft und hier eingetragen ist. Unabhängig davon blockiert
 * die CSP der Datei jeden Abruf (connect-src 'none', img-src data:, font-src data:, Skripte nur per Hash).
 */
export const VIEWER_URL_HOSTS: Record<string, string> = {
  'viewer.diagrams.net': 'Standardpfade (PROXY_URL, STYLE_PATH, SHAPES_PATH, STENCIL_PATH, DRAW_MATH_URL, GRAPH_IMAGE_PATH, mxBasePath); Lader für Schablonen überschrieben, Formeln abgeschaltet',
  'app.diagrams.net': 'Editor-Adresse für Bearbeiten und Lightbox; die Ansicht setzt lightbox: false und zeigt keine Bearbeiten-Schaltfläche',
  'www.draw.io': 'Editor-Adresse für Einbettung, im Viewer ungenutzt',
  'www.drawio.com': 'Hilfe-Links in Texten des Editors; die Ansicht öffnet keine Links',
  'github.com': 'Links in Texten des Editors (Hilfe, Speicher GitHub); die Ansicht öffnet keine Links',
  'api.github.com': 'Speicher GitHub des Editors, im Viewer ungenutzt',
  'raw.githubusercontent.com': 'Speicher GitHub des Editors, im Viewer ungenutzt',
  'gitlab.com': 'Speicher GitLab des Editors, im Viewer ungenutzt',
  'drive.google.com': 'Speicher Google Drive des Editors, im Viewer ungenutzt',
  'convert.diagrams.net': 'Konvertierdienst des Editors, im Viewer ungenutzt',
  'icons.diagrams.net': 'Symbolsuche des Editors, im Viewer ungenutzt',
  'log.diagrams.net': 'Fehlerprotokoll, nur gesetzt, wenn die Seite auf einem Host von diagrams.net läuft (nie unter file://)',
  'log.draw.io': 'Fehlerprotokoll, nur gesetzt, wenn die Seite auf einem Host von draw.io läuft (nie unter file://)',
  'test.draw.io': 'Hostvergleich für das Fehlerprotokoll, keine Abfrage',
  'fonts.googleapis.com': 'Web-Schriften (fontSource); Graph.addFont überschrieben, fontSource beim Öffnen entfernt, CSP font-src data:',
  'fonts.gstatic.com': 'Web-Schriften, wie fonts.googleapis.com',
  'api.openai.com': 'KI-Funktionen des Editors (Konfiguration), im Viewer nicht aufrufbar',
  'api.anthropic.com': 'KI-Funktionen des Editors (Konfiguration), im Viewer nicht aufrufbar',
  'generativelanguage.googleapis.com': 'KI-Funktionen des Editors (Konfiguration), im Viewer nicht aufrufbar',
  '\u2026': 'Platzhaltertext «https://…» im Eingabefeld für Links des Editors',
};

const VIEWER_BLOCK = /<script\b[^>]*\bid="viewer"[^>]*>([\s\S]*?)<\/script>/i;

/** Prüft die Diagrammansicht: CSP eng, Viewer unverändert, eigenes Markup und Skript ohne externe Ressourcen. */
export function pruefeDiagrammansicht(datei: string, text: string): Befund[] {
  const befunde: Befund[] = [];
  const melde = (meldung: string, schwere: 'fehler' | 'warnung' = 'fehler', zeile?: number): void => {
    befunde.push({ tor: TOR, datei, zeile, meldung, schwere });
  };
  const block = VIEWER_BLOCK.exec(text);
  if (!block) {
    melde('Diagrammansicht ohne Viewer-Datenblock (script id="viewer")');
    return befunde;
  }
  // Eigenes Markup und Skript: wie das Werkzeug-Bundle, ohne den Viewer-Block
  const ohneViewer = text.replace(VIEWER_BLOCK, (m) => m.replace(block[1]!, ''));
  befunde.push(...pruefeBundle(datei, ohneViewer));
  // Viewer: entpacken, Prüfsumme gegen die gepinnte Version
  let code = '';
  try {
    code = inflateRawSync(Buffer.from(block[1]!.trim(), 'base64')).toString('utf8');
  } catch (e) {
    melde(`Viewer-Datenblock nicht lesbar: ${(e as Error).message}`);
    return befunde;
  }
  const summe = createHash('sha256').update(code, 'utf8').digest('hex');
  if (summe !== VIEWER.sha256) {
    melde(`Viewer verändert oder andere Version: SHA-256 ${summe} statt ${VIEWER.sha256} (${VIEWER.version})`);
    return befunde;
  }
  const hosts = new Map<string, number>();
  for (const l of findeLinks(code)) {
    if (!istExtern(l.url) || istNamensraum(l.url)) continue;
    const host = /^(?:[a-z]+:)?\/\/([^/:?#,'"`\s]*)/i.exec(l.url)?.[1] ?? l.url;
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
  for (const [host, n] of hosts) {
    if (!(host in VIEWER_URL_HOSTS)) melde(`Viewer ${VIEWER.version}: URL-Zeichenkette mit ungeprüftem Host «${host}» (${n}×); prüfen und in VIEWER_URL_HOSTS begründen`);
  }
  // CSP: vorhanden, eng, nur die dokumentierte Lockerung
  const policy = /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*content\s*=\s*"([^"]*)"/i.exec(text)?.[1];
  if (!policy) {
    melde('Diagrammansicht ohne CSP');
    return befunde;
  }
  for (const f of pruefeCsp(text, { styleAttrInline: true })) melde(`CSP: ${f}`);
  const direktiven = new Map(policy.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map((d) => [d[0]!, d.slice(1)] as const));
  const soll: [string, string][] = [["default-src", "'none'"], ['connect-src', "'none'"], ['base-uri', "'none'"], ['form-action', "'none'"], ['img-src', 'data:'], ['font-src', 'data:'], ['require-trusted-types-for', "'script'"]];
  for (const [d, w] of soll) if (direktiven.get(d)?.join(' ') !== w) melde(`CSP: ${d} muss «${w}» sein (ist «${direktiven.get(d)?.join(' ') ?? 'fehlt'}»)`);
  for (const [d, werte] of direktiven) {
    for (const w of werte) if (/^(https?:|wss?:|\*|blob:)|^[a-z0-9.-]+\.[a-z]{2,}/i.test(w)) melde(`CSP: Quelle «${w}» in ${d} erlaubt Abrufe`);
  }
  const viewerHash = `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;
  if (!direktiven.get('script-src')?.includes(viewerHash)) melde('CSP: Hash des Viewer-Codes fehlt in script-src');
  if ((direktiven.get('script-src')?.length ?? 0) !== 2) melde(`CSP: script-src soll genau zwei Hashes enthalten (eigenes Skript, Viewer), hat ${direktiven.get('script-src')?.length ?? 0}`);
  const tt = (direktiven.get('trusted-types') ?? []).join(' ');
  if (tt !== TT_POLICIES.join(' ')) melde(`CSP: trusted-types «${tt}» statt «${TT_POLICIES.join(' ')}»`);
  if (direktiven.has('style-src')) melde('CSP: style-src nicht verwenden (style-src-elem und style-src-attr getrennt)');
  return befunde;
}

/** Werkzeug-Bundle: der AIMS-Manager im Kit oder im Vite-Ausgabeordner. */
export function istBundle(rel: string): boolean {
  return /(^|\/)aims-manager[^/]*\.html$/i.test(rel) || /^dist\/app\//.test(rel);
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const seiten = ladeArtikelSeiten();
  const dateien = [...dateienUnter(join(REPO, 'src')), ...dateienUnter(join(REPO, 'dist'))].filter((p) => hatEndung(p, ['.html', '.htm', '.md']));
  for (const pfad of dateien) {
    const rel = relativ(pfad);
    const text = readFileSync(pfad, 'utf8');
    if (istDiagrammansicht(rel)) befunde.push(...pruefeDiagrammansicht(rel, text));
    else if (istBundle(rel)) befunde.push(...pruefeBundle(rel, text));
    for (const l of findeLinks(text)) {
      if (/^http:\/\//i.test(l.url) && !istNamensraum(l.url) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(l.url)) {
        befunde.push({ tor: TOR, datei: rel, zeile: l.zeile, meldung: `unverschlüsselte URL, https verwenden: ${l.url}`, schwere: 'warnung' });
      }
    }
    // Im gebündelten Werkzeug stehen Zeichenfolgen in Skripten, die wie Links aussehen; relative Ziele nur im HTML ausserhalb von <script> prüfen
    const htmlText = istBundle(rel) || istDiagrammansicht(rel) ? text.replace(/<script\b[\s\S]*?<\/script>/gi, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length)) : text;
    befunde.push(...pruefeRelativeLinks(pfad, htmlText, { basis: dirname(pfad), pruefeZiele: rel.startsWith('dist/kit/'), seiten }));
  }
  const standPfad = join(REPO, 'src', 'ai-act', 'stand.yaml');
  if (existsSync(standPfad)) {
    const ordner = [join(quellenDir(), 'eu-ai-act'), ...dateienUnter(join(REPO, 'dist', 'kit')).filter((p) => /EU-AI-Act_2024-1689_konsolidiert.*\.pdf$/.test(p)).map((p) => dirname(p))];
    befunde.push(...pruefeFristLinks(parse(readFileSync(standPfad, 'utf8')) as StandFristen, ordner));
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);

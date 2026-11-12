// Tor G8 Namensnennung: vorhanden in START, Werkzeug, Diagrammansicht, Skill und Leitfaden; abwesend in allen
// erzeugten Dokumenten (DOCX/XLSX inklusive docProps und aller übrigen Teile). Diagrammansicht zusätzlich: Nennung des
// Viewers mit Lizenz und Markenhinweis; kein Markenname (draw.io) in Dateinamen des Kits. Firmendokumente zusätzlich
// (Stage-1-Runde 6): D-27 und die Dateien für draw.io ohne Werkzeugsprache (Attribute und Tags «kit», Konfigurationstexte
// des Katalogs wie «Control, abwählbar», «Angabe im Projekt») und ohne Bezug auf ISO/IEC 27001 in Sets ohne ISMS.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, hatEndung, relativ, textAusDokument } from './gemeinsam.mts';

const TOR = 'G8';

/** Kennzeichen, das in erzeugten Dokumenten nicht vorkommen darf. */
export const VERBOTEN = /kmu-cio/i;

/** Standard: Name und Website müssen beide genannt sein. */
export const NAMENSNENNUNG: RegExp[] = [/Andreas Gapsch/, /kmu-cio\.ch/i];

const OFFICE = ['.docx', '.xlsx', '.pptx', '.dotx', '.xltx'];
const TEXT = ['.html', '.htm', '.md', '.txt', '.csv', '.json', '.xml', '.yaml', '.yml'];

function zeilenMitTreffer(text: string, muster: RegExp): number[] {
  const re = new RegExp(muster.source, muster.flags.replace('g', ''));
  return text.split('\n').flatMap((z, i) => (re.test(z) ? [i + 1] : []));
}

/**
 * Prüft, ob `datei` die Namensnennung enthält. `text` ist das gesuchte Kennzeichen
 * (Zeichenkette oder Muster); ohne Angabe gelten Name und Website.
 */
export function pruefeVorhanden(datei: string, text?: string | RegExp | (string | RegExp)[]): Befund[] {
  const rel = relativ(datei);
  if (!existsSync(datei)) return [{ tor: TOR, datei: rel, meldung: 'Datei fehlt, Namensnennung nicht prüfbar', schwere: 'fehler' }];
  const inhalt = textAusDokument(datei, readFileSync(datei));
  const gesucht = text === undefined ? NAMENSNENNUNG : Array.isArray(text) ? text : [text];
  return gesucht
    .filter((g) => (typeof g === 'string' ? !inhalt.includes(g) : !g.test(inhalt)))
    .map((g) => ({ tor: TOR, datei: rel, meldung: `Namensnennung fehlt: «${typeof g === 'string' ? g : g.source}»`, schwere: 'fehler' as const }));
}

/**
 * Prüft, ob `datei` frei von «kmu-cio» ist: Office-Dateien werden entpackt und alle Teile
 * (inklusive docProps, Beziehungen, eingebetteter Dateien) durchsucht; Textdateien zeilenweise.
 */
export function pruefeAbwesend(datei: string): Befund[] {
  const rel = relativ(datei);
  const befunde: Befund[] = [];
  const melde = (meldung: string, zeile?: number): void => {
    befunde.push({ tor: TOR, datei: rel, zeile, meldung, schwere: 'fehler' });
  };
  if (VERBOTEN.test(basename(datei))) melde('Dateiname enthält «kmu-cio»');
  const inhalt = readFileSync(datei);
  if (hatEndung(datei, OFFICE)) {
    let teile: Record<string, Uint8Array>;
    try {
      teile = unzipSync(inhalt);
    } catch (e) {
      melde(`nicht entpackbar: ${(e as Error).message}`);
      return befunde;
    }
    for (const [teil, daten] of Object.entries(teile)) {
      if (VERBOTEN.test(teil)) melde(`Teil ${teil}: Name enthält «kmu-cio»`);
      // latin1 erfasst ASCII-Treffer auch in Binärteilen (Bilder, eingebettete Objekte)
      const roh = strFromU8(daten, true);
      if (!VERBOTEN.test(roh)) continue;
      const zeilen = /\.(xml|rels|txt)$/i.test(teil) ? zeilenMitTreffer(roh, VERBOTEN) : [];
      melde(`Teil ${teil}${zeilen.length ? ` (Zeile ${zeilen.join(', ')})` : ''}: enthält «kmu-cio»`);
    }
  } else if (hatEndung(datei, TEXT)) {
    for (const z of zeilenMitTreffer(strFromU8(inhalt), VERBOTEN)) melde('enthält «kmu-cio»', z);
  } else if (VERBOTEN.test(strFromU8(inhalt, true))) {
    melde('enthält «kmu-cio» (Binärdatei)');
  }
  return befunde;
}

/**
 * Werkzeugsprache, die in Firmendokumenten (D-27, Datei für draw.io) nicht vorkommen darf: Kennungen des Kits als
 * Attribute oder Tags, Angaben zum erzeugenden Werkzeug und Konfigurationstexte des Prozesskatalogs (DE und EN).
 */
export const WERKZEUGSPRACHE: { muster: RegExp; text: string }[] = [
  { muster: /\bkit(?:Id|Prozess|Rolle|Art|Bahn|Raci|Verweis|Dokumente|Entscheid)\s*=/, text: 'Attribut kit…' },
  { muster: /\skit\s*=\s*"/, text: 'Attribut kit' },
  { muster: /\btags\s*=\s*"(?:[^"]*\s)?kit(?:\s[^"]*)?"/, text: 'Tag «kit»' },
  { muster: /\b(?:host|agent)\s*=\s*"aims"/, text: 'Angabe zum Werkzeug (host, agent)' },
  { muster: /kitVersion/, text: 'Kit-Version' },
  { muster: /Control, abwählbar|Control, can be excluded/, text: '«Control, abwählbar»' },
  { muster: /Angabe im Projekt|project setting/i, text: '«Angabe im Projekt»' },
  { muster: /Bedingt \(Gilt|Conditional \(Applies/, text: '«Bedingt (Gilt, wenn …)»' },
  { muster: /(?:höchstens|at most) 0 (?:Anzahl|number)/, text: '«höchstens 0 Anzahl»' },
  { muster: /Soll mindestens 100 %|Sollwert: mindestens 100 %|target at least 100 %|Target: at least 100 %/, text: '«mindestens 100 %»' },
  { muster: /Grundprozess der Informationssicherheit; Control|Basic information security process; Control/, text: 'Einstufung des Katalogs' },
];

/** Text einer Datei für die Suche nach Werkzeugsprache: DOCX Textteile (Dokument, Kopf, Fuss), sonst die ganze Datei (draw.io) */
function rohText(datei: string): string {
  const inhalt = new Uint8Array(readFileSync(datei));
  if (hatEndung(datei, OFFICE)) {
    const teile = unzipSync(inhalt);
    return Object.entries(teile)
      .filter(([t]) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(t))
      .map(([, d]) => strFromU8(d).replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''))
      .join('\n');
  }
  return strFromU8(inhalt);
}

/** Firmendokument D-27 oder Datei für draw.io? */
export function istProzessdokument(rel: string): boolean {
  return /(^|\/)D-27[^/]*\.(docx|drawio)$/i.test(rel);
}

/**
 * Werkzeugsprache in D-27 und der Datei für draw.io eines Firmensets. ohneIsms: Set ohne ISMS (kein Ergänzungsblatt, keine
 * Integrationsmatrix D-23); dann darf auch ISO/IEC 27001 nicht genannt sein.
 */
export function pruefeWerkzeugsprache(datei: string, ohneIsms = false): Befund[] {
  const rel = relativ(datei);
  let text: string;
  try {
    text = rohText(datei);
  } catch (e) {
    return [{ tor: TOR, datei: rel, meldung: `nicht lesbar: ${(e as Error).message}`, schwere: 'fehler' }];
  }
  const regeln = [...WERKZEUGSPRACHE, ...(ohneIsms ? [{ muster: /ISO\/IEC 27001/, text: 'ISO/IEC 27001 ohne ISMS' }] : [])];
  const befunde: Befund[] = [];
  for (const r of regeln) {
    const zeilen = zeilenMitTreffer(text, r.muster);
    if (zeilen.length) befunde.push({ tor: TOR, datei: rel, zeile: zeilen[0], meldung: `Werkzeugsprache im Firmendokument: ${r.text} (${zeilen.length} Zeilen)`, schwere: 'fehler' });
  }
  return befunde;
}

/** Dateien, die die Namensnennung tragen müssen (Lage im erzeugten Kit). */
export function istTraeger(rel: string): boolean {
  return /(^|\/)(START[^/]*\.html|aims-manager\.html|Diagrammansicht\.html|SKILL\.md|Leitfaden[^/]*\.html|Guide[^/]*\.html)$/i.test(rel);
}

/**
 * Diagrammansicht (scripts/diagrammansicht.mts): neben der Namensnennung die beschreibende Nennung des Viewers mit Lizenz
 * und der Markenhinweis (draw.io ist eine Marke von draw.io Ltd; die Ansicht ist nicht von draw.io Ltd oder JGraph).
 */
export const DIAGRAMMANSICHT_HINWEISE: RegExp[] = [/Viewer von draw\.io \(viewer-static [\d.]+, Apache License 2\.0\)/, /draw\.io ist eine eingetragene Marke von draw\.io Ltd\./, /nicht von draw\.io Ltd oder JGraph erstellt/];

/** Markenname eines fremden Werkzeugs im Dateinamen (ohne Endung): nicht erlaubt, nur beschreibende Nennung im Text. */
export const MARKE_IM_NAMEN = /draw\.?io|diagrams\.net/i;

export function pruefeDateiname(datei: string): Befund[] {
  const stamm = basename(datei).replace(/\.[^.]+$/, '');
  return MARKE_IM_NAMEN.test(stamm) ? [{ tor: TOR, datei: relativ(datei), meldung: 'Dateiname enthält «draw.io» (Marke nur beschreibend im Text nennen)', schwere: 'fehler' }] : [];
}

/** Erzeugte Dokumente, die frei von Kit-Angaben sein müssen. */
export function istErzeugtesDokument(rel: string): boolean {
  return hatEndung(rel, OFFICE);
}

/** Leere Vorlagen und Beispiele im Kit tragen die Namensnennung (Hinweisblock bzw. Beispielkennzeichnung). */
export function pruefeOfficeVorhanden(datei: string): Befund[] {
  const teile = unzipSync(new Uint8Array(readFileSync(datei)));
  const gefunden = Object.values(teile).some((d) => VERBOTEN.test(strFromU8(d, true)));
  return gefunden ? [] : [{ tor: TOR, datei: relativ(datei), meldung: 'leere Vorlage oder Beispiel ohne Namensnennung', schwere: 'fehler' }];
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const befunde: Befund[] = [];
  // Im Kit: Vorlagen und Beispiele mit Namensnennung, Träger (Start, Werkzeug, Skill, Leitfaden) ebenso
  for (const pfad of dateienUnter(join(REPO, 'dist', 'kit'))) {
    const rel = relativ(pfad);
    if (istErzeugtesDokument(rel)) befunde.push(...pruefeOfficeVorhanden(pfad));
    else if (istTraeger(rel)) befunde.push(...pruefeVorhanden(pfad));
    if (/(^|\/)Diagrammansicht\.html$/.test(rel)) befunde.push(...pruefeVorhanden(pfad, DIAGRAMMANSICHT_HINWEISE));
    befunde.push(...pruefeDateiname(pfad));
  }
  // Firmendokumente (vom Generator im Modus «firma» oder vom Skill erzeugt): frei von Kit-Angaben; D-27 und die Datei
  // für draw.io zusätzlich frei von Werkzeugsprache (ohne ISMS auch ohne ISO/IEC 27001)
  const alle = dateienUnter(join(REPO, 'dist', 'firmendokumente'));
  for (const pfad of alle) {
    befunde.push(...pruefeAbwesend(pfad));
    if (!istProzessdokument(relativ(pfad))) continue;
    const ordner = dirname(pfad);
    const geschwister = alle.filter((x) => dirname(x) === ordner).map((x) => basename(x));
    const ohneIsms = !geschwister.some((x) => /-EB_|^D-23_/.test(x));
    befunde.push(...pruefeWerkzeugsprache(pfad, ohneIsms));
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);

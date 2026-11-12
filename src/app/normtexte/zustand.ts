// Normpaket im Werkzeug: Normtexte aus der eigenen Normausgabe der Firma. Getrennt vom Projekt in einer eigenen
// IndexedDB «aims-normpaket» (Rückfall: nur im Arbeitsspeicher). Nie in der Projektdatei, im Zwischenspeicher des
// Projekts oder im KI-Prompt. Anzeige in der App immer, in Dokumenten nur nach ausdrücklicher Bestätigung.
import { signal } from '@preact/signals';
import { hatNormtext, normEintrag, normText } from '../../normtexte/aufloesung.ts';
import { leeresNormpaket, type Lizenzangaben, type NormArt, type NormEintrag, type NormId, type Normpaket, type NormSprache, type NormTeil, type NormtexteLaufzeit } from '../../normtexte/typen.ts';
import { jsonLesen } from '../../eingang/lesen.ts';
import { inhalt, uiSprache } from '../i18n.ts';
import { IndexedDbAdapter, SpeicherAdapter } from '../speicher/zwischenspeicher.ts';
import type { ZwischenspeicherAdapter } from '../speicher/typen.ts';

export const NORMPAKET_DB = 'aims-normpaket';
const SCHLUESSEL = 'normpaket';

export const normpaket = signal<Normpaket>(leeresNormpaket());
/** true: IndexedDB; false: nur für diese Sitzung; null: noch nicht geladen */
export const normpaketDauerhaft = signal<boolean | null>(null);

let ablage: Promise<ZwischenspeicherAdapter> | null = null;

function holeAblage(): Promise<ZwischenspeicherAdapter> {
  ablage ??= (async () => {
    try {
      const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (!idb) throw new Error('keine IndexedDB');
      const a = await IndexedDbAdapter.oeffnen(idb, NORMPAKET_DB);
      normpaketDauerhaft.value = true;
      return a;
    } catch {
      normpaketDauerhaft.value = false;
      return new SpeicherAdapter();
    }
  })();
  return ablage;
}

/** Ablage des Normpakets, zum Leeren des Browserspeichers (AF-032) */
export const normAblage = holeAblage;

/** Für Tests: eigene Ablage setzen. */
export function setzeNormAblage(a: ZwischenspeicherAdapter | null): void {
  ablage = a ? Promise.resolve(a) : null;
}

/** Prüft und bereinigt ein Normpaket aus Ablage oder Datei; wirft bei falschem Format (z. B. Projektdatei). */
export function pruefeNormpaket(roh: unknown): Normpaket {
  const p = roh as Partial<Normpaket> | null;
  if (!p || typeof p !== 'object' || p.format !== 'aims-normpaket' || p.version !== 1 || !Array.isArray(p.teile)) throw new Error('kein Normpaket');
  const str = (x: unknown, max = 20_000) => (typeof x === 'string' ? x.slice(0, max) : '');
  const teile: NormTeil[] = [];
  for (const t of p.teile as (Partial<NormTeil> | null)[]) {
    // Einträge, die kein Objekt sind (null, Zahl, Text, Liste), fallen weg wie Teile mit unbekannter Norm (Fund F1 aus P2)
    if (!t || typeof t !== 'object' || Array.isArray(t)) continue;
    if ((t.norm !== '42001' && t.norm !== '27001') || (t.sprache !== 'de' && t.sprache !== 'en') || !t.eintraege || typeof t.eintraege !== 'object') continue;
    const eintraege: Record<NormId, NormEintrag> = {};
    for (const [id, e] of Object.entries(t.eintraege)) {
      if (!/^(K-\d|A\.\d|27001-)/.test(id) || !e || typeof e !== 'object') continue;
      eintraege[id] = { titel: str(e.titel, 300), text: str(e.text), ...(e.manuell ? { manuell: true } : {}) };
    }
    teile.push({ norm: t.norm, sprache: t.sprache, bezeichnung: str(t.bezeichnung, 120), ausgabe: str(t.ausgabe, 20), ...(t.amd ? { amd: str(t.amd, 40) } : {}), quelle: str(t.quelle, 200), importiert: str(t.importiert, 40), eintraege });
  }
  const l = (p.lizenz ?? {}) as Partial<Lizenzangaben>;
  const lizenz: Lizenzangaben = {
    dokumente: l.dokumente === true,
    lizenzgeber: str(l.lizenzgeber, 200),
    lizenznummer: str(l.lizenznummer, 100),
    ...(l.bestaetigtAm ? { bestaetigtAm: str(l.bestaetigtAm, 40) } : {}),
    ...(l.dokumente === true && l.dokumenteBestaetigtAm ? { dokumenteBestaetigtAm: str(l.dokumenteBestaetigtAm, 40) } : {}),
  };
  return { format: 'aims-normpaket', version: 1, teile, lizenz };
}

export async function ladeNormpaket(): Promise<void> {
  const a = await holeAblage();
  const text = await a.lesen(SCHLUESSEL).catch(() => null);
  if (!text) return;
  try {
    normpaket.value = pruefeNormpaket(jsonLesen(text, 'normpaket'));
  } catch {
    /* beschädigt: leer lassen */
  }
}

export async function speichereNormpaket(p: Normpaket): Promise<void> {
  normpaket.value = p;
  const a = await holeAblage();
  await a.schreiben(SCHLUESSEL, JSON.stringify(p));
}

/** «Normtexte löschen»: Paket mit allen Normtexten und den Lizenzangaben aus dem Browser entfernen. */
export async function loescheNormtexte(): Promise<void> {
  normpaket.value = leeresNormpaket();
  const a = await holeAblage();
  await a.loeschen(SCHLUESSEL);
}

/** Teil aufnehmen: ersetzt denselben Teil (Norm und Sprache). Ein PDF nur mit der Änderung ergänzt den vorhandenen Teil. */
export function mitTeil(p: Normpaket, teil: NormTeil, nurAenderung = false): Normpaket {
  const alt = p.teile.find((t) => t.norm === teil.norm && t.sprache === teil.sprache);
  if (nurAenderung && alt) {
    const neu: NormTeil = { ...alt, amd: teil.amd ?? alt.amd, eintraege: { ...alt.eintraege } };
    for (const [id, e] of Object.entries(teil.eintraege)) {
      const vorhanden = neu.eintraege[id];
      neu.eintraege[id] = vorhanden ? { ...vorhanden, text: [vorhanden.text, e.text].filter(Boolean).join('\n') } : e;
    }
    return { ...p, teile: p.teile.map((t) => (t === alt ? neu : t)) };
  }
  return { ...p, teile: [...p.teile.filter((t) => t !== alt), teil] };
}

export function ohneTeil(p: Normpaket, norm: NormTeil['norm'], sprache: NormTeil['sprache']): Normpaket {
  return { ...p, teile: p.teile.filter((t) => !(t.norm === norm && t.sprache === sprache)) };
}

/** Exportdatei «Normpaket» zur Wiederverwendung auf einem anderen Rechner der Firma (ohne die Dokument-Bestätigung). */
export function normpaketExport(p: Normpaket, hinweis: string): string {
  return `${JSON.stringify({ format: p.format, version: p.version, hinweis, teile: p.teile, lizenz: { dokumente: false, lizenzgeber: p.lizenz.lizenzgeber, lizenznummer: p.lizenz.lizenznummer } }, null, 1)}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Anzeige in der App: zuerst Normpaket, sonst eigener Kurztitel und eigene Erläuterung

const quelle = () => ({ teile: normpaket.value.teile, eigen: (s: string) => inhalt(s) });

/** Titel zur ID (K-4.1, A.2.2, A.2, 27001-5.1): Normtitel aus dem Normpaket, sonst eigener Kurztitel */
export function normTitel(id: NormId): string | undefined {
  return normText(quelle(), id, 'titel', uiSprache.value);
}

/** Anforderungs- oder Control-Text aus dem Normpaket, sonst die eigene Erläuterung des Kits */
export function normErlaeuterung(id: NormId): string | undefined {
  return normText(quelle(), id, 'text', uiSprache.value);
}

/**
 * Rückfall-Regel: Liegt der Normtext nur in der anderen Sprache vor, zeigt die App diesen. Gibt dann die Sprache des
 * angezeigten Normtexts zurück (zur Kennzeichnung «Normtext Englisch»), sonst undefined.
 */
export function normtextFremdsprache(id: NormId, art: NormArt = 'text'): NormSprache | undefined {
  const n = normEintrag(normpaket.value.teile, id, uiSprache.value);
  if (!n || !(art === 'titel' ? n.eintrag.titel : n.eintrag.text)) return undefined;
  return n.teil.sprache !== uiSprache.value ? n.teil.sprache : undefined;
}

export function ausNorm(id: NormId, art: NormArt): boolean {
  return hatNormtext(normpaket.value.teile, id, art, uiSprache.value);
}

/** Laufzeitparameter für den Generator: nur nach der Bestätigung für Dokumente, sonst nichts. */
export function normtexteFuerDokumente(p: Normpaket = normpaket.value): NormtexteLaufzeit | undefined {
  if (!p.lizenz.dokumente || !p.teile.length) return undefined;
  return { teile: p.teile, lizenzgeber: p.lizenz.lizenzgeber, lizenznummer: p.lizenz.lizenznummer };
}

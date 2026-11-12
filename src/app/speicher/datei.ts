// Öffnen und Speichern der Projektdatei: File System Access (Chromium) oder Dateiauswahl plus Download.

import type { DateiHandle, DateiZugriff, GeoeffneteDatei, SpeicherErgebnis } from './typen.ts';
import { GRENZEN } from '../../eingang/grenzen.ts';
import { liesTextBegrenzt } from '../../eingang/lesen.ts';

export const DATEITYP = {
  description: 'AIMS-Projekt',
  accept: { 'application/json': ['.json'] },
} as const;

/** Nicht in lib.dom: Auswahldialoge der File System Access API. */
export interface FsaGlobal {
  showOpenFilePicker?: (o?: {
    types?: (typeof DATEITYP)[];
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    id?: string;
  }) => Promise<DateiHandle[]>;
  showSaveFilePicker?: (o?: { types?: (typeof DATEITYP)[]; suggestedName?: string; id?: string }) => Promise<DateiHandle>;
}

/** Obergrenze für das Lesen: `text()` liefert bei sehr grossen Dateien still einen leeren Text. Gleich MAX_BYTES beim Laden. */
export const MAX_DATEI_BYTES = GRENZEN.projektdatei.maxBytes;

/** Datei ist zu gross für eine Projektdatei; sie wird gar nicht erst gelesen. */
export class DateiZuGrossFehler extends Error {
  constructor(readonly bytes: number) {
    super(`${(bytes / 1048576).toFixed(0)} MB`);
    this.name = 'DateiZuGrossFehler';
  }
}

/**
 * Dateiname der Sicherung vor einer Migration (AF-004): `<name>.vor-v<X>.aims.json`, X = Version der Datei. Endungen
 * `.aims.json` und `.json` fallen vorher weg, damit der Name nicht doppelt endet.
 */
export function sicherungsName(dateiname: string, version: number): string {
  return `${sichererDateiname(dateiname).replace(/\.aims\.json$/, '')}.vor-v${version}.aims.json`;
}

function istAbbruch(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'name' in e && (e as { name: unknown }).name === 'AbortError';
}

async function schreibeHandle(handle: DateiHandle, inhalt: string): Promise<void> {
  // Schreibrecht kann nach dem Öffnen fehlen; requestPermission braucht eine Benutzeraktion.
  if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    const r = await handle.requestPermission?.({ mode: 'readwrite' });
    if (r !== 'granted') throw new Error('Schreibrecht für die Datei verweigert');
  }
  const w = await handle.createWritable();
  await w.write(new Blob([inhalt], { type: 'application/json' }));
  await w.close();
}

/** Chromium: dieselbe Datei öffnen und wieder überschreiben. */
export class FsaDateiZugriff implements DateiZugriff {
  readonly art = 'fsa' as const;
  constructor(private readonly g: FsaGlobal) {}

  async oeffnen(): Promise<GeoeffneteDatei | null> {
    const zeige = this.g.showOpenFilePicker;
    if (!zeige) throw new Error('showOpenFilePicker fehlt');
    let handles: DateiHandle[];
    try {
      handles = await zeige.call(this.g, { types: [DATEITYP], multiple: false, id: 'aims-projekt' });
    } catch (e) {
      if (istAbbruch(e)) return null;
      throw e;
    }
    const handle = handles[0];
    if (!handle) return null;
    const datei = await handle.getFile();
    if (datei.size > MAX_DATEI_BYTES) throw new DateiZuGrossFehler(datei.size);
    return { name: datei.name, inhalt: await liesTextBegrenzt(datei, 'projektdatei'), handle };
  }

  async speichern(inhalt: string, vorschlag: string, handle?: DateiHandle): Promise<SpeicherErgebnis | null> {
    let ziel = handle;
    if (!ziel) {
      const zeige = this.g.showSaveFilePicker;
      if (!zeige) throw new Error('showSaveFilePicker fehlt');
      try {
        ziel = await zeige.call(this.g, { types: [DATEITYP], suggestedName: vorschlag, id: 'aims-projekt' });
      } catch (e) {
        if (istAbbruch(e)) return null;
        throw e;
      }
    }
    await schreibeHandle(ziel, inhalt);
    return { art: 'datei', name: ziel.name, handle: ziel };
  }
}

/** Was der Fallback vom Dokument braucht. */
export interface DokumentUmgebung {
  document: Document;
  URL: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  setTimeout: (f: () => void, ms: number) => unknown;
}

/** Firefox, Safari: Dateiauswahl über input[type=file], Speichern als Download. */
export class FallbackDateiZugriff implements DateiZugriff {
  readonly art = 'fallback' as const;
  constructor(private readonly u: DokumentUmgebung) {}

  /** Muss direkt aus einem Klick heraus aufgerufen werden (Benutzeraktivierung). */
  oeffnen(): Promise<GeoeffneteDatei | null> {
    const doc = this.u.document;
    const eingabe = doc.createElement('input');
    eingabe.type = 'file';
    eingabe.accept = '.json,application/json';
    eingabe.hidden = true;
    doc.body.append(eingabe);
    return new Promise<GeoeffneteDatei | null>((ok, fehler) => {
      const fertig = (): void => eingabe.remove();
      eingabe.addEventListener(
        'change',
        () => {
          const datei = eingabe.files?.[0];
          fertig();
          if (!datei) {
            ok(null);
            return;
          }
          if (datei.size > MAX_DATEI_BYTES) {
            fehler(new DateiZuGrossFehler(datei.size));
            return;
          }
          liesTextBegrenzt(datei, 'projektdatei').then((inhalt) => ok({ name: datei.name, inhalt }), fehler);
        },
        { once: true },
      );
      // «cancel» feuert in aktuellen Engines beim Abbrechen des Dialogs.
      eingabe.addEventListener(
        'cancel',
        () => {
          fertig();
          ok(null);
        },
        { once: true },
      );
      eingabe.click();
    });
  }

  async speichern(inhalt: string, vorschlag: string): Promise<SpeicherErgebnis> {
    const doc = this.u.document;
    const url = this.u.URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = vorschlag;
    a.hidden = true;
    doc.body.append(a);
    a.click();
    a.remove();
    // Zu frühes Freigeben bricht den Download in Firefox und Safari ab.
    this.u.setTimeout(() => this.u.URL.revokeObjectURL(url), 60_000);
    return { art: 'download', name: vorschlag };
  }
}

/** Dateiname mit Endung .aims.json, ohne Zeichen, die Windows und macOS ablehnen. */
export function sichererDateiname(roh: string, rueckfall = 'projekt'): string {
  const ohneEndung = roh.replace(/\.aims\.json$|\.json$/i, '');
  const sauber = ohneEndung
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);
  return `${sauber || rueckfall}.aims.json`;
}

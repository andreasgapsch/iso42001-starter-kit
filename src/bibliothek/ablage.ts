// Speicher der Bibliotheksdateien mit zwei Umsetzungen derselben Schnittstelle:
//   OrdnerAblage    verbundener Ordner über File System Access (Edge, Chrome), echte Dateien
//   SchluesselAblage Browserspeicher (IndexedDB in Firefox und Safari) über eine Schlüssel-Wert-Schnittstelle
// Beide Umsetzungen kennen nur Pfade relativ zum Bibliotheksordner (layout.ts).
import type { DateiStand } from './abgleich.ts';
import { pfadSicher, REGISTER_DATEI } from './layout.ts';
import { GRENZEN } from '../eingang/grenzen.ts';
import { liesBegrenzt } from '../eingang/lesen.ts';

/** Grösste Datei, die ganz in den Speicher geladen wird: Vorschau, Sicherung, Browserspeicher */
export const SPEICHER_MAX_BYTES = GRENZEN.bibliotheksdatei.maxBytes;

/** Die Datei ist zu gross, um sie ganz zu lesen; schreiben und herunterladen geht im Ordner trotzdem */
export class DateiZuGrossFehler extends Error {
  override readonly name = 'DateiZuGrossFehler';
  constructor(readonly pfad: string) {
    super(`Datei zu gross: ${pfad}`);
  }
}

export interface BibliothekAblage {
  readonly art: 'ordner' | 'browser';
  /** Anzeigename (Ordnername oder «Browserspeicher») */
  readonly name: string;
  /** Schreibt die Datei (legt Ordner an) und liefert ihren Stand danach */
  schreiben(pfad: string, daten: Uint8Array): Promise<DateiStand>;
  /** Wirft NotFoundError, wenn die Datei fehlt */
  lesen(pfad: string): Promise<Uint8Array>;
  /** Alle Dateien (rekursiv) ohne Inhalt */
  liste(): Promise<DateiStand[]>;
  loeschen(pfad: string): Promise<void>;
  /** Nur Ordner: Datei schreiben, ohne sie zu laden (strömend, keine Grössengrenze ausser dem Datenträger) */
  schreibenStrom?(pfad: string, daten: Blob): Promise<DateiStand>;
  /** Nur Ordner: Datei als Verweis auf den Datenträger, ohne sie zu laden. Wirft NotFoundError, wenn sie fehlt */
  blob?(pfad: string): Promise<Blob>;
}

export class AblageFehler extends Error {
  constructor(override readonly name: 'NotFoundError' | 'NotReadableError' | 'NotAllowedError' | 'TypeError', meldung: string) {
    super(meldung);
  }
}

function pruefePfad(pfad: string): string[] {
  if (!pfadSicher(pfad)) throw new AblageFehler('TypeError', `Ungültiger Pfad: ${pfad}`);
  return pfad.split('/');
}

// ---------- Ordner (File System Access) ----------

/** Minimale Sicht auf FileSystemFileHandle */
export interface DateiGriff {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(d: BufferSource | Blob): Promise<void>; close(): Promise<void> }>;
}

/** Minimale Sicht auf FileSystemDirectoryHandle (auch für Test-Doppel) */
export interface OrdnerGriff {
  readonly kind: 'directory';
  readonly name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<OrdnerGriff>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<DateiGriff>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterable<OrdnerGriff | DateiGriff>;
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export class OrdnerAblage implements BibliothekAblage {
  readonly art = 'ordner' as const;
  constructor(private readonly wurzel: OrdnerGriff) {}
  get name(): string {
    return this.wurzel.name;
  }

  private async ordner(teile: string[], anlegen: boolean): Promise<OrdnerGriff> {
    let o = this.wurzel;
    for (const t of teile) o = await o.getDirectoryHandle(t, { create: anlegen });
    return o;
  }

  private async datei(pfad: string, anlegen = false): Promise<DateiGriff> {
    const teile = pruefePfad(pfad);
    const o = await this.ordner(teile.slice(0, -1), anlegen);
    return o.getFileHandle(teile.at(-1)!, { create: anlegen });
  }

  async schreiben(pfad: string, daten: Uint8Array): Promise<DateiStand> {
    const h = await this.datei(pfad, true);
    const w = await h.createWritable();
    await w.write(daten as BufferSource);
    await w.close();
    const f = await h.getFile();
    return { pfad, groesse: f.size, geaendert: f.lastModified };
  }

  async schreibenStrom(pfad: string, daten: Blob): Promise<DateiStand> {
    const h = await this.datei(pfad, true);
    const w = await h.createWritable();
    await w.write(daten);
    await w.close();
    const f = await h.getFile();
    return { pfad, groesse: f.size, geaendert: f.lastModified };
  }

  async blob(pfad: string): Promise<Blob> {
    return (await this.datei(pfad)).getFile();
  }

  async lesen(pfad: string): Promise<Uint8Array> {
    const f = await (await this.datei(pfad)).getFile();
    if (f.size > SPEICHER_MAX_BYTES) throw new DateiZuGrossFehler(pfad);
    return liesBegrenzt(f, 'bibliotheksdatei');
  }

  async liste(): Promise<DateiStand[]> {
    const aus: DateiStand[] = [];
    const lauf = async (o: OrdnerGriff, praefix: string, tiefe: number): Promise<void> => {
      if (tiefe > 6) return;
      for await (const h of o.values()) {
        const pfad = praefix ? `${praefix}/${h.name}` : h.name;
        if (h.kind === 'directory') await lauf(h, pfad, tiefe + 1);
        else {
          try {
            const f = await h.getFile();
            aus.push({ pfad, groesse: f.size, geaendert: f.lastModified });
          } catch (x) {
            // Platzhalter nur in der Cloud (OneDrive ohne Netz) oder gesperrt
            if ((x as { name?: string }).name !== 'NotFoundError') aus.push({ pfad, groesse: 0, geaendert: 0, nichtLokal: true });
          }
        }
      }
    };
    await lauf(this.wurzel, '', 0);
    return aus.sort((a, b) => a.pfad.localeCompare(b.pfad));
  }

  async loeschen(pfad: string): Promise<void> {
    const teile = pruefePfad(pfad);
    const o = await this.ordner(teile.slice(0, -1), false);
    await o.removeEntry(teile.at(-1)!);
  }
}

/** Berechtigung des Ordners: «granted», «prompt» (ein Klick nötig) oder «denied» */
export async function berechtigung(o: OrdnerGriff, fragen: boolean): Promise<PermissionState> {
  const q = await o.queryPermission?.({ mode: 'readwrite' });
  if (q === 'granted' || !fragen) return q ?? 'granted';
  return (await o.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
}

// ---------- Browserspeicher ----------

/** Eintrag im Browserspeicher: Inhalt als ArrayBuffer (WebKit speichert unter file:// keine Blobs) */
export interface GespeicherteDatei {
  daten: ArrayBuffer;
  geaendert: number;
}

/** Schlüssel-Wert-Ablage für Dateien (IndexedDB im Browser, Map in Tests) */
export interface DateiSchluesselAblage {
  lesen(k: string): Promise<GespeicherteDatei | undefined>;
  schreiben(k: string, w: GespeicherteDatei): Promise<void>;
  loeschen(k: string): Promise<void>;
  schluessel(praefix: string): Promise<string[]>;
}

export class SpeicherDateiAblage implements DateiSchluesselAblage {
  readonly daten = new Map<string, GespeicherteDatei>();
  async lesen(k: string) {
    return this.daten.get(k);
  }
  async schreiben(k: string, w: GespeicherteDatei) {
    this.daten.set(k, w);
  }
  async loeschen(k: string) {
    this.daten.delete(k);
  }
  async schluessel(praefix: string) {
    return [...this.daten.keys()].filter((k) => k.startsWith(praefix));
  }
}

/** Bibliothek im Browserspeicher, je Projekt ein eigener Bereich (Schlüssel «<projektId>/<pfad>») */
export class SchluesselAblage implements BibliothekAblage {
  readonly art = 'browser' as const;
  constructor(
    private readonly kv: DateiSchluesselAblage,
    private readonly projektId: string,
    readonly name = 'Browserspeicher',
    private readonly jetzt: () => number = () => Date.now(),
  ) {}
  private k(pfad: string): string {
    pruefePfad(pfad);
    return `${this.projektId}/${pfad}`;
  }
  async schreiben(pfad: string, daten: Uint8Array): Promise<DateiStand> {
    const geaendert = this.jetzt();
    const kopie = daten.slice().buffer as ArrayBuffer;
    await this.kv.schreiben(this.k(pfad), { daten: kopie, geaendert });
    return { pfad, groesse: daten.byteLength, geaendert };
  }
  async lesen(pfad: string): Promise<Uint8Array> {
    const w = await this.kv.lesen(this.k(pfad));
    if (!w) throw new AblageFehler('NotFoundError', `Datei fehlt: ${pfad}`);
    return new Uint8Array(w.daten);
  }
  async liste(): Promise<DateiStand[]> {
    const praefix = `${this.projektId}/`;
    const aus: DateiStand[] = [];
    for (const k of await this.kv.schluessel(praefix)) {
      const w = await this.kv.lesen(k);
      if (w) aus.push({ pfad: k.slice(praefix.length), groesse: w.daten.byteLength, geaendert: w.geaendert });
    }
    return aus.sort((a, b) => a.pfad.localeCompare(b.pfad));
  }
  async loeschen(pfad: string): Promise<void> {
    await this.kv.loeschen(this.k(pfad));
  }
}

/** Register (bibliothek.json) in der Ablage lesen; null, wenn es fehlt oder unlesbar ist */
export async function registerLesen(a: BibliothekAblage): Promise<string | null> {
  try {
    return new TextDecoder().decode(await a.lesen(REGISTER_DATEI));
  } catch {
    return null;
  }
}

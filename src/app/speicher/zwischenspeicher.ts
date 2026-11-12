// Ablagen für Zwischenstände: IndexedDB, Fallback localStorage, Fallback Arbeitsspeicher.

import { technikText } from './technik.ts';
import type { ZwischenspeicherAdapter, ZwischenspeicherArt } from './typen.ts';

/** Nur im Arbeitsspeicher. Für Tests und als letzter Fallback. */
export class SpeicherAdapter implements ZwischenspeicherAdapter {
  readonly art = 'speicher' as const;
  private readonly daten = new Map<string, string>();

  async lesen(schluessel: string): Promise<string | null> {
    return this.daten.get(schluessel) ?? null;
  }
  async schreiben(schluessel: string, wert: string): Promise<void> {
    this.daten.set(schluessel, wert);
  }
  async loeschen(schluessel: string): Promise<void> {
    this.daten.delete(schluessel);
  }
  async schluessel(praefix: string): Promise<string[]> {
    return [...this.daten.keys()].filter((k) => k.startsWith(praefix));
  }
}

/** Sicht auf window.localStorage (in Tests ersetzbar). */
export type SchluesselAblage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export class LocalStorageAdapter implements ZwischenspeicherAdapter {
  readonly art = 'localstorage' as const;
  constructor(private readonly ablage: SchluesselAblage) {}

  async lesen(schluessel: string): Promise<string | null> {
    return this.ablage.getItem(schluessel);
  }
  async schreiben(schluessel: string, wert: string): Promise<void> {
    // QuotaExceededError geht an den Aufrufer (Anzeige «Zwischenspeicher voll»).
    this.ablage.setItem(schluessel, wert);
  }
  async loeschen(schluessel: string): Promise<void> {
    this.ablage.removeItem(schluessel);
  }
  async schluessel(praefix: string): Promise<string[]> {
    const alle: string[] = [];
    for (let i = 0; i < this.ablage.length; i++) {
      const k = this.ablage.key(i);
      if (k !== null && k.startsWith(praefix)) alle.push(k);
    }
    return alle;
  }
}

const STORE = 'zwischenstaende';

function anfrage<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fehler) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error ?? new Error('IndexedDB-Fehler'));
  });
}

/** IndexedDB mit einem Objektspeicher (Schlüssel = Zeichenkette, Wert = Zeichenkette). */
export class IndexedDbAdapter implements ZwischenspeicherAdapter {
  readonly art = 'indexeddb' as const;
  private constructor(private readonly db: IDBDatabase) {}

  /** Öffnet die Datenbank; wirft bei Fehler oder Zeitüberschreitung (z. B. privater Modus, file:// gesperrt). */
  static async oeffnen(fabrik: IDBFactory, name = 'aims-manager', zeitlimitMs = 3000): Promise<IndexedDbAdapter> {
    const db = await new Promise<IDBDatabase>((ok, fehler) => {
      const t = setTimeout(() => fehler(new Error('IndexedDB: Zeitüberschreitung')), zeitlimitMs);
      let r: IDBOpenDBRequest;
      try {
        r = fabrik.open(name, 1);
      } catch (e) {
        clearTimeout(t);
        fehler(e instanceof Error ? e : new Error(technikText(e)));
        return;
      }
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => {
        clearTimeout(t);
        ok(r.result);
      };
      r.onerror = () => {
        clearTimeout(t);
        fehler(r.error ?? new Error('IndexedDB nicht verfügbar'));
      };
      r.onblocked = () => {
        clearTimeout(t);
        fehler(new Error('IndexedDB blockiert'));
      };
    });
    return new IndexedDbAdapter(db);
  }

  private store(modus: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, modus).objectStore(STORE);
  }

  /** Wartet, bis die Schreibtransaktion abgeschlossen ist (erst dann ist der Wert dauerhaft). */
  private schreibe(aktion: (s: IDBObjectStore) => void): Promise<void> {
    return new Promise((ok, fehler) => {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => ok();
      tx.onerror = () => fehler(tx.error ?? new Error('IndexedDB-Schreibfehler'));
      tx.onabort = () => fehler(tx.error ?? new Error('IndexedDB-Abbruch'));
      aktion(tx.objectStore(STORE));
    });
  }

  async lesen(schluessel: string): Promise<string | null> {
    const wert: unknown = await anfrage(this.store('readonly').get(schluessel));
    return typeof wert === 'string' ? wert : null;
  }
  schreiben(schluessel: string, wert: string): Promise<void> {
    return this.schreibe((s) => s.put(wert, schluessel));
  }
  loeschen(schluessel: string): Promise<void> {
    return this.schreibe((s) => s.delete(schluessel));
  }
  async schluessel(praefix: string): Promise<string[]> {
    const alle = await anfrage(this.store('readonly').getAllKeys());
    return alle.filter((k): k is string => typeof k === 'string' && k.startsWith(praefix));
  }
}

/** Was die Auswahl braucht; in Tests durch Attrappen ersetzbar. */
export interface Umgebung {
  indexedDB?: IDBFactory;
  localStorage?: SchluesselAblage;
}

const PROBE = 'aims-manager:probe';

/** Prüft eine Ablage mit Schreiben, Lesen, Löschen. */
async function probe(a: ZwischenspeicherAdapter): Promise<boolean> {
  const wert = String(Date.now());
  await a.schreiben(PROBE, wert);
  const ok = (await a.lesen(PROBE)) === wert;
  await a.loeschen(PROBE);
  return ok;
}

/** Zugriff auf localStorage selbst kann werfen (Firefox mit gesperrten Cookies, Sandbox). */
function holeLocalStorage(u: Umgebung): SchluesselAblage | undefined {
  try {
    return u.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export interface Auswahl {
  adapter: ZwischenspeicherAdapter;
  /** Begründung je verworfener Stufe, für Diagnose und «Fehlerbericht kopieren». */
  verworfen: Partial<Record<ZwischenspeicherArt, string>>;
}

/** Fallback-Kette IndexedDB → localStorage → Arbeitsspeicher, jeweils mit Probe. */
export async function waehleZwischenspeicher(u: Umgebung, optionen: { zeitlimitMs?: number } = {}): Promise<Auswahl> {
  const verworfen: Auswahl['verworfen'] = {};
  if (u.indexedDB) {
    try {
      const a = await IndexedDbAdapter.oeffnen(u.indexedDB, 'aims-manager', optionen.zeitlimitMs);
      if (await probe(a)) return { adapter: a, verworfen };
      verworfen.indexeddb = 'Probe fehlgeschlagen';
    } catch (e) {
      verworfen.indexeddb = technikText(e);
    }
  } else {
    verworfen.indexeddb = 'nicht vorhanden';
  }
  const ls = holeLocalStorage(u);
  if (ls) {
    try {
      const a = new LocalStorageAdapter(ls);
      if (await probe(a)) return { adapter: a, verworfen };
      verworfen.localstorage = 'Probe fehlgeschlagen';
    } catch (e) {
      verworfen.localstorage = technikText(e);
    }
  } else {
    verworfen.localstorage = 'nicht vorhanden';
  }
  return { adapter: new SpeicherAdapter(), verworfen };
}

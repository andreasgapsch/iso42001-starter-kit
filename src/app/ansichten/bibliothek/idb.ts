// IndexedDB der Bibliothek (eigene Datenbank «aims-bibliothek»): Dateien des Browserspeichers und Ordner-Handles.
// Dateien als ArrayBuffer, weil WebKit unter file:// keine Blobs in IndexedDB ablegt (Spike Bibliotheksordner).
import type { DateiSchluesselAblage, GespeicherteDatei, OrdnerGriff } from '../../../bibliothek/ablage.ts';

const NAME = 'aims-bibliothek';
let db: Promise<IDBDatabase> | null = null;

function oeffnen(): Promise<IDBDatabase> {
  db ??= new Promise<IDBDatabase>((ok, fehler) => {
    const t = setTimeout(() => fehler(new Error('IndexedDB: Zeitüberschreitung')), 4000);
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      for (const s of ['dateien', 'griffe']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
    };
    r.onsuccess = () => {
      clearTimeout(t);
      ok(r.result);
    };
    r.onerror = () => {
      clearTimeout(t);
      fehler(r.error ?? new Error('IndexedDB nicht verfügbar'));
    };
  }).catch((e: unknown) => {
    db = null;
    throw e;
  });
  return db;
}

async function anfrage<T>(store: string, modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await oeffnen();
  return new Promise<T>((ok, fehler) => {
    const tx = d.transaction(store, modus);
    let wert: T;
    const r = f(tx.objectStore(store));
    r.onsuccess = () => (wert = r.result);
    tx.oncomplete = () => ok(wert);
    tx.onerror = () => fehler(tx.error ?? r.error ?? new Error('IndexedDB-Fehler'));
    tx.onabort = () => fehler(tx.error ?? new Error('IndexedDB-Abbruch'));
  });
}

export const idbDateien: DateiSchluesselAblage = {
  lesen: (k) => anfrage<GespeicherteDatei | undefined>('dateien', 'readonly', (s) => s.get(k)),
  schreiben: async (k, w) => void (await anfrage('dateien', 'readwrite', (s) => s.put(w, k))),
  loeschen: async (k) => void (await anfrage('dateien', 'readwrite', (s) => s.delete(k))),
  schluessel: async (praefix) => (await anfrage('dateien', 'readonly', (s) => s.getAllKeys(IDBKeyRange.bound(praefix, `${praefix}\uffff`)))).map(String),
};

/** Ordner-Handle je Projekt merken; Test-Doppel ohne klonbare Handles werden still nicht gemerkt */
export async function griffMerken(projektId: string, g: OrdnerGriff | null): Promise<void> {
  try {
    await anfrage<unknown>('griffe', 'readwrite', (s) => (g ? s.put(g, `ordner:${projektId}`) : s.delete(`ordner:${projektId}`)) as IDBRequest<unknown>);
  } catch {
    /* DataCloneError oder kein IndexedDB: Ordner muss beim nächsten Öffnen neu gewählt werden */
  }
}

export async function griffLesen(projektId: string): Promise<OrdnerGriff | null> {
  try {
    const roh = await anfrage<unknown>('griffe', 'readonly', (s) => s.get(`ordner:${projektId}`));
    if (!roh) return null;
    // E2E: Test-Doppel des Ordners nach dem Neuladen wiederbeleben (echte Handles kommen unverändert zurück)
    const wieder = (globalThis as { __aimsOrdnerWiederbeleben?: (r: unknown) => OrdnerGriff | null }).__aimsOrdnerWiederbeleben;
    const g = (wieder?.(roh) ?? roh) as OrdnerGriff;
    // Nur ein brauchbares Handle (mit Methoden) gilt; sonst muss der Ordner neu gewählt werden
    return typeof g.getDirectoryHandle === 'function' && typeof g.values === 'function' ? g : null;
  } catch {
    return null;
  }
}

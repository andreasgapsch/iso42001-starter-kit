// Einheitentests: Fallback-Kette, localStorage-Adapter, Fähigkeiten, Dateizugriff mit Attrappen.

import { describe, expect, it } from 'vitest';
import {
  FallbackDateiZugriff,
  FsaDateiZugriff,
  LocalStorageAdapter,
  ProjektSpeicher,
  erkenneFaehigkeiten,
  erkenneFsa,
  erstelleProjektSpeicher,
  pruefeLocalStorage,
  sichererDateiname,
  waehleZwischenspeicher,
  type BrowserUmgebung,
  type DateiHandle,
  type SchluesselAblage,
} from '../../src/app/speicher/index.ts';

/** Map als Storage-Ersatz. */
class TestAblage implements SchluesselAblage {
  private m = new Map<string, string>();
  voll = false;
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.voll) throw new Error('QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

/** IDBFactory, deren open() sofort scheitert (wie Firefox im privaten Modus). */
function kaputteIdb(art: 'wirft' | 'fehler' | 'haengt'): IDBFactory {
  return {
    open() {
      if (art === 'wirft') throw new Error('SecurityError');
      const r: { error: Error; onerror?: ((e: Event) => void) | null } = { error: new Error('InvalidStateError') };
      if (art === 'fehler') setTimeout(() => r.onerror?.(new Event('error')), 0);
      return r as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}

describe('LocalStorageAdapter', () => {
  it('liest, schreibt, löscht und filtert Schlüssel nach Präfix', async () => {
    const a = new LocalStorageAdapter(new TestAblage());
    await a.schreiben('p:1', 'eins');
    await a.schreiben('p:2', 'zwei');
    await a.schreiben('q:1', 'andere');
    expect(await a.lesen('p:1')).toBe('eins');
    expect((await a.schluessel('p:')).sort()).toEqual(['p:1', 'p:2']);
    await a.loeschen('p:1');
    expect(await a.lesen('p:1')).toBeNull();
  });
});

describe('waehleZwischenspeicher', () => {
  it('fällt bei kaputter IndexedDB auf localStorage zurück', async () => {
    for (const art of ['wirft', 'fehler'] as const) {
      const r = await waehleZwischenspeicher({ indexedDB: kaputteIdb(art), localStorage: new TestAblage() });
      expect(r.adapter.art).toBe('localstorage');
      expect(r.verworfen.indexeddb).toMatch(/SecurityError|InvalidStateError/);
    }
  });

  it('bricht hängende IndexedDB nach dem Zeitlimit ab', async () => {
    const r = await waehleZwischenspeicher(
      { indexedDB: kaputteIdb('haengt'), localStorage: new TestAblage() },
      { zeitlimitMs: 20 },
    );
    expect(r.adapter.art).toBe('localstorage');
    expect(r.verworfen.indexeddb).toMatch(/Zeitüberschreitung/);
  });

  it('fällt ohne beides auf den Arbeitsspeicher zurück', async () => {
    const voll = new TestAblage();
    voll.voll = true;
    expect((await waehleZwischenspeicher({})).adapter.art).toBe('speicher');
    const r = await waehleZwischenspeicher({ localStorage: voll });
    expect(r.adapter.art).toBe('speicher');
    expect(r.verworfen).toEqual({ indexeddb: 'nicht vorhanden', localstorage: 'QuotaExceededError' });
  });

  it('übersteht einen werfenden localStorage-Getter', async () => {
    const u = {
      get localStorage(): SchluesselAblage {
        throw new Error('SecurityError');
      },
    };
    expect((await waehleZwischenspeicher(u)).verworfen.localstorage).toBe('nicht vorhanden');
    expect(pruefeLocalStorage(u)).toBe(false);
  });
});

describe('Fähigkeiten', () => {
  const picker = { showOpenFilePicker: async () => [], showSaveFilePicker: async () => ({}) as DateiHandle };

  it('FSA nur mit beiden Dialogen, sicherem Kontext und ohne iframe', () => {
    expect(erkenneFsa({ ...picker, isSecureContext: true })).toEqual({ oeffnen: true, speichern: true });
    expect(erkenneFsa({ ...picker, isSecureContext: false })).toEqual({ oeffnen: false, speichern: false });
    expect(erkenneFsa({ ...picker, self: 1, top: 2 }).oeffnen).toBe(false);
    expect(erkenneFsa({ isSecureContext: true })).toEqual({ oeffnen: false, speichern: false });
  });

  it('meldet localStorage auch, wenn IndexedDB fehlt', async () => {
    const r = await erkenneFaehigkeiten({ localStorage: new TestAblage() });
    expect(r.faehigkeiten).toEqual({
      fsaOeffnen: false,
      fsaSpeichern: false,
      indexedDb: false,
      localStorage: true,
      zwischenspeicher: 'localstorage',
    });
  });
});

describe('FsaDateiZugriff', () => {
  function handle(name: string, inhalt = ''): DateiHandle & { geschrieben: string[] } {
    const geschrieben: string[] = [];
    return {
      kind: 'file',
      name,
      geschrieben,
      getFile: async () => new File([inhalt], name),
      createWritable: async () => ({
        write: async (d: Blob | string) => {
          geschrieben.push(typeof d === 'string' ? d : await d.text());
        },
        close: async () => {},
      }),
      queryPermission: async () => 'prompt',
      requestPermission: async () => 'granted',
    };
  }

  it('öffnet, speichert auf dasselbe Handle und ruft die Dialoge mit Empfänger auf', async () => {
    const h = handle('a.aims.json', '{"x":1}');
    const g = {
      showOpenFilePicker(this: unknown) {
        if (this !== g) throw new TypeError('Illegal invocation');
        return Promise.resolve([h]);
      },
      showSaveFilePicker(this: unknown) {
        if (this !== g) throw new TypeError('Illegal invocation');
        return Promise.resolve(handle('neu.aims.json'));
      },
    };
    const z = new FsaDateiZugriff(g);
    const d = await z.oeffnen();
    expect(d).toMatchObject({ name: 'a.aims.json', inhalt: '{"x":1}' });
    await z.speichern('{"x":2}', 'egal', d!.handle);
    expect(h.geschrieben).toEqual(['{"x":2}']);
    expect((await z.speichern('{}', 'neu.aims.json'))?.name).toBe('neu.aims.json');
  });

  it('Abbruch (AbortError) ergibt null, andere Fehler werfen, verweigertes Recht wirft', async () => {
    const abbruch = Object.assign(new Error('abgebrochen'), { name: 'AbortError' });
    const z = new FsaDateiZugriff({
      showOpenFilePicker: () => Promise.reject(abbruch),
      showSaveFilePicker: () => Promise.reject(abbruch),
    });
    expect(await z.oeffnen()).toBeNull();
    expect(await z.speichern('{}', 'x')).toBeNull();
    const kaputt = new FsaDateiZugriff({ showOpenFilePicker: () => Promise.reject(new Error('NotAllowed')) });
    await expect(kaputt.oeffnen()).rejects.toThrow('NotAllowed');
    await expect(kaputt.speichern('{}', 'x')).rejects.toThrow('showSaveFilePicker fehlt');
    const leer = new FsaDateiZugriff({ showOpenFilePicker: async () => [] });
    expect(await leer.oeffnen()).toBeNull();
    const ohne = { ...handle('r.json'), requestPermission: async () => 'denied' as const };
    await expect(new FsaDateiZugriff({}).speichern('{}', 'x', ohne)).rejects.toThrow('verweigert');
    await expect(new FsaDateiZugriff({}).oeffnen()).rejects.toThrow('showOpenFilePicker fehlt');
  });
});

describe('FallbackDateiZugriff.speichern', () => {
  it('stösst einen Download an und gibt die Blob-URL verzögert frei', async () => {
    const klicks: { href: string; download: string }[] = [];
    const freigegeben: string[] = [];
    let spaeter: (() => void) | undefined;
    let wartezeit = 0;
    const a = {
      href: '',
      download: '',
      hidden: false,
      click() {
        klicks.push({ href: this.href, download: this.download });
      },
      remove() {},
    };
    const z = new FallbackDateiZugriff({
      document: { createElement: () => a, body: { append() {} } } as unknown as Document,
      URL: { createObjectURL: () => 'blob:1', revokeObjectURL: (u: string) => void freigegeben.push(u) },
      setTimeout: (f, ms) => {
        spaeter = f;
        wartezeit = ms;
      },
    });
    expect(await z.speichern('{}', 'p.aims.json')).toEqual({ art: 'download', name: 'p.aims.json' });
    expect(klicks).toEqual([{ href: 'blob:1', download: 'p.aims.json' }]);
    expect(freigegeben).toEqual([]);
    expect(wartezeit).toBeGreaterThanOrEqual(10_000);
    spaeter?.();
    expect(freigegeben).toEqual(['blob:1']);
  });
});

describe('sichererDateiname', () => {
  it('entfernt verbotene Zeichen und setzt die Endung', () => {
    expect(sichererDateiname('Muster AG')).toBe('Muster AG.aims.json');
    expect(sichererDateiname('a/b:c*?"<>|d')).toBe('abcd.aims.json');
    expect(sichererDateiname('x.aims.json')).toBe('x.aims.json');
    expect(sichererDateiname('...')).toBe('projekt.aims.json');
    expect(sichererDateiname('', 'leer')).toBe('leer.aims.json');
    expect(sichererDateiname('a'.repeat(200))).toHaveLength(80 + '.aims.json'.length);
  });
});

describe('erstelleProjektSpeicher', () => {
  it('wählt FSA, wenn beide Dialoge da sind, sonst den Fallback', async () => {
    const basis = { localStorage: new TestAblage() } as unknown as BrowserUmgebung;
    const ohne = await erstelleProjektSpeicher<{ id: string }>({ schluesselVon: (p) => p.id }, basis);
    expect(ohne.speicher).toBeInstanceOf(ProjektSpeicher);
    expect(ohne.faehigkeiten.fsaSpeichern).toBe(false);
    const mit = await erstelleProjektSpeicher<{ id: string }>(
      { schluesselVon: (p) => p.id },
      { ...basis, showOpenFilePicker: async () => [], showSaveFilePicker: async () => ({}) } as unknown as BrowserUmgebung,
    );
    expect(mit.faehigkeiten).toMatchObject({ fsaOeffnen: true, fsaSpeichern: true, zwischenspeicher: 'localstorage' });
  });
});

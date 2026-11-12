// Testseite S1: bindet das produktive Speichermodul ein und stellt Proben für Playwright bereit.

import {
  FallbackDateiZugriff,
  FsaDateiZugriff,
  IndexedDbAdapter,
  LocalStorageAdapter,
  ProjektSpeicher,
  SpeicherAdapter,
  erstelleProjektSpeicher,
  type DateiHandle,
  type FsaGlobal,
} from '../../src/app/speicher/index.ts';

interface TestProjekt {
  id: string;
  organisation: string;
  werte: number[];
  text: string;
}

const ausgabe = document.getElementById('ausgabe') as HTMLPreElement;
const zeige = (x: unknown): void => {
  ausgabe.textContent = JSON.stringify(x, null, 2);
};

const optionen = {
  schluesselVon: (p: TestProjekt) => p.id,
  dateinameVon: (p: TestProjekt) => p.organisation,
  verzoegerungMs: 200,
};
const erkannt = await erstelleProjektSpeicher<TestProjekt>(optionen);
const { faehigkeiten, auswahl } = erkannt;
// ?zugriff=fallback erzwingt Dateiauswahl und Download (in Chromium sonst FSA, deren Dialoge nicht automatisierbar sind).
const speicher =
  new URLSearchParams(location.search).get('zugriff') === 'fallback'
    ? new ProjektSpeicher<TestProjekt>({ ...optionen, datei: new FallbackDateiZugriff(window), zwischen: auswahl.adapter })
    : erkannt.speicher;

/** Rohproben je Ablage, unabhängig von der Fallback-Wahl. */
async function idb(): Promise<IndexedDbAdapter | string> {
  try {
    return await IndexedDbAdapter.oeffnen(indexedDB, 'spike-s1');
  } catch (e) {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
}

/** FSA-Pfad mit OPFS-Handles statt Dialog (Dialoge lassen sich nicht automatisieren). */
async function fsaMitOpfs(inhalt: TestProjekt): Promise<unknown> {
  const wurzel = await navigator.storage.getDirectory();
  const handle = (await wurzel.getFileHandle('opfs-test.aims.json', { create: true })) as unknown as DateiHandle;
  const g: FsaGlobal = {
    showSaveFilePicker: async () => handle,
    showOpenFilePicker: async () => [handle],
  };
  const s = new ProjektSpeicher<TestProjekt>({
    datei: new FsaDateiZugriff(g),
    zwischen: new SpeicherAdapter(),
    schluesselVon: (p) => p.id,
  });
  s.neu(inhalt);
  const r1 = await s.speichern();
  s.aendern({ ...inhalt, werte: [...inhalt.werte, 99] });
  const r2 = await s.speichern();
  const zurueck = await s.oeffnen();
  return { r1: r1?.art, r2: r2?.art, direkt: s.status.direkt, projekt: zurueck?.projekt };
}

const s1 = {
  faehigkeiten,
  verworfen: auswahl.verworfen,
  umgebung: {
    href: location.href,
    origin: location.origin,
    isSecureContext,
    showOpenFilePicker: typeof (window as FsaGlobal).showOpenFilePicker,
    showSaveFilePicker: typeof (window as FsaGlobal).showSaveFilePicker,
    opfs: typeof navigator.storage?.getDirectory,
    persisted: await navigator.storage?.persisted?.().catch(() => null),
  },
  speicher,
  dateiZugriff: speicher !== erkannt.speicher ? 'fallback (erzwungen)' : faehigkeiten.fsaSpeichern ? 'fsa' : 'fallback',
  async idbSchreiben(k: string, v: string): Promise<string> {
    const a = await idb();
    if (typeof a === 'string') return a;
    await a.schreiben(k, v);
    return 'ok';
  },
  async idbLesen(k: string): Promise<string | null> {
    const a = await idb();
    return typeof a === 'string' ? `FEHLER ${a}` : a.lesen(k);
  },
  lsSchreiben(k: string, v: string): string {
    try {
      new LocalStorageAdapter(localStorage).schreiben(k, v);
      return 'ok';
    } catch (e) {
      return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
  },
  lsLesen(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return `FEHLER ${e instanceof Error ? e.name : String(e)}`;
    }
  },
  fsaMitOpfs,
};
Object.assign(window, { s1 });

document.getElementById('oeffnen')!.addEventListener('click', () => {
  speicher.oeffnen().then(
    (r) => zeige({ geoeffnet: r?.projekt ?? null, zwischenstand: r?.zwischenstand ?? null }),
    (e: unknown) => zeige({ fehler: String(e) }),
  );
});
document.getElementById('speichern')!.addEventListener('click', () => {
  speicher.speichern().then(
    (r) => zeige({ gespeichert: r }),
    (e: unknown) => zeige({ fehler: String(e) }),
  );
});
document.getElementById('speichern-unter')!.addEventListener('click', () => {
  speicher.speichernUnter().then(
    (r) => zeige({ gespeichert: r }),
    (e: unknown) => zeige({ fehler: String(e) }),
  );
});
window.addEventListener('beforeunload', (e) => {
  if (speicher.warnenBeimVerlassen()) e.preventDefault();
});
zeige({ bereit: true, faehigkeiten });
document.body.dataset['bereit'] = '1';

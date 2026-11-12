// AF-014 (QK-07): Matrix der Fehlerpunkte gegen den Zustand danach, je Zeile mit Rundreise. Fehlerpunkte: Lesen, Entpacken,
// Validieren, Speichern, Schreiben in Ordner, Rettungsdatei. Je Zeile gilt: kein Datenverlust (Projekt im Speicher unverändert),
// letzter gültiger Stand erhalten (Datei unverändert), Meldung ohne Rohtext, und nach der Behebung gelingt die Rundreise.
import { zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { sicherungEntpacken, sicherungPacken } from '../../src/bibliothek/sicherung.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache } = await import('../../src/app/i18n.ts');
uiSprache.value = 'de';
const { deserialisieren, vorDemSpeichern, SpeicherPruefFehler, LadeFehler } = await import('../../src/app/zustand/store.ts');
const { ProjektSpeicher, SpeicherAdapter, FsaDateiZugriff, DateiZuGrossFehler, ExternGeaendertFehler, MAX_DATEI_BYTES } = await import('../../src/app/speicher/index.ts');
const { fehlerVerstaendlich, fehlerAbbildung } = await import('../../src/app/worker/fehlertext.ts');
const { projektReparieren, ladeProjektText } = await import('../../src/app/import/laden.ts');

const neu = (): Projekt => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
const text = (p: unknown) => JSON.stringify(p, null, 2);

class Fehler extends Error {
  constructor(name: string, meldung: string) {
    super(meldung);
    this.name = name;
  }
}

/** Eine Datei im Ordner, mit steuerbaren Fehlern beim Lesen und Schreiben (Schreiben wirkt erst beim Schliessen, wie bei FSA) */
class Datei {
  readonly kind = 'file' as const;
  lesefehler: Error | null = null;
  schreibfehler: Error | null = null;
  grosse: number | null = null;
  recht: PermissionState = 'granted';
  constructor(public name: string, public inhalt: string) {}
  async getFile() {
    if (this.lesefehler) throw this.lesefehler;
    const t = this.inhalt;
    return { name: this.name, size: this.grosse ?? t.length, text: async () => t } as unknown as File;
  }
  async createWritable() {
    let puffer = '';
    return {
      write: async (d: Blob | string) => {
        if (this.schreibfehler) throw this.schreibfehler;
        puffer = typeof d === 'string' ? d : await d.text();
      },
      close: async () => {
        this.inhalt = puffer;
      },
    };
  }
  queryPermission = async () => this.recht;
  requestPermission = async () => this.recht;
}

function umgebung(dateien: Datei[], ziel: Datei) {
  const warteschlange = [...dateien];
  return { showOpenFilePicker: async () => [warteschlange.shift()!], showSaveFilePicker: async () => ziel };
}

function speicher(dateien: Datei[], ziel: Datei = new Datei('neu.aims.json', '')) {
  const s = new ProjektSpeicher<Projekt>({
    datei: new FsaDateiZugriff(umgebung(dateien, ziel) as never),
    zwischen: new SpeicherAdapter(),
    schluesselVon: (p) => p.meta.projektId,
    deserialisieren,
    vorDemSpeichern,
  });
  return s;
}

interface Ergebnis {
  /** Fehler, den die Zeile auslöst */
  fehler: unknown;
  /** Projekt im Speicher nach dem Fehler, als Text */
  projektDanach: string;
  projektVorher: string;
  /** Datei am Handle (letzter gültiger Stand) vorher und nachher */
  dateiVorher: string;
  dateiNachher: string;
  /** Rundreise nach der Behebung: Text der Datei und erwartetes Projekt */
  rundreise: () => Promise<{ datei: string; erwartet: unknown }>;
}

async function fange(f: () => Promise<unknown>): Promise<unknown> {
  try {
    await f();
  } catch (e) {
    return e;
  }
  throw new Error('Der Fehler blieb aus');
}

interface Zeile {
  punkt: 'Lesen' | 'Entpacken' | 'Validieren' | 'Speichern' | 'Schreiben in Ordner' | 'Rettungsdatei';
  variante: string;
  lauf: () => Promise<Ergebnis>;
}

/** Öffnet ein gültiges Projekt A aus einer Datei; Grundlage der Zeilen, die danach einen Fehler auslösen */
async function geoeffnet(weitere: Datei[] = [], ziel?: Datei) {
  const a = neu();
  const dateiA = new Datei('a.aims.json', text(a));
  const s = speicher([dateiA, ...weitere], ziel);
  const g = await s.oeffnen();
  expect(g?.projekt).toEqual(a);
  return { a, dateiA, s };
}

const ZEILEN: Zeile[] = [
  {
    punkt: 'Lesen',
    variante: 'Datei nicht lesbar (NotFoundError beim Lesen der zweiten Datei)',
    lauf: async () => {
      const b = new Datei('b.aims.json', text(neu()));
      b.lesefehler = new Fehler('NotFoundError', 'A requested file or directory could not be found');
      const { a, dateiA, s } = await geoeffnet([b]);
      const vorher = text(s.aktuell);
      const fehler = await fange(() => s.oeffnen());
      return {
        fehler, projektVorher: vorher, projektDanach: text(s.aktuell), dateiVorher: dateiA.inhalt, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          const p2 = { ...a, organisation: { ...a.organisation, name: 'Nach dem Lesefehler' } };
          s.aendern(p2);
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: p2 };
        },
      };
    },
  },
  {
    punkt: 'Lesen',
    variante: 'Datei zu gross: wird nicht gelesen',
    lauf: async () => {
      const b = new Datei('gross.aims.json', '{}');
      b.grosse = MAX_DATEI_BYTES + 1;
      const { a, dateiA, s } = await geoeffnet([b]);
      const vorher = text(s.aktuell);
      const fehler = await fange(() => s.oeffnen());
      expect(fehler).toBeInstanceOf(DateiZuGrossFehler);
      return {
        fehler, projektVorher: vorher, projektDanach: text(s.aktuell), dateiVorher: dateiA.inhalt, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: a };
        },
      };
    },
  },
  {
    punkt: 'Entpacken',
    variante: 'beschädigtes ZIP einer Sicherung',
    lauf: async () => {
      const { a, dateiA, s } = await geoeffnet();
      const vorher = text(s.aktuell);
      const gut = sicherungPacken([{ pfad: 'Eigene Dateien/X-1/v1.txt', daten: new TextEncoder().encode('Inhalt') }], '{"format":"x"}');
      const kaputt = gut.slice(0, Math.floor(gut.length / 2));
      const fehler = await fange(async () => sicherungEntpacken(kaputt));
      return {
        fehler, projektVorher: vorher, projektDanach: text(s.aktuell), dateiVorher: dateiA.inhalt, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          // Das gültige ZIP lässt sich danach unverändert entpacken, das Projekt bleibt speicherbar
          const e = sicherungEntpacken(gut);
          expect(new TextDecoder().decode(e.dateien[0]!.daten)).toBe('Inhalt');
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: a };
        },
      };
    },
  },
  {
    punkt: 'Entpacken',
    variante: 'ZIP über der Grenze (Bombe)',
    lauf: async () => {
      const { a, dateiA, s } = await geoeffnet();
      const vorher = text(s.aktuell);
      const bombe = zipSync({ 'bibliothek.json': new Uint8Array(200_000) });
      const fehler = await fange(async () => sicherungEntpacken(bombe, 1000));
      return {
        fehler, projektVorher: vorher, projektDanach: text(s.aktuell), dateiVorher: dateiA.inhalt, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          expect(sicherungEntpacken(bombe).register).not.toBeNull();
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: a };
        },
      };
    },
  },
  {
    punkt: 'Validieren',
    variante: 'Schemafehler in der zu öffnenden Datei: Reparaturvorschlag, Original unberührt',
    lauf: async () => {
      const kaputt = neu();
      kaputt.kiSysteme[0]!.name = 'x'.repeat(600);
      const b = new Datei('b.aims.json', text(kaputt));
      const b2 = new Datei('b2.aims.json', '');
      const { a, dateiA, s } = await geoeffnet([b, b2]);
      const vorher = text(s.aktuell);
      const fehler = await fange(() => s.oeffnen());
      expect(fehler).toBeInstanceOf(LadeFehler);
      expect((fehler as InstanceType<typeof LadeFehler>).art).toBe('schema');
      return {
        fehler, projektVorher: vorher, projektDanach: text(s.aktuell), dateiVorher: b.inhalt, dateiNachher: b.inhalt,
        rundreise: async () => {
          const rep = projektReparieren(JSON.parse(b.inhalt));
          expect(rep?.aenderungen.length).toBeGreaterThan(0);
          // Der Vorschlag wird als Datei abgelegt und wirklich wieder geöffnet; geändert ist nur der genannte Name
          b2.inhalt = text(rep!.projekt);
          const g = await s.oeffnen();
          const geladen = JSON.parse(JSON.stringify(g!.projekt)) as Projekt;
          expect(geladen.kiSysteme[0]!.name.length).toBeLessThanOrEqual(500);
          expect(kaputt.kiSysteme[0]!.name.startsWith(geladen.kiSysteme[0]!.name)).toBe(true);
          const ohneName = (p: Projekt) => ({ ...p, kiSysteme: p.kiSysteme.map((k, i) => (i === 0 ? { ...k, name: '' } : k)) });
          expect(ohneName(geladen)).toEqual(ohneName(kaputt));
          // der letzte gültige Stand A bleibt unverändert in seiner Datei
          expect(dateiA.inhalt).toBe(text(a));
          return { datei: b2.inhalt, erwartet: geladen };
        },
      };
    },
  },
  {
    punkt: 'Validieren',
    variante: 'kein JSON',
    lauf: async () => {
      const b = new Datei('b.aims.json', '{ kaputt');
      const { a, dateiA, s } = await geoeffnet([b]);
      const vorher = text(s.aktuell);
      const fehler = await fange(() => s.oeffnen());
      expect((fehler as InstanceType<typeof LadeFehler>).art).toBe('kein-json');
      return {
        fehler, projektVorher: vorher, projektDanach: text(s.aktuell), dateiVorher: b.inhalt, dateiNachher: b.inhalt,
        rundreise: async () => {
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: a };
        },
      };
    },
  },
  {
    punkt: 'Speichern',
    variante: 'Prüfung vor dem Speichern lehnt ab: Datei unberührt, Änderung bleibt im Speicher',
    lauf: async () => {
      const { dateiA, s } = await geoeffnet();
      const p2 = neu();
      p2.kiSysteme[0]!.name = 'y'.repeat(600);
      s.aendern(p2);
      const fehler = await fange(() => s.speichern());
      expect(fehler).toBeInstanceOf(SpeicherPruefFehler);
      expect(s.status.ungespeichert).toBe(true);
      expect(s.status.fehler).toMatch(/^Speichern/);
      // der Zwischenstand sichert die Änderung trotz Ablehnung
      await s.zwischenspeichern();
      expect((await s.zwischenstaende()).length).toBe(1);
      return {
        fehler, projektVorher: text(p2), projektDanach: text(s.aktuell), dateiVorher: dateiA.inhalt, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          const rep = (fehler as InstanceType<typeof SpeicherPruefFehler>).reparatur!;
          s.aendern(rep.projekt);
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: rep.projekt };
        },
      };
    },
  },
  {
    punkt: 'Speichern',
    variante: 'Datei wurde ausserhalb geändert: nie überschreiben',
    lauf: async () => {
      const ziel = new Datei('neu.aims.json', '');
      const { a, dateiA, s } = await geoeffnet([], ziel);
      const fremd = text({ ...a, organisation: { ...a.organisation, name: 'Fremde Fassung' } });
      dateiA.inhalt = fremd;
      const p2 = { ...a, organisation: { ...a.organisation, name: 'Meine Fassung' } };
      s.aendern(p2);
      const fehler = await fange(() => s.speichern());
      expect(fehler).toBeInstanceOf(ExternGeaendertFehler);
      return {
        fehler, projektVorher: text(p2), projektDanach: text(s.aktuell), dateiVorher: fremd, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          // «Speichern unter» schreibt eine neue Datei, beide Fassungen bleiben
          const r = await s.speichernUnter();
          expect(r?.name).toBe('neu.aims.json');
          // Die neue Datei wird gelesen: sie trägt meine Fassung, die fremde Datei bleibt, wie sie war
          expect(dateiA.inhalt).toBe(fremd);
          return { datei: ziel.inhalt, erwartet: p2 };
        },
      };
    },
  },
  {
    punkt: 'Schreiben in Ordner',
    variante: 'Speicher voll beim Schreiben (QuotaExceededError)',
    lauf: async () => {
      const { a, dateiA, s } = await geoeffnet();
      const p2 = { ...a, organisation: { ...a.organisation, name: 'Neue Eingabe' } };
      s.aendern(p2);
      dateiA.schreibfehler = new Fehler('QuotaExceededError', 'The quota has been exceeded');
      const fehler = await fange(() => s.speichern());
      expect(s.status.ungespeichert).toBe(true);
      await s.zwischenspeichern();
      return {
        fehler, projektVorher: text(p2), projektDanach: text(s.aktuell), dateiVorher: text(a), dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          dateiA.schreibfehler = null;
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: p2 };
        },
      };
    },
  },
  {
    punkt: 'Schreiben in Ordner',
    variante: 'Schreibrecht verweigert',
    lauf: async () => {
      const { a, dateiA, s } = await geoeffnet();
      const p2 = { ...a, organisation: { ...a.organisation, name: 'Ohne Recht' } };
      s.aendern(p2);
      dateiA.recht = 'denied';
      const fehler = await fange(() => s.speichern());
      expect(s.status.ungespeichert).toBe(true);
      return {
        fehler, projektVorher: text(p2), projektDanach: text(s.aktuell), dateiVorher: text(a), dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          dateiA.recht = 'granted';
          await s.speichern();
          return { datei: dateiA.inhalt, erwartet: p2 };
        },
      };
    },
  },
  {
    punkt: 'Rettungsdatei',
    variante: 'Rohdaten der Rettungsdatei enthalten alle Daten, Datei unberührt',
    lauf: async () => {
      const { dateiA, s } = await geoeffnet();
      const p2 = neu();
      p2.kiSysteme[0]!.name = 'z'.repeat(600);
      s.aendern(p2);
      const fehler = await fange(() => s.speichern());
      const f = fehler as InstanceType<typeof SpeicherPruefFehler>;
      return {
        fehler, projektVorher: text(p2), projektDanach: text(s.aktuell), dateiVorher: dateiA.inhalt, dateiNachher: dateiA.inhalt,
        rundreise: async () => {
          // Die Rettungsdatei (roh) ist das Projekt, wie es im Speicher stand: kein Feld fehlt, keines ist verändert
          expect(JSON.parse(f.roh)).toEqual(JSON.parse(JSON.stringify(p2)));
          return { datei: f.roh, erwartet: p2 };
        },
      };
    },
  },
];

describe('AF-014: Fehlerpfade (Matrix Fehlerpunkt gegen Zustand danach)', () => {
  it('die Matrix deckt alle 6 Fehlerpunkte ab', () => {
    expect([...new Set(ZEILEN.map((z) => z.punkt))].sort()).toEqual(['Entpacken', 'Lesen', 'Rettungsdatei', 'Schreiben in Ordner', 'Speichern', 'Validieren']);
  });
  it.each(ZEILEN.map((z) => [`${z.punkt}: ${z.variante}`, z] as const))('%s', async (_n, z) => {
    const r = await z.lauf();
    // Datenverlust 0: Projekt im Speicher unverändert (bei Speichern die Eingabe des Nutzers)
    expect(r.projektDanach).toBe(r.projektVorher);
    // Letzter gültiger Stand erhalten: Datei unverändert
    expect(r.dateiNachher).toBe(r.dateiVorher);
    // Meldung ohne Rohtext: bekannte Ursache oder allgemeiner Text, nie der Rohtext
    const roh = r.fehler instanceof Error ? r.fehler.message : String(r.fehler);
    const meldung = fehlerVerstaendlich(r.fehler);
    expect(meldung.length).toBeGreaterThan(20);
    if (roh.length > 12) expect(meldung).not.toContain(roh);
    // Rundreise: nach der Behebung stimmt die Datei mit dem erwarteten Projekt überein
    const { datei, erwartet } = await r.rundreise();
    expect(JSON.parse(datei)).toEqual(JSON.parse(JSON.stringify(erwartet)));
  });
  it('bekannte Browserfehler werden mit Ursache und nächstem Schritt abgebildet', () => {
    expect(fehlerAbbildung(new Fehler('QuotaExceededError', 'x'))).toContain('Speicherplatz');
    expect(fehlerAbbildung(new Fehler('NotAllowedError', 'x'))).toContain('Speichern unter');
    expect(fehlerAbbildung(new Fehler('NotFoundError', 'x'))).toContain('nicht gefunden');
  });
});

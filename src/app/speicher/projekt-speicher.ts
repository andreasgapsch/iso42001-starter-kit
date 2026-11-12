// ProjektSpeicher: Projektdatei ist die Wahrheit, der Zwischenspeicher schützt vor Verlust.
// Ablauf: oeffnen/neu → aendern (verzögert zwischenspeichern) → speichern (FSA oder Download) → wiederherstellen.

import { sichererDateiname, sicherungsName } from './datei.ts';
import { technikText } from './technik.ts';
import { EingangsFehler, jsonAusVertrauen, jsonLesen, liesTextBegrenzt } from '../../eingang/lesen.ts';
import { GRENZEN } from '../../eingang/grenzen.ts';
import type { DateiHandle, DateiZugriff, SpeicherErgebnis, Zwischenstand, ZwischenspeicherAdapter } from './typen.ts';

export const PRAEFIX = 'aims-manager:zwischenstand:';

/** Gesicherte Stände bleiben höchstens so viele Tage im Browser (AF-032); Einstellungen und Hinweis nennen dieselbe Zahl */
export const AUFBEWAHRUNG_TAGE = 30;

export interface Zeitgeber {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface ProjektSpeicherOptionen<T> {
  datei: DateiZugriff;
  zwischen: ZwischenspeicherAdapter;
  /** Stabile Projektkennung (z. B. meta.projektId); bestimmt den Schlüssel im Zwischenspeicher. */
  schluesselVon(projekt: T): string;
  /** Vorschlag für den Dateinamen, z. B. aus dem Organisationsnamen. */
  dateinameVon?(projekt: T): string;
  serialisieren?(projekt: T): string;
  /** Darf werfen (ungültige Datei); Migrationen gehören hierher. */
  deserialisieren?(text: string): T;
  /**
   * Wie deserialisieren, meldet aber zusätzlich, ob die Datei migriert wurde (AF-004) oder neuer ist als bekannt und darum nur
   * lesend geöffnet wird (AF-005). Fehlt sie, gilt deserialisieren ohne beides.
   */
  deserialisierenMitInfo?(text: string): { projekt: T; migration?: { von: number; nach: number }; nurLesen?: { version: number; bekannt: number } };
  /**
   * Prüft das Projekt, bevor es in eine Datei geht: Die App schreibt nie eine Datei, die sie selbst nicht mehr öffnen kann.
   * Liefert das (allenfalls reparierte) Projekt oder wirft; dann bleibt die Datei unberührt.
   */
  vorDemSpeichern?(projekt: T): T;
  verzoegerungMs?: number;
  jetzt?(): Date;
  zeitgeber?: Zeitgeber;
}

export interface Status {
  ungespeichert: boolean;
  /** Zeitpunkt (ISO) der letzten Speicherung in eine Datei oder als Download in dieser Sitzung */
  gespeichertAm: string | null;
  /** Datei aus einer neueren Version: nur lesend, Schreiben gesperrt (AF-005) */
  nurLesen: { version: number; bekannt: number } | null;
  dateiname: string | null;
  /** Speichern geht direkt in die geöffnete Datei (nur File System Access). */
  direkt: boolean;
  letzterZwischenstand: string | null;
  fehler: string | null;
}

/** Ursprüngliche Datei vor einer Migration (AF-004): wird angeboten, bevor sie überschrieben wird */
export interface Sicherung {
  /** `<name>.vor-v<X>.aims.json` */
  name: string;
  /** Unveränderter Text der Datei */
  inhalt: string;
  von: number;
  nach: number;
}

export interface Geoeffnet<T> {
  projekt: T;
  /** Ein ungesicherter Zwischenstand desselben Projekts, der von der Datei abweicht. */
  zwischenstand: Zwischenstand | null;
  /** Gesetzt bei jeder Migration beim Öffnen */
  sicherung: Sicherung | null;
  /** Datei aus einer neueren Version: das Projekt ist nur zum Lesen offen (AF-005) */
  nurLesen: { version: number; bekannt: number } | null;
}

/** Schreiben in ein nur lesend geöffnetes Projekt (AF-005) */
export class NurLesendFehler extends Error {
  constructor() {
    super('Projekt ist nur lesend geöffnet');
    this.name = 'NurLesendFehler';
  }
}

/** Datei am Dateihandle weicht vom zuletzt gelesenen oder geschriebenen Stand ab: nicht überschrieben. */
export class ExternGeaendertFehler extends Error {
  constructor(readonly dateiname: string) {
    super(`Datei ausserhalb geändert: ${dateiname}`);
    this.name = 'ExternGeaendertFehler';
  }
}

export class ProjektSpeicher<T> {
  private projekt: T | null = null;
  private handle: DateiHandle | undefined;
  private dateiname: string | null = null;
  private ungespeichert = false;
  private gespeichertAm: string | null = null;
  private nurLesend: { version: number; bekannt: number } | null = null;
  private letzterZwischenstand: string | null = null;
  private fehler: string | null = null;
  /** Auf Wunsch keine Zwischenstände im Browser (gemeinsam genutzter Rechner, lizenzierte Inhalte) */
  ohneZwischenspeicher = false;
  private timer: unknown = null;
  private laufend: Promise<void> = Promise.resolve();
  private readonly hoerer = new Set<(s: Status) => void>();
  private readonly o: Required<Omit<ProjektSpeicherOptionen<T>, 'dateinameVon' | 'vorDemSpeichern' | 'deserialisierenMitInfo'>> &
    Pick<ProjektSpeicherOptionen<T>, 'dateinameVon' | 'vorDemSpeichern' | 'deserialisierenMitInfo'>;

  constructor(optionen: ProjektSpeicherOptionen<T>) {
    this.o = {
      serialisieren: (p) => JSON.stringify(p, null, 2),
      deserialisieren: (t) => jsonLesen(t, 'projektdatei') as T,
      verzoegerungMs: 2000,
      jetzt: () => new Date(),
      zeitgeber: { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id as number) },
      ...optionen,
    };
    this.sitzungSeit = this.o.jetzt().toISOString();
  }

  get status(): Status {
    return {
      ungespeichert: this.ungespeichert,
      gespeichertAm: this.gespeichertAm,
      nurLesen: this.nurLesend,
      dateiname: this.dateiname,
      direkt: this.handle !== undefined,
      letzterZwischenstand: this.letzterZwischenstand,
      fehler: this.fehler,
    };
  }

  get aktuell(): T | null {
    return this.projekt;
  }

  /** Ablage der Zwischenstände (zum Leeren, AF-032) */
  get zwischenspeicher(): ZwischenspeicherAdapter {
    return this.o.zwischen;
  }

  get zwischenspeicherArt(): ZwischenspeicherAdapter['art'] {
    return this.o.zwischen.art;
  }

  /** Meldet jede Statusänderung (für Signals in der UI). Liefert die Abmeldung. */
  beobachten(f: (s: Status) => void): () => void {
    this.hoerer.add(f);
    f(this.status);
    return () => this.hoerer.delete(f);
  }

  private melden(): void {
    const s = this.status;
    for (const f of this.hoerer) f(s);
  }

  private schluessel(p: T): string {
    return PRAEFIX + this.schluesselEintrag(p);
  }

  private schluesselEintrag(p: T): string {
    const id = this.o.schluesselVon(p);
    return this.eigenerSchluessel ? `${id}~${this.sitzung}` : id;
  }

  private vorschlag(p: T): string {
    return this.dateiname ?? sichererDateiname(this.o.dateinameVon?.(p) ?? '');
  }

  /** Inhalt der Datei am Handle beim letzten Öffnen oder Speichern: Vergleichsstand gegen ein Überschreiben fremder Änderungen */
  private dateiStand: string | null = null;
  /** Kennung dieser Sitzung; ein zweiter Tab schreibt seine Stände unter eigenem Schlüssel (E-13) */
  private readonly sitzung = globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random()}`;
  private readonly sitzungSeit: string;
  private eigenerSchluessel = false;
  /** Ein anderer Tab schreibt denselben Stand (auch ohne BroadcastChannel erkannt, z. B. WebKit über file://) */
  beiFremdemSchreiber: (() => void) | null = null;

  /** Offene Änderungen des bisherigen Projekts sofort sichern: ein Wechsel darf die letzte Eingabe nicht verwerfen. */
  private bisherigesSichern(): void {
    if (this.projekt !== null && this.ungespeichert) void this.zwischenspeichern();
    else this.abbrechenTimer();
  }

  /** Neues Projekt; noch keine Datei. */
  neu(projekt: T, vorschlag: string | null = null): void {
    this.bisherigesSichern();
    this.projekt = projekt;
    this.handle = undefined;
    this.dateiStand = null;
    this.dateiname = vorschlag;
    this.eigenerSchluessel = false;
    this.nurLesend = null;
    this.gespeichertAm = null;
    this.ungespeichert = true;
    this.melden();
    this.planen();
  }

  /**
   * Projekt schliessen (Beenden). Offene Änderungen werden vorher als Zwischenstand gesichert, ausser `sichern` ist false
   * (z. B. weil der Zwischenspeicher gleich geleert wird): dann schreibt nichts mehr.
   */
  async schliessen(optionen: { sichern?: boolean } = {}): Promise<void> {
    if (optionen.sichern === false) this.abbrechenTimer();
    else this.bisherigesSichern();
    await this.laufend;
    this.projekt = null;
    this.handle = undefined;
    this.dateiStand = null;
    this.dateiname = null;
    this.ungespeichert = false;
    this.nurLesend = null;
    this.gespeichertAm = null;
    this.letzterZwischenstand = null;
    this.eigenerSchluessel = false;
    this.melden();
  }

  /** Datei wählen und laden. Null = abgebrochen. Wirft bei ungültigem Inhalt (Projekt bleibt unverändert). */
  async oeffnen(): Promise<Geoeffnet<T> | null> {
    // Dialog zuerst aufrufen, bevor etwas anderes awaited wird (Benutzeraktivierung).
    const datei = await this.o.datei.oeffnen();
    if (!datei) return null;
    const gelesen = this.o.deserialisierenMitInfo ? this.o.deserialisierenMitInfo(datei.inhalt) : { projekt: this.o.deserialisieren(datei.inhalt) };
    const projekt = gelesen.projekt;
    const migration = 'migration' in gelesen ? gelesen.migration : undefined;
    const nurLesen = ('nurLesen' in gelesen ? gelesen.nurLesen : undefined) ?? null;
    this.bisherigesSichern();
    // Sicherung abwarten: Dieselbe Datei erneut geöffnet liest sonst den alten Stand, und die Frage nach dem neueren entfällt
    await this.laufend;
    this.projekt = projekt;
    this.handle = datei.handle;
    this.dateiStand = datei.handle ? datei.inhalt : null;
    this.dateiname = datei.name;
    this.ungespeichert = false;
    this.fehler = null;
    this.eigenerSchluessel = false;
    this.nurLesend = nurLesen;
    this.gespeichertAm = null;
    this.melden();
    // Nur lesend: weder ein Zwischenstand gelesen noch eine Wiederherstellung angeboten; nichts wird geschrieben (AF-005)
    const z = nurLesen ? null : await this.lesenZwischenstand(this.schluessel(projekt));
    const abweichend = z && !z.gesichertAm && z.inhalt !== this.o.serialisieren(projekt) ? z : null;
    const sicherung: Sicherung | null = migration ? { name: sicherungsName(datei.name, migration.von), inhalt: datei.inhalt, von: migration.von, nach: migration.nach } : null;
    return { projekt, zwischenstand: abweichend, sicherung, nurLesen };
  }

  /** Sicherung der Datei vor der Migration ablegen: Download oder «Speichern unter», je nach Browser (AF-004). Null = abgebrochen. */
  sicherungAblegen(s: Sicherung): Promise<SpeicherErgebnis | null> {
    return this.o.datei.speichern(s.inhalt, s.name);
  }

  /** Jede Änderung im Projekt; der Zwischenstand folgt nach der Verzögerung. */
  aendern(projekt: T): void {
    // Nur lesend geöffnet: keine Änderung, kein Zwischenstand (AF-005)
    if (this.nurLesend) return;
    this.projekt = projekt;
    if (!this.ungespeichert) {
      this.ungespeichert = true;
      this.melden();
    }
    this.planen();
  }

  private planen(): void {
    this.abbrechenTimer();
    this.timer = this.o.zeitgeber.setTimeout(() => {
      this.timer = null;
      void this.zwischenspeichern();
    }, this.o.verzoegerungMs);
  }

  private abbrechenTimer(): void {
    if (this.timer !== null) this.o.zeitgeber.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Sofort zwischenspeichern (z. B. bei visibilitychange/pagehide). Schreibvorgänge laufen nacheinander. */
  zwischenspeichern(): Promise<void> {
    this.abbrechenTimer();
    const p = this.projekt;
    if (p === null || this.ohneZwischenspeicher || this.nurLesend) return this.laufend;
    const eintrag: Zwischenstand & { sitzung: string } = {
      v: 1,
      sitzung: this.sitzung,
      schluessel: this.schluesselEintrag(p),
      dateiname: this.vorschlag(p),
      geaendertAm: this.o.jetzt().toISOString(),
      inhalt: this.o.serialisieren(p),
    };
    if (!this.ungespeichert) {
      eintrag.gesichertAm = eintrag.geaendertAm;
      eintrag.gesichertAls = this.handle ? 'datei' : 'download';
    }
    this.laufend = this.laufend.then(async () => {
      try {
        // Ein anderer Tab hat seit dem Start dieser Sitzung denselben Stand geschrieben: nicht überschreiben, eigener Schlüssel
        if (!this.eigenerSchluessel) {
          const roh = await this.o.zwischen.lesen(this.schluessel(p));
          const da = roh ? (jsonAusVertrauen(roh, 'zwischenstand') as { sitzung?: string; geaendertAm?: string; gesichertAm?: string }) : null;
          if (da?.sitzung && da.sitzung !== this.sitzung && !da.gesichertAm && (da.geaendertAm ?? '') >= this.sitzungSeit) {
            this.eigenerSchluessel = true;
            eintrag.schluessel = this.schluesselEintrag(p);
            this.beiFremdemSchreiber?.();
          }
        }
        await this.o.zwischen.schreiben(this.schluessel(p), JSON.stringify(eintrag));
        this.letzterZwischenstand = eintrag.geaendertAm;
        this.fehler = null;
      } catch (e) {
        this.fehler = `Zwischenspeicher: ${technikText(e)}`;
      }
      this.melden();
    });
    return this.laufend;
  }

  /** Speichern: mit Handle in dieselbe Datei, sonst Dialog bzw. Download. Null = abgebrochen. */
  speichern(): Promise<SpeicherErgebnis | null> {
    return this.sichern(this.handle);
  }

  /** Datei ausserhalb geändert? Vergleicht den Inhalt, nicht nur die Zeit: Zweite Person, zweiter Tab, Kopie aus der Ablage. */
  private async externGeaendert(handle: DateiHandle): Promise<boolean> {
    if (this.dateiStand === null) return false;
    let aktuell: string;
    try {
      aktuell = await liesTextBegrenzt(await handle.getFile(), 'projektdatei');
    } catch (e) {
      // Datei verschwunden: nichts zu überschreiben. Anderer Fehler: lieber fragen als überschreiben
      return (e as { name?: string } | null)?.name !== 'NotFoundError';
    }
    return aktuell !== this.dateiStand;
  }

  /** Immer neue Datei wählen (bzw. Download). */
  speichernUnter(): Promise<SpeicherErgebnis | null> {
    return this.sichern(undefined);
  }

  private async sichern(handle: DateiHandle | undefined): Promise<SpeicherErgebnis | null> {
    if (this.projekt === null) throw new Error('Kein Projekt geladen');
    if (this.nurLesend) throw new NurLesendFehler();
    let p: T = this.projekt;
    if (this.o.vorDemSpeichern) {
      try {
        p = this.o.vorDemSpeichern(p) as T;
      } catch (e) {
        this.fehler = `Speichern: ${technikText(e)}`;
        this.melden();
        throw e;
      }
      this.projekt = p;
    }
    const inhalt = this.o.serialisieren(p);
    let r: SpeicherErgebnis | null;
    if (handle && (await this.externGeaendert(handle))) {
      this.fehler = `Speichern: ${handle.name}`;
      this.melden();
      throw new ExternGeaendertFehler(handle.name);
    }
    try {
      r = await this.o.datei.speichern(inhalt, this.vorschlag(p), handle);
    } catch (e) {
      this.fehler = `Speichern: ${technikText(e)}`;
      this.melden();
      throw e;
    }
    if (!r) return null;
    // Nur zurücksetzen, wenn seit Beginn nichts geändert wurde.
    if (this.projekt === p) this.ungespeichert = false;
    this.handle = r.handle ?? (r.art === 'datei' ? this.handle : undefined);
    this.dateiStand = this.handle ? inhalt : null;
    this.dateiname = r.name;
    this.gespeichertAm = this.o.jetzt().toISOString();
    this.fehler = null;
    this.melden();
    // Gesicherten Stand markieren statt löschen: ein Download kann verworfen werden.
    await this.zwischenspeichern();
    return r;
  }

  /** beforeunload: true = Warnung zeigen. */
  warnenBeimVerlassen(): boolean {
    return this.ungespeichert;
  }

  private async lesenZwischenstand(schluessel: string): Promise<Zwischenstand | null> {
    try {
      const roh = await this.o.zwischen.lesen(schluessel);
      // Eigene Hülle im Browserspeicher: keine Eingangsgrenze, damit ein grosser Stand nie still verschwindet (N5); der
      // Projekttext darin läuft beim Wiederherstellen über die Grenze der Projektdatei und meldet sich dort
      return roh === null ? null : pruefeZwischenstand(jsonAusVertrauen(roh, 'zwischenstand'));
    } catch {
      return null;
    }
  }

  /** Alle Zwischenstände, neueste zuerst; ohne Option nur ungesicherte (für den Wiederherstellungsdialog). */
  async zwischenstaende(optionen: { auchGesicherte?: boolean } = {}): Promise<Zwischenstand[]> {
    const liste: Zwischenstand[] = [];
    for (const k of await this.o.zwischen.schluessel(PRAEFIX)) {
      const z = await this.lesenZwischenstand(k);
      if (z && (optionen.auchGesicherte || !z.gesichertAm)) liste.push(z);
    }
    return liste.sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
  }

  /** Übernimmt einen Zwischenstand als aktuelles Projekt (ungespeichert, ohne Dateihandle). */
  async wiederherstellen(schluessel: string): Promise<T> {
    const z = await this.lesenZwischenstand(PRAEFIX + schluessel);
    if (!z) throw new Error('Zwischenstand nicht gefunden');
    // Grösser als eine Projektdatei: mit Meldung abbrechen, der Zwischenstand bleibt im Browser (nicht verwerfen)
    const grenze = GRENZEN.projektdatei.maxBytes;
    if (z.inhalt.length > grenze) throw new EingangsFehler('projektdatei', 'zwischenstand-gross', grenze, z.inhalt.length);
    const projekt = this.o.deserialisieren(z.inhalt);
    // Handle nur behalten, wenn dasselbe Projekt geöffnet ist (Wiederherstellung direkt nach oeffnen()).
    const gleich = this.projekt !== null && this.o.schluesselVon(this.projekt) === z.schluessel;
    // Anderes Projekt offen: dessen offene Änderungen vorher sichern; beim selben Projekt ersetzt der Stand gerade diese
    if (gleich) this.abbrechenTimer();
    else this.bisherigesSichern();
    this.projekt = projekt;
    this.nurLesend = null;
    if (!gleich) {
      this.handle = undefined;
      this.dateiStand = null;
      this.dateiname = z.dateiname;
      this.gespeichertAm = null;
    }
    this.ungespeichert = true;
    this.melden();
    return projekt;
  }

  /** Gesicherte Stände befristen: Was längst in einer Datei liegt, soll nicht unbegrenzt im Browser bleiben. */
  async aufraeumen(tage: number): Promise<number> {
    const grenze = this.o.jetzt().getTime() - tage * 86_400_000;
    let n = 0;
    for (const z of await this.zwischenstaende({ auchGesicherte: true })) {
      if (!z.gesichertAm) continue;
      const t = Date.parse(z.gesichertAm);
      if (Number.isFinite(t) && t < grenze) {
        await this.verwerfen(z.schluessel);
        n++;
      }
    }
    return n;
  }

  async verwerfen(schluessel: string): Promise<void> {
    await this.o.zwischen.loeschen(PRAEFIX + schluessel);
  }
}

/** Formatprüfung beim Lesen, damit kaputte Einträge den Dialog nicht stören. */
export function pruefeZwischenstand(x: unknown): Zwischenstand | null {
  if (typeof x !== 'object' || x === null) return null;
  const z = x as Record<string, unknown>;
  if (z['v'] !== 1) return null;
  if (typeof z['schluessel'] !== 'string' || typeof z['inhalt'] !== 'string') return null;
  if (typeof z['geaendertAm'] !== 'string' || typeof z['dateiname'] !== 'string') return null;
  if (z['gesichertAm'] !== undefined && typeof z['gesichertAm'] !== 'string') return null;
  return x as Zwischenstand;
}

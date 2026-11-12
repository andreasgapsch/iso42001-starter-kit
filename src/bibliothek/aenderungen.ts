// Änderungen an der Bibliothek auf einem Projektentwurf (zustand.aendereMit). Rein: keine Dateien, kein Browser.
// Quelle der Metadaten: Firmendokumente mit Registereintrag im Dokumentenregister (Projekt.dokumente), Nachweise im
// Register der Nachweise (Projekt.nachweise); alles andere in Projekt.bibliothek. So bleibt nichts doppelt.
import type { DokumentEintrag, Freigabe, Nachweis, Projekt } from '../model/typen.ts';
import type { Bibliothek, BibliothekArt, BibliothekEintrag, BibliothekStatus, BibliothekVerknuepfungen, BibliothekVersion } from './modell.ts';
import { naechsteVersion, neuesteVersion, statusFuerRegister, vergleicheVersion } from './sicht.ts';

export function bibliothekVon(p: Projekt, ablage?: Bibliothek['ablage']): Bibliothek {
  p.bibliothek ??= { eintraege: [] };
  if (ablage && !p.bibliothek.ablage) p.bibliothek.ablage = ablage;
  return p.bibliothek;
}

/**
 * Bibliothek einrichten (Anbindung der bestehenden Register): Dokumentenregister und Nachweise bleiben unverändert und
 * erscheinen über die Sicht als Einträge; es wird nichts kopiert, deshalb geht nichts verloren.
 */
export function einrichten(p: Projekt, ablage: NonNullable<Bibliothek['ablage']>, ordnerName?: string): Bibliothek {
  const b = bibliothekVon(p);
  b.ablage = ablage;
  if (ordnerName) b.ordnerName = ordnerName;
  else delete b.ordnerName;
  return b;
}

const register = (p: Projekt, id: string) => p.dokumente.find((d) => d.id === id);
const nachweis = (p: Projekt, id: string) => p.nachweise.find((n) => n.id === id);

/** Gespeicherten Eintrag holen oder anlegen */
export function eintragVon(p: Projekt, id: string, art: BibliothekArt, titel?: string): BibliothekEintrag {
  const b = bibliothekVon(p);
  let e = b.eintraege.find((x) => x.id === id);
  if (!e) {
    e = { id, art, versionen: [], ...(titel ? { titel } : {}) };
    b.eintraege.push(e);
  }
  return e;
}

/** Nächste freie Kennung mit Präfix (X-001, N-001) über Bibliothek und Register */
export function naechsteKennung(p: Projekt, praefix: 'X' | 'N'): string {
  const ids = [...(p.bibliothek?.eintraege ?? []).map((e) => e.id), ...p.nachweise.map((n) => n.id)];
  const re = new RegExp(`^${praefix}-(\\d+)$`);
  const max = ids.reduce((m, id) => Math.max(m, Number(re.exec(id)?.[1] ?? 0)), 0);
  return `${praefix}-${String(max + 1).padStart(3, '0')}`;
}

export interface Metadaten {
  titel?: string;
  eigner?: string;
  naechstePruefung?: string;
  normbezug?: string[];
  verknuepfungen?: BibliothekVerknuepfungen;
  beschreibung?: string;
  nachweisArt?: Nachweis['art'];
}

const setzeOderLoesche = <T extends object, K extends keyof T>(o: T, k: K, w: T[K] | undefined): void => {
  if (w === undefined || w === '' || (Array.isArray(w) && w.length === 0)) delete o[k];
  else o[k] = w;
};

/** Metadaten ändern; Register-Felder gehen ins Register. Werte undefined oder leer löschen das Feld. */
export function metadatenSetzen(p: Projekt, id: string, art: BibliothekArt, m: Metadaten): void {
  const r = art === 'firmendokument' ? register(p, id) : undefined;
  const n = art === 'nachweis' ? nachweis(p, id) : undefined;
  const e = eintragVon(p, id, art);
  if ('titel' in m) {
    if (n && m.titel?.trim()) n.titel = m.titel.trim();
    else setzeOderLoesche(e, 'titel', m.titel?.trim());
  }
  if ('eigner' in m) {
    if (r) setzeOderLoesche(r, 'eigner', m.eigner);
    else setzeOderLoesche(e, 'eigner', m.eigner);
  }
  if ('naechstePruefung' in m) {
    if (r) setzeOderLoesche(r, 'naechsteUeberpruefung', m.naechstePruefung);
    else setzeOderLoesche(e, 'naechstePruefung', m.naechstePruefung);
  }
  if ('normbezug' in m) setzeOderLoesche(e, 'normbezug', m.normbezug?.map((x) => x.trim()).filter(Boolean));
  if ('verknuepfungen' in m) {
    const v = Object.fromEntries(Object.entries(m.verknuepfungen ?? {}).filter(([, l]) => l && l.length)) as BibliothekVerknuepfungen;
    setzeOderLoesche(e, 'verknuepfungen', Object.keys(v).length ? v : undefined);
  }
  if ('beschreibung' in m) setzeOderLoesche(e, 'beschreibung', m.beschreibung?.trim());
  if ('nachweisArt' in m) {
    if (n && m.nachweisArt) n.art = m.nachweisArt;
    else setzeOderLoesche(e, 'nachweisArt', m.nachweisArt);
  }
}

/** Ablageort im Register: Pfad in der Bibliothek, Präfix in der Dokumentsprache */
export const ablageText = (pfad: string, sprache: 'de' | 'en' = 'de') => `${sprache === 'en' ? 'Library' : 'Bibliothek'}: ${pfad}`;
/** Ablageort wurde von der Bibliothek gesetzt (oder ist leer) und darf nachgeführt werden */
export const ablageVonBibliothek = (ort: string) => !ort.trim() || /^(Bibliothek|Library): /.test(ort);

/**
 * Neue Version anlegen. Firmendokumente und eigene Dateien als Entwurf, Nachweise gelten sofort (ältere ersetzt).
 * Neue Nachweise erscheinen im Register der Nachweise (Projekt.nachweise) mit Ablageort in der Bibliothek.
 */
export function versionHinzufuegen(p: Projekt, id: string, art: BibliothekArt, v: BibliothekVersion, o: { titel?: string; heute?: string; nachweisArt?: Nachweis['art'] } = {}): BibliothekEintrag {
  const e = eintragVon(p, id, art, art === 'nachweis' && nachweis(p, id) ? undefined : o.titel);
  if (e.versionen.some((x) => x.version === v.version)) throw new Error(`Version ${v.version} von ${id} gibt es schon`);
  e.versionen.push({ ...v, status: art === 'nachweis' ? 'freigegeben' : (v.status ?? 'entwurf') });
  if (art === 'nachweis') {
    for (const x of e.versionen) if (x !== e.versionen.at(-1) && x.status === 'freigegeben') x.status = 'ersetzt';
    const n = nachweis(p, id);
    if (!n) {
      p.nachweise.push({ id, titel: o.titel?.trim() || v.name || id, art: o.nachweisArt ?? e.nachweisArt ?? 'dokument', ablageort: ablageText(v.datei, p.meta.dokumentSprache), ...(o.heute ? { datum: o.heute } : {}) });
      delete e.titel;
      delete e.nachweisArt;
    } else if (ablageVonBibliothek(n.ablageort)) n.ablageort = ablageText(v.datei, p.meta.dokumentSprache);
  }
  if (e.status === 'archiviert') delete e.status;
  registerNachziehen(p, id);
  return e;
}

/**
 * Register eines Firmendokuments an die neueste Version angleichen, solange das Register keine gültige (freigegebene)
 * Version beschreibt: dann stehen Version und Status der Arbeitsfassung im Register.
 */
export function registerNachziehen(p: Projekt, id: string): void {
  const r = register(p, id);
  const e = p.bibliothek?.eintraege.find((x) => x.id === id);
  const v = e && neuesteVersion(e.versionen);
  if (!r || !v || r.status === 'freigegeben' || r.status === 'veraltet') return;
  if (vergleicheVersion(v.version, r.version || '0') < 0) return;
  r.version = v.version;
  r.status = statusFuerRegister(v.status ?? 'entwurf');
}

export type StatusFehler = 'keine-version' | 'nicht-erlaubt' | 'pruefung-fehlt' | 'freigabe-fehlt' | 'gleiche-person' | 'reihenfolge' | 'aenderung-fehlt';
export type StatusWarnung = 'eigner-gibt-frei' | 'eigner-prueft';

export interface FreigabeAngaben {
  geprueft?: Freigabe;
  freigabe?: Freigabe;
  /** Was sich geändert hat (Änderungshistorie) */
  aenderung?: string;
  /** Text der Erstfassung bzw. für eine ältere Version ohne Historie (in der Dokumentsprache) */
  textAeltere?: string;
}

/** Erlaubte Wechsel der neuesten Version (D-26): Entwurf ⇄ in Prüfung → freigegeben; Freigabe nur nach Prüfung */
export const WECHSEL: Record<BibliothekStatus, BibliothekStatus[]> = {
  entwurf: ['in-pruefung'],
  'in-pruefung': ['entwurf', 'freigegeben'],
  freigegeben: [],
  ersetzt: [],
  archiviert: [],
};

/**
 * Versionsnummer bei der Freigabe (D-26): Entwürfe 0.x werden als 1.0 freigegeben; ab 1.0 bleibt die Nummer (kleine
 * Änderung 1.1, inhaltliche 2.0, beim Einchecken gewählt).
 */
export function freigabeVersion(version: string, andere: readonly string[] = []): string {
  if (!/^0(\.\d+)*$/.test(version)) return version;
  const hoechste = andere.filter((x) => vergleicheVersion(x, '1.0') >= 0).sort(vergleicheVersion).at(-1);
  return hoechste ? naechsteVersion('eigene', hoechste) : '1.0';
}

/** Prüft Angaben einer Freigabe nach D-26 (zweite Person prüft vorher; Eigner/in gibt nur nach Regel «eigner» frei) */
export function pruefeFreigabe(a: FreigabeAngaben, eigner: string | undefined, regel: string | undefined): { fehler?: StatusFehler; warnungen: StatusWarnung[] } {
  const warnungen: StatusWarnung[] = [];
  if (!a.geprueft?.von || !a.geprueft.am) return { fehler: 'pruefung-fehlt', warnungen };
  if (!a.freigabe?.von || !a.freigabe.am) return { fehler: 'freigabe-fehlt', warnungen };
  if (a.geprueft.von === a.freigabe.von) return { fehler: 'gleiche-person', warnungen };
  if (a.geprueft.am > a.freigabe.am) return { fehler: 'reihenfolge', warnungen };
  if (eigner && a.freigabe.von === eigner && regel !== 'eigner') warnungen.push('eigner-gibt-frei');
  if (eigner && a.geprueft.von === eigner) warnungen.push('eigner-prueft');
  return { warnungen };
}

/**
 * Status der neuesten Version wechseln. Bei der Freigabe: ältere freigegebene Versionen ersetzt; Firmendokument im
 * Register mit Version, Prüfung, Freigabe und Änderungshistorie (angelegt, wenn es fehlt).
 */
export function statusWechseln(p: Projekt, id: string, art: BibliothekArt, ziel: BibliothekStatus, a: FreigabeAngaben = {}): { fehler?: StatusFehler; warnungen: StatusWarnung[] } {
  const e = p.bibliothek?.eintraege.find((x) => x.id === id);
  const v = e && neuesteVersion(e.versionen);
  if (!e || !v) return { fehler: 'keine-version', warnungen: [] };
  const r = art === 'firmendokument' ? register(p, id) : undefined;
  // Status der neuesten Version: das Register gilt für seine Version
  const jetzt = r && r.version === v.version && r.status !== 'veraltet' ? r.status : (v.status ?? 'entwurf');
  if (!WECHSEL[jetzt].includes(ziel)) return { fehler: 'nicht-erlaubt', warnungen: [] };
  if (ziel !== 'freigegeben') {
    v.status = ziel;
    if (r && r.version === v.version && r.status !== 'freigegeben') r.status = statusFuerRegister(ziel);
    registerNachziehen(p, id);
    return { warnungen: [] };
  }
  const eigner = r?.eigner ?? e.eigner;
  const pruefung = pruefeFreigabe(a, eigner, p.organisation.dokumentenlenkung?.freigabe);
  if (pruefung.fehler) return pruefung;
  // Änderungstext erst ab der zweiten freigegebenen Fassung (U-24): vorher gibt es nichts, wogegen sich etwas geändert hat
  const frueherFreigegeben = e.versionen.some((x) => x !== v && !!x.freigabe) || !!(r?.freigabe && r.version !== v.version);
  if (!a.aenderung?.trim() && frueherFreigegeben) return { fehler: 'aenderung-fehlt', warnungen: pruefung.warnungen };
  for (const x of e.versionen) if (x !== v && x.status === 'freigegeben') x.status = 'ersetzt';
  // D-26: Entwürfe tragen 0.x, die erste Freigabe die Hauptnummer 1.0 (Nutzertest rc.10, U-06)
  const freigabeNummer = freigabeVersion(v.version, [...e.versionen.filter((x) => x !== v).map((x) => x.version), ...(r?.version && r.version !== v.version ? [r.version] : [])]);
  if (freigabeNummer !== v.version && !e.versionen.some((x) => x.version === freigabeNummer)) {
    v.entwurf = v.version;
    v.version = freigabeNummer;
  }
  v.status = 'freigegeben';
  v.geprueft = a.geprueft!;
  v.freigabe = a.freigabe!;
  if (a.aenderung?.trim()) v.aenderung = a.aenderung.trim();
  if (art === 'firmendokument') registerFreigeben(p, id, v, e, a);
  return pruefung;
}

function registerFreigeben(p: Projekt, id: string, v: BibliothekVersion, e: BibliothekEintrag, a: FreigabeAngaben): void {
  let r = register(p, id);
  if (!r) {
    r = { id, version: v.version, status: 'freigegeben', ablageort: ablageText(v.datei, p.meta.dokumentSprache), giltFuerIsms: id.endsWith('-EB') };
    if (e.eigner) r.eigner = e.eigner;
    if (e.naechstePruefung) r.naechsteUeberpruefung = e.naechstePruefung;
    delete e.eigner;
    delete e.naechstePruefung;
    p.dokumente.push(r);
  }
  // Eigner wie im Kopf derselben Datei (src/vorlagen/kontext.ts), auch wenn der Eintrag schon «in Prüfung» entstand (C2-03)
  if (!r.eigner) {
    const eigner = id === 'D-00' ? (p.organisation.projektauftrag?.sponsor ?? p.organisation.aimsVerantwortlich) : p.organisation.aimsVerantwortlich;
    if (eigner) r.eigner = eigner;
  }
  // Änderungshistorie (D-26): die bisher freigegebene Version ohne Historie zuerst nachtragen, damit nichts verloren geht
  const liste = [...(r.aenderungen ?? [])];
  if (!liste.length && r.freigabe?.am && r.version && r.version !== v.version) {
    liste.push({ version: r.version, datum: r.freigabe.am, was: a.textAeltere ?? '', ...(typeof r.freigabe.von === 'string' ? { von: r.freigabe.von } : {}) });
  }
  if (!liste.some((x) => x.version === v.version)) liste.push({ version: v.version, datum: a.freigabe!.am, was: a.aenderung?.trim() || a.textAeltere || '', von: String(a.freigabe!.von) });
  r.aenderungen = liste;
  r.version = v.version;
  r.status = 'freigegeben';
  r.freigabe = a.freigabe!;
  r.geprueft = a.geprueft!;
  if (ablageVonBibliothek(r.ablageort)) r.ablageort = ablageText(v.datei, p.meta.dokumentSprache);
}

/** Ganzen Eintrag archivieren oder zurückholen; Firmendokumente im Register als veraltet */
export function archivieren(p: Projekt, id: string, art: BibliothekArt, an: boolean): void {
  const e = eintragVon(p, id, art);
  const r = art === 'firmendokument' ? register(p, id) : undefined;
  if (an) {
    e.status = 'archiviert';
    if (r) r.status = 'veraltet';
  } else {
    delete e.status;
    if (r && r.status === 'veraltet') r.status = r.freigabe ? 'freigegeben' : 'entwurf';
  }
}

/** Eintrag ohne Versionen und Metadaten wieder entfernen (Bibliothek bleibt schlank) */
export function aufraeumen(p: Projekt): void {
  const b = p.bibliothek;
  if (!b) return;
  b.eintraege = b.eintraege.filter((e) => e.versionen.length || e.status || e.titel || e.eigner || e.naechstePruefung || e.normbezug?.length || e.verknuepfungen || e.beschreibung || e.nachweisArt);
}

/** Abgleich übernehmen: Änderungszeit bei gleicher Prüfsumme nachführen */
export function zeitNachfuehren(p: Projekt, pfad: string, geaendert: number): boolean {
  for (const e of p.bibliothek?.eintraege ?? []) {
    const v = e.versionen.find((x) => x.datei === pfad);
    if (v && v.geaendert !== geaendert) {
      v.geaendert = geaendert;
      return true;
    }
  }
  return false;
}

/** Ein Register-Eintrag in der Form für D-26 aus einer Version (für Firmendokumente ohne Registereintrag) */
export function registerZeile(e: BibliothekEintrag, v: BibliothekVersion, status: BibliothekStatus, sprache: 'de' | 'en' = 'de'): DokumentEintrag {
  return {
    id: e.id,
    version: v.version,
    status: statusFuerRegister(status),
    ...(e.eigner ? { eigner: e.eigner } : {}),
    ...(v.freigabe ? { freigabe: v.freigabe } : {}),
    ...(v.geprueft ? { geprueft: v.geprueft } : {}),
    ...(e.naechstePruefung ? { naechsteUeberpruefung: e.naechstePruefung } : {}),
    ablageort: ablageText(v.datei, sprache),
    giltFuerIsms: e.id.endsWith('-EB'),
  };
}

/**
 * Datei ausserhalb geändert: Entwurf übernimmt die Änderung (Prüfsumme, Grösse, Zeit); in Prüfung oder freigegeben wird
 * daraus eine neue Version (Entwurf) und die alte als überschrieben markiert (D-26: Freigegebenes nur über neue Version).
 */
export function aussenAenderungUebernehmen(p: Projekt, id: string, pfad: string, stand: { pruefsumme: string; groesse: number; geaendert: number }, neu?: BibliothekVersion): 'uebernommen' | 'neue-version' | null {
  const e = p.bibliothek?.eintraege.find((x) => x.id === id);
  const v = e?.versionen.find((x) => x.datei === pfad);
  if (!e || !v) return null;
  const r = e.art === 'firmendokument' ? register(p, id) : undefined;
  const status = r && r.version === v.version ? r.status : (v.status ?? 'entwurf');
  if (status === 'entwurf' && v === neuesteVersion(e.versionen) && !neu) {
    Object.assign(v, stand);
    return 'uebernommen';
  }
  if (!neu) return null;
  v.ueberschrieben = true;
  versionHinzufuegen(p, id, e.art, { ...neu, status: 'entwurf' });
  return 'neue-version';
}

/** Entwurf darf die Änderung direkt übernehmen (sonst neue Version nötig) */
export function entwurfAenderbar(p: Projekt, id: string, pfad: string): boolean {
  const e = p.bibliothek?.eintraege.find((x) => x.id === id);
  const v = e?.versionen.find((x) => x.datei === pfad);
  if (!e || !v || v !== neuesteVersion(e.versionen) || e.art === 'nachweis') return false;
  const r = e.art === 'firmendokument' ? register(p, id) : undefined;
  return (r && r.version === v.version ? r.status : (v.status ?? 'entwurf')) === 'entwurf';
}

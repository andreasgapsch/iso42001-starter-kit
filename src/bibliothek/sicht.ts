// Sicht der Bibliothek: führt Dokumentenregister (Projekt.dokumente), Nachweise (Projekt.nachweise), gespeicherte
// Einträge (Projekt.bibliothek) sowie Vorlagen und Rechtstexte des Kits zu einer Liste zusammen. Rein, ohne Browser.
import type { DokumentEintrag, Freigabe, Nachweis, Projekt } from '../model/typen.ts';
import { registerAusProjekt, registerStatus } from './freigabe-stand.ts';
import type { BibliothekArt, BibliothekEintrag, BibliothekStatus, BibliothekVerknuepfungen, BibliothekVersion } from './modell.ts';

export interface SichtVersion extends BibliothekVersion {
  status: BibliothekStatus;
}

export interface SichtEintrag {
  id: string;
  art: BibliothekArt;
  titel: string;
  /** Status des Eintrags (neueste Version, Register oder «archiviert») */
  status: BibliothekStatus;
  /** Neueste Version (Datei oder Register) */
  version?: string;
  /** Gültige, freigegebene Version */
  gueltig?: string;
  versionen: SichtVersion[];
  eigner?: string;
  geprueft?: Freigabe;
  freigabe?: Freigabe;
  naechstePruefung?: string;
  normbezug: string[];
  verknuepfungen: BibliothekVerknuepfungen;
  beschreibung?: string;
  /** Eintrag im Dokumentenregister (Firmendokument) bzw. im Register der Nachweise */
  register?: DokumentEintrag;
  nachweis?: Nachweis;
  /** In Projekt.bibliothek gespeichert */
  gespeichert: boolean;
  /** Vorlagen und Rechtstexte des Kits */
  schreibgeschuetzt: boolean;
  /** Rechtstext: Pfad relativ zum AIMS-Manager im Kit; Vorlage: Katalog-ID */
  pfad?: string;
  /** Format der Datei (Endung) */
  format?: string;
}

/** Was die Sicht ausser dem Projekt braucht (Katalog, Titel in der Sprache der Oberfläche, Rechtstexte) */
export interface SichtUmfeld {
  /** Dokumente des Katalogs (Vorlagen des Kits) */
  katalog?: readonly { id: string; format: string; normbezug?: string; ordner?: string }[];
  /** Titel eines Dokuments nach Register-ID */
  titel?: (id: string) => string;
  /** Titel einer Vorlage (V-D-07) */
  vorlageTitel?: (katalogId: string) => string;
  rechtstexte?: readonly { id: string; titel: string; pfad: string }[];
  /** Vorlage zeigen (z. B. nur Dokumente der eingeschalteten Module) */
  vorlageSichtbar?: (katalogId: string) => boolean;
}

const RANG: Record<BibliothekStatus, number> = { entwurf: 0, 'in-pruefung': 1, freigegeben: 2, ersetzt: 3, archiviert: 4 };

/** Vergleicht Versionsnummern numerisch: 1.10 nach 1.9, 2 nach 1.9 */
export function vergleicheVersion(a: string, b: string): number {
  const x = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const y = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Nächste Versionsnummer: Nachweise ganzzahlig (1, 2), sonst Nebennummer (1.3 auf 1.4) oder Hauptnummer (1.3 auf 2.0) */
export function naechsteVersion(art: BibliothekArt, letzte: string | undefined, haupt = false): string {
  if (art === 'nachweis') return String((Number.parseInt(letzte ?? '0', 10) || 0) + 1);
  if (!letzte) return haupt ? '1.0' : '0.1';
  const [h = 0, n = 0] = letzte.split('.').map((z) => Number.parseInt(z, 10) || 0);
  return haupt ? `${h + 1}.0` : `${h}.${n + 1}`;
}

/** Status des Registers (D-26) in der Bibliothek */
export function statusAusRegister(s: DokumentEintrag['status']): BibliothekStatus {
  return s === 'veraltet' ? 'ersetzt' : s;
}

/** Status der Bibliothek im Register: ersetzt und archiviert gelten dort als veraltet */
export function statusFuerRegister(s: BibliothekStatus): DokumentEintrag['status'] {
  return s === 'ersetzt' || s === 'archiviert' ? 'veraltet' : s;
}

const normListe = (s: string | undefined): string[] => (s && s !== 'alle' ? s.split(/,\s*/).map((x) => x.trim()).filter(Boolean) : []);

/** Neueste Version (höchste Nummer; bei Gleichstand die zuletzt eingecheckte) */
export function neuesteVersion<V extends BibliothekVersion>(versionen: readonly V[]): V | undefined {
  let best: V | undefined;
  for (const v of versionen) if (!best || vergleicheVersion(v.version, best.version) >= 0) best = v;
  return best;
}

/** Versionen mit aufgelöstem Status: ältere freigegebene gelten als ersetzt; Register gilt für seine Version */
function versionenAufloesen(e: BibliothekEintrag | undefined, art: BibliothekArt, register?: DokumentEintrag): SichtVersion[] {
  const liste = [...(e?.versionen ?? [])].sort((a, b) => vergleicheVersion(a.version, b.version));
  const neueste = liste.at(-1);
  const sicht = liste.map((v): SichtVersion => {
    if (art === 'nachweis') return { ...v, status: v === neueste ? 'freigegeben' : 'ersetzt' };
    if (register && v.version === register.version) {
      return { ...v, status: statusAusRegister(registerStatus(register)), ...(register.freigabe ? { freigabe: register.freigabe } : {}), ...(register.geprueft ? { geprueft: register.geprueft } : {}) };
    }
    return { ...v, status: v.status ?? 'entwurf' };
  });
  // Nur die jüngste freigegebene Version gilt; ältere freigegebene und nie freigegebene Vorversionen sind ersetzt
  const letzteFrei = [...sicht].reverse().find((v) => v.status === 'freigegeben');
  for (const v of sicht) {
    if (v.status === 'freigegeben' && v !== letzteFrei) v.status = 'ersetzt';
    else if ((v.status === 'entwurf' || v.status === 'in-pruefung') && v !== sicht.at(-1)) v.status = 'ersetzt';
  }
  return sicht;
}

function endung(datei: string | undefined): string | undefined {
  const m = datei ? /\.([A-Za-z0-9]{1,6})$/.exec(datei) : null;
  return m ? m[1]!.toLowerCase() : undefined;
}

/** Ein Eintrag der Sicht aus gespeichertem Eintrag, Registereintrag und Nachweis */
export function sichtVon(e: BibliothekEintrag | undefined, o: { id: string; art: BibliothekArt; register?: DokumentEintrag; nachweis?: Nachweis; umfeld?: SichtUmfeld; katalog?: { format: string; normbezug?: string } }): SichtEintrag {
  const { id, art, register, nachweis } = o;
  const versionen = versionenAufloesen(e, art, register);
  const neueste = versionen.at(-1);
  const gueltigeVersion = [...versionen].reverse().find((v) => v.status === 'freigegeben');
  let status: BibliothekStatus;
  let version = neueste?.version;
  let gueltig = gueltigeVersion?.version;
  if (art === 'vorlage' || art === 'rechtstext') status = 'freigegeben';
  else if (art === 'nachweis') status = 'freigegeben';
  else if (register && (!neueste || vergleicheVersion(neueste.version, register.version) <= 0)) {
    status = statusAusRegister(registerStatus(register));
    version = register.version || version;
    gueltig = status === 'freigegeben' ? register.version : gueltig;
  } else status = neueste?.status ?? e?.status ?? 'entwurf';
  const registerFrei = !!register && registerStatus(register) === 'freigegeben';
  if (registerFrei && !gueltig) gueltig = register.version;
  if (e?.status === 'archiviert') status = 'archiviert';
  const katalogTitel = art === 'firmendokument' ? o.umfeld?.titel?.(id) : undefined;
  const titel = e?.titel?.trim() || nachweis?.titel || (katalogTitel && katalogTitel !== id ? katalogTitel : '') || neueste?.name || id;
  const freigabe = registerFrei && register.freigabe ? register.freigabe : gueltigeVersion?.freigabe;
  const geprueft = registerFrei && register.geprueft ? register.geprueft : gueltigeVersion?.geprueft;
  return {
    id,
    art,
    titel,
    status,
    ...(version ? { version } : {}),
    ...(gueltig ? { gueltig } : {}),
    versionen,
    ...((register?.eigner ?? e?.eigner) ? { eigner: register?.eigner ?? e?.eigner } : {}),
    ...(geprueft ? { geprueft } : {}),
    ...(freigabe ? { freigabe } : {}),
    ...((register?.naechsteUeberpruefung ?? e?.naechstePruefung) ? { naechstePruefung: register?.naechsteUeberpruefung ?? e?.naechstePruefung } : {}),
    normbezug: e?.normbezug?.length ? e.normbezug : normListe(o.katalog?.normbezug),
    verknuepfungen: e?.verknuepfungen ?? {},
    ...(e?.beschreibung ? { beschreibung: e.beschreibung } : {}),
    ...(register ? { register } : {}),
    ...(nachweis ? { nachweis } : {}),
    gespeichert: !!e,
    schreibgeschuetzt: art === 'vorlage' || art === 'rechtstext',
    ...((endung(neueste?.datei) ?? o.katalog?.format) ? { format: endung(neueste?.datei) ?? o.katalog?.format } : {}),
  };
}

/** Katalog-ID zu einer Register-ID: D-07-EB → D-07, D-09-KI-001 → D-09, D-26-Register → D-26 */
export function katalogIdVon(id: string): string {
  return /^([A-Z]-\d{2})/.exec(id)?.[1] ?? id;
}

/** Alle Einträge der Bibliothek in fester Reihenfolge: Firmendokumente, eigene Dateien, Nachweise, Vorlagen, Rechtstexte */
export function sichtEintraege(p: Projekt, umfeld: SichtUmfeld = {}): SichtEintrag[] {
  const gespeichert = new Map((p.bibliothek?.eintraege ?? []).map((e) => [e.id, e]));
  const katalog = new Map((umfeld.katalog ?? []).map((k) => [k.id, k]));
  const liste: SichtEintrag[] = [];
  const gesehen = new Set<string>();
  const kat = (id: string) => katalog.get(katalogIdVon(id));
  for (const d of p.dokumente) {
    gesehen.add(d.id);
    liste.push(sichtVon(gespeichert.get(d.id), { id: d.id, art: 'firmendokument', register: d, umfeld, katalog: kat(d.id) }));
  }
  for (const n of p.nachweise) {
    gesehen.add(n.id);
    liste.push(sichtVon(gespeichert.get(n.id), { id: n.id, art: 'nachweis', nachweis: n, umfeld }));
  }
  for (const e of gespeichert.values()) {
    if (gesehen.has(e.id) || e.art === 'vorlage' || e.art === 'rechtstext') continue;
    gesehen.add(e.id);
    // Im Guide freigegeben (Leitlinie, Geltungsbereich, Folgenabschätzung): gleiche Wahrheit wie im Dokumentkopf und im Bericht
    const virtuell = e.art === 'firmendokument' ? registerAusProjekt(p, e.id) : undefined;
    liste.push(sichtVon(e, { id: e.id, art: e.art, ...(virtuell ? { register: virtuell } : {}), umfeld, katalog: e.art === 'firmendokument' ? kat(e.id) : undefined }));
  }
  const reihe: Record<BibliothekArt, number> = { firmendokument: 0, eigene: 1, nachweis: 2, vorlage: 3, rechtstext: 4 };
  liste.sort((a, b) => reihe[a.art] - reihe[b.art] || a.id.localeCompare(b.id, 'de', { numeric: true }));
  for (const k of umfeld.katalog ?? []) {
    if (umfeld.vorlageSichtbar && !umfeld.vorlageSichtbar(k.id)) continue;
    const id = `V-${k.id}`;
    const e = gespeichert.get(id);
    liste.push({ ...sichtVon(e, { id, art: 'vorlage', umfeld, katalog: k }), titel: umfeld.vorlageTitel?.(k.id) ?? k.id, pfad: k.id, format: k.format });
  }
  for (const r of umfeld.rechtstexte ?? []) {
    const e = gespeichert.get(r.id);
    liste.push({ ...sichtVon(e, { id: r.id, art: 'rechtstext', umfeld }), titel: r.titel, pfad: r.pfad, format: endung(r.pfad) ?? 'pdf' });
  }
  return liste;
}

/** Unterbereiche des Untermenüs */
export const UNTERBEREICHE = ['alle', 'firma', 'eigene', 'nachweise', 'vorlagen', 'recht', 'pruefen', 'entwurf', 'ersetzt'] as const;
export type Unterbereich = (typeof UNTERBEREICHE)[number];

const ART_BEREICH: Record<BibliothekArt, Unterbereich> = { firmendokument: 'firma', eigene: 'eigene', nachweis: 'nachweise', vorlage: 'vorlagen', rechtstext: 'recht' };

/** Tage von JJJJ-MM-TT bis JJJJ-MM-TT */
export function tageBis(von: string, bis: string): number {
  return Math.round((Date.parse(bis.slice(0, 10)) - Date.parse(von.slice(0, 10))) / 86_400_000);
}

/** Überprüfung fällig: überfällig (< 0 Tage) oder innerhalb der Vorwarnzeit */
export function pruefungFaellig(e: SichtEintrag, heute: string, vorwarnTage = 30): 'ueberfaellig' | 'bald' | null {
  if (!e.naechstePruefung || e.status === 'archiviert' || e.status === 'ersetzt' || e.schreibgeschuetzt) return null;
  const t = tageBis(heute, e.naechstePruefung);
  return t < 0 ? 'ueberfaellig' : t <= vorwarnTage ? 'bald' : null;
}

/** Gehört der Eintrag zum Unterbereich? Archivierte und ersetzte Einträge nur unter «ersetzt». */
export function imUnterbereich(e: SichtEintrag, u: string, heute: string): boolean {
  const weg = e.status === 'archiviert' || e.status === 'ersetzt';
  switch (u) {
    case 'ersetzt':
      return weg;
    case 'pruefen':
      return !weg && (e.status === 'in-pruefung' || pruefungFaellig(e, heute) !== null);
    case 'entwurf':
      return !weg && !e.schreibgeschuetzt && e.status === 'entwurf';
    case 'alle':
      return !weg && e.art !== 'vorlage';
    default:
      return !weg && ART_BEREICH[e.art] === u;
  }
}

/** Zähler je Unterbereich; «warn» bei überfälligen Prüfungen */
export function zaehler(liste: readonly SichtEintrag[], heute: string): Record<Unterbereich, number> & { ueberfaellig: number } {
  const z = Object.fromEntries(UNTERBEREICHE.map((u) => [u, 0])) as Record<Unterbereich, number> & { ueberfaellig: number };
  z.ueberfaellig = 0;
  for (const e of liste) {
    for (const u of UNTERBEREICHE) if (imUnterbereich(e, u, heute)) z[u]++;
    if (pruefungFaellig(e, heute) === 'ueberfaellig') z.ueberfaellig++;
  }
  return z;
}

/** Sortierreihenfolge nach Status (für Tabellen) */
export const statusRang = (s: BibliothekStatus): number => RANG[s];

/** Stand eines Dokuments für Bericht und Bereitschaft: dieselbe Rechnung wie die Sicht der Bibliothek */
export function freigabeStand(p: Projekt, id: string): { status?: DokumentEintrag['status'] | BibliothekStatus; version?: string; freigabe?: Freigabe; quelle: 'register' | 'projekt' | 'bibliothek' | 'keine' } {
  const andere = id.endsWith('-EB') ? id.slice(0, -3) : `${id}-EB`;
  // Führt das Projekt die Freigabe selbst (Leitlinie D-03), gilt sie: nicht die Zeile des Ergänzungsblatts unter dem Titel des Dokuments (C2-08)
  const eigene = id.endsWith('-EB') ? undefined : registerAusProjekt(p, id);
  const r = p.dokumente.find((d) => d.id === id) ?? (eigene ? undefined : p.dokumente.find((d) => d.id === andere));
  const e = p.bibliothek?.eintraege.find((x) => x.id === id) ?? p.bibliothek?.eintraege.find((x) => x.id === andere);
  const neueste = e ? neuesteVersion(e.versionen) : undefined;
  if (r) {
    const st = registerStatus(r);
    // Neuere Datei in Arbeit ändert nichts an der gültigen Freigabe
    if (st === 'freigegeben' || !neueste) return { status: st, ...(r.version ? { version: r.version } : {}), ...(r.freigabe ? { freigabe: r.freigabe } : {}), quelle: 'register' };
    return { status: r.status, version: r.version || neueste.version, ...(neueste.freigabe ? { freigabe: neueste.freigabe } : {}), quelle: 'register' };
  }
  const v = registerAusProjekt(p, id);
  if (v) return { status: 'freigegeben', version: v.version, ...(v.freigabe ? { freigabe: v.freigabe } : {}), quelle: 'projekt' };
  if (neueste) return { status: neueste.status ?? 'entwurf', version: neueste.version, ...(neueste.freigabe ? { freigabe: neueste.freigabe } : {}), quelle: 'bibliothek' };
  return { quelle: 'keine' };
}

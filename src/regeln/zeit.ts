// Zeitliche Gültigkeit der Belege als Prüfregel im Produkt (AF-077, K-AUD-03; Runde 3: A3-07, A3-10, A3-23).
// Reine Funktionen ohne Dateizugriff. Drei Arten:
//   F39 Beleg jünger als die Aussage: eine datierte Aussage nennt eine Kennung, die erst danach entstanden ist.
//   F40 Verweis auf eine Version, die zum Belegdatum noch nicht freigegeben war (auch: Ereignis «nach D-xx» vor D-xx).
//   F41 Datum im Text jünger als das Kopfdatum: Stand des Rechts im Dokument nach seiner Freigabe, «Stand 02.11.2026»
//       in einer Aussage vom 27.10.2026.
// Die Projektdaten-Teile der Datumsprüfung der Beispiele (src/beispiele/bau/datumspruefung.mts) laufen über dieselben
// Funktionen (zeitlicheGueltigkeit); dort bleibt nur der Abgleich mit dem Text der erzeugten Dateien.
import type { Projekt } from '../model/typen.ts';

/** Kennungen mit festem Entstehungsdatum */
export const ID_MUSTER = /(?<![\w-])((?:MB|F|M|N|IA|TH|IP|KI|AU)-\d{3})(?![\w-])/g;
/** Dokumentverweise; ein Zusatz «in Erarbeitung» bzw. «in preparation» direkt danach ist zulässig */
export const DOK_MUSTER = /(?<![\w-])((?:D|E|N)-\d{2}(?:-EB|-KI-\d{3})?)(?![\w-])/g;
export const GEPLANT = /^[\s(,]*(in Erarbeitung|in preparation)/;

/** TT.MM.JJJJ oder TT/MM/JJJJ als JJJJ-MM-TT */
export const isoAusText = (s: string): string | undefined => {
  const m = /(\d{2})[./](\d{2})[./](\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};
const tag = (d: string) => d.slice(0, 10);

/** Eintrag im Dokumentenregister, mit Rückfall auf die andere Form (D-07 und D-07-EB) */
export function dokEintrag(p: Projekt, id: string): Projekt['dokumente'][number] | undefined {
  const andere = id.endsWith('-EB') ? id.slice(0, -3) : `${id}-EB`;
  return p.dokumente.find((d) => d.id === id) ?? p.dokumente.find((d) => d.id === andere);
}

/** Erste Freigabe eines Dokuments: ältester Eintrag der Änderungshistorie, sonst Freigabe; D-09-KI-xxx aus der Abschätzung */
export function ersteFreigabe(p: Projekt, id: string): string | undefined {
  const e = dokEintrag(p, id);
  const ia = /^D-09-(KI-\d+)$/.exec(id);
  const f = ia ? p.folgenabschaetzungen.find((x) => x.kiSystem === ia[1])?.freigabe?.am : undefined;
  return [...(e?.aenderungen ?? []).map((a) => a.datum), f, e?.freigabe?.am].filter((d): d is string => !!d).map(tag).sort()[0];
}

/** Freigabedatum einer bestimmten Version; undefined, wenn die Version im Register nicht vorkommt */
export function versionFreigabe(p: Projekt, id: string, version: string): string | undefined {
  const e = dokEintrag(p, id);
  if (!e) return undefined;
  const h = (e.aenderungen ?? []).find((a) => a.version === version)?.datum;
  if (h) return tag(h);
  return e.version === version && e.freigabe?.am ? tag(e.freigabe.am) : undefined;
}

/** Version als Zahl zum Vergleich (1.10 nach 1.9) */
const versionWert = (v: string) => v.split('.').map(Number).reduce((s, x, i) => s + x / 1000 ** i, 0);

/** Entstehungsdatum je Kennung (hart) und weitere Daten (weich, nur Hinweis in der Datumsprüfung der Beispiele) */
export function ereignisse(p: Projekt): { hart: Map<string, string>; weich: Map<string, string> } {
  const hart = new Map<string, string>();
  const weich = new Map<string, string>();
  const audit = (id?: string) => {
    const a = p.audits.find((x) => x.id === id);
    return a?.durchgefuehrt ?? a?.geplant;
  };
  for (const mb of p.managementbewertungen) if (mb.datum) hart.set(mb.id, mb.datum);
  // Kennung ab der Erfassung im Register: nachgetragene Ereignisse (erfasstAm) tragen sie erst ab diesem Datum
  for (const f of p.feststellungen) {
    const d = f.erfasstAm ?? f.datum ?? audit(f.audit);
    if (d) hart.set(f.id, d);
  }
  for (const m of p.massnahmen) {
    if (m.erfasstAm) hart.set(m.id, m.erfasstAm);
    else if (m.herkunft.art === 'audit' || m.herkunft.art === 'managementbewertung') {
      const daten = (m.herkunft.ref ?? '').match(/\b(?:AU|F|MB)-\d+\b/g)?.map((id) => (id.startsWith('AU-') ? audit(id) : hart.get(id))).filter((d): d is string => !!d) ?? [];
      if (daten.length) hart.set(m.id, daten.sort().at(-1)!);
    } else if (m.start) hart.set(m.id, m.start);
  }
  for (const n of p.nachweise) if (n.datum) hart.set(n.id, n.datum);
  for (const s of p.kiSysteme) if (s.erfasstAm) hart.set(s.id, s.erfasstAm);
  // Themen und Anforderungen der Parteien entstehen mit der ersten Freigabe von D-01
  const d01 = ersteFreigabe(p, 'D-01');
  if (d01) {
    for (const t of p.organisation.kontext.themen) hart.set(t.id, d01);
    for (const ip of p.parteien) hart.set(ip.id, d01);
  }
  // Ergänzungsaudit: entsteht aus der Managementbewertung, die es beschliesst; ältere Fassungen dürfen es nicht führen
  for (const a of p.audits) {
    if (a.durchgefuehrt) continue;
    const mb = p.managementbewertungen.find((x) => x.datum && JSON.stringify([x.entscheide, x.entscheideListe]).includes(a.id));
    if (mb?.datum) hart.set(a.id, mb.datum);
  }
  // Geprüfter Lieferant: L-Kennung im Register ab dem Datum der Prüfung
  for (const l of p.lieferanten) if (l.geprueft?.am) hart.set(l.id, l.geprueft.am);
  for (const f of p.folgenabschaetzungen) {
    if (f.triage.am) hart.set(f.id, f.triage.am);
    if (f.freigabe?.am) weich.set(f.id, f.freigabe.am);
  }
  return { hart, weich };
}

/** Datierte Aussage: Eintrag mit eigenem Datum und Text; bereich und id für den Sprung im Werkzeug */
export interface DatierteAussage {
  wo: string;
  bereich?: string;
  id?: string;
  datum: string;
  text: string;
  /** Status, bei dem die Aussage verbindlich ist (W2: Fehler erst bei freigegeben, erledigt, wirksam; vorher Hinweis) */
  verbindlich: boolean;
}

const t = (o: unknown): string => JSON.stringify(o) ?? '';

/** Datierte Einträge der Projektdaten mit ihren Texten (Freigaben, Annahmen, Bewertungen, Messungen, Nachweise, Audits) */
export function datierteEintraege(p: Projekt): DatierteAussage[] {
  const e: DatierteAussage[] = [];
  for (const s of p.kiSysteme) if (s.freigabe?.am) e.push({ wo: `kiSysteme ${s.id} freigabe`, bereich: 'inventar', id: s.id, datum: s.freigabe.am, text: t([s.freigabeBegruendung, s.auflagen]), verbindlich: true });
  for (const f of p.folgenabschaetzungen) {
    // Neubeurteilungen mit eigenem Datum; die Abschätzung selbst gilt zum Datum ihrer Freigabe
    const { triage, freigabe: _f, naechsteUeberpruefung: _n, neubeurteilungen, ...rest } = f;
    if (f.freigabe?.am) e.push({ wo: `folgenabschaetzungen ${f.id} freigabe`, bereich: 'folgen', id: f.id, datum: f.freigabe.am, text: t({ ...rest, b: triage.begruendung }), verbindlich: true });
    for (const n of neubeurteilungen ?? []) e.push({ wo: `folgenabschaetzungen ${f.id} neubeurteilung`, bereich: 'folgen', id: f.id, datum: n.freigabe?.am ?? n.am, text: t([n.anlass, n.ergebnis]), verbindlich: true });
    if (triage.am) e.push({ wo: `folgenabschaetzungen ${f.id} triage`, bereich: 'folgen', id: f.id, datum: triage.am, text: t(triage.begruendung), verbindlich: true });
  }
  for (const r of p.risiken) if (r.restrisikoAkzeptiert?.am) e.push({ wo: `risiken ${r.id} restrisikoAkzeptiert`, bereich: 'risiken', id: r.id, datum: r.restrisikoAkzeptiert.am, text: t([r.beschreibung, r.ursache, r.folge, r.bestehendeMassnahmen, r.massnahmen]), verbindlich: true });
  for (const mb of p.managementbewertungen) if (mb.datum) e.push({ wo: `managementbewertungen ${mb.id}`, bereich: 'managementbewertung', id: mb.id, datum: mb.datum, text: t([mb.eingaben, mb.ergebnisse, mb.entscheide, mb.massnahmen, mb.entscheideListe, mb.gesamtbeurteilung]), verbindlich: true });
  for (const z of p.ziele) for (const m of z.messungen) e.push({ wo: `ziele ${z.id} messung ${m.datum}`, bereich: 'ziele', id: z.id, datum: m.datum, text: t([m.wert, m.bemerkung]), verbindlich: true });
  // Checklisten der Gap-Analyse: nur Datumsprüfung der Beispiele (kein Sprungziel im Werkzeug)
  for (const [k, c] of Object.entries(p.meta.checklisten)) if (c.datum) e.push({ wo: `meta.checklisten ${k}`, datum: c.datum, text: t(c.nachweis), verbindlich: true });
  for (const n of p.nachweise) if (n.datum) e.push({ wo: `nachweise ${n.id}`, bereich: 'nachweise', id: n.id, datum: n.datum, text: t(n.titel), verbindlich: true });
  for (const a of p.audits) if (a.durchgefuehrt) e.push({ wo: `audits ${a.id}`, bereich: 'audits', id: a.id, datum: a.durchgefuehrt, text: t([a.umfang, a.auditor, a.unabhaengigkeit]), verbindlich: true });
  // Eintrag im Register zum Datum der Erfassung (bei nachgetragenen Ereignissen später als das Ereignis)
  for (const f of p.feststellungen) if (f.erfasstAm ?? f.datum) e.push({ wo: `feststellungen ${f.id}`, bereich: 'feststellungen', id: f.id, datum: (f.erfasstAm ?? f.datum)!, text: t([f.beschreibung, f.nachweis, f.ursache]), verbindlich: true });
  // Prozessstand: Einstufung der Reife und Übernahme aus draw.io gegen die IDs in Notiz und Nachweisen
  for (const x of p.prozesse ?? []) {
    if (x.reifeAm) e.push({ wo: `prozesse ${x.id} reifeAm`, bereich: 'prozesse', id: x.id, datum: x.reifeAm, text: t([x.notiz, x.nachweise, x.letzteDurchfuehrung]), verbindlich: true });
    if (x.drawio) e.push({ wo: `prozesse ${x.id} drawio`, bereich: 'prozesse', id: x.id, datum: x.drawio.importiertAm.slice(0, 10), text: t(x.schritte?.map((s) => s.text)), verbindlich: true });
  }
  const o = p.organisation;
  if (o.leitlinie.freigabe) e.push({ wo: 'organisation.leitlinie', bereich: 'organisation', id: 'leitlinie', datum: o.leitlinie.freigabe.am, text: t([o.leitlinie.grundsaetze, o.leitlinie.ausnahmeprozess]), verbindlich: true });
  if (o.geltungsbereich.freigabe) e.push({ wo: 'organisation.geltungsbereich', bereich: 'organisation', id: 'geltungsbereich', datum: o.geltungsbereich.freigabe.am, text: t(o.geltungsbereich), verbindlich: true });
  if (o.projektauftrag?.freigabe) e.push({ wo: 'organisation.projektauftrag', bereich: 'organisation', id: 'projektauftrag', datum: o.projektauftrag.freigabe.am, text: t({ ...o.projektauftrag, meilensteine: undefined }), verbindlich: true });
  return e;
}

/**
 * Belegaussagen, die sich auf Dokumente stützen: Wirksamkeit der Controls, erledigte Massnahmen (Titel und Beschreibung
 * nennen die erarbeiteten Dokumente), Checklisten durchgeführter Audits (gesehener Nachweis), Wirksamkeit von Feststellungen.
 * Verbindlich (Fehler) nur bei den Status «wirksam» und «erledigt» (W2); Checklisten und Feststellungen melden Hinweise.
 */
export function belegAussagen(p: Projekt): DatierteAussage[] {
  const e: DatierteAussage[] = [];
  for (const c of p.controls) {
    const w = c.wirksamkeit;
    if (w?.wann) e.push({ wo: `controls ${c.id} wirksamkeit`, bereich: 'soa', id: c.id, datum: w.wann, text: `${w.wie ?? ''} ${w.ergebnis ?? ''}`, verbindlich: c.status === 'wirksam' });
  }
  for (const m of p.massnahmen) if (m.status === 'erledigt' && m.erledigtAm) e.push({ wo: `massnahmen ${m.id} erledigt`, bereich: 'massnahmen', id: m.id, datum: m.erledigtAm, text: `${m.titel} ${m.beschreibung}`, verbindlich: true });
  for (const a of p.audits) {
    const ende = a.durchgefuehrtBis ?? a.durchgefuehrt;
    if (!ende) continue;
    for (const [c, x] of Object.entries(a.checkliste ?? {})) if (x.nachweis) e.push({ wo: `audits ${a.id} checkliste ${c}`, bereich: 'audits', id: a.id, datum: ende, text: x.nachweis, verbindlich: false });
  }
  for (const f of p.feststellungen) if (f.wirksamkeit?.am) e.push({ wo: `feststellungen ${f.id} wirksamkeit`, bereich: 'feststellungen', id: f.id, datum: f.wirksamkeit.am, text: f.wirksamkeit.ergebnis, verbindlich: false });
  return e;
}

/** Abweichung der zeitlichen Gültigkeit; regel ordnet sie der Prüfregel zu (F39, F40, F41) oder nur der Datumsprüfung */
export interface ZeitAbweichung {
  regel: 'F39' | 'F40' | 'F41' | 'daten';
  wo: string;
  bereich?: string;
  id?: string;
  verbindlich: boolean;
  /** Kennung oder Dokument, das den Befund auslöst */
  bezug: string;
  was: string;
  /** F41: jüngeres Datum im Text (JJJJ-MM-TT), für die Meldung im Datumsformat der Sprache */
  datum?: string;
}

/** Wörter vor einem Verweis, die sagen, dass ein Ereignis nach einem Dokument ablief */
const NACH_DOKUMENT = /(?<![\p{L}])(?:nach|gemäss|laut|following|according to|as per|in line with)(?![\p{L}])[^.;:]{0,30}?(?<![\w-])((?:D|E|N)-\d{2}(?:-EB|-KI-\d{3})?)(?![\w-])/giu;
/** Verweis mit Version: «D-12 v1.1», «D-12 Version 1.1», «D-12, version 1.1» */
const DOK_VERSION = /(?<![\w-])((?:D|E|N)-\d{2}(?:-EB|-KI-\d{3})?)(?![\w-]),?\s*(?:v|Version\s*|version\s*)(\d+\.\d+)(?![\d.]\d)/g;
/** Gekennzeichnetes Datum des Stands: «Stand 02.11.2026», «abgerufen am 02.11.2026», «as of 02/11/2026», «Stand 11.2026» */
const STAND_DATUM = /(?<![\p{L}])(?:Stand(?: vom| per| am)?|abgerufen am|geprüft am|as of|as at|retrieved on|accessed on|checked on)\s*:?\s*(?:(\d{2})[./](\d{2})[./](\d{4})|(\d{2})[./](\d{4}))(?![\d])/giu;
const DATUM = /\b(\d{2})[./](\d{2})[./](\d{4})\b/g;

/** Sätze eines Texts (Punkt in Daten wie 25.08.2026 trennt nicht) */
const saetze = (text: string) => text.split(/(?<=[.;!?])\s+(?=[\p{Lu}«"(])/u);

/**
 * F39: Kennungen im Text einer datierten Aussage, die erst nach ihr entstanden sind; Audits, die bis zum Datum nicht
 * durchgeführt sind, zählen als zu jung.
 */
export function belegeJuenger(p: Projekt): ZeitAbweichung[] {
  const { hart } = ereignisse(p);
  const a: ZeitAbweichung[] = [];
  const auditEnde = (id: string) => {
    const x = p.audits.find((y) => y.id === id);
    return x?.durchgefuehrtBis ?? x?.durchgefuehrt;
  };
  const aussagen = [...datierteEintraege(p), ...belegAussagen(p).filter((x) => x.bereich === 'soa')];
  for (const e of aussagen) {
    const datum = tag(e.datum);
    const gesehen = new Set<string>();
    for (const m of e.text.matchAll(ID_MUSTER)) {
      const id = m[1]!;
      if (gesehen.has(id) || id === e.id) continue;
      gesehen.add(id);
      const entstanden = id.startsWith('AU-') && e.bereich === 'soa' ? auditEnde(id) : hart.get(id);
      if (id.startsWith('AU-') && e.bereich === 'soa' && !entstanden) a.push({ regel: 'F39', wo: e.wo, bereich: e.bereich, id: e.id, verbindlich: e.verbindlich, bezug: id, was: `${id} ist nicht durchgeführt` });
      else if (entstanden && tag(entstanden) > datum) a.push({ regel: 'F39', wo: e.wo, bereich: e.bereich, id: e.id, verbindlich: e.verbindlich, bezug: id, was: `${id} vom ${tag(entstanden)} nach der Aussage vom ${datum}` });
    }
  }
  return a;
}

/**
 * F40: Verweise auf Dokumente, die zum Belegdatum noch nicht freigegeben waren: Dokument erst später erstmals
 * freigegeben, genannte Version erst später freigegeben oder (noch) nicht vorhanden, Ereignis «nach D-xx» vor D-xx.
 */
export function verweiseVorFreigabe(p: Projekt): ZeitAbweichung[] {
  const a: ZeitAbweichung[] = [];
  for (const e of belegAussagen(p)) {
    const datum = tag(e.datum);
    const gemeldet = new Set<string>();
    const melde = (bezug: string, was: string) => {
      if (gemeldet.has(bezug)) return;
      gemeldet.add(bezug);
      a.push({ regel: 'F40', wo: e.wo, bereich: e.bereich, id: e.id, verbindlich: e.verbindlich, bezug, was });
    };
    // (1) Dokument erst nach dem Belegdatum erstmals freigegeben (ohne Zusatz «in Erarbeitung»)
    for (const m of e.text.matchAll(DOK_MUSTER)) {
      const ref = m[1]!;
      const erst = ersteFreigabe(p, ref);
      const geplant = GEPLANT.test(e.text.slice(m.index! + ref.length, m.index! + ref.length + 20));
      if (erst && erst > datum && !geplant) melde(ref, `${ref} erst am ${erst} freigegeben, Beleg vom ${datum}`);
    }
    // (2) Genannte Version erst nach dem Belegdatum freigegeben oder jünger als die aktuelle Version
    for (const m of e.text.matchAll(DOK_VERSION)) {
      const [, ref, version] = m as unknown as [string, string, string];
      const eintrag = dokEintrag(p, ref);
      if (!eintrag) continue;
      const am = versionFreigabe(p, ref, version);
      if (am && am > datum) melde(`${ref} ${version}`, `${ref} Version ${version} erst am ${am} freigegeben, Beleg vom ${datum}`);
      else if (!am && versionWert(version) > versionWert(eintrag.version)) melde(`${ref} ${version}`, `${ref} Version ${version} gibt es nicht (aktuell ${eintrag.version})`);
    }
    // (3) Ereignis mit Datum «nach den Schritten in D-xx», das Dokument war an diesem Tag noch nicht freigegeben
    for (const satz of saetze(e.text)) {
      const daten = [...satz.matchAll(DATUM)].map((d) => ({ i: d.index!, iso: `${d[3]}-${d[2]}-${d[1]}` }));
      if (!daten.length) continue;
      for (const m of satz.matchAll(NACH_DOKUMENT)) {
        const ref = m[1]!;
        const erst = ersteFreigabe(p, ref);
        const ereignis = daten.filter((d) => d.i < m.index!).at(-1);
        if (erst && ereignis && erst > ereignis.iso) melde(ref, `Ereignis vom ${ereignis.iso} nach ${ref}, das erst am ${erst} freigegeben wurde`);
      }
    }
  }
  return a;
}

/** Stand des Kits, den ein Dokument abdruckt: AI Act in E-01 bis E-09, NIST AI RMF in N-01 und N-02 */
interface StandAngaben {
  aiAct?: { geprueft_am?: string; hinweise?: { id: string; geprueft_am?: string; stand?: string }[] };
  nist?: { geprueft_am?: string };
}
function standImDokument(id: string, s: StandAngaben, p: Projekt): string | undefined {
  if (/^E-0\d$/.test(id) && p.meta.modulAiAct) {
    const daten = [s.aiAct?.geprueft_am];
    // E-09 führt zusätzlich die Hinweise mit eigenem Prüfdatum und den Stand der Schweizer Angaben (Monat)
    if (id === 'E-09') for (const h of s.aiAct?.hinweise ?? []) daten.push(h.geprueft_am, h.stand ? `${h.stand}-01` : undefined);
    return daten.filter((d): d is string => !!d).map(tag).sort().at(-1);
  }
  if (/^N-0[12]$/.test(id) && p.meta.modulNistRmf) return s.nist?.geprueft_am ? tag(s.nist.geprueft_am) : undefined;
  return undefined;
}

/**
 * F41: Datum im Text jünger als das Kopfdatum. (a) Dokument druckt den Stand des Kits ab, der jünger ist als seine
 * Fassung (Freigabe oder spätere Bestätigung); (b) eine datierte Aussage nennt einen Stand nach ihrem eigenen Datum.
 */
export function standNachKopfdatum(p: Projekt, stand: StandAngaben = {}): ZeitAbweichung[] {
  const a: ZeitAbweichung[] = [];
  for (const d of p.dokumente) {
    const kopf = [d.freigabe?.am, d.bestaetigt?.am].filter((x): x is string => !!x).map(tag).sort().at(-1);
    const s = standImDokument(d.id, stand, p);
    if (kopf && s && s > kopf) a.push({ regel: 'F41', wo: `dokumente ${d.id}`, bereich: 'dokumente', id: d.id, verbindlich: d.status === 'freigegeben', bezug: s, datum: s, was: `Stand vom ${s} im Dokument vom ${kopf}` });
  }
  for (const e of [...datierteEintraege(p), ...belegAussagen(p)]) {
    const datum = tag(e.datum);
    for (const m of e.text.matchAll(STAND_DATUM)) {
      const iso = m[3] ? `${m[3]}-${m[2]}-${m[1]}` : `${m[5]}-${m[4]}-01`;
      // Monatsangabe: erst ab dem Folgemonat jünger als ein Datum im selben Monat
      const juenger = m[3] ? iso > datum : iso.slice(0, 7) > datum.slice(0, 7);
      if (juenger) {
        a.push({ regel: 'F41', wo: e.wo, bereich: e.bereich, id: e.id, verbindlich: e.verbindlich, bezug: m[0], datum: iso, was: `«${m[0]}» in der Aussage vom ${datum}` });
        break;
      }
    }
  }
  return a;
}

/**
 * Weitere Datumsketten der Projektdaten (nur Datumsprüfung der Beispiele; im Werkzeug decken H-Regeln und die
 * Stimmigkeit sie ab): Nummernfolge der Massnahmen, Änderungshistorie, Erfassung vor dem Ereignis, Bestätigung vor der
 * Freigabe, erledigte Massnahme vor den Dokumenten, die sie erarbeitet, Risiko vor der Erfassung beurteilt, Wirksamkeit
 * gegen das genannte Audit.
 */
export function weitereDatumsketten(p: Projekt): ZeitAbweichung[] {
  const a: ZeitAbweichung[] = [];
  const { hart } = ereignisse(p);
  const daten = (wo: string, was: string) => a.push({ regel: 'daten', wo, verbindlich: true, bezug: '', was });
  // Reihenfolge der M-Nummern: Erfassungsdatum steigt mit der Nummer (IDs werden fortlaufend vergeben)
  let vorher: { id: string; d: string } | undefined;
  for (const m of [...p.massnahmen].sort((x, y) => x.id.localeCompare(y.id, 'de', { numeric: true }))) {
    const d = hart.get(m.id);
    if (!d) continue;
    if (vorher && d < vorher.d) daten(`massnahmen ${m.id}`, `(${d}) erfasst vor ${vorher.id} (${vorher.d}): Nummernfolge`);
    if (!vorher || d >= vorher.d) vorher = { id: m.id, d };
  }
  // Versionen über 1.0 mit Änderungshistorie; letzte Zeile = aktuelle Version und Freigabe
  for (const d of p.dokumente) {
    const h = d.aenderungen ?? [];
    if (/^\d+\.\d+$/.test(d.version) && Number(d.version) > 1 && !h.some((x) => x.version === d.version)) daten(`dokumente ${d.id}`, `Version ${d.version} ohne Eintrag in der Änderungshistorie`);
    const letzte = [...h].sort((x, y) => x.datum.localeCompare(y.datum)).at(-1);
    if (letzte && (letzte.version !== d.version || (d.freigabe?.am && letzte.datum !== d.freigabe.am))) daten(`dokumente ${d.id}`, `letzte Änderung ${letzte.version} vom ${letzte.datum}, Register ${d.version} vom ${d.freigabe?.am ?? '-'}`);
    if (d.bestaetigt?.am && d.freigabe?.am && d.bestaetigt.am < d.freigabe.am) daten(`dokumente ${d.id}`, `bestätigt am ${d.bestaetigt.am}, vor der Freigabe vom ${d.freigabe.am}`);
  }
  // Wirksamkeitsprüfung der Controls im Einklang mit dem genannten Audit
  for (const c of p.controls) {
    const w = c.wirksamkeit;
    if (!w?.wann) continue;
    const text = `${w.wie ?? ''} ${w.ergebnis ?? ''}`;
    for (const auId of text.match(/\bAU-\d{3}\b/g) ?? []) {
      const au = p.audits.find((x) => x.id === auId);
      const ende = au?.durchgefuehrtBis ?? au?.durchgefuehrt;
      if (!au || !ende || ende > w.wann) continue; // F39
      const ergebnis = au.checkliste?.[c.id]?.ergebnis;
      const nk = p.feststellungen.filter((f) => f.audit === auId && f.einstufung.startsWith('nk') && f.normbezug.split(/[,;]\s*/).map((x) => x.trim()).includes(c.id));
      if (au.checkliste && !au.checkliste[c.id]) daten(`controls ${c.id} wirksamkeit`, `${auId} ohne Prüfpunkt ${c.id} in der Checkliste`);
      else if (ergebnis === 'nicht-pruefbar' || ergebnis === 'nicht-geprueft') daten(`controls ${c.id} wirksamkeit`, `${auId} hat ${c.id} als «${ergebnis}» eingestuft`);
      else if (nk.length && !nk.some((f) => text.includes(f.id))) daten(`controls ${c.id} wirksamkeit`, `${auId} mit ${nk.map((f) => f.id).join(', ')} zu diesem Control, im Text nicht genannt`);
    }
    // Feststellungen ausserhalb von Audits zum Control vor der Prüfung: im Text nennen (massgebend ist die Erfassung)
    for (const f of p.feststellungen.filter((x) => x.quelle !== 'audit' && (x.erfasstAm ?? x.datum) && (x.erfasstAm ?? x.datum)! <= w.wann! && x.normbezug.split(/[,;]\s*/).map((y) => y.trim()).includes(c.id))) {
      if (!text.includes(f.id)) daten(`controls ${c.id} wirksamkeit`, `(${w.wann}): ${f.id} vom ${f.datum} zum Control nicht berücksichtigt`);
    }
  }
  for (const f of p.feststellungen) if (f.erfasstAm && f.datum && f.erfasstAm < f.datum) daten(`feststellungen ${f.id}`, `erfasst am ${f.erfasstAm}, vor dem Ereignis vom ${f.datum}`);
  for (const r of p.risiken.filter((x) => x.erfasstAm)) {
    for (const [was, d] of [['beurteilt', r.beurteiltAm], ['Restrisiko angenommen', r.restrisikoAkzeptiert?.am]] as const) {
      if (d && d < r.erfasstAm!) daten(`risiken ${r.id}`, `${was} am ${d}, erfasst erst am ${r.erfasstAm}`);
    }
  }
  return a;
}

/** Alle Abweichungen der zeitlichen Gültigkeit (Prüfregeln F39 bis F41 und weitere Datumsketten) */
export function zeitlicheGueltigkeit(p: Projekt, stand: StandAngaben = {}): ZeitAbweichung[] {
  return [...belegeJuenger(p), ...verweiseVorFreigabe(p), ...standNachKopfdatum(p, stand), ...weitereDatumsketten(p)];
}

export type { StandAngaben };

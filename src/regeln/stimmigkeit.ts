// Stimmigkeit eines ausgefüllten Projekts: Passen Datumsketten, Nachweise, Kennzahlen, Reife und Prüfumfang zu den
// Aufzeichnungen, aus denen sie stammen sollen? Prüft Inhalt statt gefüllter Felder (Runde 2, A2-01 bis A2-06).
// Genutzt von tests/unit/stimmigkeit.test.ts gegen die Beispielprojekte; reine Funktionen, ohne Dateizugriff.
import type { Kataloge } from '../kataloge/typen.ts';
import type { KennzahlMessung, Projekt } from '../model/typen.ts';
import { abgeleitetesDatum, ablaufVon, eintragVon, imProzesssystem, personHatRolle, prozesseImProjekt } from '../prozesse/katalog.ts';
import { plusMonate } from '../prozesse/stand.ts';

export interface Abweichung {
  art: 'datumskette' | 'nachweis' | 'kennzahl' | 'reife' | 'umfang';
  wo: string;
  was: string;
}

const tage = (von: string, bis: string) => Math.round((Date.parse(`${bis.slice(0, 10)}T00:00:00Z`) - Date.parse(`${von.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
const istRegister = (id: string) => /^D-26(-EB)?$/.test(id);
const imBetrieb = (s: Projekt['kiSysteme'][number]) => s.status === 'freigegeben' || s.status === 'eingeschraenkt';

/** Alle Freigabedaten eines Dokuments im Register */
function fassungen(d: Projekt['dokumente'][number]): string[] {
  return [...(d.aenderungen ?? []).map((a) => a.datum), d.freigabe?.am].filter((x): x is string => !!x);
}

/** Datumsketten: Register und Dokumente gegen ihren Inhalt */
export function datumsketten(p: Projekt): Abweichung[] {
  const a: Abweichung[] = [];
  const reg = p.dokumente.find((d) => istRegister(d.id));
  const regDatum = reg ? fassungen(reg).sort().at(-1) : undefined;
  for (const d of p.dokumente) {
    const letzte = fassungen(d).sort().at(-1);
    if (reg && regDatum && letzte && letzte > regDatum) a.push({ art: 'datumskette', wo: reg.id, was: `Register vom ${regDatum} führt ${d.id} Version ${d.version} vom ${letzte}` });
    if (d.geprueft?.am && d.freigabe?.am && d.geprueft.am > d.freigabe.am) a.push({ art: 'datumskette', wo: d.id, was: `geprüft ${d.geprueft.am} nach der Freigabe ${d.freigabe.am}` });
    const h = [...(d.aenderungen ?? [])].sort((x, y) => x.datum.localeCompare(y.datum)).at(-1);
    if (h && h.version !== d.version) a.push({ art: 'datumskette', wo: d.id, was: `letzte Änderung trägt Version ${h.version}, Register ${d.version}` });
    if (d.bestaetigt?.am && d.freigabe?.am && d.bestaetigt.am < d.freigabe.am) a.push({ art: 'datumskette', wo: d.id, was: `bestätigt ${d.bestaetigt.am} vor der Freigabe ${d.freigabe.am}` });
  }
  // Kennzahlen und Durchführung: D-05 und D-27 zeigen keine Messung, die jünger ist als die jüngste D-05 oder D-27 im Dossier
  const d05 = p.dokumente.find((d) => d.id === 'D-05');
  const d05Datum = d05 ? fassungen(d05).sort().at(-1) : undefined;
  const d27 = p.dokumente.find((d) => d.id === 'D-27');
  const d27Datum = d27 ? fassungen(d27).sort().at(-1) : undefined;
  for (const m of p.kennzahlMessungen ?? []) {
    if (d05Datum && m.datum > d05Datum) a.push({ art: 'datumskette', wo: 'D-05', was: `Messung ${m.kennzahl} vom ${m.datum} nach D-05 vom ${d05Datum}` });
    if (d27Datum && /^P[RSE]-/.test(m.kennzahl) && m.datum > d27Datum) a.push({ art: 'datumskette', wo: 'D-27', was: `Messung ${m.kennzahl} vom ${m.datum} nach D-27 vom ${d27Datum}` });
  }
  return a;
}

/** Tage, die ein Protokoll nach dem Abschluss der Massnahme entstehen darf */
const NACHLAUF = 7;
const FUELLWORT = new Set(['massnahme', 'bericht', 'protokoll', 'erste', 'ersten', 'erster', 'sowie', 'neuer', 'neues', 'einführen', 'festlegen', 'prüfung', 'version']);
const worte = (t: string) => new Set((t.toLowerCase().match(/[\p{L}-]{5,}/gu) ?? []).flatMap((w) => [w, ...w.split('-').filter((x) => x.length >= 5)]).filter((w) => !FUELLWORT.has(w)));
/** Gemeinsamer Wortstamm: gleiche Wörter oder ein Wort im anderen enthalten (Schulung in Schulungsnachweise) */
const gleicherStamm = (x: string, y: string) => x === y || (x.length >= 7 && y.includes(x)) || (y.length >= 7 && x.includes(y)) || (x.length >= 7 && y.length >= 7 && x.slice(0, 7) === y.slice(0, 7));
const bezug = (a: Set<string>, b: Set<string>) => [...a].some((x) => [...b].some((y) => gleicherStamm(x, y)));

/**
 * Nachweis gegen Massnahme: Jeder Nachweis einer erledigten Massnahme stammt aus deren Laufzeit (ab Erfassung, bis kurz nach
 * dem Abschluss), mindestens einer belegt den Abschluss zeitnah. Mit `bezugPruefen` auch der sachliche Bezug (Text in der
 * Dokumentsprache Deutsch): Titel oder Beschreibung der Massnahme teilen ein Fachwort mit dem Titel des Nachweises.
 */
export function nachweiseGegenMassnahmen(p: Projekt, opt: { bezugPruefen?: boolean; dokumentTitel?: (id: string) => string } = {}): Abweichung[] {
  const a: Abweichung[] = [];
  for (const m of p.massnahmen.filter((x) => x.status === 'erledigt')) {
    const liste = m.nachweise ?? [];
    if (!liste.length) {
      a.push({ art: 'nachweis', wo: m.id, was: 'erledigt ohne Nachweis' });
      continue;
    }
    const seit = m.erfasstAm ?? m.start;
    const bis = m.erledigtAm;
    let zeitnah = false;
    for (const id of liste) {
      const n = p.nachweise.find((x) => x.id === id);
      const d = p.dokumente.find((x) => x.id === id || x.id === `${id}-EB`);
      const daten = n?.datum ? [n.datum] : d ? fassungen(d) : [];
      if (!n && !d) {
        a.push({ art: 'nachweis', wo: m.id, was: `${id} gibt es nicht` });
        continue;
      }
      const passend = daten.filter((x) => (!seit || x >= seit) && (!bis || tage(bis, x) <= NACHLAUF));
      if (!passend.length) a.push({ art: 'nachweis', wo: m.id, was: `${id} (${daten.join(', ')}) liegt ausserhalb der Laufzeit ${seit ?? '?'} bis ${bis ?? '?'}` });
      // Zeitnah: Nachweis aus den letzten 21 Tagen vor dem Abschluss oder kurz danach
      if (bis && passend.some((x) => tage(x, bis) <= 21)) zeitnah = true;
      if (opt.bezugPruefen && n && !d) {
        const text = worte(`${m.titel} ${m.beschreibung}`);
        if (!bezug(text, worte(n.titel)) && !n.titel.includes(m.id)) a.push({ art: 'nachweis', wo: m.id, was: `${id} «${n.titel}» ohne erkennbaren Bezug zu «${m.titel}»` });
      }
    }
    if (bis && !zeitnah && liste.some((id) => p.nachweise.some((x) => x.id === id) || p.dokumente.some((x) => x.id === id))) a.push({ art: 'nachweis', wo: m.id, was: `kein Nachweis belegt den Abschluss vom ${bis}` });
  }
  return a;
}

/** Quote aus dem Text: «29 von 33 (88 %)», «29 of 33 (88%)» */
function quoteVon(wert: string): { z: number; n: number; prozent?: number } | undefined {
  const m = /^(\d+) (?:von|of) (\d+)(?:\D*?(\d+) ?%)?/.exec(wert.trim());
  return m ? { z: Number(m[1]), n: Number(m[2]), ...(m[3] ? { prozent: Number(m[3]) } : {}) } : undefined;
}

/** Erwartete Grundgesamtheit einer Prozesskennzahl aus den Aufzeichnungen; `z` nur, wo der Zähler ausgezählt werden kann */
function ausAufzeichnungen(p: Projekt, id: string, datum: string): { n: number; z?: number } | undefined {
  const ki = p.kiSysteme;
  const betrieb = ki.filter(imBetrieb);
  switch (id) {
    case 'PR-03':
      return { n: p.rollen.length, z: p.rollen.filter((r) => r.stellvertretung).length };
    case 'PR-04': {
      const faellig = p.ziele.filter((z) => z.messungen.some((m) => m.datum <= datum) || (z.termin ?? '9') <= datum);
      return { n: faellig.length };
    }
    case 'PR-05': {
      const e = p.massnahmen.filter((m) => m.herkunft.art === 'aenderung' && m.status === 'erledigt' && (m.erledigtAm ?? '9') <= datum);
      return { n: e.length, z: e.filter((m) => m.nachweise?.length).length };
    }
    case 'PR-06':
      return { n: ki.length, z: ki.filter((s) => s.eigner && s.ressourcen).length };
    case 'PR-08':
      return { n: p.risiken.length, z: p.risiken.filter((r) => r.status === 'offen').length };
    case 'PR-09':
      return { n: ki.length, z: ki.filter((s) => p.folgenabschaetzungen.some((f) => f.kiSystem === s.id && f.freigabe?.am && f.freigabe.am <= datum)).length };
    case 'PR-10': {
      const anw = p.controls.filter((c) => c.rahmenwerk === 'ISO42001' && c.anwendbar === 'ja');
      return { n: anw.length, z: anw.filter((c) => c.status === 'wirksam').length };
    }
    case 'PR-11':
      return { n: betrieb.length, z: betrieb.filter((s) => s.freigabe?.am && s.freigabe.am <= datum).length };
    case 'PR-12':
      // Nur Systeme, die die Stichprobe am Messdatum der Zielmessung umfasst (Klausel «ab <Jahr>» wie F42, P15a AF-084)
      return { n: betrieb.length, z: betrieb.filter((s) => p.ziele.some((z) => z.kiSysteme?.includes(s.id) && z.messungen.some((m) => m.datum <= datum && m.datum >= plusMonate(datum, -3) && !nochNichtInStichprobe(p, z, m.datum).includes(s.id)))).length };
    case 'PR-13':
      return { n: ki.filter((s) => s.geaendertAm).length };
    case 'PR-16':
      return { n: ki.length, z: ki.filter((s) => s.datenklasse).length };
    case 'PR-17':
      return { n: betrieb.length };
    case 'PR-18': {
      const fertig = (p.meldungen ?? []).filter((m) => m.erledigtAm && m.erledigtAm <= datum);
      return { n: fertig.length, z: fertig.filter((m) => tage(m.datum, m.erledigtAm!) <= 30).length };
    }
    case 'PR-20':
      return { n: p.lieferanten.length, z: p.lieferanten.filter((l) => l.geprueft?.am && l.geprueft.am <= datum).length };
    case 'PR-21':
      return { n: p.kompetenzen.length, z: p.kompetenzen.filter((k) => k.status === 'erfuellt').length };
    case 'PR-23':
      return { n: p.dokumente.length };
    case 'PR-24':
      return { n: p.parteien.flatMap((x) => x.anforderungen).length };
    case 'PR-27': {
      const zu = p.feststellungen.filter((f) => f.status === 'geschlossen').length;
      const ueber = p.feststellungen.filter((f) => f.status !== 'geschlossen' && f.massnahmen.some((id) => {
        const m = p.massnahmen.find((x) => x.id === id);
        return !!m?.termin && m.termin < datum && m.status !== 'erledigt' && m.status !== 'verworfen';
      })).length;
      return { n: zu + ueber };
    }
    default:
      return undefined;
  }
}

/** Prozesskennzahlen gegen die Aufzeichnungen, je Messung einzeln */
export function kennzahlenGegenAufzeichnungen(p: Projekt, kataloge?: Kataloge): Abweichung[] {
  const a: Abweichung[] = [];
  const katalog = kataloge ? prozesseImProjekt(p, kataloge) : [];
  const projektStart = p.meta.erstellt.slice(0, 10);
  for (const m of (p.kennzahlMessungen ?? []).filter((x: KennzahlMessung) => /^P[RS]-\d/.test(x.kennzahl))) {
    const wo = m.kennzahl;
    if (m.keineMessung) {
      if (/\d ?%/.test(m.wert) || m.sollErreicht) a.push({ art: 'kennzahl', wo, was: `«keine Messung», aber Wert «${m.wert}» oder Sollvergleich` });
      if (!m.bemerkung?.trim()) a.push({ art: 'kennzahl', wo, was: 'keine Messung ohne Grund' });
      continue;
    }
    if (!m.sollErreicht) a.push({ art: 'kennzahl', wo, was: `Wert «${m.wert}» ohne Sollvergleich` });
    if (!m.bemerkung?.trim() || /Erste Messung aus den Aufzeichnungen|First measurement from the records/.test(m.bemerkung)) a.push({ art: 'kennzahl', wo, was: 'Bemerkung nennt die Herleitung nicht' });
    const kp = katalog.find((x) => x.id === m.kennzahl);
    const kz = kp?.kennzahl_vorschlag;
    const q = quoteVon(m.wert);
    if (q) {
      if (q.z > q.n) a.push({ art: 'kennzahl', wo, was: `Zähler ${q.z} über Nenner ${q.n}` });
      if (q.prozent !== undefined && q.n > 0 && q.prozent !== Math.round((q.z / q.n) * 100)) a.push({ art: 'kennzahl', wo, was: `${q.prozent} % passt nicht zu ${q.z} von ${q.n}` });
      if (m.zaehler !== undefined && m.zaehler !== q.z) a.push({ art: 'kennzahl', wo, was: `Feld Zähler ${m.zaehler}, Text ${q.z}` });
      if (m.nenner !== undefined && m.nenner !== q.n) a.push({ art: 'kennzahl', wo, was: `Feld Nenner ${m.nenner}, Text ${q.n}` });
    } else if (kz?.einheit === 'prozent') {
      a.push({ art: 'kennzahl', wo, was: `Quote «${m.wert}» ohne Zähler und Nenner` });
    }
    const soll = ausAufzeichnungen(p, m.kennzahl, m.datum);
    if (soll && q) {
      if (q.n !== soll.n) a.push({ art: 'kennzahl', wo, was: `Nenner ${q.n}, die Aufzeichnungen ergeben ${soll.n}` });
      if (soll.z !== undefined && q.z !== soll.z) a.push({ art: 'kennzahl', wo, was: `Zähler ${q.z}, die Aufzeichnungen ergeben ${soll.z}` });
    }
    // Sollvergleich rechnerisch
    if (kz && m.sollErreicht && q && q.n > 0 && kz.einheit === 'prozent') {
      const wert = (q.z / q.n) * 100;
      const erfuellt = kz.richtung === 'mindestens' ? wert >= kz.soll : wert <= kz.soll;
      if (erfuellt !== (m.sollErreicht === 'ja')) a.push({ art: 'kennzahl', wo, was: `Sollvergleich «${m.sollErreicht}» passt nicht zu ${Math.round(wert)} % gegen ${kz.soll} %` });
    }
    // Feststellung zum Prozess: Eine 100-%-Meldung widerspricht einer offenen Abweichung gegen dieselbe Kennzahl
    if (m.kennzahl === 'PR-13' && q && p.feststellungen.some((f) => f.prozesse?.includes('PR-13') && (f.datum ?? '') <= m.datum) && q.z >= q.n) a.push({ art: 'kennzahl', wo, was: 'Feststellung zu PR-13 vorhanden, Kennzahl aber voll erfüllt' });
    // Dauer in Monaten: nicht länger als das Projekt alt ist und nicht jünger als die letzte Überprüfung erlaubt
    if (kz?.einheit === 'monate') {
      const monate = Number(/^(\d+)/.exec(m.wert)?.[1] ?? NaN);
      const dok = ['D-01', 'D-02'].map((id) => p.dokumente.find((d) => d.id === id)?.freigabe?.am).filter((x): x is string => !!x && x <= m.datum).sort()[0];
      const seitPruefung = dok ? Math.floor(tage(dok, m.datum) / 30.44) : undefined;
      if (seitPruefung !== undefined && monate !== seitPruefung) a.push({ art: 'kennzahl', wo, was: `${monate} Monate, die letzte Überprüfung liegt ${seitPruefung} Monate zurück` });
      if (monate > tage(projektStart, m.datum) / 30.44) a.push({ art: 'kennzahl', wo, was: `${monate} Monate bei einem Projekt seit ${projektStart}` });
    }
    // Stunden bis zur Eindämmung: längster Fall aus dem Register. Quelle sind die Zeitfelder «Entdeckt» und «Eingedämmt»
    // (ab Schemaversion 3, AF-104); nur wenn eines leer ist, rechnet der Rückfall tagesgenau von der Entdeckung bis zur
    // ersten Datumsangabe im Korrekturtext (PR-19, Nacharbeit aus P15b).
    if (m.kennzahl === 'PR-19') {
      const stunden = Number(/^(\d+)/.exec(m.wert)?.[1] ?? NaN);
      const beginn = (f: Projekt['feststellungen'][number]) => (f.entdecktAm || f.datum || '').slice(0, 10);
      const faelle = p.feststellungen.filter((f) => (f.quelle === 'vorfall' || f.quelle === 'beinahe-vorfall') && beginn(f) && beginn(f) <= m.datum);
      const laengste = Math.max(0, ...faelle.map((f) => {
        if (f.entdecktAm && f.eingedaemmtAm) {
          const ms = (v: string) => Date.parse(v.length === 10 ? `${v}T00:00:00Z` : /(?:Z|[+-]\d{2}:\d{2})$/i.test(v) ? v : `${v}Z`);
          const h = (ms(f.eingedaemmtAm) - ms(f.entdecktAm)) / 3_600_000;
          if (Number.isFinite(h)) return Math.round(h);
        }
        const d = /(\d{2})[./](\d{2})[./](\d{4})/.exec(f.korrektur ?? '');
        return d && f.datum ? tage(f.datum, `${d[3]}-${d[2]}-${d[1]}`) * 24 : 0;
      }));
      if (faelle.length && stunden !== laengste) a.push({ art: 'kennzahl', wo, was: `${stunden} Stunden, das Register ergibt ${laengste}` });
    }
  }
  return a;
}

/** Jüngste Durchführung bis zu einem Tag: abgeleitet, von Hand oder eine frühere Fassung der Dokumente des Prozesses */
export function durchfuehrungBis(p: Projekt, e: NonNullable<Projekt['prozesse']>[number], ableitung: readonly string[], bis: string): string | undefined {
  const fruehere = ableitung
    .map((x) => /^dokumente\[id=([^\]]+)\]/.exec(x)?.[1])
    .filter((x): x is string => !!x)
    .flatMap((id) => {
      const d = p.dokumente.find((y) => y.id === id || y.id === `${id}-EB`);
      return d ? fassungen(d) : [];
    });
  return [abgeleitetesDatum(p, ableitung, bis), e.letzteDurchfuehrung, ...fruehere].filter((d): d is string => !!d && d <= bis).sort().at(-1);
}

/** Reife gegen letzte Durchführung und Messung */
export function reifeGegenDurchfuehrung(p: Projekt, kataloge?: Kataloge): Abweichung[] {
  const a: Abweichung[] = [];
  const katalog = prozesseImProjekt(p, kataloge);
  for (const e of p.prozesse ?? []) {
    if (e.anwendbar === 'nein' || (e.reife ?? 0) < 2) continue;
    const kp = katalog.find((x) => x.id === e.id);
    if (!kp || !e.reifeAm) continue;
    if (!durchfuehrungBis(p, e, kp.ableitung, e.reifeAm)) a.push({ art: 'reife', wo: e.id, was: `Reife ${e.reife} am ${e.reifeAm} ohne Durchführung bis dahin` });
    if ((e.nachweise ?? []).some((id) => (p.nachweise.find((n) => n.id === id)?.datum ?? '') > e.reifeAm!)) a.push({ art: 'reife', wo: e.id, was: `Nachweis jünger als die Einstufung vom ${e.reifeAm}` });
    for (const mb of p.managementbewertungen) if (mb.datum && e.reifeAm > mb.datum && mb.datum >= '2000' && p.managementbewertungen.length === 1) a.push({ art: 'reife', wo: e.id, was: `Einstufung vom ${e.reifeAm}, nach der Bewertung ${mb.id} vom ${mb.datum}, die die Stufe zählt` });
  }
  return a;
}

/** Umfang von Audit und Bewertung: Alle Prozesse sind vor Stage 1 geprüft, Lehren aus Feststellungen gehen ins nächste Audit */
export function pruefumfang(p: Projekt): Abweichung[] {
  const a: Abweichung[] = [];
  const intern = p.audits.filter((x) => x.art === 'intern');
  const stage1 = p.audits.find((x) => x.art !== 'intern' && /Stage[- ]1|stage[- ]1/.test(x.umfang));
  const vorStage1 = intern.filter((x) => !stage1?.geplant || (x.durchgefuehrt ?? x.geplant ?? '9') <= stage1.geplant);
  const aktiv = (p.prozesse ?? []).filter((e) => e.anwendbar !== 'nein' && e.reife !== undefined && (e.reife ?? 0) >= 1).map((e) => e.id);
  const ganz = vorStage1.some((x) => !x.umfangProzesse?.length && /4\.4/.test(x.umfang));
  const umfasst = new Set(vorStage1.flatMap((x) => x.umfangProzesse ?? []));
  if (!ganz) for (const id of aktiv) if (!umfasst.has(id)) a.push({ art: 'umfang', wo: id, was: 'Prozess in keinem internen Audit vor Stage 1' });
  // Feststellung ausserhalb eines Audits zu einem Control, das das letzte Audit als konform gewertet hat: Nachprüfung im nächsten Audit
  const durch = intern.filter((x) => x.durchgefuehrt).sort((x, y) => x.durchgefuehrt!.localeCompare(y.durchgefuehrt!)).at(-1);
  const naechstes = intern.filter((x) => !x.durchgefuehrt && x.geplant).sort((x, y) => x.geplant!.localeCompare(y.geplant!))[0];
  if (durch?.checkliste && naechstes) {
    for (const f of p.feststellungen.filter((x) => x.quelle === 'managementbewertung')) {
      for (const c of f.normbezug.split(/[,;]\s*/).map((x) => x.trim()).filter((x) => /^A\.\d/.test(x))) {
        const eintrag = durch.checkliste[c];
        if (eintrag && (!eintrag.ergebnis || eintrag.ergebnis === 'konform') && !naechstes.umfangControls?.includes(c)) a.push({ art: 'umfang', wo: naechstes.id, was: `${f.id} zu ${c}, ${durch.id} wertete konform; Nachprüfung fehlt im Umfang` });
      }
    }
  }
  // Bewertung: Eingaben aus Audits, die bis zur Bewertung durchgeführt sind
  for (const mb of p.managementbewertungen) {
    if (mb.datum && !intern.some((x) => x.durchgefuehrt && x.durchgefuehrt <= mb.datum!)) a.push({ art: 'umfang', wo: mb.id, was: 'Bewertung ohne vorheriges internes Audit' });
  }
  return a;
}

export function stimmigkeit(p: Projekt, opt: { kataloge?: Kataloge; bezugPruefen?: boolean } = {}): Abweichung[] {
  return [...datumsketten(p), ...nachweiseGegenMassnahmen(p, { bezugPruefen: opt.bezugPruefen }), ...kennzahlenGegenAufzeichnungen(p, opt.kataloge), ...reifeGegenDurchfuehrung(p, opt.kataloge), ...pruefumfang(p)];
}

// ---------------------------------------------------------------------------------------------
// Statusregeln und Stimmigkeit als Prüfregeln im Produkt (Runde 2b, AF-076, AF-079; K-AUD-02, K-AUD-07, K-AUD-11).
// Muster «Status zu gut»: Ein Status darf nicht mehr sagen, als die Aufzeichnungen tragen.
// Jede Funktion liefert einen gebündelten Befund je Objekt (W3); `verbindlich` sagt, ob der Status, an dem die Pflicht
// hängt, schon erreicht ist (W2: Fehler erst bei «freigegeben», «erledigt», «wirksam», vorher Hinweis).

export interface StatusBefund {
  /** betroffenes Objekt (Control, Prozess, Dokument, KI-System) */
  id: string;
  /** Kennungen, die den Befund begründen (Feststellungen, Prozesse, Systeme, Fundorte) */
  details: string[];
  verbindlich: boolean;
  /** Ort der fehlenden Angabe für den Sprung: Bereich im Werkzeug, Eintrag und Feld (F43) */
  ort?: { bereich: string; eintrag?: string; feld?: string };
}

/** Normbezug einer Feststellung als Liste («A.5.2, 9.1» → ['A.5.2', '9.1']) */
export const normbezugListe = (n: string) => n.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);

/** F34 (A3-04): Control «wirksam», obwohl eine offene Nichtkonformität dieses Control betrifft */
export function wirksamTrotzOffenerFeststellung(p: Projekt): StatusBefund[] {
  const offen = p.feststellungen.filter((f) => (f.einstufung === 'nk-schwer' || f.einstufung === 'nk-leicht') && f.status !== 'geschlossen');
  return p.controls
    .filter((c) => c.status === 'wirksam')
    .map((c) => ({ id: c.id, details: offen.filter((f) => normbezugListe(f.normbezug).includes(c.id)).map((f) => f.id), verbindlich: true }))
    .filter((b) => b.details.length > 0);
}

/** F35: Prozess als «eingeführt» oder höher eingestuft, aber ohne Durchführung bis zum Tag der Einstufung (4.4) */
export function eingefuehrtOhneDurchfuehrung(p: Projekt, kataloge?: Kataloge): StatusBefund[] {
  if (!p.prozesse) return [];
  const katalog = prozesseImProjekt(p, kataloge);
  return p.prozesse
    .filter((e) => e.anwendbar !== 'nein' && (e.reife ?? 0) >= 2 && e.reifeAm)
    .filter((e) => {
      const kp = katalog.find((x) => x.id === e.id);
      return kp !== undefined && !durchfuehrungBis(p, e, kp.ableitung, e.reifeAm!);
    })
    .map((e) => ({ id: e.id, details: [e.reifeAm!], verbindlich: true }));
}

/** Platzhalter in Textwerten: Vorlagentexte, «noch nicht zugewiesen», Arbeitsmarken in Grossbuchstaben */
const PLATZHALTER = /noch nicht zugewiesen|not yet assigned|Text ergänzen|Liste ergänzen|Add text|Add list|TT\.MM\.JJJJ|DD\/MM\/YYYY/iu;
const ARBEITSMARKE = /(?<![\p{L}\p{N}])(?:TODO|TBD|XXX)(?![\p{L}\p{N}])/u;
/** Liste im Projekt → Dokument, in dem ihre Texte stehen */
const DOKUMENT_DER_LISTE: [string, (p: Projekt) => unknown][] = [
  ['D-04', (p) => [p.personen, p.rollen]],
  ['D-10', (p) => p.kiSysteme],
  ['D-07', (p) => [p.risiken, p.massnahmen]],
  ['D-11', (p) => p.controls],
  ['D-05', (p) => [p.ziele, p.kennzahlen]],
  ['D-20', (p) => p.audits],
  ['D-21', (p) => p.managementbewertungen],
  ['D-22', (p) => p.feststellungen],
  ['D-16', (p) => p.lieferanten],
  ['D-01', (p) => [p.parteien, p.organisation.kontext]],
  ['D-03', (p) => p.organisation.leitlinie],
  ['D-02', (p) => p.organisation.geltungsbereich],
];
/** Textwerte mit Fundort (Kennung des nächsten Eintrags) */
function texteMitOrt(v: unknown, ort = ''): { ort: string; text: string }[] {
  if (typeof v === 'string') return [{ ort, text: v }];
  if (Array.isArray(v)) return v.flatMap((x) => texteMitOrt(x, ort));
  if (v && typeof v === 'object') {
    const id = (v as { id?: unknown }).id;
    const hier = typeof id === 'string' ? id : ort;
    return Object.entries(v).flatMap(([k, x]) => (k === 'drawio' ? [] : texteMitOrt(x, hier)));
  }
  return [];
}

/** F36: Dokument «freigegeben», dessen Angaben noch Platzhalter oder «noch nicht zugewiesen» enthalten (Q10) */
export function platzhalterInDokumenten(p: Projekt): StatusBefund[] {
  const b: StatusBefund[] = [];
  for (const [dok, liste] of DOKUMENT_DER_LISTE) {
    const orte = [...new Set(texteMitOrt(liste(p)).filter((x) => PLATZHALTER.test(x.text) || ARBEITSMARKE.test(x.text)).map((x) => x.ort || dok))];
    if (!orte.length) continue;
    const eintrag = p.dokumente.find((d) => d.id === dok) ?? p.dokumente.find((d) => d.id === `${dok}-EB`);
    b.push({ id: eintrag?.id ?? dok, details: orte, verbindlich: eintrag?.status === 'freigegeben' });
  }
  return b;
}

/** Rollen, die in jedem Fall eine Stelle haben: Leitung, AIMS-Verantwortung, Eignerschaft des Systems, alle Mitarbeitenden */
const ROLLEN_OHNE_BESETZUNG = new Set(['gl', 'aims', 'ki-eigner', 'mitarbeitende']);

/**
 * F37 (A3-01): Rollen in den Bahnen der Prozesse, die weder ein Bereich der Zuständigkeitsmatrix sind noch eine Person
 * haben (D-04 schreibt dann «noch nicht zugewiesen»). Ein Befund für D-04 mit den unbesetzten Rollen.
 */
export function prozessrollenOhneBesetzung(p: Projekt, kataloge?: Kataloge): StatusBefund[] {
  if (p.prozesse === undefined || !kataloge) return [];
  const rollen = unbesetzteProzessrollen(p, kataloge);
  if (!rollen.length) return [];
  const d04 = p.dokumente.find((d) => d.id === 'D-04') ?? p.dokumente.find((d) => d.id === 'D-04-EB');
  // details: die unbesetzten Rollen (Schlüssel), nicht die Prozesse (Prüfung P11: der nächste Schritt gilt der Rolle)
  return [{ id: d04?.id ?? 'D-04', details: rollen, verbindlich: d04?.status === 'freigegeben' }];
}

/**
 * Unbesetzte Rollen in den Bahnen (F37), sortiert; mit `prozessId` nur die eines Prozesses (C4-03: Hinweis auf der
 * Prozessseite, nicht erst in der Prüfung).
 */
export function unbesetzteProzessrollen(p: Projekt, kataloge: Kataloge, prozessId?: string): string[] {
  if (p.prozesse === undefined) return [];
  // Ein Bereich besetzt die Bahn nur mit verantwortlicher Person (wie F14; P19-Prüfung N1): eine leere Zeile ist keine Besetzung
  const bereiche = new Set<string>(p.rollen.filter((r) => typeof r.verantwortlich === 'string' && r.verantwortlich.trim() !== '').map((r) => r.bereich));
  const rollen = new Set<string>();
  for (const kp of prozesseImProjekt(p, kataloge).filter((x) => imProzesssystem(p, x) && (!prozessId || x.id === prozessId))) {
    const a = ablaufVon({ roh: () => undefined }, kp, eintragVon(p, kp.id));
    for (const bahn of a.bahnen.filter((x) => a.schritte.some((s) => s.bahn === x.id))) {
      const rolle = bahn.rolle ?? bahn.id;
      if (ROLLEN_OHNE_BESETZUNG.has(rolle) || bereiche.has(rolle) || bahn.person) continue;
      // Funktion der Person («Rolle im Projekt»), auch mit abweichendem Schlüssel (dsb, ism, auditor; C4-02)
      if (!p.personen.some((x) => personHatRolle(x, rolle))) rollen.add(rolle);
    }
  }
  return [...rollen].sort();
}

/** Artikel, die ein KI-System nach seinen Angaben betrifft (für offene Auslegungen im Stand des Kits) */
function artikelDesSystems(s: Projekt['kiSysteme'][number]): string[] {
  return [...s.aiAct.transparenz.map((x) => `50(${x.slice(3)})`), ...(s.aiAct.ausnahmeArt63 ? ['6(3)'] : [])];
}

/**
 * F38 (A3-22, R6): «juristisch geprüft» ohne Beleg (wer, wann) oder neben einer offenen Auslegung: Hinweis im Stand des
 * Kits mit Status «auslegung» oder «zu_pruefen», der einen Artikel des Systems betrifft.
 */
export function juristischOhneBeleg(p: Projekt, stand?: { hinweise?: { id: string; status?: string; artikel?: string[] }[] }): StatusBefund[] {
  const offen = (stand?.hinweise ?? []).filter((h) => h.status === 'auslegung' || h.status === 'zu_pruefen');
  return p.kiSysteme
    .filter((s) => s.status !== 'abgeloest' && s.status !== 'untersagt' && s.aiAct.juristischGeprueft)
    .map((s) => {
      const artikel = artikelDesSystems(s);
      const details = [
        ...(s.aiAct.geprueft?.am ? [] : ['beleg']),
        ...offen.filter((h) => (h.artikel ?? []).some((a) => artikel.includes(a) || artikel.some((x) => x.startsWith(`${a}(`)))).map((h) => h.id),
      ];
      return { id: s.id, details, verbindlich: true };
    })
    .filter((b) => b.details.length > 0);
}

const STOPPWORT = new Set(['ki', 'ai', 'im', 'in', 'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'für', 'the', 'for', 'and', 'of', 'mit', 'von', 'with', 'funktion', 'function', 'system', 'tool', 'werkzeug', 'schatten', 'shadow']);
/** Wörter eines Systemnamens, an denen eine Messmethode das System erkennt (z. B. «ERP» in «Bestellvorschläge der ERP-KI») */
const namensWoerter = (name: string) => [...new Set(name.split(/[\s(),/-]+/).filter((w) => w.length >= 3 && !STOPPWORT.has(w.toLowerCase())))];
const nenntWort = (text: string, wort: string) => new RegExp(`(?<![\\p{L}\\p{N}])${wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(text);
/** Text nennt das System über seine Kennung oder ein Wort seines Namens */
const nenntSystem = (text: string, s: Projekt['kiSysteme'][number]) => text.includes(s.id) || namensWoerter(s.name).some((w) => nenntWort(text, w));
/** Klausel, die Systeme erst ab einem Jahr in die Stichprobe nimmt: «ab 2027 zusätzlich …», «from 2027 also …» */
const AB_JAHR = /(?<![\p{L}])(?:ab|from|starting(?: in)?|beginning(?: in)?)\s+(?:dem Jahr\s+|the year\s+)?(\d{4})(?!\d)([^.;]*)/giu;

/** Systeme, die die Messmethode eines Ziels zum Messdatum noch nicht einschliesst */
export function nochNichtInStichprobe(p: Projekt, ziel: Projekt['ziele'][number], datum: string): string[] {
  const aus = new Set<string>();
  for (const m of ziel.messmethode.matchAll(AB_JAHR)) {
    if (datum.slice(0, 4) >= m[1]!) continue;
    for (const s of p.kiSysteme) if (nenntSystem(m[2]!, s)) aus.add(s.id);
  }
  return [...aus];
}

/**
 * F42 (A3-03): PR-12 zählt mehr Systeme als gemessen, weil die Stichprobe eines Ziels ein System zum Messdatum noch nicht
 * umfasst (Klausel «ab 2027») oder kein Ziel das System führt. Massgebend sind die Ziel-Messungen der letzten 3 Monate.
 */
export function stichprobeDecktNichtAlle(p: Projekt): StatusBefund[] {
  const b: StatusBefund[] = [];
  const betrieb = p.kiSysteme.filter(imBetrieb);
  for (const km of (p.kennzahlMessungen ?? []).filter((x) => x.kennzahl === 'PR-12' && !x.keineMessung)) {
    const z = km.zaehler ?? quoteVon(km.wert)?.z;
    if (z === undefined) continue;
    const von = plusMonate(km.datum, -3);
    const gedeckt = betrieb.filter((s) =>
      // Ziel ohne Systemliste (leer = alle) deckt nur die Systeme, die seine Messmethode nennt: Eine Umfrage zur
      // Schatten-KI ist keine Stichprobe der Ergebnisse eines Systems
      p.ziele.some((ziel) => (ziel.kiSysteme?.length ? ziel.kiSysteme.includes(s.id) : nenntSystem(ziel.messmethode, s)) && ziel.messungen.some((m) => m.datum <= km.datum && m.datum >= von && !nochNichtInStichprobe(p, ziel, m.datum).includes(s.id))),
    );
    if (z > gedeckt.length) b.push({ id: km.kennzahl, details: betrieb.filter((s) => !gedeckt.includes(s)).map((s) => s.id), verbindlich: true });
  }
  return b;
}

/**
 * Datenquelle je Prozesskennzahl: welche Angaben die Aufzeichnungen zum Messdatum liefern müssen (K-AUD-11). Leere
 * Liste: messbar. PR-19 misst Stunden bis zur Eindämmung: jeder Vorfall und Beinahe-Vorfall bis zum Messdatum braucht
 * Entdeckung und Eindämmung mit Uhrzeit (D-22 «Entdeckt», «Eingedämmt», ab Schemaversion 3, AF-104). PR-07 misst Tage
 * vom Antrag bis zum Entscheid: mindestens ein System mit Antrag und Entscheid bis zum Messdatum (D-10 Freigabeliste
 * «Antrag am», «Entscheid am», ab Schemaversion 3). Erfassung im Inventar und Freigabe zählen nicht als Antrag und Entscheid.
 */
const KENNZAHL_QUELLE: Record<string, (p: Projekt, datum: string) => string[]> = {
  'PR-19': (p, datum) => {
    const faelle = p.feststellungen.filter((f) => (f.quelle === 'vorfall' || f.quelle === 'beinahe-vorfall') && (f.entdecktAm ?? f.datum ?? '').slice(0, 10) <= datum);
    const mitZeit = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
    const fehlt: string[] = [];
    if (!faelle.length || !faelle.every((f) => mitZeit(f.entdecktAm))) fehlt.push('entdeckung');
    if (!faelle.length || !faelle.every((f) => mitZeit(f.eingedaemmtAm))) fehlt.push('eindaemmung');
    return fehlt;
  },
  'PR-07': (p, datum) => (p.kiSysteme.some((s) => s.antragAm && s.entscheidAm && s.antragAm <= s.entscheidAm && s.entscheidAm <= datum) ? [] : ['antrag-entscheid']),
};

/** F43 (A3-15): Prozesskennzahl mit Messwert, deren Datenquelle die Aufzeichnungen nicht hergeben */
export function kennzahlOhneDatenquelle(p: Projekt): StatusBefund[] {
  const b = new Map<string, StatusBefund>();
  for (const km of (p.kennzahlMessungen ?? []).filter((x) => !x.keineMessung && KENNZAHL_QUELLE[x.kennzahl])) {
    const fehlt = KENNZAHL_QUELLE[km.kennzahl]!(p, km.datum);
    if (!fehlt.length) continue;
    const alt = b.get(km.kennzahl);
    const verbindlich = !!km.sollErreicht || !!alt?.verbindlich;
    b.set(km.kennzahl, { id: km.kennzahl, details: [...new Set([...(alt?.details ?? []), ...fehlt])], verbindlich, ...(KENNZAHL_ORT[km.kennzahl] ? { ort: KENNZAHL_ORT[km.kennzahl]!(p) } : {}) });
  }
  return [...b.values()];
}

const mitUhrzeit = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
/**
 * Ort der fehlenden Datenquelle für den Sprung aus der Prüfung (P14): PR-07 ins Inventar, zum ersten entschiedenen
 * System ohne Antrag oder Entscheid (sonst zum ersten aktiven System); PR-19 in die Vorfälle, zum ersten Vorfall oder
 * Beinahe-Vorfall ohne Entdeckung oder Eindämmung mit Uhrzeit. Ohne passenden Eintrag nur der Bereich.
 */
const KENNZAHL_ORT: Record<string, (p: Projekt) => NonNullable<StatusBefund['ort']>> = {
  'PR-07': (p) => {
    const entschieden = p.kiSysteme.filter((s) => ['freigegeben', 'eingeschraenkt', 'ausgesetzt', 'untersagt'].includes(s.status));
    const s = entschieden.find((x) => !x.antragAm || !x.entscheidAm) ?? (entschieden.length ? undefined : p.kiSysteme.find((x) => x.status !== 'abgeloest'));
    return s ? { bereich: 'inventar', eintrag: s.id, feld: s.antragAm ? 'entscheidAm' : 'antragAm' } : { bereich: 'inventar' };
  },
  'PR-19': (p) => {
    const f = p.feststellungen.find((x) => (x.quelle === 'vorfall' || x.quelle === 'beinahe-vorfall') && (!mitUhrzeit(x.entdecktAm) || !mitUhrzeit(x.eingedaemmtAm)));
    return f ? { bereich: 'feststellungen', eintrag: f.id, feld: mitUhrzeit(f.entdecktAm) ? 'eingedaemmtAm' : 'entdecktAm' } : { bereich: 'feststellungen' };
  },
};

// ------------------------------------------------------------------------------------------------- Folgenabschätzung
// A3-02b (AF-095, QK-52): Folgenabschätzung tragfähig. Fehler, sobald die Abschätzung freigegeben ist, vorher Hinweis (W2).

type Abschaetzung = Projekt['folgenabschaetzungen'][number];

/**
 * Kleinste Stufe der Auswirkungsskala aus D-06, die als hoch gilt (D-08 «Eingeschränkte Nutzung»): ab vier Stufen die
 * zwei obersten, sonst die oberste; ohne eigene Skala die vier Stufen des Vorschlags (wie die Vorlagen D-06, D-08).
 */
export function hohesAusmassAb(p: Projekt): number {
  const stufen = (p.organisation.risikokriterien?.auswirkung ?? []).map((x) => x.stufe).filter((x) => Number.isFinite(x));
  const max = stufen.length ? Math.max(...stufen) : 4;
  return max >= 4 ? max - 1 : max;
}

/** Jüngste Abschätzung je KI-System (Freigabe, sonst Kurzprüfung; bei gleichem Datum die spätere in der Liste) */
export function juengsteAbschaetzung(p: Projekt): Map<string, Abschaetzung> {
  const je = new Map<string, Abschaetzung>();
  const datum = (f: Abschaetzung) => f.freigabe?.am ?? f.triage?.am ?? '';
  for (const f of p.folgenabschaetzungen) {
    const alt = je.get(f.kiSystem);
    if (!alt || datum(f) >= datum(alt)) je.set(f.kiSystem, f);
  }
  return je;
}

/** Zelle zum Vergleich: klein, Leerzeichen zusammengefasst, ohne Schlusszeichen */
const zelle = (t: unknown) => (typeof t === 'string' ? t.toLowerCase().replace(/[\s ]+/g, ' ').replace(/[.;:!]+$/u, '').trim() : '');
/**
 * Aussage mit Inhalt: mindestens drei Wörter. Leere Zellen, Striche und knappe Antworten wie «Keiner» oder «Nicht
 * wesentlich» zählen nicht als Wiederholung; Füllsätze wie «Kein besonderer Schaden erkennbar» schon (A3-02a).
 */
const hatInhalt = (t: string) => (t.match(/\p{L}+/gu) ?? []).length >= 3;

/**
 * F44 (A3-02a): wortgleiche Zellen über die Ziele von Nutzen und Schaden (D-09 B.6). Gezählt werden Zellen, die eine
 * frühere Zelle derselben Abschätzung wiederholen (Gross- und Kleinschreibung, Leerzeichen und Schlusspunkt gleichgesetzt);
 * höchstens eine Wiederholung je Abschätzung ist zulässig. details: die Ziele mit wiederholter Zelle.
 */
export function folgenWortgleich(p: Projekt): StatusBefund[] {
  const b: StatusBefund[] = [];
  for (const f of p.folgenabschaetzungen) {
    const gesehen = new Set<string>();
    const ziele = new Set<string>();
    let wiederholungen = 0;
    for (const [ziel, x] of Object.entries(f.nutzenSchaden ?? {})) {
      for (const t of [zelle(x?.nutzen), zelle(x?.schaden)].filter(hatInhalt)) {
        if (gesehen.has(t)) {
          wiederholungen++;
          ziele.add(ziel);
        } else gesehen.add(t);
      }
    }
    if (wiederholungen > 1) b.push({ id: f.id, details: [...ziele], verbindlich: !!f.freigabe });
  }
  return b;
}

/**
 * F45 (A3-02b): Ausmass eines Ziels anders als die Auswirkung des Risikos, das die Zelle nennt (R-xxx im Register D-07).
 * Beide bewerten den Schaden vor Massnahmen: verglichen wird mit A vor der Behandlung (Entscheid P14 S1, vorsichtige Lesart
 * der Schwelle aus D-08; F46 rechnet mit demselben Ausmass). details: «Ziel: R-xxx».
 */
export function ausmassGegenRegister(p: Projekt): StatusBefund[] {
  const b: StatusBefund[] = [];
  for (const f of p.folgenabschaetzungen) {
    const abw: string[] = [];
    for (const [ziel, x] of Object.entries(f.nutzenSchaden ?? {})) {
      if (typeof x?.ausmass !== 'number') continue;
      const ids = new Set(`${x.nutzen ?? ''} ${x.schaden ?? ''}`.match(/\bR-\d{3,}\b/g) ?? []);
      for (const id of ids) {
        const r = p.risiken.find((y) => y.id === id);
        if (r && typeof r.a === 'number' && r.a !== x.ausmass) abw.push(`${ziel}: ${id}`);
      }
    }
    if (abw.length) b.push({ id: f.id, details: abw, verbindlich: !!f.freigabe });
  }
  return b;
}

/**
 * F46 (A3-02c): Entscheid der jüngsten Abschätzung je System folgt nicht der Schwelle aus D-08.
 * - «sensibel»: Frage 1 oder 2 der Kurzprüfung mit «ja» oder mindestens zwei der Fragen 3 bis 6 (D-08 «Sensible Nutzung,
 *   vollständige Abschätzung nötig»), aber Ergebnis Kurzprüfung oder keine sensible Nutzung. Den Grenzfall mit genau
 *   einer der Fragen 3 bis 6 entscheidet die AIMS-Verantwortung; er ist kein Befund.
 * - «eingeschraenkt»: ein Ausmass vor Massnahmen ab der hohen Stufe der Auswirkungsskala, aber keine eingeschränkte Nutzung; ein
 *   untersagtes, ausgesetztes oder abgelöstes System erfüllt «gar nicht erlaubt».
 * - «auflagen»: ein Ausmass ab der hohen Stufe, das System ist aber ohne Auflagen freigegeben (D-10 Freigabeliste).
 */
const NICHT_ERLAUBT = new Set(['untersagt', 'ausgesetzt', 'abgeloest']);
export function entscheidGegenSchwelle(p: Projekt): StatusBefund[] {
  const hoch = hohesAusmassAb(p);
  const b: StatusBefund[] = [];
  for (const f of juengsteAbschaetzung(p).values()) {
    const t: Partial<Abschaetzung['triage']> = f.triage ?? {};
    const weitere = [t.verletzlicheGruppen, t.besondereDaten, t.automatisierteEntscheidung, t.grosseReichweite].filter((x) => x === true).length;
    const schwelle = t.rechtspositionOderChancen === true || t.gesundheitOderSicherheit === true || weitere >= 2;
    const ausmass = Math.max(0, ...Object.values(f.nutzenSchaden ?? {}).map((x) => (typeof x?.ausmass === 'number' ? x.ausmass : 0)));
    const s = p.kiSysteme.find((x) => x.id === f.kiSystem);
    const details = [
      ...(schwelle && (t.ergebnis === 'kurz' || f.sensibleNutzung !== true) ? ['sensibel'] : []),
      ...(ausmass >= hoch && f.eingeschraenkteNutzung !== true && !NICHT_ERLAUBT.has(s?.status ?? '') ? ['eingeschraenkt'] : []),
      ...(ausmass >= hoch && s?.status === 'freigegeben' && !s.auflagen?.trim() ? ['auflagen'] : []),
    ];
    if (details.length) b.push({ id: f.id, details, verbindlich: !!f.freigabe });
  }
  return b;
}

/** F47 (A3-02d): Inventar «sensible Nutzung» (D-10) weicht von der jüngsten Abschätzung des Systems ab (aktive Systeme) */
export function inventarSensibel(p: Projekt): StatusBefund[] {
  const b: StatusBefund[] = [];
  for (const [id, f] of juengsteAbschaetzung(p)) {
    const s = p.kiSysteme.find((x) => x.id === id);
    if (!s || s.status === 'abgeloest' || s.status === 'untersagt') continue;
    if (s.sensibleNutzung !== f.sensibleNutzung) b.push({ id: s.id, details: [f.id], verbindlich: !!f.freigabe });
  }
  return b;
}

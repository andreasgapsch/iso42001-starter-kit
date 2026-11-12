// Querbezüge zwischen Regel und Ablauf (AF-073, QK-43; Muster «Regel und Ablauf gehen auseinander»):
// je Paar D-14/PR-19, D-08/D-06-EB, D-12/PR-13, D-26/D-05/D-21, D-04/D-27 und zusätzlich D-08/PR-09
// (Freigabestellen) für die leeren Vorlagen beider Pfade und beide Beispiele, DE und EN. Die Werte kommen aus der
// Faktenquelle src/kataloge/fakten.yaml (AF-072); der Test vergleicht die erzeugten Dokumente, nicht die YAML-Texte.
//
// Bekannte Abweichungen, die ein späteres Paket behebt, stehen einzeln in OFFEN (Datei, Paar, Abweichung, Paket). Der Test
// verlangt, dass die gefundenen Abweichungen genau dieser Liste entsprechen: eine neue Abweichung und eine behobene, die
// noch in der Liste steht, schlagen beide fehl.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Block, DocxDokument, Text } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer, type Uebersetzer } from '../../src/i18n/texte.ts';
import { faktWert, type FaktenDatei } from '../../src/kataloge/fakten.ts';
import { ladeFakten } from '../../src/kataloge/fakten-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { ablaufVon, eintragVon, rollenText } from '../../src/prozesse/katalog.ts';
import { RANG_VORSCHLAG } from '../../src/regeln/pruefungen.ts';
import { d27Prozesse } from '../../src/vorlagen/D-27.ts';
import { EIGENE_EB_FORM, VORLAGEN, ZUSATZDATEIEN } from '../../src/vorlagen/index.ts';
import { erstelleHelfer, type VorlagenKontext } from '../../src/vorlagen/kontext.ts';

const kataloge = ladeKataloge();
const FAKTEN = ladeFakten();
const SPRACHEN: Sprache[] = ['de', 'en'];
const texteJe = { de: ladeTexte('de'), en: ladeTexte('en') };

interface Quelle {
  name: string;
  projekt: (s: Sprache) => Projekt;
  leer: boolean;
}
const QUELLEN: Quelle[] = [
  { name: 'leer ohne ISMS', leer: true, projekt: (s) => leeresProjekt({ sprache: s, mitIsms: false, jetzt: '2027-01-01T00:00:00.000Z', projektId: 'leer-ohne' }) },
  { name: 'leer mit ISMS', leer: true, projekt: (s) => leeresProjekt({ sprache: s, mitIsms: true, jetzt: '2027-01-01T00:00:00.000Z', projektId: 'leer-mit' }) },
  { name: 'muster-maschinenbau', leer: false, projekt: (s) => JSON.parse(readFileSync(`src/beispiele/muster-maschinenbau.${s}.aims.json`, 'utf8')) as Projekt },
  { name: 'praezisionsteile', leer: false, projekt: (s) => JSON.parse(readFileSync(`src/beispiele/praezisionsteile.${s}.aims.json`, 'utf8')) as Projekt },
];

/** Bekannte Abweichungen mit dem Paket, das sie behebt (nach Behebung hier streichen) */
// P15a (AF-082): Rollen «Personal» und «Kommunikation» im Beispiel P besetzt, Eintrag gestrichen; die Liste ist leer
const OFFEN: { quelle: string; paar: string; abweichung: RegExp; paket: string }[] = [];

const v = (id: string, s: Sprache, f: FaktenDatei = FAKTEN) => faktWert(f, id, s);
/** Pfad-IDs vereinheitlichen: im Pfad mit ISMS stehen Ergänzungsblätter (D-22-EB) statt der Hauptdokumente */
const ohneEb = (t: string) => t.replace(/\b(D-\d{2})-EB\b/g, '$1');
const klein = (t: string) => ohneEb(t).toLowerCase();

function textVon(t: Text | undefined): string {
  if (t === undefined) return '';
  return typeof t === 'string' ? t.replace(/\[\[(.*?)\]\]/g, '$1') : t.map((l) => l.text).join('');
}
/** Alle Texte eines Dokuments, Platzhaltertexte eingeschlossen (ohne Markierung [[…]]) */
function alleTexte(w: unknown, aus: string[] = []): string[] {
  if (typeof w === 'string') aus.push(w.replace(/\[\[(.*?)\]\]/g, '$1'));
  else if (Array.isArray(w)) {
    if (w.length && w.every((x) => x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string' && !('typ' in x))) aus.push(textVon(w as Text));
    else w.forEach((x) => alleTexte(x, aus));
  } else if (w && typeof w === 'object') Object.values(w).forEach((x) => alleTexte(x, aus));
  return aus;
}

function kontext(p: Projekt, leer: boolean, id: string, extra: Partial<VorlagenKontext> = {}): VorlagenKontext {
  const s = p.meta.dokumentSprache;
  const eb = p.meta.mitIsms && EIGENE_EB_FORM.has(id);
  return { u: erstelleUebersetzer(s, texteJe[s]), modus: leer ? 'leer' : 'firma', form: eb ? 'ergaenzungsblatt' : 'dokument', projekt: p, kataloge, kitVersion: '1.0.0', ...extra };
}
const dok = (p: Projekt, leer: boolean, id: string, extra: Partial<VorlagenKontext> = {}) => VORLAGEN[id]!(kontext(p, leer, id, extra)) as DocxDokument;
const tabelle = (d: DocxDokument, kopf: string[]) =>
  d.bloecke.filter((b): b is Extract<Block, { typ: 'tabelle' }> => b.typ === 'tabelle').find((b) => JSON.stringify(b.kopf.map(textVon)) === JSON.stringify(kopf));

/** Texte eines Prozesskapitels in D-27 ohne Kennzahl, Eingaben, Ausgaben und Schnittstellen: Hinweis, Auslöser, Ablauf, Notiz */
function prozessKapitel(p: Projekt, leer: boolean, prozessId: string, u: Uebersetzer): string[] {
  const d = dok(p, leer, 'D-27', { prozessId });
  const titel = (x: string) => u.t(`vorlagen.D-27.abschnitte.${x}`);
  const ohne = ['eingaben', 'ausgaben', 'kennzahl', 'schnittstellen', 'massnahmen'].map(titel);
  const notiz = leer ? undefined : eintragVon(p, prozessId)?.notiz?.trim();
  const aus: string[] = [];
  let mitnehmen = true;
  for (const b of d.bloecke) {
    if (b.typ === 'ueberschrift' && b.ebene === 2) mitnehmen = !ohne.some((t) => textVon(b.text).endsWith(` ${t}`));
    if (b.typ === 'absatz' && notiz && textVon(b.text) === notiz) aus.push(notiz);
    else if (mitnehmen && b.typ !== 'felder') alleTexte(b, aus);
  }
  return aus;
}

/** Fristausdrücke in einem Text (Zahl mit Einheit, «sofort», «am Tag der Meldung», Rhythmus) */
const FRIST: Record<Sprache, RegExp> = {
  de: /\b\d+\s+(?:Stunden?|Arbeitstag(?:en?)?|Tag(?:en?)?)\b|\bsofort\b|\bam Tag der Meldung\b|\b(?:wöchentlich|monatlich|quartalsweise|halbjährlich|jährlich)\b|\bje(?:der)? ISMS-Runde\b/g,
  en: /\b\d+\s+(?:hours?|working days?|days?)\b|\bimmediately\b|\bon the day of the report\b|\b(?:weekly|monthly|quarterly|half-yearly|annually|yearly)\b|\b(?:in )?each ISMS round\b/g,
};
const fristen = (t: string, s: Sprache) => [...t.matchAll(FRIST[s])].map((m) => m[0]);
const VORFALL = Object.keys(FAKTEN.fakten).filter((id) => FAKTEN.fakten[id]!.querbezug === 'D-14/PR-19');

// ---------------------------------------------------------------- Prüfungen je Paar (Ergebnis: Liste der Abweichungen)

/** D-14 gegen PR-19: Schweregrade, Kommunikation und Ablauf mit denselben Fristen aus der Faktenquelle */
export function d14Pr19(p: Projekt, leer: boolean, f: FaktenDatei = FAKTEN): string[] {
  const s = p.meta.dokumentSprache;
  const u = erstelleUebersetzer(s, texteJe[s]);
  const abw: string[] = [];
  const d14 = dok(p, leer, 'D-14');
  const werte = new Set(VORFALL.map((id) => v(id, s, f)));
  const innert = s === 'de' ? 'innert' : 'within';
  // Schweregrade: Stufe 1 Erfassung, Stufe 2 AIMS, Stufe 3 Geschäftsleitung, Stufe 4 sofort
  const schwere = tabelle(d14, u.liste('vorlagen.D-14.schwere_kopf'));
  if (!schwere) abw.push('D-14 ohne Tabelle der Schweregrade');
  else {
    const erwartet = [v('vorfall.erfassung', s, f), `${innert} ${v('vorfall.stufe2', s, f)}`, `${innert} ${v('vorfall.stufe3', s, f)}`, v('vorfall.stufe4', s, f)];
    erwartet.forEach((e, i) => {
      const zelle = textVon(schwere.zeilen[i]?.[2]);
      if (!zelle.includes(e)) abw.push(`D-14 Stufe ${i + 1}: «${zelle}» ohne «${e}»`);
    });
  }
  // Kommunikation: jede Frist (ausser der Kundenfrist aus dem Projekt und der gesetzlichen) ist ein Wert der Faktenquelle
  const kom = tabelle(d14, u.liste('vorlagen.D-14.kommunikation_kopf'));
  if (!kom) abw.push('D-14 ohne Tabelle der Kommunikation');
  else {
    const kunden = u.t('vorlagen.D-14.frist_kunden_offen');
    for (const z of kom.zeilen) {
      const zelle = textVon(z[2]);
      if (zelle.startsWith(kunden)) continue;
      for (const x of fristen(zelle, s)) if (!werte.has(x)) abw.push(`D-14 Kommunikation: Frist «${x}» nicht aus der Faktenquelle (${textVon(z[1])})`);
    }
    const alle = kom.zeilen.map((z) => textVon(z[2])).join(' | ');
    if (!alle.includes(`${innert} ${v('vorfall.stufe2', s, f)}`)) abw.push(`D-14 Kommunikation ohne Information der AIMS-Verantwortlichen innert ${v('vorfall.stufe2', s, f)}`);
    if (d14.bloecke.length && !p.meta.mitIsms && !alle.includes(`${innert} ${v('vorfall.stufe3', s, f)}`)) abw.push(`D-14 Kommunikation ohne Information der Geschäftsleitung innert ${v('vorfall.stufe3', s, f)}`);
  }
  const text14 = alleTexte(d14).join('\n');
  if (!new RegExp(`D-22[^\\n]*${v('vorfall.abgleich', s, f)}|${v('vorfall.abgleich', s, f)}[^\\n]*D-22`).test(ohneEb(text14))) abw.push(`D-14 ohne Abgleich der Meldungen mit dem Register (${v('vorfall.abgleich', s, f)})`);
  // PR-19 im Prozesshandbuch D-27: Auslöser, Ablauf, Hinweis und Notiz mit denselben Fristen
  const t19 = prozessKapitel(p, leer, 'PR-19', u).join('\n');
  for (const x of fristen(t19, s)) if (!werte.has(x)) abw.push(`PR-19: Frist «${x}» nicht aus der Faktenquelle`);
  if (!t19.toLowerCase().includes(v('vorfall.erfassung', s, f).toLowerCase())) abw.push(`PR-19 ohne Erfassung «${v('vorfall.erfassung', s, f)}»`);
  if (!t19.includes(v('vorfall.abgleich', s, f))) abw.push(`PR-19 ohne Abgleich «${v('vorfall.abgleich', s, f)}»`);
  // Stufen, die der Ablauf nennt, mit der Frist der Faktenquelle
  const wort = s === 'de' ? '(?:Schwere|Stufe)' : '(?:severity|level)';
  for (const n of [2, 3, 4]) {
    for (const m of t19.matchAll(new RegExp(`${wort} ${n}\\b[^,.;]*`, 'gi'))) {
      const genannt = fristen(m[0], s);
      if (genannt.length && !genannt.includes(v(`vorfall.stufe${n}`, s, f))) abw.push(`PR-19 Stufe ${n}: «${m[0]}» statt ${v(`vorfall.stufe${n}`, s, f)}`);
    }
  }
  if (leer && !/(?:Schwere|severity) 3/i.test(t19)) abw.push('PR-19 (leere Vorlage) ohne Eskalation nach Schwere');
  return abw;
}

/** D-08 gegen D-06 (Pfad mit ISMS: D-06-EB): dieselbe Schwelle für die vollständige Folgenabschätzung */
export function d08D06(p: Projekt, leer: boolean): string[] {
  const s = p.meta.dokumentSprache;
  const abw: string[] = [];
  const hoch = erstelleHelfer(kontext(p, leer, 'D-06')).skala('auswirkung').hoch;
  const schwelle = v('folgen.schwelle', s).replace('{hoch}', hoch);
  const d06 = klein(alleTexte(dok(p, leer, 'D-06')).join('\n'));
  const d08 = alleTexte(dok(p, leer, 'D-08')).join('\n');
  const id06 = p.meta.mitIsms ? 'D-06-EB' : 'D-06';
  if (!d06.includes(schwelle.toLowerCase())) abw.push(`${id06} ohne Schwelle «${schwelle}»`);
  const satz = d08.split('\n').find((t) => t.toLowerCase().includes(schwelle.toLowerCase()));
  if (!satz) abw.push(`D-08 ohne Schwelle «${schwelle}»`);
  // Die leere Vorlage gilt für beide Pfade und verweist auf D-06; im Firmendokument lenkt der Pfad auf D-06-EB
  else if (!new RegExp(leer ? '\\bD-06\\b' : `\\b${id06}\\b(?!-)`).test(satz)) abw.push(`D-08 nennt die Schwelle ohne Verweis auf ${id06}: «${satz}»`);
  return abw;
}

/** D-08 gegen PR-09: Freigabestellen der Kurzprüfung und der vollständigen Abschätzung */
export function d08Pr09(p: Projekt, leer: boolean): string[] {
  const s = p.meta.dokumentSprache;
  const u = erstelleUebersetzer(s, texteJe[s]);
  const abw: string[] = [];
  const d08 = alleTexte(dok(p, leer, 'D-08')).join('\n');
  const t09 = prozessKapitel(p, leer, 'PR-09', u).join('\n');
  const gl = v('freigabe.abschaetzung', s);
  if (!new RegExp(gl, 'i').test(d08)) abw.push(`D-08 ohne Freigabe durch ${gl}`);
  if (!new RegExp(gl, 'i').test(t09)) abw.push(`PR-09 ohne Freigabe durch ${gl}`);
  if (!new RegExp(v('freigabe.kurzpruefung', s), 'i').test(d08)) abw.push(`D-08 ohne Freigabe der Kurzprüfung durch ${v('freigabe.kurzpruefung', s)}`);
  return abw;
}

/** D-12 gegen PR-13: Nachtraining führt immer zur Neubeurteilung, Freigabe durch die Stelle aus D-12 */
export function d12Pr13(p: Projekt, leer: boolean): string[] {
  const s = p.meta.dokumentSprache;
  const u = erstelleUebersetzer(s, texteJe[s]);
  const abw: string[] = [];
  const d12 = alleTexte(dok(p, leer, 'D-12')).join('\n');
  const t13 = prozessKapitel(p, leer, 'PR-13', u).join('\n');
  const nachtraining = s === 'de' ? /Nachtrain/i : /retrain/i;
  const neu = s === 'de' ? /Risiken[^.\n]{0,40}neu beurteil|neu beurteil[^.\n]{0,40}Risiken|Risiken neu/i : /reassess[^.\n]{0,20}risks|risks[^.\n]{0,40}reassess/i;
  if (!nachtraining.test(d12)) abw.push('D-12 ohne Regel zum Nachtraining');
  if (!nachtraining.test(t13)) abw.push('PR-13 ohne Nachtraining als Auslöser');
  if (!neu.test(t13)) abw.push('PR-13 ohne Neubeurteilung der Risiken');
  // Freigabe der Änderung: im Ablauf mit Verweis auf D-12
  if (!/\bD-12\b[^\n]*(?:frei|approv)|(?:frei|approv)[^\n]*\bD-12\b/i.test(t13)) abw.push('PR-13: Freigabe der Änderung ohne Verweis auf die Stelle in D-12');
  return abw;
}

/** Wörter, mit denen D-12 eine Rolle als Freigabestelle nennt (Rolle aus dem Ablauf PR-13 gegen den Text in D-12) */
const STELLE_WORTE: Record<Sprache, Record<string, RegExp>> = {
  de: { 'ki-eigner': /verantwortliche Person|Eigner/i, aims: /AIMS-Verantwortung/i, gl: /Geschäftsleitung/i, it: /\bIT\b/, risikomanagement: /Risikomanagement/i },
  en: { 'ki-eigner': /\bowner\b|responsible person/i, aims: /AIMS lead/i, gl: /top management|executive board/i, it: /\bIT\b/, risikomanagement: /risk management/i },
};

/** Rolle je Schritt: A (verantwortlich) und R (durchführend) aus dem RACI des Katalogs */
type SchrittRaci = Record<string, string>;
/**
 * D-12 gegen PR-13, Freigabestellen (N6, nach N7 je Stufe): D-12 nennt die Stellen je Risikostufe. Bei tiefem und mittlerem
 * Risiko gibt die AIMS-Verantwortung frei (mittel mit der verantwortlichen Person), bei hohem Risiko oder voller
 * Folgenabschätzung die Geschäftsleitung. Jede Stelle der Stufen tief und mittel muss in PR-13.05 als A oder R stehen (nennt
 * ein Firmendokument dort die Geschäftsleitung, in PR-13.08), die Stellen der Stufe hoch in PR-13.08; und jede Rolle mit A in
 * diesen Schritten muss in D-12 als Stelle ihrer Stufe stehen. `ueberschreibe` ersetzt das RACI eines Schritts für die Gegenprobe.
 */
export function d12Pr13Freigabestelle(p: Projekt, leer: boolean, ueberschreibe: Partial<Record<'PR-13.05' | 'PR-13.08', SchrittRaci>> = {}): string[] {
  const s = p.meta.dokumentSprache;
  const abw: string[] = [];
  const schritte = kataloge.prozesse_katalog?.prozesse.find((x) => x.id === 'PR-13')?.schritte ?? [];
  const raci = (id: 'PR-13.05' | 'PR-13.08'): SchrittRaci => ueberschreibe[id] ?? ((schritte.find((x) => x.id === id)?.raci ?? {}) as SchrittRaci);
  const saetze = alleTexte(dok(p, leer, 'D-12')).join('\n').split(/(?<=[.!?])\s+/);
  const anfang = s === 'de' ? /Bei tiefem Risiko gibt|Über die Einführung entscheidet/ : /For low risk the|Deployment is decided/;
  const fund = saetze.find((t) => anfang.test(t));
  if (!fund) return ['D-12 ohne Satz zur Freigabe der Einführung'];
  const satz = fund.slice(fund.search(anfang));
  const [, tief = '', mittel = '', hoch = ''] = /^(.*?)(?:bei|for) (?:mittlerem|medium) (?:Risiko|risk)(.*?)(?:bei|for) (?:hohem|high) (?:Risiko|risk)(.*)$/i.exec(satz) ?? [];
  if (!tief || !hoch) return [`D-12: Satz ohne Stufen tief, mittel und hoch («${satz}»)`];
  const stellen = (t: string) => Object.entries(STELLE_WORTE[s]).filter(([r, w]) => ['aims', 'ki-eigner', 'gl'].includes(r) && w.test(t)).map(([r]) => r);
  const rM = stellen(mittel);
  const stufen: ['PR-13.05' | 'PR-13.08', string[]][] = [
    ['PR-13.05', [...new Set([...stellen(tief), ...rM.filter((r) => r !== 'gl')])]],
    ['PR-13.08', [...new Set([...stellen(hoch), ...rM.filter((r) => r === 'gl')])]],
  ];
  for (const [id, rollen] of stufen) {
    const r = raci(id);
    if (!rollen.length) abw.push(`D-12 nennt für ${id} keine Stelle`);
    for (const rolle of rollen) if (!/[AR]/.test(r[rolle] ?? '')) abw.push(`D-12 nennt die Stelle «${rolle}» für ${id}, im Ablauf hat sie dort weder A noch R`);
    for (const [rolle, w] of Object.entries(r)) if (w.includes('A') && !rollen.includes(rolle)) abw.push(`${id}: «${rolle}» gibt frei (A), D-12 nennt sie nicht als Stelle der Stufe`);
  }
  return abw;
}

/** D-26, D-05 (Kennzahlen PR-05, PR-26) und D-21: ein Register für geplante Änderungen und Massnahmen */
export function d26D05D21(p: Projekt, leer: boolean): string[] {
  const s = p.meta.dokumentSprache;
  const abw: string[] = [];
  const reg = v('register.massnahmen', s).toLowerCase();
  for (const id of ['D-26', 'D-21']) if (!klein(alleTexte(dok(p, leer, id)).join('\n')).includes(reg)) abw.push(`${id} ohne ${v('register.massnahmen', s)}`);
  const u = erstelleUebersetzer(s, texteJe[s]);
  const d05 = VORLAGEN['D-05']!(kontext(p, leer, 'D-05')) as unknown as { blaetter: { name: Text; zeilen: unknown[][] }[] };
  const plan = d05.blaetter.find((b) => textVon(b.name) === u.t('vorlagen.D-05.blaetter.messplan'));
  for (const pr of ['PR-05', 'PR-26']) {
    const zeile = plan?.zeilen.find((z) => z[0] === pr);
    if (!zeile) {
      abw.push(`D-05 ohne Messplanzeile ${pr}`);
      continue;
    }
    const methode = klein(String(zeile[2] ?? ''));
    if (!methode.includes(reg)) abw.push(`D-05 ${pr}: Methode «${zeile[2]}» misst nicht im ${v('register.massnahmen', s)}`);
    if (/\bd-07\b/.test(methode)) abw.push(`D-05 ${pr}: Methode nennt D-07 als Register`);
  }
  return abw;
}

/** D-04 gegen D-27: jede Rolle einer Prozessbahn hat in D-04 eine Zeile oder eine benannte Person */
export function d04D27(p: Projekt, leer: boolean): string[] {
  const s = p.meta.dokumentSprache;
  const u = erstelleUebersetzer(s, texteJe[s]);
  const abw: string[] = [];
  const d04 = alleTexte(dok(p, leer, 'D-04'));
  if (leer) {
    const ctx = kontext(p, true, 'D-27');
    const rollen = new Set(d27Prozesse(ctx).flatMap((kp) => { const a = ablaufVon(u, kp, undefined); return a.schritte.map((x) => x.bahn); }));
    const zeilen = new Set([...(u.roh('vorlagen.D-04.bereiche') as { id: string }[]).map((b) => b.id), ...Object.keys(u.roh('vorlagen.D-04.pflichtrollen') as object)]);
    const text = d04.join('\n');
    const fehlt = [...rollen].filter((r) => r !== 'gl' && r !== 'mitarbeitende' && !zeilen.has(r) && !text.includes(rollenText(u, r))).sort();
    if (fehlt.length) abw.push(`Bahnrollen ohne Zeile in D-04: ${fehlt.join(', ')}`);
  } else {
    const offen = u.t('vorlagen.D-04.prozessrollen_offen');
    for (const t of d04) if (t.endsWith(`: ${offen}`)) abw.push(`Bahnrolle in D-04 nicht zugewiesen: ${t}`);
  }
  return abw;
}

/** Sätze eines Dokuments (Texte an Satzende und Zeilenumbruch getrennt) */
const saetze = (t: string[]) => t.join('\n').split(/(?<=[.!?])\s+|\n/);
/** Ein Satz nennt das Thema und die Stelle (Gross- und Kleinschreibung egal) */
const satzMit = (t: string[], thema: RegExp, stelle: string) => saetze(t).some((x) => thema.test(x) && x.toLowerCase().includes(stelle.toLowerCase()));
const THEMA: Record<'plan' | 'soa' | 'rest' | 'einf', Record<Sprache, RegExp>> = {
  plan: { de: /Behandlungsplan/i, en: /treatment plan/i },
  soa: { de: /Erklärung zur Anwendbarkeit/i, en: /statement of applicability|\bSoA\b/i },
  rest: { de: /Restrisik/i, en: /residual risk/i },
  einf: { de: /Einführung|Freigabe/i, en: /deployment|approv/i },
};

/**
 * Freigabestellen der leeren Vorlagen (Runde 4, M4-28 bis M4-30, M4-32, M4-33): Einführung und Restrisiko (D-03, D-04
 * Anlage A, D-06 bzw. D-06-EB, D-12, D-15, PR-07, PR-08), Behandlungsplan (D-06, D-26, PR-08) und Erklärung zur
 * Anwendbarkeit (D-11, D-26, PR-10) nennen dieselbe Stelle wie die Faktenquelle; D-15 legt die Freigabekriterien fest, die
 * PR-07 auch ohne vertiefte Prüfung durchläuft. Firmendokumente lesen die Stellen aus dem Projekt (Entscheidungsrechte,
 * Freigaberegel), dort prüft die Funktion nichts.
 */
export function freigabestellen(p: Projekt, leer: boolean): string[] {
  if (!leer) return [];
  const s = p.meta.dokumentSprache;
  const u = erstelleUebersetzer(s, texteJe[s]);
  const abw: string[] = [];
  const hat = (zelle: string | undefined, id: string) => (zelle ?? '').toLowerCase().includes(v(id, s).toLowerCase());
  // D-04 Anlage A: Vorschlag der Entscheidungsrechte
  const rechte = tabelle(dok(p, true, 'D-04'), u.liste('vorlagen.D-04.entscheidungsrechte_kopf'));
  const zeile = (e: string) => rechte?.zeilen.find((z) => textVon(z[0]) === u.t(`vorlagen.D-04.entscheide.${e}`))?.slice(1).map(textVon) ?? [];
  if (!rechte) abw.push('D-04 ohne Tabelle der Entscheidungsrechte');
  const [einT, einM, einH] = zeile('einfuehren');
  const [restT, restM, restH] = zeile('restrisiko');
  const ausH = zeile('ausnahme')[2];
  for (const [stufe, zelle, id] of [['tief', einT, 'freigabe.einfuehren'], ['mittel', einM, 'freigabe.einfuehren'], ['hoch', einH, 'freigabe.einfuehren-hoch'], ['mittel', restM, 'freigabe.restrisiko'], ['hoch', restH, 'freigabe.restrisiko']] as const) {
    if (!hat(zelle, id)) abw.push(`D-04 Anlage A ${stufe}: «${zelle ?? ''}» ohne ${v(id, s)} (${id})`);
  }
  // D-06 bzw. D-06-EB: wer Restrisiken annimmt und Ausnahmen erteilt, wie D-04 Anlage A
  const id06 = p.meta.mitIsms ? 'D-06-EB' : 'D-06';
  const d06 = dok(p, true, 'D-06');
  const krit = tabelle(d06, u.liste('vorlagen.D-06.skalen.kopf_kriterien'))?.zeilen.map((z) => textVon(z[2]));
  if (!krit) abw.push(`${id06} ohne Akzeptanzkriterien`);
  else {
    ([['tief', krit[0], restT], ['mittel', krit[1], restM], ['hoch', krit[2], ausH]] as const).forEach(([stufe, k, d04]) => {
      if (!d04 || !(k ?? '').includes(d04)) abw.push(`${id06} Akzeptanz ${stufe}: «${k ?? ''}» nennt nicht «${d04 ?? ''}» aus D-04 Anlage A`);
    });
  }
  if (!p.meta.mitIsms && !satzMit(alleTexte(d06), THEMA.plan[s], v('freigabe.behandlungsplan', s))) abw.push(`D-06 ohne Freigabe des Behandlungsplans durch ${v('freigabe.behandlungsplan', s)}`);
  // D-03 Risikobereitschaft: was die AIMS-Verantwortung allein entscheidet, passt zu D-04 Anlage A
  const rb = tabelle(dok(p, true, 'D-03'), u.liste('vorlagen.D-03.risikobereitschaft_kopf'));
  const allein = textVon(rb?.zeilen.find((z) => textVon(z[0]) === u.t('vorlagen.D-03.risikobereitschaft_rahmen.aimsAllein'))?.[1]);
  const aims = v('freigabe.einfuehren', s).toLowerCase();
  if (!rb) abw.push('D-03 ohne Tabelle der Risikobereitschaft');
  else {
    if (THEMA.rest[s].test(allein) && !(restT ?? '').toLowerCase().includes(aims)) abw.push(`D-03: AIMS-Verantwortung nimmt Restrisiken allein an, D-04 Anlage A nennt «${restT}»`);
    // N7 («allein» heisst «ohne Eigner/in»): ohne Geschäftsleitung entscheidet die
    // AIMS-Verantwortung bei tiefem Risiko allein und bei mittlerem mit Eigner/in, nie bei hohem (Lesart je Stelle:
    // tests/unit/entscheide-test8.test.ts «N7»)
    if ((s === 'de' ? /hohe[mns]? Risik/i : /high risk/i).test(allein)) abw.push(`D-03: AIMS-Verantwortung entscheidet ohne Geschäftsleitung über hohes Risiko («${allein}»)`);
    if (!(s === 'de' ? /tiefe[mn]? Risiko/i : /low risk/i).test(allein)) abw.push(`D-03: Freigabe bei tiefem Risiko fehlt bei der AIMS-Verantwortung («${allein}»)`);
    if (!(s === 'de' ? /mittlere[mn]? Risiko[^.;]*Eigner/i : /medium risk[^.;]*owner/i).test(allein)) abw.push(`D-03: Freigabe bei mittlerem Risiko mit Eigner/in fehlt («${allein}»)`);
    if ((einT ?? '').toLowerCase().includes(s === 'de' ? 'eigner' : 'owner')) abw.push(`D-04 Anlage A einführen tief: AIMS-Verantwortung allein, nicht «${einT}»`);
    if (!(einM ?? '').toLowerCase().includes(s === 'de' ? 'eigner' : 'owner')) abw.push(`D-04 Anlage A einführen mittel: mit Eigner/in, nicht «${einM}»`);
    // Querbezug zu D-04 Anlage A für das tiefe Risiko: was D-03 der AIMS-Verantwortung überlässt, steht dort bei ihr
    if (!(einT ?? '').toLowerCase().includes(aims)) abw.push(`D-03: AIMS-Verantwortung entscheidet bei tiefem Risiko, D-04 Anlage A nennt «${einT ?? ''}»`);
  }
  // D-12 und D-15: Einführung durch AIMS-Verantwortung, bei hohem Risiko Geschäftsleitung; D-15 mit Freigabekriterien
  for (const id of ['D-12', 'D-15']) {
    const t = alleTexte(dok(p, true, id));
    for (const f of ['freigabe.einfuehren', 'freigabe.einfuehren-hoch']) if (!satzMit(t, THEMA.einf[s], v(f, s))) abw.push(`${id} ohne Freigabe der Einführung durch ${v(f, s)}`);
  }
  const kriterien = alleTexte(dok(p, true, 'D-15')).find((t) => (s === 'de' ? /Freigabekriterien/ : /approval criteria/i).test(t) && /D-08/.test(t) && /D-07/.test(t) && /D-12/.test(t));
  if (!kriterien) abw.push('D-15 ohne Freigabekriterien mit Kurzprüfung (D-08), Risikoeintrag (D-07) und Test (D-12)');
  // PR-07 im Prozesshandbuch: Kurzprüfung, Risikoeintrag und Test stehen im Ablauf (Reihenfolge: Graphregel GR-06)
  const t07 = prozessKapitel(p, true, 'PR-07', u).join('\n');
  for (const d of ['D-07', 'D-08', 'D-12']) if (!t07.includes(d)) abw.push(`PR-07 ohne ${d} im Ablauf`);
  // Behandlungsplan: D-26 und PR-08; Erklärung zur Anwendbarkeit: D-11, D-26 und PR-10
  if (!satzMit(alleTexte(dok(p, true, 'D-11')), /frei|approv/i, v('freigabe.soa', s))) abw.push(`D-11 ohne Freigabe durch ${v('freigabe.soa', s)}`);
  const d26 = tabelle(dok(p, true, 'D-26'), u.liste('vorlagen.D-26.freigabe_kopf'));
  for (const [thema, id] of [['soa', 'freigabe.soa'], ['plan', 'freigabe.behandlungsplan']] as const) {
    const zeilen = d26?.zeilen.filter((z) => THEMA[thema][s].test(textVon(z[0]))) ?? [];
    if (!zeilen.length) abw.push(`D-26 ohne Freigabezeile «${THEMA[thema][s].source}»`);
    for (const z of zeilen) if (!hat(textVon(z[2]), id)) abw.push(`D-26: «${textVon(z[0])}» gibt «${textVon(z[2])}» frei, nicht ${v(id, s)} (${id})`);
  }
  if (!satzMit(prozessKapitel(p, true, 'PR-08', u), THEMA.plan[s], v('freigabe.behandlungsplan', s))) abw.push(`PR-08 ohne Freigabe des Behandlungsplans durch ${v('freigabe.behandlungsplan', s)}`);
  if (!satzMit(prozessKapitel(p, true, 'PR-10', u), /Erklärung|statement/i, v('freigabe.soa', s))) abw.push(`PR-10 ohne Freigabe der Erklärung durch ${v('freigabe.soa', s)}`);
  return abw;
}

const PAARE: [string, (p: Projekt, leer: boolean) => string[]][] = [
  ['Freigabestellen D-03/D-04/D-06/D-11/D-12/D-15/D-26/PR-07/PR-08/PR-10', freigabestellen],
  ['D-14/PR-19', (p, l) => d14Pr19(p, l)],
  ['D-08/D-06-EB', d08D06],
  ['D-08/PR-09', d08Pr09],
  ['D-12/PR-13', d12Pr13],
  ['D-12/PR-13 Freigabestelle', (p, l) => d12Pr13Freigabestelle(p, l)],
  ['D-26/D-05/D-21', d26D05D21],
  ['D-04/D-27', d04D27],
];

describe('Querbezüge (AF-073)', () => {
  for (const q of QUELLEN) {
    for (const s of SPRACHEN) {
      const quelle = `${q.name} ${s}`;
      for (const [paar, pruefe] of PAARE) {
        it(`${paar}: ${quelle}`, () => {
          const gefunden = pruefe(q.projekt(s), q.leer);
          const bekannt = OFFEN.filter((o) => o.quelle === quelle && o.paar === paar);
          const neu = gefunden.filter((g) => !bekannt.some((o) => o.abweichung.test(g)));
          const behoben = bekannt.filter((o) => !gefunden.some((g) => o.abweichung.test(g))).map((o) => `behoben, aus OFFEN streichen: ${o.abweichung} (${o.paket})`);
          expect([...neu, ...behoben]).toEqual([]);
        });
      }
    }
  }
});

// AF-102 (A3-13): leere D-04 mit den Bereichen «Vorfälle und Meldungen» und «Entwicklung von KI», Spalte Stellvertretung
// und Abschnitt zu den Rollen der Prozessbahnen (IT, Fachbereich, Personal, Kommunikation), beide Pfade, DE und EN
describe('AF-102: leere D-04 deckt die Rollen der Prozessbahnen', () => {
  for (const q of QUELLEN.filter((x) => x.leer)) {
    for (const s of SPRACHEN) {
      it(`${q.name} ${s}`, () => {
        const p = q.projekt(s);
        const u = erstelleUebersetzer(s, texteJe[s]);
        const d = dok(p, true, 'D-04');
        const raci = tabelle(d, u.liste('vorlagen.D-04.raci_kopf'))!;
        expect(raci.kopf.map(textVon)[4]).toBe(s === 'de' ? 'Stellvertretung' : 'Deputy');
        const bereiche = raci.zeilen.map((z) => textVon(z[0]));
        for (const r of ['vorfall', 'entwicklung']) expect(bereiche).toContain(rollenText(u, r));
        expect(raci.zeilen.every((z) => z.length === 7)).toBe(true);
        const bahnen = tabelle(d, u.liste('vorlagen.D-04.bahnrollen_kopf'))!;
        expect(d.bloecke.some((b) => b.typ === 'ueberschrift' && textVon(b.text).endsWith(u.t('vorlagen.D-04.abschnitte.bahnrollen')))).toBe(true);
        const rollen = bahnen.zeilen.map((z) => textVon(z[0]));
        expect(rollen).toEqual(expect.arrayContaining(['fachbereich', 'it', 'hr', 'kommunikation', 'ki-eigner'].map((r) => rollenText(u, r))));
        // je Rolle Aufgaben und die Prozesse, in deren Ablauf sie eine Bahn hat
        for (const z of bahnen.zeilen) {
          expect(textVon(z[1]).length, textVon(z[0])).toBeGreaterThan(10);
          expect(textVon(z[2])).toMatch(/^P[RS]-\d{2}(, P[RS]-\d{2})*$/);
        }
        expect(d04D27(p, true)).toEqual([]);
      });
    }
  }
  it('Firmendokument: Stellvertretung in eigener Spalte statt in der Zelle R (Beispiel Muster)', () => {
    const p = QUELLEN.find((x) => x.name === 'muster-maschinenbau')!.projekt('de');
    const u = erstelleUebersetzer('de', texteJe.de);
    const raci = tabelle(dok(p, false, 'D-04'), u.liste('vorlagen.D-04.raci_kopf'))!;
    const mitStv = p.rollen.filter((r) => r.stellvertretung && !['konformitaet', 'berichterstattung'].includes(r.bereich));
    expect(mitStv.length).toBeGreaterThan(0);
    for (const r of mitStv) {
      const name = p.personen.find((x) => x.id === r.stellvertretung)!.name;
      expect(raci.zeilen.some((z) => textVon(z[4]) === name), r.bereich).toBe(true);
    }
    expect(raci.zeilen.some((z) => textVon(z[2]).includes('Stv.'))).toBe(false);
  });
});

// M4-28, M4-29: Die Prüfregel H73 rechnet ohne eigene Entscheidungsrechte mit dem Rang des Vorschlags in D-04 Anlage A.
// Rang je Zelle wie in pruefungen.ts verlangt(): Geschäftsleitung 3, AIMS-Verantwortung 2, sonst 1.
describe('Entscheidungsrechte: Vorschlag D-04 Anlage A gleich dem Rang der Prüfregeln (H73)', () => {
  for (const s of SPRACHEN) {
    it(s, () => {
      const u = erstelleUebersetzer(s, texteJe[s]);
      const rang = (t: string) => (/geschäftsleitung|management/i.test(t) ? 3 : /aims/i.test(t) ? 2 : 1);
      for (const e of ['einfuehren', 'restrisiko', 'ausserbetrieb'] as const) {
        const zellen = u.liste(`vorlagen.D-04.entscheidungsrechte_vorschlag.${e}`);
        expect(zellen.map(rang), e).toEqual([RANG_VORSCHLAG[e].tief, RANG_VORSCHLAG[e].mittel, RANG_VORSCHLAG[e].hoch]);
      }
    });
  }
});

// M4-31: Jede Spalte, aus der eine Kennzahl des Prozesskatalogs misst (datenquelle), steht in der leeren Vorlage, beide
// Pfade, DE und EN (vorher fehlte die Tabelle der Neubeurteilungen in D-09 für PR-09 und PR-13).
describe('Messplan: Datenquellen der Kennzahlen stehen in den leeren Vorlagen (M4-31)', () => {
  const quellen = (kataloge.prozesse_katalog?.prozesse ?? []).flatMap((kp) =>
    ((kp as unknown as { datenquelle?: { vorlage?: string; spalte?: string | number }[] }).datenquelle ?? []).filter((q) => q.vorlage && q.spalte !== undefined).map((q) => ({ prozess: kp.id, vorlage: q.vorlage!, spalte: String(q.spalte) })),
  );
  it('Katalog nennt Datenquellen, darunter D-09 (Neubeurteilungen)', () => {
    expect(quellen.length).toBeGreaterThan(20);
    expect(quellen.filter((q) => q.vorlage === 'D-09').map((q) => q.prozess)).toEqual(expect.arrayContaining(['PR-09', 'PR-13']));
  });
  for (const q of QUELLEN.filter((x) => x.leer)) {
    for (const s of SPRACHEN) {
      it(`${q.name} ${s}`, () => {
        const p = q.projekt(s);
        const u = erstelleUebersetzer(s, texteJe[s]);
        const fehlt: string[] = [];
        const texte = new Map<string, string[]>();
        // Spaltenköpfe der Tabellen (Word: tabelle.kopf, Excel: spalten[].kopf), nicht beliebiger Text im Dokument
        const koepfe = (w: unknown, aus: string[] = []): string[] => {
          if (Array.isArray(w)) w.forEach((x) => koepfe(x, aus));
          else if (w && typeof w === 'object') {
            const o = w as { typ?: string; kopf?: unknown; spalten?: unknown };
            if (o.typ === 'tabelle' && Array.isArray(o.kopf)) aus.push(...o.kopf.map((x) => textVon(x as Text)));
            if (Array.isArray(o.spalten) && o.spalten.every((x) => x && typeof x === 'object' && 'kopf' in x)) aus.push(...(o.spalten as { kopf: string }[]).map((x) => x.kopf));
            Object.values(w).forEach((x) => koepfe(x, aus));
          }
          return aus;
        };
        // Die leeren Vorlagen gelten für beide Pfade (Hauptdokument mit Zusatzdateien wie dem Register zu D-26)
        const erzeuge = (id: string) => [VORLAGEN[id]!, ...(ZUSATZDATEIEN[id] ?? []).map((z) => z.vorlage)].flatMap((vl) => koepfe(vl(kontext(p, true, id, { form: 'dokument' }))));
        for (const x of quellen) {
          if (!VORLAGEN[x.vorlage]) continue;
          if (!texte.has(x.vorlage)) texte.set(x.vorlage, erzeuge(x.vorlage));
          const kopf = String(u.roh(`vorlagen.${x.vorlage}.${x.spalte}`) ?? '').replace(/\s*\(.*\)$/, '');
          if (!kopf || !texte.get(x.vorlage)!.some((t) => t.trim() === kopf || t.startsWith(`${kopf} (`))) fehlt.push(`${x.prozess}: ${x.vorlage} «${kopf}» (${x.spalte})`);
        }
        expect(fehlt).toEqual([]);
      });
    }
  }
});

// M4-34: Das Ergänzungsaudit zu 9.3 und A.2.4 nach der Managementbewertung (D-20, D-25 Abschnitt 1) steht in beiden
// Zeitplänen des Leitfadens (Kapitel 4) nach der Managementbewertung und im Fahrplan der leeren D-25 (Anlage A).
describe('Zeitpläne: Ergänzungsaudit nach der Managementbewertung (M4-34)', () => {
  const WORT = { de: { audit: 'Ergänzungsaudit', mb: 'Managementbewertung' }, en: { audit: 'supplementary audit', mb: 'management review' } };
  for (const s of SPRACHEN) {
    it(`Leitfaden Kapitel 4, ${s}: beide Zeitpläne`, () => {
      const md = readFileSync(`src/leitfaden/${s}/04-zeitplaene.md`, 'utf8');
      // Die zwei Zeitpläne: Tabellen mit Spalte «Schritt» bzw. «Step»
      const plaene = md.split(/\n## /).filter((t) => /\n\| (Woche|Wochen|Week|Weeks) \| (Schritt|Step) \|/.test(t));
      expect(plaene.length).toBe(2);
      for (const plan of plaene) {
        // H3 (P20-Prüfung): nur die Spalte «Was geschieht» zählt; der Meilenstein allein genügt nicht
        const zeilen = plan.split('\n').filter((z) => z.startsWith('| ')).map((z) => z.split('|')[3] ?? '');
        const mb = zeilen.findIndex((z) => z.includes(WORT[s].mb));
        const audit = zeilen.findIndex((z) => z.includes(WORT[s].audit));
        expect(mb, plan.slice(0, 40)).toBeGreaterThan(0);
        expect(audit, plan.slice(0, 40)).toBeGreaterThanOrEqual(mb);
        if (audit === mb) expect(zeilen[mb]!.indexOf(WORT[s].audit)).toBeGreaterThan(zeilen[mb]!.indexOf(WORT[s].mb));
      }
    });
    for (const q of QUELLEN.filter((x) => x.leer)) {
      it(`D-25 ${q.name} ${s}: Fahrplan (Anlage A) nennt das Ergänzungsaudit`, () => {
        const u = erstelleUebersetzer(s, texteJe[s]);
        const bloecke = dok(q.projekt(s), true, 'D-25').bloecke;
        const titel = u.t('vorlagen.grafik.fahrplan.titel');
        const ab = bloecke.findIndex((b) => b.typ === 'ueberschrift' && textVon(b.text).endsWith(titel));
        expect(ab).toBeGreaterThan(0);
        expect(alleTexte(bloecke.slice(ab + 1)).some((t) => t.includes(WORT[s].audit) && /9\.3/.test(t) && /A\.2\.4/.test(t))).toBe(true);
      });
    }
  }
});

describe('Gegenprobe der Querbezugsprüfung', () => {
  const p = leeresProjekt({ sprache: 'de', jetzt: '2027-01-01T00:00:00.000Z', projektId: 'gegenprobe' });
  it('D-14/PR-19 erkennt eine Frist, die nur in einem Dokument geändert ist', () => {
    // D-14 mit anderem Wert für Stufe 2 als die Faktenquelle, gegen die verglichen wird (wie A3-12: 1 Arbeitstag gegen 4 Stunden)
    const anders = structuredClone(FAKTEN);
    anders.fakten['vorfall.stufe2'] = { ...anders.fakten['vorfall.stufe2']!, wert: 4, einheit: 'stunden' };
    const abw = d14Pr19(p, true, anders);
    expect(abw.some((a) => a.startsWith('D-14 Stufe 2'))).toBe(true);
    expect(abw.some((a) => a.startsWith('PR-19 Stufe 2'))).toBe(true);
  });
  it('D-14/PR-19 erkennt eine Frist von Hand im Ablauf (Notiz im Projekt)', () => {
    const q = structuredClone(JSON.parse(readFileSync('src/beispiele/praezisionsteile.de.aims.json', 'utf8')) as Projekt);
    q.prozesse!.find((x) => x.id === 'PR-19')!.notiz = 'Jeder Vorfall wird innert 5 Arbeitstagen erfasst.';
    expect(d14Pr19(q, false)).toContain('PR-19: Frist «5 Arbeitstagen» nicht aus der Faktenquelle');
  });
  it('D-12/PR-13 erkennt eine Freigabestelle, die D-12 und PR-13.05 oder PR-13.08 verschieden nennen (N6)', () => {
    const en = leeresProjekt({ sprache: 'en', jetzt: '2027-01-01T00:00:00.000Z', projektId: 'gegenprobe-en' });
    for (const q of [p, en]) {
      expect(d12Pr13Freigabestelle(q, true)).toEqual([]);
      // P15b-Gegenprobe: PR-13.05 zurück in der Bahn des Eigners, ohne AIMS-Verantwortung als A oder R
      expect(d12Pr13Freigabestelle(q, true, { 'PR-13.05': { 'ki-eigner': 'A', aims: 'C' } }).length).toBeGreaterThan(0);
      // Die Geschäftsleitung gibt in PR-13.08 nicht mehr frei
      expect(d12Pr13Freigabestelle(q, true, { 'PR-13.08': { aims: 'A', gl: 'C' } }).length).toBeGreaterThan(0);
      // Eine Rolle gibt frei, die D-12 nicht nennt
      expect(d12Pr13Freigabestelle(q, true, { 'PR-13.05': { aims: 'A', 'ki-eigner': 'R', risikomanagement: 'A' } })[0]).toMatch(/risikomanagement/);
    }
  });
  it('D-08/D-06-EB erkennt die fehlende Schwelle im Ergänzungsblatt (A3-06)', () => {
    const ohne = structuredClone(texteJe.de) as Record<string, unknown>;
    const eb = ((ohne.vorlagen as Record<string, Record<string, Record<string, string>>>)['D-06']!.eb!);
    eb.folgen_text = 'Kurzprüfungen und Folgenabschätzungen sind ein fester Eingang der Risikobeurteilung.';
    const alt = texteJe.de;
    texteJe.de = ohne as typeof alt;
    try {
      expect(d08D06(leeresProjekt({ sprache: 'de', mitIsms: true, projektId: 'g2', jetzt: '2027-01-01T00:00:00.000Z' }), true)[0]).toMatch(/^D-06-EB ohne Schwelle/);
    } finally {
      texteJe.de = alt;
    }
  });
  it('D-26/D-05/D-21 erkennt eine Kennzahl, die im falschen Register misst (A3-16)', () => {
    const anders = structuredClone(texteJe.de) as Record<string, unknown>;
    const pr = (anders.prozesse as { prozesse: Record<string, { kennzahl_methode: string }> }).prozesse;
    pr['PR-26']!.kennzahl_methode = 'Entscheide im Protokoll D-21 gegen D-07.';
    const alt = texteJe.de;
    texteJe.de = anders as typeof alt;
    try {
      const abw = d26D05D21(p, true);
      expect(abw).toContain('D-05 PR-26: Methode nennt D-07 als Register');
    } finally {
      texteJe.de = alt;
    }
  });
});

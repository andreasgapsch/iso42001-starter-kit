// Hilfen zum Test firmendokumente-kittexte.test.ts: Kit-Wörter, Ausnahmen, Textsuche im IR (auch für eigene Auswertungen).
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Block, DocxDokument, Text, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import type { Modus, VorlagenKontext } from '../../src/vorlagen/kontext.ts';

const kataloge = ladeKataloge();
export const FIRMEN = ['muster-maschinenbau', 'praezisionsteile'] as const;
export const SPRACHEN: Sprache[] = ['de', 'en'];
export const projekt = (firma: string, sprache: Sprache): Projekt => JSON.parse(readFileSync(`src/beispiele/${firma}.${sprache}.aims.json`, 'utf8')) as Projekt;

/**
 * Alle Schlüssel der Optionsgruppen (src/gefuehrt/optionen.yaml) in Klammern, ohne die genannten Ausnahmen. Einzelne
 * Buchstaben, «ba», «bb» und römische Ziffern sind Gliederungen von Rechtstexten (Art. 5(1)(ba)).
 */
function schluesselMuster(ausnahmen: string[]): RegExp {
  const gruppen = (parse(readFileSync('src/gefuehrt/optionen.yaml', 'utf8')) as { optionen: Record<string, unknown[]> }).optionen;
  const schluessel = [...new Set(Object.values(gruppen).flat().map(String))].filter((x) => /^[a-z][a-z0-9-]+$/.test(x) && !/^(?:ba|bb|[ivx]+)$/.test(x) && !ausnahmen.includes(x));
  return new RegExp(`\\((?:${schluessel.sort((a, b) => b.length - a.length).join('|')})\\)`);
}

/** Kit-Wörter je Sprache. Anweisungen nur am Satzanfang, damit Fachbegriffe («check», «Prüfung») nicht zählen. */
const SATZANFANG = String.raw`(?:^|[.!?:;]\s+|\n\s*|•\s*)`;
export const MUSTER: Record<Sprache, { name: string; re: RegExp }[]> = {
  de: [
    { name: 'Kit', re: /\b(?:Kit|Kits|Kit-\w+)\b/ },
    { name: 'Starter', re: /Starter/ },
    { name: 'KMU-CIO', re: /KMU-CIO|kmu-cio/i },
    { name: 'Release', re: /\b(?:vor (?:dem|jedem) Release|Release des)\b/ },
    { name: 'Vorlage', re: /\b(?:Diese Vorlage|diese Vorlage|Pflichtvorlage|Kit-Vorlage\w*|Vorlage des Kits|Vorlage aus dem)\b/ },
    { name: 'Projektplan', re: /Projektplan/ },
    { name: 'Ausbaustufe', re: /Ausbaustufe/ },
    { name: 'Wo im', re: /\bWo im\b|im Kit\b/ },
    { name: 'Sie-Anweisung', re: new RegExp(`${SATZANFANG}(?:[A-ZÄÖÜ][a-zäöü]+(?:en|ern|eln)) Sie\\b`) },
    { name: 'Ihr Unternehmen', re: /\bIhr(?:e|en|er|em)? (?:Unternehmen|Organisation|KI-Systeme?|Firma)\b/ },
    // Stage-1-Audit 2: Anrede der Ausfüllenden mitten im Satz («in Ihrem Auftrag», «Soweit Sie …»)
    { name: 'Sie-Anrede', re: /(?<![.!?:•]\s|^|\n)\b(?:Sie|Ihr(?:e|en|er|em|es)?)\b/ },
    // Interne Schlüssel aus den Optionsgruppen in Klammern («(qualitaet)», «(it)»); «(intern)», «(extern)» sind deutsche Wörter
    { name: 'Schlüssel', re: schluesselMuster(['intern', 'extern', 'offen']) },
    // Werkzeug und Kit: Modul, Modulschalter, Etappen und Etappen-IDs, Leitfaden, Werkzeug
    { name: 'Modul', re: /\bModul(?:s|e|en)?\b|\bModulschalter\b/ },
    { name: 'Etappe', re: /\bEtappe\w*|\bE\d{1,2}\b(?!-)/ },
    { name: 'Leitfaden', re: /\bLeitfaden\w*|AIMS-Manager|Geführte[nrm]? Modus|\bGuides?\b/ },
    { name: 'Normbezug', re: /SNV, DIN oder ISO/ },
    { name: 'Platzhaltertext', re: /\bD-xx\b|\bProduktname\b|\bStandard X\b|\bName, Funktion\b/ },
  ],
  en: [
    { name: 'kit', re: /\bkit\b|\bthe kit's\b/i },
    { name: 'Starter', re: /Starter/ },
    { name: 'KMU-CIO', re: /KMU-CIO|kmu-cio/i },
    { name: 'release', re: /\bbefore (?:the|every|each) release\b/i },
    { name: 'template', re: /\b(?:[Tt]his template|mandatory template|kit templates?)\b/ },
    { name: 'project plan', re: /project plan/i },
    { name: 'extension', re: /Extension \(optional\)|extension stage/i },
    { name: 'Where in', re: /\bWhere in the kit\b|\bin the kit\b/i },
    { name: 'imperative', re: new RegExp(`${SATZANFANG}(?:Enter|Add|Check(?! (?:aid|point|list|questions?|of)\\b)|Complete|Fill in|Tick|Have (?:it|them|\\w+ \\w+) (?:reviewed|checked))\\s+\\w`) },
    { name: 'your company', re: /\byour (?:company|organization|AI systems?)\b/i },
    { name: 'you', re: /\b(?:you|your|yours)\b/i },
    { name: 'key', re: schluesselMuster(['governance']) },
    { name: 'module', re: /\b[Mm]odules?\b|\bmodule switch\b/ },
    { name: 'stage', re: /\b[Ss]tages? E\d|\bE\d{1,2}\b(?!-)/ },
    { name: 'guide', re: /\b[Gg]uide\b|AIMS Manager|[Gg]uided [Mm]ode/ },
    { name: 'standard source', re: /SNV, DIN or ISO/ },
    { name: 'placeholder text', re: /\bD-xx\b|\b[Pp]roduct name\b|\b[Ss]tandard X\b|\bName, role\b/ },
  ],
};

/**
 * Bekannte Treffer ausserhalb dieser Bereinigung (Datei-ID, Muster, Grund). Treffer hier schlagen nicht fehl.
 * Katalogtexte stammen nicht aus den Vorlagen, sondern aus den gemeinsamen Katalogen.
 */
export const AUSNAHMEN: { id: RegExp; text: RegExp; grund: string }[] = [
  // Der Fragebogen zum KI-Inventar richtet sich an die Mitarbeitenden und spricht sie an
  { id: /^D-10/, text: /\?/, grund: 'Fragen des Fragebogens an Mitarbeitende' },
  // Zeitrahmen der eigenen Ausgangslage in D-25 («Ohne ISMS: rund 150 Tage»)
  { id: /^D-25/, text: /^(?:Ohne ISMS|Without ISMS)$/, grund: 'Ausgangslage im Pfad ohne ISMS' },
  // Wörtliches NIST-Zitat (NIST AI 600-1, MP-3.4-002) in der Spalte «NIST AI 600-1 actions (original text)»; Zitate bleiben wörtlich
  { id: /^N-02/, text: /include modules on digital content transparency/, grund: 'NIST-Zitat MP-3.4-002' },
];


export interface Treffer {
  muster: string;
  text: string;
}

/** Alle Texte eines IR ohne Platzhalter (gelb markierte Läufe, [[…]] und […] in Zellen) */
export function texte(ir: DocxDokument | XlsxMappe): string[] {
  const aus: string[] = [];
  const text = (t: Text | undefined) => {
    if (t === undefined) return;
    if (typeof t === 'string') aus.push(t.replace(/\[\[.*?\]\]/g, ' ').replace(/\[[^\]\n]{1,80}\]/g, ' '));
    else aus.push(t.filter((l) => !l.platzhalter).map((l) => l.text).join(''));
  };
  const block = (b: Block) => {
    switch (b.typ) {
      case 'ueberschrift':
      case 'absatz':
        text(b.text);
        break;
      case 'hinweis':
        // Kennzeichnung «Beispiel aus dem Starter-Kit» ist in Beispielen gewollt
        if (b.art === 'beispiel') break;
        // Die Beschriftung des Kastens (z. B. «Ausbaustufe (optional)») setzt der Generator nach der Art
        if (b.art === 'ausbau') aus.push(`Ausbaustufe (optional) Extension (optional)`);
        text(b.titel);
        text(b.text);
        break;
      case 'liste':
        b.punkte.forEach(text);
        break;
      case 'tabelle':
        b.kopf.forEach(text);
        b.zeilen.forEach((z) => z.forEach(text));
        break;
      case 'felder':
        b.felder.forEach((f) => (text(f.label), text(f.wert)));
        break;
      case 'unterschriften':
        b.felder.forEach((f) => text(typeof f === 'string' ? f : `${f.funktion} ${f.name}`));
        break;
      // Grafiken: Beschriftungen, Legenden und Textalternativen zählen wie Fliesstext
      case 'matrix':
        text(b.titel);
        text(b.ecke);
        b.spalten.forEach(text);
        b.zeilen.forEach((z) => (text(z.kopf), z.zellen.forEach((c) => c.zeilen.forEach(text))));
        b.legende?.forEach((l) => text(l.text));
        text(b.alt);
        break;
      case 'diagramm':
        text(b.titel);
        b.kategorien.forEach(text);
        b.reihen.forEach((r) => text(r.name));
        text(b.alt.titel);
        text(b.alt.beschreibung);
        break;
      case 'ablauf':
        b.knoten.forEach((k) => text(k.text));
        b.kanten.forEach((k) => text(k.text));
        text(b.alt.titel);
        text(b.alt.beschreibung);
        break;
      default:
        break;
    }
  };
  for (const v of Object.values(ir.lenkung)) text(v as Text);
  text(ir.eigenschaften.titel);
  if ('bloecke' in ir) {
    text(ir.kopf.firmenname);
    text(ir.kopf.fusszeile);
    ir.bloecke.forEach(block);
  } else {
    (ir.hinweisBlock ?? []).forEach(block);
    for (const b of ir.blaetter) {
      text(b.name);
      text(b.titel);
      (b.hinweise ?? []).forEach(text);
      b.spalten.forEach((s) => (text(s.kopf), (s.liste ?? []).forEach(text)));
      b.zeilen.forEach((z) => z.forEach((w) => typeof w === 'string' && text(w)));
      for (const m of b.matrizen ?? []) {
        text(m.titel);
        text(m.ecke);
        m.zeilen.forEach((z) => text(z.text));
        m.spalten.forEach((x) => text(x.text));
      }
    }
  }
  return aus;
}

/** Alle Zeichenketten der Projektdatei (Projektdaten der Firma zählen nicht als Kit-Text) */
export function datenTexte(o: unknown, aus: string[] = []): string[] {
  if (typeof o === 'string') {
    if (o.length >= 3) aus.push(o);
  } else if (Array.isArray(o)) o.forEach((x) => datenTexte(x, aus));
  else if (o && typeof o === 'object') Object.values(o).forEach((x) => datenTexte(x, aus));
  return aus;
}

/**
 * Muster, die nur in einem Pfad Kit- oder Werkzeugtext sind: ohne ISMS jede Nennung des ISMS (Stage-1-Audit 2, P8), ohne
 * Modul jeder Verweis auf die Dokumente E-01 bis E-09 (P17), ohne Modul NIST AI RMF auf N-01 bis N-04 und RMF-xx.
 */
export function pfadMuster(p: Projekt): { name: string; re: RegExp }[] {
  return [
    ...(p.meta.mitIsms ? [] : [{ name: 'ISMS ohne ISMS', re: /\bISMS\b/ }]),
    ...(p.meta.modulAiAct ? [] : [{ name: 'E-Dokument ohne Modul', re: /\bE-0\d\b/ }]),
    // Modul NIST AI RMF (ab rc.2): ohne Modul kein Verweis auf N-01 bis N-04 und kein RMF-Control
    ...(p.meta.modulNistRmf ? [] : [{ name: 'N-Dokument ohne Modul', re: /\bN-0[1-4]\b|\bRMF-G?\d{2}\b/ }]),
  ];
}

/** Zusatz «in Erarbeitung» bei Verweisen auf später freigegebene Dokumente (kontext.ts, geplanteVerweise); kein Kit-Text */
const GEPLANT = / \((?:in Erarbeitung|in preparation)\)|,? (?:in Erarbeitung|in preparation)(?=\))| (?:in Erarbeitung|in preparation)(?=[,;])/g;

export function suche(ir: DocxDokument | XlsxMappe, sprache: Sprache, daten: string[], zusatz: { name: string; re: RegExp }[] = []): Treffer[] {
  const treffer: Treffer[] = [];
  for (const roh of texte(ir)) {
    const t = roh.replace(GEPLANT, '');
    for (const { name, re } of [...MUSTER[sprache], ...zusatz]) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
      for (const m of t.matchAll(g)) {
        const von = m.index!;
        const bis = von + m[0].length;
        // Treffer innerhalb eines Werts aus der Projektdatei: Inhalt der Firma
        const inDaten = daten.some((d) => {
          if (d.length < m[0].trim().length) return false;
          for (let i = t.indexOf(d); i >= 0; i = t.indexOf(d, i + 1)) if (i <= von && i + d.length >= bis) return true;
          return false;
        });
        if (!inDaten) treffer.push({ muster: name, text: t.slice(Math.max(0, von - 40), bis + 60).replace(/\s+/g, ' ').trim() });
      }
    }
  }
  return treffer;
}

export function kontext(p: Projekt, modus: Modus, a: { form: VorlagenKontext['form']; kiSystemId?: string }): VorlagenKontext {
  const sprache = p.meta.dokumentSprache;
  return {
    u: erstelleUebersetzer(sprache, ladeTexte(sprache)),
    modus,
    form: a.form,
    projekt: p,
    kataloge,
    kitVersion: '1.0.0',
    ...(a.kiSystemId ? { kiSystemId: a.kiSystemId } : {}),
  };
}

/**
 * IR eines Firmendokuments, je Beispiel, Sprache und Dokument nur einmal erzeugt. Die Erzeugung aller Dokumente eines Beispiels
 * kostet Sekunden; Tests, die jedes Dokument einzeln prüfen, teilen sich dieses Ergebnis (Zeitbudget je Test klein, AF-048).
 */
const irSpeicher = new Map<string, DocxDokument | XlsxMappe>();
export function firmenIr(p: Projekt, a: { name: string; form: VorlagenKontext['form']; kiSystemId?: string; vorlage: (k: VorlagenKontext) => unknown }): DocxDokument | XlsxMappe {
  const schluessel = `${p.meta.projektId}|${p.meta.dokumentSprache}|${a.name}`;
  let ir = irSpeicher.get(schluessel);
  if (!ir) {
    ir = a.vorlage(kontext(p, 'firma', a)) as DocxDokument | XlsxMappe;
    irSpeicher.set(schluessel, ir);
  }
  return ir;
}

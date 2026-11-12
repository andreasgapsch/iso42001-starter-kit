// Datumsprüfung der Beispiele: Kein Dokument und kein datierter Eintrag verweist auf Ereignisse nach seinem eigenen Datum.
// Teil 1 (Firmendokumente): Text jeder Datei in dist/firmendokumente/<firma>/<sprache> (nach npx tsx scripts/beispiele.mts)
//   gegen das Freigabedatum aus der Lenkungstabelle des Dokuments. Geprüft werden IDs mit festem Entstehungsdatum:
//   MB (Datum der Bewertung), F (Datum der Feststellung), M aus Audit oder Managementbewertung (Datum der Quelle),
//   N (Datum des Nachweises), IA (Datum der Kurzprüfung; Freigabe der Abschätzung als Hinweis), dazu Messungen der Ziele.
// Teil 2 (Projektdaten): datierte Einträge (Freigaben von KI-Systemen und Folgenabschätzungen, Restrisiko-Annahmen,
//   Managementbewertungen, Messungen, Checklisten, Nachweise, Erledigungen) gegen die IDs in ihren eigenen Texten.
//   Seit Stage-1-Runde 3 zusätzlich: TH- und IP-IDs (entstehen mit der ersten Freigabe von D-01), M-Nummern (Erfassung,
//   massnahmen[].erfasstAm), KI-IDs (Erfassung), Verweise auf Dokumente, die erst später erstmals freigegeben wurden
//   (ohne Zusatz «in Erarbeitung»; nicht in D-00, D-25 und im Register D-26), Status «freigegeben» in D-02, D-10 und D-12
//   vor der Freigabe des KI-Systems sowie Erstellt/Geändert in den Dateieigenschaften gegen die Freigabedaten.
// Teil 2 (Projektdaten): datierte Einträge gegen die IDs in ihren eigenen Texten; dazu Reihenfolge der M-Nummern nach
//   Erfassungsdatum, Version über 1.0 ohne Eintrag in der Änderungshistorie, letzte Zeile der Historie gleich Version
//   und Freigabe.
// Seit Stage-1-Runde 4 zusätzlich: Prüfvermerk (dokumente[].geprueft) nicht nach der Freigabe und nicht vor dem Inhalt
//   (jüngstes Ereignis, dessen ID im Text steht, Neubeurteilungen der D-09, Datumsangaben im Text zwischen Prüfung und
//   Freigabe); Wirksamkeitsprüfung in der SoA (controls[].wirksamkeit) nicht vor den Nachweisen, Ereignissen und
//   Dokumenten, auf die sie sich stützt, und im Einklang mit dem Audit, das sie nennt (Checkliste mit Ergebnis, keine
//   Nichtkonformität zum Control bei «keine Abweichung»).
// Seit Stage-1-Runde 5 zusätzlich: Kennung einer Feststellung erst ab ihrer Erfassung (feststellungen[].erfasstAm, sonst
//   Datum), Erfassung nicht vor dem Ereignis; Verweise «in Erarbeitung» gegen den Stand des Dokuments (Freigabe oder spätere
//   Bestätigung ohne Änderung, dokumente[].bestaetigt), Bestätigung nicht vor der Freigabe; Massnahmen mit Status «erledigt»
//   nicht vor der ersten Freigabe der Dokumente, die sie erarbeiten (Dokument-IDs in Titel und Beschreibung); Beurteilung und
//   Annahme des Restrisikos nicht vor der Erfassung des Risikos (risiken[].erfasstAm).
// Ab Prozesse zusätzlich: Einstufung der Reife (prozesse[].reifeAm) und Übernahme aus draw.io nicht vor den Einträgen, die
//   Notiz, Nachweise und Ablauf nennen.
// Teil 3 (Hinweise): Datumsangaben im Text, die nach dem Dokumentdatum liegen, zur Durchsicht (Termine sind zulässig).
// Seit Runde 2b (AF-077): Teil 2 läuft vollständig über die Prüfregeln der zeitlichen Gültigkeit im Produkt
//   (src/regeln/zeit.ts, Regeln F39 bis F41 und weitere Datumsketten); Hilfsfunktionen für Teil 1 kommen von dort.
// Aufruf: npx tsx src/beispiele/bau/datumspruefung.mts [--hinweise] [--nur-daten] (--nur-daten: nur Teil 2, ohne dist)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { auftraege } from '../../../scripts/beispiele.mts';
import { ladeTexte } from '../../i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../i18n/texte.ts';
import { ladeKataloge } from '../../kataloge/laden-node.ts';
import type { Projekt } from '../../model/typen.ts';
import { DOK_MUSTER as DOK, GEPLANT, ID_MUSTER as ID, dokEintrag, ereignisse, ersteFreigabe, isoAusText as iso, zeitlicheGueltigkeit, type StandAngaben } from '../../regeln/zeit.ts';
import type { Text } from '../../generator/ir.ts';
import { erstelleHelfer, PLAN_NACH, PLAN_VOR } from '../../vorlagen/kontext.ts';

const mitHinweisen = process.argv.includes('--hinweise');
const nurDaten = process.argv.includes('--nur-daten');
const kataloge = ladeKataloge();
const BEISPIELE = ['muster-maschinenbau', 'praezisionsteile'].flatMap((firma) => (['de', 'en'] as const).map((sprache) => ({ firma, sprache })));

const klar = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => l.text).join(''));
/** Text einer DOCX- oder XLSX-Datei */
function dateitext(pfad: string): string {
  const z = unzipSync(new Uint8Array(readFileSync(pfad)));
  const teile = Object.entries(z)
    .filter(([n]) => /^(word\/(document|header\d*|footer\d*)\.xml|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(n))
    .map(([, d]) => strFromU8(d));
  return teile
    .join('\n')
    .replace(/<\/(w:p|si|c|row)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

let fehler = 0;
let hinweise = 0;
for (const { firma, sprache } of BEISPIELE) {
  const p = JSON.parse(readFileSync(`src/beispiele/${firma}.${sprache}.aims.json`, 'utf8')) as Projekt;
  const { hart, weich } = ereignisse(p);
  const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
  const ordner = join('dist', 'firmendokumente', firma, sprache);
  const kopf = `${firma} (${sprache.toUpperCase()})`;
  if (!nurDaten && !existsSync(ordner)) throw new Error(`${ordner} fehlt: zuerst npx tsx scripts/beispiele.mts`);
  let n = 0;
  for (const a of nurDaten ? [] : auftraege(p, sprache)) {
    const ir = a.vorlage({ u, modus: 'firma', form: a.form, projekt: p, kataloge, kitVersion: 'pruefung', ...(a.kiSystemId ? { kiSystemId: a.kiSystemId } : {}) });
    const datum = iso(klar(ir.lenkung.datum));
    const endung = 'bloecke' in ir ? 'docx' : 'xlsx';
    const pfad = join(ordner, `${a.name}.${endung}`);
    if (!datum) {
      console.log(`${kopf} ${a.name}: kein Freigabedatum`);
      continue;
    }
    n++;
    const text = dateitext(pfad);
    const eigene = ir.lenkung.dokumentId;
    // Dokumentverweise auf später erstmals freigegebene Dokumente (Pläne und Register ausgenommen); Stand ist die Freigabe
    // oder eine spätere Bestätigung ohne Änderung (dokumente[].bestaetigt)
    const planOderRegister = /^D-(00|25)\b/.test(eigene) || (/^D-26/.test(eigene) && endung === 'xlsx');
    const stand = erstelleHelfer({ u, modus: 'firma', form: a.form, projekt: p, kataloge, kitVersion: 'pruefung' }).standDatum(eigene) ?? datum;
    if (!planOderRegister) {
      const basis = (x: string) => x.replace(/-EB$/, '');
      const gesehenDok = new Set<string>();
      for (const m of text.matchAll(DOK)) {
        const ref = m[1]!;
        if (basis(ref) === basis(eigene) || gesehenDok.has(ref)) continue;
        const erst = ersteFreigabe(p, ref);
        const geplant = GEPLANT.test(text.slice(m.index! + ref.length, m.index! + ref.length + 20));
        // Titel einer Massnahme oder eines Entscheids über das Dokument selbst («Freigabe von D-27», «D-27 einführen») tragen keinen Zusatz
        const plan = PLAN_VOR.test(text.slice(Math.max(0, m.index! - 60), m.index!)) || PLAN_NACH.test(text.slice(m.index! + ref.length, m.index! + ref.length + 90));
        if (!erst || (erst <= stand && !geplant) || (erst > stand && (geplant || plan))) continue;
        gesehenDok.add(ref);
        fehler++;
        console.log(
          erst > stand
            ? `FEHLER ${kopf} ${a.name} (${stand}): Verweis auf ${ref}, erstmals freigegeben ${erst} … ${text.slice(Math.max(0, m.index! - 60), m.index! + 30).replace(/\s+/g, ' ')}`
            : `FEHLER ${kopf} ${a.name} (${stand}): Verweis auf ${ref} «in Erarbeitung», aber seit ${erst} freigegeben`,
        );
      }
    }
    // Status «freigegeben» oder «eingeschränkt» in Dokumenten mit Systemliste vor der Freigabe des KI-Systems
    if (/^(D-02|D-10|D-12)\b/.test(eigene)) {
      for (const s of p.kiSysteme.filter((x) => ['freigegeben', 'eingeschraenkt'].includes(x.status) && x.freigabe?.am && x.freigabe.am > datum)) {
        if (!text.includes(s.id)) continue;
        fehler++;
        console.log(`FEHLER ${kopf} ${a.name} (${datum}): ${s.id} mit Status «${s.status}», freigegeben erst am ${s.freigabe!.am}`);
      }
    }
    // Dateieigenschaften: geändert = Freigabe der aktuellen Version, erstellt = erste Freigabe
    const core = strFromU8(unzipSync(new Uint8Array(readFileSync(pfad)))['docProps/core.xml']!);
    const geaendert = /<dcterms:modified[^>]*>(\d{4}-\d{2}-\d{2})/.exec(core)?.[1];
    const erstellt = /<dcterms:created[^>]*>(\d{4}-\d{2}-\d{2})/.exec(core)?.[1];
    const h = erstelleHelfer({ u, modus: 'firma', form: a.form, projekt: p, kataloge, kitVersion: 'pruefung' });
    const erwartetErstellt = h.ersteFreigabe(eigene) ?? datum;
    if (geaendert !== datum || erstellt !== erwartetErstellt) {
      fehler++;
      console.log(`FEHLER ${kopf} ${a.name} (${datum}): Dateieigenschaften erstellt ${erstellt}, geändert ${geaendert} (erwartet ${erwartetErstellt}, ${datum})`);
    }
    // Prüfvermerk: nicht nach der Freigabe, nicht vor dem Inhalt
    const eintrag = dokEintrag(p, eigene);
    const geprueft = eintrag?.geprueft?.am;
    if (geprueft) {
      if (geprueft > datum) {
        fehler++;
        console.log(`FEHLER ${kopf} ${a.name} (${datum}): geprüft am ${geprueft}, nach der Freigabe`);
      }
      const inhalt: { d: string; was: string }[] = [];
      for (const m of text.matchAll(ID)) {
        const d = hart.get(m[1]!);
        if (d && d <= datum) inhalt.push({ d, was: m[1]! });
      }
      const ia = /^D-09-(KI-\d+)$/.exec(eigene);
      for (const f of p.folgenabschaetzungen.filter((x) => ia && x.kiSystem === ia[1]))
        for (const n of f.neubeurteilungen ?? []) if (n.am <= datum) inhalt.push({ d: n.am, was: 'Neubeurteilung' });
      for (const m of text.matchAll(/\b\d{2}[./]\d{2}[./]\d{4}\b/g)) {
        const d = iso(m[0])!;
        if (d > geprueft && d < datum) inhalt.push({ d, was: `Datum ${m[0]}` });
      }
      const spaet = inhalt.filter((x) => x.d > geprueft).sort((x, y) => y.d.localeCompare(x.d))[0];
      if (spaet) {
        fehler++;
        console.log(`FEHLER ${kopf} ${a.name} (${datum}): geprüft am ${geprueft}, Inhalt vom ${spaet.d} (${spaet.was})`);
      }
    }
    const gesehen = new Set<string>();
    for (const m of text.matchAll(ID)) {
      const id = m[1]!;
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      const ort = text.slice(Math.max(0, m.index! - 60), m.index! + 40).replace(/\s+/g, ' ');
      if ((hart.get(id) ?? '') > datum) {
        fehler++;
        console.log(`FEHLER ${kopf} ${a.name} (${datum}): ${id} vom ${hart.get(id)} … ${ort}`);
      } else if ((weich.get(id) ?? '') > datum && mitHinweisen) {
        hinweise++;
        console.log(`Hinweis ${kopf} ${a.name} (${datum}): ${id} freigegeben ${weich.get(id)} … ${ort}`);
      }
    }
    // Messungen: ein Dokument zeigt keine Messung nach seinem Datum
    for (const z of p.ziele) for (const ms of z.messungen) {
      const d = ms.datum.slice(0, 10);
      const [j, mo, t] = d.split('-');
      const anzeige = sprache === 'de' ? `${t}.${mo}.${j}` : `${t}/${mo}/${j}`;
      if (d > datum && text.includes(anzeige) && text.includes(z.id)) {
        // nur zählen, wenn der Messwert in der Nähe steht
        const i = text.indexOf(anzeige);
        const nahe = text.slice(i, i + 200);
        if (nahe.includes(ms.wert.replace(',', sprache === 'de' ? ',' : '.').split(' ')[0]!)) {
          fehler++;
          console.log(`FEHLER ${kopf} ${a.name} (${datum}): Messung ${z.id} vom ${d}`);
        }
      }
    }
    if (mitHinweisen) {
      for (const m of text.matchAll(/\b\d{2}[./]\d{2}[./]\d{4}\b/g)) {
        const d = iso(m[0])!;
        if (d > datum) {
          hinweise++;
          console.log(`Hinweis ${kopf} ${a.name} (${datum}): ${m[0]} … ${text.slice(Math.max(0, m.index! - 70), m.index! + 12).replace(/\s+/g, ' ')}`);
        }
      }
    }
  }
  // Teil 2: Projektdaten über die Prüfregeln der zeitlichen Gültigkeit (src/regeln/zeit.ts, AF-077)
  const stand: StandAngaben = { aiAct: kataloge['aiact_stand'] as StandAngaben['aiAct'], nist: kataloge.nistrmf_stand as StandAngaben['nist'] };
  for (const x of zeitlicheGueltigkeit(p, stand)) {
    fehler++;
    console.log(`FEHLER ${kopf} Projektdaten ${x.wo}${x.regel === 'daten' ? '' : ` (${x.regel})`}: ${x.was}`);
  }
  console.log(`${kopf}: ${n} Dokumente mit Freigabedatum geprüft`);
}
console.log(`Ergebnis: ${fehler} Fehler${mitHinweisen ? `, ${hinweise} Hinweise zur Durchsicht` : ''}`);
process.exitCode = fehler ? 1 : 0;

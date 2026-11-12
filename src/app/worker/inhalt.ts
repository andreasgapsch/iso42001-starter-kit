// Inhaltsverzeichnis des Dokumentensets (00_Inhalt.xlsx, EN 00_Contents.xlsx) als erste Datei im ZIP: je Datei ID, Titel,
// Normbezug, Dateiname, Version, Status und Freigabe aus dem Dokumentenregister, ob die Unterlage für Stage 1 vorzulegen
// ist (Auswahl E13, meta.gefuehrt.antworten.zertifizierung.unterlagen) und bei Ergänzungsblättern das ergänzte ISMS-Dokument.
// Firmendokument: keine Kit-Angaben (Tor G8). Isomorph: läuft im Worker und in Node-Tests.
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../../generator/ir.ts';
import { erstelleUebersetzer, type Texte } from '../../i18n/texte.ts';
import type { Dokument, Kataloge } from '../../kataloge/typen.ts';
import type { Projekt, Sprache } from '../../model/typen.ts';
import { ergaenzungsblaetter, normbezugText } from '../../vorlagen/ergaenzungsblatt.ts';
import { gestaltungEinsetzen } from '../../vorlagen/gestaltung.ts';
import { dokumentTitel, erstelleHelfer, klartext, normbezugSprache } from '../../vorlagen/kontext.ts';
import type { SetEintrag } from './set.ts';

/** Unterlagen für Stage 1 (Optionsgruppe stage1Unterlagen) und die Vorlagen, die sie enthalten */
export const STAGE1_DOKUMENTE: Record<string, string[]> = {
  geltungsbereich: ['D-02'],
  leitlinie: ['D-03'],
  rollen: ['D-04'],
  inventar: ['D-10'],
  risiko: ['D-06', 'D-07'],
  folgen: ['D-08', 'D-09'],
  soa: ['D-11'],
  ziele: ['D-05'],
  audit: ['D-20'],
  managementbewertung: ['D-21'],
  nichtkonformitaeten: ['D-22'],
  dokumente: ['D-26'],
};

/** Register-ID einer Datei: D-09 je System als D-09-KI-xxx, Zusatzdateien unter der ID ihrer Vorlage */
export function registerId(e: Pick<SetEintrag, 'id' | 'kiSystemId' | 'zusatz'>): string {
  if (e.kiSystemId) return `${e.id}-${e.kiSystemId}`;
  return e.zusatz ? e.id.replace(/-[^-]+$/, '') : e.id;
}

export function inhaltsverzeichnis(projekt: Projekt, texte: Texte, kataloge: Kataloge, sprache: Sprache, kitVersion: string, dateien: readonly SetEintrag[], heute: string): { mappe: XlsxMappe; name: string } {
  const u = erstelleUebersetzer(sprache, texte);
  const h = erstelleHelfer({ u, modus: 'firma', form: 'dokument', projekt, kataloge, kitVersion });
  const k = (s: string) => `allgemein.inhaltsverzeichnis.${s}`;
  const mitIsms = projekt.meta.mitIsms;
  const katalog = (id: string) => (kataloge.dokumente.dokumente as Dokument[]).find((d) => d.id === id);
  const ebs = ergaenzungsblaetter(kataloge);
  const gewaehlt = projekt.meta.gefuehrt.antworten?.['zertifizierung'] as { unterlagen?: string[] } | undefined;
  const stage1 = gewaehlt?.unterlagen ? new Set(gewaehlt.unterlagen.flatMap((x) => STAGE1_DOKUMENTE[x] ?? [])) : undefined;

  const zeile = (e: SetEintrag): Zellwert[] => {
    const id = registerId(e);
    const d = katalog(e.katalogId);
    const eb = e.form === 'ergaenzungsblatt';
    const system = e.kiSystemId ? projekt.kiSysteme.find((s) => s.id === e.kiSystemId) : undefined;
    const titel = `${dokumentTitel(u, kataloge, id)}${system ? ` (${system.id} ${system.name})` : ''}${e.zusatz ? `, ${e.zusatz}` : ''}`;
    // Generische Blätter (D-03-EB) mit dem Normbezug des Blatts, sonst der Bezug der Vorlage
    const ebKatalog = eb ? ebs.find((b) => b.id === id) : undefined;
    const normbezug = ebKatalog && !d?.eb ? normbezugText(ebKatalog.normbezug) : normbezugSprache(d?.normbezug ?? '', sprache);
    const eintrag = h.dokEintrag(id);
    const freigabe = h.dokFreigabe(id);
    const status = eintrag ? (u.tOpt(`gefuehrt.optionen.dokumentStatus.${eintrag.status}`) ?? eintrag.status) : freigabe?.am ? (u.tOpt('gefuehrt.optionen.dokumentStatus.freigegeben') ?? '') : u.t(k('nicht_im_register'));
    const freigabeText = freigabe?.am ? `${h.datum(freigabe.am)}, ${klartext(h.personText(freigabe.von))}` : '';
    // Für Stage 1: Vorlage gewählt; generische Zusatzblätter neben einem eigenen Dokument (D-03-EB) zählen nicht
    const vorlegen = stage1 === undefined ? '' : stage1.has(e.katalogId) && !(eb && !d?.eb) ? u.t(k('ja')) : u.t(k('nein'));
    // Ergänztes ISMS-Dokument: Eintrag «aufgenommen in» im Register, sonst die Bezeichnung aus dem Katalog der Blätter
    const blatt = ebKatalog ?? ebs.find((b) => b.vorlage === e.katalogId);
    const isms = eb ? eintrag?.aufgenommenIn?.trim() || (blatt ? (u.tOpt(`ergaenzungsblaetter.ismsDokumente.${blatt.ismsDokument}`) ?? '') : '') : '';
    return [id, titel, normbezug, e.dateiname, eintrag?.version ?? '', status, freigabeText, vorlegen, ...(mitIsms ? [isms] : [])];
  };

  const spalten: XlsxSpalte[] = [
    { kopf: u.t(k('spalten.id')), breite: 12 },
    { kopf: u.t(k('spalten.titel')), breite: 46, umbruch: true },
    { kopf: u.t(k('spalten.normbezug')), breite: 24, umbruch: true },
    { kopf: u.t(k('spalten.datei')), breite: 44, umbruch: true },
    { kopf: u.t(k('spalten.version')), breite: 9 },
    { kopf: u.t(k('spalten.status')), breite: 14 },
    { kopf: u.t(k('spalten.freigabe')), breite: 32, umbruch: true },
    { kopf: u.t(k('spalten.stage1')), breite: 12 },
    ...(mitIsms ? [{ kopf: u.t(k('spalten.isms')), breite: 40, umbruch: true }] : []),
  ];
  const titel = u.t(k('titel'));
  const firma = projekt.organisation.name;
  const mappe: XlsxMappe = {
    sprache,
    eigenschaften: { titel, autor: firma },
    lenkung: {
      dokumentId: '',
      titel,
      version: '',
      eigner: '',
      freigabeDurch: '',
      datum: h.datum(heute) ?? '',
      klassifikation: projekt.organisation.dokumentenlenkung?.klassifikation ?? '',
      normbezug: '',
      ismsBezug: '',
      pfad: '',
    },
    firmenname: firma,
    hinweisBlock: [],
    blaetter: [
      {
        name: u.t(k('blatt')),
        titel: u.t(k('blatt_titel'), { firma, datum: h.datum(heute) ?? heute }),
        hinweise: [u.t(stage1 ? k('hinweis') : k('hinweis_ohne_auswahl'))],
        spalten,
        zeilen: dateien.map(zeile),
        fixiert: true,
      },
    ],
  };
  return { mappe: gestaltungEinsetzen(mappe, projekt, 'firma'), name: `${u.t(k('datei'))}.xlsx` };
}

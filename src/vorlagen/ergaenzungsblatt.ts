// Generisches Ergänzungsblatt D-xx-EB für den Pfad «mit ISMS».
// Struktur: src/kataloge/ergaenzungsblaetter.yaml, Inhalte: src/i18n/<sprache>/ergaenzungsblaetter.yaml,
// Rahmentexte: src/i18n/<sprache>/vorlagen/ergaenzungsblatt.yaml.
// Gedacht vor allem für ISMS-Dokumente ohne eigene Kit-Vorlage (z. B. Informationssicherheitsleitlinie, D-03-EB).
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { Kataloge } from '../kataloge/typen.ts';
import { erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';

export interface ErgaenzungsblattEintrag {
  id: string; // D-03-EB
  vorlage: string; // D-03
  ismsDokument: string; // Schlüssel, z. B. isms-leitlinie
  normbezug: string[]; // K-5.2, A.2.2
  iso27001: string[]; // 27001-5.1
  abschnitte: string[];
  /** Eigener Dateistamm je Sprache, wenn der Titel der Vorlage irreführen würde (D-03-EB ergänzt die Sicherheitsleitlinie) */
  datei?: { de: string; en: string };
}

export function ergaenzungsblaetter(kataloge: Kataloge): ErgaenzungsblattEintrag[] {
  const k = kataloge['ergaenzungsblaetter'] as { blaetter?: ErgaenzungsblattEintrag[] } | undefined;
  return k?.blaetter ?? [];
}

export function ergaenzungsblattEintrag(kataloge: Kataloge, ebId: string): ErgaenzungsblattEintrag {
  const e = ergaenzungsblaetter(kataloge).find((b) => b.id === ebId);
  if (!e) throw new Error(`Unbekanntes Ergänzungsblatt ${ebId}`);
  return e;
}

/**
 * Dateistamm eines Ergänzungsblatts, eine Quelle für Kit (build.mts), Beispiele (beispiele.mts) und Werkzeug (Worker):
 * «D-04-EB_Rollen» aus dem Stamm der Vorlage, generische Blätter mit eigenem Stamm aus dem Katalog (D-03-EB_Sicherheitsleitlinie).
 */
export function ebDateistamm(kataloge: Kataloge, ebId: string, sprache: 'de' | 'en'): string {
  const eigen = ergaenzungsblaetter(kataloge).find((b) => b.id === ebId)?.datei?.[sprache];
  if (eigen) return eigen;
  const d = kataloge.dokumente.dokumente.find((x) => x.id === ebId.replace(/-EB$/, ''));
  return `${ebId}_${d ? d.datei[sprache].replace(/^D-\d+_/, '') : 'ISMS'}`;
}

/** Normbezug als lesbare Liste: K-5.2 -> 5.2 */
export function normbezugText(ids: string[]): string {
  return ids.map((i) => i.replace(/^K-/, '')).join(', ');
}

/** Absätze eines mehrzeiligen Texts (Leerzeile trennt). */
function absaetze(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((a) => a.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((a) => ({ typ: 'absatz', text: md(a) }) as Block);
}

/**
 * Die Abschnitte eines Ergänzungsblatts als Blöcke (Überschrift + Inhalt).
 * Wird auch von Kernvorlagen in der Form «ergaenzungsblatt» verwendet (D-21, D-26).
 */
export function ergaenzungsAbschnitte(ctx: VorlagenKontext, ebId: string, ebene: 1 | 2 = 1, startNr = 1): Block[] {
  const { u, kataloge } = ctx;
  const eintrag = ergaenzungsblattEintrag(kataloge, ebId);
  return eintrag.abschnitte.flatMap((a, i) => {
    const basis = `ergaenzungsblaetter.blaetter.${ebId}.abschnitte.${a}`;
    return [
      { typ: 'ueberschrift', ebene, text: `${startNr + i} ${u.t(`${basis}.titel`)}` } as Block,
      ...absaetze(u.t(`${basis}.inhalt`)),
    ];
  });
}

export function ergaenzungsblatt(ctx: VorlagenKontext, ebId: string): DocxDokument {
  const ebCtx: VorlagenKontext = { ...ctx, form: 'ergaenzungsblatt' };
  const h = erstelleHelfer(ebCtx);
  const { u, projekt, kataloge } = ebCtx;
  const k = (s: string) => `vorlagen.ergaenzungsblatt.${s}`;
  const eintrag = ergaenzungsblattEintrag(kataloge, ebId);
  const isms = u.t(`ergaenzungsblaetter.ismsDokumente.${eintrag.ismsDokument}`);
  const titel = u.t(`ergaenzungsblaetter.blaetter.${ebId}.titel`);
  const normbezug = normbezugText(eintrag.normbezug);
  const iso27001: Text = eintrag.iso27001.length
    ? eintrag.iso27001.map((c) => `${c.replace(/^27001-/, '')} ${h.normTitel(c)}`.trim()).join('; ')
    : u.t(k('felder.keine'));
  const ebHinweis = u.tOpt('ergaenzungsblaetter.hinweis');
  // Lenkungsangaben aus dem Dokumentenregister (Eintrag des Ergänzungsblatts, sonst der Hauptvorlage)
  const dok = h.istLeer ? undefined : h.dokEintrag(ebId);

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis(normbezug),
    ...(ebHinweis ? h.hinweis('ergaenzungsblaetter.hinweis') : []),
    {
      typ: 'absatz',
      text: h.istLeer
        ? md(u.t(k('einleitung'), { isms, vorlage: eintrag.vorlage, titel: u.t(`dokumente.${eintrag.vorlage}.titel`) }))
        : u.t(k('einleitung_firma'), { isms, firma: projekt.organisation.name }),
    },
    {
      typ: 'felder',
      felder: [
        { label: u.t(k('felder.isms_dokument')), wert: isms },
        { label: u.t(k('felder.isms_version')), wert: h.wert(dok?.aufgenommenIn, 'version') },
        { label: u.t(k('felder.normbezug')), wert: normbezug },
        { label: u.t(k('felder.iso27001')), wert: iso27001 },
      ],
    },
    ...h.hinweis(k('hinweis_abschnitt')),
    ...ergaenzungsAbschnitte(ebCtx, ebId),
    { typ: 'ueberschrift', ebene: 1, text: `${eintrag.abschnitte.length + 1} ${u.t(k('uebernahme_titel'))}` },
    { typ: 'absatz', text: u.t(k('uebernahme_text')) },
    {
      typ: 'felder',
      felder: [
        // «Übernommen in»: ISMS-Dokument mit Version (aufgenommenIn), nicht die Version dieses Blatts.
        // Leere Vorlage: Platzhalter; Firmendokument ohne Angabe: Feld weglassen.
        ...(h.istLeer || !leer(dok?.aufgenommenIn)
          ? [{ label: u.t(k('uebernahme_felder.version')), wert: h.wert(dok?.aufgenommenIn, 'version') }]
          : []),
        { label: u.t(k('uebernahme_felder.datum')), wert: h.wert(h.datum(dok?.freigabe?.am), 'datum') },
        { label: u.t(k('uebernahme_felder.durch')), wert: h.personText(dok?.freigabe?.von, 'freigabe') },
      ],
    },
  ];

  const lenkung = h.lenkung(ebId);
  return {
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(ebId) },
    lenkung: {
      ...lenkung,
      titel,
      normbezug: `ISO/IEC 42001: ${normbezug}`,
      // ISMS-Dokument mit Kennung und Version aus dem Register (aufgenommenIn), sonst die allgemeine Bezeichnung
      ismsBezug: u.t('allgemein.isms_dokument.erweitert', { dokument: dok?.aufgenommenIn?.trim() || isms }),
    },
    eigenschaften: { ...h.eigenschaften(ebId), titel: `${ebId} ${titel}` },
    bloecke,
  };
}

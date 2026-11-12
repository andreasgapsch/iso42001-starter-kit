// D-23 Integrationsmatrix ISO/IEC 27001 und 42001 (Leitfaden, Anhang D)
import type { XlsxBlatt, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { alleControls42001, dokumentImProjekt } from '../kataloge/typen.ts';
import { erstelleHelfer, normbezugSprache, NUR_ALS_EB_MIT_ISMS, type VorlagenKontext } from './kontext.ts';
import { ergaenzungsblaetter } from './ergaenzungsblatt.ts';

interface KapitelGemeinsam {
  abschnitte: { id: string; nummer: string; gegenstueck27001: string | null; gemeinsam: 'ja' | 'teilweise' | 'nein'; hinweis: string; vorlagen: string[] }[];
}
interface Mapping {
  zuordnungen: { id: string; verwandt: { control: string; staerke: 'hoch' | 'mittel' | 'tief'; begruendung: string }[] }[];
}
interface Katalog27001 {
  controls: { id: string; nummer: string; thema: string }[];
}

export function d23(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.D-23.${s}`;
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const kapitel = kataloge['kapitelGemeinsam'] as KapitelGemeinsam | undefined;
  const mapping = kataloge['mapping4200127001'] as Mapping | undefined;
  const katalog27001 = kataloge['controls27001'] as Katalog27001 | undefined;
  const titel27001 = (id: string) => h.normTitel(id);
  const nummer = (id: string) => id.replace(/^27001-/, '');
  const ebs = ergaenzungsblaetter(kataloge);
  const einschaetzung = u.t(k('hinweis_einschaetzung'));
  // Firmendokument: ISMS-Dokument mit Version, in das ein Ergänzungsblatt aufgenommen ist (dokumente[].aufgenommenIn)
  const aufgenommen = (id: string): string | undefined => (h.istLeer ? undefined : (h.dokEintrag(`${id}-EB`) ?? h.dokEintrag(id))?.aufgenommenIn?.trim() || undefined);

  // Dokumente. Leere Vorlage: alle Vorlagen mit Format, Art und Ergänzungsblatt (Aufbau des Kits). Firmendokument: die
  // Dokumente der Firma unter ihrer ID (D-04-EB statt D-04), ohne Modul-Dokumente bei ausgeschaltetem Modul, ohne die
  // Spalten zum Aufbau des Kits (Format, Art, Ergänzungsblatt)
  const katalogDokumente = kataloge.dokumente.dokumente.filter((d) => h.istLeer || dokumentImProjekt(d, projekt.meta, projekt.prozesse !== undefined));
  const dokZeilen: Zellwert[][] = katalogDokumente.flatMap((d): Zellwert[][] => {
    const eb = ebs.find((b) => b.vorlage === d.id);
    const ebText = eb ? `${u.t(k('ja'))}, ${eb.id}` : d.eb ? `${u.t(k('ja'))}, ${d.id}-EB` : u.t(k('nein'));
    const gegenstueck = (!h.istLeer && u.tOpt(k(`gegenstueck_firma.${d.id}`))) || (u.tOpt(k(`gegenstueck.${d.id}`)) ?? u.t(k('kein_gegenstueck')));
    if (h.istLeer) return [[d.id, u.t(`dokumente.${d.id}.titel`), d.format.toUpperCase(), u.t(k(`art.${d.art}`)), u.t(k(`isms.${d.isms}`)), gegenstueck, ebText, normbezugSprache(d.normbezug, u.sprache)]];
    // Bezug «Leitfaden» ist eine Angabe zur Vorlage; im Firmendokument ein eigenes Dokument ohne Gegenstück
    // Ein Ergänzungsblatt (Firma führt D-10 als D-10-EB) erweitert immer ein ISMS-Dokument
    const bezug = u.t(k(`isms.${d.isms === 'leitfaden' ? 'neu' : h.dokId(d.id).endsWith('-EB') && d.isms === 'neu' ? 'erweitert' : d.isms}`));
    const zeile: Zellwert[] = [h.dokId(d.id), u.t(`dokumente.${d.id}.titel`), bezug, d.isms === 'leitfaden' ? u.t(k('kein_gegenstueck')) : (aufgenommen(d.id) ?? gegenstueck), normbezugSprache(d.normbezug, u.sprache)];
    // Generische Ergänzungsblätter (z. B. D-03-EB, D-07-EB) neben dem Hauptdokument: eigene Zeile mit dem ISMS-Dokument
    const generisch: Zellwert[][] =
      projekt.meta.mitIsms && eb && !NUR_ALS_EB_MIT_ISMS.has(d.id)
        ? [[eb.id, u.t(`ergaenzungsblaetter.blaetter.${eb.id}.titel`), u.t(k('isms.erweitert')), h.dokEintrag(eb.id)?.aufgenommenIn?.trim() || gegenstueck, normbezugSprache(d.normbezug, u.sprache)]]
        : [];
    return [zeile, ...generisch];
  });
  const spD = u.liste(k('spalten_dokumente'));
  const dokumente: XlsxBlatt = {
    name: u.t(k('blaetter.dokumente')),
    titel: u.t(k('titel_dokumente')),
    hinweise: h.istLeer ? u.liste(k('hinweise_dokumente')) : u.liste(k('hinweise_dokumente')).slice(0, 1),
    fixiert: true,
    spalten: h.istLeer
      ? [text(spD[0]!, 8, false), text(spD[1]!, 40), text(spD[2]!, 8, false), text(spD[3]!, 14), text(spD[4]!, 16), text(spD[5]!, 40), text(spD[6]!, 16), text(spD[7]!, 24)]
      : [text(spD[0]!, 10, false), text(spD[1]!, 40), text(spD[4]!, 16), text(spD[5]!, 44), text(spD[7]!, 24)],
    zeilen: dokZeilen,
  };

  // Kapitel 4 bis 10
  // Firmendokument: statt des allgemeinen Hinweises die eigene Umsetzung (Dokument im Pfad der Firma, aufgenommen in …)
  const umsetzungBeiUns = (vorlagen: string[]): string =>
    vorlagen
      .map((v) => {
        const ziel = aufgenommen(v);
        // Ergänzungsblatt: aufgenommen in das ISMS-Dokument; eigenes Dokument mit Bezug «erweitert»: erweitert das ISMS-Dokument
        return ziel ? u.t(k(h.dokId(v).endsWith('-EB') ? 'kapitel_aufgenommen' : 'kapitel_erweitert'), { id: h.dokId(v), dokument: ziel }) : h.dokId(v);
      })
      .join('; ');
  const kapZeilen: Zellwert[][] = (kapitel?.abschnitte ?? []).map((a) => [
    a.nummer,
    (h.mitNormtext ? h.normTitel(a.id) : undefined) || (u.tOpt(`kapitel-gemeinsam.abschnitte.${a.id}.titel`) ?? u.t(`anforderungen42001.abschnitte.${a.id}.titel`)),
    a.gegenstueck27001 ?? u.t(k('kein_gegenstueck')),
    u.t(k(`gemeinsam.${a.gemeinsam}`)),
    h.istLeer ? (u.tOpt(`kapitel-gemeinsam.hinweise.${a.hinweis}`) ?? '').replace(/\s*\n\s*/g, ' ').trim() : umsetzungBeiUns(a.vorlagen),
    h.istLeer ? a.vorlagen.join(', ') : a.vorlagen.map((v) => h.dokId(v)).join(', '),
  ]);
  const spKFirma = h.istLeer ? u.liste(k('spalten_kapitel')) : u.liste(k('spalten_kapitel')).map((x, i) => (i === 4 ? u.t(k('spalte_umsetzung')) : x));
  const spK = u.liste(k('spalten_kapitel'));
  const kapitelBlatt: XlsxBlatt = {
    name: u.t(k('blaetter.kapitel')),
    titel: u.t(k('titel_kapitel')),
    hinweise: [...u.liste(k('hinweise_kapitel')), einschaetzung],
    fixiert: true,
    spalten: [text(spKFirma[0]!, 9, false), text(spKFirma[1]!, 32), text(spKFirma[2]!, 14), text(spKFirma[3]!, 11), text(spKFirma[4]!, 80), text(spKFirma[5]!, 14)],
    zeilen: kapZeilen,
    leereZeilen: kapZeilen.length ? 0 : 27,
  };

  // Control-Mapping 42001 -> 27001
  const verknuepft = (c42: string, c27: string): string => {
    const e = projekt.controls.find((c) => c.id === c42);
    return u.t(k(e?.iso27001.includes(c27) ? 'ja' : 'nein'));
  };
  const mitProjekt = !h.istLeer;
  const mapZeilen: Zellwert[][] = (mapping?.zuordnungen ?? []).flatMap((z) =>
    z.verwandt.map((v) => [
      z.id,
      h.normTitel(z.id),
      nummer(v.control),
      titel27001(v.control),
      u.t(k(`staerke.${v.staerke}`)),
      u.tOpt(`mapping.begruendung.${v.begruendung}`) ?? '',
      ...(mitProjekt ? [verknuepft(z.id, v.control)] : []),
    ]),
  );
  const leeresMapping: Zellwert[][] = alleControls42001(kataloge).map((c) => [c.id, h.normTitel(c.id), '', '', '', '']);
  const spM = u.liste(k('spalten_mapping'));
  const mappingBlatt: XlsxBlatt = {
    name: u.t(k('blaetter.mapping')),
    titel: u.t(k('titel_mapping')),
    // Zweiter Hinweis (ISO/IEC 27090 als zusätzliche Control-Quelle) nur in der leeren Vorlage
    hinweise: [einschaetzung, ...u.liste(k('hinweise_mapping')).slice(0, h.istLeer ? undefined : 1), ...(mitProjekt ? u.liste(k('hinweise_mapping_firma')) : [])],
    fixiert: true,
    spalten: [
      text(spM[0]!, 10, false),
      text(spM[1]!, 30),
      text(spM[2]!, 10, false),
      text(spM[3]!, 30),
      { kopf: spM[4]!, breite: 10, typ: 'liste', liste: Object.values(u.roh(k('staerke')) as Record<string, string>) },
      text(spM[5]!, 70),
      ...(mitProjekt ? [text(u.t(k('spalte_verknuepft')), 12, false)] : []),
    ],
    zeilen: mapZeilen.length ? mapZeilen : leeresMapping,
    leereZeilen: 5,
  };

  // Katalog 27001 mit Rückverweis
  const rueck = (c27: string) =>
    (mapping?.zuordnungen ?? [])
      .filter((z) => z.verwandt.some((v) => v.control === c27))
      .map((z) => z.id)
      .join(', ');
  // Firmendokument mit Normtexten der Firma: Control-Text aus ISO/IEC 27001 (eigene Ausgabe) als letzte Spalte
  const mit27001Text = h.mitNormtext && (katalog27001?.controls ?? []).some((c) => h.normAnforderung(c.id));
  const katZeilen: Zellwert[][] = (katalog27001?.controls ?? []).map((c) => [
    c.nummer,
    u.tOpt(`iso27001.themen.${c.thema}`) ?? c.thema,
    titel27001(c.id),
    rueck(c.id),
    ...(mit27001Text ? [h.normAnforderung(c.id) ?? ''] : []),
  ]);
  const spKat = u.liste(k('spalten_katalog'));
  const katalog: XlsxBlatt = {
    name: u.t(k('blaetter.katalog')),
    titel: u.t(k('titel_katalog')),
    hinweise: u.liste(k('hinweise_katalog')),
    fixiert: true,
    spalten: [text(spKat[0]!, 10, false), text(spKat[1]!, 18), text(spKat[2]!, 44), text(spKat[3]!, 40), ...(mit27001Text ? [text(u.t('allgemein.normtext.spalte_control_text'), 70)] : [])],
    zeilen: katZeilen,
    leereZeilen: katZeilen.length ? 0 : 93,
  };

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('D-23'),
    lenkung: h.lenkung('D-23'),
    firmenname: h.firmenname(),
    hinweisBlock: [
      ...h.kitBlock(),
      h.normverweis('4 bis 10, Anhang A'),
      { typ: 'hinweis', art: 'normverweis', text: u.t(k(h.istLeer ? 'normverweis_27001' : 'normverweis_27001_firma')) },
      // Inhaltliche Kennzeichnung, bleibt auch im Firmendokument stehen
      { typ: 'hinweis', art: 'normverweis', text: einschaetzung },
    ],
    blaetter: [dokumente, kapitelBlatt, mappingBlatt, katalog],
  });
}

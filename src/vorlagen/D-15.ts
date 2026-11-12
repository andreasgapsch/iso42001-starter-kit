// D-15 Richtlinie zur verantwortungsvollen KI-Nutzung (7.3, A.9.2 bis A.9.4), höchstens zwei Seiten
// Form «ergaenzungsblatt»: Abschnitte für eine bestehende Richtlinie zur akzeptablen Nutzung (D-15-EB)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { DATENKLASSEN, type KiStatus, type KiSystem } from '../model/typen.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));

export function d15(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-15.${s}`;
  const org = projekt.organisation;
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-15-EB' : 'D-15';
  const verantwortlich = alsMd(h.personText(org.aimsVerantwortlich, 'person'));
  const meldestelle = alsMd(h.meldestelle());
  // Freigegebene Richtlinie: Einladungen zum Ergänzen («und [[weitere eigene Kategorien]]») entfallen
  const festgelegt = !h.istLeer && h.dokEintrag(id)?.status === 'freigegeben';
  const ohneErgaenzung = (t: string) => (festgelegt ? t.replace(/,? (und|and) \[\[[^\]]+\]\]/g, '') : t);
  const liste = (s: string, nummeriert = false): Block => ({ typ: 'liste', nummeriert, punkte: u.liste(k(s)).map((p) => md(ohneErgaenzung(p))) });
  const absatz = (s: string, werte?: Record<string, string>): Block => ({ typ: 'absatz', text: md(u.t(k(s), { meldestelle, ...werte })) });
  const titel = (nr: number, s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${nr} ${u.t(k(`abschnitte.${s}`))}` });
  const modul = h.istLeer || projekt.meta.modulAiAct;

  // Ampel: Werkzeuge für Mitarbeitende aus dem KI-Inventar nach Status. Werkzeug heisst: eingekauft, als Dienst oder als
  // Schatten-KI genutzt und generativ (Chatbots, Assistenten, Übersetzer, Generatoren; ohne Angabe wie bisher ein Werkzeug).
  // Eigenentwicklungen und KI in Anlagen und Fachanwendungen (z. B. Kamerasystem, ERP-Funktion) stehen in je einem Satz
  // unter der Tabelle.
  const werkzeugSysteme = projekt.kiSysteme.filter((s) => s.typ !== 'eigenbau');
  const istWerkzeug = (s: KiSystem) => s.typ !== 'eigenbau' && s.generativ !== false;
  // Befristete Ausnahme (risiken[].ausnahme) für ein Werkzeug: späteste Frist, solange das Risiko noch behandelt wird
  // (offen oder in Behandlung); nach Abschluss der Behandlung gilt die Ausnahme nicht mehr
  const ausnahmeBis = (ki: string): string | undefined =>
    projekt.risiken
      .filter((r) => r.kiSystem === ki && r.ausnahme?.bis && (r.status === 'offen' || r.status === 'in-behandlung'))
      .map((r) => r.ausnahme!.bis)
      .sort()
      .at(-1);
  const inBetrieb = (s: KiSystem) => s.status === 'freigegeben' || s.status === 'eingeschraenkt';
  // Werkzeuge mit Ausnahme erscheinen nicht in Grün oder Gelb, sondern unter der Tabelle: Rot gilt sonst für sie (z. B. Gratisdienst)
  const ausnahmen = h.istLeer ? [] : werkzeugSysteme.filter((s) => istWerkzeug(s) && inBetrieb(s) && ausnahmeBis(s.id));
  const mitAusnahme = ausnahmen.length > 0;
  const eigeneSysteme = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.typ === 'eigenbau' && s.status !== 'abgeloest');
  const fachanwendungen = h.istLeer ? [] : werkzeugSysteme.filter((s) => !istWerkzeug(s) && inBetrieb(s));
  const klasse = (s: KiSystem) => (s.datenklasse ? u.liste('vorlagen.D-10.listen.datenklasse')[DATENKLASSEN.indexOf(s.datenklasse)] : undefined);
  const ampelWerkzeuge = (status: KiStatus[]) => (h.istLeer ? [] : werkzeugSysteme.filter((s) => istWerkzeug(s) && status.includes(s.status) && !ausnahmen.includes(s)));
  const werkzeuge = (status: KiStatus[], platzhalter: string): string => {
    const namen = ampelWerkzeuge(status).map((s) => (klasse(s) ? u.t(k('ampel.mit_klasse'), { name: s.name, klasse: klasse(s)! }) : s.name));
    if (namen.length) return namen.join(', ');
    // Inventar erfasst, aber kein System mit diesem Status: ausdrücklich «derzeit keine»
    return !h.istLeer && projekt.kiSysteme.length ? u.t(k('ampel.keine')) : `[[${u.t(k(platzhalter))}]]`;
  };
  const untersagt = h.istLeer ? [] : werkzeugSysteme.filter((s) => s.status === 'untersagt');
  const ampel: Text[][] = [
    [md(u.t(k('ampel.gruen'))), md(werkzeuge(['freigegeben'], 'ampel.gruen_platzhalter')), md(u.t(k('ampel.gruen_daten')))],
    [md(u.t(k('ampel.gelb'))), md(werkzeuge(['eingeschraenkt'], 'ampel.gelb_platzhalter')), md(u.t(k('ampel.gelb_daten')))],
    [
      md(u.t(k('ampel.rot'))),
      // Ohne untersagte Systeme im Inventar: nur die Regel für alle nicht freigegebenen Werkzeuge (N-37)
      md(
        (!h.istLeer && projekt.kiSysteme.length && !untersagt.length
          ? u.t(k('ampel.rot_werkzeuge_ohne'))
          : u.t(k('ampel.rot_werkzeuge'), { untersagt: untersagt.length ? untersagt.map((s) => s.name).join(', ') : `[[${u.t(k('ampel.rot_platzhalter'))}]]` })) +
          (mitAusnahme ? u.t(k('ampel.rot_ausser_ausnahmen')) : ''),
      ),
      md(u.t(k('ampel.rot_daten'))),
    ],
  ];

  // Control-IDs in Auflagen mit Kurztitel, z. B. «EC-01 Exportkontrolle bei generativer KI»
  const controlTitel = (id: string): string | undefined =>
    projekt.eigeneControls.find((c) => c.id === id)?.titel ?? u.tOpt(`euaia.${id}.name`) ?? u.tOpt(`nist.controls.${id}.titel`) ?? (/^A\./.test(id) ? h.normTitel(id) || undefined : undefined);
  const mitTiteln = (text: string): string => text.replace(/\b(EC-\d{2}|EUAIA-\d{2}|RMF-G?\d{2}|A\.\d+(?:\.\d+)+)\b/g, (id: string) => {
    const titel = controlTitel(id);
    return titel ? `${id} ${titel}` : id;
  });
  const auflagen = [...ampelWerkzeuge(['freigegeben']), ...ampelWerkzeuge(['eingeschraenkt'])].filter((s) => s.auflagen?.trim());
  const ampelBloecke = (nr: number): Block[] => [
    titel(nr, 'ampel'),
    absatz(mitAusnahme ? 'ampel_text_ausnahme' : 'ampel_text'),
    { typ: 'tabelle', kopf: u.liste(k('ampel_kopf')), zeilen: ampel, breiten: [18, 44, 38] },
    // Datenklassen: Klassifizierung des ISMS bzw. der Dokumentenlenkung, kurz erklärt
    absatz(!h.istLeer && projekt.meta.mitIsms ? 'datenklassen_isms' : 'datenklassen'),
    ...(auflagen.length
      ? [absatz('ampel_auflagen'), { typ: 'liste', punkte: auflagen.map((s) => md(`**${s.name}:** ${mitTiteln(s.auflagen!.trim()).replace(/\.?$/, '.')}`)) } as Block]
      : []),
    ...(mitAusnahme
      ? [
          absatz('ampel_ausnahmen'),
          { typ: 'liste', punkte: ausnahmen.map((s) => md(`**${u.t(k('ampel.ausnahme'), { name: s.name, bis: h.datum(ausnahmeBis(s.id))! })}:** ${mitTiteln(s.auflagen?.trim() || u.t(k('ampel.gelb_daten'))).replace(/\.?$/, '.')}`)) } as Block,
        ]
      : []),
    ...(fachanwendungen.length ? [absatz('ampel_fachanwendungen', { systeme: fachanwendungen.map((s) => s.name).join(', ') })] : []),
    ...(eigeneSysteme.length ? [absatz('ampel_eigene', { systeme: eigeneSysteme.map((s) => s.name).join(', ') })] : []),
  ];
  const eingabeBloecke = (nr: number): Block[] => [titel(nr, 'eingabe'), liste('eingabe_liste')];
  const verbotenBloecke = (nr: number): Block[] => [titel(nr, 'verboten'), liste('verboten_liste')];
  const pruefenBloecke = (nr: number): Block[] => [titel(nr, 'pruefen'), liste('pruefen_liste')];
  const kennzeichnungText = (): Block => ({
    typ: 'absatz',
    text: md(u.t(k('kennzeichnung_text')) + (modul ? ` ${u.t(k(h.istLeer ? 'modul_kennzeichnung_leer' : 'modul_kennzeichnung'))}` : '')),
  });
  // Sicher mit KI-Assistenten arbeiten (ab rc.2): Merksätze und vier Regeln
  const assistentenBloecke = (nr: number): Block[] => [titel(nr, 'assistenten'), absatz('assistenten_merksaetze'), liste('assistenten_regeln')];
  const neuBloecke = (nr: number): Block[] => [titel(nr, 'neu'), ((st) => (st ? absatz('neu_text_firma', { verantwortlich, ...st }) : absatz('neu_text', { verantwortlich })))(h.einfuehrungsStellen()), liste('neu_schritte', true)];

  const bloecke: Block[] = eb
    ? [
        ...h.kitBlock(),
        h.normverweis('7.3, A.9.2 bis A.9.4'),
        ...h.hinweis(k('hinweis_eb')),
        { typ: 'absatz', text: md(u.t(k('einleitung_eb'))) },
        // Firmendokument: ergänztes Dokument mit Version, wie bei den übrigen Ergänzungsblättern
        ...(h.istLeer
          ? []
          : [
              {
                typ: 'felder',
                felder: [{ label: u.t(k('eb_aufgenommen')), wert: h.dokEintrag(id)?.aufgenommenIn?.trim() || ([{ text: u.t(k('eb_aufgenommen_platzhalter')), platzhalter: true }] as Text) }],
              } as Block,
            ]),
        ...ampelBloecke(1),
        ...eingabeBloecke(2),
        titel(3, 'pruefen_eb'),
        liste('pruefen_liste'),
        kennzeichnungText(),
        ...assistentenBloecke(4),
        ...neuBloecke(5),
        titel(6, 'verboten'),
        liste('verboten_liste'),
        absatz('urheberrecht_text'),
        absatz('schluss_eb', { verantwortlich }),
      ]
    : [
        ...h.kitBlock(),
        h.normverweis('7.3, A.9.2 bis A.9.4'),
        ...h.hinweis(k('hinweis_umfang')),
        { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
        ...ampelBloecke(1),
        ...eingabeBloecke(2),
        ...verbotenBloecke(3),
        ...pruefenBloecke(4),
        ...assistentenBloecke(5),
        titel(6, 'kennzeichnung'),
        kennzeichnungText(),
        absatz('urheberrecht_text'),
        ...neuBloecke(7),
        titel(8, 'melden'),
        absatz('melden_text'),
        titel(9, 'schulung'),
        absatz('schulung_text', { verantwortlich }),
      ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(id) },
    lenkung: h.lenkung(id),
    eigenschaften: h.eigenschaften(id),
    bloecke,
  });
}

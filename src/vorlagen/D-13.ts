// D-13 Daten für KI-Systeme (A.7, A.4.3): Pflichtfassung für Betreiber, Ausbaustufe Entwicklung
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';
import { ablageVon, vorgabenFueller } from './vorgaben.ts';

/** Controls der Ausbaustufe Entwicklung (für Betreiber meist nicht anwendbar) */
const CONTROLS_ENTWICKLUNG = ['A.7.2', 'A.7.3', 'A.7.5', 'A.7.6'];
/** Controls, die nur für eigene Trainings- und Testdaten gelten; A.7.5 (Herkunft) kann auch Betreiber betreffen */
const CONTROLS_KERN = ['A.7.2', 'A.7.3', 'A.7.6'];

const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));

export function d13(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-13.${s}`;
  const org = projekt.organisation;
  const verantwortlich = alsMd(h.personText(org.aimsVerantwortlich, 'person'));
  // Datenverantwortung aus der Zuständigkeitsmatrix (Bereich «daten», D-04) statt der AIMS-Verantwortung (N-19):
  // für die Regeln als Ganzes die Rechenschaft, für Daten in der Entwicklung die verantwortliche Person
  const datenRechenschaft = h.rollenPerson('daten', 'rechenschaft');
  const datenVerantwortlich = h.rollenPerson('daten') ?? h.rollenPerson('entwicklung');
  const geltungVerantwortlich = datenRechenschaft ? alsMd(h.personText(datenRechenschaft)) : verantwortlich;
  const entwicklungVerantwortlich = h.istLeer
    ? verantwortlich
    : datenVerantwortlich && h.person(datenVerantwortlich)
      ? alsMd(h.personText(datenVerantwortlich))
      : u.t(k('rolle_daten'));
  // Vorgaben und Platzhalter mit Projektdaten (Regel in vorgaben.ts); Datenschutz: verantwortliche Person der Rolle datenschutz
  const datenschutz = projekt.rollen.find((r) => r.bereich === 'datenschutz')?.verantwortlich;
  const fuelle = vorgabenFueller(ctx, h, 'D-13', {
    ablage: ablageVon(ctx, h, 'D-13'),
    weitere: { [u.t(k('platzhalter_datenschutz'))]: datenschutz ? alsMd(h.personText(datenschutz)) : undefined },
  });
  const tabelle = (s: string, breiten: number[]): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k(`${s}_kopf`)),
    zeilen: (u.roh(k(`${s}_tabelle`)) as string[][]).map((z) => z.map((zelle) => md(fuelle(zelle)))),
    breiten,
  });
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(fuelle(p))) });
  const absatz = (s: string, werte?: Record<string, string>): Block => ({ typ: 'absatz', text: md(fuelle(u.t(k(s), werte))) });

  // Eingabedaten je System aus dem Inventar; abgelöste Systeme entfallen, untersagte und ausgesetzte stehen mit Status
  // (untersagt: keine Eingaben erlaubt)
  const personendaten = (p?: boolean, b?: boolean) => (p === undefined ? '' : u.t(k(`personendaten.${b ? 'besondere' : p ? 'ja' : 'nein'}`)));
  const systemZeilen: Text[][] = h.istLeer
    ? []
    : projekt.kiSysteme.filter((s) => s.status !== 'abgeloest').map((s) => [
        `${s.id} ${s.name}${s.status === 'untersagt' || s.status === 'ausgesetzt' ? ` (${u.t('allgemein.ki_status_vermerk', { status: u.t(`allgemein.ki_status.${s.status}`) })})` : ''}`,
        leer(s.ressourcen.daten) ? h.wert(undefined, 'text') : s.ressourcen.daten,
        personendaten(s.personendaten, s.besondereDaten),
        // Anforderung je System (KiSystem.datenqualitaet, N-20); sonst gelten im freigegebenen Dokument die Kriterien der
        // Tabelle unten (Regel in vorgaben.ts)
        s.status === 'untersagt'
          ? u.t(k('qualitaet_untersagt'))
          : s.datenqualitaet?.trim()
            ? u.t(k('qualitaet_system'), { anforderung: s.datenqualitaet.trim().replace(/[.;]+$/, '') })
            : h.dokEintrag('D-13')?.status === 'freigegeben'
              ? u.t(k('qualitaet_standard'))
              : h.wert(undefined, 'text'),
      ]);

  // Abschnitt 5 im Firmendokument nach der Erklärung zur Anwendbarkeit (D-11): nur, wenn ein Control zu Daten für die
  // Entwicklung anwendbar ist, und nur mit den Unterabschnitten anwendbarer Controls. Ohne Entscheid in D-11: wenn das
  // Unternehmen entwickelt oder Systeme selbst trainiert.
  // Ohne eigene Trainings- und Testdaten (keine Eigenentwicklung, kein eigenes Training) entfällt Abschnitt 5, auch wenn
  // einzelne Controls (A.7.3, A.7.5 für Eingabedaten) anwendbar sind; diese regelt dann Abschnitt 6.
  const soa = h.soaEntscheid(CONTROLS_KERN);
  const eigeneDaten = org.entwickeltKi || org.verkauftKiProdukte || projekt.kiSysteme.some((s) => s.typ === 'eigenbau' || s.eigenesTraining === true);
  const entwicklung = h.istLeer || (eigeneDaten && soa !== 'nein');

  const datenblatt = (u.roh(k('datenblatt_tabelle')) as string[][]).map(([angabe, eintrag]) => [md(angabe!), md(eintrag!)]);

  // Firmendokument: statt eines leeren Datenblatts die Trainings- und Testdaten der eigenen Systeme aus dem Inventar
  // (ressourcen.daten); die Datenblätter je Datensatz liegen in der Ablage. Ohne eigene Systeme entfällt das Datenblatt.
  // Eigene Trainings- und Testdaten: Eigenentwicklungen und eingekaufte Systeme, die wir nachtrainieren oder anpassen (N-20)
  const eigene = h.istLeer
    ? []
    : projekt.kiSysteme.filter((s) => (s.typ === 'eigenbau' || s.eigenesTraining === true) && s.status !== 'abgeloest' && s.status !== 'untersagt');
  const datenblattBloecke: Block[] = h.istLeer
    ? [{ typ: 'tabelle', kopf: u.liste(k('datenblatt_kopf')), zeilen: datenblatt, breiten: [38, 62] }]
    : eigene.length
      ? [
          { typ: 'absatz', text: md(fuelle(u.t(k('datenblatt_firma'), { ablage: ablageVon(ctx, h, 'D-13') ?? `[[${u.t('allgemein.platzhalter.ort')}]]` }))) },
          {
            typ: 'tabelle',
            kopf: u.liste(k('datenblatt_systeme_kopf')),
            zeilen: eigene.map((s) => [`${s.id} ${s.name}`, h.wert(s.ressourcen.daten, 'text'), s.datenqualitaet?.trim() || u.t(k('qualitaet_standard'))]),
            breiten: [24, 50, 26],
          },
        ]
      : [absatz('datenblatt_entfaellt')];

  // Unterabschnitt mit seinen Controls; entfällt im Firmendokument, wenn D-11 alle diese Controls ausschliesst
  const teile = [
    { controls: ['A.7.2'], titel: u.t(k('unterabschnitte.management')), inhalt: [absatz('management_text', { verantwortlich: entwicklungVerantwortlich }), liste('management_regeln')] },
    { controls: ['A.7.3', 'A.7.5'], titel: u.t(k('unterabschnitte.beschaffung')), inhalt: [absatz('beschaffung_text'), liste('beschaffung_regeln')] },
    { controls: ['A.7.6'], titel: u.t(k('unterabschnitte.aufbereitung')), inhalt: [absatz('aufbereitung_text'), liste('aufbereitung_schritte')] },
    { controls: [], titel: u.t(k('unterabschnitte.datenblatt')), inhalt: [...h.hinweis(k('hinweis_datenblatt')), ...datenblattBloecke] },
  ].map((t) => ({ ...t, gilt: !t.controls.length || h.soaEntscheid(t.controls) !== 'nein' }));
  const ausgeschlossen = teile.filter((t) => !t.gilt).flatMap((t) => t.controls);
  // Ohne eigene Trainingsdaten, aber mit anwendbarem A.7.3 oder A.7.5: Herkunft und Rechte der Eingabedaten als Abschnitt 6
  const herkunftControls = h.istLeer || entwicklung ? [] : ['A.7.3', 'A.7.5'].filter((c) => h.soaEntscheid([c]) === 'ja');
  const herkunftOhneEntwicklung = herkunftControls.length > 0;
  const ausgeschlossenOhneEntwicklung = CONTROLS_ENTWICKLUNG.filter((c) => !herkunftControls.includes(c) && (h.istLeer || h.soaEntscheid([c]) !== 'ja'));
  const entwicklungBloecke: Block[] = [
    ...teile
      .filter((t) => t.gilt)
      .flatMap((t, i): Block[] => [
        { typ: 'ueberschrift', ebene: 2, text: `5.${i + 1} ${t.titel}${t.controls.length ? ` (${t.controls.join(', ')})` : ''}` },
        ...t.inhalt,
      ]),
    ...(ausgeschlossen.length ? [absatz('entwicklung_teilweise', { controls: ausgeschlossen.join(', ') })] : []),
  ];

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('A.4.3, A.7.2 bis A.7.6'),
    ...h.hinweis(k('hinweis_umfang')),
    { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },

    { typ: 'ueberschrift', ebene: 1, text: `1 ${u.t(k('abschnitte.geltung'))}` },
    absatz('geltung_text', { verantwortlich: geltungVerantwortlich }),

    { typ: 'ueberschrift', ebene: 1, text: `2 ${u.t(k('abschnitte.qualitaet'))} (A.7.4)` },
    absatz('qualitaet_text'),
    ...(!h.istLeer && projekt.kiSysteme.length === 0 ? h.hinweis(k('systeme_fehlen'), true) : []),
    ...h.systemAnlage(
      u.t(k('abschnitte.qualitaet')),
      [{ typ: 'tabelle', kopf: u.liste(k('systeme_kopf')), zeilen: systemZeilen, breiten: [22, 32, 18, 28], leereZeilen: systemZeilen.length ? 0 : 2 }],
      systemZeilen.length,
    ),
    absatz('kriterien_text'),
    tabelle('kriterien', [20, 46, 34]),
    absatz('wissensbasis_text'),

    { typ: 'ueberschrift', ebene: 1, text: `3 ${u.t(k('abschnitte.vertraulichkeit'))}` },
    absatz('vertraulichkeit_text'),
    ...h.hinweis(k('hinweis_klassen')),
    tabelle('klassen', [26, 74]),
    absatz('ableitungen_text'),
    absatz('datenschutz_text'),

    { typ: 'ueberschrift', ebene: 1, text: `4 ${u.t(k('abschnitte.verboten'))}` },
    absatz('verboten_text'),
    liste('verboten_liste'),
    absatz('verboten_versehen'),

    { typ: 'ueberschrift', ebene: 1, text: `5 ${u.t(k('abschnitte.entwicklung'))}` },
    // Firmendokument: Geltung des Abschnitts als Satz statt Kasten «Ausbaustufe»
    ...(entwicklung
      ? [...(h.istLeer ? [] : [absatz('entwicklung_geltung')]), ...h.ausbau(k('ausbau_entwicklung'), entwicklungBloecke)]
      : [absatz('entwicklung_entfaellt', { controls: ausgeschlossenOhneEntwicklung.join(', ') })]),
    ...(herkunftOhneEntwicklung
      ? [{ typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('abschnitte.herkunft'))} (${herkunftControls.join(', ')})` } as Block, absatz('herkunft_eingabedaten'), liste('beschaffung_regeln')]
      : []),
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-13') },
    lenkung: h.lenkung('D-13'),
    eigenschaften: h.eigenschaften('D-13'),
    bloecke,
  });
}

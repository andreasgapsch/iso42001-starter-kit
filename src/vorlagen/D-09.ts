// D-09 Folgenabschätzung für ein KI-System (6.1.4, 8.4, A.5.3 bis A.5.5), je System (ctx.kiSystemId)
// Teil A Kurzprüfung auf Seite 1, Teil B vollständige Abschätzung (in leeren Vorlagen immer sichtbar), Teil C Ergebnis und Freigabe.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { NUTZEN_SCHADEN_ZIELE } from '../model/typen.ts';
import { TRIAGE_FRAGEN } from './D-08.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

const KI_TYPEN = ['eingekauft', 'saas', 'eigenbau', 'schatten'] as const;

export function d09(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-09.${s}`;

  const sys = h.istLeer ? undefined : projekt.kiSysteme.find((s) => s.id === ctx.kiSystemId);
  const ia = sys ? projekt.folgenabschaetzungen.find((f) => f.kiSystem === sys.id) : undefined;
  const eingekauft = sys?.typ === 'eingekauft' || sys?.typ === 'saas';

  const ph = (text: string): Text => [{ text, platzhalter: true }];
  const jaNein = (v: boolean | undefined): Text => (v === undefined ? ph(`${u.t('allgemein.ja')}/${u.t('allgemein.nein')}`) : u.t(v ? 'allgemein.ja' : 'allgemein.nein'));
  const text = (v: string | undefined): Text => h.wert(v, 'text');
  const datum = (iso: string | undefined): Text => h.wert(h.datum(iso), 'datum');
  const feld = (label: string, wert: Text) => ({ label, wert });
  let nrB = 0;
  const b = (s: string): Block => ({ typ: 'ueberschrift', ebene: 2, text: `B.${++nrB} ${u.t(k(`b.${s}`))}` });
  const typen = u.liste('vorlagen.D-10.listen.typ');

  // Teil A: Kurzprüfung
  const triage = ia?.triage;
  const voll: Text = !triage || triage.ergebnis === 'offen' ? jaNein(undefined) : u.t(triage.ergebnis === 'voll' ? 'allgemein.ja' : 'allgemein.nein');
  // Kurzprüfung durchgeführt von/am (triage.durch, triage.am)
  const durchPerson = triage?.durch ? h.personText(triage.durch) : undefined;
  const durchAm: Text =
    !h.istLeer && typeof durchPerson === 'string' && triage?.am
      ? `${durchPerson}, ${h.datum(triage.am)}`
      : ph(`${typeof durchPerson === 'string' ? durchPerson : u.t('allgemein.platzhalter.person')}, ${h.datum(triage?.am) ?? u.t('allgemein.platzhalter.datum')}`);
  const teilA: Block[] = [
    { typ: 'ueberschrift', ebene: 1, text: u.t(k('teil_a')) },
    {
      typ: 'felder',
      felder: [
        feld(u.t(k('kopf.system')), sys ? `${sys.id} ${sys.name}${ia ? ` (${ia.id})` : ''}` : ph(u.t('allgemein.platzhalter.ki_system'))),
        feld(u.t(k('kopf.eigner')), h.personText(sys?.eigner, 'person')),
        feld(u.t(k('kopf.fachbereich')), text(sys ? (u.tOpt(`gefuehrt.optionen.fachbereich.${sys.fachbereich}`) ?? sys.fachbereich) : undefined)),
        feld(u.t(k('kopf.typ')), sys ? typen[KI_TYPEN.indexOf(sys.typ)]! : ph(typen.join(' / '))),
      ],
    },
    {
      typ: 'tabelle',
      kopf: u.liste(k('triage_kopf')),
      zeilen: TRIAGE_FRAGEN.map((f, i) => [String(i + 1), u.t(`vorlagen.D-08.triage.fragen.${f}`), jaNein(triage?.[f])]),
      breiten: [5, 83, 12],
    },
    {
      typ: 'felder',
      felder: [
        feld(u.t(k('triage_ergebnis.voll')), voll),
        feld(u.t(k('triage_ergebnis.begruendung')), text(triage?.begruendung)),
        feld(u.t(k('triage_ergebnis.durch')), durchAm),
      ],
    },
  ];

  // Teil B: vollständige Abschätzung (leer: immer; firma: wenn nötig oder noch offen)
  const zeigeB = h.istLeer || !triage || triage.ergebnis !== 'kurz';
  const datenWert: Text = ia?.daten?.trim() ? ia.daten : eingekauft ? ph(u.t(k('daten_lieferant'))) : text(undefined);
  const betroffeneZeilen: Text[][] = (ia?.betroffene ?? []).map((g) => [
    g.gruppe,
    u.t(k(`betroffene_art.${g.art}`)),
    g.wirkung,
    u.t(g.konsultiert ? 'allgemein.ja' : 'allgemein.nein'),
  ]);
  if (!betroffeneZeilen.length && sys?.betroffene.trim()) betroffeneZeilen.push([sys.betroffene, '', '', '']);
  // Ausmass des Schadens auf der Auswirkungsskala aus D-06 (organisation.risikokriterien), wie in D-08 festgelegt; mit Bezeichnung der Stufe
  const skala = projekt.organisation.risikokriterien.auswirkung;
  const ausmass = (n: number | null | undefined): string => {
    if (h.istLeer || n === null || n === undefined) return '';
    const stufe = skala.find((x) => x.stufe === n)?.bezeichnung;
    return stufe ? `${n} ${stufe}` : String(n);
  };
  const zielZeilen: Text[][] = NUTZEN_SCHADEN_ZIELE.map((z) => {
    const ns = ia?.nutzenSchaden[z];
    const name = u.t(k(`ziele.${z}.name`));
    return [h.istLeer ? md(`**${name}:** ${u.t(k(`ziele.${z}.frage`))}`) : name, ns?.nutzen ?? '', ns?.schaden ?? '', ausmass(ns?.ausmass)];
  });
  // Modell: bei Eigenentwicklungen und bei Systemen, die wir selbst trainieren oder nachtrainieren (eigenesTraining).
  // Eigene Trainingsdaten (ressourcen.daten) nur mit eigenem Training; das Training eines fremden Grundmodells
  // (eingekauft, SaaS oder Eigenentwicklung auf einem vortrainierten Modell, eigenesTraining false) beschreibt der Anbieter.
  const eigenesTraining = sys ? (sys.eigenesTraining ?? sys.typ === 'eigenbau') : false;
  const fremdesModell = !!sys && (sys.typ !== 'eigenbau' || sys.eigenesTraining === false);
  const modellZeigen = h.istLeer || sys?.typ === 'eigenbau' || eigenesTraining;
  const anbieter = sys?.lieferant ? projekt.lieferanten.find((l) => l.id === sys.lieferant) : undefined;
  const modellWerte: Record<string, string | undefined> = h.istLeer
    ? {}
    : {
        modell_typ: sys?.ressourcen.werkzeuge,
        modell_training: eigenesTraining ? sys?.ressourcen.daten : undefined,
        modell_grundmodell: fremdesModell
          ? [
              u.t(k(eigenesTraining ? 'grundmodell_nachtraining' : 'grundmodell_ohne_training')),
              anbieter ? u.t(k('grundmodell_anbieter'), { anbieter: `${anbieter.id} ${anbieter.name}` }) : '',
              '.',
            ].join('')
          : undefined,
      };
  const modellFelder = ['modell_typ', 'modell_grundmodell', 'modell_training', 'modell_grenzen', 'modell_tests']
    .filter((f) => (h.istLeer ? f !== 'modell_grundmodell' : modellWerte[f]?.trim()))
    .map((f) => feld(u.t(k(f === 'modell_training' && fremdesModell ? 'felder.modell_training_eigen' : `felder.${f}`)), text(modellWerte[f])));

  const teilB: Block[] = zeigeB
    ? [
        { typ: 'ueberschrift', ebene: 1, text: u.t(k('teil_b')) },
        ...h.hinweis(k('hinweis_teil_b')),
        b('beschreibung'),
        ...h.hinweis(k('hinweis_beschreibung')),
        { typ: 'absatz', text: text(ia?.systembeschreibung || sys?.beschreibung) },
        b('zweck'),
        ...h.hinweis(k('hinweis_zweck')),
        {
          typ: 'felder',
          felder: [
            feld(u.t(k('felder.zweck')), text(sys?.zweck)),
            feld(u.t(k('felder.verwendungen')), text(ia?.verwendungen)),
            feld(u.t(k('felder.fehlanwendungen')), text(ia?.fehlanwendungen)),
          ],
        },
        b('daten'),
        ...h.hinweis(k('hinweis_daten')),
        { typ: 'absatz', text: datenWert },
        ...(modellZeigen
          ? [
              b('modell'),
              // Firmendokument: Modell und Trainingsdaten aus den Ressourcen des Systems (ressourcen.werkzeuge, .daten);
              // Grenzen und Tests haben kein eigenes Modellfeld und erscheinen nur in der leeren Vorlage.
              // Die Kennzeichnung «Ausbaustufe» ist ein Ausfüllhinweis und steht nur in der leeren Vorlage.
              ...(h.istLeer
                ? h.ausbau(k('ausbau_modell'), [{ typ: 'felder', felder: modellFelder } as Block])
                : modellFelder.length
                  ? [{ typ: 'felder', felder: modellFelder } as Block]
                  : []),
            ]
          : []),
        b('umfeld'),
        ...h.hinweis(k('hinweis_umfeld')),
        { typ: 'absatz', text: text(ia?.einsatzumfeld) },
        b('betroffene'),
        ...h.hinweis(k('hinweis_betroffene')),
        // Prüfraster verletzliche Gruppen: Gedankenstütze nur in der leeren Vorlage
        ...h.hinweis(k('hinweis_verletzliche')),
        { typ: 'tabelle', kopf: u.liste(k('betroffene_kopf')), zeilen: betroffeneZeilen, breiten: [30, 16, 40, 14], leereZeilen: h.istLeer || !betroffeneZeilen.length ? 3 : 0 },
        b('nutzen'),
        ...h.hinweis(k('hinweis_nutzen')),
        { typ: 'tabelle', kopf: u.liste(k('nutzen_kopf')).map((x) => x.replace('{skala}', h.skala('auswirkung').vonBis)), zeilen: zielZeilen, breiten: h.istLeer ? [40, 25, 25, 10] : [22, 34, 34, 10] },
        b('gesellschaft'),
        ...h.hinweis(k('hinweis_gesellschaft')),
        { typ: 'absatz', text: text(ia?.gesellschaft) },
        b('ausfaelle'),
        ...h.hinweis(k('hinweis_ausfaelle')),
        { typ: 'absatz', text: text(ia?.ausfaelle) },
        b('massnahmen'),
        ...h.hinweis(k('hinweis_massnahmen')),
        { typ: 'absatz', text: text(ia?.massnahmen) },
      ]
    : [];

  // Neubeurteilungen (Folgenabschaetzung.neubeurteilungen), älteste zuerst
  const neubeurteilungen = h.istLeer ? [] : [...(ia?.neubeurteilungen ?? [])].sort((a, b) => a.am.localeCompare(b.am));
  // Teil C: Ergebnis und Freigabe
  // Verknüpfte DSFA (verknuepfteDsfa) und Grundrechte-Folgenabschätzung (fria.ref, AI-Act-Modul E-06)
  const verknuepft = [
    ia?.verknuepfteDsfa?.trim(),
    ia?.fria?.ref?.trim() ? u.t(k('fria_ref'), { ref: ia.fria.ref }) : ia?.fria?.erforderlich === 'nein' ? u.t(k('fria_nicht_noetig')) : undefined,
  ].filter((x): x is string => !!x);
  // Einsatzentscheid (KiSystem.einsatzentscheid) und Mitwirkende (Folgenabschaetzung.mitgewirkt), ab rc.2
  const ee = sys?.einsatzentscheid;
  const mitgewirkt = (ia?.mitgewirkt ?? [])
    .map((m) => (h.person(m) ? h.klartext(h.personText(m)) : m))
    .filter((m) => m.trim());
  // Firmendokument: nur erfasste Angaben (fehlende meldet die Prüfregel zum Einsatzentscheid); leere Vorlage: alle Felder
  const einsatzWerte: [string, string | undefined][] = [
    ['nutzen', ee?.nutzen?.trim()],
    ['alternative', ee?.alternativeOhneKi?.trim()],
    ['wiedervorlage', h.datum(ee?.wiedervorlage)],
    ['mitgewirkt', mitgewirkt.join('; ')],
  ];
  const einsatzFelder = {
    typ: 'felder',
    felder: einsatzWerte.filter(([, w]) => h.istLeer || !!w).map(([f, w]) => feld(u.t(k(`einsatz.${f}`)), f === 'wiedervorlage' ? datum(ee?.wiedervorlage) : text(w))),
  } as Block;
  const mitEinsatz = h.istLeer || einsatzWerte.some(([, w]) => !!w);
  // Leere Vorlage und Kurzprüfung: in Teil C; vollständige Abschätzung im Firmendokument: Anlage am Ende (Seitenlimit)
  const einsatzInAnlage = !h.istLeer && zeigeB && mitEinsatz;
  const einsatzBloecke: Block[] = mitEinsatz
    ? [{ typ: 'ueberschrift', ebene: 2, text: u.t(k('einsatz.titel')) }, ...h.hinweis(k('hinweis_einsatz')), einsatzFelder]
    : [];
  const teilC: Block[] = [
    { typ: 'ueberschrift', ebene: 1, text: u.t(k('teil_c')) },
    ...h.hinweis(k('hinweis_ergebnis')),
    {
      typ: 'felder',
      felder: [
        feld(u.t(k('c.ergebnis')), ia?.ergebnis?.trim() ? ia.ergebnis : ph(u.t(k('platzhalter_entscheid')))),
        feld(u.t(k('c.eingeschraenkt')), jaNein(ia?.eingeschraenkteNutzung)),
        feld(u.t(k('c.dsfa')), verknuepft.length ? verknuepft.join('; ') : ph(u.t(k('platzhalter_dsfa')))),
        feld(u.t(k('c.naechste')), datum(ia?.naechsteUeberpruefung ?? sys?.naechsteUeberpruefung)),
        // Freigabe der aktuellen Fassung: letzte Neubeurteilung mit Freigabe, sonst die Freigabe der Abschätzung (wie im Kopf)
        feld(u.t(k('c.freigabe_durch')), h.personText(([...(ia?.neubeurteilungen ?? [])].reverse().find((n) => n.freigabe?.am)?.freigabe ?? ia?.freigabe)?.von, 'freigabe')),
        feld(u.t(k('c.freigabe_am')), datum(([...(ia?.neubeurteilungen ?? [])].reverse().find((n) => n.freigabe?.am)?.freigabe ?? ia?.freigabe)?.am)),
      ],
    },
    ...(einsatzInAnlage ? [{ typ: 'absatz', text: u.t(k('einsatz.verweis')) } as Block] : einsatzBloecke),
    // Modul NIST AI RMF (ab rc.2): Vertrauensmerkmale und Zielkonflikte (RMF-01) als Verweis auf N-03
    ...(h.istLeer || projekt.meta.modulNistRmf
      ? [
          {
            typ: 'absatz',
            text: md(
              `**${u.t(k(h.istLeer ? 'nist.praefix_leer' : 'nist.praefix'))}** ${
                sys?.messkonzept?.merkmale?.length
                  ? u.t(k('nist.merkmale'), {
                      merkmale: sys.messkonzept.merkmale.map((m) => u.tOpt(`nist.merkmale.${m}.titel`) ?? m).join(', '),
                      konflikte: sys.messkonzept.zielkonflikte?.trim() ? ` ${u.t(k('nist.konflikte'), { text: sys.messkonzept.zielkonflikte.trim().replace(/\.$/, '') })}` : '',
                    })
                  : u.t(k(h.istLeer ? 'nist.verweis_leer' : 'nist.verweis'))
              }`,
            ),
          } as Block,
        ]
      : []),
    // Durchführung und Freigabe (Vier-Augen-Prinzip) aus der Abschätzung statt «Name, Funktion»; leer: eine Zeile
    ...(neubeurteilungen.length ? [{ typ: 'absatz', text: u.t(k('c.unterschrift_erste_fassung')) } as Block] : []),
    h.unterschriften([ia?.triage.durch ? { von: ia.triage.durch, am: ia.triage.am ?? '' } : undefined, ia?.freigabe]),
    // Neubeurteilungen nach der ersten Freigabe (8.4): je Datum, Person, Anlass, Ergebnis und Freigabe, mit Unterschriften
    ...(neubeurteilungen.length
      ? [
          { typ: 'ueberschrift', ebene: 2, text: u.t(k('neubeurteilung.titel')) } as Block,
          {
            typ: 'tabelle',
            kopf: u.liste(k('neubeurteilung.kopf')),
            zeilen: neubeurteilungen.map((n) => [
              h.datum(n.am) ?? '',
              n.durch ? h.personText(n.durch) : '',
              n.anlass,
              n.ergebnis,
              n.freigabe?.von ? `${typeof h.personText(n.freigabe.von) === 'string' ? h.personText(n.freigabe.von) : n.freigabe.von}, ${h.datum(n.freigabe.am) ?? ''}` : '',
            ]),
            breiten: [12, 20, 26, 26, 16],
          } as Block,
          // Unterschriften der geltenden Fassung; frühere Neubeurteilungen stehen in der Tabelle
          h.unterschriften(neubeurteilungen.slice(-1).flatMap((n) => [n.durch ? { von: n.durch, am: n.am } : undefined, n.freigabe]).reverse()),
        ]
      : []),
  ];

  const bloecke: Block[] = [...h.kitBlock(), h.normverweis('6.1.4, 8.4, A.5.3 bis A.5.5'), ...h.hinweis(k('hinweis_umfang')), ...teilA, ...teilB, ...teilC,
    ...(einsatzInAnlage
      ? [{ typ: 'seitenumbruch' } as Block, { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: '1', titel: u.t(k('einsatz.titel')) }) } as Block, einsatzFelder]
      : []),
    // Leere Vorlage: Tabelle der Neubeurteilungen nach der ersten Freigabe (8.4) als Anlage mit einer Platzhalterzeile; sie ist
    // die Datenquelle der Kennzahlen PR-09 und PR-13 im Messplan D-05 (Prozesskatalog «datenquelle», M4-31)
    ...(h.istLeer
      ? [
          { typ: 'seitenumbruch' } as Block,
          { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: '1', titel: u.t(k('neubeurteilung.titel')) }) } as Block,
          ...h.hinweis(k('neubeurteilung.hinweis')),
          { typ: 'tabelle', kopf: u.liste(k('neubeurteilung.kopf')), zeilen: [u.liste(k('neubeurteilung.platzhalter')).map((x) => `[[${x}]]`)], breiten: [12, 20, 26, 26, 16] } as Block,
        ]
      : []),
  ];

  // Jede Folgenabschätzung ist ein eigenes Dokument: ID D-09-<KI-System>, Lenkungsangaben aus dem Registereintrag dieser ID
  // (sonst D-09); Freigabe und Datum stammen aus der Folgenabschätzung selbst.
  const dokId = sys ? `D-09-${sys.id}` : 'D-09';
  const eigen = sys ? projekt.dokumente.find((d) => d.id === dokId) : undefined;
  const lenkungsId = eigen?.klassifikation ? dokId : 'D-09';
  const lenkung = h.lenkung('D-09');
  const eigenschaften = h.eigenschaften(sys ? dokId : 'D-09');
  if (sys) {
    lenkung.dokumentId = dokId;
    lenkung.titel = `${lenkung.titel} (${sys.id} ${sys.name})`;
    eigenschaften.titel = `${dokId} ${u.t('dokumente.D-09.titel')} (${sys.name})`;
    if (eigen) {
      lenkung.version = h.wert(eigen.version, 'version');
      if (eigen.eigner) lenkung.eigner = h.personText(eigen.eigner, 'eigner');
      if (eigen.klassifikation) lenkung.klassifikation = h.klassifikation(dokId);
      lenkung.geprueftDurch = eigen.geprueft?.von ? u.t('allgemein.lenkung.geprueft', { person: typeof h.personText(eigen.geprueft.von) === 'string' ? (h.personText(eigen.geprueft.von) as string) : eigen.geprueft.von, datum: h.datum(eigen.geprueft.am) ?? '' }) : '';
    }
    // Freigabe der aktuellen Version: letzte Neubeurteilung mit Freigabe, sonst die Freigabe der Abschätzung
    const freigabe = h.dokFreigabe(dokId) ?? eigen?.freigabe;
    lenkung.freigabeDurch = h.personText(freigabe?.von, 'freigabe');
    lenkung.datum = h.wert(h.datum(freigabe?.am), 'datum');
    const historie = h.aenderungen(dokId);
    const letzte = historie.at(-1);
    lenkung.aenderung = historie.length > 1 && letzte ? u.t('allgemein.lenkung.aenderung', { version: letzte.version, datum: h.datum(letzte.datum) ?? '', was: letzte.was.trim().replace(/\.$/, '') }) : '';
  }
  return {
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(lenkungsId) },
    lenkung,
    eigenschaften,
    bloecke,
  };
}

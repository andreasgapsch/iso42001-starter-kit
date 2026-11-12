// D-14 Information, Transparenz und Meldungen (A.8.2 bis A.8.5, A.10.4)
// Form «ergaenzungsblatt»: Abschnitte für ein bestehendes Verfahren zum Umgang mit Sicherheitsvorfällen (D-14-EB)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { ANLAGE_AB_SYSTEMEN, erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';

const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));

export function d14(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-14.${s}`;
  const org = projekt.organisation;
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-14-EB' : 'D-14';
  const verantwortlich = alsMd(h.personText(org.aimsVerantwortlich, 'person'));
  const mk = org.meldekanalExtern;
  // Vorschlagswerte (Fristen, Wege) gelten als Festlegung der Firma, sobald sie das Dokument freigegeben hat:
  // dann ohne Platzhalter-Markierung, sonst bleiben sie gelb zum Prüfen.
  const festgelegt = !h.istLeer && h.dokEintrag(id)?.status === 'freigegeben';
  const fest = (text: string): string => (festgelegt ? text.replace(/\[\[(.+?)\]\]/g, '$1') : text);
  const zeilen = (s: string) => (u.roh(k(s)) as string[][]).map((z) => z.map((zelle) => md(fest(zelle))));
  // Feste Frist für die Information betroffener Kunden (meldekanalExtern.fristKundenStunden), sonst «so rasch wie möglich»
  const fristKunden = h.istLeer ? undefined : mk?.fristKundenStunden;
  const kommunikationZeilen = (s: string): Text[][] =>
    (u.roh(k(s)) as string[][]).map((z) =>
      z.map((zelle, i) =>
        md(fest(i === 2 && fristKunden !== undefined && zelle === u.t(k('frist_kunden_offen')) ? u.t(k('frist_kunden'), { stunden: String(fristKunden) }) : zelle)),
      ),
    );
  // Verantwortliche je Pflicht aus den Rollen (D-04), sonst AIMS-Verantwortliche
  const rollenPerson = (bereich: string): Text => {
    if (h.istLeer) return h.wert(undefined, 'person');
    const r = projekt.rollen.find((x) => x.bereich === bereich && x.verantwortlich);
    // nur der Name: die Funktion steht in D-04, die Tabelle bleibt so schmal
    const pid = r?.verantwortlich ?? org.aimsVerantwortlich;
    return h.wert(h.person(pid)?.name ?? pid, 'person');
  };
  const mitVerantwortlichen = (s: string, bereiche: string[]): Text[][] =>
    zeilen(s).map((z, i) => [...z.slice(0, -1), h.istLeer ? z.at(-1)! : rollenPerson(bereiche[i] ?? '')]);
  // Betreiberpflichten nach AI Act: Zuständigkeit aus derselben Quelle wie SoA, E-03 und E-05 (Zusatz-Controls der
  // Erklärung zur Anwendbarkeit), sonst aus den Rollen
  const controlPerson = (ids: string[], bereich: string): Text => {
    if (h.istLeer) return h.wert(undefined, 'person');
    const c = ids.map((x) => projekt.controls.find((y) => y.id === x && y.anwendbar === 'ja' && y.verantwortlich)).find(Boolean);
    return c?.verantwortlich ? h.wert(h.person(c.verantwortlich)?.name ?? c.verantwortlich, 'person') : rollenPerson(bereich);
  };
  const MODUL_CONTROLS: [string[], string][] = [[['EUAIA-33', 'EUAIA-11'], 'vorfall'], [['EUAIA-13'], 'menschliche-aufsicht'], [['EUAIA-14', 'EUAIA-15'], 'menschliche-aufsicht']];
  // Firmendokument: Pflichten, die nicht zutreffen, entfallen (ISG nur für kritische Infrastrukturen, automatisierte
  // Einzelentscheide nur bei Systemen, die über Personen entscheiden); Kundenpflichten mit den Nachweisen zu A.8.5
  const KRITISCH = ['gesundheit', 'oeffentlich', 'finanzen', 'logistik', 'lebensmittel', 'chemie-pharma'];
  const aktiveSysteme = projekt.kiSysteme.filter((s) => s.status !== 'abgeloest' && s.status !== 'untersagt');
  const einzelentscheide =
    h.istLeer ||
    aktiveSysteme.some(
      (s) => s.automatisierung === 'vollautomatisiert' || (s.personendaten && projekt.folgenabschaetzungen.some((f) => f.kiSystem === s.id && f.triage.automatisierteEntscheidung)),
    );
  const quellenA85 = h.istLeer
    ? ''
    : (projekt.controls.find((c) => c.id === 'A.8.5')?.nachweise ?? [])
        .map((n) => projekt.nachweise.find((x) => x.id === n))
        .filter((n) => !!n)
        .map((n) => `${n!.titel} (${n!.id})`)
        .join('; ');
  const pflichtZeilen = (s: string, bereiche: string[]): Text[][] => {
    const roh = u.roh(k(s)) as string[][];
    return mitVerantwortlichen(s, bereiche)
      .map((z, i) => ({ z, schluessel: roh[i]![1]! }))
      .filter(({ schluessel }) => h.istLeer || ((!/ISG/.test(schluessel) || KRITISCH.includes(projekt.organisation.branche)) && (!/DSG Art\. 21/.test(schluessel) || einzelentscheide)))
      .map(({ z, schluessel }) => (!h.istLeer && quellenA85 && /\[\[/.test(schluessel) ? [z[0]!, quellenA85, ...z.slice(2)] : z));
  };
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(p)) });
  const absatz = (s: string, werte?: Record<string, string>): Block => ({ typ: 'absatz', text: md(u.t(k(s), werte)) });
  const titel = (nr: string, s: string, normbezug = ''): Block => ({
    typ: 'ueberschrift',
    ebene: nr.includes('.') ? 2 : 1,
    text: `${nr} ${u.t(k(`abschnitte.${s}`))}${normbezug ? ` (${normbezug})` : ''}`,
  });
  const modul = h.istLeer || projekt.meta.modulAiAct;
  const modulAbsatz = (text: string): Block => ({
    typ: 'absatz',
    text: md(`**${u.t(k(h.istLeer ? 'modul_praefix_leer' : 'modul_praefix'))}** ${text}`),
  });

  // Information für Nutzende je System; abgelöste Systeme entfallen, untersagte und ausgesetzte stehen mit Status
  const statusVermerk = (s: (typeof projekt.kiSysteme)[number]) =>
    s.status === 'untersagt' || s.status === 'ausgesetzt' ? ` (${u.t('allgemein.ki_status_vermerk', { status: u.t(`allgemein.ki_status.${s.status}`) })})` : '';
  const infoZeilen: Text[][] = h.istLeer
    ? []
    : projekt.kiSysteme
        .filter((s) => s.status !== 'abgeloest')
        .map((s) =>
          leer(s.nutzerinformation)
            ? [`${s.id} ${s.name}${statusVermerk(s)}`, leer(s.betroffene) ? h.wert(undefined, 'text') : s.betroffene, s.status === 'untersagt' ? u.t(k('info_untersagt')) : md(u.t(k('info_vorschlag'))), s.status === 'untersagt' ? '' : h.wert(undefined, 'ort')]
            : [`${s.id} ${s.name}${statusVermerk(s)}`, leer(s.betroffene) ? h.wert(undefined, 'text') : s.betroffene, s.nutzerinformation!, ''],
        );
  // Steht die Information samt Ort schon im Text (KiSystem.nutzerinformation), entfällt die Spalte «Ort»
  const ohneOrt = infoZeilen.length > 0 && infoZeilen.every((z) => z[3] === '');
  const infoTabelle: Block = ohneOrt
    ? { typ: 'tabelle', kopf: u.liste(k('info_kopf')).slice(0, 3), zeilen: infoZeilen.map((z) => z.slice(0, 3)), breiten: [24, 30, 46] }
    : { typ: 'tabelle', kopf: u.liste(k('info_kopf')), zeilen: infoZeilen.map((z) => (z[3] === '' ? [...z.slice(0, 3), u.t(k('info_ort_im_text'))] : z)), breiten: [24, 22, 34, 20], leereZeilen: infoZeilen.length ? 0 : 2 };

  // Systeme mit Transparenzpflichten nach Art. 50 (nur Firmendokument mit Modul)
  const transparenz = projekt.kiSysteme
    .filter((s) => s.aiAct.transparenz.length > 0)
    .map((s) => `${s.id} ${s.name} (${s.aiAct.transparenz.map((t) => t.replace('50-', '50 Abs. ')).join(', ')})`);
  const modulInfo: Block[] = !modul
    ? []
    : [modulAbsatz(u.t(k('modul_info')) + (!h.istLeer && transparenz.length ? ` ${u.t(k('modul_info_systeme'), { systeme: transparenz.join('; ') })}` : ''))];

  const infoBloecke = (nr: string): Block[] => [
    titel(nr, 'information', 'A.8.2'),
    absatz('info_text'),
    liste('info_kriterien'),
    ...(!h.istLeer && projekt.kiSysteme.length === 0 ? h.hinweis(k('systeme_fehlen'), true) : []),
    ...h.systemAnlage(u.t(k('abschnitte.information')), [infoTabelle], infoZeilen.length),
    ...modulInfo,
  ];

  const meldekanalBloecke = (nr: string): Block[] => [
    titel(nr, 'meldekanal', 'A.8.3'),
    absatz('meldekanal_text'),
    ...h.hinweis(k('hinweis_meldekanal')),
    {
      typ: 'felder',
      felder: [
        { label: u.t(k('meldekanal_felder.kanal')), wert: h.wert(mk?.adresse, 'text') },
        { label: u.t(k('meldekanal_felder.veroeffentlicht')), wert: !h.istLeer && mk?.ort ? mk.ort : md(fest(u.t(k('meldekanal_ort')))) },
        { label: u.t(k('meldekanal_felder.bearbeitung')), wert: !h.istLeer && mk?.bearbeitung ? h.personText(mk.bearbeitung) : md(verantwortlich) },
        {
          label: u.t(k('meldekanal_felder.fristen')),
          wert: !h.istLeer && mk?.fristTage && mk.fristAntwortTage
            ? u.t(k('meldekanal_fristen_firma'), { bestaetigung: String(mk.fristTage), antwort: String(mk.fristAntwortTage) })
            : md(fest(u.t(k('meldekanal_fristen')))),
        },
        { label: u.t(k('meldekanal_felder.ablage')), wert: h.wert(h.istLeer ? undefined : h.dokEintrag(id)?.ablageort, 'ort') },
        ...(eb && !h.istLeer && mk?.vorfallVerfahren ? [{ label: u.t(k('meldekanal_felder.verfahren')), wert: mk.vorfallVerfahren }] : []),
      ],
    },
  ];

  const vorfallBloecke = (nr: string): Block[] => [
    titel(nr, 'vorfall', 'A.8.4'),
    // Leere Vorlage: Hinweis auf ein bestehendes Vorfallverfahren; Firmendokument nur, wenn es eines gibt (meldekanalExtern.vorfallVerfahren)
    ...(eb ? [] : h.istLeer ? [absatz('vorfall_isms')] : mk?.vorfallVerfahren?.trim() ? [absatz('vorfall_bestehend', { verfahren: mk.vorfallVerfahren.trim() })] : []),
    absatz('vorfall_definition'),
    liste('vorfall_beispiele'),
  ];

  // Koordination bei Vorfällen: verantwortliche Person der Rolle «vorfall» (D-04), sonst AIMS-Verantwortliche
  const vorfallPerson = h.istLeer ? verantwortlich : alsMd(h.personText(h.rollenPerson('vorfall') ?? org.aimsVerantwortlich, 'person'));
  const kommunikationBloecke = (nr: string): Block[] => [
    titel(nr, 'kommunikation', eb ? 'A.8.4' : ''),
    absatz('kommunikation_text', { verantwortlich: vorfallPerson }),
    ...h.hinweis(k('hinweis_kommunikation')),
    { typ: 'tabelle', kopf: u.liste(k('kommunikation_kopf')), zeilen: kommunikationZeilen(eb ? 'kommunikation_tabelle_eb' : 'kommunikation_tabelle'), breiten: [29, 31, 19, 21] },
  ];

  const pflichtenBloecke = (nr: string): Block[] => [
    titel(nr, 'pflichten', 'A.8.5'),
    absatz('pflichten_text'),
    ...h.hinweis(k('hinweis_pflichten')),
    ...(eb ? [absatz('pflichten_eb')] : []),
    {
      typ: 'tabelle',
      kopf: u.liste(k('pflichten_kopf')),
      zeilen: [
        ...pflichtZeilen(eb ? 'pflichten_tabelle_eb' : 'pflichten_tabelle', eb ? ['datenschutz', 'aims', 'aims'] : ['datenschutz', 'datenschutz', 'informationssicherheit', 'datenschutz', 'aims', 'aims']),
        ...(modul ? zeilen('pflichten_modul_tabelle').map((z, i) => [...z.slice(0, -1), h.istLeer ? z.at(-1)! : controlPerson(MODUL_CONTROLS[i]![0], MODUL_CONTROLS[i]![1])]) : []),
      ],
      breiten: [32, 26, 22, 20],
    },
    ...(modul ? [modulAbsatz(u.t(k('modul_pflichten')))] : []),
  ];

  const kundenBloecke = (nr: string): Block[] => [
    titel(nr, 'kunden', 'A.10.4'),
    absatz('kunden_text'),
    liste('kunden_inhalt'),
    { typ: 'absatz', text: md(fest(u.t(k('kunden_ort')))) },
  ];

  const lehrenBloecke = (nr: string): Block[] => [titel(nr, 'lehren'), absatz('lehren_text')];

  // Schweregrade für KI-Vorfälle (vier Stufen, Register D-22 Spalte «Schwere») und Einspruch gegen KI-Ergebnisse (ab rc.2)
  const schwereBloecke = (nr: string | undefined): Block[] => [
    ...(nr ? [titel(nr, 'schwere')] : [{ typ: 'ueberschrift' as const, ebene: 2 as const, text: u.t(k('abschnitte.schwere')) }]),
    absatz(eb ? 'schwere_text_eb' : 'schwere_text'),
    { typ: 'tabelle', kopf: u.liste(k('schwere_kopf')), zeilen: zeilen('schwere_tabelle'), breiten: [14, 52, 34] },
  ];
  const einspruchBloecke = (nr: string | undefined): Block[] => [
    ...(nr ? [titel(nr, 'einspruch')] : [{ typ: 'ueberschrift' as const, ebene: 2 as const, text: u.t(k('abschnitte.einspruch')) }]),
    { typ: 'absatz', text: md(fest(u.t(k('einspruch_text')))) },
  ];
  // Ergänzungsblatt (Seitenvorgabe): Schweregrade und Einspruch als eigene Anlage nach den Systemanlagen
  // (Anlage A ist die Systemtabelle, sobald sie wegen vieler Systeme in eine Anlage geht, siehe h.systemAnlage)
  const mitSystemAnlage = !h.istLeer && infoZeilen.length >= ANLAGE_AB_SYSTEMEN;
  const ebAnlageNr = mitSystemAnlage ? 'B' : 'A';
  // h.anlagen() erst nach h.systemAnlage() (in infoBloecke) aufrufen, deshalb als Funktion am Ende der Blockliste
  const anlagenMitEb = (): Block[] => [
    ...h.anlagen(),
    ...(mitSystemAnlage ? [] : [{ typ: 'seitenumbruch' } as Block]),
    { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: ebAnlageNr, titel: u.t(k('anlage_titel')) }) },
    ...schwereBloecke(undefined),
    ...einspruchBloecke(undefined),
  ];

  const bloecke: Block[] = eb
    ? [
        ...h.kitBlock(),
        h.normverweis('A.8.2 bis A.8.5, A.10.4'),
        ...h.hinweis(k('hinweis_eb')),
        // Firmendokument: bestehendes ISMS-Verfahren mit Kennung und Version aus dem Register (aufgenommenIn)
        ...(!h.istLeer && h.dokEintrag(id)?.aufgenommenIn?.trim() ? [absatz('einleitung_eb_firma', { dokument: h.dokEintrag(id)!.aufgenommenIn!.trim() })] : [absatz('einleitung_eb')]),
        ...vorfallBloecke('1'),
        absatz('anlage_verweis', { nr: ebAnlageNr }),
        ...meldekanalBloecke('2'),
        ...kommunikationBloecke('3'),
        ...pflichtenBloecke('4'),
        ...lehrenBloecke('5'),
        { typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('abschnitte.ausserhalb'))}` },
        absatz(h.istLeer ? 'ausserhalb_text' : 'ausserhalb_text_firma'),
        ...infoBloecke('6.1'),
        ...kundenBloecke('6.2'),
        ...anlagenMitEb(),
      ]
    : [
        ...h.kitBlock(),
        h.normverweis('A.8.2 bis A.8.5, A.10.4'),
        ...h.hinweis(k('hinweis_umfang')),
        { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
        ...infoBloecke('1'),
        ...meldekanalBloecke('2'),
        ...einspruchBloecke('2.1'),
        ...vorfallBloecke('3'),
        ...schwereBloecke('3.1'),
        ...kommunikationBloecke('3.2'),
        ...pflichtenBloecke('4'),
        ...kundenBloecke('5'),
        ...lehrenBloecke('6'),
        ...h.anlagen(),
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

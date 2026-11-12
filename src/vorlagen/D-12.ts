// D-12 Lebenszyklus von KI-Systemen (8.1, A.6): Pflichtfassung für Betreiber, Ausbaustufe Entwicklung
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { HANDLUNGSBEFUGNISSE } from '../model/typen.ts';
import { ANLAGE_AB_SYSTEMEN, erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';
import { ablageVon, vorgabenFueller } from './vorgaben.ts';
import { eintragVon, imProzesssystem, prozessKatalog, prozessTexte, sichtImPfad } from '../prozesse/katalog.ts';
import { prozessStaende } from '../prozesse/stand.ts';

/** Controls der Ausbaustufe Entwicklung (für Betreiber meist nicht anwendbar) */
const CONTROLS_ENTWICKLUNG = ['A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3', 'A.6.2.7'];
/** Controls, die nur bei eigener Entwicklung gelten; A.6.2.7 (technische Dokumentation) kann auch Betreiber betreffen */
const CONTROLS_KERN = ['A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3'];

/** Text als Auszeichnungs-String, damit er in übersetzte Sätze eingesetzt werden kann */
const alsMd = (t: Text): string => (typeof t === 'string' ? t : t.map((l) => (l.platzhalter ? `[[${l.text}]]` : l.text)).join(''));

export function d12(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-12.${s}`;
  const org = projekt.organisation;
  const verantwortlich = alsMd(h.personText(org.aimsVerantwortlich, 'person')).replace(/, AIMS lead$/, '');
  // Vorgaben und Platzhalter mit Projektdaten (Regel in vorgaben.ts); Aufbewahrung der Protokolle aus
  // organisation.protokollierung (früher meta.gefuehrt.antworten.protokolle)
  const ablage = h.istLeer ? undefined : ablageVon(ctx, h, 'D-12');
  const altProtokolle = (projekt.meta.gefuehrt.antworten['protokolle'] ?? {}) as { aufbewahrungMonate?: number; auswertung?: string };
  const protokollVorgabe = h.istLeer ? undefined : { ...altProtokolle, ...org.protokollierung };
  const monate = protokollVorgabe?.aufbewahrungMonate;
  const platzhalterMonate = /\[\[(.+?)\]\]/.exec((u.roh(k('protokolle_tabelle')) as string[][])[0]![2]!)?.[1];
  const fuelle = vorgabenFueller(ctx, h, 'D-12', {
    ablage,
    weitere: monate && platzhalterMonate ? { [platzhalterMonate]: u.t(k('monate'), { anzahl: String(monate) }) } : {},
  });
  // Freigabe je Entwicklungsphase (N-19): Idee durch die Rechenschaft der Rolle «entwicklung», Entwicklung durch deren
  // Verantwortliche/n, Test durch die Eigner/in des jeweiligen Systems, Betrieb nach Abschnitt 5. Ohne Person im Projekt
  // nennt das Firmendokument die Rolle; die leere Vorlage behält den Platzhalter.
  const PHASEN = ['idee', 'entwicklung', 'test', 'betrieb'] as const;
  const phasenPerson: Record<(typeof PHASEN)[number], string | undefined> = {
    idee: h.rollenPerson('entwicklung', 'rechenschaft'),
    entwicklung: h.rollenPerson('entwicklung'),
    test: undefined,
    betrieb: undefined,
  };
  const phasenFreigabe = (i: number): string | undefined => {
    if (h.istLeer) return undefined;
    const phase = PHASEN[i];
    if (!phase) return undefined;
    const p = phasenPerson[phase];
    return p && h.person(p) ? alsMd(h.personText(p)) : u.t(k(`phasen_rolle.${phase}`));
  };
  const tabelle = (s: string, breiten: number[]): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k(`${s}_kopf`)),
    zeilen: (u.roh(k(`${s}_tabelle`)) as string[][]).map((z) => z.map((zelle) => md(fuelle(zelle)))),
    breiten,
  });
  const liste = (s: string, nummeriert = false): Block => ({ typ: 'liste', nummeriert, punkte: u.liste(k(s)).map((p) => md(fuelle(p))) });
  const absatz = (s: string, werte?: Record<string, string>): Block => ({ typ: 'absatz', text: md(fuelle(u.t(k(s), werte))) });
  const modul = h.istLeer || projekt.meta.modulAiAct;
  const modulAbsatz = (s: string): Block[] =>
    modul ? [{ typ: 'absatz', text: md(`**${u.t(k(h.istLeer ? 'modul_praefix_leer' : 'modul_praefix'))}** ${u.t(k(s))}`) }] : [];
  // Modul NIST AI RMF (ab rc.2): ein Satz mit Verweis auf das Mess- und Prüfkonzept N-03 (RMF-07, RMF-09, RMF-16)
  const nistAbsatz = (s: string): Block[] =>
    h.istLeer || projekt.meta.modulNistRmf ? [{ typ: 'absatz', text: md(`**${u.t(k(h.istLeer ? 'nist_praefix_leer' : 'nist_praefix'))}** ${u.t(k(s))}`) }] : [];

  // Tabelle der Systeme aus dem Inventar
  const personName = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? '';
  const systemZeilen: Text[][] = h.istLeer
    ? []
    : projekt.kiSysteme.map((s) => [
        s.id,
        s.name,
        // Typ und Status wie in allen Dokumenten aus allgemein.yaml (N-21)
        u.t(`allgemein.ki_typ.${s.typ}`),
        u.t(k(`phase.${s.lebenszyklus}`)),
        u.t(`allgemein.ki_status.${s.status}`),
        personName(s.eigner) || h.wert(undefined, 'person'),
        h.datum(s.naechsteUeberpruefung) ?? h.wert(undefined, 'datum'),
      ]);

  // Protokolle je System aus dem Inventar (KiSystem.protokollierung): was, wo und wie lange, einschliesslich Abweichungen
  // von der allgemeinen Vorgabe (A.6.2.8, AI Act Art. 26(6)); ohne abgelöste und untersagte Systeme
  const mitProtokoll = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.protokollierung?.trim() && s.status !== 'abgeloest' && s.status !== 'untersagt');
  const auswertung = protokollVorgabe?.auswertung ? u.tOpt(`gefuehrt.optionen.rhythmus.${protokollVorgabe.auswertung}`) : undefined;
  const protokolleJeSystem: Block[] = mitProtokoll.length
    ? [
        { typ: 'absatz', text: u.t(k('protokolle_je_system')) },
        ...h.systemAnlage(
          u.t(k('protokolle_anlage')),
          [{ typ: 'tabelle', kopf: u.liste(k('protokolle_system_kopf')), zeilen: mitProtokoll.map((s) => [s.id, s.name, s.protokollierung!]), breiten: [10, 25, 65] }],
          mitProtokoll.length,
        ),
      ]
    : [];
  // Nachtrainieren und Modelländerungen je System (KiSystem.aenderungsregel, A.6.2.5)
  const mitRegel = h.istLeer ? [] : projekt.kiSysteme.filter((s) => s.aenderungsregel?.trim() && s.status !== 'abgeloest');
  const aenderungsregeln: Block[] = mitRegel.length
    ? [
        {
          typ: 'absatz',
          // Ohne eigenes Training: Regeln für Updates und Modellwechsel der Anbieter (sonst Widerspruch zu Abschnitt 10)
          text: u.t(k(mitRegel.some((s) => s.eigenesTraining ?? s.typ === 'eigenbau') ? 'aenderungsregeln' : 'aenderungsregeln_anbieter')),
        }, { typ: 'liste', punkte: mitRegel.map((s) => md(`**${s.id} ${s.name}:** ${s.aenderungsregel!.trim()}`)) }]
    : [];
  // Stichproben im Betrieb: eine Quelle mit dem Messplan (D-05), sonst die Vorgabe der Vorlage
  const stichprobenZiele = h.istLeer ? [] : projekt.ziele.filter((z) => /stichprob|sample/i.test(`${z.kennzahl} ${z.messmethode}`));
  const betriebZeilen: Text[][] = (u.roh(k('betrieb_tabelle')) as string[][]).map((z, i) =>
    i === 1 && stichprobenZiele.length
      ? [md(z[0]!), u.t(k('stichproben_messplan'), { ziele: stichprobenZiele.map((x) => `${x.id} ${x.ziel}: ${x.messmethode.trim().replace(/\.$/, '')}, ${x.haeufigkeit}`).join('; ') })]
      : z.map((zelle) => md(fuelle(zelle))),
  );

  // Ausbaustufe: in leeren Vorlagen immer. Im Firmendokument entscheidet die Erklärung zur Anwendbarkeit (D-11): Abschnitt
  // 10 nur, wenn ein Control der Entwicklung anwendbar ist, und dann nur die Unterabschnitte mit anwendbaren Controls.
  // Ohne Entscheid in D-11: wenn das Unternehmen entwickelt oder eigene Systeme hat.
  // Ohne eigene Entwicklung (keine Eigenentwicklung, kein eigenes Training, keine KI-Produkte) entfällt Abschnitt 10, auch
  // wenn einzelne Controls (z. B. A.6.2.2 für Anforderungen an eingekaufte Systeme) anwendbar sind.
  const soa = h.soaEntscheid(CONTROLS_KERN);
  const eigeneEntwicklung = org.entwickeltKi || org.verkauftKiProdukte || projekt.kiSysteme.some((s) => s.typ === 'eigenbau' || s.eigenesTraining === true);
  const entwicklung = h.istLeer || (eigeneEntwicklung && soa !== 'nein');
  // Unterabschnitt mit seinen Controls; ein Control entfällt im Firmendokument, wenn D-11 es ausschliesst
  const teil = (controls: string[], titel: string, inhalt: Block[]) => {
    const anwendbar = controls.filter((c) => h.soaEntscheid([c]) !== 'nein');
    return { controls: anwendbar, alle: controls, titel, inhalt, gilt: anwendbar.length > 0 };
  };
  const ohneEntwurf = !h.istLeer && h.soaEntscheid(['A.6.2.3']) === 'nein';
  const teile = [
    teil(['A.6.1.2'], u.t(k('unterabschnitte.ziele')), [absatz('ziele_text'), tabelle('ziele', [26, 74])]),
    teil(['A.6.1.3'], u.t(k('unterabschnitte.prozess')), [
      absatz('prozess_text'),
      {
        typ: 'tabelle',
        kopf: u.liste(k('prozess_kopf')),
        zeilen: (u.roh(k('prozess_tabelle')) as string[][]).map((z, i) => z.map((zelle, j) => md(j === 3 ? (phasenFreigabe(i) ?? fuelle(zelle)) : fuelle(zelle)))),
        breiten: [14, 36, 30, 20],
      } as Block,
    ]),
    teil(['A.6.2.2', 'A.6.2.3'], u.t(k('unterabschnitte.unterlagen')), [
      // Entwurf (A.6.2.3) nur, wenn er nach D-11 anwendbar ist
      {
        typ: 'tabelle',
        kopf: u.liste(k('unterlagen_kopf')),
        zeilen: (u.roh(k('unterlagen_tabelle')) as string[][]).filter((_, i) => !(ohneEntwurf && i === 1)).map((z) => z.map((zelle) => md(fuelle(zelle)))),
        breiten: [20, 80],
      } as Block,
    ]),
    teil(['A.6.2.7'], u.t(k('unterabschnitte.dokumentation')), [
      // Firmendokument mit bekannter Ablage: Spalte «Ablage» als ein Satz statt in jeder Zeile
      ...(ablage
        ? [
            {
              typ: 'tabelle',
              kopf: [u.liste(k('dokumentation_kopf'))[0]!, u.t(k('dokumentation_ablage'), { unterlage: u.liste(k('dokumentation_kopf'))[1]!, ablage })],
              zeilen: (u.roh(k('dokumentation_tabelle')) as string[][]).map((z) => [md(z[0]!), md(z[1]!)]),
              breiten: [26, 74],
            } as Block,
          ]
        : [tabelle('dokumentation', [22, 44, 34])]),
      ...modulAbsatz('modul_dokumentation'),
    ]),
  ];
  const ausgeschlossen = teile.flatMap((t) => t.alle.filter((c) => !t.controls.includes(c)));
  // Ohne eigene Entwicklung, aber mit anwendbarem A.6.2.7: technische Dokumentation als eigener Abschnitt 11
  const dokuOhneEntwicklung = !entwicklung && h.soaEntscheid(['A.6.2.7']) === 'ja' ? teile.at(-1)! : undefined;
  // Ohne Entwicklung: genannt werden nur die Controls, die D-11 ausschliesst; A.6.2.2 gilt für eingekaufte Systeme (Abschnitt 3)
  const ausgeschlossenOhneEntwicklung = CONTROLS_ENTWICKLUNG.filter((c) => (h.istLeer ? true : h.soaEntscheid([c]) !== 'ja') && !(dokuOhneEntwicklung && c === 'A.6.2.7'));
  const anforderungenEinkauf = !h.istLeer && !entwicklung && h.soaEntscheid(['A.6.2.2']) === 'ja';
  const entwicklungBloecke: Block[] = [
    ...teile
      .filter((t) => t.gilt)
      .flatMap((t, i): Block[] => [{ typ: 'ueberschrift', ebene: 2, text: `10.${i + 1} ${t.titel} (${t.controls.join(', ')})` }, ...t.inhalt]),
    ...(ausgeschlossen.length ? [absatz('entwicklung_teilweise', { controls: ausgeschlossen.join(', ') })] : []),
  ];
  const entwicklungInAnlage = !h.istLeer && entwicklung && projekt.kiSysteme.length >= ANLAGE_AB_SYSTEMEN;
  const ANLAGE_PLATZHALTER = '\u0000anlage-entwicklung';
  // Prüfung vor dem Einsatz: strengere Kriterien aus der Umsetzung von A.6.2.4 in der SoA (D-11)
  const umsetzungPruefung = h.istLeer ? '' : (projekt.controls.find((c) => c.id === 'A.6.2.4' && c.anwendbar === 'ja')?.umsetzung.trim() ?? '');

  // Ergänzende Regeln (ab rc.2): als Anlage am Dokumentende, damit der Hauptteil im Seitenlimit bleibt
  const e = (s: string) => k(`ergaenzung.${s}`);
  const eListe = (s: string): Block => ({ typ: 'liste', punkte: u.liste(e(s)).map((p) => md(fuelle(p))) });
  const eAbsatz = (s: string): Block => ({ typ: 'absatz', text: md(fuelle(u.t(e(s)))) });
  const eTitel = (s: string): Block => ({ typ: 'ueberschrift', ebene: 2, text: u.t(e(`${s}.titel`)) });
  const aktivSystem = (s: (typeof projekt.kiSysteme)[number]) => s.status !== 'abgeloest' && s.status !== 'untersagt';
  // Missbrauchsfälle je System, das fremde Inhalte liest oder öffentlich erreichbar ist (KiSystem.missbrauchsfaelle)
  const exponiert = h.istLeer ? [] : projekt.kiSysteme.filter((s) => aktivSystem(s) && (s.fremdeInhalte || s.oeffentlich));
  // Angaben je System: handelnd (ab «bereitet vor»), kritisch oder ausser Betrieb (Stoppmöglichkeit, Rückfallweg, Aufbewahrung)
  const befugnisse = (u.roh('vorlagen.D-10.listen.handlungsbefugnis') as string[] | undefined) ?? [];
  const befugnisText = (b?: string) => (b ? (befugnisse[HANDLUNGSBEFUGNISSE.indexOf(b as (typeof HANDLUNGSBEFUGNISSE)[number])] ?? b) : '');
  const handelnd = (b?: string) => !!b && HANDLUNGSBEFUGNISSE.indexOf(b as (typeof HANDLUNGSBEFUGNISSE)[number]) >= 2;
  const besondere = h.istLeer
    ? []
    : projekt.kiSysteme.filter((s) => handelnd(s.handlungsbefugnis) || s.kritisch || s.lebenszyklus === 'ausserbetrieb' || s.status === 'abgeloest' || s.ausserbetrieb?.am || s.aufbewahrenBis);
  const ausserText = (s: (typeof projekt.kiSysteme)[number]) =>
    [s.ausserbetrieb?.am ? u.t(e('systeme.ausserbetrieb'), { am: h.datum(s.ausserbetrieb.am) ?? '' }) : '', s.aufbewahrenBis ? u.t(e('systeme.aufbewahren'), { datum: h.datum(s.aufbewahrenBis) ?? '' }) : '']
      .filter(Boolean)
      .join(', ');
  const ergaenzungTitel = u.t(e('titel'));
  const ergaenzung: Block[] = [
    ...h.hinweis(e('hinweis')),
    eTitel('missbrauch'),
    eAbsatz('missbrauch.text'),
    eAbsatz('missbrauch.personen'),
    ...(exponiert.length
      ? [
          {
            typ: 'tabelle',
            kopf: u.liste(e('missbrauch.kopf')),
            zeilen: exponiert.map((s) => [s.id, s.name, s.missbrauchsfaelle?.trim() || u.t(e('missbrauch.offen'))]),
            breiten: [10, 30, 60],
          } as Block,
        ]
      : []),
    eTitel('betrieb'),
    { typ: 'tabelle', kopf: u.liste(e('betrieb.kopf')), zeilen: (u.roh(e('betrieb.tabelle')) as string[][]).map((z) => z.map((zelle) => md(fuelle(zelle)))), breiten: [22, 78] },
    eTitel('aussetzen'),
    eListe('aussetzen.punkte'),
    eTitel('ausloeser'),
    eAbsatz('ausloeser.text'),
    eListe('ausloeser.punkte'),
    eAbsatz('ausloeser.schluss'),
    eTitel('agenten'),
    eListe('agenten.punkte'),
    // Prüffälle für handelnde KI (ab rc.3): leere Vorlage immer, Firmendokument nur mit einem aktiven System, das Aktionen
    // vorbereitet oder ausführt oder ein Gedächtnis hat
    ...(h.istLeer || projekt.kiSysteme.some((s) => aktivSystem(s) && (handelnd(s.handlungsbefugnis) || s.gedaechtnis === true))
      ? [
          eTitel('agenten_pruefung'),
          eAbsatz('agenten_pruefung.text'),
          { typ: 'tabelle', kopf: u.liste(e('agenten_pruefung.kopf')), zeilen: (u.roh(e('agenten_pruefung.tabelle')) as string[][]).map((z) => z.map((zelle) => md(fuelle(zelle)))), breiten: [40, 36, 24] } as Block,
        ]
      : []),
    eTitel('protokolle'),
    eAbsatz('protokolle.text'),
    eListe('protokolle.punkte'),
    eAbsatz('protokolle.schluss'),
    eTitel('ausserbetrieb'),
    eAbsatz('ausserbetrieb.text'),
    eListe('ausserbetrieb.punkte'),
    ...(besondere.length
      ? [
          eTitel('systeme'),
          eAbsatz('systeme.text'),
          {
            typ: 'tabelle',
            kopf: u.liste(e('systeme.kopf')),
            zeilen: besondere.map((s) => [s.id, s.name, befugnisText(s.handlungsbefugnis), s.stoppmoeglichkeit ?? '', s.rueckfallweg ?? '', ausserText(s)]),
            breiten: [8, 18, 14, 22, 22, 16],
          } as Block,
        ]
      : []),
  ];

  // Ohne ISMS: Grundschutz der Informationssicherheit, den die Firma für die KI-Systeme führt (Basisprozesse PS-02, PS-06,
  // PS-08 …): Regel, Eigner, Rhythmus und Ausführung je Prozess. Der Prozess selbst steht in D-27.
  const basisBloecke: Block[] = (() => {
    if (h.istLeer || projekt.meta.mitIsms || projekt.prozesse === undefined) return [];
    const stichtag = projekt.meta.geaendert.slice(0, 10);
    const staende = new Map(prozessStaende(projekt, ctx.kataloge, stichtag).map((x) => [x.id, x]));
    const punkte = prozessKatalog(ctx.kataloge)
      .prozesse.filter((kp) => kp.art === 'nur-isms' && sichtImPfad(kp, false) !== 'aims' && imProzesssystem(projekt, kp))
      .map((kp) => {
        const tx = prozessTexte(u, kp.id);
        const st = staende.get(kp.id);
        const e = eintragVon(projekt, kp.id);
        const regel = u.tOpt(k(`basis_regel.${kp.id}`)) ?? tx?.zweck ?? '';
        const rhythmus = st?.rhythmus ? (u.tOpt(`gefuehrt.optionen.rhythmus.${st.rhythmus}`) ?? st.rhythmus) : u.t('prozesse.felder.ereignis');
        const l = e?.extern?.lieferant ? projekt.lieferanten.find((x) => x.id === e.extern!.lieferant) : undefined;
        const extern = l ? `${l.name} (${l.id})` : e?.extern?.name;
        const eigner = h.person(st?.eigner);
        return u.t(k(extern ? 'basis_punkt_extern' : 'basis_punkt'), { id: kp.id, titel: tx?.titel ?? kp.id, regel: regel.replace(/\.$/, ''), eigner: eigner ? eigner.name : '', rhythmus, extern: extern ?? '' });
      });
    return punkte.length ? [{ typ: 'ueberschrift', ebene: 2, text: u.t(k('basis_titel')) }, { typ: 'absatz', text: u.t(k('basis_text')) }, { typ: 'liste', punkte }] : [];
  })();

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('8.1, A.6.1.2 bis A.6.2.8, A.9.4'),
    ...h.hinweis(k('hinweis_umfang')),
    { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },

    { typ: 'ueberschrift', ebene: 1, text: `1 ${u.t(k('abschnitte.geltung'))}` },
    absatz('geltung_text', { verantwortlich }),

    { typ: 'ueberschrift', ebene: 1, text: `2 ${u.t(k('abschnitte.systeme'))}` },
    ...h.hinweis(k('hinweis_systeme')),
    ...(!h.istLeer && projekt.kiSysteme.length === 0 ? h.hinweis(k('systeme_fehlen'), true) : []),
    ...h.systemAnlage(
      u.t(k('abschnitte.systeme')),
      [{ typ: 'tabelle', kopf: u.liste(k('systeme_kopf')), zeilen: systemZeilen, breiten: [9, 21, 13, 11, 13, 17, 16], leereZeilen: systemZeilen.length ? 0 : 1 }],
      systemZeilen.length,
    ),

    { typ: 'ueberschrift', ebene: 1, text: `3 ${u.t(k('abschnitte.einfuehrung'))}` },
    absatz('einfuehrung_text'),
    liste('einfuehrung_schritte', true),

    { typ: 'ueberschrift', ebene: 1, text: `4 ${u.t(k('abschnitte.pruefung'))} (A.6.2.4)` },
    absatz('pruefung_text'),
    tabelle('pruefung', [22, 78]),
    ...(umsetzungPruefung ? [{ typ: 'absatz', text: u.t(k('pruefung_system'), { umsetzung: umsetzungPruefung }) } as Block] : []),

    { typ: 'ueberschrift', ebene: 1, text: `5 ${u.t(k('abschnitte.freigabe'))} (A.6.2.5)` },
    absatz('freigabe_text'),
    liste('freigabe_inhalt'),
    ...((st) => [st ? absatz('freigabe_regel_firma', st) : absatz('freigabe_regel', { verantwortlich })])(h.einfuehrungsStellen()),

    { typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('abschnitte.betrieb'))} (A.6.2.6)` },
    absatz('betrieb_text'),
    { typ: 'tabelle', kopf: u.liste(k('betrieb_kopf')), zeilen: betriebZeilen, breiten: [22, 78] },
    { typ: 'absatz', text: u.t(k('verweis_ergaenzung'), { titel: ergaenzungTitel }) },
    ...basisBloecke,

    { typ: 'ueberschrift', ebene: 1, text: `7 ${u.t(k('abschnitte.protokolle'))} (A.6.2.8)` },
    absatz('protokolle_text'),
    ...h.hinweis(k('hinweis_protokolle')),
    tabelle('protokolle', [40, 34, 26]),
    ...(auswertung ? [absatz('protokolle_auswertung', { rhythmus: auswertung })] : []),
    ...protokolleJeSystem,
    ...modulAbsatz('modul_protokolle'),

    { typ: 'ueberschrift', ebene: 1, text: `8 ${u.t(k('abschnitte.aenderungen'))}` },
    absatz('aenderungen_text'),
    ...aenderungsregeln,
    ...modulAbsatz('modul_aenderungen'),
    ...nistAbsatz('nist_aenderungen'),

    { typ: 'ueberschrift', ebene: 1, text: `9 ${u.t(k('abschnitte.ausserbetrieb'))}` },
    absatz('ausserbetrieb_text'),
    liste('ausserbetrieb_schritte', true),

    { typ: 'ueberschrift', ebene: 1, text: `10 ${u.t(k('abschnitte.entwicklung'))}` },
    // Firmendokument: Geltung des Abschnitts als Satz statt Kasten «Ausbaustufe»
    ...(entwicklung
      ? [
          ...(h.istLeer ? [] : [absatz('entwicklung_geltung')]),
          // Viele Systeme (Firmendokument): Unterabschnitte in eine eigene Anlage, damit der Hauptteil im Seitenlimit bleibt
          ...(entwicklungInAnlage ? [{ typ: 'absatz', text: ANLAGE_PLATZHALTER } as Block] : h.ausbau(k('ausbau_entwicklung'), entwicklungBloecke)),
        ]
      : [absatz('entwicklung_entfaellt', { controls: ausgeschlossenOhneEntwicklung.join(', ') }), ...(anforderungenEinkauf ? [absatz('anforderungen_einkauf')] : [])]),
    ...(dokuOhneEntwicklung
      ? [{ typ: 'ueberschrift', ebene: 1, text: `11 ${dokuOhneEntwicklung.titel} (A.6.2.7)` } as Block, ...dokuOhneEntwicklung.inhalt]
      : []),
  ];
  // Anlagen für Systemtabellen (ab 8 Systemen) zuerst, dann Entwicklung (falls ausgelagert), dann die ergänzenden Regeln
  const systemAnlagen = h.anlagen();
  const buchstabe = (i: number) => String.fromCharCode(65 + i);
  let naechste = systemAnlagen.filter((b) => b.typ === 'ueberschrift' && b.ebene === 1).length;
  const entwicklungAnlage: Block[] = [];
  if (entwicklungInAnlage) {
    const nrEntw = buchstabe(naechste++);
    const i = bloecke.findIndex((b) => b.typ === 'absatz' && b.text === ANLAGE_PLATZHALTER);
    bloecke[i] = { typ: 'absatz', text: u.t(k('entwicklung_anlage'), { nr: nrEntw }) };
    entwicklungAnlage.push({ typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: nrEntw, titel: u.t(k('abschnitte.entwicklung')) }) }, ...entwicklungBloecke);
  }
  const nr = buchstabe(naechste);
  bloecke.push(
    ...systemAnlagen,
    ...(systemAnlagen.length ? [] : [{ typ: 'seitenumbruch' } as Block]),
    ...entwicklungAnlage,
    { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr, titel: ergaenzungTitel }) },
    ...ergaenzung,
  );

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-12') },
    lenkung: h.lenkung('D-12'),
    eigenschaften: h.eigenschaften('D-12'),
    bloecke,
  });
}

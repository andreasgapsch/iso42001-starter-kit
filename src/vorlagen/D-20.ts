// D-20 Internes Audit: Auditprogramm, Auditplan, Checkliste 42001, Feststellungen (9.2)
import type { Farbrolle, XlsxBlatt, XlsxFormat, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { alleAbschnitte42001, alleControls42001 } from '../kataloge/typen.ts';
import type { Audit, ControlEintrag } from '../model/typen.ts';
import { erstelleHelfer, klartext, md, type VorlagenKontext } from './kontext.ts';

export function d20(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.D-20.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const eb = ctx.form === 'ergaenzungsblatt';
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const zelle = (s: string) => klartext(md(s));
  const jaNeinListe = [u.t('allgemein.ja'), u.t('allgemein.nein')];
  const jaNein = (b: boolean) => jaNeinListe[b ? 0 : 1]!;
  const personName = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? id ?? '';
  // Mit ISMS verweisen Firmendokumente auf die IDs im Pfad der Firma (D-04-EB statt D-04; D-03 und D-07 bleiben)
  const dokVerweis = (ids: string[]) => ids.map((d) => h.dokId(d)).join(', ');
  // Spalte «Mit ISMS kombiniert»: nur mit ISMS (Firmendokument ohne ISMS: entfällt)
  const zeigeIsms = h.istLeer || eb || projekt.meta.mitIsms;
  const ohneIsmsSpalte = <T>(z: T[]): T[] => (zeigeIsms ? z : z.filter((_, i) => i !== 10));
  const ergebnisBericht = (a: Audit) => [a.ergebnis?.trim(), a.bericht?.trim()].filter(Boolean).join(' ');
  // Auditzeitraum: erster bis letzter Audittag (durchgefuehrtBis), sonst ein Tag
  const zeitraum = (a: Audit): string => {
    const von = h.datum(a.durchgefuehrt ?? a.geplant) ?? '';
    const bis = a.durchgefuehrt && a.durchgefuehrtBis && a.durchgefuehrtBis > a.durchgefuehrt ? h.datum(a.durchgefuehrtBis) : undefined;
    return bis ? u.t('allgemein.skala.von_bis', { von, bis }) : von;
  };
  // Rollen-IDs (RO-xxx) in Stichproben und Nachweisen mit Bereich und verantwortlicher Person auflösen (D-04 führt keine IDs)
  const rollenAufloesen = (s: string): string =>
    s.replace(/\bRO-\d{3}\b/g, (rid) => {
      const r = projekt.rollen.find((x) => x.id === rid);
      if (!r) return rid;
      const bereich = u.tOpt(`gefuehrt.optionen.rollenBereich.${r.bereich}`) ?? r.bereich;
      return r.verantwortlich ? `${bereich} (${personName(r.verantwortlich)})` : bereich;
    });

  // Auditprogramm
  const sp = u.liste(k('spalten_programm'));
  const vorschlag = (u.roh(k('programm_vorschlag')) as string[][]).map((z) => z.map(zelle));
  const kombiniertVorschlag = h.istLeer ? '' : jaNein(projekt.meta.mitIsms || eb);
  const vorschlagZeilen: Zellwert[][] = vorschlag.map((z) => z.map((w, i) => (i === 10 ? kombiniertVorschlag : w)));
  const statusAudit = (a: Audit) => liste('status')[a.durchgefuehrt ? 1 : 0]!;
  // Controls im Umfang: Liste aus dem Audit, leer heisst alle anwendbaren
  const umfangControls = (a: Audit) => (a.umfangControls?.length ? a.umfangControls.join(', ') : a.art === 'intern' ? u.t(k('umfang_controls_alle')) : '');
  // Prozesse im Umfang (Auswahl im Audit, ab rc.9): an den Umfang angehängt; ohne Auswahl bleibt die Zelle wie bisher
  // Ohne Auswahl umfasst ein internes Audit alle Prozesse: im Firmendokument ausdrücklich so genannt
  // Vorgabe «alle» nur, wenn die Prozessbeschreibungen (D-27) zum Audit schon freigegeben waren oder es noch geplant ist
  const d27Seit = h.ersteFreigabe('D-27');
  const prozesseVorhanden = (a: Audit) => !a.durchgefuehrt || (!!d27Seit && d27Seit <= (a.durchgefuehrtBis ?? a.durchgefuehrt));
  const umfangProzesse = (a: Audit) =>
    a.umfangProzesse?.length ? u.t(k('umfang_prozesse'), { liste: a.umfangProzesse.join(', ') }) : !h.istLeer && a.art === 'intern' && projekt.prozesse !== undefined && prozesseVorhanden(a) ? u.t(k('umfang_prozesse_alle')) : '';
  // Teile verbinden: nach einem Satzende mit Leerschlag, sonst mit Strichpunkt (kein «(1 Tag).; Prozesse im Umfang»)
  const verbinde = (teile: string[]) => teile.filter(Boolean).map((t) => t.trim()).reduce((a, t) => (!a ? t : /[.;:!?]$/.test(a) ? `${a} ${t}` : `${a}; ${t}`), '');
  const umfangText = (a: Audit) => verbinde([a.umfang, umfangProzesse(a)]);
  const auditZeilen: Zellwert[][] = projekt.audits.map((a) => [
    (a.durchgefuehrt ?? a.geplant ?? '').slice(0, 4),
    `${a.id} ${u.t(k(`listen.art.${a.art}`))}`,
    umfangText(a),
    umfangControls(a),
    a.kriterien,
    a.methode ?? '',
    zeitraum(a),
    a.auditor,
    a.unabhaengigkeit,
    a.berichtAn ?? '',
    jaNein(a.kombiniertMitIsms),
    statusAudit(a),
    ergebnisBericht(a),
  ]);
  const ohneAudits = !h.istLeer && projekt.audits.length === 0;
  const programmZeilen = h.istLeer || ohneAudits ? vorschlagZeilen : auditZeilen;
  // Firmendokument: Häufigkeit und Zyklus als Vorgabe; ohne Audits zusätzlich der Hinweis auf die Vorschlagszeilen
  const hinweiseProgramm = h.istLeer
    ? u.liste(k(eb ? 'hinweise_programm_eb' : 'hinweise_programm'))
    : [...u.liste(k('hinweise_programm_firma')), ...(ohneAudits ? u.liste(k('hinweise_programm_firma_leer')) : [])];

  const programm: XlsxBlatt = {
    name: u.t(k('blaetter.programm')),
    titel: u.t(k('titel_programm')),
    hinweise: hinweiseProgramm,
    fixiert: true,
    spalten: ohneIsmsSpalte<XlsxSpalte>([
      text(sp[0]!, 8, false),
      text(sp[1]!, 24),
      text(sp[2]!, 26),
      text(sp[3]!, 22),
      text(sp[4]!, 26),
      text(sp[5]!, 26),
      text(sp[6]!, 18),
      text(sp[7]!, 18),
      { kopf: sp[8]!, breite: 22, typ: 'liste', liste: liste('unabhaengigkeit') },
      text(sp[9]!, 16),
      { kopf: sp[10]!, breite: 10, typ: 'liste', liste: jaNeinListe },
      { kopf: sp[11]!, breite: 14, typ: 'liste', liste: liste('status') },
      text(sp[12]!, 40),
    ]),
    zeilen: programmZeilen.map((z) => ohneIsmsSpalte(z)),
    leereZeilen: h.istLeer ? 6 : 3,
  };

  // Auditplan: Rahmenangaben (Spalten B und C), danach Ablauf
  // Plan zum jüngsten durchgeführten internen Audit, sonst zum nächsten geplanten (externe Audits plant die
  // Zertifizierungsstelle); spätere Jahre des Auditprogramms stehen nur im Blatt «Programm»
  const intern = projekt.audits.filter((a) => a.art === 'intern');
  const letztes = intern.filter((a) => a.durchgefuehrt).at(-1) ?? intern[0] ?? projekt.audits.at(-1);
  const rahmenVorschlag = u.roh(k('plan_rahmen')) as string[][];
  const rahmenWerte: (string | undefined)[] =
    h.istLeer || !letztes
      ? []
      : [
          `${letztes.id} ${u.t(k(`listen.art.${letztes.art}`))}`,
          letztes.ziel,
          verbinde([letztes.umfang, letztes.umfangControls?.length ? letztes.umfangControls.join(', ') : '', umfangProzesse(letztes)]),
          letztes.kriterien,
          [zeitraum(letztes), letztes.ort].filter(Boolean).join(', '),
          [letztes.auditor, letztes.unabhaengigkeit].filter(Boolean).join(', '),
          letztes.auditierte,
          letztes.methode,
          letztes.berichtAn,
        ];
  const rahmenZeilen: Zellwert[][] = rahmenVorschlag.map((r, i) => ['', r[0]!, rahmenWerte[i] || zelle(r[1]!), '', '']);
  // Ablauf: in der leeren Vorlage ein Vorschlag; im Firmendokument der Ablauf des Audits (agenda), kein Musterablauf
  const ablaufZeilen: Zellwert[][] = h.istLeer
    ? (u.roh(k('plan_ablauf')) as string[][]).map((r) => [r[0]!, r[1]!, r[2]!, r[3]!, ''])
    : letztes?.agenda?.trim()
      ? [['', u.t(k('ablauf')), letztes.agenda, '', '']]
      : [];
  const spPlan = u.liste(k('spalten_plan'));
  const plan: XlsxBlatt = {
    name: u.t(k('blaetter.plan')),
    titel: u.t(k('titel_plan')),
    hinweise: h.istLeer ? u.liste(k('hinweise_plan')) : undefined,
    spalten: [text(spPlan[0]!, 8, false), text(spPlan[1]!, 30), text(spPlan[2]!, 50), text(spPlan[3]!, 32), text(spPlan[4]!, 24)],
    zeilen: [...rahmenZeilen, ...(ablaufZeilen.length ? [[], ...ablaufZeilen] : [])],
    leereZeilen: 3,
  };

  // Checkliste: alle Abschnitte 4 bis 10 und alle Controls aus Anhang A. Spalte «SoA»: Stand zum Audit
  // (audits[].checkliste[].soaStand), sonst der aktuelle Stand; die Checkliste ist eine Aufzeichnung des Audits
  const soaStatus = (c: ControlEintrag) => (h.istLeer ? undefined : letztes?.checkliste?.[c.id]?.soaStand) ?? h.controlStatus(c);
  const soa = (id: string): string => {
    if (h.istLeer) return '';
    const c = projekt.controls.find((x) => x.id === id);
    if (!c) return u.t(k('soa.fehlt'));
    const basis = u.t(k(`soa.${c.anwendbar}`));
    if (c.anwendbar === 'nein') return c.begruendung ? `${basis}: ${c.begruendung}` : basis;
    if (c.anwendbar === 'ja') return `${basis}, ${u.t(k(`soa.status.${soaStatus(c)}`))}`;
    return basis;
  };
  // Feststellungen des jüngsten internen Audits je Normbezug: Ergebnis und Feststellung-ID in der Checkliste
  const einstufungen = ['nk-schwer', 'nk-leicht', 'beobachtung', 'verbesserung'];
  const ergebnisIndex: Record<string, number | undefined> = { 'nk-schwer': 3, 'nk-leicht': 2, beobachtung: 1 };
  const auditFest = h.istLeer || !letztes ? [] : projekt.feststellungen.filter((f) => f.quelle === 'audit' && f.audit === letztes.id);
  // Ergebnis je Prüfpunkt: Eintrag der Checkliste im Audit (audits[].checkliste), sonst schwerste Feststellung, sonst
  // «konform», wenn ein Nachweis gesehen wurde. Spalten F bis I: Nachweis gesehen, Stichprobe, Ergebnis, Feststellung-ID
  const checkIndex: Record<string, number> = { konform: 0, beobachtung: 1, 'nk-leicht': 2, 'nk-schwer': 3, 'nicht-geprueft': 4, 'nicht-pruefbar': 5 };
  // Letzter Audittag; Prüfpunkte, die erst danach belegbar sind (Managementbewertung, erste Überprüfung der Leitlinie,
  // geplante Controls), ergeben «nicht prüfbar, geplant» statt «konform»
  const auditEnde = letztes?.durchgefuehrtBis ?? letztes?.durchgefuehrt ?? letztes?.geplant;
  const mbVorAudit = !!auditEnde && projekt.managementbewertungen.some((m) => m.datum && m.datum <= auditEnde);
  const NACH_MB = ['9.3', 'A.2.4'];
  const nichtPruefbar = (bezug: string): boolean => {
    if (h.istLeer || !auditEnde) return false;
    if (NACH_MB.includes(bezug)) return !mbVorAudit;
    const c = projekt.controls.find((x) => x.id === bezug);
    return !!c && c.anwendbar === 'ja' && (soaStatus(c) === 'geplant' || soaStatus(c) === 'offen');
  };
  const ausAudit = (bezug: string, nachweisVorschlag = ''): [string, string, string, string] => {
    const eintrag = h.istLeer ? undefined : letztes?.checkliste?.[bezug];
    const treffer = auditFest.filter((f) => f.normbezug.split(/[,;]\s*/).map((x) => x.trim()).includes(bezug));
    // schwerste Einstufung bestimmt das Ergebnis; Verbesserungen ergeben kein Ergebnis
    const schwerste = treffer.length ? treffer.map((f) => einstufungen.indexOf(f.einstufung)).sort((a, b) => a - b)[0]! : -1;
    const ausFeststellung = schwerste >= 0 ? ergebnisIndex[einstufungen[schwerste]!] : undefined;
    const nachweis = eintrag?.nachweis ?? nachweisVorschlag;
    const idx = eintrag?.ergebnis
      ? checkIndex[eintrag.ergebnis]
      : (ausFeststellung ?? (nichtPruefbar(bezug) ? checkIndex['nicht-pruefbar'] : nachweis.trim() ? 0 : undefined));
    return [rollenAufloesen(nachweis), rollenAufloesen(eintrag?.stichprobe ?? ''), idx === undefined ? '' : liste('ergebnis')[idx]!, treffer.map((f) => f.id).join(', ')];
  };
  // Zusatz-Controls (EU AI Act, eigene Controls), die in der Erklärung zur Anwendbarkeit anwendbar sind: eigene Zeilen,
  // wenn das Audit alle anwendbaren Controls umfasst (umfangControls leer) oder sie nennt. Nachweis: Nachweise des Controls
  // bis zum Audit, sofern die Checkliste keinen nennt.
  const zusatzControls = h.istLeer || !letztes
    ? []
    : projekt.controls.filter(
        (c) => c.rahmenwerk !== 'ISO42001' && c.anwendbar === 'ja' && (!letztes.umfangControls?.length || letztes.umfangControls.includes(c.id)),
      );
  // Titel wie in der Erklärung zur Anwendbarkeit (D-11): EU AI Act, NIST AI RMF (RMF-xx, RMF-Gxx), eigene Controls
  const zusatzTitel = (id: string): string =>
    u.tOpt(`euaia.${id}.name`) ?? u.tOpt(`nist.controls.${id}.titel`) ?? projekt.eigeneControls.find((e) => e.id === id)?.titel ?? id;
  const nachweiseBis = (ids: string[]): string =>
    ids.filter((n) => { const d = projekt.nachweise.find((x) => x.id === n)?.datum; return !d || !auditEnde || d <= auditEnde; }).join(', ');
  // Firmendokument mit Normtexten der Firma (nach Bestätigung): Spalte mit dem Anforderungstext nach dem Titel
  const mitNorm = h.mitNormtext;
  const normSpalte = (id: string): Zellwert[] => (mitNorm ? [id ? (h.normAnforderung(id) ?? '') : ''] : []);
  const checkZeilen: Zellwert[][] = [
    ...alleAbschnitte42001(kataloge).map((a) => {
      const bezug = a.id.replace(/^K-/, '');
      return [bezug, h.normTitel(a.id), ...normSpalte(a.id), u.t(k(`fragen.${a.id}`)), dokVerweis(a.vorlagen), '', ...ausAudit(bezug)];
    }),
    ...alleControls42001(kataloge).map((c) => [
      c.id,
      h.normTitel(c.id),
      ...normSpalte(c.id),
      u.t(k(`fragen.${c.id}`)),
      dokVerweis(c.vorlagen),
      soa(c.id),
      ...ausAudit(c.id),
    ]),
    ...zusatzControls.map((c) => [c.id, zusatzTitel(c.id), ...normSpalte(''), u.t(k('frage_zusatz')), u.t(k('dokumente_zusatz')), soa(c.id), ...ausAudit(c.id, nachweiseBis(c.nachweise))]),
  ];
  // Spalte D: in der leeren Vorlage «Wo im Kit», im Firmendokument «Dokumente»
  const spCheck = u.liste(k('spalten_checkliste')).map((x, i) => (i === 3 && !h.istLeer ? u.t(k('spalte_dokumente')) : x));
  // Ergebnis und Einstufung farbig mit Wort: konform gut, Beobachtung Hinweis, NK leicht Handlung nötig, NK schwer kritisch,
  // nicht geprüft neutral (Reihenfolge der Listen ergebnis und einstufung)
  const ERGEBNIS_ROLLE: Farbrolle[] = ['status-gut', 'status-info', 'status-warnung', 'status-kritisch', 'status-neutral', 'status-neutral'];
  const EINSTUFUNG_ROLLE: Farbrolle[] = ['status-kritisch', 'status-warnung', 'status-info', 'status-gut'];
  const farben = (spalte: number, werte: string[], rollen: Farbrolle[]): XlsxFormat => ({
    art: 'text',
    spalte,
    regeln: werte.map((text, i) => ({ text, rolle: rollen[i] ?? 'status-neutral' })),
  });
  const ergebnisFarben = (spalte: number) => farben(spalte, liste('ergebnis'), ERGEBNIS_ROLLE);
  const checkliste: XlsxBlatt = {
    name: u.t(k('blaetter.checkliste')),
    titel: u.t(k('titel_checkliste')),
    hinweise: h.istLeer
      ? u.liste(k('hinweise_checkliste'))
      : [
          ...u.liste(k('hinweise_checkliste_firma')),
          ...(auditFest.length || letztes?.checkliste ? [u.t(k('hinweis_checkliste_audit'), { audit: letztes!.id })] : []),
          ...(Object.values(letztes?.checkliste ?? {}).some((e) => e.soaStand) ? [u.t(k('hinweis_soa_stand'), { audit: letztes!.id })] : []),
        ],
    fixiert: true,
    formate: [ergebnisFarben(mitNorm ? 8 : 7)],
    spalten: [
      text(spCheck[0]!, 9, false),
      text(spCheck[1]!, 28),
      ...(mitNorm ? [text(u.t('allgemein.normtext.spalte_anforderung'), 60)] : []),
      text(spCheck[2]!, 55),
      text(spCheck[3]!, 14),
      text(spCheck[4]!, 18),
      text(spCheck[5]!, 30),
      text(spCheck[6]!, 24),
      { kopf: spCheck[7]!, breite: 13, typ: 'liste', liste: liste('ergebnis') },
      text(spCheck[8]!, 12, false),
    ],
    zeilen: checkZeilen,
  };

  // Feststellungen
  const festZeilen: Zellwert[][] = h.istLeer
    ? []
    : projekt.feststellungen
        .filter((f) => f.quelle === 'audit')
        .map((f) => {
          const a = projekt.audits.find((x) => x.id === f.audit);
          const m = projekt.massnahmen.find((x) => f.massnahmen.includes(x.id));
          return [
            f.id,
            f.audit ?? '',
            h.datum(f.datum ?? a?.durchgefuehrtBis ?? a?.durchgefuehrt) ?? '',
            liste('einstufung')[einstufungen.indexOf(f.einstufung)]!,
            f.normbezug,
            f.beschreibung,
            f.nachweis ?? '',
            personName(m?.verantwortlich),
            // D-22 führt jede Feststellung: Nichtkonformitäten und Beobachtungen im Blatt «Nichtkonformitäten»,
            // Verbesserungen im Blatt «Verbesserungen» (Register aus denselben Projektdaten)
            jaNein(true),
          ];
        });
  const spFest = u.liste(k('spalten_feststellungen'));
  const feststellungen: XlsxBlatt = {
    name: u.t(k('blaetter.feststellungen')),
    titel: u.t(k('titel_feststellungen')),
    hinweise: h.istLeer ? u.liste(k('hinweise_feststellungen')) : undefined,
    fixiert: true,
    formate: [farben(3, liste('einstufung'), EINSTUFUNG_ROLLE)],
    spalten: [
      text(spFest[0]!, 12, false),
      text(spFest[1]!, 10, false),
      { kopf: spFest[2]!, breite: 12, typ: 'datum' },
      { kopf: spFest[3]!, breite: 14, typ: 'liste', liste: liste('einstufung') },
      text(spFest[4]!, 14),
      text(spFest[5]!, 50),
      text(spFest[6]!, 36),
      text(spFest[7]!, 18),
      { kopf: spFest[8]!, breite: 12, typ: 'liste', liste: jaNeinListe },
    ],
    zeilen: festZeilen,
    leereZeilen: h.istLeer ? 20 : 5,
  };

  // Stichproben: ein KI-System durch alle Schritte verfolgen und Stichprobentests mit Warnsignalen (gleiche Zeilen in
  // leerer Vorlage und Firmendokument; Nachweis und Ergebnis füllt das Audit)
  const spStich = u.liste(k('spalten_stichproben'));
  const stichproben: XlsxBlatt = {
    name: u.t(k('blaetter.stichproben')),
    titel: u.t(k('titel_stichproben')),
    hinweise: h.istLeer ? u.liste(k('hinweise_stichproben')) : undefined,
    fixiert: true,
    formate: [ergebnisFarben(5)],
    spalten: [
      text(spStich[0]!, 6, false),
      text(spStich[1]!, 24),
      text(spStich[2]!, 55),
      text(spStich[3]!, 40),
      text(spStich[4]!, 30),
      { kopf: spStich[5]!, breite: 13, typ: 'liste', liste: liste('ergebnis') },
    ],
    // Nachweis und Ergebnis je Zeile aus dem Audit (audits[].stichproben, Nummer der Zeile)
    zeilen: (u.roh(k('stichproben')) as string[][]).map((z, i) => {
      const sp = h.istLeer ? undefined : letztes?.stichproben?.find((x) => x.nr === i + 1);
      const idx = sp?.ergebnis ? checkIndex[sp.ergebnis] : undefined;
      return [String(i + 1), z[0]!, z[1]!, z[2]!, rollenAufloesen(sp?.nachweis ?? ''), idx === undefined ? '' : liste('ergebnis')[idx]!];
    }),
    leereZeilen: h.istLeer ? 3 : 0,
  };

  const id = eb ? 'D-20-EB' : 'D-20';
  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften(id),
    lenkung: h.lenkung(id),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), h.normverweis('9.2'), ...(h.istLeer ? h.ausbau(k('ausbau'), []) : [])],
    // Ergänzungsblatt, leere Vorlage: Plan und Feststellungen führt das ISMS bereits; ergänzt werden Programm und Checkliste.
    // Firmendokument im Pfad mit ISMS: Plan, Ergebnis und Feststellungen des AIMS sind Teil des Nachweises (9.2) und stehen hier.
    blaetter: eb && h.istLeer ? [programm, checkliste, stichproben] : [programm, plan, checkliste, stichproben, feststellungen],
  };
}

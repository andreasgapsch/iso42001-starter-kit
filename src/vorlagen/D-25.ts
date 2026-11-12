// D-25 Zertifizierungsfahrplan (Leitfaden, 9, 10; ISO/IEC 42006)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { alleAbschnitte42001, alleControls42001 } from '../kataloge/typen.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';
import { soaJeGruppe } from '../grafik/daten.ts';
import { fahrplanMatrix, soaDiagramm } from './grafik.ts';

export function d25(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt, kataloge } = ctx;
  const k = (s: string) => `vorlagen.D-25.${s}`;
  const org = projekt.organisation;
  const ueber = (nr: number, s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${nr} ${u.t(k(`abschnitte.${s}`))}` });
  const liste = (s: string): Block => ({ typ: 'liste', punkte: u.liste(k(s)).map((p) => md(p)) });
  const standD25 = h.dokFreigabe('D-25')?.am;
  const zertifiziert = !h.istLeer && projekt.audits.some((a) => !!a.zertifikatAm && (!standD25 || a.zertifikatAm <= standD25));
  const tabelle = (kopf: string, zeilen: string, breiten: number[]): Block => ({
    typ: 'tabelle',
    kopf: u.liste(k(kopf)),
    zeilen: (u.roh(k(zeilen)) as string[][]).map((z) => z.map((zelle) => md(zelle))),
    breiten,
  });

  // Stand der Voraussetzungen aus dem Projekt
  const stand = (i: number): Text => {
    if (h.istLeer) return [{ text: u.t(k('stand.platzhalter')), platzhalter: true }];
    const erfuellt = u.t(k('stand.erfuellt'));
    const offen = u.t(k('stand.offen'));
    switch (i) {
      case 0: {
        // Zusatz-Controls NIST AI RMF (Rahmenwerk NISTRMF) zählen getrennt: Sie sind freiwillig und kein Gegenstand der
        // Zertifizierung nach ISO/IEC 42001, stehen aber in der Erklärung zur Anwendbarkeit
        const anwendbar = projekt.controls.filter((c) => c.anwendbar === 'ja');
        const rmf = anwendbar.filter((c) => c.rahmenwerk === 'NISTRMF');
        const zert = anwendbar.filter((c) => c.rahmenwerk !== 'NISTRMF');
        if (!zert.length) return offen;
        const umgesetzt = (liste: typeof anwendbar) => liste.filter((c) => ['umgesetzt', 'wirksam'].includes(h.controlStatus(c))).length;
        const text = u.t(k('stand.controls'), { umgesetzt: umgesetzt(zert), gesamt: zert.length });
        return rmf.length && projekt.meta.modulNistRmf ? `${text}; ${u.t(k('stand.controls_rmf'), { umgesetzt: umgesetzt(rmf), gesamt: rmf.length })}` : text;
      }
      case 1:
        return org.geltungsbereich.freigabe && org.leitlinie.freigabe ? erfuellt : offen;
      case 2: {
        const durchgefuehrt = projekt.audits.filter((x) => x.art === 'intern' && x.durchgefuehrt);
        const a = durchgefuehrt.at(-1);
        if (!a) return offen;
        // «über alle Abschnitte und anwendbaren Controls» nur, wenn die Checklisten der durchgeführten internen Audits jeden
        // Prüfpunkt mit Nachweis oder Ergebnis führen; «nicht prüfbar» und «nicht geprüft» gelten als nicht auditiert
        // (z. B. 9.3 vor der ersten Managementbewertung). Ohne Checkliste im Projekt: Angabe des Audits.
        const datum = h.datum(a.durchgefuehrt)!;
        const mitListe = durchgefuehrt.filter((x) => x.checkliste);
        if (!mitListe.length) return u.t(k('stand.audit'), { datum });
        const punkte = [
          ...alleAbschnitte42001(kataloge).map((x) => x.id.replace(/^K-/, '')),
          ...projekt.controls.filter((c) => c.anwendbar === 'ja').map((c) => c.id),
        ];
        // 9.3 und A.2.4 sind erst nach einer Managementbewertung prüfbar (gleiche Regel wie die Checkliste in D-20)
        const NACH_MB = ['9.3', 'A.2.4'];
        const geprueft = (x: (typeof mitListe)[number], id: string) => {
          const e = x.checkliste![id];
          const ende = (x.durchgefuehrtBis ?? x.durchgefuehrt ?? '').slice(0, 10);
          if (NACH_MB.includes(id) && !e?.ergebnis && !projekt.managementbewertungen.some((m) => m.datum && m.datum <= ende)) return false;
          return !!e && (!!e.nachweis?.trim() || !!e.ergebnis) && e.ergebnis !== 'nicht-geprueft' && e.ergebnis !== 'nicht-pruefbar';
        };
        const imUmfang = (x: (typeof mitListe)[number], id: string) => /^\d/.test(id) || !x.umfangControls?.length || x.umfangControls.includes(id);
        const ohne = punkte.filter((id) => mitListe.some((x) => imUmfang(x, id)) && !mitListe.some((x) => geprueft(x, id)));
        // Lücken schliesst ein geplantes Ergänzungsaudit (intern, noch nicht durchgeführt): im Stand genannt
        const ergaenzung = projekt.audits.find((x) => x.art === 'intern' && !x.durchgefuehrt && x.geplant && (x.durchgefuehrt ?? x.geplant) > (a.durchgefuehrt ?? ''));
        const luecken = ohne.slice(0, 8).join(', ') + (ohne.length > 8 ? ', …' : '');
        if (ohne.length && ergaenzung) return u.t(k('stand.audit_ergaenzung'), { datum, anzahl: ohne.length, punkte: luecken, audit: ergaenzung.id, geplant: h.datum(ergaenzung.geplant)! });
        return ohne.length ? u.t(k('stand.audit_luecken'), { datum, anzahl: ohne.length, punkte: luecken }) : u.t(k('stand.audit'), { datum });
      }
      case 3: {
        const m = projekt.managementbewertungen.filter((x) => x.datum).at(-1);
        return m ? u.t(k('stand.bewertung'), { datum: h.datum(m.datum)! }) : offen;
      }
      default: {
        // Alle nicht geschlossenen Feststellungen wie im Register D-22, aufgeteilt nach Einstufung
        const offene = projekt.feststellungen.filter((f) => f.status !== 'geschlossen');
        if (!offene.length) return erfuellt;
        const arten = (['nk-schwer', 'nk-leicht', 'beobachtung', 'verbesserung'] as const)
          .map((e) => ({ e, n: offene.filter((f) => f.einstufung === e).length }))
          .filter((x) => x.n > 0)
          .map((x) => `${x.n} ${u.t(k(`stand.einstufung.${x.e}`))}${x.n > 1 && (x.e === 'beobachtung' || x.e === 'verbesserung') ? (u.sprache === 'de' ? 'en' : 's') : ''}`);
        return u.t(k('stand.feststellungen'), { anzahl: offene.length, details: arten.join(', ') });
      }
    }
  };
  const voraussetzungen = (u.roh(k('voraussetzungen')) as string[][]).map((z, i): Text[] => [z[0]!, stand(i), z[1]!]);

  const abschnittZeilen: Text[][] = alleAbschnitte42001(kataloge).map((a) => [
    a.id.replace(/^K-/, ''),
    h.normTitel(a.id),
    u.t(`anforderungen42001.abschnitte.${a.id}.nachweis`),
  ]);
  const wichtige = u.liste(k('wichtige_controls'));
  const controlZeilen: Text[][] = alleControls42001(kataloge)
    .filter((c) => wichtige.includes(c.id))
    .map((c) => [c.id, h.normTitel(c.id), `${u.t(`controls42001.controls.${c.id}.auditor`)} (${c.vorlagen.join(', ')})`]);

  // Zertifizierungsstelle: Angabe aus dem Geführten Modus (E13), sonst die Stelle des geplanten Stage-1-Audits
  const zert = (projekt.meta.gefuehrt.antworten['zertifizierung'] ?? {}) as { stelle?: string; akkreditiert?: boolean; kombiniert?: boolean };
  const stage = (art: string) => projekt.audits.find((a) => a.art === art);
  const stelle = h.istLeer ? undefined : zert.stelle?.trim() || stage('extern-stage1')?.auditor?.replace(/\s*\(.*\)\s*$/, '').trim() || undefined;
  const stelleListe = u.liste(k('stelle_liste'));
  // Firmendokument: gewählte Stelle statt «Offerten einholen»; den Absatz zum kombinierten Audit nur mit ISMS
  const stelleBloecke: Block[] = stelle
    ? [
        {
          typ: 'liste',
          punkte: [
            md(u.t(k('stelle_gewaehlt'), { stelle })),
            md(zert.akkreditiert ? u.t(k('stelle_akkreditiert')) : stelleListe[0]!),
            md(stelleListe[1]!),
            ...(projekt.meta.mitIsms ? [md(u.t(k(zert.kombiniert ? 'stelle_kombiniert' : 'stelle_isms_firma')))] : []),
          ],
        },
      ]
    : h.istLeer
      ? [liste('stelle_liste')]
      : [{ typ: 'liste', punkte: [...stelleListe.slice(0, 3), ...(projekt.meta.mitIsms ? [u.t(k('stelle_isms_firma'))] : [])].map((p) => md(p)) }];
  // Realistische Zeiträume: im Firmendokument nur die Zeilen des eigenen Pfads, dazu die eigenen Termine
  const zeitAlle = (u.roh(k('zeit')) as string[][]).map((z) => z.map((zelle) => md(zelle)));
  const zeitZeilen = zeitAlle;
  const termine = h.istLeer
    ? []
    : (['extern-stage1', 'extern-stage2'] as const)
        .map((art) => stage(art))
        .filter((a) => !!a && (a.geplant || a.durchgefuehrt))
        .map((a) => u.t(k('zeit_termin'), { audit: u.t(k(`zeit_audit.${a!.art}`)), datum: h.datum(a!.durchgefuehrt ?? a!.geplant)! }));

  const zieltermin = [
    ...(!h.istLeer && org.zielterminStage1 ? [{ typ: 'absatz', text: u.t(k('ziel_stage1'), { datum: h.datum(org.zielterminStage1)! }) } as Block] : []),
    ...(!h.istLeer && org.zielterminZertifizierung ? [{ typ: 'absatz', text: u.t(k('zieltermin'), { datum: h.datum(org.zielterminZertifizierung)! }) } as Block] : []),
  ];

  // Anlage «Fahrplan und Fortschritt»: Zeitraster der Audits mit Termin und Stand, Umsetzung der Controls je Gruppe
  const fahrplan = (): Block[] => {
    const g = (s: string) => `vorlagen.grafik.fahrplan.${s}`;
    const fortschritt = !h.istLeer && projekt.controls.some((c) => c.rahmenwerk === 'ISO42001');
    return h.grafikAnlage(u.t(g('titel')), [
      { typ: 'absatz', text: u.t(g('einleitung')) },
      ...(h.istLeer ? [{ typ: 'absatz', text: u.t(g('einleitung_leer')) } as Block] : []),
      fahrplanMatrix(ctx, h),
      ...(fortschritt ? [soaDiagramm(ctx, soaJeGruppe(projekt, kataloge.controls42001.gruppen))] : []),
    ]);
  };

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('9.2, 9.3, 10.2'),
    ...h.hinweis(k('hinweis_umfang')),
    { typ: 'absatz', text: h.istLeer ? u.t(k('einleitung')) : u.t(k('einleitung_firma'), { firma: org.name }) },
    ...(h.istLeer ? zieltermin : []),

    ueber(1, 'voraussetzungen'),
    { typ: 'tabelle', kopf: u.liste(k('voraussetzungen_kopf')), zeilen: voraussetzungen, breiten: [60, 20, 20] },

    stelle ? { typ: 'ueberschrift', ebene: 1, text: `2 ${u.t(k('stelle_titel_gewaehlt'))}` } : ueber(2, 'stelle'),
    ...stelleBloecke,

    ueber(3, 'ablauf'),
    { typ: 'ueberschrift', ebene: 2, text: u.t(k('stage1_titel')) },
    liste('stage1_liste'),
    { typ: 'ueberschrift', ebene: 2, text: u.t(k('stage2_titel')) },
    liste('stage2_liste'),

    ueber(4, 'feststellungen'),
    liste('feststellungen_liste'),

    ueber(5, 'zyklus'),
    { typ: 'absatz', text: u.t(k('zyklus_text')) },
    ...fahrplan(),

    // Firmendokument: Nachweise je Abschnitt im eigenen AIMS; allgemeine Hinweise (was Auditoren suchen, häufige
    // Feststellungen, Richtwerte für Zeiträume) nur in der leeren Vorlage, im Firmendokument der eigene Zeitplan
    ...(h.istLeer
      ? [
          ueber(6, 'nachweise'),
          { typ: 'absatz', text: u.t(k('nachweise_text')) } as Block,
          { typ: 'tabelle', kopf: u.liste(k('nachweise_kopf')), zeilen: abschnittZeilen, breiten: [8, 32, 60] } as Block,
          { typ: 'tabelle', kopf: u.liste(k('controls_kopf')), zeilen: controlZeilen, breiten: [10, 30, 60] } as Block,
          ueber(7, 'haeufig'),
          { typ: 'hinweis', art: 'ausfuellhinweis', text: u.t(k('haeufig_hinweis')) } as Block,
          tabelle('haeufig_kopf', 'haeufig', [50, 50]),
          ueber(8, 'zeit'),
          { typ: 'tabelle', kopf: u.liste(k('zeit_kopf')), zeilen: zeitZeilen, breiten: [36, 32, 32] } as Block,
          { typ: 'absatz', text: u.t(k('zeit_hinweis')) } as Block,
        ]
      : [
          { typ: 'ueberschrift', ebene: 1, text: `6 ${u.t(k('nachweise_titel_firma'))}` } as Block,
          { typ: 'absatz', text: u.t(k('nachweise_text_firma')) } as Block,
          { typ: 'tabelle', kopf: u.liste(k('nachweise_kopf')), zeilen: abschnittZeilen, breiten: [8, 32, 60] } as Block,
          ...(termine.length || zieltermin.length
            ? [
                { typ: 'ueberschrift', ebene: 1, text: `7 ${u.t(k('zeit_titel_firma'))}` } as Block,
                ...(termine.length ? [{ typ: 'absatz', text: u.t(k('zeit_plan'), { termine: termine.join(', ') }) } as Block] : []),
                ...zieltermin,
              ]
            : []),
        ]),
    // NIST AI RMF (nur mit Modul; leere Vorlage mit Kennzeichnung): keine Zertifizierung, Profil als Nachweis gegenüber Kunden
    ...(h.istLeer || projekt.meta.modulNistRmf
      ? [
          { typ: 'ueberschrift', ebene: 1, text: `${h.istLeer ? 9 : termine.length || zieltermin.length ? 8 : 7} ${u.t(k('abschnitte.nist'))}` } as Block,
          ...(h.istLeer ? [{ typ: 'absatz', text: md(`**${u.t(k('nist_praefix_leer'))}**`) } as Block] : []),
          // «das zertifizierte AIMS» erst nach erteiltem Zertifikat (audits[].zertifikatAm bis zum Dokumentdatum)
          { typ: 'liste', punkte: u.liste(k('nist_liste')).map((p) => md(p.replace('{aims}', u.t(k(zertifiziert ? 'nist_aims_zertifiziert' : 'nist_aims'))))) } as Block,
        ]
      : []),
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-25') },
    lenkung: h.lenkung('D-25'),
    eigenschaften: h.eigenschaften('D-25'),
    bloecke,
  });
}

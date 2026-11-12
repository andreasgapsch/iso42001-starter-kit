// D-04 Rollen, Verantwortlichkeiten und Meldewege (5.3, A.3). Mit ISMS als Ergänzungsblatt D-04-EB.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import { ENTSCHEIDE, RISIKOSTUFEN } from '../model/typen.ts';
import { erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';
import { ablaufVon, eintragVon, imProzesssystem, personHatRolle, prozesseImProjekt, rollenText } from '../prozesse/katalog.ts';
import { d27Prozesse } from './D-27.ts';

interface Bereich {
  id: string;
  name: string;
  aufgaben: string;
}

const MELDEWEG = ['meldestelle', 'kanal', 'ausweich', 'vertraulichkeit', 'schutz', 'frist', 'eskalation', 'erfassung', 'bekanntmachung'] as const;
/** Leere Vorlage: Bereiche der Zuständigkeitsmatrix über die Liste bereiche hinaus (A3-13, AF-102), Namen aus den Prozessrollen */
const BEREICHE_LEER = ['vorfall', 'entwicklung'] as const;
/** Rollen der Bahnen ohne eigene Zeile: Geschäftsleitung, AIMS-Verantwortung (Pflichtrollen) und alle Mitarbeitenden */
const BAHN_OHNE_ZEILE = new Set(['gl', 'aims', 'mitarbeitende']);

export function d04(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-04.${s}`;
  const org = projekt.organisation;
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-04-EB' : 'D-04';
  const pl = (s: string): Text => [{ text: s, platzhalter: true }];
  const datumOderPlatzhalter = (iso?: string) => h.datum(iso) ?? `[[${u.t('allgemein.platzhalter.datum')}]]`;
  const rolle = (bereich: string) => projekt.rollen.find((r) => r.bereich === bereich);
  const namen = (ids: string[]) => ids.map((p) => h.person(p)?.name ?? p).join(', ');

  // Pflichtrollen nach 5.3
  const konformitaet = rolle('konformitaet')?.verantwortlich;
  const bericht = rolle('berichterstattung')?.verantwortlich;
  const pflichtFehlt = !h.istLeer && (leer(konformitaet) || leer(bericht));
  const pflichtFelder = [
    { label: u.t(k('pflichtrollen.aims')), wert: h.personText(org.aimsVerantwortlich) },
    { label: u.t(k('pflichtrollen.konformitaet')), wert: h.personText(konformitaet) },
    { label: u.t(k('pflichtrollen.berichterstattung')), wert: h.personText(bericht) },
    { label: u.t(k('pflichtrollen.stellvertretung')), wert: h.personText(rolle('konformitaet')?.stellvertretung ?? rolle('berichterstattung')?.stellvertretung) },
  ];

  // RACI je Bereich. Die Bereich-IDs sind die Werte der Optionsgruppe rollenBereich (Geführter Modus, Rolle.bereich).
  // Mit ISMS: Informationssicherheit und Datenschutz bleiben mit Hinweis, die bestehende ISMS-Zuständigkeit zu übernehmen.
  const bereiche = u.roh(k('bereiche')) as Bereich[];
  const ISMS_BEREICHE = ['informationssicherheit', 'datenschutz'];
  const aufgaben = (b: Bereich) =>
    projekt.meta.mitIsms && ISMS_BEREICHE.includes(b.id) ? `${b.aufgaben} ${u.t(k(h.istLeer ? 'isms_zustaendigkeit' : 'isms_zustaendigkeit_firma'))}` : b.aufgaben;
  // Internes Audit ohne Eintrag in der Matrix: die Auditorin oder der Auditor des letzten internen Audits (D-20)
  const letzterAuditor = projekt.audits.filter((a) => a.art === 'intern' && a.auditor.trim()).at(-1)?.auditor.trim();
  let raciFehlt = false;
  const raciZeile = (b: Bereich): Text[] => {
    const r = rolle(b.id);
    const auditor = b.id === 'internes-audit' && !r?.verantwortlich && letzterAuditor ? u.t(k('audit_aus_programm'), { auditor: letzterAuditor }) : undefined;
    if ((!r?.verantwortlich && !auditor) || (!r?.rechenschaft && !auditor)) raciFehlt = true;
    // In der Matrix nur Namen (Funktionen stehen bei den Pflichtrollen und im Organigramm), damit die Tabelle schmal bleibt
    const name = (id?: string): Text => (h.person(id) ? h.person(id)!.name : h.personText(id));
    // Rechenschaft für das interne Audit ohne Eintrag: die Person, die für die Konformität des AIMS rechenschaftspflichtig ist
    const rechenschaft = r?.rechenschaft ?? (auditor ? rolle('konformitaet')?.rechenschaft ?? rolle('konformitaet')?.verantwortlich : undefined);
    // Stellvertretung in eigener Spalte (Grundsatz: jede Rolle hat eine Stellvertretung; Kennzahl PR-03, AF-102)
    const stv: Text = r?.stellvertretung ? name(r.stellvertretung) : '';
    return [b.name, aufgaben(b), auditor ?? name(r?.verantwortlich), name(rechenschaft), stv, namen(r?.konsultiert ?? []), namen(r?.informiert ?? [])];
  };
  // Weitere Bereiche aus dem Projekt ohne eigene Zeile (z. B. Vorfälle, Entwicklung); Pflichtrollen stehen oben
  const PFLICHT = ['konformitaet', 'berichterstattung'];
  // Leere Vorlage: Vorfälle und Meldungen, Entwicklung von KI (mit dem Fall ohne eigene Entwicklung) als feste Zeilen
  const zusatz: Bereich[] = h.istLeer
    ? BEREICHE_LEER.map((id) => ({ id, name: rollenText(u, id), aufgaben: u.t(k(`aufgaben_zusatz_leer.${id}`)) }))
    : [...new Set(projekt.rollen.map((r) => r.bereich))]
        .filter((id) => !PFLICHT.includes(id) && !bereiche.some((b) => b.id === id))
        .map((id) => {
          // Ohne eigene Entwicklung (keine Eigenentwicklung, kein eigenes Training): Bereich «Entwicklung» als Einführung eingekaufter Systeme
          const ohneEntwicklung = id === 'entwicklung' && !org.entwickeltKi && !projekt.kiSysteme.some((s) => s.typ === 'eigenbau' || s.eigenesTraining === true);
          return ohneEntwicklung
            ? { id, name: u.t(k('ohne_entwicklung.name')), aufgaben: u.t(k('ohne_entwicklung.aufgaben')) }
            : { id, name: u.tOpt(`gefuehrt.optionen.rollenBereich.${id}`) ?? id, aufgaben: u.tOpt(k(`aufgaben_zusatz.${id}`)) ?? '' };
        });
  const raciZeilen: Text[][] = h.istLeer ? [...bereiche, ...zusatz].map((b) => [b.name, aufgaben(b), '', '', '', '', '']) : [...bereiche, ...zusatz].map(raciZeile);

  // Leere Vorlage: Rollen der Bahnen in den Abläufen (D-27) ohne Zeile in der Matrix, z. B. Fachbereich, IT, Personal,
  // Kommunikation, Eigner/in des KI-Systems (A3-13, AF-102). Rollen und Prozesse aus dem Katalog, Aufgaben aus den Texten.
  const bahnRollenLeer: Text[][] = (() => {
    if (!h.istLeer) return [];
    const abgedeckt = new Set<string>([...bereiche.map((b) => b.id), ...BEREICHE_LEER, ...PFLICHT, ...BAHN_OHNE_ZEILE]);
    const je = new Map<string, string[]>();
    for (const kp of d27Prozesse(ctx)) {
      const a = ablaufVon(u, kp, undefined);
      for (const st of a.schritte) {
        const rolle = a.bahnen.find((x) => x.id === st.bahn)?.rolle ?? st.bahn;
        if (abgedeckt.has(rolle)) continue;
        const l = je.get(rolle) ?? [];
        if (!l.includes(kp.id)) l.push(kp.id);
        je.set(rolle, l);
      }
    }
    const reihenfolge = Object.keys((u.roh(k('bahnrollen_aufgaben')) as Record<string, string> | undefined) ?? {});
    const rang = (r: string) => (reihenfolge.includes(r) ? reihenfolge.indexOf(r) : reihenfolge.length);
    return [...je]
      .sort(([a], [b]) => rang(a) - rang(b) || a.localeCompare(b))
      .map(([rolle, prozesse]) => [
        rollenText(u, rolle),
        u.tOpt(k(`bahnrollen_aufgaben.${rolle}`)) ?? '',
        prozesse.sort().join(', '),
        rolle === 'ki-eigner' ? u.t(k('prozessrollen_ki_eigner')) : '',
        '',
      ]);
  })();

  // Gremien (organisation.gremien) und Meldeweg (organisation.meldeweg); ohne Angaben Vorschläge mit Platzhaltern
  const gremien = h.istLeer ? [] : (org.gremien ?? []);
  const gremienZeilen: Text[][] = gremien.length
    ? gremien.map((g) => [g.name, g.themen, h.wert(g.rhythmus, 'text'), h.personText(g.vorsitz)])
    : (u.roh(k('gremien_vorschlag')) as string[][]).map((z) => z.map((zelle) => md(zelle)));
  const mw = h.istLeer ? undefined : org.meldeweg;
  const kanal = mw?.kanal || (mw?.kanaele?.length ? mw.kanaele.map((c) => u.tOpt(`gefuehrt.optionen.meldekanal.${c}`) ?? c).join(', ') : undefined);
  const frist =
    mw?.fristTage !== undefined && mw.fristErgebnisTage !== undefined
      ? u.t(k('meldeweg_frist.beide'), { tage: String(mw.fristTage), ergebnis: String(mw.fristErgebnisTage) })
      : mw?.fristTage !== undefined
        ? u.t(k('meldeweg_frist.bestaetigung'), { tage: String(mw.fristTage) })
        : mw?.fristErgebnisTage !== undefined
          ? u.t(k('meldeweg_frist.ergebnis'), { ergebnis: String(mw.fristErgebnisTage) })
          : undefined;
  // Meldestelle (organisation.meldestelle): auf sie verweisen D-12, D-13, D-14 und D-15
  const meldestelle = h.istLeer ? undefined : org.meldestelle;
  const meldewegWert: Partial<Record<(typeof MELDEWEG)[number], Text | undefined>> = mw
    ? {
        meldestelle,
        kanal,
        ausweich: mw.ausweichstelle ? h.personText(mw.ausweichstelle) : undefined,
        vertraulichkeit: mw.vertraulich === false ? u.t(k('meldeweg_nicht_vertraulich')) : undefined,
        frist,
        eskalation: mw.eskalation,
        bekanntmachung: mw.bekanntmachung,
      }
    : { meldestelle };
  const meldewegFelder = MELDEWEG.map((f) => ({ label: u.t(k(`meldeweg_felder.${f}`)), wert: leer(meldewegWert[f]) ? md(u.t(k(`meldeweg_werte.${f}`))) : meldewegWert[f]! }));

  // Rollen der Prozesse (Bahnen in D-27), die kein Bereich der Zuständigkeitsmatrix ist (z. B. IT, Einkauf, Kommunikation,
  // Eigner/in des KI-Systems, eigene Bahnen wie «Kundendienst»): mit den Personen, damit jede Bahn auf eine Rolle zurückgeht
  const prozessRollen: string[] = (() => {
    if (h.istLeer || projekt.prozesse === undefined) return [];
    const bereiche = new Set(projekt.rollen.map((r) => r.bereich));
    const zeilen = new Map<string, string>();
    for (const kp of prozesseImProjekt(projekt, ctx.kataloge).filter((x) => imProzesssystem(projekt, x))) {
      const a = ablaufVon(u, kp, eintragVon(projekt, kp.id));
      for (const b of a.bahnen.filter((x) => a.schritte.some((st) => st.bahn === x.id))) {
        const rolle = b.rolle ?? b.id;
        if (bereiche.has(rolle) || rolle === 'gl' || rolle === 'aims') continue;
        const eigen = b.text?.trim() && b.text.trim() !== rollenText(u, rolle) ? b.text.trim() : undefined;
        const name = eigen ? `${eigen} (${rollenText(u, rolle)})` : rollenText(u, rolle);
        if (zeilen.has(name)) continue;
        // Eigene Bahn (z. B. «Kundendienst»): Personen, deren Funktion die Bahn nennt; sonst alle mit dieser Funktion
        const mitFunktion = projekt.personen.filter((x) => personHatRolle(x, rolle));
        const passend = eigen ? mitFunktion.filter((x) => x.funktion.toLowerCase().includes(eigen.toLowerCase())) : [];
        const personen = b.person ? [b.person] : (passend.length ? passend : mitFunktion).map((x) => x.id);
        const wer =
          rolle === 'ki-eigner'
            ? u.t(k('prozessrollen_ki_eigner'))
            : rolle === 'mitarbeitende'
              ? u.t(k('prozessrollen_alle'))
              : personen.length
                ? personen.map((x) => { const pe = h.person(x); return pe ? `${pe.name}, ${pe.funktion}` : x; }).join('; ')
                : u.t(k('prozessrollen_offen'));
        zeilen.set(name, `${name}: ${wer}`);
      }
    }
    return [...zeilen.values()];
  })();

  const ebDok = h.istLeer ? undefined : h.dokEintrag(id);

  // Entscheidungsrechte nach Risikostufe (organisation.entscheidungsrechte), sonst Vorschlag je Entscheid und Stufe
  const rechte = h.istLeer ? [] : (org.entscheidungsrechte ?? []);
  const werText = (w?: string): Text | undefined => {
    if (leer(w)) return undefined;
    const p = h.person(w);
    return p ? `${p.name}${p.funktion ? `, ${p.funktion}` : ''}` : w!;
  };
  const rechteZeilen: Text[][] = ENTSCHEIDE.map((e) => {
    const r = rechte.find((x) => x.entscheid === e);
    const vorschlag = u.liste(k(`entscheidungsrechte_vorschlag.${e}`));
    return [u.t(k(`entscheide.${e}`)), ...RISIKOSTUFEN.map((st, i) => werText(r?.wer[st]) ?? md(vorschlag[i]!))];
  });
  const rechteBloecke = (ueberschrift: (s: string) => Block): Block[] => [
    ueberschrift('entscheidungsrechte'),
    { typ: 'absatz', text: u.t(k('entscheidungsrechte_text')) },
    ...h.hinweis(k('hinweis_entscheidungsrechte')),
    { typ: 'tabelle', kopf: u.liste(k('entscheidungsrechte_kopf')), zeilen: rechteZeilen, breiten: [22, 26, 26, 26] },
    // Firmendokument mit nächsthöherer Stelle (organisation.naechsthoehereStelle): sie entscheidet, wenn die Geschäftsleitung selbst betroffen ist
    { typ: 'absatz', text: md(!h.istLeer && org.naechsthoehereStelle?.trim() ? u.t(k('keine_selbstfreigabe_stelle'), { stelle: org.naechsthoehereStelle.trim() }) : u.t(k('keine_selbstfreigabe'))) },
    ueberschrift('aufsicht'),
    { typ: 'absatz', text: u.t(k('aufsicht_text')) },
    { typ: 'liste', punkte: u.liste(k('aufsicht_pruefpunkte')).map((x) => md(x)) },
    { typ: 'absatz', text: u.t(k('aufsicht_abnicken')) },
  ];

  let n = 0;
  const titel = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++n} ${u.t(k(`abschnitte.${s}`))}` });

  // Reihenfolge der Nummern: Grundsätze nur im eigenen Dokument, davor
  const grundsaetze: Block[] = eb ? [] : [titel('grundsaetze'), { typ: 'liste', punkte: u.liste(k('grundsaetze')) }];
  const kern: Block[] = [
    titel('pflichtrollen'),
    ...h.hinweis(k('hinweis_pflichtrollen'), pflichtFehlt),
    ...(pflichtFehlt ? h.hinweis(k('pflichtrollen_fehlen'), true) : []),
    { typ: 'felder', felder: pflichtFelder },

    titel('raci'),
    ...h.hinweis(k('hinweis_raci')),
    ...(raciFehlt ? h.hinweis(k('raci_fehlen'), true) : []),
    { typ: 'tabelle', kopf: u.liste(k('raci_kopf')), zeilen: raciZeilen, breiten: [16, 32, 11, 11, 12, 9, 9] },
    ...(prozessRollen.length ? [{ typ: 'absatz', text: u.t(k('prozessrollen')) } as Block, { typ: 'liste', punkte: prozessRollen } as Block] : []),
    // Leere Vorlage: eigener Abschnitt für die Rollen der Prozessbahnen (Querbezug D-04/D-27, AF-073)
    ...(bahnRollenLeer.length
      ? [
          titel('bahnrollen'),
          ...h.hinweis(k('hinweis_bahnrollen')),
          { typ: 'tabelle', kopf: u.liste(k('bahnrollen_kopf')), zeilen: bahnRollenLeer, breiten: [17, 37, 16, 18, 12] } as Block,
        ]
      : []),
    // Entscheidungsrechte und Aufsicht in Anlage A (Seitenlimit: Hauptteil höchstens 4 Seiten); seit P14 auch in der leeren
    // Vorlage, die mit den Bereichen Vorfälle und Entwicklung und den Rollen der Prozessbahnen gewachsen ist (AF-102)
    { typ: 'absatz', text: u.t(k('anlage_verweis')) },

    titel('gremien'),
    ...h.hinweis(k('hinweis_gremien')),
    { typ: 'tabelle', kopf: u.liste(k('gremien_kopf')), zeilen: gremienZeilen, breiten: [22, 40, 18, 20], leereZeilen: h.istLeer ? 1 : 0 },
    // Ausbaustufe eigenes KI-Gremium: nur als Anregung, solange das Unternehmen keine Gremien erfasst hat
    ...(gremien.length ? [] : h.ausbau(k('ausbau_gremien'), [])),

    titel('meldeweg'),
    ...h.hinweis(k('hinweis_meldeweg')),
    { typ: 'felder', felder: meldewegFelder },
  ];

  const bloecke: Block[] = eb
    ? [
        ...h.kitBlock(),
        h.normverweis('5.3, A.3.2, A.3.3'),
        { typ: 'absatz', text: h.istLeer ? u.t(k('eb_einleitung')) : u.t(k('eb_einleitung_firma'), { firma: org.name }) },
        {
          typ: 'felder',
          felder: [
            { label: u.t(k('eb_felder.dokument')), wert: ebDok?.aufgenommenIn ? ebDok.aufgenommenIn : pl(u.t(k('eb_platzhalter.dokument'))) },
            {
              label: u.t(k('eb_felder.version')),
              wert: ebDok?.freigabe ? `${ebDok.version}, ${h.datum(ebDok.freigabe.am)}` : pl(u.t(k('eb_platzhalter.version'))),
            },
          ],
        },
        ...kern,
      ]
    : [
        ...h.kitBlock(),
        h.normverweis('5.3, A.3.2, A.3.3'),
        { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
        ...grundsaetze,
        ...kern,
        titel('freigabe'),
        { typ: 'absatz', text: md(u.t(k('freigabe_text'), { datum: datumOderPlatzhalter(h.dokEintrag('D-04')?.freigabe?.am) })) },
        h.unterschriften([h.dokEintrag('D-04')?.freigabe], 2),
      ];

  bloecke.push(
    { typ: 'seitenumbruch' },
    { typ: 'ueberschrift', ebene: 1, text: u.t('allgemein.anlage.titel', { nr: 'A', titel: u.t(k('anlage_titel')) }) },
    ...rechteBloecke((s) => ({ typ: 'ueberschrift', ebene: 2, text: u.t(k(`abschnitte.${s}`)) })),
  );

  return {
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile(id) },
    lenkung: h.lenkung(id),
    eigenschaften: h.eigenschaften(id),
    bloecke,
  };
}

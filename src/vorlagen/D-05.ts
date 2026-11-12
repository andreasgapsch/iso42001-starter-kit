// D-05 KI-Ziele, Kennzahlen und Messplan (6.2, 9.1, A.6.1.2, A.9.3). Übernimmt die gestrichene D-19.
import { imDashboard, kz01Stand, kz01Text, prozessStaende } from '../prozesse/stand.ts';
import { prozessKatalog, prozessTexte, sichtImPfad, sollText } from '../prozesse/katalog.ts';
import type { XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { erstelleHelfer, klartext, type VorlagenKontext } from './kontext.ts';

export function d05(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-05.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const hinweise = (s: string) => u.liste(k(s)).map((t) => klartext(t));
  const personName = (id?: string) => {
    const p = projekt.personen.find((x) => x.id === id);
    return p ? p.name : (id ?? '');
  };
  /** Vorschlagszeilen aus YAML: Auszeichnung entfernen, Platzhalter in eckigen Klammern */
  const vorschlag = (s: string): Zellwert[][] => (u.roh(k(s)) as string[][]).map((z) => z.map((zelle) => klartext(zelle)));

  // In Firmendokumenten erscheinen die Vorschläge nur, solange keine Ziele erfasst sind
  const mitVorschlag = h.istLeer || projekt.ziele.length === 0;

  // Werte der Listen im Modell (Ziel.status, Messung.sollErreicht) und ihre Beschriftung (gleiche Reihenfolge)
  const STATUS = ['geplant', 'in-arbeit', 'erreicht', 'nicht-erreicht', 'verworfen'];
  const ERREICHT = ['ja', 'teilweise', 'nein'];
  const label = (werte: string[], liste_: string, w?: string) => (w && werte.includes(w) ? liste(liste_)[werte.indexOf(w)]! : '');
  const rhythmus = (w: string) => u.tOpt(`gefuehrt.optionen.rhythmus.${w}`) ?? w;
  const zielZeilen: Zellwert[][] = mitVorschlag
    ? vorschlag('ziele_vorschlag')
    : projekt.ziele.map((z) => [z.id, z.ziel, z.bezugLeitlinie ?? '', z.kennzahl, z.sollwert, z.massnahmen ?? '', z.ressourcen, personName(z.verantwortlich), z.termin ?? null, z.bewertung, label(STATUS, 'status', z.status), (z.kiSysteme ?? []).join(', ')]);

  const aimsName = personName(projekt.organisation.aimsVerantwortlich);
  // Weitere Messungen ohne eigenes Ziel: Zeilen KZ-01 bis KZ-06 der Vorlage, Angaben aus projekt.kennzahlen (gleiche ID)
  // ersetzen die Vorlage, weitere Kennzahlen folgen. Firmendokument ohne Angabe: neutraler Text statt Platzhalter-Vorgabe
  // (z. B. keine Stichprobengrösse aus der Vorlage), Personen aus der AIMS-Verantwortung.
  const kzId = (i: number) => `KZ-${String(i + 1).padStart(2, '0')}`;
  const kennzahlen = h.istLeer ? [] : (projekt.kennzahlen ?? []);
  const neutral = (u.roh(k('messplan_weitere_neutral')) ?? {}) as Record<string, string>;
  const ohnePlatzhalter = (zelle: Zellwert): Zellwert => (typeof zelle === 'string' ? zelle.replace(/\[([^\]]*)\]/g, '$1') : zelle);
  const vorlageWeitere = (u.roh(k('messplan_weitere')) as string[][]).map((z, i): Zellwert[] => {
    const id = kzId(i);
    const kz = kennzahlen.find((x) => x.id === id);
    const basis = z.map((zelle, j) => (h.istLeer ? klartext(zelle) : !h.istLeer && neutral[`${i}.${j}`] ? neutral[`${i}.${j}`]! : klartext(zelle)));
    const person = (pid: string | undefined, j: number) => (pid ? personName(pid) : h.istLeer ? basis[j]! : aimsName);
    const zeile: Zellwert[] = [
      id,
      kz?.kennzahl || basis[1]!,
      kz?.messmethode || basis[2]!,
      kz?.haeufigkeit ? rhythmus(kz.haeufigkeit) : basis[3]!,
      person(kz?.werMisst, 4),
      kz?.auswertungWann || basis[5]!,
      person(kz?.werWertetAus, 6),
      kz?.empfaenger || basis[7]!,
    ];
    return h.istLeer ? zeile : zeile.map(ohnePlatzhalter);
  });
  const eigeneWeitere: Zellwert[][] = kennzahlen
    .filter((x) => !/^KZ-0[1-6]$/.test(x.id))
    .map((x) => [x.id, x.kennzahl ?? '', x.messmethode ?? '', x.haeufigkeit ? rhythmus(x.haeufigkeit) : '', personName(x.werMisst), x.auswertungWann ?? '', personName(x.werWertetAus), x.empfaenger ?? '']);
  // Kennzahlen der Prozesse (D-27) ohne zugeordnete Messung: im Messplan mit Sollwert, gemessen vom Eigner im Rhythmus des
  // Prozesses; so steht jede Prozesskennzahl im Messplan (9.1), auch bevor ein erster Messwert vorliegt
  const stichtag = projekt.meta.geaendert.slice(0, 10);
  // Methode und Quelle je Prozesskennzahl (i18n prozesse.<id>.kennzahl_methode), sonst der allgemeine Satz
  const prozessMethode = (id: string): string => u.tOpt(`prozesse.prozesse.${id}.kennzahl_methode`) ?? u.t(k('messplan_prozess_methode'));
  const leereProzesse = (): Zellwert[][] =>
    prozessKatalog(ctx.kataloge)
      .prozesse.filter((p) => p.kennzahl_vorschlag && ['aims', 'minimal'].includes(sichtImPfad(p, false)))
      .map((p) => [
        p.id,
        u.t(k('messplan_prozess'), { kennzahl: prozessTexte(u, p.id, projekt)?.kennzahl ?? '', soll: sollText((x, w) => u.t(x, w), p.kennzahl_vorschlag!) }),
        prozessMethode(p.id),
        p.rhythmus ? rhythmus(p.rhythmus) : u.t('prozesse.felder.ereignis'),
        klartext(u.t('vorlagen.D-05.messplan_prozess_eigner')),
        u.t(k('messplan_prozess_wann')),
        klartext(u.t('vorlagen.D-05.messplan_prozess_eigner')),
        u.t(k('messplan_prozess_empfaenger')),
      ]);
  const prozessWeitere: Zellwert[][] =
    h.istLeer
      ? leereProzesse()
      : projekt.prozesse === undefined
      ? []
      : prozessStaende(projekt, ctx.kataloge, stichtag)
          .filter((st) => imDashboard(st) && (!st.eintrag?.kennzahl || st.eintrag.kennzahl === st.id) && st.katalog.kennzahl_vorschlag)
          .map((st) => {
            const tx = prozessTexte(u, st.id, projekt);
            const soll = sollText((x, w) => u.t(x, w), st.katalog.kennzahl_vorschlag!);
            return [
              st.id,
              u.t(k('messplan_prozess'), { kennzahl: tx?.kennzahl ?? '', soll }),
              prozessMethode(st.id),
              st.rhythmus ? rhythmus(st.rhythmus) : u.t('prozesse.felder.ereignis'),
              personName(st.eigner),
              u.t(k('messplan_prozess_wann')),
              aimsName,
              u.t(k('messplan_prozess_empfaenger')),
            ];
          });
  const weitere = [...vorlageWeitere, ...eigeneWeitere, ...prozessWeitere];
  const messplanZeilen: Zellwert[][] = [
    ...(mitVorschlag
      ? vorschlag('messplan_vorschlag')
      : projekt.ziele.map((z) => [z.id, z.kennzahl, z.messmethode, rhythmus(z.haeufigkeit), personName(z.werMisst ?? z.verantwortlich), z.auswertungWann ?? '', personName(z.werWertetAus), z.empfaenger ?? ''])),
    ...weitere,
  ];

  const messwertZeilen: Zellwert[][] = h.istLeer
    ? []
    : [
        ...projekt.ziele.flatMap((z) => z.messungen.map((m): Zellwert[] => [z.id, m.datum, m.wert, label(ERREICHT, 'erreicht', m.sollErreicht) || null, m.bemerkung ?? ''])),
        // Messwerte der weiteren Kennzahlen (KZ-xx), nach Kennzahl und Datum
        ...[...(projekt.kennzahlMessungen ?? [])]
          .sort((a, b) => a.kennzahl.localeCompare(b.kennzahl, 'de', { numeric: true }) || a.datum.localeCompare(b.datum))
          // KZ-01 ohne erfassten Wert: Stand der Erklärung zur Anwendbarkeit (D-11), damit beide übereinstimmen
          .map((m): Zellwert[] => [m.kennzahl, m.datum, m.kennzahl === 'KZ-01' && !m.wert.trim() ? kz01Text((x, w) => u.t(x, w), kz01Stand(projekt)) : m.wert, label(ERREICHT, 'erreicht', m.sollErreicht) || null, m.bemerkung ?? '']),
      ];

  // Bewusst nicht gemessen (organisation.nichtGemessen); leere Vorlage: Beispielzeile mit Platzhaltern
  const nichtGemessenZeilen: Zellwert[][] = h.istLeer
    ? vorschlag('nicht_gemessen_vorschlag')
    : (projekt.organisation.nichtGemessen ?? []).map((n) => [n.was, n.begruendung]);

  const text = (kopf: string, breite: number, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const sz = u.liste(k('spalten_ziele'));
  const sm = u.liste(k('spalten_messplan'));
  const sw = u.liste(k('spalten_messwerte'));

  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften('D-05'),
    lenkung: h.lenkung('D-05'),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), h.normverweis('6.2, 9.1, A.6.1.2, A.9.3'), ...h.ausbau(k('ausbau_leistung'), [])],
    blaetter: [
      {
        name: u.t(k('blaetter.ziele')),
        titel: u.t(k('titel_ziele')),
        hinweise: mitVorschlag ? hinweise('hinweise_ziele') : undefined,
        fixiert: true,
        spalten: [
          text(sz[0]!, 8, false),
          text(sz[1]!, 34),
          text(sz[2]!, 20),
          text(sz[3]!, 24),
          text(sz[4]!, 14),
          text(sz[5]!, 32),
          text(sz[6]!, 16),
          text(sz[7]!, 18),
          { kopf: sz[8]!, breite: 12, typ: 'datum' },
          text(sz[9]!, 24),
          { kopf: sz[10]!, breite: 13, typ: 'liste', liste: liste('status') },
          text(sz[11]!, 16),
        ],
        zeilen: zielZeilen,
        leereZeilen: h.istLeer ? 6 : 4,
      },
      {
        name: u.t(k('blaetter.messplan')),
        titel: u.t(k('titel_messplan')),
        hinweise: h.istLeer ? hinweise('hinweise_messplan') : undefined,
        fixiert: true,
        spalten: [
          text(sm[0]!, 8, false),
          text(sm[1]!, 30),
          text(sm[2]!, 32),
          { kopf: sm[3]!, breite: 14, typ: 'liste', liste: liste('haeufigkeit') },
          text(sm[4]!, 18),
          text(sm[5]!, 18),
          text(sm[6]!, 18),
          text(sm[7]!, 18),
        ],
        zeilen: messplanZeilen,
        leereZeilen: h.istLeer ? 6 : 4,
      },
      {
        name: u.t(k('blaetter.messwerte')),
        titel: u.t(k('titel_messwerte')),
        hinweise: h.istLeer ? hinweise('hinweise_messwerte') : undefined,
        fixiert: true,
        spalten: [
          text(sw[0]!, 10, false),
          { kopf: sw[1]!, breite: 12, typ: 'datum' },
          text(sw[2]!, 16),
          { kopf: sw[3]!, breite: 14, typ: 'liste', liste: liste('erreicht') },
          text(sw[4]!, 50),
        ],
        zeilen: messwertZeilen,
        leereZeilen: h.istLeer ? 40 : 20,
      },
      {
        name: u.t(k('blaetter.nicht_gemessen')),
        titel: u.t(k('titel_nicht_gemessen')),
        hinweise: h.istLeer ? hinweise('hinweise_nicht_gemessen') : undefined,
        fixiert: true,
        spalten: [text(u.liste(k('spalten_nicht_gemessen'))[0]!, 40), text(u.liste(k('spalten_nicht_gemessen'))[1]!, 60)],
        zeilen: nichtGemessenZeilen,
        leereZeilen: h.istLeer ? 6 : 3,
      },
    ],
  };
}

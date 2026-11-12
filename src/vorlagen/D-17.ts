// D-17 Kompetenz, Bewusstsein und Kommunikation (7.2 bis 7.4, A.4.6); übernimmt die gestrichene D-18
// Form «ergaenzungsblatt»: Ergänzung des bestehenden Schulungs- und Awareness-Programms im ISMS (D-17-EB)
import type { Block, XlsxBlatt, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import { erstelleHelfer, klartext, md, type VorlagenKontext } from './kontext.ts';

export function d17(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-17.${s}`;
  const eb = ctx.form === 'ergaenzungsblatt';
  const id = eb ? 'D-17-EB' : 'D-17';
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  // Vorschlagswerte gelten als Festlegung, sobald die Firma das Dokument freigegeben hat (ohne Platzhalter-Markierung)
  const festgelegt = !h.istLeer && h.dokEintrag(id)?.status === 'freigegeben';
  const vorschlag = (s: string): Zellwert[][] =>
    (u.roh(k(s)) as string[][]).map((z) => z.map((zelle) => klartext(festgelegt ? zelle.replace(/\[\[(.+?)\]\]/g, '$1') : zelle)));
  const modul = h.istLeer || projekt.meta.modulAiAct;
  const personName = (pid?: string) => projekt.personen.find((p) => p.id === pid)?.name ?? pid ?? '';
  // Personen einer Kompetenz: Einträge aus personen und weitere ohne eigenen Eintrag (Kompetenz.gruppe)
  // Benannte Personen, danach (mit Strichpunkt getrennt) die Gruppe ohne Namen
  const personenText = (m: (typeof projekt.kompetenzen)[number]) => [m.personen.map((p) => personName(p)).join(', '), m.gruppe?.trim()].filter(Boolean).join('; ');
  // Datum einer Schulung aus dem Nachweis (Monat «MM/JJJJ»), sonst leer
  const monat = (nachweis: string): string | null => /\b(\d{2}\/\d{4})\b/.exec(nachweis)?.[1] ?? null;

  // Kompetenzbedarf: aus dem Projekt, sonst Vorschläge
  const spK = u.liste(k('spalten_kompetenz'));
  const kompetenzZeilen: Zellwert[][] =
    !h.istLeer && projekt.kompetenzen.length
      ? projekt.kompetenzen.map((m) => [
          m.id,
          m.rolle,
          m.anforderung,
          personenText(m),
          liste('ist')[m.status === 'erfuellt' ? 0 : m.status === 'teilweise' ? 1 : 2]!,
          m.massnahme,
          m.nachweis,
          m.wirksamkeit,
        ])
      : vorschlag('kompetenz_vorschlag').map(([rolle, anforderung, massnahme, nachweis]) => ['', rolle!, anforderung!, '', '', massnahme!, nachweis!, '']);

  // Kommunikationsplan: aus dem Projekt, sonst Vorschläge
  const spP = u.liste(k('spalten_kommunikation'));
  const kommunikationZeilen: Zellwert[][] =
    !h.istLeer && projekt.kommunikation.length
      ? projekt.kommunikation.map((m) => [m.id, m.was, m.wann, personName(m.wer), m.mitWem, m.wie, liste('richtung')[m.richtung === 'intern' ? 0 : 1]!])
      : vorschlag('kommunikation_vorschlag').map((z) => ['', ...z]);

  // Blatt «Schulungen»: nur Kompetenzen, deren Nachweis eine Schulung belegt. Verweist der Nachweis auf Einträge im
  // Nachweisregister (N-xxx), muss mindestens einer die Art «schulung» haben; so bleiben z. B. Beauftragungen externer
  // Auditorinnen (Vertrag, Protokoll) aussen vor. Ohne (auflösbaren) Verweis gilt die Massnahme als Schulung.
  const schulungsnachweis = (nachweis: string): boolean => {
    const eintraege = (nachweis.match(/\bN-\d+\b/g) ?? []).flatMap((r) => projekt.nachweise.filter((n) => n.id === r));
    return !eintraege.length || eintraege.some((n) => n.art === 'schulung');
  };
  const spS = u.liste(k('spalten_schulungen'));
  const spB = u.liste(k('spalten_bewusstsein'));

  const blattKompetenz: XlsxBlatt = {
    name: u.t(k('blaetter.kompetenz')),
    titel: u.t(k('titel_kompetenz')),
    hinweise: h.istLeer ? u.liste(k('hinweise_kompetenz')) : undefined,
    fixiert: true,
    spalten: [
      text(spK[0]!, 8, false),
      text(spK[1]!, 24),
      text(spK[2]!, 40),
      text(spK[3]!, 22),
      { kopf: spK[4]!, breite: 11, typ: 'liste', liste: liste('ist') },
      text(spK[5]!, 30),
      text(spK[6]!, 24),
      text(spK[7]!, 28),
    ],
    zeilen: kompetenzZeilen,
    leereZeilen: 5,
  };
  const blattSchulungen: XlsxBlatt = {
    name: u.t(k('blaetter.schulungen')),
    titel: u.t(k('titel_schulungen')),
    hinweise: h.istLeer ? u.liste(k('hinweise_schulungen')) : undefined,
    fixiert: true,
    spalten: [{ kopf: spS[0]!, breite: 12, typ: 'datum' }, text(spS[1]!, 34), text(spS[2]!, 24), text(spS[3]!, 40), text(spS[4]!, 28)],
    // Firmendokument: durchgeführte Bewusstseinsmassnahmen (mit Datum) und Massnahmen mit Nachweis aus dem Kompetenzbedarf
    zeilen: h.istLeer
      ? []
      : [
          // Bewusstsein: Thema mit Inhalt; Teilnehmende stehen im Nachweis (Teilnahmeliste, Export)
          ...(projekt.organisation.bewusstsein ?? [])
            .filter((b) => b.datum)
            .map((b): Zellwert[] => [b.datum!, `${b.thema}: ${b.inhalt}`, b.zielgruppe, u.t(k('teilnehmende_nachweis')), b.nachweis ?? '']),
          // Kompetenz: Schulung (Massnahme) für die Rolle, Monat aus dem Nachweis, Teilnehmende aus der Kompetenz
          ...projekt.kompetenzen
            .filter((m) => m.nachweis.trim() && m.massnahme.trim() && schulungsnachweis(m.nachweis))
            .map((m): Zellwert[] => [monat(m.nachweis), `${m.id}: ${m.massnahme.trim()}`, m.rolle, personenText(m) || u.t(k('teilnehmende_nachweis')), m.nachweis]),
        ],
    leereZeilen: h.istLeer ? 30 : 15,
  };
  const blattBewusstsein: XlsxBlatt = {
    name: u.t(k('blaetter.bewusstsein')),
    titel: u.t(k('titel_bewusstsein')),
    hinweise: h.istLeer ? u.liste(k('hinweise_bewusstsein')) : undefined,
    fixiert: true,
    spalten: [text(spB[0]!, 24), text(spB[1]!, 50), text(spB[2]!, 18), text(spB[3]!, 24), { kopf: spB[4]!, breite: 12, typ: 'datum' }, text(spB[5]!, 24)],
    // Themen der Firma mit Datum und Nachweis (organisation.bewusstsein, N-25), sonst Vorschlag
    zeilen:
      !h.istLeer && projekt.organisation.bewusstsein?.length
        ? projekt.organisation.bewusstsein.map((b) => [b.thema, b.inhalt, b.zielgruppe, b.kanal, b.datum ?? null, b.nachweis ?? ''])
        : vorschlag('bewusstsein_vorschlag').map((z) => [...z, null, '']),
    leereZeilen: 3,
  };
  const blattKommunikation: XlsxBlatt = {
    name: u.t(k('blaetter.kommunikation')),
    titel: u.t(k('titel_kommunikation')),
    hinweise: h.istLeer ? u.liste(k('hinweise_kommunikation')) : undefined,
    fixiert: true,
    spalten: [
      text(spP[0]!, 8, false),
      text(spP[1]!, 34),
      text(spP[2]!, 22),
      text(spP[3]!, 22),
      text(spP[4]!, 26),
      text(spP[5]!, 22),
      { kopf: spP[6]!, breite: 10, typ: 'liste', liste: liste('richtung') },
    ],
    zeilen: kommunikationZeilen,
    leereZeilen: 5,
  };

  const hinweisBlock: Block[] = [
    ...h.kitBlock(),
    h.normverweis('7.2, 7.3, 7.4, A.4.6'),
    ...(eb
      ? ([
          { typ: 'ueberschrift', ebene: 1, text: u.t(k('eb_titel')) },
          // Firmendokument: Nachweis der Übernahme (wo aufgenommen, was umgesetzt) statt Anweisungen
          { typ: 'absatz', text: md(u.t(k(h.istLeer ? 'eb_einleitung' : 'eb_einleitung_firma'))) },
          ...(!h.istLeer && h.dokEintrag(id)?.aufgenommenIn?.trim()
            ? [{ typ: 'absatz', text: u.t(k('eb_aufgenommen'), { dokument: h.dokEintrag(id)!.aufgenommenIn!.trim() }) } as Block]
            : []),
          { typ: 'liste', punkte: u.liste(k(h.istLeer ? 'eb_abschnitte' : 'eb_abschnitte_firma')).map((p) => md(p)) },
        ] as Block[])
      : []),
    // Mit ISMS gibt es kein Blatt «Schulungen» (Nachweise im bestehenden Schulungsnachweis)
    ...(modul ? [{ typ: 'absatz' as const, text: md(`**${u.t(k(h.istLeer ? 'modul_praefix_leer' : 'modul_praefix'))}** ${u.t(k(eb ? 'modul_hinweis_eb' : 'modul_hinweis'))}`) }] : []),
  ];

  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften(id),
    lenkung: h.lenkung(id),
    firmenname: h.firmenname(),
    hinweisBlock,
    // Mit ISMS werden Schulungen im bestehenden Schulungsnachweis geführt
    blaetter: eb ? [blattKompetenz, blattBewusstsein, blattKommunikation] : [blattKompetenz, blattSchulungen, blattBewusstsein, blattKommunikation],
  };
}

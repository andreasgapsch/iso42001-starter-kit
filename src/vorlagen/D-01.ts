// D-01 Kontext, interessierte Parteien und Rollen (4.1, 4.2)
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { Organisation } from '../model/typen.ts';
import { AUSSER_GELTUNG, OHNE_NUTZUNG } from './D-02.ts';
import { erstelleHelfer, leer, md, type VorlagenKontext } from './kontext.ts';

const ROLLEN: Organisation['rollenIso'][number]['rolle'][] = ['anbieter', 'produzent', 'kunde', 'partner', 'betroffene', 'behoerde'];

export function d01(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-01.${s}`;
  const org = projekt.organisation;
  const pl = (s: string): Text => [{ text: s, platzhalter: true }];
  /** Hinweis nur im Firmendokument, wenn Angaben im Projekt fehlen */
  const fehlHinweis = (s: string, fehlt: boolean): Block[] => (fehlt ? h.hinweis(k(s), true) : []);
  const zeilenAusYaml = (s: string): Text[][] => (u.roh(k(s)) as string[][]).map((z) => z.map((zelle) => md(zelle)));
  const verantwortlich = h.personText(org.aimsVerantwortlich, 'person');
  const verantwortlichText = typeof verantwortlich === 'string' ? verantwortlich : `[[${verantwortlich.map((l) => l.text).join('')}]]`;

  // ISMS-Bezug: in der leeren Vorlage immer, im Firmendokument nur im Pfad mit ISMS (Ausfüllhinweis nur ohne Registereintrag)
  const zeigeIsms = h.istLeer || projekt.meta.mitIsms;
  const dok = h.dokEintrag('D-01');
  const giltFuerIsms: Text = !h.istLeer && dok ? u.t(`allgemein.${dok.giltFuerIsms ? 'ja' : 'nein'}`) : pl(u.t('allgemein.platzhalter.ja_nein'));

  // 1 Themen
  const themenFehlen = !h.istLeer && org.kontext.themen.length === 0;
  // ID je Thema (TH-xxx), damit D-02, D-00 und D-11 darauf verweisen können (N-12); Vorschläge ohne ID
  const themenZeilen: Text[][] =
    h.istLeer || themenFehlen
      ? zeilenAusYaml('themen_vorschlag').map((z) => ['', ...z])
      : org.kontext.themen.map((t) => [
          t.id,
          u.t(k(`art.${t.art}`)),
          u.tOpt(k(`kategorien.${t.kategorie}`)) ?? t.kategorie,
          t.beschreibung,
          h.wert(t.auswirkung, 'text'),
        ]);

  // 2 Klimawandel
  const klimaOffen = h.istLeer || org.kontext.klimawandelRelevant === 'offen';
  const klimaFelder = [
    { label: u.t(k('klima_felder.relevant')), wert: klimaOffen ? pl(u.t(k('klima_platzhalter'))) : u.t(k(`klima_werte.${org.kontext.klimawandelRelevant}`)) },
    { label: u.t(k('klima_felder.begruendung')), wert: h.wert(org.kontext.klimawandelBegruendung, 'text') },
  ];

  // 3 Rollen der Organisation
  const rollenFehlen = !h.istLeer && org.rollenIso.length === 0;
  const rollenZeilen: Text[][] = ROLLEN.map((r) => {
    const eintrag = org.rollenIso.find((x) => x.rolle === r);
    const trifftZu: Text = h.istLeer || rollenFehlen ? pl(u.t('allgemein.platzhalter.ja_nein')) : u.t(`allgemein.${eintrag ? 'ja' : 'nein'}`);
    return [md(u.t(k(`rollen.${r}`))), trifftZu, h.istLeer ? '' : (eintrag?.bemerkung ?? '')];
  });

  // 4 Zweck der KI-Systeme: abgelöste Systeme stehen nur im Inventar (D-10); untersagte und ausgesetzte Systeme mit Status
  const aktuelleSysteme = projekt.kiSysteme.filter((s) => !AUSSER_GELTUNG.includes(s.status));
  const statusVermerk = (s: (typeof projekt.kiSysteme)[number]) =>
    OHNE_NUTZUNG.includes(s.status) ? ` (${u.t('allgemein.ki_status_vermerk', { status: u.t(`allgemein.ki_status.${s.status}`) })})` : '';
  const zweckBloecke: Block[] =
    !h.istLeer && aktuelleSysteme.length > 0
      ? [
          ...h.systemAnlage(
            u.t(k('abschnitte.zwecke')),
            [
              { typ: 'absatz', text: u.t(k('zwecke_text')) },
              { typ: 'liste', punkte: aktuelleSysteme.map((s) => `${s.id} ${s.name}${statusVermerk(s)}: ${s.zweck}`) },
            ],
            aktuelleSysteme.length,
          ),
        ]
      : [{ typ: 'absatz', text: u.t(k('zwecke_leer')) }];

  // 5 Interessierte Parteien
  const parteienFehlen = !h.istLeer && projekt.parteien.length === 0;
  const parteienZeilen: Text[][] =
    h.istLeer || parteienFehlen
      ? zeilenAusYaml('parteien_vorschlag')
      : projekt.parteien.flatMap((p) => {
          // ID der Partei (IP-xxx) vor dem Namen, damit D-02 und D-11 darauf verweisen können (N-12)
          // Ab der zweiten Anforderung derselben Partei nur die ID (Seitenlimit 4)
          const name = `${p.id} ${p.name} (${u.t(k(`art.${p.art}`))})`;
          if (p.anforderungen.length === 0) return [[name, h.wert(undefined, 'text'), '', pl(u.t('allgemein.platzhalter.ja_nein')), '']];
          return p.anforderungen.map((a, i): Text[] => [
            i === 0 ? name : p.id,
            a.text,
            u.t(k(`quelle.${a.quelle}`)),
            a.adressiert === 'offen' ? pl(u.t(k('adressiert.offen'))) : u.t(k(`adressiert.${a.adressiert}`)),
            leer(a.begruendung) ? (a.adressiert === 'nein' ? h.wert(undefined, 'text') : '') : a.begruendung!,
          ]);
        });

  let n = 0;
  const titel = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++n} ${u.t(k(`abschnitte.${s}`))}` });

  const bloecke: Block[] = [
    ...h.kitBlock(),
    h.normverweis('4.1, 4.2'),
    ...h.hinweis(k('hinweis_umfang')),
    { typ: 'absatz', text: h.istLeer ? md(u.t(k('einleitung'))) : u.t(k('einleitung_firma'), { firma: org.name }) },
    ...(zeigeIsms
      ? [...h.hinweis(k('isms_hinweis'), projekt.meta.mitIsms && !dok), { typ: 'felder', felder: [{ label: u.t(k('gilt_fuer_isms')), wert: giltFuerIsms }] } as Block]
      : []),

    titel('themen'),
    ...h.hinweis(k('hinweis_themen')),
    ...fehlHinweis('themen_fehlen', themenFehlen),
    { typ: 'tabelle', kopf: u.liste(k('themen_kopf')), zeilen: themenZeilen, breiten: [8, 8, 14, 40, 30], leereZeilen: h.istLeer ? 3 : 0 },
    ...h.ausbau(k('ausbau_umfeld'), []),

    titel('klima'),
    ...h.hinweis(k('hinweis_klima'), !h.istLeer && klimaOffen),
    { typ: 'felder', felder: klimaFelder },

    titel('rollen'),
    ...h.hinweis(k('hinweis_rollen'), rollenFehlen),
    { typ: 'tabelle', kopf: u.liste(k('rollen_kopf')), zeilen: rollenZeilen, breiten: [40, 10, 50] },

    titel('zwecke'),
    ...zweckBloecke,

    titel('parteien'),
    ...h.hinweis(k('hinweis_parteien')),
    ...fehlHinweis('parteien_fehlen', parteienFehlen),
    { typ: 'tabelle', kopf: u.liste(k('parteien_kopf')), zeilen: parteienZeilen, breiten: [22, 33, 9, 12, 24], leereZeilen: h.istLeer ? 3 : 0 },

    titel('ueberpruefung'),
    { typ: 'absatz', text: md(u.t(k('ueberpruefung_text'), { verantwortlich: verantwortlichText })) },
    ...h.anlagen(),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: h.fusszeile('D-01') },
    lenkung: h.lenkung('D-01'),
    eigenschaften: h.eigenschaften('D-01'),
    bloecke,
  });
}

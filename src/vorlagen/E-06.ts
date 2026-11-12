// E-06 Grundrechte-Folgenabschätzung (Art. 27; ISO/IEC 42001 6.1.4, 8.4, A.5)
// Seite 1: Anwendbarkeitsprüfung nach Art. 27(1). Danach Inhalte a bis f, DSFA-Verweis (27(4)),
// Mitteilung an die Behörde (27(3)), Freigabe. Baut auf der Folgenabschätzung D-09 auf.
import type { Block, DocxDokument, Text } from '../generator/ir.ts';
import type { KiSystem } from '../model/typen.ts';
import { fusszeile, modulHelfer } from './E-0x.ts';
import { erstelleHelfer, md, type VorlagenKontext } from './kontext.ts';

export const E06_FRAGEN = ['hochrisiko', 'infrastruktur', 'oeffentlich', 'dienste', 'kredit'] as const;

export function e06(ctx: VorlagenKontext): DocxDokument {
  const h = erstelleHelfer(ctx);
  const m = modulHelfer(ctx, h);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.E-06.${s}`;
  let nr = 0;
  const ueber = (s: string): Block => ({ typ: 'ueberschrift', ebene: 1, text: `${++nr} ${u.t(k(`abschnitte.${s}`))}` });
  const absatz = (s: string): Block => ({ typ: 'absatz', text: md(m.fuelle(u.t(k(s)))) });
  const feld = (label: string, wert: Text) => ({ label, wert });
  const jaNeinPh = m.ph(`${u.t('allgemein.ja')}/${u.t('allgemein.nein')}`);

  // Betroffenes System: ctx.kiSystemId, sonst das erste Anhang-III-System, für das die Firma Betreiber ist
  const kandidat = (s: KiSystem) => s.aiAct.rollen.includes('betreiber') && s.aiAct.risikoklasse === 'hochrisiko-anhang-iii';
  const sys = h.istLeer ? undefined : (projekt.kiSysteme.find((s) => s.id === ctx.kiSystemId) ?? projekt.kiSysteme.find(kandidat));
  const ia = sys ? projekt.folgenabschaetzungen.find((f) => f.kiSystem === sys.id) : undefined;
  const bereich = sys?.aiAct.anhangIiiBereich?.trim().toLowerCase() ?? '';

  // Vorbelegung der Antworten aus dem Projekt. Fragen 3 und 4 aus organisation.oeffentlicheDienste:
  // false beantwortet beide mit nein; true heisst öffentliches Recht oder öffentliche Dienste (Frage 4 ja, Frage 3 offen).
  const oeffentlich = h.istLeer ? undefined : projekt.organisation.oeffentlicheDienste;
  const fria = ia?.fria;
  const antwort: Record<(typeof E06_FRAGEN)[number], boolean | undefined> = {
    hochrisiko: sys ? kandidat(sys) : undefined,
    infrastruktur: sys && bereich ? bereich.startsWith('2') : undefined,
    oeffentlich: oeffentlich === false ? false : undefined,
    dienste: oeffentlich,
    kredit: sys && bereich ? bereich === '5b' || bereich === '5c' : undefined,
  };
  const berechnet: boolean | undefined =
    antwort.hochrisiko === false || antwort.infrastruktur === true
      ? false
      : antwort.hochrisiko && (antwort.kredit || antwort.oeffentlich || antwort.dienste)
        ? true
        : antwort.hochrisiko && antwort.kredit === false && antwort.oeffentlich === false && antwort.dienste === false
          ? false
          : undefined;
  // Festgehaltenes Ergebnis (Folgenabschaetzung.fria) geht der Berechnung vor
  const ergebnis: boolean | undefined = fria && fria.erforderlich !== 'offen' ? fria.erforderlich === 'ja' : berechnet;
  const jn = (v: boolean | undefined): Text => (v === undefined ? jaNeinPh : m.jn(v));

  const fragen: Text[][] = E06_FRAGEN.map((f, i) => [String(i + 1), md(m.fuelle(u.t(k(`fragen.${f}`)))), jn(antwort[f])]);

  const inhalt = (s: string, wert: string | undefined): { label: string; wert: Text } => feld(u.t(k(`inhalte.${s}`)), h.wert(wert, 'text'));
  const betroffene = ia?.betroffene.map((b) => `${b.gruppe} (${b.art})`).join(', ');
  const schaeden = ia ? Object.entries(ia.nutzenSchaden).map(([ziel, w]) => (w?.schaden ? `${u.tOpt(`vorlagen.D-09.ziele.${ziel}.name`) ?? ziel}: ${w.schaden}` : '')).filter(Boolean).join('; ') : undefined;
  const iaVerweis = ia ? u.t(k('aus_d09'), { id: ia.id }) : '';
  const mitIa = (v: string | undefined) => (v && v.trim() ? `${v}${iaVerweis}` : undefined);

  const zeigeTeil2 = h.istLeer || ergebnis !== false;

  const bloecke: Block[] = [
    ...h.kitBlock(),
    m.aiActBezug(['27', '26(9)', 'Anhang III']),
    h.normverweis('6.1.4, 8.4, A.5.2 bis A.5.5'),
    ...h.hinweis(k('hinweis_umfang')),

    ueber('anwendbarkeit'),
    absatz('anwendbarkeit_text'),
    {
      typ: 'felder',
      felder: [
        feld(u.t(k('felder.system')), sys ? `${sys.id} ${sys.name}` : m.ph(u.t('allgemein.platzhalter.ki_system'))),
        feld(u.t(k('felder.bereich')), sys?.aiAct.anhangIiiBereich ? sys.aiAct.anhangIiiBereich : m.ph(u.t(k('platzhalter_bereich')))),
      ],
    },
    { typ: 'tabelle', kopf: u.liste(k('fragen_kopf')), zeilen: fragen, breiten: [5, 80, 15] },
    absatz('regel'),
    {
      typ: 'felder',
      felder: [
        feld(u.t(k('felder.ergebnis')), jn(ergebnis)),
        feld(u.t(k('felder.begruendung')), h.wert(fria?.begruendung, 'text')),
        feld(
          u.t(k('felder.geprueft')),
          fria?.durch || fria?.am
            ? [h.person(fria.durch)?.name ?? fria.durch, h.datum(fria.am)].filter(Boolean).join(', ')
            : m.ph(`${u.t('allgemein.platzhalter.person')}, ${u.t('allgemein.platzhalter.datum')}`),
        ),
      ],
    },
    absatz('nicht_noetig'),
    m.juristisch(k('juristisch')),

    ...(zeigeTeil2
      ? ([
          { typ: 'seitenumbruch' },
          ueber('abschaetzung'),
          absatz('abschaetzung_text'),
          ...h.hinweis(k('hinweis_abschaetzung')),
          {
            typ: 'felder',
            felder: [
              inhalt('a', mitIa(ia?.verwendungen)),
              inhalt('b', fria?.zeitraumHaeufigkeit),
              inhalt('c', mitIa(betroffene)),
              inhalt('d', mitIa(schaeden || ia?.ausfaelle)),
              // e: eigenes Feld, sonst Nachweis der erledigten Betreiberpflicht «Aufsicht» (E-05, Art. 26(2))
              inhalt('e', fria?.aufsicht ?? (sys && projekt.meta.checklisten[`E-05.aufsicht.${sys.id}`]?.erledigt ? projekt.meta.checklisten[`E-05.aufsicht.${sys.id}`]?.nachweis : undefined)),
              inhalt('f', mitIa(ia?.massnahmen)),
            ],
          },
          absatz('aktualisieren'),

          ueber('dsfa'),
          absatz('dsfa_text'),
          { typ: 'felder', felder: [feld(u.t(k('felder.dsfa')), h.wert(ia?.verknuepfteDsfa, 'text'))] },

          ueber('mitteilung'),
          absatz('mitteilung_text'),
          {
            typ: 'felder',
            felder: [
              feld(u.t(k('felder.behoerde')), h.wert(fria?.behoerde, 'text')),
              feld(u.t(k('felder.mitgeteilt')), h.wert(h.datum(fria?.mitgeteiltAm), 'datum')),
              feld(u.t(k('felder.referenz')), h.wert(fria?.ref, 'text')),
            ],
          },

          ueber('freigabe'),
          // Bekannte Freigaben (Durchführung der FRIA, Freigabe der Abschätzung) statt Beschriftungen (N-15)
          ((): Block => {
            const bekannt = [fria?.durch ? { von: fria.durch, am: fria.am ?? '' } : undefined, ia?.freigabe];
            const b = h.unterschriften(bekannt);
            return b.typ === 'unterschriften' && b.felder.some((f) => typeof f !== 'string') ? b : { typ: 'unterschriften', felder: u.liste(k('unterschriften')) };
          })(),
        ] as Block[])
      : []),
  ];

  // Verweise im Pfad mit ISMS auf die Ergänzungsblätter (D-04 -> D-04-EB, N-17)
  return h.pfadVerweise({
    sprache: u.sprache,
    kopf: { firmenname: h.firmenname(), fusszeile: fusszeile(ctx, 'E-06') },
    lenkung: h.lenkung('E-06'),
    eigenschaften: h.eigenschaften('E-06'),
    bloecke,
  });
}

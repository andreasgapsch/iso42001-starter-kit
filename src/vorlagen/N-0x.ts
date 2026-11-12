// Gemeinsame Bausteine der Modulvorlagen N-01 bis N-04 (NIST AI RMF).
// Liest Kern, Zusatz-Controls, GenAI-Risiken, Vertrauensmerkmale und Stand aus src/nist-rmf und setzt Seitenangaben
// nach den beigelegten PDFs (src/nist-rmf/seiten.json), z. B. «AI 100-1 S. 27; Playbook S. 6».
// Originaltexte NIST (src/nist-rmf/original-*.yaml): Spalten «Originaltext NIST» (Englisch, wörtlich) und bei DE
// «Übersetzung (eigene, nicht amtlich)»; Blatt «Quelle» mit Dokument, DOI, zitierten Stellen, Vermerk und Nutzungsrecht.
import seiten from '../nist-rmf/seiten.json' with { type: 'json' };
import type { Block, XlsxBlatt, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { NistSeiten, NistSubkategorie } from '../kataloge/typen.ts';
import type { ControlEintrag } from '../model/typen.ts';
import { nistDaten, type NistDaten } from '../nist-rmf/logik.ts';
import { nistZitat, zitatQuelle, type ZitatArt, type ZitatDok } from '../nist-rmf/original.ts';
import { md, type Helfer, type VorlagenKontext } from './kontext.ts';

const SEITEN = seiten as unknown as NistSeiten;
const STATUS = ['offen', 'geplant', 'teilweise', 'umgesetzt', 'wirksam'] as const;

export function nistHelfer(ctx: VorlagenKontext, h: Helfer) {
  const { u, kataloge, projekt } = ctx;
  const g = (s: string) => `vorlagen.N-0x.${s}`;
  const d: NistDaten | undefined = nistDaten(kataloge);
  if (!d) throw new Error('Kataloge des Moduls NIST AI RMF fehlen (src/nist-rmf)');
  const fassung = (id: string) => d.stand.fassungen.find((f) => f.id === id);
  const ordner = ((kataloge['kitOrdner'] as { rechtstexte_nist?: string } | undefined)?.rechtstexte_nist) ?? 'Rechtstexte_Legal-Texts/NIST-AI-RMF';

  const seite = (dok: 'ai-100-1' | 'playbook' | 'ai-600-1', id: string): number | undefined => SEITEN[dok][id];
  /** «AI 100-1 S. 27; Playbook S. 6» */
  const fundstelle = (id: string): string => {
    const s100 = seite('ai-100-1', id);
    const spb = seite('playbook', id);
    return [s100 ? u.t(g('fundstelle_100'), { seite: s100 }) : '', spb ? u.t(g('fundstelle_playbook'), { seite: spb }) : ''].filter(Boolean).join('; ');
  };
  const fundstelle600 = (risiko: string): string => {
    const s = seite('ai-600-1', risiko);
    return s ? u.t(g('fundstelle_600'), { seite: s }) : '';
  };

  const subkTitel = (id: string): string => u.t(`nist.subkategorien.${id}.titel`);
  const funktionTitel = (id: string): string => u.t(`nist.funktionen.${id}.titel`);
  const kategorieTitel = (id: string): string => u.t(`nist.kategorien.${id}.titel`);
  const controlTitel = (id: string): string => u.tOpt(`nist.controls.${id}.titel`) ?? '';
  const controlText = (id: string): string => `${id} ${controlTitel(id)}`.trim();
  const risikoTitel = (id: string): string => u.t(`nist.genai_risiken.${id}.titel`);
  const merkmalTitel = (id: string): string => u.t(`nist.merkmale.${id}.titel`);
  const wert = (gruppe: string, w: string): string => u.tOpt(`nist.werte.${gruppe}.${w}`) ?? w;

  /** Zusatz-Control oder Präzisierung einer Subkategorie als Text */
  const behandlung = (s: NistSubkategorie): string => (s.zusatz_control ? controlText(s.zusatz_control) : s.praezisierung ? u.t(g('praezisierung')) : '');

  /** Eintrag in der Erklärung zur Anwendbarkeit (nur Firmendokumente) */
  const soa = (id: string): ControlEintrag | undefined => (h.istLeer ? undefined : projekt.controls.find((c) => c.id === id));
  /** Entscheid zu einem Zusatz-Control aus der SoA: «aufgenommen (umgesetzt)», «nicht aufgenommen: …», sonst «offen» */
  const entscheid = (id: string): string => {
    const c = soa(id);
    if (!c || c.anwendbar === 'offen') return u.t(g('entscheid.offen'));
    if (c.anwendbar === 'nein') return [u.t(g('entscheid.nein')), c.begruendung.trim()].filter(Boolean).join(': ');
    return u.t(g('entscheid.ja'), { status: u.liste(g('status'))[STATUS.indexOf(h.controlStatus(c))]! });
  };

  /** Dokument-IDs im Pfad der Firma; E-xx nur mit Modul AI Act, D-23 nur mit ISMS, Leitfäden nur in der leeren Vorlage */
  const dokumente = (ids: string[]): string =>
    ids
      .filter((id) => {
        if (h.istLeer) return true;
        const dk = kataloge.dokumente.dokumente.find((x) => x.id === id);
        if (!dk) return false;
        if (dk.art === 'modul' && !projekt.meta.modulAiAct) return false;
        if (dk.ordner === 'integration' && !projekt.meta.mitIsms) return false;
        return true;
      })
      .map((id) => h.dokId(id))
      .join(', ');

  /** Bezug zum NIST AI RMF mit Quelle, Lizenz und Ablage der PDFs (leer) bzw. Grundlage (Firmendokument) */
  const bezug = (mitGenai = false): Block => {
    const doi100 = fassung('ai-100-1')?.url ?? '';
    const doi600 = fassung('ai-600-1')?.url ?? '';
    const text = h.istLeer
      ? u.t(g('quelle_leer'), { ordner, genai: mitGenai ? u.t(g('quelle_leer_genai')) : '' })
      : u.t(g('quelle_firma'), { doi_100: doi100, genai: mitGenai ? u.t(g('quelle_firma_genai'), { doi_600: doi600 }) : '' });
    return { typ: 'hinweis', art: 'normverweis', titel: u.t(g('titel_bezug')), text: md(`${text} ${u.t(g('kein_recht'))}`) };
  };

  /** Originaltext NIST: Spaltenköpfe (DE mit Übersetzung) und Zellen zu einem Auszug */
  const mitUebersetzung = u.sprache === 'de';
  const originalSpalten = (breite = 50): XlsxSpalte[] => [
    { kopf: u.t(g('spalte_original')), breite, umbruch: true },
    ...(mitUebersetzung ? [{ kopf: u.t(g('spalte_uebersetzung')), breite, umbruch: true }] : []),
  ];
  const originalZellen = (art: ZitatArt, id: string): Zellwert[] => {
    const z = nistZitat(kataloge, art, id);
    const titel = (x: string | undefined) => (x ? `${x}: ` : '');
    return [z ? `${titel(z.titel)}${z.zitat}` : '', ...(mitUebersetzung ? [z ? `${titel(z.titelDe)}${z.de}` : ''] : [])];
  };

  /** Blatt «Quelle»: Dokumente, zitierte Stellen, Vermerk, Nutzungsrecht, Übersetzung; Ablage der PDFs nur in der leeren Vorlage */
  const quelleBlatt = (doks: ZitatDok[] = ['ai-100-1']): XlsxBlatt => {
    const q = (s2: string) => u.t(g(`quelle.${s2}`));
    const zeilen: Zellwert[][] = [];
    for (const dok of doks) {
      const quelle = zitatQuelle(kataloge, dok);
      if (!quelle) continue;
      zeilen.push(
        [q('dokument'), `${quelle.dokument}, ${quelle.titel} (${h.datum(quelle.datum) ?? quelle.datum})`],
        [q('doi'), quelle.doi],
        [q('stellen'), u.t(g(dok === 'ai-100-1' ? 'stellen_100' : 'stellen_600'))],
        ...(h.istLeer ? [[q('ablage'), u.t(g('ablage_text'), { ordner, datei: quelle.datei })] as Zellwert[]] : []),
        [],
      );
    }
    const vermerk = zitatQuelle(kataloge, doks[0] ?? 'ai-100-1')?.vermerk ?? '';
    zeilen.push([q('vermerk'), vermerk], [q('rechte'), u.t(g('rechte_text'))]);
    if (mitUebersetzung) zeilen.push([q('uebersetzung'), u.t(g('uebersetzung_text'))]);
    const [k1, k2] = u.liste(g('spalten_quelle'));
    return { name: u.t(g('blatt_quelle')), titel: u.t(g('titel_quelle')), hinweise: [u.t(g('hinweis_quelle'))], spalten: [{ kopf: k1!, breite: 24, umbruch: true }, { kopf: k2!, breite: 90, umbruch: true }], zeilen };
  };

  /** Stand des NIST AI RMF (src/nist-rmf/stand.yaml) mit Prüfdatum */
  const standText = (): string => u.t(g('stand'), { datum: h.datum(d.stand.geprueft_am) ?? d.stand.geprueft_am });

  return { g, d, seite, fundstelle, fundstelle600, subkTitel, funktionTitel, kategorieTitel, controlTitel, controlText, risikoTitel, merkmalTitel, wert, behandlung, soa, entscheid, dokumente, bezug, standText, ordner, mitUebersetzung, originalSpalten, originalZellen, quelleBlatt };
}

export type NistHelfer = ReturnType<typeof nistHelfer>;

/** Spaltenbuchstabe aus 1-basiertem Index */
export function spalte(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

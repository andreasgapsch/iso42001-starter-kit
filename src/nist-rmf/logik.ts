// Logik des Moduls NIST AI RMF: Zugriff auf die Kataloge (src/nist-rmf/*.yaml), Vorschlag der Zusatz-Controls RMF-xx
// je KI-System (vorschlag_wenn, voll_wenn aus rmf-controls.yaml) und Ableitung der Ist-Stufe je Subkategorie aus dem
// Projekt (Vorlage N-01, Prüfregeln). Reine Funktionen; laufen in Node, im Werkzeug und im Generator-Worker.
import type { GenaiRisiko, Kataloge, NistKern, NistStand, NistSubkategorie, RmfControl, RmfVorschlagWenn, Vertrauensmerkmal } from '../kataloge/typen.ts';
import type { ControlEintrag, ControlStatus, KiSystem, Projekt } from '../model/typen.ts';

export interface NistDaten {
  kern: NistKern;
  controls: RmfControl[];
  risiken: GenaiRisiko[];
  merkmale: Vertrauensmerkmal[];
  zieleOhneMerkmal: { ziel: string; subkategorien: string[] }[];
  stand: NistStand;
}

/** Kataloge des Moduls (Präfix nistrmf_); undefined, wenn sie fehlen */
export function nistDaten(k: Kataloge): NistDaten | undefined {
  if (!k.nistrmf_subkategorien || !k.nistrmf_rmfControls || !k.nistrmf_genaiRisiken || !k.nistrmf_merkmale || !k.nistrmf_stand) return undefined;
  return {
    kern: k.nistrmf_subkategorien,
    controls: k.nistrmf_rmfControls.controls,
    risiken: k.nistrmf_genaiRisiken.risiken,
    merkmale: k.nistrmf_merkmale.merkmale,
    zieleOhneMerkmal: k.nistrmf_merkmale.ziele_ohne_merkmal,
    stand: k.nistrmf_stand,
  };
}

/** Aktives System: nicht abgelöst und nicht untersagt (wie die Vorschläge für EUAIA-Controls) */
export const aktivesSystem = (s: KiSystem): boolean => s.status !== 'abgeloest' && s.status !== 'untersagt';

/** Eigenes Training: ausdrücklich gesetzt oder Eigenentwicklung ohne Angabe (KiSystem.eigenesTraining) */
const eigenesTraining = (s: KiSystem): boolean => s.eigenesTraining ?? s.typ === 'eigenbau';

/** Bedingung vorschlag_wenn bzw. voll_wenn für ein KI-System (UND über alle Schlüssel, any_of = ODER) */
export function rmfBedingungTrifft(w: RmfVorschlagWenn, s: KiSystem, p: Projekt): boolean {
  const triage = p.folgenabschaetzungen.find((f) => f.kiSystem === s.id)?.triage;
  if (w.any_of && !w.any_of.some((alt) => rmfBedingungTrifft(alt, s, p))) return false;
  if (w.typ_any && !w.typ_any.includes(s.typ)) return false;
  if (w.eigenes_training && !eigenesTraining(s)) return false;
  if (w.rollen_any && !s.aiAct.rollen.some((r) => w.rollen_any!.includes(r))) return false;
  if (w.transparenz_any && !s.aiAct.transparenz.some((t) => w.transparenz_any!.includes(t))) return false;
  if (w.triage_rechtsposition && triage?.rechtspositionOderChancen !== true) return false;
  if (w.triage_gesundheit_sicherheit && triage?.gesundheitOderSicherheit !== true) return false;
  if (w.generativ && s.generativ !== true) return false;
  return true;
}

export interface RmfVorschlag {
  id: string;
  /** aktive KI-Systeme, für die das Control vorgeschlagen wird */
  systeme: string[];
  /** Systeme, für die die volle Form gilt (voll_wenn); übrige in der Form für Betreiber */
  voll: string[];
}

/** Vorgeschlagene Zusatz-Controls RMF-xx je KI-System; ohne Modul keine. Reihenfolge wie im Katalog. */
export function rmfVorschlaege(p: Projekt, controls: readonly RmfControl[]): RmfVorschlag[] {
  if (!p.meta.modulNistRmf) return [];
  const aktive = p.kiSysteme.filter(aktivesSystem);
  return controls
    .map((c) => {
      const systeme = aktive.filter((s) => rmfBedingungTrifft(c.vorschlag_wenn, s, p));
      const voll = systeme.filter((s) => !c.betreiber_lite || !c.voll_wenn || rmfBedingungTrifft(c.voll_wenn, s, p));
      return { id: c.id, systeme: systeme.map((s) => s.id), voll: voll.map((s) => s.id) };
    })
    .filter((v) => v.systeme.length > 0);
}

/** Stufen des Profils: 0 nicht erreicht, 1 teilweise, 2 erreicht (festgelegt und angewendet), 3 wirksam (überprüft) */
export type Stufe = 0 | 1 | 2 | 3;
export const STUFEN: readonly Stufe[] = [0, 1, 2, 3];

const STATUS_STUFE: Record<ControlStatus, Stufe> = { offen: 0, geplant: 0, teilweise: 1, umgesetzt: 2, wirksam: 3 };

/** Umsetzungsstand wie in D-11: «umgesetzt» oder «wirksam» mit offener Massnahme in der Umsetzung zählt als «teilweise» */
function controlStatus(p: Projekt, c: ControlEintrag): ControlStatus {
  if (c.status !== 'umgesetzt' && c.status !== 'wirksam') return c.status;
  const offen = (c.umsetzung.match(/\bM-\d{3}\b/g) ?? []).some((id) => {
    const m = p.massnahmen.find((x) => x.id === id);
    return !!m && m.status !== 'erledigt' && m.status !== 'verworfen';
  });
  return offen ? 'teilweise' : c.status;
}

const gefuellt = (v: string | undefined | null): boolean => !!v && v.trim() !== '';

/**
 * Angaben im Projekt, ohne die eine Subkategorie höchstens teilweise erreicht ist (Felder aus den Kernverbesserungen und
 * dem Modul). undefined: keine passenden Systeme, Prüfung entfällt.
 */
const alle = <T>(liste: T[], f: (x: T) => boolean): boolean | undefined => (liste.length ? liste.every(f) : undefined);
const freigegeben = (p: Projekt) => p.kiSysteme.filter((s) => (s.status === 'freigegeben' || s.status === 'eingeschraenkt') && s.typ !== 'schatten');
export const FELDPRUEFUNGEN: Record<string, (p: Projekt) => boolean | undefined> = {
  'GV-1.2': (p) => alle(freigegeben(p), (s) => (s.messkonzept?.merkmale?.length ?? 0) > 0),
  'GV-1.6': (p) => (p.kiSysteme.length ? p.kiSysteme.filter(aktivesSystem).every((s) => gefuellt(s.eigner)) : false),
  'GV-1.7': (p) => alle(p.kiSysteme.filter((s) => s.lebenszyklus === 'ausserbetrieb' || s.status === 'abgeloest'), (s) => s.ausserbetrieb?.schritteErledigt === true),
  'GV-3.1': (p) => alle(p.folgenabschaetzungen.filter((f) => f.freigabe?.am), (f) => (f.mitgewirkt ?? []).length > 0),
  'MP-1.2': (p) => alle(p.folgenabschaetzungen.filter((f) => f.freigabe?.am), (f) => (f.mitgewirkt ?? []).length > 0),
  'GV-3.2': (p) => alle(p.kiSysteme.filter(aktivesSystem), (s) => gefuellt(s.aufsicht)),
  'MP-3.5': (p) => alle(p.kiSysteme.filter(aktivesSystem), (s) => gefuellt(s.aufsicht)),
  'GV-6.2': (p) => alle(p.kiSysteme.filter((s) => aktivesSystem(s) && s.kritisch === true), (s) => gefuellt(s.rueckfallweg)),
  'MG-2.4': (p) =>
    alle(p.kiSysteme.filter((s) => aktivesSystem(s) && (s.handlungsbefugnis === 'fuehrt-begrenzt-aus' || s.handlungsbefugnis === 'handelt-mehrstufig')), (s) => gefuellt(s.stoppmoeglichkeit)),
  'MP-1.4': (p) => alle(freigegeben(p), (s) => gefuellt(s.einsatzentscheid?.nutzen)),
  'MP-3.1': (p) => alle(freigegeben(p), (s) => gefuellt(s.einsatzentscheid?.nutzen)),
  'MG-1.1': (p) => alle(freigegeben(p), (s) => gefuellt(s.einsatzentscheid?.nutzen) && gefuellt(s.einsatzentscheid?.wiedervorlage)),
  'MG-2.1': (p) => alle(freigegeben(p), (s) => gefuellt(s.einsatzentscheid?.alternativeOhneKi)),
  'MS-1.1': (p) => alle(freigegeben(p), (s) => (s.messkonzept?.pruefungen ?? []).some((x) => gefuellt(x.messgroesse) || gefuellt(x.nichtMessbar))),
  'MS-2.3': (p) => alle(freigegeben(p), (s) => (s.messkonzept?.pruefungen ?? []).some((x) => gefuellt(x.prueffaelle))),
  'MS-2.7': (p) => alle(p.kiSysteme.filter((s) => aktivesSystem(s) && s.generativ === true && (s.fremdeInhalte === true || s.oeffentlich === true)), (s) => gefuellt(s.missbrauchsfaelle)),
  'MG-3.2': (p) => alle(p.kiSysteme.filter((s) => aktivesSystem(s) && (s.typ === 'eingekauft' || s.typ === 'saas')), (s) => gefuellt(s.modell?.name) && gefuellt(s.modell?.version)),
  'MS-4.2': (p) => alle(freigegeben(p), (s) => (s.messkonzept?.pruefungen ?? []).some((x) => gefuellt(x.ergebnis))),
};

export interface IstHerleitung {
  stufe: Stufe;
  /** profil: Stufe aus nistProfil[id].ist; abgeleitet: aus Dokumenten, Controls und Angaben */
  quelle: 'profil' | 'abgeleitet';
  /** Dokumente mit Stufe (2 freigegeben, 1 in Arbeit, 0 fehlt) */
  dokumente: { id: string; stufe: Stufe }[];
  /** anwendbare Controls (Anhang A und Zusatz-Control) mit Stufe aus dem Status */
  controls: { id: string; stufe: Stufe }[];
  /** Angaben im Projekt fehlen (FELDPRUEFUNGEN): höchstens 1 */
  angabenFehlen: boolean;
  /** Kit deckt die Subkategorie nur teilweise ab und das Zusatz-Control ist nicht umgesetzt: höchstens 1 */
  luecke: boolean;
}

/** Dokumente einer Subkategorie, die zum Projekt gehören (ohne Leitfäden, E-xx nur mit Modul AI Act, D-23 nur mit ISMS) */
function relevanteDokumente(p: Projekt, k: Kataloge, s: NistSubkategorie): string[] {
  return s.kit.filter((id) => {
    const d = k.dokumente.dokumente.find((x) => x.id === id);
    if (!d || d.art === 'leitfaden') return false;
    if (d.art === 'modul' && !p.meta.modulAiAct) return false;
    if (d.ordner === 'integration' && !p.meta.mitIsms) return false;
    return true;
  });
}

function dokumentStufe(p: Projekt, id: string): Stufe {
  if (id === 'D-09') {
    const aktive = p.kiSysteme.filter(aktivesSystem);
    const ia = aktive.map((s) => p.folgenabschaetzungen.find((f) => f.kiSystem === s.id));
    if (!ia.length || ia.every((f) => !f)) return 0;
    return ia.every((f) => f?.freigabe?.am) ? 2 : 1;
  }
  const e = p.dokumente.find((d) => d.id === id) ?? p.dokumente.find((d) => d.id === `${id}-EB`);
  if (!e) return 0;
  if (e.status === 'freigegeben' && e.freigabe?.am) return 2;
  return e.status === 'veraltet' ? 0 : 1;
}

/** Ist-Stufe einer Subkategorie: Eintrag im Profil, sonst abgeleitet aus Dokumenten, Controls und Angaben im Projekt */
export function istStufe(p: Projekt, k: Kataloge, s: NistSubkategorie): IstHerleitung {
  const dokumente = relevanteDokumente(p, k, s).map((id) => ({ id, stufe: dokumentStufe(p, id) }));
  const ids = [...s.iso42001.filter((x) => /^A\./.test(x)), ...(s.zusatz_control ? [s.zusatz_control] : [])];
  const controls = ids
    .map((id) => p.controls.find((c) => c.id === id))
    .filter((c): c is ControlEintrag => !!c && c.anwendbar === 'ja')
    // «wirksam» (Stufe 3) nur mit belegter Wirksamkeitsprüfung (controls[].wirksamkeit mit Datum und Ergebnis), sonst
    // wie «umgesetzt»: Ein Status ohne Prüfung soll die Ist-Stufe nicht heben
    .map((c) => {
      const st = STATUS_STUFE[controlStatus(p, c)];
      const belegt = gefuellt(c.wirksamkeit?.wann) && gefuellt(c.wirksamkeit?.ergebnis);
      return { id: c.id, stufe: (st === 3 && !belegt ? 2 : st) as Stufe };
    });
  const feld = FELDPRUEFUNGEN[s.id]?.(p);
  const angabenFehlen = feld === false;
  const zusatz = s.zusatz_control ? controls.find((c) => c.id === s.zusatz_control) : undefined;
  const praezisiert = !!s.praezisierung && gefuellt(p.nistProfil?.[s.id]?.notiz);
  const luecke = s.abdeckung_kit !== 'ganz' && !praezisiert && (!zusatz || zusatz.stufe < 2);

  const profil = p.nistProfil?.[s.id]?.ist;
  if (profil !== undefined) return { stufe: profil, quelle: 'profil', dokumente, controls, angabenFehlen, luecke };

  const dok: Stufe | undefined = dokumente.length
    ? dokumente.every((d) => d.stufe === 2)
      ? 2
      : dokumente.some((d) => d.stufe > 0)
        ? 1
        : 0
    : undefined;
  const ctrl: Stufe | undefined = controls.length ? (Math.min(...controls.map((c) => c.stufe)) as Stufe) : undefined;
  let stufe: Stufe = dok === undefined && ctrl === undefined ? 0 : dok === undefined ? ctrl! : ctrl === undefined ? dok : dok === 2 ? ctrl : (Math.min(dok, ctrl) as Stufe);
  // «wirksam» nur mit überprüften Controls: ohne Controls höchstens 2
  if (ctrl === undefined && stufe > 2) stufe = 2;
  if ((angabenFehlen || luecke) && stufe > 1) stufe = 1;
  return { stufe, quelle: 'abgeleitet', dokumente, controls, angabenFehlen, luecke };
}

/** Zielstufe aus dem Profil (nistProfil[id].ziel), sonst undefined */
export const zielStufe = (p: Projekt, id: string): Stufe | undefined => p.nistProfil?.[id]?.ziel;

/** Ziele der Folgenabschätzung D-09 je Vertrauensmerkmal (merkmale.yaml, ziele_d09) */
export function zieleJeMerkmal(d: NistDaten): Record<string, string[]> {
  return Object.fromEntries(d.merkmale.map((m) => [m.id, m.ziele_d09]));
}

/** Monate zwischen zwei ISO-Daten (angefangene Monate zählen nicht) */
export function monateZwischen(von: string, bis: string): number {
  const [vj, vm, vt] = von.slice(0, 10).split('-').map(Number) as [number, number, number];
  const [bj, bm, bt] = bis.slice(0, 10).split('-').map(Number) as [number, number, number];
  return (bj - vj) * 12 + (bm - vm) - (bt < vt ? 1 : 0);
}

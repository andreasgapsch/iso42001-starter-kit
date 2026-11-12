// Daten des Stage-1-Berichts (Prüfung, «Stage-1-Bericht drucken»): Firma, Pfad und Module, geprüfte Regeln mit Ergebnis,
// Stand je Etappe des Guides, Pflichtdokumente mit Version, Status und Freigabe aus dem Dokumentenregister,
// offene Punkte und Termin des Stage-1-Audits, Prozesse mit Eigner und Reife (4.4). Reine Funktion ohne UI, damit Node-Tests sie prüfen können.
import type { Dokument, Kataloge } from '../../../kataloge/typen.ts';
import type { Audit, Freigabe, Projekt } from '../../../model/typen.ts';
import type { Befund, Regel } from '../../../regeln/pruefungen.ts';
import type { Uebersetzer } from '../../../i18n/texte.ts';
import { erstelleHelfer, NUR_ALS_EB_MIT_ISMS } from '../../../vorlagen/kontext.ts';
import { aktiveEtappen, seitenIndex, type Umfeld } from '../../logik/gefuehrt.ts';
import { etappenStand, type EtappenZustand } from '../../logik/ueberblick.ts';
import { projektFreigabe, registerStatus } from '../../../bibliothek/freigabe-stand.ts';
import { freigabeStand } from '../../../bibliothek/sicht.ts';
import { imDashboard, prozessStaende } from '../../../prozesse/stand.ts';
import { bereitschaftBerechnen, type Bereitschaft } from '../../logik/bereitschaft.ts';

export interface RegelErgebnis {
  id: string;
  schwere: Befund['schwere'];
  norm: string;
  /** Anzahl Befunde dieser Regel; 0 heisst erfüllt */
  befunde: number;
}

export interface BerichtDokument {
  id: string;
  version?: string;
  status?: string;
  freigabe?: Freigabe;
}

export interface Stage1Bericht {
  firma: string;
  datum: string;
  mitIsms: boolean;
  ismsZertifiziert: boolean;
  module: { aiAct: boolean; nistRmf: boolean };
  regeln: { geprueft: number; fehler: number; hinweise: number; liste: RegelErgebnis[] };
  etappen: { id: string; zustand: EtappenZustand; erledigt: number; gesamt: number }[];
  dokumente: BerichtDokument[];
  offen: { befunde: Befund[]; ohneFreigabe: string[]; massnahmen: { id: string; titel: string; termin?: string }[] };
  stage1Audit?: Pick<Audit, 'id' | 'geplant' | 'durchgefuehrt' | 'durchgefuehrtBis' | 'auditor'>;
  zielStage1?: string;
  /** Bereitschaft: zählt alle Fehler und Lücken, ohne die Dosierung des Abzeichens (C-01) */
  bereitschaft: Bereitschaft;
  /** Prozesse des Managementsystems (4.4) mit Eigner und Reife, nur wenn das Projekt Prozesse führt */
  prozesse?: { id: string; eigner?: string; reife: number }[];
}

/** Regel ist im Projekt aktiv (gleiche Bedingung wie pruefeProjekt: Modul AI Act, Modul NIST AI RMF) */
export function regelAktiv(r: Pick<Regel, 'modul'>, p: Projekt): boolean {
  return r.modul === 'nistrmf' ? p.meta.modulNistRmf === true : !r.modul || p.meta.modulAiAct;
}

/** Pflichtdokumente unter der ID, unter der die Firma sie führt (mit ISMS D-04-EB), Folgenabschätzungen je KI-System */
export function pflichtDokumentIds(p: Projekt, kataloge: Kataloge): string[] {
  return (kataloge.dokumente.dokumente as Dokument[])
    // Prozessbeschreibung (D-27) nur, wenn das Projekt Prozesse führt
    .filter((d) => d.art === 'pflicht' && !(d.je_prozess && p.prozesse === undefined))
    .flatMap((d) => {
      if (d.je_system) return p.folgenabschaetzungen.filter((f) => p.kiSysteme.some((s) => s.id === f.kiSystem && s.status !== 'abgeloest')).map((f) => `${d.id}-${f.kiSystem}`);
      return [p.meta.mitIsms && d.eb && NUR_ALS_EB_MIT_ISMS.has(d.id) ? `${d.id}-EB` : d.id];
    });
}

/**
 * Pflichtdokumente ohne gültige Freigabe: dieselbe Rechnung wie die Bibliothek (freigabeStand). Mit `heute` steht eine
 * Freigabe mit Datum in der Zukunft noch aus (C2-06, AF-081: wie im Bericht).
 */
export function ohneFreigabeIds(p: Projekt, kataloge: Kataloge, heute?: string): string[] {
  return pflichtDokumentIds(p, kataloge).filter((id) => {
    const s = freigabeStand(p, id);
    return s.status !== 'freigegeben' || (!!heute && !!s.freigabe?.am && s.freigabe.am.slice(0, 10) > heute);
  });
}

export function stage1Bericht(p: Projekt, o: { u: Uebersetzer; umfeld: Umfeld; kataloge: Kataloge; regeln: readonly Regel[]; befunde: readonly Befund[]; heute: string }): Stage1Bericht {
  const h = erstelleHelfer({ u: o.u, modus: 'firma', form: 'dokument', projekt: p, kataloge: o.kataloge, kitVersion: '' });
  const aktiv = o.regeln.filter((r) => regelAktiv(r, p));
  const liste = aktiv.map((r) => ({ id: r.id, schwere: r.schwere, norm: r.norm, befunde: o.befunde.filter((b) => b.regel === r.id).length }));
  const index = seitenIndex(o.umfeld.gefuehrt);
  const etappen = aktiveEtappen(o.umfeld.gefuehrt, p)
    .filter((e) => e.id !== 'J')
    .map((e) => {
      const s = etappenStand(e, p, o.umfeld, index);
      return { id: e.id, zustand: s.zustand, erledigt: s.erledigt, gesamt: s.gesamt };
    });
  const dokumente = pflichtDokumentIds(p, o.kataloge).map((id): BerichtDokument => {
    // Eine Freigabewahrheit (C-10): Register, Guide und Datei in der Bibliothek wie in der Bibliothek selbst
    // Eintrag des Ergänzungsblatts nicht unter dem Titel des Dokuments: Gibt das Projekt selbst eine Freigabe, gilt sie (C2-08)
    const ausProjekt = p.dokumente.some((d) => d.id === id) ? undefined : projektFreigabe(p, id);
    const e = ausProjekt?.freigabe?.am ? undefined : h.dokEintrag(id);
    const f = ausProjekt?.freigabe?.am ? ausProjekt.freigabe : h.dokFreigabe(id);
    const stand = freigabeStand(p, id);
    const status = e ? (f?.am ? registerStatus({ status: e.status, freigabe: f }) : e.status) : f?.am ? 'freigegeben' : stand.status;
    // Freigabe mit Datum in der Zukunft steht noch aus (C2-06)
    const frei = status === 'freigegeben' && !(f?.am && f.am.slice(0, 10) > o.heute) ? f : undefined;
    const version = ausProjekt?.freigabe?.am ? (ausProjekt.version ?? '1.0') : (e?.version ?? stand.version);
    // Steht nur das Ergänzungsblatt im Register, heisst die Zeile auch so (C2-08)
    return { id: e?.id ?? id, ...(version ? { version } : {}), ...(status ? { status: status as string } : {}), ...(frei?.am ? { freigabe: frei } : {}) };
  });
  const ohneFreigabe = dokumente.filter((d) => !d.freigabe?.am || d.status !== 'freigegeben').map((d) => d.id);
  const au = p.audits.filter((a) => a.art === 'extern-stage1').sort((a, b) => (a.geplant ?? a.durchgefuehrt ?? '').localeCompare(b.geplant ?? b.durchgefuehrt ?? '')).at(-1);
  return {
    firma: p.organisation.name,
    datum: o.heute,
    mitIsms: p.meta.mitIsms,
    ismsZertifiziert: p.meta.ismsZertifiziert,
    module: { aiAct: p.meta.modulAiAct, nistRmf: p.meta.modulNistRmf === true },
    regeln: {
      geprueft: aktiv.length,
      fehler: o.befunde.filter((b) => b.schwere === 'fehler').length,
      hinweise: o.befunde.filter((b) => b.schwere === 'hinweis').length,
      liste,
    },
    etappen,
    dokumente,
    bereitschaft: bereitschaftBerechnen(p, o.umfeld, o.befunde, ohneFreigabe),
    offen: {
      befunde: [...o.befunde].sort((a, b) => (a.schwere === b.schwere ? a.regel.localeCompare(b.regel) : a.schwere === 'fehler' ? -1 : 1)),
      ohneFreigabe,
      massnahmen: p.massnahmen
        .filter((m) => m.status !== 'erledigt' && m.status !== 'verworfen' && m.prioritaet === 'hoch')
        .sort((a, b) => (a.termin ?? '9').localeCompare(b.termin ?? '9'))
        .map((m) => ({ id: m.id, titel: m.titel, ...(m.termin ? { termin: m.termin } : {}) })),
    },
    ...(au ? { stage1Audit: { id: au.id, geplant: au.geplant, durchgefuehrt: au.durchgefuehrt, durchgefuehrtBis: au.durchgefuehrtBis, auditor: au.auditor } } : {}),
    ...(p.organisation.zielterminStage1 ? { zielStage1: p.organisation.zielterminStage1 } : {}),
    ...(p.prozesse !== undefined ? { prozesse: prozessStaende(p, o.kataloge, o.heute).filter(imDashboard).map((s) => ({ id: s.id, ...(s.eigner ? { eigner: s.eigner } : {}), reife: s.reife })) } : {}),
  };
}

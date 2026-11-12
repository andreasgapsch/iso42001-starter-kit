// Hauptbereiche des Rahmens (Symbolleiste, Ebene 1) und ihre Untermenüs (Ebene 2). Jede Route, auch jede Route bis rc.9
// (Sprungziele aus Prüfregeln, Tests, Projektdateien), gehört genau einem Bereich an: bereichVon(route).
import type { Projekt } from '../../model/typen.ts';
import { appDaten } from '../daten.ts';
import { inhalt, t } from '../i18n.ts';
import { offeneMassnahmen } from '../logik/fortschritt.ts';
import { aktiveEtappen } from '../logik/gefuehrt.ts';
import { staende } from '../logik/prozesse.ts';
import { routeZuHash, type Route } from '../logik/routen.ts';
import { etappenStaende } from '../ansichten/gefuehrt/Gefuehrt.tsx';
import { bibliothekGruppen } from './bibliothek-anbindung.tsx';
import type { MenueGruppe, MenuePunkt } from './menue-typen.ts';
import { tr } from './text.ts';
import { wissenKapitel } from './wissen-daten.ts';

export type BereichId = 'start' | 'uebersicht' | 'guide' | 'register' | 'prozesse' | 'bibliothek' | 'wissen' | 'pruefung' | 'hinweise' | 'hilfe' | 'einstellungen';

export interface Bereich {
  id: BereichId;
  icon: string;
  /** zweite Taste nach «g» (Tastenkürzel g dann Buchstabe) */
  taste: string;
  /** unten in der Symbolleiste */
  unten?: boolean;
  /** nur mit geöffnetem Projekt */
  mitProjekt?: boolean;
  /** Ziel beim Klick auf das Symbol */
  ziel: Route;
}

export const BEREICHE: readonly Bereich[] = [
  { id: 'start', icon: 'start', taste: 's', ziel: { art: 'start' } },
  { id: 'uebersicht', icon: 'uebersicht', taste: 'u', mitProjekt: true, ziel: { art: 'formular', modul: 'uebersicht' } },
  { id: 'guide', icon: 'guide', taste: 'g', mitProjekt: true, ziel: { art: 'gefuehrt' } },
  { id: 'register', icon: 'register', taste: 'r', mitProjekt: true, ziel: { art: 'formular', modul: 'organisation' } },
  { id: 'prozesse', icon: 'prozesse', taste: 'p', mitProjekt: true, ziel: { art: 'prozesse' } },
  { id: 'bibliothek', icon: 'bibliothek', taste: 'b', mitProjekt: true, ziel: { art: 'bibliothek' } },
  { id: 'wissen', icon: 'wissen', taste: 'w', ziel: { art: 'wissen' } },
  { id: 'pruefung', icon: 'pruefung', taste: 'k', mitProjekt: true, ziel: { art: 'pruefung' } },
  { id: 'hinweise', icon: 'glocke', taste: 'i', unten: true, mitProjekt: true, ziel: { art: 'hinweise' } },
  { id: 'hilfe', icon: 'hilfe', taste: 'h', unten: true, ziel: { art: 'hilfe' } },
  { id: 'einstellungen', icon: 'einstellungen', taste: 'e', unten: true, ziel: { art: 'einstellungen' } },
];

export function bereichTitel(id: BereichId): string {
  return tr(`bereich.${id}`);
}

/** Bereich einer Route. Bestehende Routen: Formularmodule im Register, Lagebild in der Übersicht, Dokumente erzeugen in der Bibliothek. */
export function bereichVon(r: Route): BereichId {
  switch (r.art) {
    case 'start': return 'start';
    case 'uebersicht': return 'uebersicht';
    case 'gefuehrt': return 'guide';
    case 'formular':
      if (r.modul === 'uebersicht') return 'uebersicht';
      if (r.modul === 'generator') return 'bibliothek';
      return 'register';
    case 'prozesse': return 'prozesse';
    case 'dokumente':
    case 'bibliothek': return 'bibliothek';
    case 'wissen': return 'wissen';
    case 'pruefung': return 'pruefung';
    case 'hinweise': return 'hinweise';
    case 'hilfe': return 'hilfe';
    case 'einstellungen':
    case 'ueber': return 'einstellungen';
  }
}

/** Eintrag im Untermenü des Rahmens: MenuePunkt mit Ziel, Prüfung «aktiv» und optional Stand einer Etappe des Guides. */
export interface RahmenPunkt extends MenuePunkt {
  href: string;
  aktiv: boolean;
  schritt?: 'offen' | 'laeuft' | 'erledigt';
}
export interface RahmenGruppe {
  name?: string;
  punkte: RahmenPunkt[];
}

const ohneQuery = (h: string) => h.split('?')[0]!;

function punkt(id: string, titel: string, icon: string, ziel: Route, aktiv: boolean, zusatz: Partial<RahmenPunkt> = {}): RahmenPunkt {
  return { id, titel, icon, href: routeZuHash(ziel), aktiv, ...zusatz };
}

const zahl = (n: number, warn = false): Partial<RahmenPunkt> => (n > 0 ? { zahl: n, ...(warn ? { warn: true } : {}) } : {});

function registerMenue(p: Projekt, r: Route): RahmenGruppe[] {
  const m = r.art === 'formular' ? r.modul : '';
  const mod = (modul: string, icon: string, z: Partial<RahmenPunkt> = {}, titel = t(`module.${modul}`)) =>
    punkt(modul, titel, icon, { art: 'formular', modul }, m === modul, z);
  const offeneFeststellungen = p.feststellungen.filter((f) => f.status !== 'geschlossen').length;
  const gruppen: RahmenGruppe[] = [
    {
      name: tr('register.grundlagen'),
      punkte: [
        mod('organisation', 'person'),
        mod('inventar', 'ki', zahl(p.kiSysteme.length)),
        mod('risiken', 'risiko', zahl(p.risiken.length)),
        mod('folgen', 'doc', zahl(p.folgenabschaetzungen.length)),
        mod('soa', 'haken', zahl(p.controls.length)),
      ],
    },
    {
      name: tr('register.umsetzung'),
      punkte: [
        mod('massnahmen', 'massnahme', zahl(offeneMassnahmen(p))),
        mod('lieferanten', 'lieferant', zahl(p.lieferanten.length)),
        mod('ziele', 'ziel'),
        mod('kompetenz', 'personen'),
        mod('mitarbeitende', 'person'),
        mod('nachweise', 'haken', zahl(p.nachweise.length)),
        mod('dokumente', 'doc', zahl(p.dokumente.length)),
      ],
    },
    {
      name: tr('register.bewertung'),
      punkte: [
        mod('audits', 'pruefung', zahl(p.audits.length)),
        mod('feststellungen', 'risiko', zahl(offeneFeststellungen, true)),
        mod('meldungen', 'meldung', zahl((p.meldungen ?? []).length)),
      ],
    },
  ];
  const module: RahmenPunkt[] = [];
  if (p.meta.modulAiAct) module.push(mod('aiact', 'waage'));
  if (p.meta.modulNistRmf) module.push(mod('nistrmf', 'modul'));
  if (p.meta.mitIsms) module.push(mod('brucke27001', 'bruecke'));
  if (module.length) gruppen.push({ name: tr('register.module'), punkte: module });
  return gruppen;
}

function guideMenue(p: Projekt, r: Route): RahmenGruppe[] {
  const e = r.art === 'gefuehrt' ? r.etappe : undefined;
  const staende = new Map(etappenStaende(p).map((s) => [s.id, s]));
  const etappen = aktiveEtappen(appDaten().gefuehrt, p);
  const schritt = (id: string): RahmenPunkt['schritt'] => {
    const z = staende.get(id)?.zustand;
    return z === 'erledigt' ? 'erledigt' : z === 'teilweise' ? 'laeuft' : 'offen';
  };
  const titel = (id: string) => inhalt(`gefuehrt.etappen.${id}.titel`) ?? id;
  const nummer = (id: string) => (/^E\d+$/.test(id) ? `${id.slice(1)} ` : '');
  return [
    { punkte: [punkt('ueberblick', tr('guide.ueberblick'), 'guide', { art: 'gefuehrt' }, r.art === 'gefuehrt' && !e)] },
    {
      name: tr('guide.etappen'),
      punkte: etappen.filter((x) => x.id !== 'J').map((x) => punkt(x.id, `${nummer(x.id)}${titel(x.id)}`, 'guide', { art: 'gefuehrt', etappe: x.id }, e === x.id, { schritt: schritt(x.id) })),
    },
    ...(etappen.some((x) => x.id === 'J')
      ? [{ name: tr('guide.danach'), punkte: [punkt('J', tr('guide.jahreskalender'), 'kalender', { art: 'gefuehrt', etappe: 'J' }, e === 'J')] }]
      : []),
  ];
}

const PROZESS_GRUPPEN = ['fuehrung', 'kern', 'unterstuetzung', 'bewertung'] as const;

function prozesseMenue(p: Projekt, r: Route, stichtag: string): RahmenGruppe[] {
  const f = r.art === 'prozesse' && !r.id ? (r.filter ?? {}) : null;
  const imBereich = r.art === 'prozesse';
  const liste = p.prozesse === undefined ? [] : staende(p, stichtag).filter((s) => s.sicht === 'aims' || s.sicht === 'minimal');
  const eigene = (p.eigeneProzesse ?? []).length;
  const nurAnsicht = (a: string) => !!f && f['ansicht'] === a && !f['gruppe'] && !f['pflicht'];
  return [
    {
      punkte: [
        punkt('landkarte', tr('prozesse.landkarte'), 'landkarte', { art: 'prozesse', filter: { ansicht: 'karte' } }, nurAnsicht('karte')),
        punkt('alle', tr('prozesse.alle'), 'liste', { art: 'prozesse' }, imBereich && (!f || (!f['ansicht'] && !f['gruppe'] && !f['pflicht'])), zahl(liste.length)),
        punkt('status', tr('prozesse.status'), 'uebersicht', { art: 'prozesse', filter: { ansicht: 'status' } }, nurAnsicht('status'), zahl(liste.filter((s) => s.ueberfaellig).length, true)),
        punkt('eigene', tr('prozesse.eigene'), 'plus', { art: 'prozesse', filter: { pflicht: 'eigen' } }, !!f && f['pflicht'] === 'eigen', zahl(eigene)),
      ],
    },
    {
      name: tr('prozesse.gruppen'),
      punkte: PROZESS_GRUPPEN.map((g) =>
        punkt(`gruppe-${g}`, inhalt(`prozesse.gruppen.${g}`) ?? g, 'prozesse', { art: 'prozesse', filter: { gruppe: g } }, !!f && f['gruppe'] === g, zahl(liste.filter((s) => s.gruppe === g).length)),
      ),
    },
  ];
}

function bibliothekMenueRahmen(p: Projekt, r: Route): RahmenGruppe[] {
  const unter = r.art === 'bibliothek' ? (r.unter ?? '') : null;
  const gruppen: RahmenGruppe[] = bibliothekGruppen(p).map((g: MenueGruppe) => ({
    ...(g.name ? { name: g.name } : {}),
    punkte: g.punkte.map((x) => ({ ...x, href: routeZuHash({ art: 'bibliothek', ...(x.id ? { unter: x.id } : {}) }), aktiv: unter !== null && unter === x.id })),
  }));
  // Erster Eintrag ist aktiv, wenn die Bibliothek ohne Unterbereich geöffnet ist und kein Eintrag die leere Kennung hat
  if (unter === '' && !gruppen.some((g) => g.punkte.some((x) => x.aktiv)) && gruppen[0]?.punkte[0]) gruppen[0].punkte[0].aktiv = true;
  gruppen.push({
    name: tr('bibliothek.erzeugen'),
    punkte: [punkt('erzeugen', t('navi.dokumente'), 'erzeugen', { art: 'dokumente' }, r.art === 'dokumente' || (r.art === 'formular' && r.modul === 'generator'))],
  });
  return gruppen;
}

function wissenMenue(r: Route): RahmenGruppe[] {
  const w = r.art === 'wissen' ? r : null;
  const kapitel = wissenKapitel();
  const regel = (id: string, titel: string, icon: string) => punkt(`regelwerk-${id}`, titel, icon, { art: 'wissen', unter: 'regelwerk', id }, !!w && w.unter === 'regelwerk' && w.id === id);
  return [
    {
      name: tr('wissen.leitfaden'),
      punkte: kapitel.map((k, i) =>
        punkt(`leitfaden-${k.id}`, k.titel, 'wissen', { art: 'wissen', unter: 'leitfaden', id: k.id }, !!w && ((w.unter === 'leitfaden' && w.id === k.id) || (!w.unter && i === 0))),
      ),
    },
    {
      name: tr('wissen.regelwerke'),
      punkte: [regel('42001', 'ISO/IEC 42001', 'doc'), regel('27001', 'ISO/IEC 27001', 'doc'), regel('aiact', 'EU AI Act', 'waage'), regel('nist', 'NIST AI RMF', 'modul')],
    },
    {
      name: tr('wissen.mehr'),
      punkte: [
        punkt('glossar', tr('wissen.glossar'), 'glossar', { art: 'wissen', unter: 'glossar' }, !!w && w.unter === 'glossar'),
        punkt('assistent', tr('wissen.assistent'), 'ki', { art: 'wissen', unter: 'assistent' }, !!w && w.unter === 'assistent'),
      ],
    },
  ];
}

export interface MenueUmfeld {
  p: Projekt | null;
  r: Route;
  stichtag: string;
  faellig: number;
  fehler: number;
  hinweise: number;
}

/** Untermenü eines Bereichs mit aktivem Eintrag für die Route. */
export function untermenue(b: BereichId, u: MenueUmfeld): RahmenGruppe[] {
  const { p, r } = u;
  switch (b) {
    case 'start':
      return [{
        punkte: [
          punkt('willkommen', tr('start.willkommen'), 'start', { art: 'start' }, r.art === 'start' && !r.unter),
          punkt('projekte', tr('start.projekte'), 'ordner', { art: 'start', unter: 'projekte' }, r.art === 'start' && r.unter === 'projekte'),
        ],
      }];
    case 'uebersicht':
      return [{
        punkte: [
          punkt('lagebild', tr('uebersicht.lagebild'), 'uebersicht', { art: 'formular', modul: 'uebersicht' }, r.art === 'formular'),
          punkt('faellig', tr('uebersicht.faellig'), 'kalender', { art: 'uebersicht', unter: 'faellig' }, r.art === 'uebersicht' && r.unter === 'faellig', zahl(u.faellig, true)),
          punkt('bereitschaft', tr('uebersicht.bereitschaft'), 'pruefung', { art: 'uebersicht', unter: 'bereitschaft' }, r.art === 'uebersicht' && r.unter === 'bereitschaft'),
        ],
      }];
    case 'guide':
      return p ? guideMenue(p, r) : [];
    case 'register':
      return p ? registerMenue(p, r) : [];
    case 'prozesse':
      return p ? prozesseMenue(p, r, u.stichtag) : [];
    case 'bibliothek':
      return p ? bibliothekMenueRahmen(p, r) : [];
    case 'wissen':
      return wissenMenue(r);
    case 'pruefung':
      return [{
        punkte: [
          punkt('regeln', tr('pruefung.regeln'), 'pruefung', { art: 'pruefung' }, r.art === 'pruefung' && !r.unter, u.fehler > 0 ? zahl(u.fehler, true) : zahl(u.hinweise)),
          punkt('stage1', tr('pruefung.stage1'), 'doc', { art: 'pruefung', unter: 'stage1' }, r.art === 'pruefung' && r.unter === 'stage1'),
        ],
      }];
    // Untermenüs bleiben im eigenen Bereich (U-12): Fällig, Prüfung, Wissen und «Über» haben ihre eigenen Bereiche
    case 'hinweise':
      return [{
        punkte: [punkt('alle', tr('hinweise.alle'), 'glocke', { art: 'hinweise' }, r.art === 'hinweise', zahl(u.faellig, true))],
      }];
    case 'hilfe':
      return [{
        punkte: [
          punkt('kurz', tr('hilfe.kurzanleitung'), 'hilfe', { art: 'hilfe' }, r.art === 'hilfe' && !r.unter),
          punkt('tasten', tr('hilfe.tasten'), 'tasten', { art: 'hilfe', unter: 'tasten' }, r.art === 'hilfe' && r.unter === 'tasten'),
        ],
      }];
    case 'einstellungen': {
      const e = r.art === 'einstellungen' ? (r.bereich ?? '') : null;
      const ein = (id: '' | 'projekt' | 'darstellung' | 'gestaltung' | 'normtexte' | 'speicher', icon: string, nurProjekt = false) =>
        nurProjekt && !p ? [] : [punkt(id || 'alle', tr(`einstellungen.${id || 'alle'}`), icon, id ? { art: 'einstellungen', bereich: id } : { art: 'einstellungen' }, e === id)];
      return [{
        punkte: [
          ...ein('', 'einstellungen'),
          ...ein('projekt', 'modul', true),
          ...ein('darstellung', 'sprache'),
          ...ein('gestaltung', 'pinsel', true),
          ...ein('normtexte', 'doc'),
          ...ein('speicher', 'speicher'),
          punkt('ueber', t('navi.ueber'), 'info', { art: 'ueber' }, r.art === 'ueber'),
        ],
      }];
    }
  }
}

/** Titel des aktiven Untermenü-Eintrags (für den Kopf und die Suche); sonst der Bereich. */
export function ortTitel(b: BereichId, gruppen: RahmenGruppe[]): string {
  for (const g of gruppen) for (const x of g.punkte) if (x.aktiv) return x.titel;
  return bereichTitel(b);
}

export { ohneQuery };

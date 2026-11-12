// Suchquellen des Werkzeugs (R6): Register (KI-Systeme, Risiken, Massnahmen, Controls, Lieferanten und weitere),
// Prozesse, Wissen (Leitfaden, Regelwerke, Glossar) und Seiten des Rahmens. Weitere Quellen (z. B. die Bibliothek)
// registrieren sich selbst über registriereSuchquelle (suche-quellen.ts).
import { aktiveEtappen, aktiveSeiten, seitenIndex } from '../logik/gefuehrt.ts';
import type { Projekt } from '../../model/typen.ts';
import { prozesseDesProjekts, UI_TEXTE } from '../logik/prozesse.ts';
import { prozessTitel } from '../../prozesse/katalog.ts';
import { appDaten, controlIds42001 } from '../daten.ts';
import { inhalt, inhaltRoh, optionText, t } from '../i18n.ts';
import { restLage } from '../../grafik/daten.ts';
import { routeZuHash } from '../logik/routen.ts';
import { BEREICHE, bereichTitel } from './bereiche.ts';
import { registriereSuchquelle, trefferRang, type Suchtreffer } from './suche-quellen.ts';
import { tr } from './text.ts';
import { wissenKapitel } from './wissen-daten.ts';

/** such: weitere Suchwörter, die nicht angezeigt werden (z. B. Lage zur Akzeptanzgrenze) */
type Eintrag = { id: string; titel: string; unter?: string; href: string; such?: string };

function liste(q: string, eintraege: Eintrag[], icon: string): Suchtreffer[] {
  const r: Suchtreffer[] = [];
  for (const e of eintraege) {
    const rang = trefferRang(q, e.id, e.titel, e.unter, e.such);
    if (rang) r.push({ titel: e.titel || e.id, unter: e.unter ?? e.id, href: e.href, icon, rang });
  }
  return r;
}

const formular = (modul: string, id?: string) => routeZuHash({ art: 'formular', modul, ...(id ? { id } : {}) });

function quelleRegister(id: string, gruppe: () => string, icon: string, eintraege: (p: Projekt) => Eintrag[], reihenfolge: number): void {
  registriereSuchquelle({ id, gruppe, reihenfolge, suche: (q, p) => (p ? liste(q, eintraege(p), icon) : []) });
}

let registriert = false;

/** Registriert die Standardquellen einmal (beim ersten Öffnen der Suche). */
export function standardQuellen(): void {
  if (registriert) return;
  registriert = true;
  quelleRegister('ki-systeme', () => t('module.inventar'), 'ki', (p) => p.kiSysteme.map((s) => ({ id: s.id, titel: s.name, unter: s.id, href: formular('inventar', s.id) })), 10);
  // Risiken mit Status und Lage zur Akzeptanzgrenze (U-05): «Restrisiko» oder «angenommen» findet Risiken mit Annahme
  quelleRegister('risiken', () => t('module.risiken'), 'risiko', (p) => p.risiken.map((r) => {
    const lage = restLage(r, p.organisation.risikokriterien);
    const status = optionText('risikoStatus', r.status);
    const lageText = lage === 'angenommen' ? optionText('risikoStatus', 'akzeptiert') : lage === 'annahme-offen' || lage === 'ueber' ? t(`risiken.lage_${lage}`) : '';
    return { id: r.id, titel: r.titel, unter: [r.id, r.kiSystem, lageText || status].filter(Boolean).join(' · '), href: formular('risiken', r.id), such: `${status} ${lageText} ${r.restrisikoBegruendung ?? ''}` };
  }), 11);
  quelleRegister('massnahmen', () => t('module.massnahmen'), 'massnahme', (p) => p.massnahmen.map((m) => ({ id: m.id, titel: m.titel, unter: m.id, href: formular('massnahmen', m.id) })), 12);
  quelleRegister('controls', () => tr('suche.controls'), 'haken', () => {
    const titel = (id: string) => inhalt(`controls42001.controls.${id}.titel`) ?? '';
    return controlIds42001().map((id) => ({ id, titel: titel(id), unter: `ISO/IEC 42001 ${id}`, href: formular('soa', id) }));
  }, 13);
  quelleRegister('lieferanten', () => t('module.lieferanten'), 'lieferant', (p) => p.lieferanten.map((l) => ({ id: l.id, titel: l.name, unter: l.id, href: formular('lieferanten', l.id) })), 14);
  // Je Register eine Gruppe (U-36) statt «Weitere Einträge»
  quelleRegister('folgen', () => t('module.folgen'), 'doc', (p) => p.folgenabschaetzungen.map((f) => ({ id: f.id, titel: `${t('module.folgen')} ${f.kiSystem}`, unter: f.id, href: formular('folgen', f.id) })), 15);
  quelleRegister('ziele', () => t('module.ziele'), 'ziel', (p) => p.ziele.map((z) => ({ id: z.id, titel: z.ziel, unter: z.id, href: formular('ziele', z.id) })), 16);
  quelleRegister('feststellungen', () => t('module.feststellungen'), 'risiko', (p) => p.feststellungen.map((f) => ({ id: f.id, titel: f.beschreibung.slice(0, 120), unter: f.id, href: formular('feststellungen', f.id) })), 17);
  quelleRegister('nachweise', () => t('module.nachweise'), 'haken', (p) => p.nachweise.map((n) => ({ id: n.id, titel: n.titel, unter: n.id, href: formular('nachweise', n.id) })), 18);
  registriereSuchquelle({
    id: 'prozesse', gruppe: () => tr('bereich.prozesse'), reihenfolge: 20,
    suche: (q, p) => (p ? liste(q, prozesseDesProjekts(p).map((k) => ({ id: k.id, titel: prozessTitel(UI_TEXTE, k.id, p), unter: k.id, href: routeZuHash({ art: 'prozesse', id: k.id }) })), 'prozesse') : []),
  });
  // Seiten des Guides: Titel und Frage (C-24), nur Seiten, die im Projekt gelten
  registriereSuchquelle({
    id: 'guide', gruppe: () => tr('bereich.guide'), reihenfolge: 25,
    suche: (q, p) => {
      if (!p) return [];
      const g = appDaten().gefuehrt;
      const index = seitenIndex(g);
      const r: Eintrag[] = [];
      for (const e of aktiveEtappen(g, p)) {
        for (const s of aktiveSeiten(g, e, p, index)) {
          const titel = inhalt(`gefuehrt.${e.id}.${s.id}.titel`);
          if (titel) r.push({ id: '', titel, unter: e.id, href: routeZuHash({ art: 'gefuehrt', etappe: e.id, seite: s.id }) });
        }
      }
      return liste(q, r, 'rechts');
    },
  });
  registriereSuchquelle({
    id: 'wissen', gruppe: () => tr('bereich.wissen'), reihenfolge: 30, mitProjekt: false,
    suche: (q) => {
      const r: Eintrag[] = [];
      for (const k of wissenKapitel()) {
        r.push({ id: '', titel: k.titel, unter: tr('wissen.leitfaden'), href: routeZuHash({ art: 'wissen', unter: 'leitfaden', id: k.id }) });
        for (const a of k.abschnitte) r.push({ id: '', titel: a.titel, unter: k.titel, href: routeZuHash({ art: 'wissen', unter: 'leitfaden', id: `${k.id}/${a.id}` }) });
      }
      for (const g of appDaten().kataloge.controls42001.gruppen) {
        for (const c of g.controls) r.push({ id: c.id, titel: inhalt(`controls42001.controls.${c.id}.titel`) ?? c.id, unter: `ISO/IEC 42001 ${c.id}`, href: routeZuHash({ art: 'wissen', unter: 'regelwerk', id: `42001/${c.id}` }) });
      }
      const c27 = (inhaltRoh('iso27001.controls') ?? {}) as Record<string, { titel?: string }>;
      for (const [id, c] of Object.entries(c27)) r.push({ id: id.replace(/^27001-/, ''), titel: c.titel ?? id, unter: `ISO/IEC 27001 ${id.replace(/^27001-/, '')}`, href: routeZuHash({ art: 'wissen', unter: 'regelwerk', id: `27001/${id}` }) });
      return liste(q, r, 'wissen');
    },
  });
  registriereSuchquelle({
    id: 'glossar', gruppe: () => tr('wissen.glossar'), reihenfolge: 31, mitProjekt: false,
    suche: (q) => {
      const g = (inhaltRoh('glossar') ?? {}) as Record<string, { begriff?: string; erklaerung?: string; en?: string }>;
      return liste(q, Object.entries(g).filter(([, x]) => x && typeof x === 'object' && x.begriff).map(([id, x]) => ({ id: '', titel: x.begriff ?? id, unter: x.en ?? '', href: routeZuHash({ art: 'wissen', unter: 'glossar', id }) })), 'glossar');
    },
  });
  registriereSuchquelle({
    id: 'seiten', gruppe: () => tr('suche.seiten'), reihenfolge: 90, mitProjekt: false,
    suche: (q, p) => liste(q, BEREICHE.filter((b) => !b.mitProjekt || p).map((b) => ({ id: '', titel: bereichTitel(b.id), unter: tr('suche.bereich'), href: routeZuHash(b.ziel) })), 'rechts'),
  });
}

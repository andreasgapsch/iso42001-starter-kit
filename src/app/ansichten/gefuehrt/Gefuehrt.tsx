// Guide: Kopf mit Etappe und Seitenpunkten, Seiten aller Typen, Hilfebereich, Abschluss je Etappe mit Checkliste.
// Navigation in zwei Ebenen (Nutzertest rc.10, U-08): Etappen im Untermenü des Rahmens, Seiten als Punktreihe im Kopf.
import { GestaltungKurz } from '../einstellungen/Gestaltung.tsx';
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { datumText, inhalt, optionText, t, uiSprache, zahlText } from '../../i18n.ts';
import { berechneFahrplan, freigabeStand, kalenderwoche, type PlanWoche } from '../../logik/fahrplan.ts';
import { kalenderEintraege, RHYTHMUS_MONATE } from '../../logik/kalender.ts';
import { erfuellt } from '../../logik/bedingungen.ts';
import { musterEintrag, neuerControlEintrag, neuerEintrag } from '../../logik/eintraege.ts';
import { vorgeschlagene27001 } from '../../logik/bruecke.ts';
import { juengsteAbschaetzung } from '../../../regeln/stimmigkeit.ts';
import type { EtappeDef, FeldDef, SeiteDef, Wenn } from '../../logik/gefuehrt-typen.ts';
import {
  aktiveEtappen, aktiveFelder, aktiveSeiten, checklisteIds, etappenFortschritt, feldWert, nichtNoetigMoeglich, pflichtLuecken,
  seitenEintraege, seitenIndex, seitenStatus, befundeDerSeite, type SeitenEintrag, type Umfeld,
} from '../../logik/gefuehrt.ts';
import { istLeer, lies } from '../../logik/pfad.ts';
import { gefuehrtSprung } from '../../logik/pruefsprung.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { begruendungNachfuehren, feldVorschlag, soaVorschlaege } from '../../logik/vorschlaege.ts';
import { Feld, feldLabel, feldSchluessel } from '../../ui/Feld.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { StufePille } from '../../ui/Grafik.tsx';
import type { Luecke } from '../../logik/gefuehrt.ts';
import { RichText } from '../../ui/RichText.tsx';
import { LoeschKnopf } from '../../ui/Loeschen.tsx';
import { VListe } from '../../ui/VListe.tsx';
import { aendere, aendereMit, heute, melde, navigiere, stichtag, stichtagAbweichend, umfeld } from '../../zustand/store.ts';
import { befundText, PruefungInhalt } from '../pruefung/Pruefung.tsx';
import { alsMassnahme, eintragEntfernen, eintragHinzufuegen, etappeAbschliessen, nichtNoetigSetzen, schreibeFeld, seiteVerlassen } from './aktionen.ts';
import { Hilfebereich, seitenText } from './Hilfe.tsx';
import { LiveVorschau } from './LiveVorschau.tsx';
import { Fragebogen } from './Fragebogen.tsx';
import { KatalogVorschlaege } from './KatalogVorschlaege.tsx';
import { NistProfil } from './NistProfil.tsx';
import { NistSeitenOriginal, RmfControlOriginal } from '../formular/NistZitat.tsx';
import { Gantt, SeitenPunkte } from '../../../grafik/preact/Diagramme.tsx';
import type { FortschrittsZustand } from '../../../grafik/svg/formen.ts';
import { lokalLesen, lokalSchreiben } from '../../lokal.ts';
import { etappenStand, type EtappenStand } from '../../logik/ueberblick.ts';
import { Ueberblick } from './Ueberblick.tsx';
import type { GanttMarke, GanttZeile } from '../../../grafik/svg/zeitleiste.ts';
import { MatrixVorschau, RisikoMatrizen } from '../../ui/Grafik.tsx';
import { katalogVorschlaege } from './KatalogVorschlaege.tsx';
import { NormtextSprache } from '../../normtexte/NormtextHilfe.tsx';
import { normErlaeuterung, normTitel } from '../../normtexte/zustand.ts';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { bereichTitel } from '../../rahmen/bereiche.ts';
import { Symbol } from '../../rahmen/symbole.tsx';

export function etappenTitel(id: string): string {
  return inhalt(`gefuehrt.etappen.${id}.titel`) ?? id;
}

/** Modulstand für Kopfzeilen: AI Act ein/aus, NIST AI RMF nur, wenn eingeschaltet. */
export function modulText(p: Projekt): string {
  return `${t(p.meta.modulAiAct ? 'modul.ein' : 'modul.aus')}${p.meta.modulNistRmf ? ` · ${t('modul.nist_ein')}` : ''}`;
}

/** Kurztitel einer Etappe für die Etappenleiste (gefuehrt.etappen.<id>.kurz), sonst der volle Titel. */
export function etappenKurz(id: string): string {
  return inhalt(`gefuehrt.etappen.${id}.kurz`) ?? etappenTitel(id);
}

/** Stand aller aktiven Etappen (einmal je Darstellung rechnen: Pflichtprüfung über alle Seiten). */
export function etappenStaende(p: Projekt): EtappenStand[] {
  const u = umfeld.value;
  const index = seitenIndex(u.gefuehrt);
  return aktiveEtappen(u.gefuehrt, p).map((e) => etappenStand(e, p, u, index));
}

export const sprachTag = () => (uiSprache.value === 'de' ? 'de-CH' : 'en-GB');

/** Seitenstatus als Form der Punktreihe. */
export const SEITEN_FORM: Record<string, FortschrittsZustand> = { erledigt: 'erledigt', unvollstaendig: 'unvollstaendig', spaeter: 'spaeter', offen: 'offen' };

/** Kopf unter der Etappenleiste: Etappe, Seite, Punktreihe der Seiten mit Status, Gesamtfortschritt. */
function GefuehrtKopf({ p, etappe, staende, seite, ort }: { p: Projekt; etappe: EtappeDef; staende: readonly EtappenStand[]; seite?: string; ort: string }) {
  const st = staende.find((x) => x.id === etappe.id);
  const erledigt = staende.reduce((a, x) => a + x.erledigt, 0);
  const gesamt = staende.reduce((a, x) => a + x.gesamt, 0);
  const index = seitenIndex(umfeld.value.gefuehrt);
  return (
    <div class="gefuehrt-kopf kein-druck">
      <div class="seiten-ort">
        <p class="zweitext" id="seiten-ort"><span class="nur-sr">{etappe.id} {etappenTitel(etappe.id)} · </span>{ort}</p>
        {st && st.seiten.length > 0 && (
          <SeitenPunkte id="seitenpunkte" beschriftung={t('gefuehrt.seitenpunkte', { etappe: `${etappe.id} ${etappenTitel(etappe.id)}` })}
            punkte={st.seiten.map((x) => {
              const def = index.get(x.id);
              return {
                id: x.id, titel: (def && seitenText(etappe, def, 'titel')) ?? x.id, zustand: SEITEN_FORM[x.status] ?? 'offen', zustandText: t(`gefuehrt.seitenstatus.${def ? statusSchluessel(def, etappe.id, p, umfeld.value) : x.status}`),
                href: routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: x.id }), aktiv: x.id === seite,
              };
            })} />
        )}
      </div>
      <div class="gefuehrt-gesamt">
        <div class="leiste">
          <span class="zweitext" id="gefuehrt-fortschritt" title={`${t(p.meta.mitIsms ? 'pfad.mit_isms' : 'pfad.ohne_isms')} · ${modulText(p)}`}>{t('gefuehrt.fortschritt', { erledigt, gesamt })}</span>
        </div>
        <div class={`balken${gesamt && erledigt === gesamt ? ' voll' : ''}`} role="progressbar" aria-label={t('gefuehrt.fortschritt_gesamt')} aria-valuemin={0} aria-valuemax={gesamt} aria-valuenow={erledigt}>
          <span style={{ width: `${gesamt ? (100 * erledigt) / gesamt : 0}%` }} />
        </div>
      </div>
    </div>
  );
}

const HILFE_MIN = 320;
const HILFE_MAX = 640;

/** V-16: Hilfe-Spalte unter 1366 px eingeklappt; eine Wahl der Person bleibt gemerkt (localStorage «hilfe-offen») */
const HILFE_OFFEN_AB = '(min-width: 1366px)';
function hilfeOffenStart(): boolean {
  const w = lokalLesen('hilfe-offen');
  if (w === '1' || w === '0') return w === '1';
  return globalThis.matchMedia?.(HILFE_OFFEN_AB).matches ?? true;
}

/** Breite der Hilfe aus localStorage (px) oder null (Standard aus stil.css). */
function gemerkteHilfeBreite(): number | null {
  const w = Number(lokalLesen('hilfe-breite'));
  return Number.isFinite(w) && w >= HILFE_MIN && w <= HILFE_MAX ? Math.round(w) : null;
}

/**
 * Raster des Guides: Inhalt, Griff, Hilfe. Die Hilfe ist auf dem Desktop 360 bis 440 px breit (rund 45 bis 60
 * Zeichen) und lässt sich am Griff ziehen oder mit den Pfeiltasten verstellen; die Wahl bleibt im localStorage.
 * Ab Tablet (bis 1100 px) steht die Hilfe unter dem Inhalt, der Griff entfällt.
 */
function GefuehrtRaster({ kopf, haupt, hilfe }: { kopf?: ComponentChildren; haupt: ComponentChildren; hilfe: ComponentChildren }) {
  const [breite, setBreite] = useState<number | null>(gemerkteHilfeBreite);
  const [zieht, setZieht] = useState(false);
  const [offen, setOffen] = useState(hilfeOffenStart);
  const umschalten = () => {
    lokalSchreiben('hilfe-offen', offen ? '0' : '1');
    setOffen(!offen);
  };
  const raster = useRef<HTMLDivElement>(null);
  const aktuell = () => breite ?? Math.round(raster.current?.querySelector<HTMLElement>(':scope > .hilfe-spalte')?.getBoundingClientRect().width ?? 400);
  const grenze = (w: number) => {
    const max = Math.min(HILFE_MAX, Math.round((raster.current?.clientWidth ?? 1600) * 0.5));
    return Math.round(Math.min(max, Math.max(HILFE_MIN, w)));
  };
  const setze = (w: number | null, merken = true) => {
    setBreite(w);
    if (merken) lokalSchreiben('hilfe-breite', w === null ? '' : String(w));
  };
  const zeiger = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = e.clientX;
    const ausgang = aktuell();
    const griff = e.currentTarget as HTMLElement;
    griff.setPointerCapture?.(e.pointerId);
    setZieht(true);
    let w = ausgang;
    const bewegen = (ev: PointerEvent) => {
      w = grenze(ausgang + (start - ev.clientX));
      setBreite(w);
    };
    const ende = () => {
      griff.removeEventListener('pointermove', bewegen);
      griff.removeEventListener('pointerup', ende);
      griff.removeEventListener('pointercancel', ende);
      setZieht(false);
      setze(w);
    };
    griff.addEventListener('pointermove', bewegen);
    griff.addEventListener('pointerup', ende);
    griff.addEventListener('pointercancel', ende);
  };
  const taste = (e: KeyboardEvent) => {
    const schritt = e.shiftKey ? 64 : 16;
    let w: number | null;
    if (e.key === 'ArrowLeft') w = grenze(aktuell() + schritt);
    else if (e.key === 'ArrowRight') w = grenze(aktuell() - schritt);
    else if (e.key === 'Home') w = HILFE_MIN;
    else if (e.key === 'End') w = grenze(HILFE_MAX);
    else if (e.key === 'Enter' || e.key === ' ') w = null;
    else return;
    e.preventDefault();
    e.stopPropagation();
    setze(w);
  };
  // Für aria-valuenow: tatsächliche Breite der Hilfe (auch ohne gemerkte Wahl)
  const [gemessen, setGemessen] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const w = raster.current?.querySelector<HTMLElement>(':scope > .hilfe-spalte')?.getBoundingClientRect().width;
    if (w && Math.round(w) !== gemessen) setGemessen(Math.round(w));
  });
  const jetzt = breite ?? gemessen;
  return (
    <div class={`gefuehrt${offen ? '' : ' hilfe-zu'}`} ref={raster} style={breite ? { '--hilfe-breite': `${breite}px` } : undefined}>
      {/* A-02: Seitenkopf über die ganze Breite, die Hilfe beginnt darunter */}
      {kopf}
      {haupt}
      {offen && <div class={`hilfe-griff kein-druck${zieht ? ' zieht' : ''}`} role="separator" aria-orientation="vertical" tabIndex={0} id="hilfe-griff"
        aria-label={t('gefuehrt.hilfe_breite')} title={t('gefuehrt.hilfe_breite_tipp')} aria-valuemin={HILFE_MIN} aria-valuemax={HILFE_MAX} aria-valuenow={jetzt}
        onPointerDown={zeiger} onKeyDown={taste} onDblClick={() => setze(null)} />}
      <div class="hilfe-spalte">
        {hilfe && (
          <button type="button" class="hilfe-umschalten kein-druck" id="hilfe-umschalten" aria-controls="hilfe-inhalt" aria-expanded={offen} onClick={umschalten}
            title={t(offen ? 'gefuehrt.hilfe_zu' : 'gefuehrt.hilfe_auf')}>
            <Symbol name="hilfe" /><span>{t(offen ? 'gefuehrt.hilfe_zu_kurz' : 'gefuehrt.hilfe_auf_kurz')}</span>
          </button>
        )}
        <div class="hilfe-inhalt" id="hilfe-inhalt" hidden={!offen}>{hilfe}</div>
      </div>
    </div>
  );
}

export function Gefuehrt({ p, etappe: eId, seite, eintrag, von, feld }: { p: Projekt; etappe?: string; seite?: string; eintrag?: string; von?: string; feld?: string }) {
  const u = umfeld.value;
  const etappen = aktiveEtappen(u.gefuehrt, p);
  let sId = seite;
  if (etappen.length === 0) return <div class="inhalt"><p class="ersatz">{t('gefuehrt.keine_etappen')}</p></div>;
  let etappe = etappen.find((e) => e.id === eId);
  // Direkter Aufruf einer Etappe, deren Bedingung nicht zutrifft: Hinweis statt stiller Umleitung
  const etappeDef = eId ? u.gefuehrt.etappen.etappen.find((e) => e.id === eId) : undefined;
  if (!etappe && etappeDef) {
    return <NichtZutreffend p={p} etappe={etappeDef} titel={etappenTitel(etappeDef.id)} wenn={etappeDef.wenn} weiter={routeZuHash({ art: 'gefuehrt' })} />;
  }
  // Ohne Etappe (Navigation «Guide»): Überblick vor E0, von dort «Weitermachen»
  if (!etappe) return <Ueberblick p={p} />;
  const index = seitenIndex(u.gefuehrt);
  const seiten = aktiveSeiten(u.gefuehrt, etappe, p, index);
  const staende = etappenStaende(p);
  let ort = t('gefuehrt.ort_abschluss');
  let inhaltTeil;
  const seitenDef = sId && sId !== 'abschluss' ? index.get(sId) : undefined;
  // V-10: Kontext über dem Titel, Etappe und Seiten (Punktreihe, Gesamtstand) unter dem Seitenkopf
  const kopf = (o: string) => <GefuehrtKopf p={p} etappe={etappe!} staende={staende} seite={sId} ort={o} />;
  // B14: E0 (Startinterview) und J (Jahreskalender) mit Titel ohne Nummer; sonst «Etappe n von N», N = nummerierte Etappen E1 bis En
  const nummeriert = (id: string) => /^E[1-9]\d*$/.test(id);
  const kontext = (_o: string) => `${bereichTitel('guide')} · ${nummeriert(etappe!.id)
    ? t('gefuehrt.etappe_von', { nummer: etappe!.id.replace(/^E/, ''), gesamt: etappen.filter((e) => nummeriert(e.id)).length })
    : etappenTitel(etappe!.id)}`;
  if (sId === 'abschluss') inhaltTeil = <Abschluss p={p} etappe={etappe} etappen={etappen} kopf={kopf(ort)} kontext={kontext(ort)} />;
  else if (seitenDef && etappe.seiten.includes(seitenDef.id) && !seiten.some((s) => s.id === seitenDef.id)) {
    // Direkter Aufruf einer Seite, deren Bedingung nicht zutrifft (z. B. Link oder Lesezeichen aus dem anderen Pfad)
    const danach = etappe.seiten.slice(etappe.seiten.indexOf(seitenDef.id) + 1).find((id) => seiten.some((s) => s.id === id));
    inhaltTeil = (
      <NichtZutreffend p={p} etappe={etappe} titel={seitenText(etappe, seitenDef, 'titel') ?? seitenDef.id} wenn={seitenDef.wenn}
        weiter={routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: danach ?? 'abschluss' })} kopf={kopf(ort)} />
    );
  } else {
    const pos = Math.max(0, seiten.findIndex((s) => s.id === sId));
    const s = seiten[pos];
    if (s) {
      ort = t('gefuehrt.seite_von', { nummer: pos + 1, gesamt: seiten.length });
      sId = s.id;
    }
    inhaltTeil = s ? <SeitenRahmen key={s.id} p={p} etappe={etappe} seite={s} pos={pos} anzahl={seiten.length} seiten={seiten} eintrag={eintrag} von={von} feld={feld} kopf={kopf(ort)} kontext={kontext(ort)} /> : <Abschluss p={p} etappe={etappe} etappen={etappen} kopf={kopf(ort)} kontext={kontext(ort)} />;
  }
  return <div>{inhaltTeil}</div>;
}

type SeiteOderFehlt = SeiteDef | { id: string; typ: 'fehlt' };

/** Seiten der Etappe 6, auf denen Skalen und Grenzen festgelegt werden: Vorschau der Matrix folgt den Eingaben. */
const E6_VORSCHAU = new Set(['E6-isms-skalen', 'E6-skalen', 'E6-akzeptanz']);

/** Bedingungen (wenn), die für das Projekt nicht zutreffen, als lesbarer Text. */
function offeneBedingungen(wenn: Wenn | undefined, p: Projekt): string[] {
  if (!wenn) return [];
  return Object.entries(wenn)
    .filter(([k, v]) => k !== 'eintrag' && !erfuellt({ [k]: v } as Wenn, p))
    .map(([k, v]) => t(`gefuehrt.bedingung.${k}.${String(v)}`));
}

function NichtZutreffend({ p, etappe, titel, wenn, weiter, kopf }: { p: Projekt; etappe: EtappeDef; titel: string; wenn?: Wenn; weiter: string; kopf?: ComponentChildren }) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => titelRef.current?.focus(), [titel]);
  const gruende = offeneBedingungen(wenn, p);
  return (
    <div class="gefuehrt">
      <div class="seite">
        <Seitenkopf titel={titel} titelRef={titelRef} titelId="seitentitel" aktion={<a class="knopf primaer" href={weiter}>{t('gefuehrt.weiter')}</a>} />
        {kopf}
        <div class="karte" id="nicht-zutreffend">
          <p class="zweitext">{etappe.id} {etappenTitel(etappe.id)}</p>
          <Hinweis als="p">{t('gefuehrt.nicht_zutreffend')}</Hinweis>
          {gruende.length > 0 && (
            <>
              <p>{t('gefuehrt.nicht_zutreffend_grund')}</p>
              <ul>{gruende.map((g) => <li key={g}>{g}</li>)}</ul>
            </>
          )}
          <p class="zweitext">{t('gefuehrt.nicht_zutreffend_aendern')}</p>
          <div class="knoepfe">
            <a class="knopf" href={routeZuHash({ art: 'gefuehrt', etappe: etappe.id })}>{t('gefuehrt.zur_etappe')}</a>
            <a class="knopf weiter" href={weiter}>{t('gefuehrt.weiter')}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bedienbares Element in einem Feld (Feld selbst, sonst das erste Eingabeelement darin) */
function fokusZiel(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  if (el.matches('input, textarea, button, [role=combobox], [tabindex]')) return el;
  return el.querySelector<HTMLElement>('input, textarea, [role=combobox], button');
}

/**
 * Fehlerzusammenfassung oben im Formular (AF-158, M3): Titel wie bisher, je Lücke Feld und Grund mit «Zum Feld …». Liegt das
 * Feld in einem Eintrag, der nicht angezeigt wird (grosse Liste), führt der Sprung über die Route mit Eintrag und Feld.
 */
function FehlerZusammenfassung({ etappe, seite, luecken }: { etappe: EtappeDef; seite: SeiteDef; luecken: Luecke[] }) {
  const basis = `gefuehrt.${etappe.id}.${seite.id}.felder`;
  const titel = luecken.every((l) => l.zukunft) ? t('gefuehrt.pflicht_zukunft') : luecken.some((l) => l.feld === '*') ? t(nichtNoetigMoeglich(seite) ? 'gefuehrt.pflicht_eintrag_haken' : 'gefuehrt.pflicht_eintrag') : t(luecken.length === 1 ? 'gefuehrt.pflicht_fehlt_eins' : 'gefuehrt.pflicht_fehlt', { anzahl: luecken.length });
  const zeilen = luecken.filter((l) => l.feld !== '*').map((l) => {
    const def = (seite.felder ?? []).find((f) => (f.pfad ?? f.schluessel) === l.feld);
    const name = def ? feldLabel(def, basis) : l.feld;
    const schluessel = def ? feldSchluessel(def) : l.feld;
    return {
      l, name,
      ort: l.eintrag ? `${l.eintrag}, ${name}` : name,
      grund: l.grund ? t(`gefuehrt.grund.${l.grund}`) : l.zukunft ? t('gefuehrt.grund.zukunft') : t('feld.fehlt'),
      id: `f-${seite.id}-${l.eintrag ? `${l.eintrag}-` : ''}${schluessel}`.replace(/[^\w-]/g, '_'),
      href: routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: seite.id, ...(l.eintrag ? { eintrag: l.eintrag } : {}), feld: schluessel }),
    };
  });
  return (
    <Hinweis art="fehler" role="alert" tabIndex={-1} id="fehler-zusammenfassung" klasse="fehler-zusammenfassung">
      <p class="fz-titel"><strong>{titel}</strong></p>
      {zeilen.length > 0 && (
        <ul>
          {zeilen.slice(0, 8).map((z, i) => (
            <li key={`${z.id}-${i}`}>
              <span>{z.ort}: {z.grund}</span>{' '}
              <a href={z.href} onClick={(ev) => {
                const ziel = fokusZiel(document.getElementById(z.id));
                if (!ziel) return;
                ev.preventDefault();
                ziel.focus();
              }}>{t('gefuehrt.zum_feld', { feld: z.name })}</a>
            </li>
          ))}
        </ul>
      )}
    </Hinweis>
  );
}

/** Link zurück zur Prüfung nach einem Sprung von der Prüfseite. */
function Rueckweg({ von }: { von?: string }) {
  if (von !== 'pruefung' && von !== 'gefuehrt-pruefung') return null;
  const ziel = von === 'pruefung' ? routeZuHash({ art: 'pruefung' }) : routeZuHash({ art: 'gefuehrt', etappe: 'E13', seite: 'E13-pruefung' });
  return (
    <Hinweis als="p" klasse="kein-druck" id="rueckweg">
      {t('gefuehrt.rueckweg_text')} <a href={ziel}>{t('gefuehrt.rueckweg')}</a>
    </Hinweis>
  );
}

function SeitenRahmen(props: { p: Projekt; etappe: EtappeDef; seite: SeiteOderFehlt; pos: number; anzahl: number; seiten: SeiteOderFehlt[]; eintrag?: string; von?: string; feld?: string; kopf?: ComponentChildren; kontext?: string }) {
  const { p, etappe, seite, pos, anzahl, seiten } = props;
  const [fehlerZeigen, setFehlerZeigen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const titelRef = useRef<HTMLHeadingElement>(null);
  // Vor dem Zeichnen: ein späterer Fokuswechsel nähme einer schon begonnenen Eingabe das Feld weg
  useLayoutEffect(() => {
    titelRef.current?.focus();
    // Sprung aus der Prüfung zu einem Feld (P14, F43): nach dem Zeichnen ins Feld des Eintrags bzw. der Seite
    if (props.feld) {
      const id = (x: string) => `f-${seite.id}-${x}`.replace(/[^\w-]/g, '_');
      requestAnimationFrame(() => fokusZiel(document.getElementById(id(props.eintrag ? `${props.eintrag}-${props.feld}` : props.feld!)) ?? document.getElementById(id(props.feld!)))?.focus());
    }
  }, [seite.id, props.eintrag, props.feld]);
  const titel = seitenText(etappe, seite, 'titel') ?? (seite.typ === 'fehlt' ? t('gefuehrt.seite_fehlt_titel') : etappenTitel(etappe.id));
  const frage = seitenText(etappe, seite, 'frage');
  const ziel = (i: number) => (i >= anzahl ? routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: 'abschluss' }) : routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: seiten[i]!.id }));
  const naechsteId = pos + 1 >= anzahl ? 'abschluss' : seiten[pos + 1]!.id;
  const luecken = seite.typ === 'fehlt' ? [] : pflichtLuecken(seite, p, umfeld.value);
  const weiter = () => {
    if (seite.typ !== 'fehlt' && luecken.length) {
      setFehlerZeigen(true);
      // Fehlerzusammenfassung oben (AF-158, M3): erhält den Fokus und führt mit «Zum Feld …» zu jeder Lücke
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('#fehler-zusammenfassung')?.focus());
      return;
    }
    if (seite.typ !== 'fehlt') seiteVerlassen(etappe.id, seite.id, 'weiter', naechsteId);
    globalThis.location.hash = ziel(pos + 1);
  };
  const spaeter = () => {
    if (seite.typ !== 'fehlt') seiteVerlassen(etappe.id, seite.id, 'spaeter', naechsteId);
    melde(t('gefuehrt.spaeter_hinweis'), 'info');
    globalThis.location.hash = ziel(pos + 1);
  };
  // Enter = Weiter, auch wenn der Fokus nach dem Seitenwechsel auf body liegt (WebKit)
  const weiterRef = useRef(weiter);
  weiterRef.current = weiter;
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      // Seitenkopf (Titel mit Fokus) liegt seit A-02 über dem Raster, ausserhalb von .seite
      if (el !== document.body && !(formRef.current?.closest('.gefuehrt') ?? formRef.current)?.contains(el)) return;
      if (el.closest('textarea, button, a, select, summary, [role=listbox], dialog, [contenteditable]')) return;
      e.preventDefault();
      weiterRef.current();
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, []);
  const status = seite.typ === 'fehlt' ? 'offen' : seitenStatus(seite, etappe.id, p, umfeld.value);
  return (
    <GefuehrtRaster kopf={
      <Seitenkopf titel={titel} titelRef={titelRef} titelId="seitentitel" kontext={props.kontext}
        aktion={<button type="button" class="primaer" id="kopf-weiter" onClick={weiter} title={t('gefuehrt.weiter_taste')}>{t('gefuehrt.weiter')}</button>} />
    } haupt={
      <div class="seite" ref={formRef}>
        {props.kopf}
        <div class="karte">
          {/* Etappe und Seite stehen schon in #seiten-ort (D-28) */}
          {/* Stand der Seite neben der Frage (M3: weniger Höhe, Vorschläge ohne Scrollen sichtbar) */}
          <Rueckweg von={props.von} />
          {frage ? <p class="frage">{status === 'spaeter' && <><StatusPille art="neutral">{t('gefuehrt.status_spaeter')}</StatusPille>{' '}</>}{status === 'erledigt' && <><StatusPille art="gut">{t('gefuehrt.status.erledigt')}</StatusPille>{' '}</>}<RichText text={frage} als="span" /></p>
            : (status === 'spaeter' || status === 'erledigt') && <p><StatusPille art={status === 'erledigt' ? 'gut' : 'neutral'}>{t(status === 'erledigt' ? 'gefuehrt.status.erledigt' : 'gefuehrt.status_spaeter')}</StatusPille></p>}
          {fehlerZeigen && luecken.length > 0 && seite.typ !== 'fehlt' && <FehlerZusammenfassung etappe={etappe} seite={seite} luecken={luecken} />}
          {/* E8 «Behandlung je Risiko» (M3): Befunde der Seite unter dem Risiko, das Risiko selbst zeigt Lücke und Vorschläge */}
          {seite.typ !== 'fehlt' && status === 'unvollstaendig' && seite.id !== 'E8-behandlung' && <SeitenBefunde seite={seite} p={p} />}
          {seite.typ === 'fehlt' ? (
            <p class="ersatz">{t('gefuehrt.seite_fehlt')}</p>
          ) : (
            <SeitenInhalt p={p} etappe={etappe} seite={seite} fehlerZeigen={fehlerZeigen} istEinfuehrung={pos === 0} eintrag={props.eintrag} />
          )}
          {seite.typ !== 'fehlt' && status === 'unvollstaendig' && seite.id === 'E8-behandlung' && <SeitenBefunde seite={seite} p={p} />}
          {E6_VORSCHAU.has(seite.id) && <MatrixVorschau p={p} id="e6-vorschau" />}
          {seite.id === 'E6-bewertung' && (
            <section class="karte abschnitt" id="e6-matrix" aria-labelledby="e6-matrix-titel">
              <h2 id="e6-matrix-titel">{t('grafik.matrix_e6')}</h2>
              <RisikoMatrizen p={p} id="e6-matrix-tabelle" />
            </section>
          )}
          <div class="knoepfe">
            <div class="leiste">
              <a class="knopf" href={pos > 0 ? ziel(pos - 1) : routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: seiten[0]?.id })} aria-disabled={pos === 0 ? 'true' : undefined} title={t('gefuehrt.zurueck_taste')}>
                {t('gefuehrt.zurueck')}
              </a>
            </div>
            <div class="leiste">
              {seite.typ !== 'info' && seite.typ !== 'fehlt' && <button type="button" onClick={spaeter}>{t('gefuehrt.spaeter')}</button>}
              <button type="button" class="weiter" onClick={weiter} title={t('gefuehrt.weiter_taste')}>{t('gefuehrt.weiter')}</button>
            </div>
          </div>
        </div>
        {seite.typ !== 'fehlt' && seite.vorlage && seite.typ !== 'info' && seite.typ !== 'pruefung' && <LiveVorschau p={p} vorlage={seite.vorlage} />}
      </div>
    } hilfe={seite.typ !== 'fehlt' && <Hilfebereich etappe={etappe} seite={seite} projekt={p} uebernehmen={uebernehmenFuer(seite, p)} />} />
  );
}

/** Verweise auf Personen, Freigaben und Projektlisten des Beispiels gibt es im eigenen Projekt nicht; Kataloge schon. */
function uebertragbar(f: FeldDef): boolean {
  if (['person', 'personen', 'freigabe', 'checkliste', 'pruefliste'].includes(f.typ)) return false;
  // Messwerte gehören der Beispielfirma: Datum, Systeme und Stichproben stimmen im eigenen Projekt nicht (F42, F43, H89; AF-140)
  if (f.typ === 'tabelle' && (f.pfad === 'kennzahlMessungen' || f.pfad === 'messungen')) return false;
  return f.typ !== 'verweis' || ['controls', 'katalog-27001', 'katalog-dokumente'].includes(f.quelle ?? '');
}

/** Beispielwert ohne Bestandteile, die auf Einträge des Beispielprojekts zeigen (Tabellenspalten mit Personen oder Verweisen). */
function beispielKopie(f: FeldDef, wert: unknown): unknown {
  const kopie = structuredClone(wert);
  if (f.typ !== 'tabelle' || !Array.isArray(kopie)) return kopie;
  // Textspalten, in denen das Beispiel eine Personen-Kennung führt (wer.tief: «P-002»), zählen ebenfalls als Verweis
  const personenKennung = (zeile: Record<string, unknown>, pfad: string): boolean => /^P-\d{3}$/.test(String(pfad.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], zeile) ?? ''));
  const weg = (f.spalten ?? []).filter((sp) => !uebertragbar(sp)).map((sp) => sp.pfad ?? '');
  const kennungen = (f.spalten ?? []).filter((sp) => sp.typ === 'text' && sp.pfad).map((sp) => sp.pfad!);
  // Pfade mit Punkt (wer.tief) zeigen auf verschachtelte Werte: den Wert löschen, nicht einen Schlüssel «wer.tief» (AF-140)
  for (const zeile of kopie as Record<string, unknown>[]) {
    for (const k of [...weg, ...kennungen.filter((pfad) => personenKennung(zeile, pfad))]) {
      const teile = k.split('.');
      let ort: Record<string, unknown> | undefined = zeile;
      for (const t of teile.slice(0, -1)) ort = ort && typeof ort[t] === 'object' && ort[t] !== null ? (ort[t] as Record<string, unknown>) : undefined;
      if (ort) delete ort[teile[teile.length - 1]!];
    }
  }
  return kopie;
}

function uebernehmenFuer(s: SeiteDef, p: Projekt) {
  if (s.typ === 'formular') {
    // Liefert die Zahl der übernommenen Felder; schon ausgefüllte werden nur nach Rückfrage ersetzt (C-04)
    return async (werte: { feld: FeldDef; wert: unknown }[]) => {
      const passend = werte.filter((w) => uebertragbar(w.feld));
      const gefuellt = passend.filter((w) => !istLeer(feldWert(w.feld, p))).length;
      const ersetzen = gefuellt > 0 && (await bestaetigen({ text: t('hilfe.ersetzen_frage', { anzahl: gefuellt }), titel: t('bestaetigen.titel_felder_ersetzen'), ja: t('bestaetigen.felder_ersetzen'), nein: t('bestaetigen.nur_leere'), gefahr: true }));
      let n = 0;
      for (const w of passend) {
        if (!ersetzen && !istLeer(feldWert(w.feld, p))) continue;
        schreibeFeld(w.feld, beispielKopie(w.feld, w.wert));
        n++;
      }
      return n;
    };
  }
  if (s.typ === 'liste' && s.anlegen !== false && !s.eintrag) {
    return (werte: { feld: FeldDef; wert: unknown }[]) => {
      const v: Record<string, unknown> = {};
      for (const w of werte) if (uebertragbar(w.feld)) v[w.feld.pfad!] = beispielKopie(w.feld, w.wert);
      eintragHinzufuegen(s, v);
      return 1;
    };
  }
  return undefined;
}

function SeitenInhalt(props: { p: Projekt; etappe: EtappeDef; seite: SeiteDef; fehlerZeigen: boolean; istEinfuehrung: boolean; eintrag?: string }) {
  const { p, etappe, seite } = props;
  switch (seite.typ) {
    case 'info':
      return <InfoSeite p={p} etappe={etappe} seite={seite} einfuehrung={props.istEinfuehrung} />;
    case 'formular':
      return (
        <>
          <FormularFelder p={p} etappe={etappe} seite={seite} fehlerZeigen={props.fehlerZeigen} />
          {seite.fragebogen && <Fragebogen p={p} />}
        </>
      );
    case 'liste':
      if (seite.fragebogen) {
        return (
          <>
            <Fragebogen p={p} />
            <EintragsSeite p={p} etappe={etappe} seite={seite} fehlerZeigen={props.fehlerZeigen} gewaehlt={props.eintrag} />
          </>
        );
      }
      return <EintragsSeite p={p} etappe={etappe} seite={seite} fehlerZeigen={props.fehlerZeigen} gewaehlt={props.eintrag} />;
    case 'auswahl-systeme':
    case 'folgenabschaetzung':
    case 'soa':
      return (
        <>
          <NistSeitenOriginal schluessel={seite.nist} />
          <EintragsSeite p={p} etappe={etappe} seite={seite} fehlerZeigen={props.fehlerZeigen} gewaehlt={props.eintrag} />
        </>
      );
    case 'pruefung':
      return <PruefungInhalt imGefuehrt />;
    case 'fahrplan':
      return <Fahrplan p={p} />;
    case 'kalender':
      return <Kalender p={p} seite={seite} />;
    case 'vorschlaege':
      return <KatalogVorschlaege p={p} katalog={seite.katalog ?? ''} risikoRoute={(id) => ({ art: 'gefuehrt', etappe: 'E6', seite: 'E6-register', eintrag: id })} />;
    case 'nist-profil':
      return <NistProfil p={p} mitStand={seite.nistStand} fokus={props.eintrag} />;
    case 'gestaltung':
      return <GestaltungKurz p={p} />;
    default:
      return <p class="ersatz">{t('gefuehrt.seite_fehlt')}</p>;
  }
}

function InfoSeite({ p, etappe, seite, einfuehrung }: { p: Projekt; etappe: EtappeDef; seite: SeiteDef; einfuehrung: boolean }) {
  const warum = seitenText(etappe, seite, 'text');
  if (!einfuehrung) return <RichText text={warum} />;
  const u = umfeld.value;
  const stunden = etappe.dauer_h ? (p.meta.mitIsms ? etappe.dauer_h.mit_isms : etappe.dauer_h.ohne_isms) : undefined;
  const seiten = aktiveSeiten(u.gefuehrt, etappe, p);
  return (
    <div>
      <RichText text={warum} />
      <dl class="uebersicht-raster" style={{ marginTop: '12px' }}>
        <div><dt><strong>{t('gefuehrt.ziel')}</strong></dt><dd style={{ margin: 0 }}><RichText text={inhalt(`gefuehrt.etappen.${etappe.id}.ziel`)} /></dd></div>
        <div><dt><strong>{t('gefuehrt.warum')}</strong></dt><dd style={{ margin: 0 }}><RichText text={inhalt(`gefuehrt.etappen.${etappe.id}.warum`)} /></dd></div>
        <div><dt><strong>{t('gefuehrt.ergebnis')}</strong></dt><dd style={{ margin: 0 }}><RichText text={inhalt(`gefuehrt.etappen.${etappe.id}.ergebnis`)} /></dd></div>
        <div>
          <dt><strong>{t('gefuehrt.eckdaten')}</strong></dt>
          <dd style={{ margin: 0 }}>
            {etappe.norm && <p>{t('hilfe.norm', { abschnitt: etappe.norm })}</p>}
            {stunden !== undefined && <p>{t('gefuehrt.dauer', { stunden: zahlText(stunden) })}</p>}
            {etappe.beteiligte?.length ? <p>{t('gefuehrt.beteiligte')}: {etappe.beteiligte.map((b) => inhalt(`gefuehrt.beteiligte.${b}`) ?? b).join(', ')}</p> : null}
          </dd>
        </div>
      </dl>
      <p class="zweitext" id="etappe-seiten-anzahl">{t('gefuehrt.seiten_anzahl', { anzahl: etappenFortschritt(etappe, p, umfeld.value).gesamt })}</p>
    </div>
  );
}

export function FormularFelder({ p, etappe, seite, fehlerZeigen, mitNorm }: { p: Projekt; etappe: EtappeDef; seite: SeiteDef; fehlerZeigen: boolean; mitNorm?: boolean }) {
  const basis = `gefuehrt.${etappe.id}.${seite.id}.felder`;
  return (
    <div>
      {aktiveFelder(seite, p).map((f) => {
        const wert = feldWert(f, p);
        const vorschlag = feldVorschlag(f.vorschlag, p, wert);
        return (
          <div key={feldSchluessel(f)}>
            {vorschlag !== undefined && (
              <Hinweis>
                <span>{t('gefuehrt.vorschlag', { wert: typeof vorschlag === 'boolean' ? t(vorschlag ? 'feld.ja' : 'feld.nein') : String(vorschlag) })}</span>{' '}
                <button type="button" class="klein" onClick={() => schreibeFeld(f, vorschlag)}>{t('gefuehrt.vorschlag_uebernehmen')}</button>
              </Hinweis>
            )}
            <Feld
              def={f}
              wert={wert}
              setze={(v) => schreibeFeld(f, v)}
              textBasis={basis}
              norm={mitNorm ? seite.norm : undefined}
              id={`f-${seite.id}-${feldSchluessel(f)}`.replace(/[^\w-]/g, '_')}
              fehlt={fehlerZeigen && f.pflicht === true && pflichtLuecken({ ...seite, felder: [f] }, p, umfeld.value).length > 0}
              liste={Array.isArray(lies(p, f.pfad ?? '')) || f.typ === 'mehrfach'}
            />
          </div>
        );
      })}
    </div>
  );
}

export function eintragTitel(e: SeitenEintrag, p: Projekt): string {
  const o = e.objekt;
  if (e.liste === 'controls') return (/^A\./.test(e.id) ? normTitel(e.id) : undefined) ?? inhalt(`euaia.${e.id}.name`) ?? inhalt(`nist.controls.${e.id}.titel`) ?? p.eigeneControls.find((c) => c.id === e.id)?.titel ?? '';
  if (e.liste === 'folgenabschaetzungen') return p.kiSysteme.find((s) => s.id === e.kiSystem)?.name ?? '';
  if (e.liste === 'dokumente') return inhalt(`dokumente.${e.id}.titel`) ?? '';
  // Managementbewertung hat kein Feld für eine Bezeichnung: das Datum nennt sie
  if (e.liste === 'managementbewertungen' && typeof o['datum'] === 'string' && o['datum']) return datumText(o['datum']);
  for (const k of ['name', 'titel', 'ziel', 'rolle', 'was', 'beschreibung', 'bereich']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return k === 'bereich' ? optionText('rollenBereich', v) : v;
  }
  if (e.liste === 'audits') return optionText('auditArt', String(o['art']));
  return '';
}

function EintragsSeite({ p, etappe, seite, fehlerZeigen, gewaehlt }: { p: Projekt; etappe: EtappeDef; seite: SeiteDef; fehlerZeigen: boolean; gewaehlt?: string }) {
  const u = umfeld.value;
  const eintraege = seitenEintraege(seite, p, u);
  const basis = `gefuehrt.${etappe.id}.${seite.id}.felder`;
  const kannAnlegen = seite.typ === 'liste' && seite.anlegen !== false && !seite.eintrag;
  const vorschlaege = seite.typ === 'soa' ? new Map(soaVorschlaege(p, u.euaia, u.rmf).map((v) => [v.id, v])) : null;
  // E8 «Behandlung je Risiko» (M3): ein Risiko nach dem anderen; ohne Wahl das erste unvollständige
  const startWahl = () => gewaehlt ?? (seite.id === 'E8-behandlung' && eintraege.length > 12
    ? (eintraege.find((e) => pflichtLuecken(seite, p, u).some((l) => l.eintrag === e.id)) ?? eintraege[0])?.id
    : undefined);
  const [wahl, setWahl] = useState<string | undefined>(startWahl);
  // Sprung mit Eintrag (Fehlerzusammenfassung, Prüfung): die Auswahl folgt der Route
  useEffect(() => {
    if (gewaehlt) setWahl(gewaehlt);
  }, [gewaehlt]);
  const e8 = seite.id === 'E8-behandlung';
  const gross = eintraege.length > 12;
  const fehltEintrag = fehlerZeigen && pflichtLuecken(seite, p, u).some((l) => l.feld === '*');
  const offeneVorschlaege = vorschlaege ? eintraege.filter((e) => {
    const v = vorschlaege.get(e.id);
    return !!v && (String(e.objekt['anwendbar'] ?? 'offen') === 'offen' || begruendungVeraltet(e, v.grund, v.quellen));
  }) : [];
  // Stand aus der Vorbelegung, obwohl Beschreibung und Nachweis da sind: in einem Schritt setzbar (C2-02)
  const standOffen = seite.id === 'E8-umsetzung' ? eintraege.filter((e) => !e.neu && String(e.objekt['status'] ?? 'offen') === 'offen' && !istLeer(e.objekt['umsetzung']) && !istLeer(e.objekt['nachweise'])) : [];
  const muster = musterEintrag(eintraege[0]?.liste ?? seite.liste ?? 'kiSysteme') ?? {};
  const neu = () => {
    const id = eintragHinzufuegen(seite);
    setWahl(id);
    requestAnimationFrame(() => document.getElementById(`eintrag-${id}`)?.querySelector<HTMLElement>('input, [role=combobox], textarea')?.focus());
  };
  const startwerte = seite.startwerte && eintraege.length === 0 && kannAnlegen;
  // KI-Werkzeuge aus dem Startinterview (E0) als Vorschläge für das Inventar, sofern noch kein System so heisst
  const bekannt = seite.liste === 'kiSysteme' && kannAnlegen
    ? ((p.meta.gefuehrt.antworten['bekannteKiWerkzeuge'] as string[] | undefined) ?? [])
        .map((x) => x.trim())
        .filter((x) => x && !p.kiSysteme.some((s) => s.name.trim().toLowerCase() === x.toLowerCase()))
    : [];

  const karte = (e: SeitenEintrag, kopfZusatz?: ComponentChildren) => {
    const v = vorschlaege?.get(e.id);
    const luecken = fehlerZeigen ? pflichtLuecken(seite, p, u).filter((l) => l.eintrag === e.id).map((l) => l.feld) : [];
    return (
      <section class="eintrag" id={`eintrag-${e.id}`} key={e.id}>
        <h3 id={`eintrag-${e.id}-titel`}>
          <span class="marke-id">{e.liste === 'folgenabschaetzungen' ? e.kiSystem : e.id}</span>{' '}
          <span>{eintragTitel(e, p) || t('gefuehrt.ohne_titel')}</span>
          {v && <StatusPille art="info">{t(`soa.vorschlag_${v.grund}`, { quellen: v.quellen.join(', ') })}</StatusPille>}
          {kopfZusatz}
        </h3>
        {e.liste === 'controls' && <RichText text={(/^A\./.test(e.id) ? normErlaeuterung(e.id) : undefined) ?? inhalt(`euaia.${e.id}.hinweis`)?.split('\n')[0] ?? inhalt(`nist.controls.${e.id}.zweck`)} />}
        {e.liste === 'controls' && /^A\./.test(e.id) && <NormtextSprache id={e.id} />}
        {e.liste === 'controls' && e.id.startsWith('RMF-') && <RmfControlOriginal id={e.id} />}
        {v && String(e.objekt['anwendbar']) === 'offen' && (
          <p>
            <button type="button" class="klein" onClick={() => vorschlagUebernehmen(e, v.grund, v.quellen)}>{t('soa.vorschlag_uebernehmen')}</button>
          </p>
        )}
        {seite.id === 'E7-triage-ergebnis' && <TriageVorschlag e={e} />}
        {e8 && <Bewertung p={p} o={e.objekt} />}
        {aktiveFelder(seite, p, e.objekt).map((f) => (
          <Fragment key={feldSchluessel(f)}>
            {seite.id === 'E7-triage' && <TriageInventarVorschlag p={p} e={e} f={f} />}
            <Feld
              def={f}
              wert={feldWert(f, p, e)}
              setze={(w) => schreibeFeld(f, w, e)}
              textBasis={basis}
              id={`f-${seite.id}-${e.id}-${feldSchluessel(f)}`.replace(/[^\w-]/g, '_')}
              fehlt={luecken.includes(f.pfad ?? f.schluessel ?? '')}
              liste={Array.isArray(lies(muster, f.pfad ?? '')) || f.typ === 'mehrfach'}
              chips={e8 && f.typ === 'verweis'}
            />
            {e8 && f.pfad === 'controls' && <ControlVorschlaege e={e} f={f} fehlt={luecken.includes('controls')} />}
            {e8 && f.pfad === 'controls' && p.meta.mitIsms && <Controls27001Vorschlaege p={p} e={e} />}
            {seite.id === 'E7-ergebnis' && f.pfad === 'sensibleNutzung' && <SensibelAbgleich p={p} e={e} />}
            {e8 && f.pfad === 'massnahmen' && <MassnahmeDirekt e={e} />}
          </Fragment>
        ))}
        {seite.typ === 'soa' && String(e.objekt['anwendbar'] ?? 'offen') === 'offen' && !v && (
          <p class="leiste">
            <button type="button" class="klein" onClick={() => standardBegruendung(e, 'ja')}>{t('soa.standard_anwendbar')}</button>
            {/^A\.6\.(1|2\.[23])/.test(e.id) && <button type="button" class="klein" onClick={() => standardBegruendung(e, 'nein')}>{t('soa.standard_nicht')}</button>}
          </p>
        )}
        {kannAnlegen && (
          <LoeschKnopf liste={e.liste} id={e.id} klasse="gefahr klein" text={t('gefuehrt.eintrag_entfernen')} frage={t('gefuehrt.eintrag_entfernen_frage')} entfernen={() => eintragEntfernen(e.liste, e.id)} />
        )}
      </section>
    );
  };

  return (
    <div>
      {eintraege.length > 0 && <h2 class="nur-sr">{t('gefuehrt.eintraege_titel')}</h2>}
      {eintraege.length === 0 && !kannAnlegen && <p class="ersatz">{t('gefuehrt.keine_passenden')}</p>}
      {eintraege.length === 0 && kannAnlegen && <p class="zweitext">{t('gefuehrt.keine_eintraege')}</p>}
      {eintraege.length === 0 && kannAnlegen && nichtNoetigMoeglich(seite) && (
        <div class={`feld${fehltEintrag ? ' fehlt' : ''}`}>
          {/* V-09 (C4-15): fehlt der Pflichteintrag, ist das Kästchen ungültig markiert und die Meldung nennt den Haken */}
          <label class="check">
            <input type="checkbox" id="nicht-noetig" checked={(p.meta.gefuehrt.nichtNoetig ?? []).includes(seite.id)} onChange={(e) => nichtNoetigSetzen(seite.id, e.currentTarget.checked)}
              aria-invalid={fehltEintrag ? 'true' : undefined} aria-describedby={fehltEintrag ? 'nicht-noetig-fehler' : 'nicht-noetig-hilfe'} />
            <span>{t('gefuehrt.nicht_noetig')}</span>
          </label>
          {fehltEintrag && <p class="zweitext fehltext" id="nicht-noetig-fehler">{t('gefuehrt.pflicht_eintrag_haken')}</p>}
          <p class="zweitext" id="nicht-noetig-hilfe">{t('gefuehrt.nicht_noetig_hilfe')}</p>
        </div>
      )}
      {startwerte && (
        <p>
          <button type="button" onClick={() => seite.startwerte!.forEach((w) => eintragHinzufuegen(seite, w))}>{t('gefuehrt.startwerte')}</button>
        </p>
      )}
      {bekannt.length > 0 && (
        <Hinweis id="bekannte-werkzeuge">
          <p>{t('gefuehrt.bekannte_werkzeuge', { namen: bekannt.join(', ') })}</p>
          <button type="button" class="klein" onClick={() => bekannt.forEach((name) => eintragHinzufuegen(seite, { name, ...(/schatten|shadow/i.test(name) ? { typ: 'schatten' } : {}) }))}>{t('gefuehrt.bekannte_uebernehmen', { anzahl: bekannt.length })}</button>
        </Hinweis>
      )}
      {seite.id === 'E8-umsetzung' && standOffen.length > 0 && (
        <Hinweis als="p" id="soa-stand-alle">
          <button type="button" class="klein" onClick={() => {
            for (const e of standOffen) schreibeFeld({ typ: 'auswahl', pfad: 'status' }, 'umgesetzt', { ...e, neu: false });
          }}>{t(standOffen.length === 1 ? 'soa.stand_alle_eins' : 'soa.stand_alle', { anzahl: standOffen.length })}</button>
        </Hinweis>
      )}
      {offeneVorschlaege.length > 0 && (
        <Hinweis als="p" id="soa-vorschlaege-alle">
          <button type="button" class="klein" onClick={() => {
            for (const e of offeneVorschlaege) {
              const v = vorschlaege!.get(e.id)!;
              vorschlagUebernehmen(e, v.grund, v.quellen);
            }
          }}>{t(offeneVorschlaege.length === 1 ? 'soa.vorschlaege_alle_eins' : 'soa.vorschlaege_alle', { anzahl: offeneVorschlaege.length })}</button>
        </Hinweis>
      )}
      {gross && e8 && eintraege.find((e) => e.id === wahl) && (
        <div class="e8-gewaehlt">
          {karte(eintraege.find((e) => e.id === wahl)!, <RisikoBlaettern eintraege={eintraege} wahl={wahl!} waehle={setWahl} />)}
        </div>
      )}
      {gross ? (
        <div>
          <p class="zweitext" id="eintraege-anzahl">{t('liste.anzahl', { anzahl: eintraege.length })}</p>
          <VListe
            label={seitenText(etappe, seite, 'titel') ?? seite.id}
            eintraege={eintraege}
            gewaehlt={wahl}
            waehle={setWahl}
            hoehe={560}
            spalten={[
              { titel: t('liste.id'), breite: '9ch', wert: (e) => <span class="marke-id">{e.liste === 'folgenabschaetzungen' ? e.kiSystem : e.id}</span> },
              { titel: t('liste.titel'), breite: '1fr', wert: (e) => eintragTitel(e, p) },
              ...(vorschlaege ? [{ titel: t('soa.vorschlaege_spalte'), breite: '16ch', wert: (e: SeitenEintrag) => { const v = vorschlaege.get(e.id); return v ? <StatusPille art="info">{v.quellen.join(', ')}</StatusPille> : ''; } }] : []),
              {
                titel: t('liste.stand'),
                breite: '14ch',
                wert: (e) => (aktiveFelder(seite, p, e.objekt).every((f) => !f.pflicht || !istLeer(feldWert(f, p, e))) ? t('liste.vollstaendig') : t('liste.offen')),
              },
            ]}
          />
          {!e8 && <div style={{ marginTop: '12px' }}>{eintraege.find((e) => e.id === wahl) ? karte(eintraege.find((e) => e.id === wahl)!) : <p class="zweitext">{t('gefuehrt.eintrag_waehlen')}</p>}</div>}
          {e8 && !eintraege.some((e) => e.id === wahl) && <p class="zweitext">{t('gefuehrt.eintrag_waehlen')}</p>}
        </div>
      ) : (
        eintraege.map(karte)
      )}
      {kannAnlegen && (
        <button type="button" onClick={neu}>{t('gefuehrt.eintrag_neu')}</button>
      )}
    </div>
  );
}

/** Standardbegründung für klar anwendbare Controls und für Controls der KI-Entwicklung ohne eigene Entwicklung (C-13) */
function standardBegruendung(e: SeitenEintrag, wahl: 'ja' | 'nein'): void {
  schreibeFeld({ typ: 'auswahl', pfad: 'anwendbar' }, wahl, e);
  const ee = { ...e, neu: false };
  if (istLeer(e.objekt['begruendung'])) schreibeFeld({ typ: 'textarea', pfad: 'begruendung' }, t(wahl === 'ja' ? 'soa.standard_anwendbar_text' : 'soa.standard_nicht_text'), ee);
}

/** Vorschlag aus den Antworten der Kurzprüfung (C-08): sichtbar mit Übernahme, nie still gesetzt */
function TriageVorschlag({ e }: { e: SeitenEintrag }) {
  const t0 = (e.objekt['triage'] ?? {}) as Record<string, unknown>;
  const fragen = ['rechtspositionOderChancen', 'gesundheitOderSicherheit', 'verletzlicheGruppen', 'besondereDaten', 'automatisierteEntscheidung', 'grosseReichweite'];
  const ja = fragen.some((f) => t0[f] === true);
  const alle = fragen.every((f) => t0[f] === true || t0[f] === false);
  const vorschlag = ja ? 'voll' : alle ? 'kurz' : undefined;
  if (!vorschlag || t0['ergebnis'] === vorschlag) return null;
  return (
    <Hinweis id={`triage-vorschlag-${e.id}`}>
      <span>{t(`gefuehrt.triage_vorschlag_${vorschlag}`)}</span>{' '}
      <button type="button" class="klein" onClick={() => schreibeFeld({ typ: 'auswahl', pfad: 'triage.ergebnis' }, vorschlag, e)}>{t('gefuehrt.vorschlag_uebernehmen')}</button>
    </Hinweis>
  );
}

/**
 * Kurzprüfung (C4-06): Antworten, die das KI-Inventar schon kennt, erscheinen als Vorschlag; gesetzt
 * werden sie erst mit «Vorschlag übernehmen», damit die Antwort eine Antwort der Person bleibt. Vorschläge nur für unbeantwortete
 * Fragen: besonders schützenswerte Daten (Ja und Nein aus dem Inventar), Entscheid ohne menschliche Prüfung (Ja bei
 * «vollautomatisiert»; «unterstützend» belegt kein Nein, weil Ergebnisse in der Praxis ungeprüft übernommen werden können).
 */
export function triageAusInventar(p: Projekt, kiSystem: string | undefined, pfad: string): boolean | undefined {
  const s = p.kiSysteme.find((x) => x.id === kiSystem);
  if (!s) return undefined;
  if (pfad === 'triage.besondereDaten') return typeof s.besondereDaten === 'boolean' ? s.besondereDaten : undefined;
  if (pfad === 'triage.automatisierteEntscheidung') return s.automatisierung === 'vollautomatisiert' ? true : undefined;
  return undefined;
}

function TriageInventarVorschlag({ p, e, f }: { p: Projekt; e: SeitenEintrag; f: FeldDef }) {
  if (!f.pfad || typeof lies(e.objekt, f.pfad) === 'boolean') return null;
  const v = triageAusInventar(p, e.kiSystem ?? String(e.objekt['kiSystem'] ?? ''), f.pfad);
  if (v === undefined) return null;
  return (
    <Hinweis id={`inventar-vorschlag-${e.kiSystem ?? e.id}-${f.pfad.replace(/\W/g, '_')}`}>
      <span>{t('gefuehrt.vorschlag_inventar', { wert: t(v ? 'feld.ja' : 'feld.nein') })}</span>{' '}
      <button type="button" class="klein" onClick={() => {
        schreibeFeld(f, v, e);
        melde(t('gefuehrt.vorschlag_gesetzt', { feld: feldLabel(f, `gefuehrt.E7.E7-triage.felder`), wert: t(v ? 'feld.ja' : 'feld.nein') }), 'ok');
        // N8: der Hinweis verschwindet; Fokus auf die gesetzte Antwort
        const ki = e.kiSystem ?? String(e.objekt['kiSystem'] ?? '');
        requestAnimationFrame(() => karteVon(ki)?.querySelector<HTMLElement>(`.feld[data-feld="${f.pfad}"] input:checked`)?.focus());
      }}>{t('gefuehrt.vorschlag_uebernehmen')}</button>
    </Hinweis>
  );
}

/** Karte eines Eintrags der Folgenabschätzung im Guide über die Kennung des Systems (die ID des Eintrags entsteht erst beim Schreiben) */
function karteVon(kiSystem: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('section.eintrag')].find((k) => k.querySelector('h3 .marke-id')?.textContent === kiSystem) ?? null;
}

/**
 * Sensible Nutzung (C4-05): weicht das KI-Inventar von der jüngsten Abschätzung des Systems ab
 * (wie F47), zeigt die Seite den Widerspruch; erst der Knopf «Ins Inventar übernehmen» ändert das Inventar.
 */
function SensibelAbgleich({ p, e }: { p: Projekt; e: SeitenEintrag }) {
  if (e.neu) return null;
  const s = p.kiSysteme.find((x) => x.id === e.kiSystem);
  // Massgebend ist die jüngste Abschätzung des Systems (wie F47), auch wenn der Guide eine ältere zeigt; ohne abgelöste und untersagte
  const j = s ? juengsteAbschaetzung(p).get(s.id) : undefined;
  if (!s || !j || s.status === 'abgeloest' || s.status === 'untersagt') return null;
  const hier = j.sensibleNutzung === true;
  if (s.sensibleNutzung === hier) return null;
  const uebernehmen = () => {
    aendereMit((q) => {
      const k = q.kiSysteme.find((x) => x.id === s.id);
      if (k) k.sensibleNutzung = hier;
    });
    melde(t('gefuehrt.sensibel_uebernommen', { id: s.id }), 'ok');
    // N8 (Prüfung test.7): der Knopf verschwindet; Fokus auf die Antwort «Sensible Nutzung» dieser Abschätzung
    requestAnimationFrame(() => karteVon(s.id)?.querySelector<HTMLElement>('.feld[data-feld="sensibleNutzung"] input:checked, .feld[data-feld="sensibleNutzung"] input')?.focus());
  };
  return (
    <Hinweis id={`sensibel-abgleich-${s.id}`}>
      <span>{t(j.id === e.id ? 'gefuehrt.sensibel_widerspruch' : 'gefuehrt.sensibel_widerspruch_juengste', { id: s.id, ia: j.id, inventar: t(s.sensibleNutzung ? 'feld.ja' : 'feld.nein'), hier: t(hier ? 'feld.ja' : 'feld.nein') })}</span>{' '}
      <button type="button" class="klein" onClick={uebernehmen}>{t('gefuehrt.sensibel_uebernehmen')}</button>
    </Hinweis>
  );
}

/**
 * Mit ISMS (C4-04): zu den verknüpften 42001-Controls des Risikos die passenden 27001-Controls
 * aus der Zuordnung (src/kataloge/mapping-42001-27001.yaml, Stärke hoch und mittel) als Vorschlag. Ein Klick hält die
 * Verknüpfung beim 42001-Control fest (Control.iso27001, Erklärung zur Anwendbarkeit D-11); schon verknüpfte fallen weg.
 */
export function controls27001Vorschlaege(p: Projekt, controls: readonly string[]): { id: string; fuer: string[] }[] {
  const k = appDaten().kataloge;
  const r = new Map<string, string[]>();
  for (const c of controls) {
    if (!/^A\./.test(c)) continue;
    const hat = p.controls.find((x) => x.id === c)?.iso27001 ?? [];
    for (const x of vorgeschlagene27001(k, c)) if (!hat.includes(x)) r.set(x, [...(r.get(x) ?? []), c]);
  }
  return [...r].map(([id, fuer]) => ({ id, fuer }));
}

function Controls27001Vorschlaege({ p, e }: { p: Projekt; e: SeitenEintrag }) {
  const o = e.objekt;
  if (!['vermindern', 'vermeiden', 'teilen'].includes(String(o['behandlung'] ?? ''))) return null;
  const v = controls27001Vorschlaege(p, Array.isArray(o['controls']) ? (o['controls'] as string[]) : []);
  if (!v.length) return null;
  const verknuepfen = (x: { id: string; fuer: string[] }) => aendereMit((q) => {
    for (const c of x.fuer) {
      let eintrag = q.controls.find((y) => y.id === c);
      if (!eintrag) {
        eintrag = neuerControlEintrag(c);
        q.controls.push(eintrag);
      }
      if (!eintrag.iso27001.includes(x.id)) eintrag.iso27001 = [...eintrag.iso27001, x.id];
    }
  });
  const nr = (id: string) => id.replace(/^27001-/, '');
  return (
    <div class="control-vorschlaege" id={`controls27001-vorschlaege-${e.id}`}>
      <p class="zweitext">{t('gefuehrt.controls_27001')}</p>
      <div class="leiste">
        {v.map((x) => (
          <button type="button" class="klein" key={x.id} title={`${normTitel(x.id) ?? ''} (${x.fuer.join(', ')})`} onClick={(ev) => {
            // N8: Fokus auf den nächsten Vorschlag bzw. auf die Liste der Controls, Meldung für Bildschirmleser
            const box = (ev.currentTarget as HTMLElement).closest('.control-vorschlaege');
            const nachbar = (ev.currentTarget as HTMLElement).nextElementSibling ?? (ev.currentTarget as HTMLElement).previousElementSibling;
            const nachbarText = nachbar?.textContent;
            verknuepfen(x);
            melde(t('gefuehrt.control27001_verknuepft', { id: nr(x.id), fuer: x.fuer.join(', ') }), 'ok');
            requestAnimationFrame(() => {
              const ziel = [...(box?.querySelectorAll<HTMLElement>('button') ?? [])].find((b) => b.textContent === nachbarText);
              (ziel ?? document.getElementById(`eintrag-${e.id}`)?.querySelector<HTMLElement>('.feld[data-feld="controls"] input, .feld[data-feld="controls"] button'))?.focus();
            });
          }}>
            {t('gefuehrt.control27001_verknuepfen', { id: nr(x.id) })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bewertung aus E6 nur zeigen (M3): vorher und danach als Wert mit Stufe als Wort, nicht neu fragen */
function Bewertung({ p, o }: { p: Projekt; o: Record<string, unknown> }) {
  const zahl = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : null);
  return (
    <p class="bewertung-zeile">
      <span><span class="zweitext">{t('gefuehrt.bewertung_vorher')}</span> <StufePille w={zahl('w')} a={zahl('a')} p={p} />{zahl('w') && zahl('a') ? <span class="zweitext"> {t('gefuehrt.bewertung_wa', { w: zahl('w')!, a: zahl('a')! })}</span> : <span class="zweitext"> {t('gefuehrt.bewertung_fehlt')}</span>}</span>
      <span><span class="zweitext">{t('gefuehrt.bewertung_danach')}</span> <StufePille w={zahl('wNach')} a={zahl('aNach')} p={p} />{zahl('wNach') && zahl('aNach') ? <span class="zweitext"> {t('gefuehrt.bewertung_wa', { w: zahl('wNach')!, a: zahl('aNach')! })}</span> : <span class="zweitext"> {t('gefuehrt.bewertung_offen')}</span>}</span>
    </p>
  );
}

/**
 * Controls zum Verknüpfen mit einem Klick (M3): aus dem Katalogvorschlag des Risikos (Risiko.vorschlag), dann aus Vorschlägen
 * mit derselben Risikoquelle; schon verknüpfte fallen weg, höchstens drei.
 */
export function controlVorschlaege(o: Record<string, unknown>): string[] {
  const hat = new Set(Array.isArray(o['controls']) ? (o['controls'] as string[]) : []);
  const katalog = katalogVorschlaege('genaiRisiken');
  const eigener = katalog.find((v) => v.id === o['vorschlag']);
  const gleicheQuelle = katalog.filter((v) => v !== eigener && v.quelle === o['quelle']);
  const r: string[] = [];
  for (const c of [...(eigener?.controls ?? []), ...gleicheQuelle.flatMap((v) => v.controls)]) if (!hat.has(c) && !r.includes(c)) r.push(c);
  return r.slice(0, 3);
}

function ControlVorschlaege({ e, f, fehlt }: { e: SeitenEintrag; f: FeldDef; fehlt: boolean }) {
  const o = e.objekt;
  if (!['vermindern', 'vermeiden', 'teilen'].includes(String(o['behandlung'] ?? ''))) return null;
  const v = controlVorschlaege(o);
  if (!v.length) return null;
  const hat = Array.isArray(o['controls']) ? (o['controls'] as string[]) : [];
  return (
    <div class="control-vorschlaege" id={`controls-vorschlaege-${e.id}`}>
      <p class={fehlt ? 'fehltext' : 'zweitext'}>{t(hat.length ? 'gefuehrt.controls_weitere' : o['behandlung'] === 'vermindern' ? 'gefuehrt.controls_vermindern' : 'gefuehrt.controls_vorschlaege')}</p>
      <div class="leiste">
        {v.map((c) => <button type="button" class="klein" key={c} onClick={() => schreibeFeld(f, [...hat, c], e)}>{t('gefuehrt.control_verknuepfen', { id: c })}</button>)}
      </div>
    </div>
  );
}

/** Blättern zwischen den Risiken in E8 (M3): «Risiko 3 von 28», vorheriges und nächstes */
function RisikoBlaettern({ eintraege, wahl, waehle }: { eintraege: SeitenEintrag[]; wahl: string; waehle: (id: string) => void }) {
  const i = eintraege.findIndex((x) => x.id === wahl);
  const geh = (j: number) => {
    const z = eintraege[j];
    if (z) waehle(z.id);
  };
  return (
    <span class="leiste risiko-blaettern">
      <span class="zweitext" id="risiko-stelle">{t('gefuehrt.risiko_von', { nummer: i + 1, gesamt: eintraege.length })}</span>
      <button type="button" class="klein" disabled={i <= 0} onClick={() => geh(i - 1)} aria-label={t('gefuehrt.risiko_vorher')} title={t('gefuehrt.risiko_vorher')}><Symbol name="links" /></button>
      <button type="button" class="klein" disabled={i >= eintraege.length - 1} onClick={() => geh(i + 1)} aria-label={t('gefuehrt.risiko_naechstes', { id: eintraege[i + 1]?.id ?? '' })} title={t('gefuehrt.risiko_naechstes', { id: eintraege[i + 1]?.id ?? '' })}><Symbol name="rechts" /></button>
    </span>
  );
}

/** Massnahme direkt beim Risiko anlegen (C-05): verknüpft in beide Richtungen, Reihenfolge der Seiten spielt keine Rolle mehr */
function MassnahmeDirekt({ e }: { e: SeitenEintrag }) {
  const [titel, setTitel] = useState('');
  const id = `massnahme-neu-${e.id}`;
  const anlegen = () => {
    const text = titel.trim();
    if (!text) return;
    let neu = '';
    aendereMit((p) => {
      // Priorität aus dem Risiko: über der Akzeptanzgrenze hoch (C2-20)
      const quelle = p.risiken.find((x) => x.id === e.id);
      const hoch = !!quelle && (quelle.w ?? 0) * (quelle.a ?? 0) > p.organisation.risikokriterien.akzeptanzBis;
      const m = neuerEintrag(p, 'massnahmen', { titel: text, herkunft: { art: 'risiko', ref: e.id }, status: 'offen', prioritaet: hoch ? 'hoch' : 'mittel' });
      neu = String(m['id']);
      p.massnahmen.push(m as never);
      const r = p.risiken.find((x) => x.id === e.id);
      if (r) r.massnahmen = [...(r.massnahmen ?? []), neu];
    });
    setTitel('');
    melde(t('gefuehrt.massnahme_angelegt', { id: neu, risiko: e.id }), 'ok');
  };
  return (
    <div class="feld massnahme-direkt">
      <label for={id} class="nur-sr">{t('gefuehrt.massnahme_neu_label', { id: e.id })}</label>
      <div class="leiste">
        <input id={id} type="text" maxLength={500} value={titel} placeholder={t('gefuehrt.massnahme_neu_label', { id: e.id })} onInput={(ev) => setTitel(ev.currentTarget.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); anlegen(); } }} />
        <button type="button" class="klein" id={`${id}-knopf`} disabled={!titel.trim()} onClick={anlegen}>{t('gefuehrt.massnahme_neu')}</button>
      </div>
    </div>
  );
}

function begruendungVeraltet(e: SeitenEintrag, grund: 'risiko' | 'aiact' | 'nistrmf', quellen: string[]): boolean {
  return e.objekt['anwendbar'] === 'ja' && begruendungNachfuehren(e.objekt['begruendung'], t(`soa.begruendung_${grund}`, { quellen: '{quellen}' }), quellen) !== undefined;
}

export function vorschlagUebernehmen(e: SeitenEintrag, grund: 'risiko' | 'aiact' | 'nistrmf', quellen: string[]) {
  const begruendung = t(`soa.begruendung_${grund}`, { quellen: quellen.join(', ') });
  schreibeFeld({ typ: 'auswahl', pfad: 'anwendbar' }, 'ja', e);
  // Nach dem Anlegen existiert der Eintrag: ab hier direkt schreiben
  const ee = { ...e, neu: false };
  if (istLeer(e.objekt['begruendung']) || begruendungVeraltet(e, grund, quellen)) schreibeFeld({ typ: 'textarea', pfad: 'begruendung' }, begruendung, ee);
  schreibeFeld({ typ: 'text', pfad: 'vorschlag' }, grund, ee);
}

function Fahrplan({ p }: { p: Projekt }) {
  const g = umfeld.value.gefuehrt;
  const def = g.etappen.fahrplan;
  const etappen = aktiveEtappen(g, p).filter((e) => e.id !== 'J');
  const h = (e: EtappeDef) => (e.dauer_h ? (p.meta.mitIsms ? e.dauer_h.mit_isms : e.dauer_h.ohne_isms) : 0);
  const stunden = etappen.reduce((a, e) => a + h(e), 0);
  const kopf = (
    <p>
      <strong>{t(p.meta.mitIsms ? 'pfad.mit_isms' : 'pfad.ohne_isms')}</strong> · <strong>{modulText(p)}</strong>
    </p>
  );
  if (!def) return <div>{kopf}<p>{t('fahrplan.stunden', { stunden: zahlText(stunden) })}</p></div>;
  const f = berechneFahrplan(p, def, etappen, stichtag.value);
  const ebIds = new Set(appDaten().kataloge.dokumente.dokumente.filter((d) => d.eb).map((d) => d.id));
  const kw = (z: PlanWoche) => (z.kw ? t('fahrplan.kw', { woche: z.kw.woche, jahr: z.kw.jahr }) : '');
  const zahl = (n: number) => zahlText(n);
  const wochenText = (von: number, bis: number) => (von === bis ? t('fahrplan.woche', { woche: von }) : t('fahrplan.wochen_bereich', { von, bis }));
  const meilensteinText = (id: string) => inhalt(`app.fahrplan.meilensteine.${id}`) ?? id;
  const vorhanden = new Set((p.organisation.projektauftrag?.meilensteine ?? []).map((m) => m.was.trim()));
  const fehlend = f.meilensteine.filter((m) => !vorhanden.has(meilensteinText(m.id)));
  const takt = p.organisation.projektauftrag?.glTraktandum;
  const ptText = (schluessel: string) =>
    t(schluessel, {
      pensum: zahl(f.pensum ?? 0), kapazitaet: zahl(f.kapazitaet ?? 0), von: zahl(f.ptAims[0]), bis: zahl(f.ptAims[1]),
      ab: f.abAuftrag ? t('fahrplan.ab_auftrag', { datum: datumText(f.ab) }) : t('fahrplan.ab_heute'),
    });
  const uebernehmen = () => {
    const neu = fehlend.map((m) => ({ was: meilensteinText(m.id), ...(m.zeit.freitag ? { termin: m.zeit.freitag } : {}) }));
    aendereMit((x) => {
      const a = (x.organisation.projektauftrag ??= {});
      a.meilensteine = [...(a.meilensteine ?? []), ...neu];
    });
    melde(t('fahrplan.meilensteine_uebernommen', { anzahl: neu.length }), 'ok');
  };
  return (
    <div id="fahrplan">
      {kopf}
      {f.ziel ? (
        <p>{t(f.puffer ? 'fahrplan.ziel_puffer' : 'fahrplan.ziel', { datum: datumText(f.ziel), wochen: f.wochen, start: datumText(f.start), kw: kw({ woche: 1, kw: kalenderwoche(f.start!) }), puffer: f.puffer ?? 0 })}</p>
      ) : (
        <Hinweis als="p" id="fahrplan-termin">
          {t('fahrplan.kein_termin', { wochen: f.wochen })}{' '}
          <a href={routeZuHash({ art: 'gefuehrt', etappe: 'E0', seite: 'E0-termin' })}>{t('fahrplan.zum_termin')}</a>
        </Hinweis>
      )}
      {f.erweitert.length > 0 && (
        <Hinweis als="p">{t(f.gestreckt ? 'fahrplan.gestreckt' : 'fahrplan.erweitert_ohne_isms', { gruende: f.erweitert.map((x) => t(`fahrplan.grund.${x}`)).join(', '), von: f.pt[0], bis: f.pt[1] })}</Hinweis>
      )}
      {f.startVorbei && <Hinweis als="p" art="warnung" id="fahrplan-start">{t('fahrplan.start_vorbei', { start: datumText(f.start) })}</Hinweis>}
      {f.puffer > 0 && <Hinweis als="p" art="ok" id="fahrplan-puffer">{t('fahrplan.puffer', { wochen: f.puffer, start: datumText(f.start) })}</Hinweis>}
      <FahrplanGantt p={p} f={f} meilensteinText={meilensteinText} />
      <div class="tabelle-feld">
        <table>
          <caption class="nur-sr">{t('fahrplan.titel_schritte')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('fahrplan.schritt')}</th>
              <th scope="col">{t('fahrplan.etappen')}</th>
              <th scope="col">{t('fahrplan.plan')}</th>
              {f.ziel && <th scope="col">{t('fahrplan.kalender')}</th>}
              <th scope="col">{t('fahrplan.pt')}</th>
            </tr>
          </thead>
          <tbody>
            {f.schritte.map((s) => (
              <tr key={s.nr}>
                <td>{s.nr}</td>
                <td>{s.etappen.map((e) => `${e} ${etappenTitel(e)}`).join(', ')}</td>
                <td>{wochenText(s.von.woche, s.bis.woche)}</td>
                {f.ziel && <td>{s.von.woche === s.bis.woche ? kw(s.von) : t('fahrplan.kw_bereich', { von: kw(s.von), bis: kw(s.bis) })}<br /><span class="zweitext">{datumText(s.von.montag)} {t('fahrplan.bis')} {datumText(s.bis.freitag)}</span></td>}
                <td>{zahl(s.pt[0])} {t('fahrplan.bis')} {zahl(s.pt[1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: '12px' }}>{t('fahrplan.pt_summe', { von: zahl(f.pt[0]), bis: zahl(f.pt[1]), aimsVon: zahl(f.ptAims[0]), aimsBis: zahl(f.ptAims[1]) })}</p>
      {f.ptNist && <Hinweis als="p" id="fahrplan-nist">{t('fahrplan.modul_nist', { von: zahl(f.ptNist[0]), bis: zahl(f.ptNist[1]) })}</Hinweis>}
      <p class="zweitext">{t('fahrplan.stunden', { stunden: zahlText(stunden) })}</p>
      {f.ptStand === 'ohne-pensum' && <Hinweis als="p" id="fahrplan-pt">{t('fahrplan.ohne_pensum')}</Hinweis>}
      {f.ptStand === 'ok' && <Hinweis als="p" art="ok" id="fahrplan-pt">{ptText('fahrplan.pt_ok')}</Hinweis>}
      {f.ptStand === 'knapp' && <Hinweis als="p" art="warnung" id="fahrplan-pt">{ptText('fahrplan.pt_knapp')}</Hinweis>}
      {f.ptStand === 'reicht-nicht' && <Hinweis als="p" art="warnung" id="fahrplan-pt">{ptText('fahrplan.pt_reicht_nicht')}</Hinweis>}
      <h2>{t('fahrplan.meilensteine_titel')}</h2>
      <div class="tabelle-feld">
        <table>
          <thead><tr><th scope="col">{t('fahrplan.plan')}</th>{f.ziel && <th scope="col">{t('fahrplan.kalender')}</th>}<th scope="col">{t('fahrplan.meilenstein')}</th></tr></thead>
          <tbody>
            {f.meilensteine.map((m) => (
              <tr key={m.id}><td>{t('fahrplan.woche', { woche: m.zeit.woche })}</td>{f.ziel && <td>{kw(m.zeit)} ({datumText(m.zeit.freitag)})</td>}<td>{meilensteinText(m.id)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {fehlend.length > 0
          ? <button type="button" id="fahrplan-meilensteine" onClick={uebernehmen}>{t('fahrplan.meilensteine_uebernehmen', { anzahl: fehlend.length })}</button>
          : <span class="zweitext">{t('fahrplan.meilensteine_vorhanden')}</span>}
      </p>
      <h2>{t('fahrplan.freigaben_titel')}</h2>
      <p>{t(p.meta.mitIsms ? 'fahrplan.freigaben_text' : 'fahrplan.freigaben_text_ohne_isms')}</p>
      {takt && takt !== 'vierzehntaeglich' && <Hinweis als="p" art="warnung">{t('fahrplan.takt_langsam', { takt: optionText('glTakt', takt) })}</Hinweis>}
      <div class="tabelle-feld">
        <table>
          <thead><tr><th scope="col">{t('fahrplan.plan')}</th>{f.ziel && <th scope="col">{t('fahrplan.kalender')}</th>}<th scope="col">{t('fahrplan.freigabe')}</th><th scope="col">{t('fahrplan.vorlagen')}</th><th scope="col">{t('fahrplan.stand')}</th></tr></thead>
          <tbody>
            {f.freigaben.map((x) => {
              const st = freigabeStand(p, x, ebIds, stichtag.value);
              return (
                <tr key={x.id} data-freigabe={x.id}>
                  <td>{t('fahrplan.woche', { woche: x.zeit.woche })}</td>
                  {f.ziel && <td>{kw(x.zeit)}</td>}
                  <td>{freigabeText(p, x.id)}</td>
                  <td>{st.dokumente.map((d, i) => <span key={d.id}>{i > 0 && ', '}<span>{d.id}{d.erledigt ? <> <Symbol name="haken" klasse="sym sym-text" /><span class="nur-sr">{t('grafik.zustand.erledigt')}</span></> : ''}</span></span>)}</td>
                  <td>{st.erledigt ? <StatusPille art="gut">{t('fahrplan.stand_erledigt')}</StatusPille> : t('fahrplan.stand_offen')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Text einer Freigabe im Freigabekalender, je Pfad (Projektauftrag ohne ISMS mit Kurzfassung der Dokumentenlenkung) */
function freigabeText(p: Projekt, id: string): string {
  return (!p.meta.mitIsms ? inhalt(`app.fahrplan.freigaben_ohne_isms.${id}`) : undefined) ?? inhalt(`app.fahrplan.freigaben.${id}`) ?? id;
}

/** Zustand eines Schritts aus seinen Etappen: alle vollständig, eine begonnen (in Arbeit), sonst offen. */
function schrittZustand(staende: readonly EtappenStand[], etappen: string[]): GanttZeile['zustand'] {
  const st = etappen.map((e) => staende.find((x) => x.id === e)?.zustand ?? 'offen');
  if (st.length && st.every((x) => x === 'erledigt')) return 'erledigt';
  return st.some((x) => x !== 'offen') ? 'aktiv' : 'offen';
}

/** Fahrplan als Gantt: Schritte 1 bis 10 auf der Wochenachse, Meilensteine und Freigaben, Linie heute (mit Zieltermin). */
export function FahrplanGantt({ p, f, meilensteinText }: { p: Projekt; f: ReturnType<typeof berechneFahrplan>; meilensteinText: (id: string) => string }) {
  const staende = etappenStaende(p);
  const zeilen: GanttZeile[] = f.schritte.map((s) => ({
    titel: t('grafik.gantt_schritt', { nr: s.nr }),
    text: s.etappen.join(', '),
    von: s.von.woche,
    bis: s.bis.woche,
    zustand: schrittZustand(staende, s.etappen),
  }));
  const marken: GanttMarke[] = [
    ...f.meilensteine.map((m) => ({ woche: m.zeit.woche, text: meilensteinText(m.id), art: 'meilenstein' as const })),
    ...f.freigaben.map((x) => ({ woche: x.zeit.woche, text: freigabeText(p, x.id), art: 'freigabe' as const })),
  ];
  const tag = 86_400_000;
  const heuteWoche = f.start ? (Date.parse(`${stichtag.value}T00:00:00Z`) - Date.parse(`${f.start}T00:00:00Z`)) / (7 * tag) + 1 : undefined;
  const kwVon = (w: number) => {
    const s = f.schritte.flatMap((x) => [x.von, x.bis]).find((z) => z.woche === w);
    if (s?.kw) return `${t('grafik.kurz_kw')} ${s.kw.woche}`;
    if (!f.start) return String(w);
    return `${t('grafik.kurz_kw')} ${kalenderwoche(new Date(Date.parse(`${f.start}T00:00:00Z`) + (w - 1) * 7 * tag).toISOString().slice(0, 10)).woche}`;
  };
  const beschreibung = t('grafik.gantt_beschreibung', {
    wochen: f.wochen,
    schritte: f.schritte.map((s, i) => t('grafik.gantt_zeile', { nr: s.nr, zustand: t(`grafik.zustand.${zeilen[i]!.zustand}`), von: s.von.woche, bis: s.bis.woche })).join('; '),
  });
  return (
    <figure class="g-figur" style={{ margin: '12px 0 16px' }}>
      <Gantt zeilen={zeilen} texte={{ titel: t('grafik.gantt_titel'), beschreibung, heute: stichtagAbweichend.value ? t('grafik.stichtag') : t('grafik.heute'), meilensteine: t('fahrplan.meilensteine_titel'), freigaben: t('grafik.gantt_freigaben') }}
        optionen={{ id: 'fahrplan-gantt', wochen: f.wochen, marken, heute: heuteWoche, achse: kwVon }} />
      <figcaption class="zweitext">{t('grafik.gantt_legende')}</figcaption>
    </figure>
  );
}

function Kalender({ p, seite }: { p: Projekt; seite: SeiteDef }) {
  const heuteIso = heute();
  const jahr = stichtag.value.slice(0, 4);
  const etappeVon = (id: string) => umfeld.value.gefuehrt.etappen.etappen.find((e) => e.seiten.includes(id))?.id;
  const eintraege = kalenderEintraege(p, seite.aufgaben ?? [], stichtag.value);
  const zahl = (st: string) => eintraege.filter((e) => e.stand === st).length;
  return (
    <div>
      <p class="leiste" id="kalender-stand">
        <StatusPille art="kritisch">{t('kalender.anzahl_ueberfaellig', { anzahl: zahl('ueberfaellig') })}</StatusPille>
        <StatusPille art="warnung">{t('kalender.anzahl_bald', { anzahl: zahl('bald') })}</StatusPille>
        <StatusPille art="gut">{t('kalender.anzahl_erledigt', { anzahl: zahl('erledigt'), jahr })}</StatusPille>
      </p>
      <ul class="befunde kalender">
        {eintraege.map((k) => {
          const a = k.aufgabe;
          const e = etappeVon(a.seite);
          return (
            <li key={a.id} class={`st-${k.stand}`}>
              <StatusPille art={k.stand === 'ueberfaellig' ? 'kritisch' : 'warnung'}>{optionText('rhythmus', a.rhythmus)}</StatusPille>
              <div class="text">
                <p style={{ margin: 0 }}>{inhalt(`gefuehrt.kalender.${a.id}`) ?? a.id}</p>
                <p class="zweitext" style={{ margin: 0 }}>
                  {t('hilfe.norm', { abschnitt: a.norm })}
                  {(!k.faellig || k.stand === 'erledigt') && ` · ${t(`kalender.stand.${k.stand}`)}`}
                  {k.faellig && ` · ${t(k.stand === 'ueberfaellig' ? 'kalender.ueberfaellig' : 'kalender.faellig', { datum: datumText(k.faellig) })}`}
                  {k.monat && !a.faelligAus && ` (${optionText('monat', k.monat)})`}
                  {!k.faellig && k.stand !== 'erledigt' && ` · ${t('kalender.alle', { monate: RHYTHMUS_MONATE[a.rhythmus] ?? 12 })}`}
                </p>
                {k.betroffen.length > 0 && (
                  <p class="zweitext" style={{ margin: 0 }}>
                    {t('kalender.betroffen', { anzahl: k.betroffen.length })}: {k.betroffen.slice(0, 5).map((x) => `${x.name || x.id} (${datumText(x.datum)})`).join(', ')}
                    {k.betroffen.length > 5 && ' …'}
                  </p>
                )}
              </div>
              <div class="leiste">
                {e && <a class="knopf klein" href={routeZuHash({ art: 'gefuehrt', etappe: e, seite: a.seite })}>{t('kalender.oeffnen')}</a>}
                <label class="check">
                  <input type="checkbox" checked={k.erledigt} onChange={(ev) => aendere(['meta', 'checklisten', k.schluessel], { erledigt: ev.currentTarget.checked, datum: heuteIso })} />
                  <span>{t('kalender.erledigt', { jahr })}</span>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Befunde der Prüfregeln zu dieser Seite (AF-139): Text, Erklärung und Sprung zur Stelle; so erfährt der Neuling, was die Seite offen hält */
function SeitenBefunde({ seite, p }: { seite: SeiteDef; p: Projekt }) {
  const u = umfeld.value;
  const liste = befundeDerSeite(seite, p, u);
  if (liste.length === 0) return null;
  // Fehlen zugleich Pflichtangaben, sagt der Text beides getrennt (nicht «vollständig»)
  const luecken = pflichtLuecken(seite, p, u).length > 0;
  return (
    <Hinweis als="section" art="warnung" klasse="seiten-befunde" aria-labelledby="seiten-befunde-titel">
      <h2 id="seiten-befunde-titel">{t('gefuehrt.befund_titel')}</h2>
      <p class="zweitext" id="seiten-befunde-text">{t(luecken ? 'gefuehrt.befund_text_luecken' : 'gefuehrt.befund_text')}</p>
      <ul class="befunde">
        {liste.map((b, i) => {
          const tx = befundText(b);
          const r = gefuehrtSprung(b, p, u.gefuehrt);
          return (
            <li key={`${b.regel}-${b.id ?? ''}-${i}`} data-regel={b.regel}>
              <div class="text">
                <strong>{tx.titel}</strong>
                <p class="befund-erklaerung">{tx.erklaerung}</p>
                <span class="zweitext">{b.regel} · {t('hilfe.norm', { abschnitt: b.norm })}</span>
              </div>
              {r && <a class="knopf klein" href={routeZuHash(r)}>{t('gefuehrt.befund_springen')}</a>}
            </li>
          );
        })}
      </ul>
    </Hinweis>
  );
}

/** Status für die Anzeige: «befund», wenn nur die Prüfregeln die Seite offen halten (alle Pflichtangaben sind da) */
export function statusSchluessel(s: SeiteDef, etappe: string, p: Projekt, u: Umfeld): string {
  const st = seitenStatus(s, etappe, p, u);
  return st === 'unvollstaendig' && pflichtLuecken(s, p, u).length === 0 && befundeDerSeite(s, p, u).length > 0 ? 'befund' : st;
}

function Abschluss({ p, etappe, etappen, kopf, kontext }: { p: Projekt; etappe: EtappeDef; etappen: EtappeDef[]; kopf?: ComponentChildren; kontext?: string }) {
  const u = umfeld.value;
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), [etappe.id]);
  const ids = checklisteIds(etappe, p);
  const offeneSeiten = aktiveSeiten(u.gefuehrt, etappe, p).filter((s): s is SeiteDef => s.typ !== 'fehlt' && seitenStatus(s, etappe.id, p, u) !== 'erledigt');
  const offenCheck = ids.filter((id) => !p.meta.checklisten[id]?.erledigt);
  const i = etappen.findIndex((e) => e.id === etappe.id);
  const naechste = etappen[i + 1];
  const vorhandeneRefs = new Set(p.massnahmen.map((m) => m.herkunft.ref));
  const abschliessen = () => {
    const erste = naechste ? aktiveSeiten(u.gefuehrt, naechste, p)[0]?.id : undefined;
    etappeAbschliessen(etappe.id, offeneSeiten.length === 0 && offenCheck.length === 0, naechste && erste ? { etappe: naechste.id, seite: erste } : undefined);
    navigiere(naechste ? { art: 'gefuehrt', etappe: naechste.id } : { art: 'pruefung' });
  };
  return (
    <GefuehrtRaster kopf={
      <Seitenkopf titel={t('abschluss.titel')} titelRef={titelRef} kontext={kontext}
        aktion={<button type="button" class="primaer" id="kopf-weiter" onClick={abschliessen}>{naechste ? t('abschluss.weiter', { etappe: etappenTitel(naechste.id) }) : t('abschluss.zur_pruefung')}</button>} />
    } haupt={
      <div class="seite">
        {kopf}
        <div class="karte">
          <p class="zweitext">{etappe.id} {etappenTitel(etappe.id)}</p>
          <p>{t('abschluss.text')}</p>
          {ids.length > 0 && (
            <section>
              <h2>{t('abschluss.checkliste')}</h2>
              {ids.map((id) => (
                <Feld key={id} def={{ typ: 'checkliste', schluessel: id }} wert={p.meta.checklisten[id]} setze={(v) => aendere(['meta', 'checklisten', id], v)} id={`check-${id}`} label={inhalt(`gefuehrt.checklisten.${id}`) ?? id} />
              ))}
            </section>
          )}
          <section>
            <h2>{t('abschluss.offen')}</h2>
            {offeneSeiten.length === 0 && offenCheck.length === 0 ? (
              <Hinweis als="p" art="ok">{t('abschluss.alles_erledigt')}</Hinweis>
            ) : (
              <ul class="befunde">
                {offeneSeiten.map((s) => (
                  <li key={s.id}>
                    <div class="text">
                      <a href={routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: s.id })}>{seitenText(etappe, s, 'titel') ?? s.id}</a>
                      <span class="zweitext"> · {t(`gefuehrt.seitenstatus.${statusSchluessel(s, etappe.id, p, u)}`)}</span>
                    </div>
                    <button type="button" class="klein" disabled={vorhandeneRefs.has(s.id)} onClick={() => melde(t('abschluss.massnahme_angelegt', { id: alsMassnahme(seitenText(etappe, s, 'titel') ?? s.id, s.id) }), 'ok')}>
                      {vorhandeneRefs.has(s.id) ? t('abschluss.ist_massnahme') : t('abschluss.als_massnahme')}
                    </button>
                  </li>
                ))}
                {offenCheck.map((id) => (
                  <li key={id}>
                    <div class="text">{inhalt(`gefuehrt.checklisten.${id}`) ?? id}</div>
                    <button type="button" class="klein" disabled={vorhandeneRefs.has(id)} onClick={() => melde(t('abschluss.massnahme_angelegt', { id: alsMassnahme(inhalt(`gefuehrt.checklisten.${id}`) ?? id, id) }), 'ok')}>
                      {vorhandeneRefs.has(id) ? t('abschluss.ist_massnahme') : t('abschluss.als_massnahme')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div class="knoepfe">
            <a class="knopf" href={routeZuHash({ art: 'gefuehrt', etappe: etappe.id, seite: aktiveSeiten(u.gefuehrt, etappe, p).at(-1)?.id })}>{t('gefuehrt.zurueck')}</a>
            <button type="button" class="weiter" onClick={abschliessen}>{naechste ? t('abschluss.weiter', { etappe: etappenTitel(naechste.id) }) : t('abschluss.zur_pruefung')}</button>
          </div>
        </div>
      </div>
    } hilfe={
      <aside class="hilfe karte" id="hilfe" aria-label={t('hilfe.titel')}>
        <h2>{t('abschluss.stand')}</h2>
        <p>{t('gefuehrt.fortschritt', { erledigt: etappenFortschritt(etappe, p, u).erledigt, gesamt: etappenFortschritt(etappe, p, u).gesamt })}</p>
        <p class="zweitext">{t('abschluss.hinweis')}</p>
        <p><a href={routeZuHash({ art: 'pruefung' })}>{t('abschluss.zur_pruefung')}</a></p>
      </aside>
    } />
  );
}

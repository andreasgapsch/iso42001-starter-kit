// Rahmen des AIMS-Managers (R2): Symbolleiste mit den Hauptbereichen (Ebene 1, 56 px), Untermenü des Bereichs
// (Ebene 2, 232 px, einklappbar, Zustand gemerkt; unter 900 px als Blatt). Einen projektweiten Kopf gibt es nicht mehr
// (U-34): jede Ansicht hat ihren Seitenkopf (rahmen/Seitenkopf.tsx) mit H1, Suche und einer Hauptaktion; Projektname,
// Speichern und Öffnen liegen in der Projekt-Kachel. Unter 640 px (Telefon, U-14) liegt die Symbolleiste unten: vier
// Hauptbereiche und «Mehr» mit den übrigen Bereichen und dem Projekt als Blatt.
// Tastatur: Pfeiltasten, Pos1 und Ende in der Symbolleiste (oben wie unten), «/» Suche, «g» dann Buchstabe für die
// Bereiche, Escape schliesst Blätter und Menüs, Fokus bleibt im offenen Blatt und kehrt danach zurück.
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { datumText, inhalt, t } from '../i18n.ts';
import { appDaten } from '../daten.ts';
import { rechtsstandWarnung, type RechtsstandQuelle } from '../logik/rechtsstand.ts';
import { routeZuHash, type Route } from '../logik/routen.ts';
import { andereTabs, zwischenspeicherArt, befunde, beispielUnveraendert, fehlerStand, migrationsSicherung, navigiere, nurLesen, projekt, route, speicherHinweis, speicherHinweisBestaetigen, speicherStatus, stichtag, ungespeichert } from '../zustand/store.ts';
import { oeffnenAblauf } from '../ansichten/start/Start.tsx';
import { BEREICHE, bereichTitel, bereichVon, ortTitel, untermenue, type Bereich, type BereichId, type RahmenGruppe } from './bereiche.ts';
import { useBlatt } from './blatt.ts';
import { faelligListe } from './faellig.ts';
import { AUFBEWAHRUNG_TAGE } from '../speicher/projekt-speicher.ts';
import { beenden, sicherungAblegen, speichern } from './speichern.ts';
import { speicherZeit } from './Seitenkopf.tsx';
import { Symbol } from './symbole.tsx';
import { tr } from './text.ts';
import { Hinweis } from '../ui/Hinweis.tsx';
import { weichTrennen } from './trennen.ts';
import { ausdruckTitel, druckTitel } from './Druckrahmen.tsx';
import { breite, mehrOffen, schmal, setzeUntermenueZu, telefon, untermenueMobil, untermenueZu } from './zustand.ts';

export { setzeUntermenueZu, untermenueMobil, untermenueZu } from './zustand.ts';

/** Klick auf ein Symbol (900 bis 640 px): Untermenü bleibt nach dem Seitenwechsel offen, damit man den Eintrag wählen kann */
let offenNachWechsel = false;
globalThis.addEventListener?.('hashchange', () => {
  mehrOffen.value = false;
  if (offenNachWechsel) offenNachWechsel = false;
  else untermenueMobil.value = false;
});

/** Reihenfolge der unteren Leiste (Telefon): die ersten vier sichtbaren Bereiche stehen in der Leiste, die übrigen unter «Mehr» */
const LEISTE_UNTEN: readonly BereichId[] = ['start', 'guide', 'register', 'bibliothek', 'uebersicht', 'prozesse', 'wissen', 'pruefung', 'hinweise', 'hilfe', 'einstellungen'];
const IN_LEISTE = 4;

/** Ziel eines Bereichs: seine erste Seite (wie im Mockup; die Stelle im Guide merkt sich der Guide selbst) */
function zielVon(b: Bereich): string {
  return routeZuHash(b.ziel);
}

/** Kürzel des Projekts: Anfangsbuchstaben der ersten drei Wörter des Firmennamens */
export function kuerzel(name: string): string {
  const w = name.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter((x) => x && !/^(ag|gmbh|sa|sarl|ltd|inc|plc|kg|co)$/i.test(x));
  return (w.slice(0, 3).map((x) => x[0]!).join('') || 'P').toUpperCase();
}

/** Bereiche der Symbolleiste: sichtbar (mit oder ohne Projekt), in der unteren Leiste oder unter «Mehr» */
export function leistenBereiche(mitProjekt: boolean): { sichtbar: Bereich[]; leiste: Set<BereichId>; mehr: Bereich[] } {
  const sichtbar = BEREICHE.filter((b) => !b.mitProjekt || mitProjekt);
  const ids = new Set(sichtbar.map((b) => b.id));
  const leiste = new Set(LEISTE_UNTEN.filter((id) => ids.has(id)).slice(0, IN_LEISTE));
  return { sichtbar, leiste, mehr: sichtbar.filter((b) => !leiste.has(b.id)) };
}

/** Zusatz zum Namen eines Bereichs: Fehler der Prüfung, fällige Aufgaben */
function zusatzVon(id: BereichId): string {
  const fehler = fehlerStand.value.jetzt.length;
  const offen = fehlerStand.value.spaeter.length;
  const faellig = faelligListe.value.length;
  return id === 'pruefung' && fehler ? tr('leiste.fehler', { anzahl: fehler }) : id === 'pruefung' && offen ? tr('leiste.offen', { anzahl: offen })
    : id === 'hinweise' && faellig ? tr('leiste.faellig', { anzahl: faellig }) : '';
}

function Abzeichen({ id }: { id: BereichId }) {
  const fehler = fehlerStand.value.jetzt.length;
  const faellig = faelligListe.value.length;
  if (id === 'pruefung' && fehler > 0) return <span class="plakette" aria-hidden="true">{fehler > 99 ? '99+' : fehler}</span>;
  if (id === 'hinweise' && faellig > 0) return <span class="lpunkt" aria-hidden="true" />;
  return null;
}

/** Pfeiltasten, Pos1 und Ende zwischen den sichtbaren Knöpfen der Symbolleiste (senkrecht und unten waagrecht) */
function leistenTaste(e: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const knoepfe = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.lknopf')].filter((k) => k.offsetParent !== null);
  const i = knoepfe.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const vor = e.key === 'ArrowDown' || e.key === 'ArrowRight';
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? knoepfe.length - 1 : (i + (vor ? 1 : -1) + knoepfe.length) % knoepfe.length;
  knoepfe[n]?.focus();
}

function Symbolleiste({ aktiv }: { aktiv: BereichId }) {
  const p = projekt.value;
  void breite.value;
  const { sichtbar, leiste, mehr } = leistenBereiche(!!p);
  const mehrAktiv = mehr.some((b) => b.id === aktiv);
  const mehrHinweis = mehr.some((b) => (b.id === 'pruefung' && fehlerStand.value.jetzt.length) || (b.id === 'hinweise' && faelligListe.value.length));
  const knopf = (b: Bereich) => {
    const titel = bereichTitel(b.id);
    const zusatz = zusatzVon(b.id);
    return (
      <li key={b.id} class={leiste.has(b.id) ? 'haupt' : undefined}>
        <a class="lknopf" href={zielVon(b)} aria-label={zusatz ? `${titel}, ${zusatz}` : titel} aria-current={aktiv === b.id ? 'true' : undefined}
          data-bereich={b.id} data-tipp={titel}
          onClick={(e) => {
            if (telefon()) return;
            if (schmal()) {
              offenNachWechsel = (e.currentTarget as HTMLAnchorElement).hash !== globalThis.location.hash;
              untermenueMobil.value = true;
            } else if (aktiv === b.id && untermenueZu.value) setzeUntermenueZu(false);
          }}>
          <Symbol name={b.icon} />
          <span class="lname" aria-hidden="true">{titel}</span>
          <Abzeichen id={b.id} />
        </a>
      </li>
    );
  };
  return (
    <nav class="symbolleiste" aria-label={tr('navi.hauptbereiche')} onKeyDown={leistenTaste}>
      <span class="rahmen-marke" aria-hidden="true">AI</span>
      <ul class="leiste-oben">
        {sichtbar.filter((b) => !b.unten).map(knopf)}
        {(mehr.length > 0 || p) && (
          <li class="mehr">
            <button type="button" class={`lknopf mehr-knopf${mehrAktiv ? ' aktiv' : ''}`} id="mehr-knopf" aria-haspopup="dialog" aria-expanded={mehrOffen.value} aria-controls="mehr-blatt"
              aria-label={mehrAktiv ? `${tr('navi.mehr')}, ${tr('navi.mehr_aktiv', { bereich: bereichTitel(aktiv) })}` : tr('navi.mehr')}
              onClick={() => (mehrOffen.value = !mehrOffen.value)}>
              <Symbol name="mehr" />
              <span class="lname" aria-hidden="true">{tr('navi.mehr')}</span>
              {mehrHinweis && <span class="lpunkt" aria-hidden="true" />}
            </button>
          </li>
        )}
      </ul>
      <ul class="leiste-unten">{sichtbar.filter((b) => b.unten).map(knopf)}</ul>
      {p && <ProjektKachel />}
    </nav>
  );
}

/** Projekt: Name, Speicherstand und Aktionen (Projekt-Kachel und Blatt «Mehr») */
function ProjektAktionen({ schliessen, idZusatz = '' }: { schliessen: (fokus?: boolean) => void; idZusatz?: string }) {
  const p = projekt.value!;
  const name = p.organisation.name || t('kopf.ohne_name');
  const statusText = ungespeichert.value ? (beispielUnveraendert.value ? t('kopf.beispiel_unveraendert') : t('kopf.ungespeichert')) : t('kopf.gespeichert');
  return (
    <>
      <p class="projekt-menue-name projektname" id={`projekt-name${idZusatz}`}>{name}</p>
      <p class="zweitext">{statusText}{speicherZeit() ? ` · ${speicherZeit()}` : ''}{speicherStatus.value?.dateiname ? ` · ${speicherStatus.value.dateiname}` : ''}</p>
      <button type="button" class="klein" id={`projekt-speichern${idZusatz}`} onClick={() => { schliessen(); void speichern(false); }}>{t('kopf.speichern')}<kbd class="kein-telefon" aria-hidden="true">Ctrl+S</kbd></button>
      <button type="button" class="klein" onClick={() => { schliessen(); void speichern(true); }}>{tr('projekt.speichern_unter')}</button>
      <button type="button" class="klein" onClick={() => { schliessen(false); navigiere({ art: 'start' }); void oeffnenAblauf(); }}>{tr('projekt.oeffnen')}</button>
      <button type="button" class="klein" id={`projekt-beenden${idZusatz}`} onClick={() => { schliessen(false); void beenden(); }}>{tr('projekt.beenden')}</button>
      <a class="knopf klein" href={routeZuHash({ art: 'start', unter: 'projekte' })} onClick={() => schliessen(false)}>{tr('projekt.andere')}</a>
      <a class="knopf klein" href={routeZuHash({ art: 'einstellungen', bereich: 'projekt' })} onClick={() => schliessen(false)}>{tr('einstellungen.projekt')}</a>
    </>
  );
}

/** Ort als Text für Bildschirmleser, im Hauptbereich (axe region, D-15); App zeichnet ihn dort */
export const ortText = signal('');
export function OrtText() {
  return <span class="kopf-pfad nur-sr" id="kopf-pfad">{ortText.value}</span>;
}

/** Heutiges Datum in Ortszeit (JJJJ-MM-TT): der Rechtsstand altert mit der echten Zeit, nicht mit dem Stichtag eines Beispiels */
function heuteOrtszeit(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/**
 * Hinweis auf alten Rechtsstand (AF-117, W10): Prüfdatum von src/ai-act/stand.yaml älter als 6 Monate oder ein Hinweis mit
 * status zu_pruefen ohne Sichtung in dieser Zeit. Ohne Hooks, damit der Unit-Test die Ausgabe direkt lesen kann.
 */
export function RechtsstandHinweis({ heute, stand }: { heute?: string; stand?: RechtsstandQuelle | null } = {}) {
  const w = rechtsstandWarnung(stand === undefined ? (appDaten().kataloge['aiact_stand'] as RechtsstandQuelle | undefined) : stand, heute ?? heuteOrtszeit());
  if (!w) return null;
  const liste = w.zuPruefen.map((id) => inhalt(`stand.hinweise.${id}.titel`) ?? id).join('; ');
  return (
    <div class="speicher-warnung rechtsstand-warnung" id="rechtsstand-warnung" role="status">
      <p>
        <strong>{t('rechtsstand_hinweis.titel')}</strong>
        {w.alt && ` ${w.geprueft ? t('rechtsstand_hinweis.alt', { datum: datumText(w.geprueft) }) : t('rechtsstand_hinweis.alt_ohne_datum')}`}
        {w.zuPruefen.length > 0 && ` ${t('rechtsstand_hinweis.zu_pruefen', { liste })}`}
        {` ${t('rechtsstand_hinweis.tun')}`}
      </p>
    </div>
  );
}

/**
 * Hinweise zum Speichern, die bis zur Kenntnisnahme stehen bleiben: Datei aus neuerer Version nur lesend (AF-005), Sicherung
 * vor der Migration (AF-004), Browserspeicher unverschlüsselt und befristet (AF-032).
 */
export function SpeicherStandHinweise() {
  const lesend = nurLesen.value;
  const sicherung = projekt.value ? migrationsSicherung.value : null;
  return (
    <>
      {lesend && projekt.value && (
        <Hinweis art="warnung" klasse="speicher-warnung" id="hinweis-nur-lesen" role="status">
          <p><strong>{t('laden.nur_lesen_titel')}</strong> {t('laden.nur_lesen_text', { version: lesend.version, bekannt: lesend.bekannt })}</p>
        </Hinweis>
      )}
      {sicherung && (
        <Hinweis art="warnung" klasse="speicher-warnung" id="hinweis-sicherung" role="status">
          <p><strong>{t('laden.migriert_titel')}</strong> {t('laden.migriert_text', { von: sicherung.von, nach: sicherung.nach, name: sicherung.name })}</p>
          <p class="leiste">
            <button type="button" class="klein" id="sicherung-ablegen" onClick={() => void sicherungAblegen()}>{t('laden.sicherung_ablegen')}</button>
            <button type="button" class="klein" id="sicherung-verwerfen" onClick={() => (migrationsSicherung.value = null)}>{t('laden.sicherung_verwerfen')}</button>
          </p>
        </Hinweis>
      )}
      {/* V-19 (A-13): einzeilige Hinweisleiste der Art Warnung unter dem Seitenkopf, role region mit Namen; der ausführliche
          Text steht in den Einstellungen (Zwischenspeicher). «Verstanden» merkt die Kenntnisnahme je Browserprofil. */}
      {speicherHinweis.value && (
        <Hinweis art="warnung" klasse="hinweis-leiste speicher-warnung kein-druck" id="hinweis-browserspeicher" role="region" aria-labelledby="hinweis-browserspeicher-text">
          <p id="hinweis-browserspeicher-text" aria-live="polite">{t('speicher_hinweis.titel')} <span class="zweitext">{t('speicher_hinweis.kurz')}</span></p>
          <span class="leiste">
            <a id="speicher-hinweis-einstellungen" href={routeZuHash({ art: 'einstellungen', bereich: 'speicher' })} onClick={speicherHinweisBestaetigen}>{t('speicher_hinweis.einstellungen')}</a>
            <button type="button" class="klein" id="speicher-hinweis-ok" onClick={speicherHinweisBestaetigen}>{t('speicher_hinweis.ok')}</button>
          </span>
        </Hinweis>
      )}
    </>
  );
}

/** Warnungen zur Sicherheit der Daten: Zwischenspeicher schreibt nicht, zweiter Tab mit demselben Projekt; dazu der Hinweis auf alten Rechtsstand */
export function SpeicherWarnungen() {
  const fehlerText = speicherStatus.value?.fehler ?? null;
  // Nur im Arbeitsspeicher: Schliessen oder Absturz verliert alles seit dem letzten Speichern
  const zwischenFehler = (!!fehlerText && fehlerText.startsWith('Zwischenspeicher')) || (!!projekt.value && zwischenspeicherArt.value === 'speicher');
  const tabs = projekt.value ? andereTabs.value : 0;
  return (
    <>
      <RechtsstandHinweis />
      <SpeicherStandHinweise />
      {(zwischenFehler || tabs > 0) && (
        <div class="speicher-warnung" id="speicher-warnung" role="alert">
          {zwischenFehler && <p id="warnung-zwischenspeicher"><strong>{t('warnung.zwischenspeicher_titel')}</strong> {t('warnung.zwischenspeicher_text')}</p>}
          {tabs > 0 && <p id="warnung-tabs"><strong>{t('warnung.tabs_titel')}</strong> {t('warnung.tabs_text')}</p>}
        </div>
      )}
    </>
  );
}

function ProjektKachel() {
  const p = projekt.value!;
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);
  const knopfRef = useRef<HTMLButtonElement>(null);
  const name = p.organisation.name || t('kopf.ohne_name');
  const zustand = ungespeichert.value && !beispielUnveraendert.value ? 'ungespeichert' : 'gespeichert';
  const statusText = ungespeichert.value ? (beispielUnveraendert.value ? t('kopf.beispiel_unveraendert') : t('kopf.ungespeichert')) : t('kopf.gespeichert');
  useEffect(() => {
    if (!offen) return;
    const weg = (e: MouseEvent) => huelle.current && !huelle.current.contains(e.target as Node) && setOffen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOffen(false);
        knopfRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', weg);
      document.removeEventListener('keydown', esc);
    };
  }, [offen]);
  return (
    <div class="projekt-kachel" ref={huelle}>
      <button type="button" ref={knopfRef} class={`avatar ${zustand}`} id="projekt-kachel" aria-expanded={offen} aria-controls="projekt-menue"
        aria-label={tr('projekt.kachel', { kuerzel: kuerzel(name), name, stand: statusText })} data-tipp={`${name} · ${statusText}`} onClick={() => setOffen(!offen)}>
        {kuerzel(name)}
      </button>
      {offen && (
        <div class="projekt-menue" id="projekt-menue" role="group" aria-labelledby="projekt-name">
          <ProjektAktionen schliessen={(fokus = true) => { setOffen(false); if (fokus) knopfRef.current?.focus(); }} />
        </div>
      )}
    </div>
  );
}

/** Blatt «Mehr» der unteren Leiste (Telefon): übrige Bereiche und Projekt */
function MehrBlatt({ aktiv }: { aktiv: BereichId }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = projekt.value;
  const offen = mehrOffen.value;
  const schliessen = (fokus = true) => {
    mehrOffen.value = false;
    if (fokus) requestAnimationFrame(() => document.getElementById('mehr-knopf')?.focus());
  };
  useBlatt(offen, ref, () => schliessen());
  if (!offen) return null;
  const { mehr } = leistenBereiche(!!p);
  return (
    <div class="blatt mehr-blatt" id="mehr-blatt" ref={ref} role="dialog" aria-modal="true" aria-labelledby="mehr-titel">
      <div class="blatt-kopf">
        <h2 id="mehr-titel">{tr('navi.mehr')}</h2>
        <button type="button" class="einklappen" aria-label={tr('navi.mehr_schliessen')} onClick={() => schliessen()}><Symbol name="schliessen" /></button>
      </div>
      <nav aria-label={tr('navi.weitere_bereiche')}>
        <ul class="mehr-liste">
          {mehr.map((b) => {
            const titel = bereichTitel(b.id);
            const zusatz = zusatzVon(b.id);
            return (
              <li key={b.id}>
                <a class="upunkt" href={zielVon(b)} data-bereich={b.id} aria-current={aktiv === b.id ? 'true' : undefined}
                  onClick={(e) => { if ((e.currentTarget as HTMLAnchorElement).hash === globalThis.location.hash) schliessen(false); }}>
                  <Symbol name={b.icon} />
                  <span class="upunkt-text">{titel}{zusatz && <span class="nur-sr">, {zusatz}</span>}</span>
                  {b.id === 'pruefung' && fehlerStand.value.jetzt.length > 0 && <span class="zahl warn" aria-hidden="true">{fehlerStand.value.jetzt.length}</span>}
                  {b.id === 'hinweise' && faelligListe.value.length > 0 && <span class="zahl warn" aria-hidden="true">{faelligListe.value.length}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {p && (
        <section class="mehr-projekt" aria-labelledby="mehr-projekt-titel">
          <h3 id="mehr-projekt-titel">{tr('projekt.menue')}</h3>
          <div class="projekt-menue-inhalt">
            <ProjektAktionen schliessen={(fokus = true) => schliessen(fokus)} idZusatz="-mehr" />
          </div>
        </section>
      )}
    </div>
  );
}

function Untermenue({ bereich, gruppen }: { bereich: BereichId; gruppen: RahmenGruppe[] }) {
  const titel = bereichTitel(bereich);
  const ref = useRef<HTMLElement>(null);
  const alsBlatt = untermenueMobil.value && breite.value !== 'breit';
  const zurueck = () => requestAnimationFrame(() => document.getElementById('untermenue-knopf')?.focus());
  // Blatt (schmal): modal, Fokus im Untermenü, Escape schliesst und gibt den Fokus an den Menüknopf zurück
  useBlatt(alsBlatt, ref, () => { untermenueMobil.value = false; zurueck(); });
  return (
    <nav class={`untermenue${alsBlatt ? ' blatt' : ''}`} id="untermenue" ref={ref} aria-label={tr('navi.unterbereiche', { bereich: titel })}>
      <div class="ukopf">
        <p class="untermenue-kopf" id="untermenue-titel">{titel}</p>
        <button type="button" class="einklappen nur-breit" id="untermenue-zu" aria-expanded="true" aria-controls="untermenue" aria-label={tr('navi.einklappen')} data-tipp={tr('navi.einklappen')}
          onClick={() => { setzeUntermenueZu(true); zurueck(); }}>
          <Symbol name="einklappen" />
        </button>
        <button type="button" class="einklappen nur-schmal" aria-label={tr('navi.schliessen')} onClick={() => { untermenueMobil.value = false; zurueck(); }}>
          <Symbol name="schliessen" />
        </button>
      </div>
      {gruppen.map((g, gi) => (
        <div class="ugruppe" key={`${bereich}-${gi}`}>
          {g.name && <p class="ugruppe-titel" id={`ugruppe-${bereich}-${gi}`}>{g.name}</p>}
          <ul aria-labelledby={g.name ? `ugruppe-${bereich}-${gi}` : undefined}>
            {g.punkte.map((x) => (
              <li key={x.id || x.href}>
                <a class="upunkt" href={x.href} aria-current={x.aktiv ? 'page' : undefined} data-punkt={x.id} onClick={() => { offenNachWechsel = false; untermenueMobil.value = false; }}>
                  {x.schritt ? <span class={`schritt ${x.schritt}`} aria-hidden="true" /> : <Symbol name={x.icon} />}
                  <span class="upunkt-text">{weichTrennen(x.titel)}{x.schritt && <span class="nur-sr">, {tr(`guide.stand.${x.schritt}`)}</span>}</span>
                  {x.zahl !== undefined && <span class={`zahl${x.warn ? ' warn' : ''}`}><span class="nur-sr">, </span>{x.zahl}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p class="namensnennung" id="namensnennung">{t('kopf.namensnennung').split(/(kmu-cio\.ch)/).map((x, i) => (i % 2 ? <span class="ohne-umbruch" key={i}>{x}</span> : x))}</p>
    </nav>
  );
}

/** «g» dann Buchstabe: Sprung in einen Bereich (nicht in Eingabefeldern) */
function useBereichTasten() {
  useEffect(() => {
    let wartet = 0;
    const taste = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName) || ziel.getAttribute('role') === 'combobox')) return;
      if (wartet && Date.now() - wartet < 1500) {
        wartet = 0;
        const b = BEREICHE.find((x) => x.taste === e.key.toLowerCase() && (!x.mitProjekt || projekt.value));
        if (b) {
          e.preventDefault();
          globalThis.location.hash = zielVon(b);
        }
        return;
      }
      wartet = e.key === 'g' && !e.shiftKey ? Date.now() : 0;
    };
    globalThis.addEventListener('keydown', taste);
    return () => globalThis.removeEventListener('keydown', taste);
  }, []);
}

export function Rahmen({ r, children }: { r: Route; children: ComponentChildren }) {
  const p = projekt.value;
  const bereich = bereichVon(r);
  const fehler = fehlerStand.value.jetzt.length;
  const gruppen = untermenue(bereich, {
    p, r, stichtag: p ? stichtag.value : '', faellig: faelligListe.value.length, fehler, hinweise: befunde.value.length - befunde.value.filter((b) => b.schwere === 'fehler').length + fehlerStand.value.spaeter.length,
  });
  const ort = `${bereichTitel(bereich)} › ${ortTitel(bereich, gruppen)}`;
  useBereichTasten();
  void route.value;
  ortText.value = ort;
  ausdruckTitel.value = ortTitel(bereich, gruppen) || bereichTitel(bereich);
  // Registerkarte und Bildschirmleser: zuerst die Seite, dann Firma und Werkzeug (D-08, WCAG 2.4.2)
  useEffect(() => {
    const firma = p?.organisation.name;
    // V-22: während des Drucks der Titel des Ausdrucks ohne «AIMS-Manager» (Druckrahmen.tsx)
    document.title = druckTitel.value ?? `${ungespeichert.value && p ? '• ' : ''}${[ortTitel(bereich, gruppen) || bereichTitel(bereich), firma, 'AIMS-Manager'].filter(Boolean).join(' · ')}`;
  });
  const blatt = (untermenueMobil.value && breite.value !== 'breit') || mehrOffen.value;
  return (
    <div class={`app${untermenueZu.value ? ' zu' : ''}${untermenueMobil.value ? ' mobil-offen' : ''}${blatt ? ' blatt-offen' : ''}`} data-bereich={bereich}>
      <a class="sprung" href="#hauptinhalt" onClick={(e) => { e.preventDefault(); document.getElementById('hauptinhalt')?.focus(); }}>{t('navi.sprung')}</a>
      <Symbolleiste aktiv={bereich} />
      <Untermenue bereich={bereich} gruppen={gruppen} />
      {untermenueMobil.value && breite.value !== 'breit' && <div class="abdecken" aria-hidden="true" onClick={() => (untermenueMobil.value = false)} />}
      {mehrOffen.value && <div class="abdecken abdecken-mehr" aria-hidden="true" onClick={() => (mehrOffen.value = false)} />}
      <MehrBlatt aktiv={bereich} />
      <div class="rahmen-spalte">
        {children}
      </div>
    </div>
  );
}

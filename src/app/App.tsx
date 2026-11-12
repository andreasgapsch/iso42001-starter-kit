// App: Rahmen (src/app/rahmen: Symbolleiste, Untermenü, Kopf mit Suche und Speichern) und die Ansicht der Route.
import { Component, type ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { rollbereicheBeobachten } from './ui/rollbereiche.ts';
import { t } from './i18n.ts';
import { REITER, type Modul, type Route } from './logik/routen.ts';
import { Einstellungen, Ueber } from './ansichten/einstellungen/Einstellungen.tsx';
import { GestaltungSeite } from './ansichten/einstellungen/Gestaltung.tsx';
import { Formular } from './ansichten/formular/Formular.tsx';
import { Gefuehrt } from './ansichten/gefuehrt/Gefuehrt.tsx';
import { Pruefung, Stage1Seite } from './ansichten/pruefung/Pruefung.tsx';
import { oeffnenAblauf, Start } from './ansichten/start/Start.tsx';
import { Dokumente } from './ansichten/dokumente/Dokumente.tsx';
import { Prozesse } from './ansichten/prozesse/Prozesse.tsx';
import { Uebersicht } from './ansichten/uebersicht/Uebersicht.tsx';
import { Wissen } from './ansichten/wissen/Wissen.tsx';
import { Hilfe, Hinweise } from './ansichten/hilfe/Hilfe.tsx';
import { FehlerDialog, meldeFehler } from './Fehler.tsx';
import { Bestaetigen } from './ui/Bestaetigen.tsx';
import { BibliothekAnsicht, BibliothekPlatzhalter } from './rahmen/bibliothek-anbindung.tsx';
import { OrtText, Rahmen, SpeicherWarnungen } from './rahmen/Rahmen.tsx';
import { SprungLeiste } from './rahmen/SprungLeiste.tsx';
import { speichern } from './rahmen/speichern.ts';
import { meldung, navigiere, projekt, route } from './zustand/store.ts';
import { DruckRahmen } from './rahmen/Druckrahmen.tsx';
import { seitenkoepfe } from './rahmen/Seitenkopf.tsx';

class Grenze extends Component<{ children: ComponentChildren; schluessel: string }, { kaputt: boolean }> {
  override state = { kaputt: false };
  override componentDidCatch(e: unknown) {
    meldeFehler(e);
    this.setState({ kaputt: true });
  }
  override componentDidUpdate(vorher: { schluessel: string }) {
    if (vorher.schluessel !== this.props.schluessel && this.state.kaputt) this.setState({ kaputt: false });
  }
  render() {
    return this.state.kaputt ? <div class="inhalt"><p class="ersatz">{t('fehler.ansicht')}</p></div> : this.props.children;
  }
}

/** Bedienelemente, die eine Meldung nicht verdecken darf */
const BEDIENBAR = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=combobox], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option]';
/**
 * A-14 (V-11): Die Meldung verdeckt keine Bedienelemente. Sie bleibt rechts unten, solange dort nichts
 * Bedienbares liegt; sonst rückt sie in Schritten von 16 px nach oben, dann auf die linke Seite des Inhalts. Liegt überall etwas,
 * nimmt sie die Stelle mit den wenigsten verdeckten Elementen. Neu gewählt bei jeder Meldung, bei Änderungen im Inhalt (ein
 * Formular öffnet sich unter der Meldung), beim Rollen und bei neuer Fenstergrösse.
 */
function lageWaehlen(el: HTMLElement): void {
  const main = document.getElementById('hauptinhalt');
  el.style.setProperty('--meldung-links', `${Math.max(0, Math.round(main?.getBoundingClientRect().left ?? 0))}px`);
  el.style.removeProperty('--meldung-unten');
  delete el.dataset['lage'];
  const hoehe = globalThis.innerHeight;
  const ziele = [...document.querySelectorAll<HTMLElement>(BEDIENBAR)].filter((e) => !el.contains(e)).map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < hoehe);
  const start = parseFloat(getComputedStyle(el).bottom) || 20;
  let beste: { lage: string; unten: number; n: number } = { lage: '', unten: start, n: Number.POSITIVE_INFINITY };
  for (const lage of ['', 'links']) {
    if (lage) el.dataset['lage'] = lage;
    for (let unten = start; unten + el.offsetHeight <= hoehe - 72; unten += 16) {
      el.style.setProperty('--meldung-unten', `${unten}px`);
      const m = el.getBoundingClientRect();
      const n = ziele.filter((z) => m.left < z.right && z.left < m.right && m.top < z.bottom && z.top < m.bottom).length;
      if (n === 0) return;
      if (n < beste.n) beste = { lage, unten, n };
    }
  }
  if (beste.lage) el.dataset['lage'] = beste.lage;
  else delete el.dataset['lage'];
  el.style.setProperty('--meldung-unten', `${beste.unten}px`);
}

function Meldung() {
  const m = meldung.value;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!m || !el) return;
    let geplant = 0;
    const neu = () => {
      if (geplant) return;
      geplant = requestAnimationFrame(() => {
        geplant = 0;
        lageWaehlen(el);
      });
    };
    lageWaehlen(el);
    // Änderungen an der Meldung selbst (Lage, Text) lösen keine neue Wahl aus
    const beobachter = new MutationObserver((liste) => {
      if (liste.some((x) => !el.contains(x.target))) neu();
    });
    beobachter.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'style', 'aria-expanded'] });
    globalThis.addEventListener('resize', neu);
    globalThis.addEventListener('scroll', neu, true);
    return () => {
      cancelAnimationFrame(geplant);
      beobachter.disconnect();
      globalThis.removeEventListener('resize', neu);
      globalThis.removeEventListener('scroll', neu, true);
    };
  }, [m]);
  return <div ref={ref} aria-live="polite" class={m ? `meldung ${m.art}` : 'nur-sr'} role="status" id="meldung">{m?.text ?? ''}</div>;
}

function Ansicht({ r }: { r: Route }) {
  const p = projekt.value;
  // Ohne Projekt: Einstellungen, Über, Wissen und Hilfe; alles Übrige führt zum Start
  if (r.art === 'einstellungen') return r.bereich === 'gestaltung' ? <GestaltungSeite p={p} /> : <Einstellungen bereich={r.bereich} />;
  if (r.art === 'ueber') return <Ueber />;
  if (r.art === 'wissen') return <Wissen unter={r.unter} id={r.id} />;
  if (r.art === 'hilfe') return <Hilfe unter={r.unter} />;
  if (r.art === 'start' || !p) return <Start unter={r.art === 'start' ? r.unter : undefined} />;
  if (r.art === 'gefuehrt') return <Gefuehrt p={p} etappe={r.etappe} seite={r.seite} eintrag={r.eintrag} von={r.von} feld={r.feld} />;
  if (r.art === 'formular') return <Formular p={p} modul={r.modul} id={r.id} filter={r.filter} />;
  if (r.art === 'uebersicht') return <Uebersicht p={p} unter={r.unter} />;
  if (r.art === 'pruefung') return r.unter === 'stage1' ? <Stage1Seite /> : <Pruefung />;
  if (r.art === 'dokumente') return <Dokumente p={p} />;
  if (r.art === 'prozesse') return <Prozesse p={p} id={r.id} filter={r.filter} />;
  if (r.art === 'bibliothek') return BibliothekAnsicht ? <BibliothekAnsicht unterbereich={r.unter} /> : <BibliothekPlatzhalter />;
  if (r.art === 'hinweise') return <Hinweise p={p} />;
  return <Start />;
}

/** Seite im Sinn des Scrollens: Modul und Reiter, Etappe und Seite; die Wahl eines Eintrags wechselt die Seite nicht. */
function seitenSchluessel(r: Route): string {
  if (r.art === 'gefuehrt') return `gefuehrt/${r.etappe ?? ''}/${r.seite ?? ''}`;
  if (r.art === 'formular') return `formular/${r.modul}/${REITER[r.modul as Modul]?.includes(r.id ?? '') ? r.id : ''}`;
  if (r.art === 'einstellungen' && r.bereich) return `einstellungen/${r.bereich}`;
  if (r.art === 'prozesse') return `prozesse/${r.id ?? ''}/${r.filter ? JSON.stringify(r.filter) : ''}`;
  if (r.art === 'wissen') return `wissen/${r.unter ?? ''}/${(r.id ?? '').split('/')[0]}`;
  if (r.art === 'start' || r.art === 'uebersicht' || r.art === 'pruefung' || r.art === 'hilfe' || r.art === 'bibliothek') return `${r.art}/${r.unter ?? ''}`;
  return r.art;
}

/** Ohne Projekt zeigt jede Projektansicht den Start: Rahmen und Titel folgen dem, was wirklich zu sehen ist (C-27) */
const OHNE_PROJEKT = new Set<Route['art']>(['start', 'einstellungen', 'ueber', 'wissen', 'hilfe']);

export function App() {
  const r: Route = !projekt.value && !OHNE_PROJEKT.has(route.value.art) ? { art: 'start' } : route.value;
  const seite = seitenSchluessel(r);
  const vorige = useRef(seite);
  // Neue Seite (auch «Weiter» im Guide): an den Seitenanfang, damit Titel, Etappenleiste und Reiter nicht
  // unter dem klebenden Kopf liegen. Der Fokus liegt bereits auf dem Seitentitel (Effekt der Ansicht).
  useEffect(() => {
    if (vorige.current === seite) return;
    vorige.current = seite;
    globalThis.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
  }, [seite]);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP') && projekt.value) {
        e.preventDefault();
        navigiere({ art: 'pruefung' });
      } else if (e.altKey && e.shiftKey && e.key === 'ArrowLeft' && route.value.art === 'gefuehrt') {
        // Alt + Shift + ← (U-21): Alt + ← allein ist in Chrome, Edge und Firefox «Zurück» des Browsers
        e.preventDefault();
        document.querySelector<HTMLAnchorElement>('.knoepfe a.knopf')?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && projekt.value) {
        e.preventDefault();
        void speichern(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        navigiere({ art: 'start' });
        void oeffnenAblauf();
      }
    };
    globalThis.addEventListener('keydown', taste);
    return () => globalThis.removeEventListener('keydown', taste);
  }, []);
  // Tabellen und Abläufe, die breiter als ihr Platz sind: eigener, fokussierbarer Scrollbereich (U-14, U-19)
  useEffect(() => {
    const m = document.getElementById('hauptinhalt');
    return m ? rollbereicheBeobachten(m) : undefined;
  }, []);
  const breit = r.art === 'gefuehrt';
  return (
    <>
      <Rahmen r={r}>
        <main id="hauptinhalt" tabIndex={-1} class={`inhalt${breit ? ' breit' : ''}`}>
          <OrtText />
          {/* V-19 (A-13): sonst unter dem Seitenkopf (Seitenkopf.tsx) */}
          {seitenkoepfe.value === 0 && <SpeicherWarnungen />}
          <SprungLeiste />
          <Grenze schluessel={JSON.stringify(r)}>
            <DruckRahmen><Ansicht r={r} /></DruckRahmen>
          </Grenze>
        </main>
      </Rahmen>
      <Meldung />
      <FehlerDialog />
      <Bestaetigen />
    </>
  );
}

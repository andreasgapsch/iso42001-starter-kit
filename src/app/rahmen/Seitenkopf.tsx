// Seitenkopf jeder Ansicht (Nutzertest rc.10, U-34; Mockup docs/design-system/nachtblau/mockup-shell.html): H1, globale
// Suche («/») und genau eine Hauptaktion in einer Zeile. Ersetzt den projektweiten Kopfbalken bis rc.11. Projektname,
// Speichern unter und Öffnen liegen in der Projekt-Kachel der Symbolleiste; hier bleibt eine dezente Anzeige des
// Speicherstands (Klick speichert, Ctrl/Cmd+S ebenso) und, bei Beispielen, der Stichtag. Links vor dem Titel der Knopf für
// das Untermenü, wenn es eingeklappt ist oder als Blatt geöffnet wird (unter 900 px). Druck: nur der Titel.
import type { ComponentChildren, Ref } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { datumText, t } from '../i18n.ts';
import { beispielUnveraendert, nurLesen, projekt, route, speicherStatus, stichtag, stichtagAbweichend, ungespeichert } from '../zustand/store.ts';
import { bereichTitel, bereichVon } from './bereiche.ts';
import { breite, kopfKompakt, schmal, setzeUntermenueZu, untermenueMobil, untermenueZu } from './zustand.ts';
import { speichern, speichertGerade } from './speichern.ts';
import { Suche } from './Suche.tsx';
import { Symbol } from './symbole.tsx';
import { tr, uhrzeitText } from './text.ts';
import { zweiterKlick } from '../ui/beschaeftigt.ts';
import { StatusPille } from '../ui/StatusPille.tsx';
import { SpeicherWarnungen } from './Rahmen.tsx';

/**
 * Zahl der gezeichneten Seitenköpfe (V-19, A-13): Hinweise und Warnungen zum Speichern stehen unter dem Kopf, damit er bei
 * y 0 bleibt. Ansichten ohne Seitenkopf (Druckansicht eines Dokuments) zeigen sie wie bisher oben im Inhalt (App.tsx).
 */
export const seitenkoepfe = signal(0);

/** Knopf für das Untermenü (Desktop: nur eingeklappt sichtbar; schmal: öffnet das Untermenü als Blatt) */
function UntermenueKnopf() {
  const s = breite.value !== 'breit';
  return (
    <button type="button" class="kopf-menue" id="untermenue-knopf" aria-controls="untermenue"
      aria-expanded={s ? untermenueMobil.value : !untermenueZu.value}
      aria-label={tr('navi.untermenue_zeigen')} data-tipp={tr('navi.untermenue_zeigen')}
      onClick={() => {
        if (schmal()) untermenueMobil.value = !untermenueMobil.value;
        else {
          const aufklappen = untermenueZu.value;
          setzeUntermenueZu(!aufklappen);
          // Der Knopf verschwindet beim Ausklappen: Fokus auf «Untermenü einklappen» statt auf body (U-18)
          if (aufklappen) requestAnimationFrame(() => document.getElementById('untermenue-zu')?.focus());
        }
      }}>
      <Symbol name={untermenueZu.value && !s ? 'ausklappen' : 'menue'} />
    </button>
  );
}

/**
 * Stichtag der Beispiele (V-20, A-15): Pille als Knopf, das Wort «Stichtag» bei jeder Breite sichtbar. Klick, Enter oder Fokus
 * öffnen die Erklärung als Popover, ein weiterer Klick schliesst es (nicht als title, den weder Tastatur noch Touch erreichen; WCAG 1.4.13, 2.1.1), Esc, Klick
 * daneben oder Fokus anderswo schliessen es.
 */
function StichtagKnopf() {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLSpanElement>(null);
  // Fokus durch die Maus öffnet nicht schon vor dem Klick (sonst schlösse der Klick gleich wieder)
  const maus = useRef(false);
  useEffect(() => {
    if (!offen) return;
    const weg = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener('mousedown', weg);
    return () => document.removeEventListener('mousedown', weg);
  }, [offen]);
  return (
    <span class="stichtag-huelle" ref={huelle}>
      <StatusPille als="button" art="info" klasse="stichtag" id="kopf-stichtag" aria-expanded={offen} aria-controls="kopf-stichtag-erklaerung" aria-describedby="kopf-stichtag-erklaerung"
        onMouseDown={() => (maus.current = true)}
        onFocus={() => {
          if (!maus.current) setOffen(true);
          maus.current = false;
        }}
        onBlur={(e) => {
          if (!huelle.current?.contains(e.relatedTarget as Node | null)) setOffen(false);
        }}
        onClick={(e) => {
          // A-23: Enter und Leertaste (detail 0) öffnen immer; ein Mausklick schaltet um
          const tastatur = e.detail === 0;
          maus.current = false;
          setOffen(tastatur ? true : !offen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && offen) {
            e.preventDefault();
            e.stopPropagation();
            setOffen(false);
          }
        }}>
        <span class="stichtag-wort">{tr('kopf.stichtag')}</span> {datumText(stichtag.value)}
      </StatusPille>
      <span class="stichtag-pop" id="kopf-stichtag-erklaerung" role="note" hidden={!offen}>{tr('kopf.stichtag_tipp')}</span>
    </span>
  );
}

/**
 * Zeit zum Speicherstand (AF-017): gespeichert um HH:MM, bei ungespeicherten Änderungen der letzte Zwischenstand; leer, solange
 * beides fehlt. Gilt für alle Routen, weil jeder Seitenkopf diese Anzeige zeigt.
 */
export function speicherZeit(): string {
  const s = speicherStatus.value;
  if (!s || nurLesen.value) return '';
  if (ungespeichert.value) {
    const z = uhrzeitText(s.letzterZwischenstand);
    return z ? t('kopf.zeit_zwischenstand', { zeit: z }) : '';
  }
  const z = uhrzeitText(s.gespeichertAm);
  return z ? t('kopf.zeit_gespeichert', { zeit: z }) : '';
}

/** Dezente Anzeige des Speicherstands; Klick speichert (wie Ctrl/Cmd+S und «Speichern» im Projektmenü) */
export function Speicherstand({ hervorheben = false, mitStichtag = true }: { hervorheben?: boolean; mitStichtag?: boolean }) {
  const p = projekt.value;
  if (!p) return null;
  const lesend = nurLesen.value !== null;
  const zustand = ungespeichert.value && !beispielUnveraendert.value ? 'ungespeichert' : 'gespeichert';
  const grund = lesend ? t('kopf.nur_lesen') : ungespeichert.value ? (beispielUnveraendert.value ? t('kopf.beispiel_unveraendert') : t('kopf.ungespeichert')) : t('kopf.gespeichert');
  const zeit = speicherZeit();
  const text = grund;
  return (
    <span class="speicherstand-huelle kein-druck">
      {mitStichtag && stichtagAbweichend.value && <StichtagKnopf />}
      <button type="button" id="speichern" class={`speicherstand ${zustand}${hervorheben && zustand === 'ungespeichert' && !lesend ? ' primaer' : ''}`} onClick={(ev) => !zweiterKlick(ev) && void speichern()}
        aria-busy={speichertGerade.value ? 'true' : undefined} aria-label={`${t('kopf.speichern')}. ${text}${zeit ? `. ${zeit}` : ''}`} title={tr('kopf.speichern_tipp')}>
        <span class="speicherstand-zeichen" aria-hidden="true" />
        <span id="speicherstatus">{text}</span>
        {zeit && <span id="speicherzeit" class="speicherzeit"> · {zeit}</span>}
      </button>
      <span class="nur-sr" role="status">{text}{zeit ? `. ${zeit}` : ''}</span>
    </span>
  );
}

export function Seitenkopf(props: {
  titel: ComponentChildren;
  titelRef?: Ref<HTMLHeadingElement>;
  titelId?: string;
  /** H1 nur für Bildschirmleser (z. B. Druckansicht der Dokumente) */
  titelVerborgen?: boolean;
  /** genau eine Hauptaktion (Knopf oder Link, in der Regel class="primaer") */
  aktion?: ComponentChildren;
  /** Speichern ist die Hauptaktion (Einstellungen): der Speicherstand ist nur bei ungespeicherten Änderungen Primärknopf, sonst sekundär mit «Gespeichert» (B3) */
  speichernAlsAktion?: boolean;
  /** Text unter dem Kopf (Einleitung, Projektzeile), ausserhalb von .seitenkopf (A-01) */
  unter?: ComponentChildren;
  /** Zeile über dem Titel (V-10): Bereich und Stelle, z. B. «Guide · Etappe 8 von 13»; Standard: Bereich */
  kontext?: ComponentChildren;
  klasse?: string;
}) {
  // A-01: Der Kopf bleibt einzeilig (64 px); Einleitung und Projektzeile stehen unter dem Kopf
  // V-20 (A-15): zwischen 900 und 1279 px steht der Stichtag in der Zeile über dem Titel
  const kompakt = kopfKompakt.value;
  // V-19 (A-13): Hinweise zum Speichern direkt unter dem Kopf; jede Ansicht hat höchstens einen Seitenkopf
  useLayoutEffect(() => {
    seitenkoepfe.value = seitenkoepfe.peek() + 1;
    return () => {
      seitenkoepfe.value = Math.max(0, seitenkoepfe.peek() - 1);
    };
  }, []);
  return (
    <>
    <div class={`seitenkopf${props.klasse ? ` ${props.klasse}` : ''}`}>
      <div class="sk-zeile">
        <div class="sk-titel">
          <UntermenueKnopf />
          <div class="sk-titel-text">
            {!props.titelVerborgen && <p class="sk-kontext kein-druck" id="sk-kontext">{props.kontext ?? bereichTitel(bereichVon(route.value))}{kompakt && projekt.value && stichtagAbweichend.value && <> · <StichtagKnopf /></>}</p>}
            <h1 tabIndex={-1} ref={props.titelRef} id={props.titelId} class={props.titelVerborgen ? 'nur-sr' : undefined}>{props.titel}</h1>
          </div>
        </div>
        <Speicherstand hervorheben={props.speichernAlsAktion} mitStichtag={!kompakt} />
        {/* Zeilenumbruch nur in schmalen Spalten und auf dem Telefon: Titel und Speicherstand oben, Suche und Aktion darunter */}
        <span class="sk-umbruch" aria-hidden="true" />
        <Suche />
        {props.aktion && <span class="sk-aktion kein-druck">{props.aktion}</span>}
      </div>
    </div>
    <SpeicherWarnungen />
    {props.unter && <div class="seitenkopf-unter">{props.unter}</div>}
    </>
  );
}

// Eigene Auswahl statt <select> (Nutzertest rc.10, U-22): WebKit meldet für jedes <select> im Dokument eine Verletzung von
// style-src-attr, auch ohne Skript und ohne Stil der Seite (Beleg: tests/e2e/app/webkit-csp.e2e.ts). Die Komponente folgt dem
// Muster «select-only combobox» der ARIA Authoring Practices: ein Knopf mit role=combobox (beschriftbar über <label for>),
// eine Liste mit role=listbox, Fokus bleibt auf dem Knopf (aria-activedescendant).
// Tastatur: ↓ ↑ öffnen und wählen, Alt+↓ öffnet, Pos1/Ende, Bild↑/Bild↓, Tippsuche, Enter und Leertaste übernehmen,
// Escape schliesst ohne Änderung, Tab übernimmt und geht weiter. Auf schmalen Bildschirmen öffnet die Liste als Blatt am
// unteren Rand mit grossen Zeilen. Aufruf wie <select>: Kinder <option value> und <optgroup label>, onChange erhält ein
// Ereignis mit currentTarget.value.
import { Fragment, isValidElement, type ComponentChildren, type JSX, type VNode } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface AuswahlEreignis {
  currentTarget: { value: string };
  target: { value: string };
}

interface Opt {
  wert: string;
  text: string;
  aus: boolean;
  gruppe?: number;
}

/** Text der Kinder einer <option> (Zeichenketten, Zahlen, verschachtelte Elemente) */
export function kinderText(k: ComponentChildren): string {
  if (k === null || k === undefined || typeof k === 'boolean') return '';
  if (typeof k === 'string' || typeof k === 'number' || typeof k === 'bigint') return String(k);
  if (Array.isArray(k)) return k.map(kinderText).join('');
  if (isValidElement(k)) return kinderText((k.props as { children?: ComponentChildren }).children);
  return '';
}

/** <option> und <optgroup> aus den Kindern lesen (auch in Fragmenten und Listen) */
export function optionenLesen(kinder: ComponentChildren): { optionen: Opt[]; gruppen: string[] } {
  const optionen: Opt[] = [];
  const gruppen: string[] = [];
  const lauf = (k: ComponentChildren, gruppe?: number): void => {
    if (Array.isArray(k)) return k.forEach((x) => lauf(x, gruppe));
    if (!isValidElement(k)) return;
    const v = k as VNode<Record<string, unknown> & { children?: ComponentChildren }>;
    if (v.type === 'option') {
      const text = kinderText(v.props.children);
      optionen.push({ wert: String(v.props['value'] ?? text), text, aus: !!v.props['disabled'], ...(gruppe !== undefined ? { gruppe } : {}) });
    } else if (v.type === 'optgroup') {
      gruppen.push(String(v.props['label'] ?? ''));
      lauf(v.props.children, gruppen.length - 1);
    } else if (v.type === Fragment) lauf(v.props.children, gruppe);
  };
  lauf(kinder);
  return { optionen, gruppen };
}

/** Index der Option zur Tippsuche: Anfang des Texts, bei gleichem Buchstaben reihum ab der nächsten Option */
export function tippTreffer(optionen: { text: string; aus?: boolean }[], suche: string, ab: number): number {
  const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const s = norm(suche);
  if (!s) return -1;
  const gleich = [...s].every((c) => c === s[0]);
  const n = optionen.length;
  const start = gleich ? ab + 1 : ab;
  for (let i = 0; i < n; i++) {
    const j = (start + i + n) % n;
    const o = optionen[j]!;
    if (o.aus) continue;
    const t = norm(o.text).trim();
    if (gleich ? t.startsWith(s[0]!) : t.startsWith(s)) return j;
  }
  return gleich ? -1 : tippTreffer(optionen, s[0]!, ab);
}

const schmal = () => globalThis.matchMedia?.('(max-width: 639.98px)').matches ?? false;

type Rest = Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'onChange' | 'value' | 'children' | 'class' | 'style' | 'id'>;

export function Auswahl(props: Rest & {
  id?: string;
  value?: string | number;
  onChange?: (e: AuswahlEreignis) => void;
  children?: ComponentChildren;
  class?: string;
  style?: JSX.CSSProperties;
  disabled?: boolean;
}) {
  const { id: idVorgabe, value, onChange, children, class: klasse, style, disabled, ...rest } = props;
  const eigen = useId();
  const id = idVorgabe ?? `auswahl-${eigen.replace(/[^\w-]/g, '')}`;
  const listeId = `${id}-liste`;
  const { optionen, gruppen } = optionenLesen(children);
  const wert = value === undefined || value === null ? '' : String(value);
  const gewaehlt = Math.max(0, optionen.findIndex((o) => o.wert === wert));
  const [offen, setOffen] = useState(false);
  const [aktiv, setAktiv] = useState(gewaehlt);
  const [lage, setLage] = useState<JSX.CSSProperties>({});
  const [name, setName] = useState('');
  const knopf = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const tipp = useRef({ text: '', zeit: 0 });

  const uebernehmen = (i: number) => {
    const o = optionen[i];
    if (!o || o.aus) return;
    if (o.wert !== wert) onChange?.({ currentTarget: { value: o.wert }, target: { value: o.wert } });
  };
  const oeffnen = (i = gewaehlt) => {
    if (disabled) return;
    // Name der Liste wie der Name des Knopfs: aria-label oder Text des Labels ohne den gezeigten Wert
    const k = knopf.current;
    const l = k?.labels?.[0];
    setName((rest['aria-label'] as string | undefined) ?? (l ? (l.contains(k!) ? (l.textContent ?? '').replace(k!.textContent ?? '', '') : l.textContent ?? '').trim() : ''));
    setAktiv(i);
    setOffen(true);
  };
  const schliessen = (fokus = true) => {
    setOffen(false);
    if (fokus) knopf.current?.focus();
  };

  // Lage der Liste: unter dem Knopf, sonst darüber; fest positioniert, damit rollende Tabellen sie nicht abschneiden.
  // Unter 640 px liegt die Liste als Blatt am unteren Rand (CSS).
  useLayoutEffect(() => {
    if (!offen) return;
    const setzen = () => {
      const k = knopf.current?.getBoundingClientRect();
      if (!k || schmal()) return setLage({});
      const hoch = globalThis.innerHeight;
      const unten = hoch - k.bottom - 8;
      const oben = k.top - 8;
      const nachOben = unten < 220 && oben > unten;
      const max = Math.max(160, Math.min(360, nachOben ? oben : unten));
      const breite = Math.max(k.width, 200);
      const links = Math.max(8, Math.min(k.left, globalThis.innerWidth - breite - 8));
      setLage(nachOben ? { left: `${links}px`, bottom: `${hoch - k.top + 4}px`, minWidth: `${k.width}px`, maxHeight: `${max}px` }
        : { left: `${links}px`, top: `${k.bottom + 4}px`, minWidth: `${k.width}px`, maxHeight: `${max}px` });
    };
    setzen();
    const weg = (e: Event) => {
      if (liste.current?.contains(e.target as Node) || knopf.current?.contains(e.target as Node)) return;
      setOffen(false);
    };
    const rollen = (e: Event) => { if (!liste.current?.contains(e.target as Node)) setzen(); };
    document.addEventListener('pointerdown', weg, true);
    globalThis.addEventListener('scroll', rollen, true);
    globalThis.addEventListener('resize', setzen);
    return () => {
      document.removeEventListener('pointerdown', weg, true);
      globalThis.removeEventListener('scroll', rollen, true);
      globalThis.removeEventListener('resize', setzen);
    };
  }, [offen]);

  // Aktive Option sichtbar halten
  useEffect(() => {
    if (!offen) return;
    const el = liste.current?.querySelector<HTMLElement>(`#${CSS.escape(`${listeId}-${aktiv}`)}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [offen, aktiv]);

  // Nächste wählbare Option in einer Richtung (gesperrte überspringen)
  const naechste = (ab: number, schritt: number) => {
    let i = ab;
    for (let n = 0; n < optionen.length; n++) {
      i = Math.min(optionen.length - 1, Math.max(0, i + schritt));
      if (!optionen[i]?.aus) return i;
      if (i === 0 || i === optionen.length - 1) break;
    }
    return ab;
  };
  const erste = () => Math.max(0, optionen.findIndex((o) => !o.aus));
  const letzte = () => { for (let i = optionen.length - 1; i >= 0; i--) if (!optionen[i]!.aus) return i; return 0; };

  const taste = (e: KeyboardEvent) => {
    if (disabled) return;
    const k = e.key;
    const druckbar = k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    const tippt = !!tipp.current.text && Date.now() - tipp.current.zeit < 500;
    if (druckbar && (k !== ' ' || tippt)) {
      e.preventDefault();
      e.stopPropagation();
      const jetzt = Date.now();
      tipp.current = { text: jetzt - tipp.current.zeit < 500 ? tipp.current.text + k : k, zeit: jetzt };
      const i = tippTreffer(optionen, tipp.current.text, offen ? aktiv : gewaehlt);
      if (i >= 0) {
        if (!offen) oeffnen(i);
        else setAktiv(i);
      } else if (!offen) oeffnen();
      return;
    }
    if (!offen) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); oeffnen(); }
      else if (k === 'Home') { e.preventDefault(); oeffnen(erste()); }
      else if (k === 'End') { e.preventDefault(); oeffnen(letzte()); }
      return;
    }
    if (k === 'ArrowDown') { e.preventDefault(); setAktiv(naechste(aktiv, 1)); }
    else if (k === 'ArrowUp' && e.altKey) { e.preventDefault(); uebernehmen(aktiv); schliessen(); }
    else if (k === 'ArrowUp') { e.preventDefault(); setAktiv(naechste(aktiv, -1)); }
    else if (k === 'Home') { e.preventDefault(); setAktiv(erste()); }
    else if (k === 'End') { e.preventDefault(); setAktiv(letzte()); }
    else if (k === 'PageDown') { e.preventDefault(); setAktiv(naechste(Math.min(optionen.length - 1, aktiv + 9), 1)); }
    else if (k === 'PageUp') { e.preventDefault(); setAktiv(naechste(Math.max(0, aktiv - 9), -1)); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); uebernehmen(aktiv); schliessen(); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); schliessen(); }
    else if (k === 'Tab') { uebernehmen(aktiv); schliessen(false); }
  };

  const text = optionen[gewaehlt]?.text ?? '';
  const zeile = (o: Opt, i: number) => (
    <div key={`${i}-${o.wert}`} id={`${listeId}-${i}`} role="option" class={`auswahl-option${i === aktiv ? ' aktiv' : ''}`}
      aria-selected={i === gewaehlt} aria-disabled={o.aus || undefined} data-wert={o.wert}
      onPointerDown={(e) => e.preventDefault()}
      onPointerEnter={() => setAktiv(i)}
      onClick={(e) => { e.preventDefault(); if (o.aus) return; uebernehmen(i); schliessen(); }}>
      {o.text}
    </div>
  );
  return (
    <span class={`auswahl-huelle${klasse ? ` ${klasse}` : ''}`} style={style}>
      <button {...rest} ref={knopf} type="button" id={id} class="auswahl" role="combobox" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={offen} aria-controls={listeId}
        aria-activedescendant={offen ? `${listeId}-${aktiv}` : undefined} data-wert={wert}
        onKeyDown={taste}
        onClick={() => (offen ? schliessen() : oeffnen())}
        onBlur={(e) => { if (offen && !liste.current?.contains(e.relatedTarget as Node)) setOffen(false); }}>
        <span class="auswahl-wert">{text || ' '}</span>
        <span class="auswahl-pfeil" aria-hidden="true" />
      </button>
      {offen && <span class="auswahl-abdecken" aria-hidden="true" onClick={(e) => { e.preventDefault(); schliessen(); }} />}
      {/* preventDefault: Liste und Abdeckung liegen oft in einem <label>; dessen Klick würde den Knopf erneut auslösen */}
      <div ref={liste} id={listeId} role="listbox" class="auswahl-liste" hidden={!offen} style={lage} tabIndex={-1} onClick={(e) => e.preventDefault()}
        aria-labelledby={rest['aria-labelledby'] as string | undefined} aria-label={rest['aria-labelledby'] ? undefined : name || undefined}>
        {offen && (gruppen.length
          ? <>
              {optionen.map((o, i) => (o.gruppe === undefined ? zeile(o, i) : null))}
              {gruppen.map((g, gi) => (
                <div role="group" key={`g${gi}`} aria-labelledby={`${listeId}-g${gi}`}>
                  <div class="auswahl-gruppe" id={`${listeId}-g${gi}`} role="presentation">{g}</div>
                  {optionen.map((o, i) => (o.gruppe === gi ? zeile(o, i) : null))}
                </div>
              ))}
            </>
          : optionen.map(zeile))}
      </div>
    </span>
  );
}

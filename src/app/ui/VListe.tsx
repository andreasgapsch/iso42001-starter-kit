// Virtualisierte Liste: zeichnet nur die sichtbaren Zeilen (feste Zeilenhöhe). Für 200 KI-Systeme,
// 1000 Risiken, 500 Massnahmen. Tastatur: Pfeil hoch/runter, Pos1/Ende, Enter wählt.
// Telefon (unter 640 px, U-14): jede Zeile als Karte mit Titel, Unterzeile (ID und Hauptwerte) und Status; die Rollen der
// Spalten folgen aus `rolle` oder dem Muster der Register (ID in ch, Titel als breiteste fr-Spalte, Status oder Stand).
import { Fragment } from 'preact';
import type { ComponentChildren } from 'preact';
import { isValidElement } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';

/** Druck (V-14): virtualisierte Listen zeigen im Ausdruck alle Zeilen, nicht nur die sichtbaren */
const druckt = signal(false);
if (typeof globalThis.matchMedia === 'function') {
  const m = globalThis.matchMedia('print');
  druckt.value = m.matches;
  m.addEventListener?.('change', (e) => (druckt.value = e.matches));
  globalThis.addEventListener?.('beforeprint', () => (druckt.value = true));
  globalThis.addEventListener?.('afterprint', () => (druckt.value = m.matches));
}

export interface Spalte<T> {
  titel: string;
  breite: string; // CSS-Grid-Spurbreite, z. B. "8ch" oder "2fr"
  wert: (e: T) => ComponentChildren;
  /** Erläuterung in Klammern am Ende eines Textwerts nur im Tooltip zeigen, z. B. «Schatten-KI (ohne Freigabe genutzt)» */
  kurz?: boolean;
  /** Rolle in der Kartenansicht (Telefon); ohne Angabe aus dem Muster der Spalten */
  rolle?: 'id' | 'titel' | 'status' | 'wert';
}

const STATUS_TITEL = /^(status|stand|state)$/i;

/** Rollen der Spalten für die Kartenansicht */
export function kartenRollen<T>(spalten: Spalte<T>[]): ('id' | 'titel' | 'status' | 'wert')[] {
  const fr = (s: Spalte<T>) => (/^(\d+(?:\.\d+)?)fr$/.exec(s.breite) ? parseFloat(s.breite) : 0);
  const max = Math.max(0, ...spalten.map(fr));
  let titel = spalten.findIndex((s) => s.rolle === 'titel');
  if (titel < 0) titel = spalten.findIndex((s) => fr(s) === max && max > 0);
  if (titel < 0) titel = spalten.length > 1 ? 1 : 0;
  return spalten.map((s, i) => s.rolle ?? (i === titel ? 'titel' : i === 0 && /ch$/.test(s.breite) ? 'id' : STATUS_TITEL.test(s.titel) ? 'status' : 'wert'));
}

const TELEFON = '(max-width: 639.98px)';
function useTelefon(): boolean {
  const [an, setAn] = useState(() => globalThis.matchMedia?.(TELEFON).matches ?? false);
  useEffect(() => {
    const mq = globalThis.matchMedia?.(TELEFON);
    if (!mq) return;
    const neu = () => setAn(mq.matches);
    mq.addEventListener?.('change', neu);
    return () => mq.removeEventListener?.('change', neu);
  }, []);
  return an;
}

/** Text eines Zellwerts für das title-Attribut (Rückfall, falls die Zelle trotz Umbruch kürzen muss). */
function zellText(w: ComponentChildren): string | undefined {
  if (typeof w === 'string' || typeof w === 'number') return String(w);
  if (Array.isArray(w)) return w.map(zellText).filter(Boolean).join(' ').replace(/\s+([:,.])/g, '$1').replace(/\s{2,}/g, ' ') || undefined;
  if (isValidElement(w)) return zellText((w.props as { children?: ComponentChildren }).children);
  return undefined;
}

/** Karte einer Zeile (Telefon): Titel, Unterzeile mit ID und Hauptwerten («Spalte: Wert»), Status */
function Karte<T>({ e, spalten, rollen }: { e: T; spalten: Spalte<T>[]; rollen: ReturnType<typeof kartenRollen> }) {
  const wert = (s: Spalte<T>) => { const w = s.wert(e); return s.kurz && typeof w === 'string' ? w.replace(/\s+\([^()]*\)$/, '') : w; };
  const teil = (r: string) => spalten.map((s, i) => (rollen[i] === r ? { s, w: wert(s) } : null)).filter((x) => x !== null && x.w !== '' && x.w !== null && x.w !== undefined) as { s: Spalte<T>; w: ComponentChildren }[];
  const titel = teil('titel');
  const id = teil('id');
  const werte = teil('wert');
  const status = teil('status');
  return (
    <>
      <span class="k-titel">{titel.map((x) => <span key={x.s.titel}>{x.w}</span>)}</span>
      <span class="k-unter">
        {id.map((x) => <span key={x.s.titel}>{x.w}</span>)}
        {werte.map((x) => <span key={x.s.titel} class="k-wert"><span class="k-label">{x.s.titel}: </span>{x.w}</span>)}
      </span>
      {status.length > 0 && <span class="k-status">{status.map((x) => <span key={x.s.titel}><span class="nur-sr">{x.s.titel}: </span>{x.w}</span>)}</span>}
    </>
  );
}

export function VListe<T extends { id: string }>(props: {
  eintraege: T[];
  spalten: Spalte<T>[];
  gewaehlt?: string;
  waehle: (id: string) => void;
  hoehe?: number;
  zeilenHoehe?: number;
  label: string;
}) {
  const karten = useTelefon();
  // A-03: Karten ohne Kürzung von Status und Wert brauchen Platz für je zwei Zeilen
  const zh = karten ? 168 : props.zeilenHoehe ?? 48;
  const hoehe = karten ? Math.max(props.hoehe ?? 520, 560) : props.hoehe ?? 520;
  const rollen = kartenRollen(props.spalten);
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [fokus, setFokus] = useState(0);
  // Schmale flexible Spalten (Status, Typ) nie schmaler als zwei Zeilen «Restrisiko angenommen»; breite (Titel) kürzen zuerst
  const raster = { gridTemplateColumns: props.spalten.map((s) => (/^\d+(\.\d+)?fr$/.test(s.breite) ? `minmax(${parseFloat(s.breite) >= 2 ? 3 : 6.5}rem, ${s.breite})` : s.breite)).join(' ') };
  const kopf = karten ? 0 : 37;
  const alle = druckt.value;
  const start = alle ? 0 : Math.max(0, Math.floor(scroll / zh) - 5);
  const ende = alle ? props.eintraege.length : Math.min(props.eintraege.length, Math.ceil((scroll + hoehe) / zh) + 5);

  useEffect(() => {
    if (!props.gewaehlt) return;
    const i = props.eintraege.findIndex((e) => e.id === props.gewaehlt);
    if (i < 0 || !ref.current) return;
    setFokus(i);
    const el = ref.current;
    const oben = i * zh;
    if (oben < el.scrollTop || oben + zh > el.scrollTop + hoehe - kopf) el.scrollTop = Math.max(0, oben - hoehe / 3);
  }, [props.gewaehlt]);

  const taste = (e: KeyboardEvent) => {
    const n = props.eintraege.length;
    if (!n) return;
    let i = fokus;
    if (e.key === 'ArrowDown') i = Math.min(n - 1, fokus + 1);
    else if (e.key === 'ArrowUp') i = Math.max(0, fokus - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      props.waehle(props.eintraege[fokus]!.id);
      return;
    } else return;
    e.preventDefault();
    setFokus(i);
    const el = ref.current!;
    if (i * zh < el.scrollTop) el.scrollTop = i * zh;
    if ((i + 1) * zh > el.scrollTop + hoehe - kopf) el.scrollTop = (i + 1) * zh - hoehe + kopf;
  };

  const aktiv = props.eintraege[fokus];
  return (
    <div
      ref={ref}
      class={`vliste${karten ? ' karten' : ''}`}
      data-hoch={zh >= 64 && !karten ? '' : undefined}
      style={{ height: `${Math.min(hoehe, kopf + Math.max(1, props.eintraege.length) * zh + 2)}px` }}
      onScroll={(e) => setScroll((e.currentTarget as HTMLDivElement).scrollTop)}
      role="listbox"
      aria-label={props.label}
      tabIndex={0}
      aria-activedescendant={aktiv ? `vz-${aktiv.id}` : undefined}
      onKeyDown={taste}
    >
      {!karten && (
        <div class="kopfzeile" style={raster} aria-hidden="true">
          {props.spalten.map((s) => (
            <span key={s.titel} class="zelle" title={s.titel}>{s.titel}</span>
          ))}
        </div>
      )}
      <div role="presentation" style={{ height: `${props.eintraege.length * zh}px`, position: 'relative' }}>
        {props.eintraege.slice(start, ende).map((e, j) => {
          const i = start + j;
          return (
            <div
              key={e.id}
              id={`vz-${e.id}`}
              role="option"
              aria-selected={props.gewaehlt === e.id}
              class={`zeile${i === fokus ? ' fokus' : ''}`}
              style={karten ? { top: `${i * zh}px`, height: `${zh - 8}px` } : { ...raster, top: `${i * zh}px`, height: `${zh}px` }}
              onClick={() => {
                setFokus(i);
                props.waehle(e.id);
              }}
            >
              {karten ? <Karte e={e} spalten={props.spalten} rollen={rollen} /> : props.spalten.map((s) => {
                const w = s.wert(e);
                const sichtbar = s.kurz && typeof w === 'string' ? w.replace(/\s+\([^()]*\)$/, '') : w;
                return (
                  <Fragment key={s.titel}>
                    {/* Spaltenname für Bildschirmleser (D-20); ausserhalb der Zelle, nimmt keinen Platz im Raster ein */}
                    <span class="nur-sr">{s.titel}: </span>
                    <span class="zelle" title={zellText(w)}>{sichtbar}</span>
                  </Fragment>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

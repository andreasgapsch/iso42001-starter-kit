// Datendarstellungen der App im Design System: gestapelte Balken, Kennzahl mit Sparkline, Zeitleiste (Fristen), Gantt,
// Hantel Ist/Ziel, Etappenleiste (Knoten und Leitung), Kreuztabelle mit Mengenfarbe. Beschriftungen kommen fertig vom
// Aufrufer (i18n der App); Farben nur über Klassen g-* und die Tokens in src/app/stil.css.
import type { ComponentChildren, RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { zeilenSumme, zeilenText, type BalkenKategorie, type BalkenZeile } from '../svg/balken.ts';
import { hantelSzene, type HantelTexte, type HantelZeile } from '../svg/hantel.ts';
import { sparklineSzene } from '../svg/sparkline.ts';
import { ganttSzene, type GanttOptionen, type GanttTexte, type GanttZeile } from '../svg/zeitleiste.ts';
import { fortschrittsKnoten, type FortschrittsZustand } from '../svg/formen.ts';
import { SzeneSvg, zuPreact } from './Szene.tsx';
import { StatusPille, type StatusArt } from '../../app/ui/StatusPille.tsx';

// ---------- Gestapelte Balken (HTML: Breiten über flex, ohne style-Attribut im Markup) ----------

export interface BalkenProps<K extends string> {
  kategorien: readonly BalkenKategorie<K>[];
  /** href: Titel als Link; marke: Form vor dem Titel; zusatz: z. B. Statuspille nach dem Titel */
  zeilen: readonly (BalkenZeile<K> & { href?: string; marke?: ComponentChildren; zusatz?: ComponentChildren })[];
  beschriftung: string;
  legende?: boolean;
  /** «zusammen» im aria-label */
  zusammen?: (summe: number) => string;
  id?: string;
}

export function BalkenGestapelt<K extends string>(p: BalkenProps<K>) {
  return (
    <div class="g-figur" id={p.id}>
      {p.legende !== false && (
        <ul class="g-legende" aria-hidden="true">
          {p.kategorien.map((k) => <li key={k.schluessel}><span class={`g-farbe g-ton-${k.ton}${k.muster ? ' g-muster' : ''}`} />{k.text}</li>)}
        </ul>
      )}
      <ul class="g-balken" aria-label={p.beschriftung}>
        {p.zeilen.map((z) => {
          const summe = zeilenSumme(z, p.kategorien);
          const erste = z.werte[p.kategorien[0]!.schluessel] ?? 0;
          const lesbar = `${zeilenText(z, p.kategorien)}${p.zusammen ? `, ${p.zusammen(summe)}` : ''}`;
          return (
            <li key={z.titel} class="g-balken__zeile">
              <span class="g-balken__titel">{z.marke}{z.href ? <a href={z.href}>{z.titel}</a> : z.titel}{z.zusatz}</span>
              <span class="g-balken__bahn" role="img" aria-label={lesbar}>
                {p.kategorien.map((k) => {
                  const w = z.werte[k.schluessel] ?? 0;
                  return w > 0 ? <span key={k.schluessel} class={`g-balken__teil g-ton-${k.ton}${k.muster ? ' g-muster' : ''}`} style={{ flex: `${w} 0 0` }} data-kategorie={k.schluessel} data-wert={w} /> : null;
                })}
              </span>
              <span class="g-balken__summe">{z.summe ?? `${summe ? Math.round((100 * erste) / summe) : 0} %`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Kennzahl mit Sparkline ----------

export interface KennzahlProps {
  beschriftung: string;
  wert: ComponentChildren;
  einheit?: string;
  href?: string;
  /** Verlauf, ältester Wert zuerst; ab zwei Werten als Sparkline */
  verlauf?: readonly number[];
  /** aria-label der Sparkline mit allen Werten */
  verlaufText?: string;
  soll?: number;
  text?: ComponentChildren;
  id?: string;
}

export function Kennzahl(p: KennzahlProps) {
  const linie = p.verlauf && p.verlauf.length >= 2 ? sparklineSzene(p.verlauf, p.verlaufText ?? p.verlauf.join(', '), { soll: p.soll }) : null;
  const wert = (
    <>
      {p.wert}
      {/* Leerzeichen im Text: der sichtbare Text «0 Fehler» steht so auch im zugänglichen Namen (WCAG 2.5.3) */}
      {p.einheit && <>{' '}<span class="g-kennzahl__einheit">{p.einheit}</span></>}
    </>
  );
  return (
    <div class={`g-kennzahl${p.href ? ' g-kennzahl--link' : ''}`} id={p.id}>
      <p class="g-kennzahl__beschriftung">{p.beschriftung}</p>
      <div class="g-kennzahl__zeile">
        {/* Mit Ziel ist die ganze Kachel klickbar (U-05): der Link über den Wert deckt die Kachel ab (g-kennzahl--link) */}
        <span class="g-kennzahl__wert">{p.href ? <a href={p.href} class="g-kennzahl__ziel" aria-label={typeof p.wert === 'string' || typeof p.wert === 'number' ? `${p.beschriftung}: ${p.wert}${p.einheit ? ` ${p.einheit}` : ''}` : undefined}>{wert}</a> : wert}</span>
        <SzeneSvg szene={linie} />
      </div>
      {p.text && <div class="g-kennzahl__text">{p.text}</div>}
    </div>
  );
}

export function Kennzahlen({ children, beschriftung }: { children: ComponentChildren; beschriftung?: string }) {
  return <div class="g-kennzahlen" role={beschriftung ? 'group' : undefined} aria-label={beschriftung}>{children}</div>;
}

// ---------- Zeitleiste (senkrecht, Fristen) ----------

export type ZeitZustand = 'erledigt' | 'aktiv' | 'offen';

export interface ZeitEintrag {
  id: string;
  titel: string;
  /** sichtbares Datum */
  datum: string;
  /** ISO-Datum für <time datetime> */
  iso: string;
  zustand: ZeitZustand;
  /** Zustand als Wort (für Bildschirmleser oder Pille) */
  zustandText: string;
  text?: ComponentChildren;
  /** Pille neben dem Titel, z. B. «nächste» */
  pille?: { ton: 'gut' | 'warnung' | 'kritisch' | 'info' | 'neutral'; text: string };
}

export function Zeitleiste({ eintraege, heute, beschriftung, id }: { eintraege: readonly ZeitEintrag[]; heute?: { vorIndex: number; text: string }; beschriftung: string; id?: string }) {
  const teile: ComponentChildren[] = [];
  const heuteZeile = (h: { text: string }) => <li key="heute" class="g-zeit g-zeit--heute"><span class="g-zeit__heute">{h.text}</span></li>;
  eintraege.forEach((e, i) => {
    if (heute && heute.vorIndex === i) teile.push(heuteZeile(heute));
    teile.push(
      <li key={e.id} class={`g-zeit g-zeit--${e.zustand}`} data-zustand={e.zustand}>
        <span class="g-zeit__marke" aria-hidden="true" />
        <div class="g-zeit__kopf">
          <time class="g-zeit__datum" dateTime={e.iso}>{e.datum}</time>
          <span class="g-zeit__titel">{e.titel}</span>
          {e.pille ? <StatusPille art={e.pille.ton as StatusArt}>{e.pille.text}</StatusPille> : <span class="nur-sr">, {e.zustandText}</span>}
        </div>
        {e.text && <p class="g-zeit__text">{e.text}</p>}
      </li>,
    );
  });
  if (heute && heute.vorIndex >= eintraege.length) teile.push(heuteZeile(heute));
  return <ol class="g-zeitleiste" aria-label={beschriftung} id={id}>{teile}</ol>;
}

// ---------- Gantt und Hantel (SVG-Szenen in der Breite des Behälters, damit Schrift 1:1 bleibt) ----------

/** Breite des Behälters in px (ganzzahlig), folgt Grössenänderungen; vor der Messung der Ersatzwert. */
function useBreite(ersatz: number, min: number): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(ersatz);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messen = () => {
      const b = Math.max(min, Math.floor(el.clientWidth));
      if (b > 0) setBreite((alt) => (Math.abs(alt - b) >= 2 ? b : alt));
    };
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    // Messung im nächsten Bild: eine Änderung der Breite im Rückruf löst sonst in WebKit «ResizeObserver loop» aus
    let bild = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(bild); bild = requestAnimationFrame(messen); });
    ro.observe(el);
    return () => { cancelAnimationFrame(bild); ro.disconnect(); };
  }, []);
  return [ref, breite];
}

export function Gantt({ zeilen, texte, optionen }: { zeilen: readonly GanttZeile[]; texte: GanttTexte; optionen: Omit<GanttOptionen, 'breite'> }) {
  const [ref, breite] = useBreite(760, 560);
  return <div class="g-scroll" id={optionen.id} ref={ref} tabIndex={0} role="group" aria-label={texte.titel}><SzeneSvg szene={ganttSzene(zeilen, texte, { ...optionen, id: `${optionen.id}-svg`, breite })} /></div>;
}

export interface HantelProps {
  zeilen: readonly HantelZeile[];
  texte: HantelTexte;
  id: string;
  breite?: number;
  titelSichtbar?: boolean;
  /** Textalternative als Tabelle */
  tabelle?: { zusammenfassung: string; kopf: [string, string, string]; zahl: (n: number | null) => string };
}

export function Hantel(p: HantelProps) {
  const [ref, breite] = useBreite(p.breite ?? 640, 420);
  return (
    <div class="g-figur" id={p.id}>
      <div class="g-scroll" ref={ref} tabIndex={0} role="group" aria-label={p.texte.titel}><SzeneSvg szene={hantelSzene(p.zeilen, p.texte, { id: `${p.id}-svg`, breite, titelSichtbar: p.titelSichtbar })} /></div>
      {p.tabelle && (
        <details class="g-details">
          <summary>{p.tabelle.zusammenfassung}</summary>
          <table class="g-tabelle">
            <thead><tr>{p.tabelle.kopf.map((k) => <th key={k} scope="col">{k}</th>)}</tr></thead>
            <tbody>
              {p.zeilen.map((z) => (
                <tr key={z.titel}><th scope="row">{z.titel}</th><td class="zahl">{p.tabelle!.zahl(z.ist)}</td><td class="zahl">{p.tabelle!.zahl(z.ziel)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

// ---------- Etappenleiste (Knoten und Leitung) ----------

export type LeistenZustand = 'erledigt' | 'in-arbeit' | 'offen';

export interface EtappenSchrittProps {
  kuerzel: string;
  /** voller Titel: in der aktiven Etappe sichtbar, sonst als Tooltip und für Bildschirmleser */
  titel: string;
  /** Kurztitel für die Leiste (ohne: voller Titel) */
  kurz?: string;
  /** erledigt (vollständig), in-arbeit (teilweise) oder offen */
  zustand: LeistenZustand;
  zustandText: string;
  /** Anteil erledigter Seiten 0 bis 1 (Teilkreis bei «in-arbeit») */
  anteil?: number;
  aktiv?: boolean;
  /** Stelle in der aktiven Etappe, z. B. «Seite 7 von 10» */
  ort?: string;
  href?: string;
  meta?: string;
}

const KNOTEN_ZUSTAND: Record<LeistenZustand, FortschrittsZustand> = { erledigt: 'erledigt', 'in-arbeit': 'teilweise', offen: 'offen' };

/** Knoten mit Fortschrittsform als kleines SVG (Durchmesser groesse px), Zustand nur als Form; Text liefert der Aufrufer. */
export function FortschrittsKnoten({ zustand, anteil, groesse = 14, klasse }: { zustand: FortschrittsZustand; anteil?: number; groesse?: number; klasse?: string }) {
  const m = groesse / 2;
  return (
    <svg class={`g-svg g-knoten${klasse ? ` ${klasse}` : ''}`} width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`} aria-hidden="true" focusable="false" data-zustand={zustand}>
      {fortschrittsKnoten(zustand, m, m, m - 1, anteil).map((k, i) => zuPreact(k, i))}
    </svg>
  );
}

type LeistenModus = 'kurz' | 'nummern';

/** Überlappen sich sichtbare Beschriftungen zweier Etappen, oder läuft die Leiste über? */
function leisteUeberlaeuft(huelle: HTMLElement): boolean {
  if (huelle.scrollWidth > huelle.clientWidth + 1) return true;
  const boxen = [...huelle.querySelectorAll<HTMLElement>('.etappen > li')].map((li) =>
    [...li.querySelectorAll<HTMLElement>('.nr, .titel, .kurz, .ort, .hier, .meta')].filter((x) => x.offsetParent !== null).map((x) => x.getBoundingClientRect()));
  for (let i = 0; i < boxen.length; i++) {
    for (const a of boxen[i]!) {
      if (a.width === 0) continue;
      for (let j = i + 1; j < boxen.length; j++) {
        for (const b of boxen[j]!) if (b.width > 0 && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) return true;
      }
    }
  }
  return false;
}

/**
 * Waagrechte Leiste: zuerst mit Kurztiteln; passt sie nicht (Überlauf oder Überlappung), nur Nummern und der volle Titel
 * der aktiven Etappe. Wird der Platz grösser, versucht sie es wieder mit Kurztiteln.
 */
function useLeistenModus(schluessel: string): [RefObject<HTMLElement>, LeistenModus] {
  const ref = useRef<HTMLElement>(null);
  const [modus, setModus] = useState<LeistenModus>('kurz');
  const fehlBreite = useRef(0);
  const zuletzt = useRef(schluessel);
  useLayoutEffect(() => {
    if (zuletzt.current !== schluessel) {
      zuletzt.current = schluessel;
      fehlBreite.current = 0;
      if (modus !== 'kurz') {
        setModus('kurz');
        return;
      }
    }
    const el = ref.current;
    if (!el) return;
    const pruefen = () => {
      const b = el.clientWidth;
      if (b === 0) return;
      if (modus === 'kurz') {
        if (leisteUeberlaeuft(el)) {
          fehlBreite.current = b;
          setModus('nummern');
        }
      } else if (b > fehlBreite.current + 1) setModus('kurz');
    };
    pruefen();
    void globalThis.document?.fonts?.ready.then(pruefen);
    if (typeof ResizeObserver === 'undefined') return;
    // Prüfung im nächsten Bild (wie useBreite): kein «ResizeObserver loop» in WebKit, wenn der Wechsel die Grösse ändert
    let bild = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(bild); bild = requestAnimationFrame(pruefen); });
    ro.observe(el);
    const ol = el.querySelector('ol');
    if (ol) ro.observe(ol);
    return () => { cancelAnimationFrame(bild); ro.disconnect(); };
  }, [modus, schluessel]);
  return [ref, modus];
}

export function Etappenleiste({ schritte, beschriftung, senkrecht, mitMeta, hier, vorne, sprache }: {
  schritte: readonly EtappenSchrittProps[];
  beschriftung: string;
  senkrecht?: boolean;
  mitMeta?: boolean;
  /** Text an der aktiven Etappe, z. B. «Sie sind hier» */
  hier?: string;
  /** Element vor der Leiste (z. B. Link zum Überblick) */
  vorne?: ComponentChildren;
  /** Sprache der Beschriftungen für die Silbentrennung (lang) */
  sprache?: string;
}) {
  const schluessel = schritte.map((s) => `${s.kuerzel}:${s.kurz ?? s.titel}:${s.aktiv ? 1 : 0}:${s.ort ?? ''}`).join('|');
  const [ref, modus] = useLeistenModus(senkrecht ? '' : schluessel);
  const liste = (
    <ol class={`etappen${senkrecht ? ' etappen--senkrecht' : ` etappen--${modus}`}`} lang={sprache}>
      {schritte.map((s) => {
        const kurz = s.kurz ?? s.titel;
        return (
          <li key={s.kuerzel} class={`st-${s.zustand}${s.aktiv ? ' aktiv' : ''}`} data-zustand={s.zustand}>
            <span class="knoten-platz" aria-hidden="true">
              <FortschrittsKnoten zustand={KNOTEN_ZUSTAND[s.zustand]} anteil={s.anteil} groesse={s.aktiv ? 22 : 14} />
            </span>
            <a href={s.href} aria-current={s.aktiv ? 'step' : undefined} title={s.aktiv ? undefined : `${s.kuerzel} ${s.titel}: ${s.zustandText}`}>
              <span class="nr">{s.kuerzel}</span>
              {s.aktiv ? <span class="titel">{s.titel}</span> : <span class="kurz">{kurz}</span>}
              {!s.aktiv && kurz !== s.titel && <span class="nur-sr"> {s.titel}</span>}
              {s.aktiv && hier && <span class="hier">{hier}</span>}
              {s.aktiv && s.ort && <span class="ort">{s.ort}</span>}
              {mitMeta ? <span class="meta">{s.meta ? `${s.meta}, ` : ''}{s.zustandText}</span> : <span class="nur-sr">, {s.zustandText}</span>}
            </a>
          </li>
        );
      })}
    </ol>
  );
  if (senkrecht) return <nav aria-label={beschriftung}>{liste}</nav>;
  return (
    <nav class={`etappen-huelle${vorne ? ' mit-vorne' : ''}`} aria-label={beschriftung} data-modus={modus}>
      {vorne && <div class="etappen-vorne">{vorne}</div>}
      <div class="etappen-bahn" ref={ref as RefObject<HTMLDivElement>}>{liste}</div>
    </nav>
  );
}

// ---------- Seitenpunkte: Seiten der aktuellen Etappe als Punktreihe mit Status ----------

export interface SeitenPunkt {
  id: string;
  titel: string;
  zustand: FortschrittsZustand;
  zustandText: string;
  href: string;
  aktiv?: boolean;
}

export function SeitenPunkte({ punkte, beschriftung, id }: { punkte: readonly SeitenPunkt[]; beschriftung: string; id?: string }) {
  return (
    <ol class="seitenpunkte" aria-label={beschriftung} id={id}>
      {punkte.map((s, i) => (
        <li key={s.id} class={s.aktiv ? 'aktiv' : undefined} data-zustand={s.zustand}>
          <a href={s.href} aria-current={s.aktiv ? 'page' : undefined} title={`${i + 1}. ${s.titel}: ${s.zustandText}`}>
            <FortschrittsKnoten zustand={s.zustand} groesse={s.aktiv ? 18 : 13} />
            <span class="nur-sr">{i + 1}. {s.titel}, {s.zustandText}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

// ---------- Kreuztabelle mit Mengenfarbe (seq-1 bis seq-5) ----------

/** Stufe 0 bis 5 der Mengenfarbe für einen Wert (0 ohne Wert). */
export function mengenStufe(wert: number, max: number): number {
  if (wert <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((5 * wert) / max)));
}

export interface KreuzProps {
  beschriftung: string;
  ecke: string;
  zeilen: readonly string[];
  spalten: readonly string[];
  werte: readonly (readonly number[])[];
  summe?: string;
  id?: string;
}

export function Kreuztabelle(p: KreuzProps) {
  const max = Math.max(0, ...p.werte.flat());
  const spaltenSumme = p.spalten.map((_, j) => p.werte.reduce((s, z) => s + (z[j] ?? 0), 0));
  return (
    <div class="g-scroll" tabIndex={0} role="group" aria-label={p.beschriftung}>
      <table class="g-kreuz" id={p.id}>
        <caption class="nur-sr">{p.beschriftung}</caption>
        <thead>
          <tr>
            <th scope="col">{p.ecke}</th>
            {p.spalten.map((s) => <th key={s} scope="col">{s}</th>)}
            {p.summe && <th scope="col" class="summe">{p.summe}</th>}
          </tr>
        </thead>
        <tbody>
          {p.zeilen.map((z, i) => (
            <tr key={z}>
              <th scope="row">{z}</th>
              {p.spalten.map((s, j) => {
                const w = p.werte[i]?.[j] ?? 0;
                return <td key={s} class={`g-seq-${mengenStufe(w, max)}`}>{w}</td>;
              })}
              {p.summe && <td class="summe">{(p.werte[i] ?? []).reduce((a, b) => a + b, 0)}</td>}
            </tr>
          ))}
          {p.summe && (
            <tr>
              <th scope="row" class="summe">{p.summe}</th>
              {spaltenSumme.map((w, j) => <td key={j} class="summe">{w}</td>)}
              <td class="summe">{spaltenSumme.reduce((a, b) => a + b, 0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

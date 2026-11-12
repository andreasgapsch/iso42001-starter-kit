// Formularansicht für eine Projektliste: Suche, virtualisierte Liste, Bearbeitung des gewählten Eintrags.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { optionText, t } from '../../i18n.ts';
import { musterEintrag } from '../../logik/eintraege.ts';
import { formularFelder, registerFilter, sichtbareFelder, type FormularFeld } from '../../logik/formularfelder.ts';
import { feldWert, type SeitenEintrag } from '../../logik/gefuehrt.ts';
import { istListenName } from '../../logik/ids.ts';
import { lies } from '../../logik/pfad.ts';
import { routeZuHash, type Modul, type Route } from '../../logik/routen.ts';
import { Eingabe, Feld, feldLabel, feldSchluessel } from '../../ui/Feld.tsx';
import { LoeschKnopf } from '../../ui/Loeschen.tsx';
import { VListe, type Spalte } from '../../ui/VListe.tsx';
import { erfassenText } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { Symbol } from '../../rahmen/symbole.tsx';
import { navigiere, umfeld } from '../../zustand/store.ts';
import { eintragEntfernen, eintragHinzufuegen, schreibeFeld } from '../gefuehrt/aktionen.ts';
import { Hinweis } from '../../ui/Hinweis.tsx';

/** Textangaben eines Eintrags für die Suche, zwei Ebenen tief (Listen und verschachtelte Angaben) */
function suchText(o: unknown, tiefe = 0): string {
  if (typeof o === 'string') return o;
  if (typeof o === 'number') return String(o);
  if (tiefe > 2 || !o || typeof o !== 'object') return '';
  return (Array.isArray(o) ? o : Object.values(o as Record<string, unknown>)).map((w) => suchText(w, tiefe + 1)).join(' ');
}

/** Aufeinanderfolgende Felder derselben Prüfgruppe zusammenfassen; übrige Felder einzeln */
function gruppiert(felder: FormularFeld[]): { gruppe: string | null; felder: FormularFeld[] }[] {
  const r: { gruppe: string | null; felder: FormularFeld[] }[] = [];
  for (const f of felder) {
    const g = pruefGruppe(f);
    const letzte = r[r.length - 1];
    if (g && letzte?.gruppe === g) letzte.felder.push(f);
    else r.push({ gruppe: g, felder: [f] });
  }
  return r;
}

/** Prüffragen und Vertragsklauseln der Lieferanten als Gruppe (Rollentest RT-17): allgemein, GenAI-Sicherheit, Klauseln */
function pruefGruppe(f: FormularFeld): string | null {
  const m = /^(pruefpunkte|vertragsklauseln)\.(PF|VK)-(\d+)$/.exec(f.feld.pfad ?? '');
  if (!m) return null;
  if (m[2] === 'VK') return 'klauseln';
  return Number(m[3]) >= 16 ? 'genai' : 'allgemein';
}

function PruefTabelle({ gruppe, felder, p, eintrag }: { gruppe: string; felder: FormularFeld[]; p: Projekt; eintrag: ListenEintrag }) {
  const werte = felder.map((f) => feldWert(f.feld, p, eintrag));
  const zaehle = new Map<string, number>();
  for (const w of werte) {
    const k = w === undefined || w === null || w === '' ? '' : String(w);
    zaehle.set(k, (zaehle.get(k) ?? 0) + 1);
  }
  const optionen = felder[0]?.feld.optionen;
  const zusammenfassung = [...zaehle.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([k, n]) => `${n} ${k === '' ? t('liste.ohne_angabe') : optionText(optionen, k)}`)
    .join(', ');
  return (
    <details class="karte abschnitt pruefgruppe" open data-gruppe={gruppe}>
      <summary><strong>{t(`lieferant.gruppe_${gruppe}`)}</strong> <span class="zweitext">· {zusammenfassung}</span></summary>
      <div class="tabelle-feld">
        <table>
          <caption class="nur-sr">{t(`lieferant.gruppe_${gruppe}`)}</caption>
          <tbody>
            {felder.map((f, i) => {
              const id = `ff-${eintrag.id}-${feldSchluessel(f.feld)}`.replace(/[^\w-]/g, '_');
              const label = feldLabel(f.feld, f.textBasis);
              return (
                <tr key={feldSchluessel(f.feld)}>
                  <th scope="row"><label for={id}>{label}</label></th>
                  <td style={{ width: '14rem' }}>{Eingabe({ def: f.feld, wert: werte[i], setze: (w) => schreibeFeld(f.feld, w, eintrag), id, textBasis: f.textBasis, kompakt: true, label })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface ListenEintrag extends SeitenEintrag {
  titel: string;
}

export function ListenModul(props: {
  p: Projekt;
  modul: Modul;
  liste: string;
  titel: string;
  einleitung?: string;
  eintraege: ListenEintrag[];
  spalten: Spalte<ListenEintrag>[];
  /** Zeilenhöhe der Liste in px (Standard 48; Risiken 64 für Status mit zweizeiliger Zusatzzeile, A-18) */
  zeilenHoehe?: number;
  gewaehlt?: string;
  anlegen?: boolean;
  /** Vorgabe für neue Einträge (z. B. aus dem Filter ?ki=) */
  vorgabe?: Record<string, unknown>;
  filterHinweis?: string;
  filter?: Record<string, string>;
  ausschluss?: string[];
  zusatz?: (e: ListenEintrag) => ComponentChildren;
  felder?: FormularFeld[];
  /** Route je Auswahl (Reitermodule); Vorgabe: #/formular/<modul>/<id> */
  routeFuer?: (id?: string) => Route;
  /** Zusatz über der Liste (z. B. Fragebogen) */
  oben?: ComponentChildren;
  /** Überschrift als h2 (eingebettet unter einem Reiter) */
  unterteil?: boolean;
  /** Hauptaktion im Seitenkopf statt «… erfassen» (z. B. Module ohne Anlegen) */
  aktion?: ComponentChildren;
}) {
  const { p, liste } = props;
  const [suche, setSuche] = useState('');
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), [props.modul]);
  const felder = useMemo(() => props.felder ?? formularFelder(umfeld.value.gefuehrt, liste, props.ausschluss), [liste, props.felder]);
  const s = suche.trim().toLowerCase();
  // Suche über ID, Titel und alle Textangaben des Eintrags (z. B. KI-System, Status, Begründung; Rollentest RT-16)
  const sichtbar = s ? props.eintraege.filter((e) => `${e.id} ${e.titel} ${suchText(e.objekt)}`.toLowerCase().includes(s)) : props.eintraege;
  const gewaehlt = props.eintraege.find((e) => e.id === props.gewaehlt);
  const muster = musterEintrag(liste) ?? {};
  const routeFuer = props.routeFuer ?? ((id?: string) => ({ art: 'formular', modul: props.modul, id, filter: props.filter }) as Route);
  const waehle = (id: string) => navigiere(routeFuer(id));
  const neu = () => {
    if (!istListenName(liste)) return;
    // Filter der Seiten (C4-01): eine neue Rolle erhält einen Bereich und damit ihre Felder (Bereich, R, A, Stellvertretung)
    const id = eintragHinzufuegen({ id: '', typ: 'liste', liste, vorgabe: props.vorgabe, filter: registerFilter(felder) }, {});
    waehle(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#editor-${liste} input, #editor-${liste} [role=combobox], #editor-${liste} textarea`)?.focus());
  };
  const kannNeu = props.anlegen !== false && istListenName(liste);
  // Hauptaktion (U-34): «KI-System erfassen», «Risiko erfassen» … im Seitenkopf; eingebettet unter einem Reiter in der Liste
  const neuKnopf = (primaer: boolean) => <button type="button" class={primaer ? 'primaer' : 'klein'} id={`neu-${liste}`} onClick={neu}><Symbol name="plus" />{erfassenText(liste)}</button>;
  return (
    <div class={props.unterteil ? '' : 'inhalt'}>
      {props.unterteil ? <h2 class="reiter-titel">{props.titel}</h2> : <Seitenkopf titel={props.titel} titelRef={titelRef} aktion={props.aktion ?? (kannNeu ? neuKnopf(true) : undefined)} />}
      {props.einleitung && <p class="zweitext">{props.einleitung}</p>}
      {props.filterHinweis && (
        <Hinweis als="p">
          {props.filterHinweis} <a href={routeZuHash(props.routeFuer ? props.routeFuer() : { art: 'formular', modul: props.modul })}>{t('liste.filter_aus')}</a>
        </Hinweis>
      )}
      {props.oben}
      {/* Ohne Auswahl gehört die Breite der Liste; bei null Einträgen entfällt der Bearbeitungsbereich (D-14, D-23) */}
      <div class={`formular-geteilt${gewaehlt ? '' : ' ohne-auswahl'}`}>
        <div>
          <div class="liste-kopf">
            {/* Eigener Name statt «Suchen» (U-27): die globale Suche im Kopf heisst «Suchen» */}
            <input type="search" placeholder={t('liste.filtern_liste', { titel: props.titel })} aria-label={t('liste.filtern_liste', { titel: props.titel })} value={suche} onInput={(e) => setSuche(e.currentTarget.value)} />
            <span class="zweitext" aria-live="polite">{t('liste.anzahl', { anzahl: sichtbar.length })}</span>
            {props.unterteil && kannNeu && neuKnopf(false)}
          </div>
          {sichtbar.length ? (
            <VListe label={props.titel} eintraege={sichtbar} spalten={props.spalten} gewaehlt={props.gewaehlt} waehle={waehle} {...(props.zeilenHoehe ? { zeilenHoehe: props.zeilenHoehe } : {})} />
          ) : (
            <p class="ersatz liste-leer">{s ? t('liste.leer_filter') : kannNeu ? t('liste.leer_erfassen') : t('liste.leer')}</p>
          )}
        </div>
        {gewaehlt && <section class="karte editor" id={`editor-${liste}`} aria-label={`${t('liste.bearbeiten')}: ${props.titel}`}>
          {(
            <>
              <h2><span class="marke-id">{gewaehlt.liste === 'folgenabschaetzungen' ? gewaehlt.kiSystem : gewaehlt.id}</span> {gewaehlt.titel}</h2>
              {props.zusatz?.(gewaehlt)}
              {gruppiert(sichtbareFelder(felder, p, gewaehlt.objekt)).map((g) => g.gruppe ? <PruefTabelle key={g.gruppe} gruppe={g.gruppe} felder={g.felder} p={p} eintrag={gewaehlt} /> : g.felder.map((f) => (
                <Feld
                  key={feldSchluessel(f.feld)}
                  def={{ ...f.feld, pflicht: f.feld.pflicht }}
                  wert={feldWert(f.feld, p, gewaehlt)}
                  setze={(w) => schreibeFeld(f.feld, w, gewaehlt)}
                  textBasis={f.textBasis}
                  norm={f.norm}
                  id={`ff-${gewaehlt.id}-${feldSchluessel(f.feld)}`.replace(/[^\w-]/g, '_')}
                  liste={Array.isArray(lies(muster, f.feld.pfad ?? '')) || f.feld.typ === 'mehrfach'}
                />
              )))}
              {props.anlegen !== false && istListenName(liste) && (
                <LoeschKnopf liste={liste} id={gewaehlt.id} text={t('liste.entfernen')} frage={t('liste.entfernen_frage')} entfernen={() => {
                  eintragEntfernen(liste, gewaehlt.id);
                  navigiere(routeFuer());
                }} />
              )}
            </>
          )}
        </section>}
      </div>
    </div>
  );
}

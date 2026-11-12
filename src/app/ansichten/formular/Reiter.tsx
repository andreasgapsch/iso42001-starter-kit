// Reiter für Formularmodule mit Unterbereichen (Organisation, Kompetenz, EU AI Act, 27001-Brücke)
// und Abschnitte aus Formularseiten des Guides (eine Quelle für Felder, Texte und Normbezug).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { inhalt, t } from '../../i18n.ts';
import { erfuellt } from '../../logik/bedingungen.ts';
import { etappeVonSeite, seitenIndex } from '../../logik/gefuehrt.ts';
import { routeZuHash, type Modul } from '../../logik/routen.ts';
import { RichText } from '../../ui/RichText.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { umfeld } from '../../zustand/store.ts';
import { FormularFelder } from '../gefuehrt/Gefuehrt.tsx';
import { seitenText } from '../gefuehrt/Hilfe.tsx';

/** Formularmodul mit Reitern; Hauptaktion im Seitenkopf: Vorgabe des Moduls oder Drucken des Reiters */
export function ReiterModul(props: { modul: Modul; titel: string; einleitung?: string; reiter: { id: string; text: string }[]; aktiv: string; aktion?: ComponentChildren; children: ComponentChildren }) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), [props.modul]);
  return (
    <div class="inhalt">
      <Seitenkopf titel={props.titel} titelRef={titelRef} aktion={props.aktion ?? <DruckAktion />} />
      {props.einleitung && <p class="zweitext">{props.einleitung}</p>}
      <nav aria-label={t('reiter.titel', { modul: props.titel })}>
        <ul class="reiter">
          {props.reiter.map((r) => (
            <li key={r.id}>
              <a href={routeZuHash({ art: 'formular', modul: props.modul, id: r.id })} aria-current={r.id === props.aktiv ? 'page' : undefined} id={`reiter-${r.id}`}>{r.text}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div class="reiter-inhalt">{props.children}</div>
    </div>
  );
}

/** Felder mehrerer Formularseiten des Guides als Abschnitte (Seiten mit unerfüllter Bedingung entfallen). */
export function SeitenAbschnitte({ p, seiten }: { p: Projekt; seiten: string[] }) {
  const g = umfeld.value.gefuehrt;
  const index = seitenIndex(g);
  return (
    <>
      {seiten.map((id) => {
        const s = index.get(id);
        const e = etappeVonSeite(g, id);
        if (!s || !e) return null;
        if (!erfuellt(e.wenn, p) || !erfuellt(s.wenn, p)) return null;
        const titel = seitenText(e, s, 'titel') ?? id;
        return (
          <section class="karte abschnitt" key={id} aria-labelledby={`abschnitt-${id}`}>
            <h2 id={`abschnitt-${id}`}>{titel}</h2>
            <RichText text={seitenText(e, s, 'frage')} />
            <FormularFelder p={p} etappe={e} seite={s} fehlerZeigen={false} mitNorm />
            <p class="zweitext klein reiter-guide">
              <a href={routeZuHash({ art: 'gefuehrt', etappe: e.id, seite: s.id })}>{t('reiter.im_gefuehrten', { etappe: inhalt(`gefuehrt.etappen.${e.id}.titel`) ?? e.id })}</a>
            </p>
          </section>
        );
      })}
    </>
  );
}

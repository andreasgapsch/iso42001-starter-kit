// Hilfe (Kurzanleitung, Tastenkürzel) und Hinweise (fällige Aufgaben, Prüfung, Rechtsstand) im Rahmen ab rc.10.
// Die Namensnennung (Tor G8) steht in der Hilfe, im Untermenü, auf der Startseite und unter «Über».
import type { ComponentChildren } from 'preact';
import { Symbol } from '../../rahmen/symbole.tsx';
import { useEffect, useRef } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { aiActStand, appDaten } from '../../daten.ts';
import { datumText, t } from '../../i18n.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { BEREICHE, bereichTitel } from '../../rahmen/bereiche.ts';
import { faelligListe } from '../../rahmen/faellig.ts';
import { tr } from '../../rahmen/text.ts';
import { befunde } from '../../zustand/store.ts';
import { AmpelAnzeige } from '../pruefung/Pruefung.tsx';
import { FaelligTabelle } from '../start/Start.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

function useTitel(schluessel: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [schluessel]);
  return ref;
}

const ABSCHNITTE = ['starten', 'navigation', 'arbeiten', 'speichern', 'pruefen', 'bibliothek', 'wissen', 'assistent'] as const;

function Kurzanleitung() {
  const ref = useTitel('kurz');
  const d = appDaten();
  return (
    <div class="inhalt hilfe-seite" id="hilfe">
      <Seitenkopf titel={tr('hilfe.kurzanleitung')} titelRef={ref} aktion={<DruckAktion />} />
      <Hinweis als="p" klasse="datenschutz">{t('start.datenschutz')}</Hinweis>
      <div class="hilfe-raster">
        {ABSCHNITTE.map((a) => (
          <section class="karte" key={a} aria-labelledby={`hilfe-${a}`}>
            <h2 id={`hilfe-${a}`}>{tr(`hilfe.${a}.titel`)}</h2>
            <p>{tr(`hilfe.${a}.text`)}</p>
          </section>
        ))}
      </div>
      <section class="karte" aria-labelledby="hilfe-ueber">
        <h2 id="hilfe-ueber">{t('navi.ueber')}</h2>
        <p><strong>{t('kopf.namensnennung')}</strong></p>
        <p class="zweitext">{t('ueber.version', { version: d.version, gebaut: d.gebaut })}</p>
        <p class="leiste">
          <a class="knopf" href={routeZuHash({ art: 'hilfe', unter: 'tasten' })}>{tr('hilfe.tasten')}</a>
          <a class="knopf" href={routeZuHash({ art: 'ueber' })}>{t('navi.ueber')}</a>
        </p>
      </section>
    </div>
  );
}

function Tasten() {
  const ref = useTitel('tasten');
  // N1 (Prüfung test.9): Pfeiltaste als Symbol mit Namen für Bildschirmleser
  const Taste = ({ name }: { name: string }) => <><Symbol name={name} klasse="sym sym-text" /><span class="nur-sr">{t(`symbol.${name.replace('-', '_')}`)}</span></>;
  // A-24: Pfeile als Symbol, «←» und «→» fehlen in der eingebetteten Inter
  const zeilen: [ComponentChildren, string][] = [
    ['/', tr('tasten.suche')],
    ['Ctrl + S, Cmd + S', tr('tasten.speichern')],
    ['Ctrl + Shift + S', tr('tasten.speichern_unter')],
    ['Ctrl + O', tr('tasten.oeffnen')],
    ['Alt + P', tr('tasten.pruefung')],
    [<>Alt + Shift + <Taste name="pfeil-links" /></>, tr('tasten.zurueck')],
    [<><Taste name="pfeil-hoch" /> <Taste name="pfeil-runter" /> <Taste name="pfeil-links" /> <Taste name="pfeil-rechts" /></>, tr('tasten.leiste')],
    ['Esc', tr('tasten.escape')],
  ];
  return (
    <div class="inhalt hilfe-seite" id="tastenkuerzel">
      <Seitenkopf titel={tr('hilfe.tasten')} titelRef={ref} aktion={<DruckAktion />} />
      <section class="karte" aria-labelledby="tasten-allgemein">
        <h2 id="tasten-allgemein">{tr('tasten.allgemein')}</h2>
        <div class="tabelle-feld">
          <table class="tabelle">
            <thead><tr><th scope="col">{tr('tasten.taste')}</th><th scope="col">{tr('tasten.wirkung')}</th></tr></thead>
            <tbody>{zeilen.map(([k, w]) => <tr key={w}><td><kbd>{k}</kbd></td><td>{w}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section class="karte" aria-labelledby="tasten-bereiche">
        <h2 id="tasten-bereiche">{tr('tasten.bereiche')}</h2>
        <p class="zweitext">{tr('tasten.bereiche_text')}</p>
        <div class="tabelle-feld">
          <table class="tabelle">
            <thead><tr><th scope="col">{tr('tasten.taste')}</th><th scope="col">{tr('tasten.bereich')}</th></tr></thead>
            <tbody>{BEREICHE.map((b) => <tr key={b.id}><td><kbd>g</kbd> <kbd>{b.taste}</kbd></td><td>{bereichTitel(b.id)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function Hilfe({ unter }: { unter?: 'tasten' }) {
  return unter === 'tasten' ? <Tasten /> : <Kurzanleitung />;
}

export function Hinweise({ p }: { p: Projekt }) {
  const ref = useTitel('hinweise');
  const liste = faelligListe.value;
  const stand = appDaten().kataloge['aiact_stand'] as { geprueft_am?: string } | undefined;
  return (
    <div class="inhalt hinweise-seite" id="hinweise">
      <Seitenkopf titel={tr('bereich.hinweise')} titelRef={ref} aktion={<DruckAktion />} />
      <p class="zweitext">{tr('hinweise.text', { name: p.organisation.name || t('kopf.ohne_name') })}</p>
      <section class="karte" aria-labelledby="hinweise-faellig">
        <div class="karte-kopf">
          <h2 id="hinweise-faellig">{tr('uebersicht.faellig')}</h2>
          {liste.length > 0 && <a href={routeZuHash({ art: 'uebersicht', unter: 'faellig' })}>{tr('start.alle_faelligen', { anzahl: liste.length })}</a>}
        </div>
        <FaelligTabelle liste={liste} max={8} />
      </section>
      <section class="karte" aria-labelledby="hinweise-pruefung">
        <div class="karte-kopf">
          <h2 id="hinweise-pruefung">{tr('pruefung.regeln')}</h2>
          <a href={routeZuHash({ art: 'pruefung' })}>{t('uebersicht.zur_pruefung')}</a>
        </div>
        <AmpelAnzeige liste={befunde.value} />
      </section>
      <section class="karte" aria-labelledby="hinweise-recht">
        <h2 id="hinweise-recht">{tr('hinweise.rechtsstand')}</h2>
        <p>{tr('hinweise.aiact_stand', { fassung: datumText(aiActStand()), geprueft: datumText(stand?.geprueft_am ?? '') })}</p>
        <p><a href={routeZuHash({ art: 'wissen', unter: 'regelwerk', id: 'aiact' })}>{tr('wissen.zum_aiact')}</a></p>
      </section>
    </div>
  );
}

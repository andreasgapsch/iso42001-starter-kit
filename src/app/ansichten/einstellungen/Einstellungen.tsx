// Einstellungen: Pfad, Modul EU AI Act (ausgeschaltet bleiben die Daten erhalten), Sprachen, Theme, Dokumentgestaltung
// (Unterseite, Gestaltung.tsx), Normtexte aus der eigenen Normausgabe (Normtexte.tsx), Zwischenspeicher (unverschlüsselt, befristet,
// abschaltbar, leerbar, AF-032).
// Über: Namensnennung, Version, Lizenzen, Haftungsausschluss.
import { useEffect, useRef, useState } from 'preact/hooks';
import { lokalSchreiben } from '../../lokal.ts';
import oflInter from '../../schriften/OFL-Inter.txt?raw';
import { herunterladen } from '../../worker/client.ts';
import type { Projekt, Sprache } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { setzeUiSprache, t, uiSprache } from '../../i18n.ts';

import { GestaltungStand } from './Gestaltung.tsx';
import { Normtexte } from './Normtexte.tsx';
import { routeZuHash, type EinstellungenBereich } from '../../logik/routen.ts';
import { tr } from '../../rahmen/text.ts';
import { AUFBEWAHRUNG_TAGE } from '../../speicher/projekt-speicher.ts';
import { aendereMit, browserspeicherLeeren, holeSpeicher, melde, projekt, setzeTheme, theme, zwischenspeicherArt, type Theme } from '../../zustand/store.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { zweiterKlick } from '../../ui/beschaeftigt.ts';

function useTitel(schluessel = '') {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [schluessel]);
  return ref;
}

/** Abschnitt Projekt und Module (Pfad, Module EU AI Act und NIST AI RMF, Dokumentsprache) */
function ProjektUndModule({ p }: { p: Projekt }) {
  const setzeMeta = (f: (p: Projekt) => void) => aendereMit((e) => void f(e));
  return (
    <section class="karte" id="einstellungen-projekt">
      <h2>{tr('einstellungen.projekt')}</h2>
      <fieldset class="feld">
        <legend>{t('einstellungen.pfad')}</legend>
        <p class="feldhilfe">{t('einstellungen.pfad_hilfe')}</p>
        <div class="optionen">
          {(['zertifiziert', 'vorhanden', 'nein'] as const).map((w) => (
            <label key={w}>
              <input type="radio" name="e-isms" checked={(p.meta.mitIsms ? (p.meta.ismsZertifiziert ? 'zertifiziert' : 'vorhanden') : 'nein') === w} onChange={() => setzeMeta((e) => {
                e.meta.mitIsms = w !== 'nein';
                e.meta.ismsZertifiziert = w === 'zertifiziert';
                e.meta.gefuehrt.antworten['isms'] = w;
              })} />
              <span>{t(`start.isms_${w}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset class="feld">
        <legend>{t('einstellungen.modul')}</legend>
        <p class="feldhilfe">{t('einstellungen.modul_hilfe')}</p>
        <label class="check">
          <input type="checkbox" id="modul-aiact" checked={p.meta.modulAiAct} onChange={(ev) => {
            const an = ev.currentTarget.checked;
            setzeMeta((e) => void (e.meta.modulAiAct = an));
            if (an) melde(t('einstellungen.modul_an'), 'info');
          }} />
          <span>{t('einstellungen.modul_label')}</span>
        </label>
      </fieldset>
      <fieldset class="feld">
        <legend>{t('einstellungen.modul_nist')}</legend>
        <p class="feldhilfe">{t('einstellungen.modul_nist_hilfe')}</p>
        <label class="check">
          <input type="checkbox" id="modul-nist" checked={p.meta.modulNistRmf === true} onChange={(ev) => {
            const an = ev.currentTarget.checked;
            setzeMeta((e) => void (e.meta.modulNistRmf = an));
          }} />
          <span>{t('einstellungen.modul_nist_label')}</span>
        </label>
      </fieldset>
      <div class="feld">
        <label for="e-dok">{t('einstellungen.dokumentsprache')}</label>
        <Auswahl id="e-dok" class="schmal" value={p.meta.dokumentSprache} onChange={(ev) => {
          const s = ev.currentTarget.value as Sprache;
          setzeMeta((e) => void (e.meta.dokumentSprache = s));
        }}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </Auswahl>
      </div>
    </section>
  );
}

/** Abschnitt Sprache und Darstellung (Oberfläche DE/EN; dunkel, hell oder wie System) */
function SpracheUndDarstellung() {
  return (
    <section class="karte" id="einstellungen-darstellung">
      <h2>{tr('einstellungen.darstellung')}</h2>
      <div class="feld">
        <label for="e-ui">{t('einstellungen.uisprache')}</label>
        <Auswahl id="e-ui" class="schmal" value={uiSprache.value} onChange={(e) => setzeUiSprache(e.currentTarget.value as Sprache)}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </Auswahl>
      </div>
      <div class="feld">
        <label for="e-theme">{t('einstellungen.theme')}</label>
        <p class="feldhilfe" id="e-theme-hilfe">{tr('einstellungen.theme_hilfe')}</p>
        <Auswahl id="e-theme" class="schmal" aria-describedby="e-theme-hilfe" value={theme.value} onChange={(e) => setzeTheme(e.currentTarget.value as Theme)}>
          <option value="dunkel">{t('theme.dunkel')}</option>
          <option value="hell">{t('theme.hell')}</option>
          <option value="system">{t('theme.system')}</option>
        </Auswahl>
      </div>
    </section>
  );
}

/** Abschnitt Gestaltung der Dokumente: Stand und Weg zur Unterseite */
function GestaltungKarte({ p }: { p: Projekt }) {
  return (
    <section class="karte" id="einstellungen-gestaltung">
      <h2>{t('gestaltung.titel')}</h2>
      <p>{t('gestaltung.karte_text')}</p>
      <GestaltungStand p={p} />
      <p><a class="knopf" href={routeZuHash({ art: 'einstellungen', bereich: 'gestaltung' })} id="gestaltung-oeffnen">{t('gestaltung.oeffnen')}</a></p>
    </section>
  );
}

/** Abschnitt Speicher und Bibliotheksordner: Zwischenspeicher im Browser, Verweis auf die Bibliothek */
function Speicher() {
  const p = projekt.value;
  const [zwischenAus, setZwischenAus] = useState(holeSpeicher().ohneZwischenspeicher);
  const leeren = async () => {
    if (!(await bestaetigen({ text: t('einstellungen.leeren_frage'), titel: t('bestaetigen.titel_speicher_leeren'), ja: t('bestaetigen.speicher_leeren'), gefahr: true }))) return;
    // Alle Schlüssel: Zwischenstände (mit Projekt und Logo) und Normpaket (AF-032)
    const r = await browserspeicherLeeren();
    melde(t('einstellungen.geleert', { anzahl: r.zwischenstaende, normpaket: r.normpaket }), 'ok');
  };
  return (
    <>
      <section class="karte" id="einstellungen-speicher">
        <h2>{t('einstellungen.zwischenspeicher')}</h2>
        <p>{t('einstellungen.zwischenspeicher_text', { art: t(`einstellungen.ablage_${zwischenspeicherArt.value || 'speicher'}`) })}</p>
        <p class="zweitext">{t('einstellungen.zwischenspeicher_datenschutz', { tage: AUFBEWAHRUNG_TAGE })}</p>
        <label class="check">
          <input type="checkbox" id="zwischenspeicher-aus" checked={holeSpeicher().ohneZwischenspeicher} onChange={(e) => {
            const aus = e.currentTarget.checked;
            holeSpeicher().ohneZwischenspeicher = aus;
            lokalSchreiben('zwischenspeicher', aus ? 'aus' : 'an');
            setZwischenAus(aus);
          }} />
          <span>{t('einstellungen.zwischenspeicher_aus')}</span>
        </label>
        {zwischenAus && <Hinweis als="p" role="status">{t('einstellungen.zwischenspeicher_aus_hinweis')}</Hinweis>}
        <button type="button" onClick={() => void leeren()}>{t('einstellungen.leeren')}</button>
      </section>
      <section class="karte" id="einstellungen-bibliothek">
        <h2>{tr('einstellungen.bibliothek_titel')}</h2>
        <p>{tr('einstellungen.bibliothek_text')}</p>
        <p class="zweitext">{tr('einstellungen.bibliothek_browser')}</p>
        {p ? <p><a class="knopf" href={routeZuHash({ art: 'bibliothek' })} id="einstellungen-zur-bibliothek">{tr('einstellungen.zur_bibliothek')}</a></p> : <p class="zweitext">{tr('einstellungen.bibliothek_ohne_projekt')}</p>}
      </section>
    </>
  );
}

/** Einstellungen: ohne Bereich alle Abschnitte, sonst der gewählte (Untermenü der Einstellungen) */
export function Einstellungen({ bereich }: { bereich?: EinstellungenBereich } = {}) {
  const p = projekt.value;
  const ref = useTitel(bereich);
  const titel = bereich ? tr(`einstellungen.${bereich}`) : t('einstellungen.titel');
  const ohneProjekt = <Hinweis als="p">{tr('einstellungen.ohne_projekt')}</Hinweis>;
  return (
    <div class={`inhalt einstellungen${bereich ? ' einzeln' : ''}`}>
      <Seitenkopf titel={titel} titelRef={ref} speichernAlsAktion />
      {(!bereich || bereich === 'projekt') && (p ? <ProjektUndModule p={p} /> : bereich === 'projekt' && ohneProjekt)}
      {(!bereich || bereich === 'darstellung') && <SpracheUndDarstellung />}
      {!bereich && p && <GestaltungKarte p={p} />}
      {(!bereich || bereich === 'normtexte') && <Normtexte />}
      {(!bereich || bereich === 'speicher') && <Speicher />}
    </div>
  );
}

/** Eingebettete Schriften (SIL OFL 1.1): Lizenztext gehört zur Schrift und reist mit der Datei. */
const SCHRIFTEN = [{ name: 'Inter', datei: 'OFL-Inter.txt', text: oflInter }];

export function Ueber() {
  const ref = useTitel();
  const d = appDaten();
  return (
    <div class="inhalt">
      <Seitenkopf titel={t('ueber.titel')} titelRef={ref} aktion={<DruckAktion />} />
      <section class="karte">
        <p><strong>{t('kopf.namensnennung')}</strong></p>
        <p>{t('ueber.version', { version: d.version, gebaut: d.gebaut })}</p>
        <p>{t('ueber.text')}</p>
      </section>
      <section class="karte">
        <h2>{t('ueber.lizenz_titel')}</h2>
        <p>{t('ueber.lizenz')}</p>
        {d.lizenzen?.length ? (
          <ul>{d.lizenzen.map((l) => <li key={l.name}>{l.name} {l.version} ({l.lizenz})</li>)}</ul>
        ) : null}
      </section>
      <section class="karte" id="schriften">
        <h2>{t('ueber.schriften_titel')}</h2>
        <p>{t('ueber.schriften')}</p>
        <p class="leiste">
          {SCHRIFTEN.map((s) => (
            <button type="button" class="klein" key={s.name} onClick={(ev) => !zweiterKlick(ev) && herunterladen(s.text, s.datei, 'text/plain;charset=utf-8')}>{t('ueber.schriften_lizenz', { schrift: s.name })}</button>
          ))}
        </p>
      </section>
      <section class="karte">
        <h2>{t('ueber.haftung_titel')}</h2>
        <p>{t('ueber.haftung')}</p>
        <p>{t('ueber.norm')}</p>
      </section>
    </div>
  );
}

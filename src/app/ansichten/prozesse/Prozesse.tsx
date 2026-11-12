// Bereich «Prozesse»: Status-Dashboard (Reife, Eigner, fällige Durchführungen, Kennzahlen, offene Massnahmen), Liste nach
// Gruppen mit Filter nach Art und Verbindlichkeit oder Prozesslandkarte (Kacheln nach Gruppen, eingefärbt nach Reife),
// eigene Prozesse der Firma (PE-01 ff.) anlegen, bearbeiten und löschen, Detailseite je Prozess mit Ablauf (eigener
// SVG-Renderer und Schritt-Tabelle), Bahnen ohne Rolle zuordnen, Beschreibung, Stand, Massnahmen, Prozessbeschreibung
// (D-27) und Austausch mit draw.io. Ohne ISMS zeigt die Liste die Basisprozesse des Mindestumfangs, mit ISMS nur den
// Verweis auf das ISMS.
import { fehlerVerstaendlich, technikText } from '../../worker/fehlertext.ts';
import { GRENZEN } from '../../../eingang/grenzen.ts';
import { liesBegrenzt } from '../../../eingang/lesen.ts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { EigenerProzess, Projekt, ProzessEintrag, ProzessReife, ProzessSchritt, ProzessSchrittArt } from '../../../model/typen.ts';
import { ablaufVon, bahnText, prozessTexte, rollenText, sollText } from '../../../prozesse/katalog.ts';
import { prozessRaster } from '../../../prozesse/layout.ts';
import { imDashboard, prozessUebersicht, type ProzessStand } from '../../../prozesse/stand.ts';
import type { KatalogProzess, ProzessGruppe } from '../../../prozesse/typen.ts';
import { BalkenGestapelt, Kennzahl, Kennzahlen } from '../../../grafik/preact/Diagramme.tsx';
import { Prozessablauf } from '../../../grafik/preact/Prozessablauf.tsx';
import type { BalkenKategorie } from '../../../grafik/svg/balken.ts';
import { plusTage } from '../../../grafik/daten.ts';
import { datumText, dokumentTitelUi, inhalt, optionText, t } from '../../i18n.ts';
import { neuerEintrag } from '../../logik/eintraege.ts';
import {
  bahnRolleSetzen, eigenenProzessAnlegen, eigenenProzessAendern, eigenenProzessLoeschen, formenGeprueft, katalogProzesse, offeneBahnen, prozessAendern, prozesseDesProjekts, prozessFeld,
  REIFE_TON, reifeText, rollenAuswahl, schrittEntfernen, schrittHinzufuegen, staende, UI_TEXTE, vorschlaegeAusGefuehrt, vorschlaegeUebernehmen,
} from '../../logik/prozesse.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { Feld } from '../../ui/Feld.tsx';
import { drawioExportieren, drawioLesen, erzeugeSet, herunterladen, type DrawioVorschau } from '../../worker/client.ts';
import { aendereMit, heute, melde, navigiere, stichtag as stichtagSignal } from '../../zustand/store.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { LoeschKnopf } from '../../ui/Loeschen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { Symbol } from '../../rahmen/symbole.tsx';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { unbesetzteProzessrollen } from '../../../regeln/stimmigkeit.ts';
import { appDaten } from '../../daten.ts';
import { useBeschaeftigt, zweiterKlick } from '../../ui/beschaeftigt.ts';
import { mimeVon } from '../../../bibliothek/layout.ts';

const GRUPPEN: ProzessGruppe[] = ['fuehrung', 'kern', 'unterstuetzung', 'bewertung'];
const ARTEN: ProzessSchrittArt[] = ['start', 'aufgabe', 'entscheidung', 'ende'];
const PROZESS_ARTEN = ['gemeinsam', 'gemeinsam-ki', 'nur-aims', 'nur-isms'] as const;

function personName(p: Projekt, id: string | undefined): string {
  const x = p.personen.find((y) => y.id === id);
  return x ? x.name || x.id : (id ?? '');
}

/** Reife als neutrale Skala (U-17): Wort und Füllgrad, keine Warnfarbe; Warnzeichen nur für echte Hinweise */
export function ReifePille({ reife }: { reife: ProzessReife }) {
  return <StatusPille art="neutral" form="reife" data-reife={reife}>{reifeText(reife)}</StatusPille>;
}

function reifeKategorien(): BalkenKategorie<string>[] {
  return [
    { schluessel: '0', text: reifeText(0), ton: 'leer' },
    { schluessel: '1', text: reifeText(1), ton: 'neutral' },
    { schluessel: '2', text: reifeText(2), ton: 'info', muster: true },
    { schluessel: '3', text: reifeText(3), ton: 'gut' },
    { schluessel: '4', text: reifeText(4), ton: 'gut', muster: true },
  ];
}

/** Titel in der Sprache der Oberfläche; eigene Prozesse aus dem Projekt */
const titelVon = (p: Projekt, id: string) => prozessTexte(UI_TEXTE, id, p)?.titel ?? id;

/** Status-Dashboard (Liste und Lagebild): Reife, ohne Eigner, fällig, Kennzahlen, offene Massnahmen */
export function ProzessDashboard({ p, liste, stichtag, kompakt }: { p: Projekt; liste: readonly ProzessStand[]; stichtag: string; kompakt?: boolean }) {
  const u = prozessUebersicht(liste);
  const bald = plusTage(stichtag, 30);
  const faellig = liste
    .filter((s) => imDashboard(s) && s.naechsteFaelligkeit && s.naechsteFaelligkeit <= bald)
    .sort((a, b) => a.naechsteFaelligkeit!.localeCompare(b.naechsteFaelligkeit!));
  const link = (id: string) => routeZuHash({ art: 'prozesse', id });
  return (
    <div class="prozess-dashboard" id={kompakt ? 'lb-prozesse-dashboard' : 'prozesse-dashboard'}>
      <BalkenGestapelt
        id={kompakt ? 'lb-prozesse-reife' : 'prozesse-reife'}
        beschriftung={t('prozesse.reife_verteilung')}
        kategorien={reifeKategorien()}
        zeilen={[{ titel: t('prozesse.reife_zeile'), werte: Object.fromEntries(u.reife.map((n, i) => [String(i), n])), summe: String(u.gesamt) }]}
        zusammen={(n) => t('grafik.zusammen', { anzahl: n })}
      />
      {!kompakt && (
        <Kennzahlen beschriftung={t('prozesse.kennzahlen')}>
          <Kennzahl id="pz-ohne-eigner" beschriftung={t('prozesse.ohne_eigner')} wert={u.ohneEigner.length} text={u.ohneEigner.length ? u.ohneEigner.join(', ') : t('prozesse.alle_mit_eigner')} />
          <Kennzahl id="pz-ueberfaellig" beschriftung={t('prozesse.ueberfaellig')} wert={u.ueberfaellig.length} text={t('prozesse.ueberfaellig_text')} />
          <Kennzahl id="pz-kennzahlen" beschriftung={t('prozesse.kennzahlen_aktuell')} wert={u.kennzahlenAktuell} einheit={`/ ${u.gesamt}`} text={t('prozesse.kennzahlen_text')} />
          <Kennzahl id="pz-massnahmen" beschriftung={t('prozesse.massnahmen_offen')} wert={u.massnahmenOffen} href={routeZuHash({ art: 'formular', modul: 'massnahmen' })} text={t('prozesse.massnahmen_ueberfaellig', { anzahl: u.massnahmenUeberfaellig })} />
        </Kennzahlen>
      )}
      {kompakt && (
        <p class="zweitext" id="lb-prozesse-zahlen">
          {t('prozesse.kurz', { ohne: u.ohneEigner.length, ueberfaellig: u.ueberfaellig.length, massnahmen: u.massnahmenOffen })}
        </p>
      )}
      <h3 class="klein">{t('prozesse.faellig_titel')}</h3>
      {faellig.length === 0 ? (
        <p class="zweitext">{t('prozesse.nichts_faellig')}</p>
      ) : (
        <ul class="lb-liste" id={kompakt ? 'lb-prozesse-faellig' : 'prozesse-faellig'}>
          {faellig.slice(0, kompakt ? 5 : 12).map((s) => (
            <li key={s.id} data-ueberfaellig={s.ueberfaellig ? '1' : undefined}>
              <span class="datum">{datumText(s.naechsteFaelligkeit)}</span>
              <a href={link(s.id)}>{s.id}</a> {titelVon(p, s.id)}
              {s.ueberfaellig && <> <StatusPille art="kritisch">{t('prozesse.ueberfaellig_wort')}</StatusPille></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Liste

/** Prozesslandkarte: Gruppen als Zeilen, Prozesse als Kacheln mit Reife als Farbe (feste Skala) und als Wort; Klick führt zur Detailseite */
function Landkarte({ p, liste }: { p: Projekt; liste: readonly ProzessStand[] }) {
  return (
    <section class="karte abschnitt prozess-landkarte" aria-labelledby="prozesse-landkarte-titel" id="prozesse-landkarte">
      <h2 id="prozesse-landkarte-titel">{t('prozesse.landkarte_titel')}</h2>
      <p class="zweitext">{t('prozesse.landkarte_text')}</p>
      <ul class="prozess-reife-legende" id="prozesse-landkarte-legende" aria-label={t('prozesse.landkarte_legende')}>
        {[0, 1, 2, 3, 4].map((r) => (
          <li key={r} data-reife={r}><span class="prozess-reife-muster" aria-hidden="true" />{reifeText(r)}</li>
        ))}
      </ul>
      {GRUPPEN.map((g) => {
        const l = liste.filter((s) => s.gruppe === g);
        if (!l.length) return null;
        return (
          <div key={g} class="prozess-karte-gruppe" data-gruppe={g}>
            <h3 id={`prozesse-karte-${g}`}>{inhalt(`prozesse.gruppen.${g}`)}</h3>
            <ul class="prozess-kacheln" aria-labelledby={`prozesse-karte-${g}`}>
              {l.map((s) => (
                <li key={s.id}>
                  <a class="prozess-kachel" href={routeZuHash({ art: 'prozesse', id: s.id })} data-prozess={s.id} data-reife={s.reife}>
                    <span class="prozess-kachel-kopf">
                      <span class="marke-id">{s.id}</span>
                      {s.katalog.eigen && <StatusPille art="neutral">{inhalt('prozesse.pflichtarten.eigen')}</StatusPille>}
                      {s.sicht === 'minimal' && <StatusPille art="info">{inhalt('prozesse.ohne_isms.minimal')}</StatusPille>}
                    </span>
                    <span class="prozess-kachel-titel">{titelVon(p, s.id)}</span>
                    <span class="prozess-marken">
                      <ReifePille reife={s.reife} />
                      {s.ueberfaellig && <StatusPille art="kritisch">{t('prozesse.ueberfaellig_wort')}</StatusPille>}
                      {!s.eigner && <StatusPille art="warnung">{t('prozesse.kein_eigner')}</StatusPille>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** Dialog «Eigenen Prozess anlegen»: Titel, Zweck, Gruppe, Art und Bahnen (Rollen); danach Detailseite mit Ablauf zum Ausbauen */
function NeuerProzessDialog({ schliessen }: { schliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  const [titel, setTitel] = useState('');
  const [zweck, setZweck] = useState('');
  const [gruppe, setGruppe] = useState<ProzessGruppe>('kern');
  const [art, setArt] = useState<EigenerProzess['art']>('nur-aims');
  const [bahnen, setBahnen] = useState<string[]>(['aims']);
  const [fehlt, setFehlt] = useState(false);
  const rollen = rollenAuswahl();
  const anlegen = () => {
    if (!titel.trim()) {
      setFehlt(true);
      return;
    }
    const id = eigenenProzessAnlegen({ titel: titel.trim(), ...(zweck.trim() ? { zweck: zweck.trim() } : {}), gruppe, art }, bahnen);
    melde(t('prozesse.eigen_angelegt', { id }), 'ok');
    ref.current?.close();
    navigiere({ art: 'prozesse', id });
  };
  return (
    <dialog ref={ref} onClose={schliessen} aria-labelledby="prozess-neu-titel" id="prozess-neu-dialog">
      <h2 id="prozess-neu-titel">{t('prozesse.eigen_neu_titel')}</h2>
      <p class="zweitext">{t('prozesse.eigen_neu_text')}</p>
      <div class={`feld${fehlt ? ' fehlt' : ''}`}>
        <label for="prozess-neu-name">{t('prozesse.eigen_titel')} <span class="pflicht">{t('feld.pflicht_wort')}</span></label>
        <input id="prozess-neu-name" type="text" maxLength={160} value={titel} aria-required="true" aria-invalid={fehlt ? 'true' : undefined} aria-describedby={fehlt ? 'prozess-neu-name-fehlt' : undefined}
          onInput={(e) => { setTitel(e.currentTarget.value); setFehlt(false); }} />
        {fehlt && <p class="fehltext" id="prozess-neu-name-fehlt" role="alert">{t('prozesse.eigen_titel_fehlt')}</p>}
      </div>
      <div class="feld">
        <label for="prozess-neu-zweck">{t('prozesse.eigen_zweck')}</label>
        <textarea id="prozess-neu-zweck" rows={2} value={zweck} onInput={(e) => setZweck(e.currentTarget.value)} />
      </div>
      <div class="feld">
        <label for="prozess-neu-gruppe">{t('prozesse.eigen_gruppe')}</label>
        <Auswahl id="prozess-neu-gruppe" value={gruppe} onChange={(e) => setGruppe(e.currentTarget.value as ProzessGruppe)}>
          {GRUPPEN.map((g) => <option key={g} value={g}>{inhalt(`prozesse.gruppen.${g}`)}</option>)}
        </Auswahl>
      </div>
      <div class="feld">
        <label for="prozess-neu-art">{t('prozesse.art')}</label>
        <Auswahl id="prozess-neu-art" value={art} aria-describedby="prozess-neu-art-hilfe" onChange={(e) => setArt(e.currentTarget.value as EigenerProzess['art'])}>
          {PROZESS_ARTEN.map((x) => <option key={x} value={x}>{inhalt(`prozesse.arten.${x}`)}</option>)}
        </Auswahl>
        <p class="feldhilfe" id="prozess-neu-art-hilfe">{inhalt(`prozesse.arten_hilfe.${art}`)}</p>
      </div>
      <fieldset class="feld" id="prozess-neu-bahnen">
        <legend>{t('prozesse.eigen_bahnen')}</legend>
        <p class="feldhilfe">{t('prozesse.eigen_bahnen_hilfe')}</p>
        <div class="prozess-rollen-wahl">
          {rollen.map((r) => (
            <label key={r.schluessel} class="check">
              <input type="checkbox" value={r.schluessel} checked={bahnen.includes(r.schluessel)} onChange={(e) => {
                const an = e.currentTarget.checked;
                setBahnen(an ? [...bahnen, r.schluessel] : bahnen.filter((x) => x !== r.schluessel));
              }} />
              <span>{r.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div class="leiste ende">
        <button type="button" onClick={() => ref.current?.close()}>{t('allgemein.abbrechen')}</button>
        <button type="button" class="primaer" id="prozess-neu-anlegen" onClick={anlegen}>{t('prozesse.eigen_anlegen')}</button>
      </div>
    </dialog>
  );
}

function Liste({ p, filter }: { p: Projekt; filter?: Record<string, string> }) {
  const stichtag = stichtagSignal.value;
  const alle = staende(p, stichtag);
  const art = filter?.['art'] ?? '';
  const pflicht = filter?.['pflicht'] ?? '';
  const karte = filter?.['ansicht'] === 'karte';
  // Untermenü Prozesse: «Status» zeigt nur das Status-Dashboard, Gruppen filtern die Liste (rc.10)
  const nurStatus = filter?.['ansicht'] === 'status';
  const gruppe = filter?.['gruppe'] ?? '';
  const [neu, setNeu] = useState(false);
  const passt = (s: ProzessStand) => (!art || s.katalog.art === art) && (!pflicht || s.katalog.pflicht === pflicht) && (!gruppe || s.gruppe === gruppe);
  const setzeFilter = (k: string, v: string) => navigiere({ art: 'prozesse', filter: Object.fromEntries(Object.entries({ ...(filter ?? {}), [k]: v }).filter(([, w]) => w)) });
  const vorschlaege = vorschlaegeAusGefuehrt(p);
  const mitIsms = p.meta.mitIsms;
  const haupt = alle.filter((s) => (s.sicht === 'aims' || s.sicht === 'minimal') && passt(s));
  const empfohlen = alle.filter((s) => s.sicht === 'empfohlen' && passt(s));
  const verweise = alle.filter((s) => s.sicht === 'verweis' && passt(s));
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => h1.current?.focus(), []);

  const zeile = (s: ProzessStand) => (
    <tr key={s.id} data-prozess={s.id} data-anwendbar={s.anwendbar}>
      <th scope="row" class="k-id"><a href={routeZuHash({ art: 'prozesse', id: s.id })} class="marke-id">{s.id}</a></th>
      <td class="k-titel">
        <a href={routeZuHash({ art: 'prozesse', id: s.id })}>{titelVon(p, s.id)}</a>
        {s.sicht === 'minimal' && <> <StatusPille art="info">{inhalt('prozesse.ohne_isms.minimal')}</StatusPille></>}
        {s.anwendbar === 'nein' && <> <StatusPille art="neutral">{t('prozesse.nicht_anwendbar')}</StatusPille></>}
      </td>
      <td data-label={t('prozesse.art')}>{inhalt(`prozesse.arten.${s.katalog.art}`)}</td>
      <td data-label={t('prozesse.verbindlichkeit')}>{inhalt(`prozesse.pflichtarten.${s.katalog.pflicht}`)}</td>
      <td data-label={t('prozesse.eigner')}>{s.eigner ? personName(p, s.eigner) : <StatusPille art="warnung">{t('prozesse.kein_eigner')}</StatusPille>}{s.eigner && s.eignerQuelle === 'rolle' && <span class="zweitext"> ({t('prozesse.vorschlag')})</span>}</td>
      <td class="k-status"><span class="nur-sr">{t('prozesse.reife')}: </span><ReifePille reife={s.reife} /></td>
      <td data-label={t('prozesse.naechste')}>{s.naechsteFaelligkeit ? datumText(s.naechsteFaelligkeit) : s.rhythmus ? t('prozesse.offen') : (inhalt('prozesse.felder.ereignis') ?? '')}{s.ueberfaellig && <> <StatusPille art="kritisch">{t('prozesse.ueberfaellig_wort')}</StatusPille></>}</td>
      <td class="zahl" data-label={t('prozesse.massnahmen')}>{s.massnahmenOffen.length || ''}</td>
    </tr>
  );
  const tabelle = (liste: ProzessStand[], id: string) => (
    <div class="tabelle-feld" id={id}>
      <table class="kartenliste" data-liste="prozesse">
        <thead>
          <tr>
            <th scope="col">{t('liste.id')}</th><th scope="col">{t('prozesse.prozess')}</th><th scope="col">{t('prozesse.art')}</th><th scope="col">{t('prozesse.verbindlichkeit')}</th>
            <th scope="col">{t('prozesse.eigner')}</th><th scope="col">{t('prozesse.reife')}</th><th scope="col">{t('prozesse.naechste')}</th><th scope="col" class="zahl">{t('prozesse.massnahmen')}</th>
          </tr>
        </thead>
        <tbody>{liste.map(zeile)}</tbody>
      </table>
    </div>
  );

  return (
    <div class="inhalt prozesse" id="prozesse">
      <Seitenkopf titel={t('prozesse.titel')} titelRef={h1} aktion={<button type="button" class="primaer" id="prozesse-eigen-neu" onClick={() => setNeu(true)}><Symbol name="plus" />{t('prozesse.eigen_neu')}</button>} />
      {neu && <NeuerProzessDialog schliessen={() => setNeu(false)} />}
      <p class="zweitext">{inhalt('prozesse.hilfe')}</p>
      {p.prozesse === undefined && (
        <Hinweis id="prozesse-start" role="note">
          <p>{t('prozesse.start_text')}</p>
        </Hinweis>
      )}
      {vorschlaege.length > 0 && (
        <Hinweis id="prozesse-vorschlaege" role="note">
          <p>{t('prozesse.vorschlaege_text', { anzahl: vorschlaege.length, liste: vorschlaege.join(', ') })}</p>
          <button type="button" class="klein" id="prozesse-vorschlaege-uebernehmen" onClick={() => vorschlaegeUebernehmen(vorschlaege, heute())}>{t('prozesse.vorschlaege_uebernehmen')}</button>
        </Hinweis>
      )}
      {/* Ein Weg je Ansicht (U-12): Stand der Prozesse nur unter «Status», Liste und Landkarte über das Untermenü */}
      {nurStatus && (
        <section class="karte abschnitt" aria-labelledby="prozesse-dashboard-titel">
          <h2 id="prozesse-dashboard-titel">{t('prozesse.dashboard')}</h2>
          <p class="zweitext">{t('prozesse.dashboard_text', { datum: datumText(stichtag) })}</p>
          <ProzessDashboard p={p} liste={alle} stichtag={stichtag} />
        </section>
      )}
      {!nurStatus && <>
      <div class="leiste filterleiste kein-druck" id="prozesse-filter">
        <label>{t('prozesse.filter_art')}{' '}
          <Auswahl id="prozesse-filter-art" value={art} onChange={(e) => setzeFilter('art', e.currentTarget.value)}>
            <option value="">{t('soa.filter_alle')}</option>
            {PROZESS_ARTEN.map((x) => <option key={x} value={x}>{inhalt(`prozesse.arten.${x}`)}</option>)}
          </Auswahl>
        </label>
        <label>{t('prozesse.filter_pflicht')}{' '}
          <Auswahl id="prozesse-filter-pflicht" value={pflicht} onChange={(e) => setzeFilter('pflicht', e.currentTarget.value)}>
            <option value="">{t('soa.filter_alle')}</option>
            {['pflicht', 'control', 'bedingt', 'eigen'].map((x) => <option key={x} value={x}>{inhalt(`prozesse.pflichtarten.${x}`)}</option>)}
          </Auswahl>
        </label>
        <DrawioExportKnopf p={p} id="prozesse-drawio-export" text={t('prozesse.drawio_alle')} />
        <DrawioImportKnopf p={p} />
      </div>
      {(art || pflicht || gruppe) && <p class="zweitext" role="status">{gruppe ? `${inhalt(`prozesse.gruppen.${gruppe}`) ?? gruppe} · ` : ''}{t('soa.filter_aktiv', { anzahl: haupt.length + empfohlen.length + verweise.length, gesamt: alle.length })}</p>}
      {karte ? <Landkarte p={p} liste={haupt} /> : GRUPPEN.map((g) => {
        const liste = haupt.filter((s) => s.gruppe === g);
        if (!liste.length) return null;
        return (
          <section key={g} class="abschnitt prozess-gruppe" aria-labelledby={`prozesse-gruppe-${g}`} data-gruppe={g}>
            <h2 id={`prozesse-gruppe-${g}`}>{inhalt(`prozesse.gruppen.${g}`)}</h2>
            {tabelle(liste, `prozesse-tabelle-${g}`)}
          </section>
        );
      })}
      {mitIsms && verweise.length > 0 && (
        <section class="abschnitt" aria-labelledby="prozesse-isms" id="prozesse-isms-bereich">
          <h2 id="prozesse-isms">{t('prozesse.isms_titel')}</h2>
          <p class="zweitext">{t('prozesse.isms_text')}</p>
          <div class="tabelle-feld">
            <table class="kartenliste">
              <thead><tr><th scope="col">{t('liste.id')}</th><th scope="col">{t('prozesse.prozess')}</th><th scope="col">{t('prozesse.isms_verweis')}</th></tr></thead>
              <tbody>
                {verweise.map((s) => (
                  <tr key={s.id} data-prozess={s.id}>
                    <th scope="row" class="k-id"><a class="marke-id" href={routeZuHash({ art: 'prozesse', id: s.id })}>{s.id}</a></th>
                    <td class="k-titel">{titelVon(p, s.id)}</td>
                    <td data-label={t('prozesse.isms_verweis')}>{s.eintrag?.ismsVerweis || <StatusPille art="neutral">{t('prozesse.kein_verweis')}</StatusPille>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!mitIsms && empfohlen.length > 0 && (
        <details class="karte abschnitt" id="prozesse-empfohlen">
          <summary>{t('prozesse.empfohlen_titel', { anzahl: empfohlen.length })}</summary>
          <p class="zweitext">{inhalt('prozesse.ohne_isms.hilfe')}</p>
          {tabelle(empfohlen, 'prozesse-tabelle-empfohlen')}
        </details>
      )}
      </>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// draw.io: Export und Import (Arbeit im Generator-Worker; die App enthält keinen draw.io-Code)

async function drawioHerunterladen(p: Projekt, ids?: string[]): Promise<void> {
  try {
    const r = await drawioExportieren(p, p.meta.dokumentSprache, ids);
    herunterladen(r.text, r.name, 'application/xml');
    melde(t('prozesse.drawio_exportiert', { name: r.name }), 'ok');
  } catch (e) {
    melde(`${t('prozesse.drawio_fehler')}: ${fehlerVerstaendlich(e)}`, 'fehler');
  }
}

/** Export nach draw.io mit Zustand Beschäftigt; ein Doppelklick ergibt eine Datei (Prüfung Dokumente und Download, D2) */
function DrawioExportKnopf({ p, id, ids, text }: { p: Projekt; id: string; ids?: string[]; text: string }) {
  const [laeuft, lauf] = useBeschaeftigt();
  return <button type="button" id={id} disabled={laeuft} aria-busy={laeuft ? 'true' : undefined} onClick={(ev) => !zweiterKlick(ev) && void lauf(() => drawioHerunterladen(p, ids))}>{text}</button>;
}

function ImportDialog({ vorschau, schliessen }: { vorschau: DrawioVorschau[]; schliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  // Vorausgewählt: Seiten bekannter Prozesse; Seiten ohne Prozess nur, wenn die Datei keine bekannte Seite hat
  const bekannt = vorschau.some((v) => v.prozessId);
  const [wahl, setWahl] = useState<Set<number>>(() => new Set(vorschau.map((v, i) => (v.prozessId || (v.eigen && !bekannt) ? i : -1)).filter((i) => i >= 0)));
  const [titel, setTitel] = useState<Record<number, string>>(() => Object.fromEntries(vorschau.map((v, i) => [i, v.eigen?.titel ?? ''])));
  const erledigt = useRef(false);
  const uebernehmen = () => {
    // B5: Doppelklick übernimmt nur einmal
    if (erledigt.current) return;
    erledigt.current = true;
    const jetzt = new Date().toISOString();
    const neue: string[] = [];
    aendereMit((x) => {
      const liste = (x.prozesse ??= []);
      for (const [i, v] of vorschau.entries()) {
        if (!wahl.has(i)) continue;
        let id = v.prozessId;
        if (!id && v.eigen) {
          // Unbekanntes Diagramm als eigener Prozess. Ist die Kennung inzwischen vergeben, entfällt die Seite (erneut übernehmen).
          if (x.eigeneProzesse?.some((e) => e.id === v.eigen!.id) || liste.some((e) => e.id === v.eigen!.id)) continue;
          id = v.eigen.id;
          (x.eigeneProzesse ??= []).push({ id, titel: (titel[i] ?? '').trim() || v.seiteName.trim() || id, gruppe: 'kern', art: 'nur-aims' });
          neue.push(id);
        }
        if (!id) continue;
        let e = liste.find((y) => y.id === id);
        if (!e) liste.push((e = { id, ...(v.eigen ? { anwendbar: 'ja' as const } : {}) }));
        e.schritte = v.schritte;
        e.bahnen = v.bahnen;
        e.drawio = { roh: v.roh, hash: v.hash, importiertAm: jetzt, ...(v.datei ? { datei: v.datei } : {}), ...(v.offen.bahnen.length || v.offen.formen.length ? { offen: v.offen } : {}) };
      }
      liste.sort((a, b) => a.id.localeCompare(b.id));
    });
    melde(neue.length ? t('prozesse.import_uebernommen_eigen', { anzahl: wahl.size, liste: neue.join(', ') }) : t('prozesse.import_uebernommen', { anzahl: wahl.size }), 'ok');
    ref.current?.close();
    if (neue.length === 1 && wahl.size === 1) navigiere({ art: 'prozesse', id: neue[0]! });
  };
  return (
    <dialog ref={ref} onClose={schliessen} aria-labelledby="drawio-import-titel" id="drawio-import-dialog">
      <h2 id="drawio-import-titel">{t('prozesse.import_titel')}</h2>
      <p>{t('prozesse.import_text')}</p>
      {vorschau.map((v, i) => (
        <fieldset key={i} class="import-seite" data-seite={v.seiteId}>
          <legend>
            <label class="check">
              <input type="checkbox" disabled={!v.prozessId && !v.eigen} checked={wahl.has(i)} onChange={(e) => {
                const n = new Set(wahl);
                if (e.currentTarget.checked) n.add(i);
                else n.delete(i);
                setWahl(n);
              }} />
              <span>{v.seiteName}{v.prozessId ? ` (${v.prozessId})` : v.eigen ? ` (${t('prozesse.import_als_eigen', { id: v.eigen.id })})` : ` (${t('prozesse.import_ohne_prozess')})`}</span>
            </label>
          </legend>
          {v.eigen && (
            <div class="feld import-eigen">
              <label for={`drawio-import-titel-${i}`}>{t('prozesse.import_eigen_titel', { id: v.eigen.id })}</label>
              <input id={`drawio-import-titel-${i}`} type="text" maxLength={160} value={titel[i] ?? ''} placeholder={v.seiteName || v.eigen.id} onInput={(e) => setTitel({ ...titel, [i]: e.currentTarget.value })} />
              <p class="feldhilfe">{t('prozesse.import_eigen_hilfe')}</p>
            </div>
          )}
          <ul class="lb-liste">
            <li>{t('prozesse.import_neu', { anzahl: v.unterschied.neu.length })}{v.unterschied.neu.length ? `: ${v.unterschied.neu.join(', ')}` : ''}</li>
            <li>{t('prozesse.import_geaendert', { anzahl: v.unterschied.geaendert.length })}{v.unterschied.geaendert.length ? `: ${v.unterschied.geaendert.map((id) => { const text = v.schritte.find((s) => s.id === id)?.text; return text ? `${id} ${text.replace(/\s+/g, ' ')}` : id; }).join('; ')}` : ''}</li>
            <li>{t('prozesse.import_entfernt', { anzahl: v.unterschied.entfernt.length })}{v.unterschied.entfernt.length ? `: ${v.unterschied.entfernt.join(', ')}` : ''}</li>
            {v.offen.bahnen.length > 0 && <li><StatusPille art="warnung">{t('prozesse.import_bahnen_offen')}</StatusPille> {v.offen.bahnen.map((b) => v.bahnen.find((x) => x.id === b)?.text || b).join(', ')}</li>}
            {v.offen.formen.length > 0 && <li><StatusPille art="warnung">{t('prozesse.import_formen_offen')}</StatusPille> {v.offen.formen.join(', ')}</li>}
            {v.hinweise.map((h) => <li key={h} class="zweitext">{h}</li>)}
          </ul>
        </fieldset>
      ))}
      <p class="zweitext">{t('prozesse.import_nichts_geloescht')}</p>
      <div class="leiste ende">
        <button type="button" onClick={() => ref.current?.close()}>{t('allgemein.abbrechen')}</button>
        <button type="button" class="primaer" id="drawio-import-uebernehmen" disabled={wahl.size === 0} onClick={uebernehmen}>{t('prozesse.import_uebernehmen')}</button>
      </div>
    </dialog>
  );
}

function DrawioImportKnopf({ p, prozessId }: { p: Projekt; prozessId?: string }) {
  const [vorschau, setVorschau] = useState<DrawioVorschau[] | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  // V-05, B5: Beschäftigt (aria-busy, gesperrt), solange der Worker die Datei liest
  const [liest, setLiest] = useState(false);
  const sperre = useRef(false);
  const id = `drawio-datei${prozessId ? `-${prozessId}` : ''}`;
  return (
    <>
      <button type="button" id={`${id}-waehlen`} disabled={liest} aria-busy={liest ? 'true' : undefined} onClick={() => !sperre.current && eingabe.current?.click()}>{t('prozesse.drawio_import')}</button>
      <input ref={eingabe} type="file" id={id} class="nur-sr" tabIndex={-1} aria-label={t('prozesse.drawio_import')} accept=".drawio,.xml,.svg" onChange={async (e) => {
        const f = e.currentTarget.files?.[0];
        e.currentTarget.value = '';
        if (!f) return;
        if (f.size > GRENZEN.drawio.maxBytes) {
          melde(t('prozesse.import_zu_gross'), 'fehler');
          return;
        }
        if (sperre.current) return;
        sperre.current = true;
        setLiest(true);
        try {
          const v = await drawioLesen(p, p.meta.dokumentSprache, await liesBegrenzt(f, 'drawio'), f.name, prozessId);
          if (!v.length) melde(t('prozesse.import_leer'), 'fehler');
          else setVorschau(v);
        } catch (x) {
          const m = technikText(x);
          const code = /^drawio:([\w-]+)$/.exec(m)?.[1];
          melde(`${t('prozesse.drawio_fehler')}: ${code ? t(`prozesse.fehler.${code}`) : fehlerVerstaendlich(x)}`, 'fehler');
        } finally {
          sperre.current = false;
          setLiest(false);
        }
      }} />
      {vorschau && <ImportDialog vorschau={vorschau} schliessen={() => setVorschau(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Detail

/** Prozessbeschreibung (D-27) als Hauptaktion mit Zustand Beschäftigt; ein Doppelklick ergibt eine Datei */
function BeschreibungKnopf({ id, erzeugen }: { id: string; erzeugen: () => Promise<void> }) {
  const [laeuft, lauf] = useBeschaeftigt();
  return <button type="button" class="primaer" id={id} disabled={laeuft} aria-busy={laeuft ? 'true' : undefined} onClick={(ev) => !zweiterKlick(ev) && void lauf(erzeugen)}><Symbol name="doc" />{t('prozesse.beschreibung_docx')}</button>;
}

function SchrittTabelle({ kp, e, bearbeiten }: { kp: KatalogProzess; e: ProzessEintrag | undefined; bearbeiten: boolean }) {
  const ablauf = ablaufVon(UI_TEXTE, kp, e);
  const nummer = new Map(ablauf.schritte.map((s, i) => [s.id, i + 1]));
  const bahn = new Map(ablauf.bahnen.map((b) => [b.id, bahnText(UI_TEXTE, b)]));
  const rollen = (s: ProzessSchritt, w: string) => Object.entries(s.raci ?? {}).filter(([, x]) => x === w).map(([r]) => rollenText(UI_TEXTE, r)).join(', ');
  // Bearbeiten arbeitet auf einer Kopie des Ablaufs im Projekt (eigener Ablauf), der Katalog bleibt unverändert
  const aendern = (f: (s: ProzessSchritt[], bahnen: NonNullable<ProzessEintrag['bahnen']>) => void) =>
    prozessAendern(kp.id, (x) => {
      const basis = ablaufVon(UI_TEXTE, kp, x);
      const schritte = structuredClone(basis.schritte);
      const bahnen = structuredClone(basis.bahnen);
      f(schritte, bahnen);
      x.schritte = schritte;
      x.bahnen = bahnen;
    });
  const rollenWahl = [...new Set([...ablauf.bahnen.map((b) => b.id), ...katalogRollen(), ...rollenAuswahl().map((r) => r.schluessel)])];
  return (
    <div class="tabelle-feld prozess-schritte" id={`schritte-${kp.id}`}>
      <table>
        <caption class="nur-sr">{t('prozesse.schritte_titel')}</caption>
        <thead>
          <tr><th scope="col">{t('prozesse.nr')}</th><th scope="col">{t('prozesse.schritt')}</th><th scope="col">{t('prozesse.schrittart')}</th><th scope="col">{t('prozesse.rolle')}</th><th scope="col">{t('prozesse.wirkt_mit')}</th><th scope="col">{t('prozesse.informiert')}</th><th scope="col">{t('prozesse.weiter')}</th>{bearbeiten && <th scope="col"><span class="nur-sr">{t('prozesse.schritt_aktionen')}</span></th>}</tr>
        </thead>
        <tbody>
          {ablauf.schritte.map((s, i) => (
            <tr key={s.id} data-schritt={s.id}>
              <th scope="row">{i + 1}</th>
              <td>
                {bearbeiten ? (
                  <input type="text" aria-label={`${t('prozesse.schritt')} ${i + 1}`} value={s.text} onChange={(ev) => {
                    const v = ev.currentTarget.value;
                    aendern((liste) => (liste[i]!.text = v));
                  }} />
                ) : (
                  <>{s.text}{s.verweis?.length ? <> (<>{s.verweis.map((v, j) => <span key={v}>{j > 0 && ', '}<a href={routeZuHash({ art: 'prozesse', id: v })}>{v}</a></span>)}</>)</> : null}</>
                )}
              </td>
              <td>
                {bearbeiten ? (
                  <Auswahl aria-label={`${t('prozesse.schrittart')} ${i + 1}`} value={s.art} onChange={(ev) => {
                    const v = ev.currentTarget.value as ProzessSchrittArt;
                    aendern((liste) => (liste[i]!.art = v));
                  }}>
                    {ARTEN.map((a) => <option key={a} value={a}>{inhalt(`prozesse.schrittarten.${a}`)}</option>)}
                  </Auswahl>
                ) : (inhalt(`prozesse.schrittarten.${s.art}`) ?? s.art)}
              </td>
              <td>
                {bearbeiten ? (
                  <Auswahl aria-label={`${t('prozesse.rolle')} ${i + 1}`} value={s.bahn} onChange={(ev) => {
                    const v = ev.currentTarget.value;
                    aendern((liste, bahnen) => {
                      liste[i]!.bahn = v;
                      if (!bahnen.some((b) => b.id === v)) bahnen.push({ id: v, rolle: v });
                    });
                  }}>
                    {rollenWahl.map((r) => <option key={r} value={r}>{bahn.get(r) ?? rollenText(UI_TEXTE, r)}</option>)}
                  </Auswahl>
                ) : (bahn.get(s.bahn) ?? s.bahn)}
              </td>
              {(['C', 'I'] as const).map((w) => (
                <td key={w}>
                  {bearbeiten ? (
                    // Wirkt mit und wird informiert sind Teil des Ablaufs und im Bearbeiten wählbar (C-21)
                    <details class="raci-wahl">
                      <summary>{rollen(s, w) || t('prozesse.raci_waehlen')}</summary>
                      {rollenWahl.filter((r) => r !== s.bahn).map((r) => (
                        <label key={r} class="check">
                          <input type="checkbox" checked={s.raci?.[r] === w} onChange={(ev) => {
                            const an = ev.currentTarget.checked;
                            aendern((liste) => {
                              const raci = { ...(liste[i]!.raci ?? {}) };
                              if (an) raci[r] = w;
                              else delete raci[r];
                              liste[i]!.raci = raci;
                            });
                          }} />
                          <span>{bahn.get(r) ?? rollenText(UI_TEXTE, r)}</span>
                        </label>
                      ))}
                    </details>
                  ) : rollen(s, w)}
                </td>
              ))}
              <td>
                {bearbeiten && s.art !== 'ende' ? (
                  <input type="text" aria-label={`${t('prozesse.weiter')} ${i + 1}`} value={(s.naechste ?? []).map((z) => nummer.get(z) ?? z).join(', ')} onChange={(ev) => {
                    const nummern = ev.currentTarget.value.split(/[,;\s]+/).filter(Boolean);
                    aendern((liste) => {
                      liste[i]!.naechste = nummern.map((n) => liste[Number(n) - 1]?.id ?? n).filter((z) => liste.some((x) => x.id === z) && z !== liste[i]!.id);
                    });
                  }} />
                ) : s.art === 'entscheidung' ? (
                  (s.naechste ?? []).map((z) => `${s.zweige?.[z] ?? ''}: ${nummer.get(z) ?? z}`).join('; ')
                ) : (
                  (s.naechste ?? []).map((z) => nummer.get(z) ?? z).join(', ')
                )}
              </td>
              {bearbeiten && (
                <td class="ohne-umbruch">
                  {s.art !== 'ende' && <button type="button" class="klein leise" id={`schritt-neu-${kp.id}-${i + 1}`} onClick={() => schrittHinzufuegen(kp, i)}>{t('prozesse.schritt_einfuegen')}<span class="nur-sr"> {t('prozesse.nach_schritt', { nr: i + 1 })}</span></button>}{' '}
                  {ablauf.schritte.length > 1 && <button type="button" class="klein leise" id={`schritt-weg-${kp.id}-${i + 1}`} onClick={() => schrittEntfernen(kp, i)}>{t('prozesse.schritt_entfernen')}<span class="nur-sr"> {t('prozesse.schritt_nr', { nr: i + 1 })}</span></button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function katalogRollen(): string[] {
  const k = katalogProzesse();
  return [...new Set(k.flatMap((p) => p.schritte.map((s) => s.bahn)))].sort();
}

/** Angaben eines eigenen Prozesses (Titel, Zweck, Gruppe, Art, Normbezug) bearbeiten oder den Prozess löschen */
function EigenerProzessKarte({ p, eigen }: { p: Projekt; eigen: EigenerProzess }) {
  const id = eigen.id;
  const fid = (s: string) => `pe-${id}-${s}`;
  const [titel, setTitel] = useState(eigen.titel);
  useEffect(() => setTitel(eigen.titel), [eigen.titel]);
  // Rückfrage oder Abhängigkeitsanzeige macht LoeschKnopf (AF-009)
  const loeschen = () => {
    eigenenProzessLoeschen(id);
    melde(t('prozesse.eigen_geloescht', { id }), 'ok');
    navigiere({ art: 'prozesse' });
  };
  const massnahmen = p.massnahmen.filter((m) => m.herkunft.art === 'prozess' && (m.herkunft.ref ?? '').split(/[,;]\s*/).includes(id)).length;
  return (
    <section class="karte abschnitt" aria-labelledby={fid('titel')} id={fid('angaben')}>
      <h2 id={fid('titel')}>{t('prozesse.eigen_angaben')}</h2>
      <p class="zweitext">{inhalt('prozesse.pflichtarten_hilfe.eigen')}</p>
      <div class="feld">
        <label for={fid('name')}>{t('prozesse.eigen_titel')} <span class="pflicht">{t('feld.pflicht_wort')}</span></label>
        <input id={fid('name')} type="text" maxLength={160} value={titel} aria-required="true" onInput={(ev) => setTitel(ev.currentTarget.value)} onChange={(ev) => {
          const v = ev.currentTarget.value.trim();
          if (v) eigenenProzessAendern(id, (x) => (x.titel = v));
          else setTitel(eigen.titel);
        }} />
      </div>
      <div class="feld">
        <label for={fid('zweck')}>{t('prozesse.eigen_zweck')}</label>
        <textarea id={fid('zweck')} rows={2} value={eigen.zweck ?? ''} onChange={(ev) => {
          const v = ev.currentTarget.value.trim();
          eigenenProzessAendern(id, (x) => (x.zweck = v || undefined));
        }} />
      </div>
      <div class="feld">
        <label for={fid('gruppe')}>{t('prozesse.eigen_gruppe')}</label>
        <Auswahl id={fid('gruppe')} value={eigen.gruppe} onChange={(ev) => {
          const v = ev.currentTarget.value as ProzessGruppe;
          eigenenProzessAendern(id, (x) => (x.gruppe = v));
        }}>
          {GRUPPEN.map((g) => <option key={g} value={g}>{inhalt(`prozesse.gruppen.${g}`)}</option>)}
        </Auswahl>
      </div>
      <div class="feld">
        <label for={fid('art')}>{t('prozesse.art')}</label>
        <Auswahl id={fid('art')} value={eigen.art} onChange={(ev) => {
          const v = ev.currentTarget.value as EigenerProzess['art'];
          eigenenProzessAendern(id, (x) => (x.art = v));
        }}>
          {PROZESS_ARTEN.map((x) => <option key={x} value={x}>{inhalt(`prozesse.arten.${x}`)}</option>)}
        </Auswahl>
      </div>
      <div class="feld">
        <label for={fid('norm')}>{t('prozesse.eigen_normbezug')}</label>
        <input id={fid('norm')} type="text" value={(eigen.normbezug ?? []).join(', ')} aria-describedby={fid('norm-hilfe')} onChange={(ev) => {
          const liste = ev.currentTarget.value.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^(?:A\.)?\d+(?:\.\d+)*$/.test(x));
          eigenenProzessAendern(id, (x) => (x.normbezug = [...new Set(liste)]));
        }} />
        <p class="feldhilfe" id={fid('norm-hilfe')}>{t('prozesse.eigen_normbezug_hilfe')}</p>
      </div>
      {/* Beschreibung wie bei Katalogprozessen (D-27): Auslöser, Eingaben, Ausgaben, Dokumente, Kennzahl, Schnittstellen (H72) */}
      {(['ausloeser', 'eingaben', 'ausgaben'] as const).map((feld) => (
        <div class="feld" key={feld}>
          <label for={fid(feld)}>{t(`prozesse.eigen_${feld}`)}</label>
          <textarea id={fid(feld)} rows={3} value={(eigen[feld] ?? []).join('\n')} aria-describedby={fid('zeilen-hilfe')} onChange={(ev) => {
            const liste = ev.currentTarget.value.split('\n').map((x) => x.trim()).filter(Boolean);
            eigenenProzessAendern(id, (x) => (x[feld] = liste.length ? liste : undefined));
          }} />
        </div>
      ))}
      <p class="feldhilfe" id={fid('zeilen-hilfe')}>{t('prozesse.eigen_zeilen_hilfe')}</p>
      <div class="feld">
        <label for={fid('dokumente')}>{t('prozesse.eigen_dokumente')}</label>
        <input id={fid('dokumente')} type="text" value={(eigen.dokumente ?? []).join(', ')} aria-describedby={fid('dokumente-hilfe')} onChange={(ev) => {
          const liste = ev.currentTarget.value.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[DEN]-\d{2}(?:-EB)?$/.test(x));
          eigenenProzessAendern(id, (x) => (x.dokumente = liste.length ? [...new Set(liste)] : undefined));
        }} />
        <p class="feldhilfe" id={fid('dokumente-hilfe')}>{t('prozesse.eigen_dokumente_hilfe')}</p>
      </div>
      <fieldset class="feld">
        <legend>{t('prozesse.eigen_kennzahl')}</legend>
        <label for={fid('kz-text')}>{t('prozesse.eigen_kennzahl_text')}</label>
        <input id={fid('kz-text')} type="text" value={eigen.kennzahl?.text ?? ''} onChange={(ev) => {
          const v = ev.currentTarget.value.trim();
          eigenenProzessAendern(id, (x) => (x.kennzahl = v ? { einheit: 'prozent', richtung: 'mindestens', soll: 90, ...x.kennzahl, text: v } : undefined));
        }} />
        {eigen.kennzahl && (
          <div class="leiste">
            <label for={fid('kz-richtung')}>{t('prozesse.eigen_kennzahl_soll')}</label>
            <Auswahl id={fid('kz-richtung')} value={eigen.kennzahl.richtung} onChange={(ev) => {
              const v = ev.currentTarget.value as NonNullable<EigenerProzess['kennzahl']>['richtung'];
              eigenenProzessAendern(id, (x) => void (x.kennzahl && (x.kennzahl.richtung = v)));
            }}>
              {(['mindestens', 'hoechstens'] as const).map((r) => <option key={r} value={r}>{inhalt(`prozesse.richtungen.${r}`)}</option>)}
            </Auswahl>
            <input id={fid('kz-soll')} type="number" aria-label={t('prozesse.eigen_kennzahl_wert')} value={eigen.kennzahl.soll} onChange={(ev) => {
              const v = Number(ev.currentTarget.value);
              if (Number.isFinite(v)) eigenenProzessAendern(id, (x) => void (x.kennzahl && (x.kennzahl.soll = v)));
            }} />
            <Auswahl id={fid('kz-einheit')} aria-label={t('prozesse.eigen_kennzahl_einheit')} value={eigen.kennzahl.einheit} onChange={(ev) => {
              const v = ev.currentTarget.value as NonNullable<EigenerProzess['kennzahl']>['einheit'];
              eigenenProzessAendern(id, (x) => void (x.kennzahl && (x.kennzahl.einheit = v)));
            }}>
              {(['prozent', 'anzahl', 'tage', 'stunden', 'monate'] as const).map((x) => <option key={x} value={x}>{inhalt(`prozesse.einheiten.${x}`)}</option>)}
            </Auswahl>
          </div>
        )}
      </fieldset>
      <div class="feld">
        <label for={fid('schnittstellen')}>{t('prozesse.eigen_schnittstellen')}</label>
        <input id={fid('schnittstellen')} type="text" value={(eigen.schnittstellen ?? []).join(', ')} aria-describedby={fid('schnittstellen-hilfe')} onChange={(ev) => {
          const liste = ev.currentTarget.value.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^P[RSE]-\d{2,3}$/.test(x) && x !== id);
          eigenenProzessAendern(id, (x) => (x.schnittstellen = liste.length ? [...new Set(liste)] : undefined));
        }} />
        <p class="feldhilfe" id={fid('schnittstellen-hilfe')}>{t('prozesse.eigen_schnittstellen_hilfe')}</p>
        <label for={fid('schnittstellen-text')}>{t('prozesse.eigen_schnittstellen_text')}</label>
        <textarea id={fid('schnittstellen-text')} rows={2} value={eigen.schnittstellenText ?? ''} onChange={(ev) => {
          const v = ev.currentTarget.value.trim();
          eigenenProzessAendern(id, (x) => (x.schnittstellenText = v || undefined));
        }} />
      </div>
      <div class="leiste kein-druck">
        <LoeschKnopf liste="eigeneProzesse" id={id} knopfId={fid('loeschen')} text={t('prozesse.eigen_loeschen')} frage={t('prozesse.eigen_loeschen_frage', { id, titel: eigen.titel })} entfernen={loeschen} />
        {massnahmen > 0 && <span class="zweitext">{t('prozesse.eigen_loeschen_massnahmen', { anzahl: massnahmen })}</span>}
      </div>
    </section>
  );
}

function Detail({ p, id }: { p: Projekt; id: string }) {
  const kp = prozesseDesProjekts(p).find((x) => x.id === id);
  const h1 = useRef<HTMLHeadingElement>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  useEffect(() => h1.current?.focus(), [id]);
  if (!kp) {
    return (
      <div class="inhalt">
        <Seitenkopf titel={t('prozesse.titel')} titelRef={h1} />
        <p class="ersatz">{t('prozesse.unbekannt', { id })}</p>
        <a href={routeZuHash({ art: 'prozesse' })}>{t('prozesse.zur_liste')}</a>
      </div>
    );
  }
  const stichtag = stichtagSignal.value;
  const st = staende(p, stichtag).find((s) => s.id === id)!;
  const e = st.eintrag;
  const tx = prozessTexte(UI_TEXTE, id, p);
  const titel = `${id} ${tx?.titel ?? ''}`;
  const eigen = p.eigeneProzesse?.find((x) => x.id === id);
  const ablauf = ablaufVon(UI_TEXTE, kp, e);
  const raster = prozessRaster(ablauf, UI_TEXTE);
  const fid = (s: string) => `pz-${id}-${s}`;
  const unbesetzt = unbesetzteProzessrollen(p, appDaten().kataloge, id);
  const zeigeVerweis = p.meta.mitIsms && (kp.art !== 'nur-aims');
  const massnahmen = p.massnahmen.filter((m) => st.massnahmenOffen.includes(m.id) || (m.herkunft.art === 'prozess' && (m.herkunft.ref ?? '').split(/[,;]\s*/).includes(id)));
  const rhythmen = ['vierzehntaeglich', 'monatlich', 'quartalsweise', 'halbjaehrlich', 'jaehrlich'];
  const kennzahlen = [...p.ziele.map((z) => ({ id: z.id, text: `${z.id} ${z.kennzahl || z.ziel}` })), ...(p.kennzahlen ?? []).map((k) => ({ id: k.id, text: `${k.id} ${k.kennzahl ?? ''}`.trim() }))];
  const kz = kp.kennzahl_vorschlag;
  // Sollwert in derselben Schreibweise wie D-27 («100 %» statt «mindestens 100 %», «0 (kein Fall)»)
  const soll = kz ? sollText((x, w) => inhalt(x, w) ?? x, kz) : '';
  const bahnenOffen = offeneBahnen(e);
  const formenOffen = e?.drawio?.offen?.formen ?? [];
  const rollen = rollenAuswahl();
  const eignerRolle = rollenText(UI_TEXTE, kp.eigner_rolle);
  const anwendbarFest = kp.pflicht === 'pflicht';

  const neueMassnahme = () => {
    let neu = '';
    aendereMit((x) => {
      const m = neuerEintrag(x, 'massnahmen', { titel: t('prozesse.massnahme_titel', { prozess: titel }), herkunft: { art: 'prozess', ref: id }, status: 'offen', prioritaet: 'mittel', ...(st.eigner ? { verantwortlich: st.eigner } : {}) });
      neu = String(m['id']);
      x.massnahmen.push(m as never);
      x.prozesse ??= [];
    });
    navigiere({ art: 'formular', modul: 'massnahmen', id: neu });
  };
  const beschreibung = async () => {
    try {
      const r = await erzeugeSet(p, p.meta.dokumentSprache, { ids: ['D-27'], einzeln: true, prozessId: id });
      if (r.fehler.length) throw new Error(r.fehler.map((f) => f.meldung).join('; '));
      if (!r.dateien.some((d) => d.endsWith('.docx'))) throw new Error(t('dokumente.nichts'));
      herunterladen(r.daten, r.name, mimeVon(r.name));
      melde(t('prozesse.beschreibung_erzeugt', { name: r.name }), 'ok');
    } catch (x) {
      melde(`${t('prozesse.beschreibung_fehler')}: ${fehlerVerstaendlich(x)}`, 'fehler');
    }
  };

  return (
    <div class="inhalt prozess-detail" id="prozess-detail" data-prozess={id}>
      <Seitenkopf titel={titel} titelRef={h1} unter={<p class="kein-druck"><a href={routeZuHash({ art: 'prozesse' })} id="prozess-zurueck"><Symbol name="pfeil-links" klasse="sym sym-text" /> {t('prozesse.zur_liste')}</a></p>} aktion={<BeschreibungKnopf id={fid('beschreibung-docx')} erzeugen={beschreibung} />} />
      <p class="prozess-marken">
        <StatusPille art="neutral">{inhalt(`prozesse.gruppen.${kp.gruppe}`)}</StatusPille> <StatusPille art="neutral">{inhalt(`prozesse.arten.${kp.art}`)}</StatusPille>{' '}
        <StatusPille art="neutral">{inhalt(`prozesse.pflichtarten.${kp.pflicht}`)}</StatusPille>{' '}
        {st.sicht === 'minimal' && <StatusPille art="info">{inhalt('prozesse.ohne_isms.minimal')}</StatusPille>}
        {st.sicht === 'empfohlen' && <StatusPille art="neutral">{inhalt('prozesse.ohne_isms.empfohlen')}</StatusPille>}
        {' '}<ReifePille reife={st.reife} />
      </p>
      <p class="einleitung">{tx?.zweck}</p>
      {tx?.hilfe && <p class="zweitext">{tx.hilfe}</p>}
      {/* C4-03: unbesetzte Rollen dieses Ablaufs schon hier, nicht erst in der Prüfung (F37) */}
      {unbesetzt.length > 0 && (
        <Hinweis art="warnung" id={fid('rollen-offen')} role="note">
          <p>{t('prozesse.rollen_offen', { rollen: unbesetzt.map((r) => rollenText(UI_TEXTE, r)).join(', ') })}</p>
          <p><a href={routeZuHash({ art: 'formular', modul: 'organisation', id: 'rollen' })}>{t('prozesse.rollen_offen_link')}</a></p>
        </Hinweis>
      )}
      {kp.art === 'nur-isms' && tx?.ohne_isms && !p.meta.mitIsms && <Hinweis role="note"><p>{tx.ohne_isms}</p></Hinweis>}
      {eigen && <EigenerProzessKarte p={p} eigen={eigen} />}

      <section class="karte abschnitt" aria-labelledby={fid('stand-titel')} id={fid('stand')}>
        <h2 id={fid('stand-titel')}>{t('prozesse.stand_titel')}</h2>
        <div class="feld">
          <label for={fid('anwendbar')}>{t('prozesse.anwendbar')}</label>
          {anwendbarFest && <p class="feldhilfe">{inhalt('prozesse.pflichtarten_hilfe.pflicht')}</p>}
          <Auswahl id={fid('anwendbar')} value={e?.anwendbar ?? ''} disabled={anwendbarFest && e?.anwendbar !== 'nein'} onChange={(ev) => prozessFeld(id, 'anwendbar', (ev.currentTarget.value || undefined) as ProzessEintrag['anwendbar'])}>
            <option value="">{t('prozesse.vorschlag_wert', { wert: t(`prozesse.anwendbar_${st.anwendbar}`) })}</option>
            <option value="ja">{t('prozesse.anwendbar_ja')}</option>
            {!anwendbarFest || e?.anwendbar === 'nein' ? <option value="nein">{t('prozesse.anwendbar_nein')}</option> : null}
            <option value="offen">{t('prozesse.anwendbar_offen')}</option>
          </Auswahl>
        </div>
        {(e?.anwendbar === 'nein' || st.anwendbar === 'nein') && (
          <Feld id={fid('begruendung')} def={{ typ: 'textarea', pfad: 'begruendung' }} label={t('prozesse.begruendung')} wert={e?.begruendung} setze={(v) => prozessFeld(id, 'begruendung', (v as string) || undefined)} fehlt={e?.anwendbar === 'nein' && !e.begruendung?.trim()} />
        )}
        {zeigeVerweis && (
          <Feld id={fid('isms')} def={{ typ: 'text', pfad: 'ismsVerweis' }} label={t('prozesse.isms_verweis')} wert={e?.ismsVerweis} setze={(v) => prozessFeld(id, 'ismsVerweis', (v as string) || undefined)} />
        )}
        <Feld id={fid('eigner')} def={{ typ: 'person', pfad: 'eigner' }} label={t('prozesse.eigner')} wert={e?.eigner} setze={(v) => prozessFeld(id, 'eigner', v as string | undefined)} />
        {/* Ausführung durch eine externe Stelle und ihre Steuerung (H71) */}
        <div class="feld">
          <label for={fid('extern')}>{t('prozesse.extern')}</label>
          <Auswahl id={fid('extern')} value={e?.extern?.lieferant ?? (e?.extern ? '_name' : '')} aria-describedby={fid('extern-hilfe')} onChange={(ev) => {
            const v = ev.currentTarget.value;
            prozessFeld(id, 'extern', v === '' ? undefined : v === '_name' ? { name: e?.extern?.name ?? '', ...(e?.extern?.steuerung ? { steuerung: e.extern.steuerung } : {}) } : { lieferant: v, ...(e?.extern?.steuerung ? { steuerung: e.extern.steuerung } : {}) });
          }}>
            <option value="">{t('prozesse.extern_nein')}</option>
            {p.lieferanten.map((l) => <option key={l.id} value={l.id}>{`${l.id} ${l.name}`}</option>)}
            <option value="_name">{t('prozesse.extern_ohne_register')}</option>
          </Auswahl>
          <p class="feldhilfe" id={fid('extern-hilfe')}>{t('prozesse.extern_hilfe')}</p>
        </div>
        {e?.extern && !e.extern.lieferant && (
          <Feld id={fid('extern-name')} def={{ typ: 'text', pfad: 'extern.name' }} label={t('prozesse.extern_name')} wert={e.extern.name} setze={(v) => prozessFeld(id, 'extern', { ...e.extern, name: (v as string) || undefined })} />
        )}
        {e?.extern && (
          <Feld id={fid('extern-steuerung')} def={{ typ: 'textarea', pfad: 'extern.steuerung' }} label={t('prozesse.extern_steuerung')} wert={e.extern.steuerung} setze={(v) => prozessFeld(id, 'extern', { ...e.extern, steuerung: (v as string) || undefined })} fehlt={!e.extern.steuerung?.trim()} />
        )}
        {!e?.eigner && <p class="zweitext" id={fid('eigner-vorschlag')}>{st.eigner ? t('prozesse.eigner_aus_rolle', { person: personName(p, st.eigner), rolle: eignerRolle }) : t('prozesse.eigner_rolle', { rolle: eignerRolle })}</p>}
        <Feld id={fid('stellvertretung')} def={{ typ: 'person', pfad: 'stellvertretung' }} label={t('prozesse.stellvertretung')} wert={e?.stellvertretung} setze={(v) => prozessFeld(id, 'stellvertretung', v as string | undefined)} />
        <div class="feld">
          <label for={fid('reife')}>{t('prozesse.reife')}</label>
          <p class="feldhilfe">{inhalt('prozesse.reifeskala.hilfe')}</p>
          <Auswahl id={fid('reife')} value={e?.reife === undefined ? '' : String(e.reife)} onChange={(ev) => {
            const v = ev.currentTarget.value;
            prozessAendern(id, (x) => {
              if (v === '') delete x.reife;
              else x.reife = Number(v) as ProzessReife;
              x.reifeAm = v === '' ? undefined : heute();
            });
          }}>
            <option value="">{t('feld.bitte_waehlen')}</option>
            {[0, 1, 2, 3, 4].map((r) => <option key={r} value={String(r)}>{reifeText(r)}</option>)}
          </Auswahl>
          <p class="zweitext" id={fid('reife-vorschlag')}>
            {t('prozesse.reife_vorschlag', { stufe: reifeText(st.reifeVorschlag) })} {inhalt(`prozesse.reifeskala.${['nicht-begonnen', 'definiert', 'eingefuehrt', 'wirksam', 'ueberprueft'][st.reifeVorschlag]}.kriterium`)}
            {st.reifeVorschlag !== st.reife && (
              <> <button type="button" class="klein" id={fid('reife-uebernehmen')} onClick={() => prozessAendern(id, (x) => ((x.reife = st.reifeVorschlag), (x.reifeAm = heute())))}>{t('prozesse.vorschlag_uebernehmen')}</button></>
            )}
          </p>
        </div>
        <div class="feld">
          <label for={fid('rhythmus')}>{t('prozesse.rhythmus')}</label>
          <Auswahl id={fid('rhythmus')} value={e?.rhythmus ?? ''} onChange={(ev) => prozessFeld(id, 'rhythmus', ev.currentTarget.value || undefined)}>
            <option value="">{t('prozesse.vorschlag_wert', { wert: kp.rhythmus ? optionText('rhythmus', kp.rhythmus) : (inhalt('prozesse.felder.ereignis') ?? '') })}</option>
            {rhythmen.map((r) => <option key={r} value={r}>{optionText('rhythmus', r)}</option>)}
          </Auswahl>
        </div>
        <Feld id={fid('letzte')} def={{ typ: 'datum', pfad: 'letzteDurchfuehrung' }} label={t('prozesse.letzte')} wert={e?.letzteDurchfuehrung} setze={(v) => prozessFeld(id, 'letzteDurchfuehrung', v as string | undefined)} />
        <p class="zweitext" id={fid('abgeleitet')}>{st.abgeleitet ? t('prozesse.abgeleitet', { datum: datumText(st.abgeleitet) }) : kp.ableitung.length ? t('prozesse.nicht_abgeleitet') : t('prozesse.nur_hand')}</p>
        <Feld id={fid('faellig')} def={{ typ: 'datum', pfad: 'naechsteFaelligkeit' }} label={t('prozesse.naechste')} wert={e?.naechsteFaelligkeit} setze={(v) => prozessFeld(id, 'naechsteFaelligkeit', v as string | undefined)} />
        {!e?.naechsteFaelligkeit && st.naechsteFaelligkeit && <p class="zweitext">{t('prozesse.faellig_berechnet', { datum: datumText(st.naechsteFaelligkeit) })}</p>}
        {st.ueberfaellig && <p><StatusPille art="kritisch" id={fid('ueberfaellig')}>{t('prozesse.ueberfaellig_wort')}</StatusPille></p>}
        <div class="feld">
          <label for={fid('kennzahl')}>{t('prozesse.kennzahl')}</label>
          <p class="feldhilfe">{kz ? t('prozesse.kennzahl_vorschlag', { kennzahl: tx?.kennzahl ?? '', soll }) : t('prozesse.kennzahl_eigen')}</p>
          <Auswahl id={fid('kennzahl')} value={e?.kennzahl ?? ''} onChange={(ev) => prozessFeld(id, 'kennzahl', ev.currentTarget.value || undefined)}>
            <option value="">{kennzahlen.length ? t('feld.bitte_waehlen') : t('prozesse.keine_kennzahlen')}</option>
            {kennzahlen.map((k) => <option key={k.id} value={k.id}>{k.text}</option>)}
          </Auswahl>
          {st.kennzahl && <p class="zweitext" id={fid('kennzahl-wert')}>{st.kennzahl.wert ? t('prozesse.kennzahl_wert', { wert: st.kennzahl.wert, datum: datumText(st.kennzahl.datum) }) : t('prozesse.kennzahl_ohne_wert')}</p>}
        </div>
        <Feld id={fid('nachweise')} def={{ typ: 'verweis', pfad: 'nachweise', quelle: 'nachweise' }} liste label={t('prozesse.nachweise')} wert={e?.nachweise ?? []} setze={(v) => prozessFeld(id, 'nachweise', v as string[])} />
        <Feld id={fid('notiz')} def={{ typ: 'textarea', pfad: 'notiz' }} label={t('prozesse.notiz')} wert={e?.notiz} setze={(v) => prozessFeld(id, 'notiz', (v as string) || undefined)} />
      </section>

      <section class="karte abschnitt" aria-labelledby={fid('ablauf-titel')} id={fid('ablauf')}>
        <h2 id={fid('ablauf-titel')}>{t('prozesse.ablauf_titel')}</h2>
        <p class="zweitext">{ablauf.eigen ? t('prozesse.ablauf_eigen') : t('prozesse.ablauf_katalog')}</p>
        <Prozessablauf raster={raster} id={`ablauf-${id}`} titel={t('prozesse.ablauf_svg', { prozess: titel })} beschreibung={t('prozesse.ablauf_svg_text', { anzahl: ablauf.schritte.length, bahnen: raster.bahnen.map((b) => b.text).join(', ') })} />
        {(bahnenOffen.length > 0 || formenOffen.length > 0) && (
          <Hinweis art="warnung" klasse="prozess-bahnen-zuordnen" id={fid('bahnen-offen')} role="group" aria-labelledby={fid('bahnen-offen-titel')}>
            <h3 id={fid('bahnen-offen-titel')}>{t('prozesse.bahnen_offen_titel')}</h3>
            {bahnenOffen.length > 0 && <p>{t('prozesse.bahnen_offen_text')}</p>}
            {bahnenOffen.map((b) => (
              <div class="feld" key={b.id}>
                <label for={fid(`bahn-${b.id}`)}>{t('prozesse.bahn_rolle', { bahn: b.text?.trim() || b.id })}</label>
                <Auswahl id={fid(`bahn-${b.id}`)} value={b.rolle ?? ''} onChange={(ev) => bahnRolleSetzen(id, b.id, ev.currentTarget.value || undefined)}>
                  <option value="">{t('feld.bitte_waehlen')}</option>
                  {rollen.map((r) => <option key={r.schluessel} value={r.schluessel}>{r.text}</option>)}
                </Auswahl>
              </div>
            ))}
            {formenOffen.length > 0 && (
              <p>
                {t('prozesse.formen_offen_text', { liste: formenOffen.join(', ') })}{' '}
                <button type="button" class="klein" id={fid('formen-geprueft')} onClick={() => formenGeprueft(id)}>{t('prozesse.formen_geprueft')}</button>
              </p>
            )}
          </Hinweis>
        )}
        <h3>{t('prozesse.schritte_titel')}</h3>
        <SchrittTabelle kp={kp} e={e} bearbeiten={bearbeiten} />
        <div class="leiste kein-druck">
          <button type="button" id={fid('bearbeiten')} aria-pressed={bearbeiten} onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? t('prozesse.bearbeiten_fertig') : t('prozesse.bearbeiten')}</button>
          {ablauf.eigen && !kp.eigen && (
            <button type="button" id={fid('zuruecksetzen')} onClick={async () => {
              if (!(await bestaetigen({ text: t('prozesse.zuruecksetzen_frage'), titel: t('bestaetigen.titel_ablauf_zuruecksetzen'), ja: t('bestaetigen.ablauf_zuruecksetzen'), gefahr: true }))) return;
              prozessAendern(id, (x) => {
                delete x.schritte;
                delete x.bahnen;
                delete x.drawio;
              });
            }}>{t('prozesse.zuruecksetzen')}</button>
          )}
        </div>
      </section>

      <section class="karte abschnitt" aria-labelledby={fid('beschreibung-titel')} id={fid('beschreibung')}>
        <h2 id={fid('beschreibung-titel')}>{t('prozesse.beschreibung_titel')}</h2>
        {!kp.eigen && (
          <div class="prozess-spalten">
            <div><h3>{inhalt('prozesse.felder.ausloeser')}</h3><ul>{(tx?.ausloeser ?? []).map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3>{inhalt('prozesse.felder.eingaben')}</h3><ul>{(tx?.eingaben ?? []).map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3>{inhalt('prozesse.felder.ausgaben')}</h3><ul>{(tx?.ausgaben ?? []).map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
        )}
        {kp.eigen && <p class="zweitext">{t('prozesse.eigen_beschreibung')}</p>}
        <dl class="prozess-angaben">
          <dt>{inhalt('prozesse.felder.normbezug')}</dt>
          <dd>{[kp.normbezug_42001.length ? `ISO/IEC 42001: ${kp.normbezug_42001.join(', ')}` : '', kp.normbezug_27001.length ? `ISO/IEC 27001: ${kp.normbezug_27001.join(', ')}` : ''].filter(Boolean).join('; ') || t('prozesse.keine_angabe')}</dd>
          {kp.kit_dokumente.length > 0 && (
            <>
              <dt>{inhalt('prozesse.felder.dokumente')}</dt>
              <dd>{kp.kit_dokumente.map((d, i) => <span key={d}>{i > 0 && ', '}<a href={routeZuHash({ art: 'formular', modul: 'dokumente', id: d })}>{d}</a> {dokumentTitelUi(d)}</span>)}</dd>
            </>
          )}
          {kp.verbunden.length > 0 && (
            <>
              <dt>{inhalt('prozesse.felder.verbunden')}</dt>
              <dd>{kp.verbunden.map((v, i) => <span key={v}>{i > 0 && ', '}<a href={routeZuHash({ art: 'prozesse', id: v })}>{v}</a> {titelVon(p, v)}</span>)}</dd>
            </>
          )}
          {kp.pflicht === 'bedingt' && tx?.bedingung && (<><dt>{inhalt('prozesse.felder.bedingung')}</dt><dd>{tx.bedingung}</dd></>)}
        </dl>
      </section>

      <section class="karte abschnitt" aria-labelledby={fid('massnahmen-titel')} id={fid('massnahmen')}>
        <h2 id={fid('massnahmen-titel')}>{t('prozesse.massnahmen_titel')}</h2>
        {massnahmen.length === 0 ? <p class="zweitext">{t('prozesse.keine_massnahmen')}</p> : (
          <ul class="lb-liste">
            {massnahmen.map((m) => (
              <li key={m.id}>
                <span class="datum">{datumText(m.termin)}</span><a href={routeZuHash({ art: 'formular', modul: 'massnahmen', id: m.id })}>{m.id}</a> {m.titel} · {optionText('massnahmeStatus', m.status)}
                {st.massnahmenUeberfaellig.includes(m.id) && <> <StatusPille art="kritisch">{t('prozesse.ueberfaellig_wort')}</StatusPille></>}
              </li>
            ))}
          </ul>
        )}
        <button type="button" id={fid('massnahme-neu')} onClick={neueMassnahme}>{t('prozesse.massnahme_neu')}</button>
      </section>

      <section class="karte abschnitt kein-druck" aria-labelledby={fid('dateien-titel')} id={fid('dateien')}>
        <h2 id={fid('dateien-titel')}>{t('prozesse.dateien_titel')}</h2>
        <p class="zweitext">{t('prozesse.drawio_hinweis')}</p>
        {e?.drawio && <p class="zweitext" id={fid('drawio-stand')}>{t('prozesse.drawio_stand', { datum: datumText(e.drawio.importiertAm.slice(0, 10)), datei: e.drawio.datei ?? '' })}</p>}
        <div class="leiste">
          <DrawioExportKnopf p={p} id={fid('drawio-export')} ids={[id]} text={t('prozesse.drawio_dieser')} />
          <DrawioImportKnopf p={p} prozessId={id} />
        </div>
      </section>
    </div>
  );
}

export function Prozesse({ p, id, filter }: { p: Projekt; id?: string; filter?: Record<string, string> }) {
  return id ? <Detail p={p} id={id} /> : <Liste p={p} filter={filter} />;
}

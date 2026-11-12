// Start: Hinweis zum Datenschutz, Neues Projekt (Pfad, Modul, Sprache), Projektdatei öffnen, Beispiele, Wiederherstellen.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Projekt, Sprache } from '../../../model/typen.ts';
import { appDaten, beispielText } from '../../daten.ts';
import { datumText, t, uiSprache, zeitpunktText } from '../../i18n.ts';
import { routeZuHash } from '../../logik/routen.ts';
import type { Zwischenstand } from '../../speicher/index.ts';
import { projektReparieren, projektTextParsen, schemaFehlerText, type SchemaFehlerFormat } from '../../import/laden.ts';
import { DateiZuGrossFehler, sichererDateiname } from '../../speicher/datei.ts';
import { KiImport } from './KiImport.tsx';
import { EingangsFehler } from '../../../eingang/lesen.ts';
import {
  beispielUnveraendert, deserialisieren, holeSpeicher, LadeFehler, melde, migrationsSicherung, navigiere, neuesProjekt, projekt, projektUebernehmen, speicherStatus,
  ungespeichert, wechselErlaubt, zwischenstaende,
} from '../../zustand/store.ts';
import { etappenStaende } from '../gefuehrt/Gefuehrt.tsx';
import { faelligListe, type FaelligeAufgabe } from '../../rahmen/faellig.ts';
import { Symbol } from '../../rahmen/symbole.tsx';
import { tr } from '../../rahmen/text.ts';
import { bibliothekPruefen, bibliothekVerbunden } from '../../rahmen/bibliothek-anbindung.tsx';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { kiSystemErfassen } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

export const startFehler = signal<string | null>(null);

export function schemaFormat(): SchemaFehlerFormat {
  return {
    wurzel: t('laden.s_wurzel'), fehlt: t('laden.s_fehlt'), unbekannt: t('laden.s_unbekannt'), wert: t('laden.s_wert'),
    typ: t('laden.s_typ'), sonst: t('laden.s_sonst'), weitere: t('laden.s_weitere'),
    zu_lang: t('laden.s_zu_lang'), muster: t('laden.s_muster'), datum: t('laden.s_datum'), doppelt: t('laden.s_doppelt'),
    zeichen: t('laden.s_zeichen'), schluessel: t('laden.s_schluessel'), war: t('laden.s_war'), gesetzt: t('laden.s_gesetzt'), entfernt: t('laden.s_entfernt'),
    listen: Object.fromEntries(LISTEN_NAMEN.map((n) => [n, t(`laden.liste_${n}`)])),
    felder: Object.fromEntries(['termin', 'datum', 'titel', 'name', 'status', 'wert', 'version', 'beschreibung', 'verantwortlich', 'personen', 'schemaVersion', 'meta', 'organisation', 'eigner', 'von', 'am', 'freigabe', 'funktion', 'art', 'risiken', 'massnahmen', 'kiSysteme', 'controls', 'dokumente'].map((n) => [n, t(`laden.feld_${n}`)])),
  };
}

const LISTEN_NAMEN = ['personen', 'parteien', 'rollen', 'kiSysteme', 'risiken', 'folgenabschaetzungen', 'controls', 'eigeneControls', 'nachweise', 'dokumente', 'massnahmen', 'lieferanten', 'ziele', 'kompetenzen', 'kommunikation', 'audits', 'feststellungen', 'managementbewertungen', 'prozesse', 'eigeneProzesse'];

/** Datei mit Schemafehlern: Rohtext und Ergebnis der Probe. Der Knopf erscheint nur, wenn die Probe gelingt; alle Änderungen stehen vorher da */
export const startReparatur = signal<{ text: string; aenderungen: string[] } | null>(null);

/** Ladefehler anzeigen und, wo möglich, die Reparatur als Probe rechnen */
function ladeFehlerZeigen(e: unknown): void {
  startFehler.value = ladeFehlerText(e);
  startReparatur.value = null;
  if (!(e instanceof LadeFehler) || !e.text) return;
  try {
    const roh = projektTextParsen(e.text);
    const probe = projektReparieren(roh, schemaFormat());
    if (probe) startReparatur.value = { text: e.text, aenderungen: probe.aenderungen };
    else startFehler.value = `${startFehler.value}\n\n${t('laden.reparatur_fehlgeschlagen')}`;
  } catch {
    startFehler.value = `${startFehler.value}\n\n${t('laden.reparatur_fehlgeschlagen')}`;
  }
}

export function ladeFehlerText(e: unknown): string {
  if (e instanceof LadeFehler) {
    const details = e.schema ? schemaFehlerText(e.schema, 8, schemaFormat()) : e.details;
    return `${t(`laden.${e.art}`)}${details.length ? `\n${details.join('\n')}` : ''}`;
  }
  if (e instanceof DateiZuGrossFehler) return `${t('laden.zu-gross')}\n${(e.bytes / 1048576).toFixed(0)} MB`;
  // Grenzen des Eingangsmoduls (auch Zwischenstand über der Grenze): Ursache und nächster Schritt, kein «unerwarteter Fehler»
  if (e instanceof EingangsFehler) return fehlerVerstaendlich(e);
  return `${t('laden.unbekannt')}\n${fehlerVerstaendlich(e)}`;
}

function NeuesProjekt({ abbrechen }: { abbrechen: () => void }) {
  // Keine Vorbelegung: beide Fragen bestimmen den Pfad und werden bewusst beantwortet (Rollentest RT-04)
  const [isms, setIsms] = useState<'zertifiziert' | 'vorhanden' | 'nein' | null>(null);
  const [modul, setModul] = useState<boolean | null>(null);
  const [sprache, setSprache] = useState<Sprache>(uiSprache.value);
  const [pruefen, setPruefen] = useState(false);
  const ref = useRef<HTMLHeadingElement>(null);
  const meldungRef = useRef<HTMLParagraphElement>(null);
  const fehlt = (isms === null ? 1 : 0) + (modul === null ? 1 : 0);
  useEffect(() => ref.current?.focus(), []);
  return (
    <section class="karte" aria-labelledby="neu-titel">
      <h2 id="neu-titel" tabIndex={-1} ref={ref}>{t('start.neu_titel')}</h2>
      {/* Eigene Prüfung statt der Blase des Browsers (U-30): Meldung im Stil der App wie im Guide */}
      <form noValidate onSubmit={async (e) => {
        e.preventDefault();
        if (isms === null || modul === null) {
          setPruefen(true);
          requestAnimationFrame(() => meldungRef.current?.focus());
          return;
        }
        if (await wechselErlaubt()) neuesProjekt({ sprache, mitIsms: isms !== 'nein', modulAiAct: modul, ismsAntwort: isms });
      }}>
        {pruefen && fehlt > 0 && <Hinweis als="p" art="fehler" role="alert" tabIndex={-1} innen={meldungRef} id="neu-fehlt">{t('gefuehrt.pflicht_fehlt_start', { anzahl: fehlt })}</Hinweis>}
        <fieldset class={`feld${pruefen && isms === null ? ' fehlt' : ''}`}>
          <legend>{t('start.pfad_frage')}</legend>
          <p class="feldhilfe">{t('start.pfad_hilfe')}</p>
          <div class="optionen">
            {(['zertifiziert', 'vorhanden', 'nein'] as const).map((w) => (
              <label key={w}><input type="radio" name="isms" required checked={isms === w} onChange={() => setIsms(w)} /><span>{t(`start.isms_${w}`)}</span></label>
            ))}
          </div>
        </fieldset>
        <fieldset class={`feld${pruefen && modul === null ? ' fehlt' : ''}`}>
          <legend>{t('start.modul_frage')}</legend>
          <p class="feldhilfe">{t('start.modul_hilfe')}</p>
          <div class="optionen">
            <label><input type="radio" name="modul" required checked={modul === true} onChange={() => setModul(true)} /><span>{t('start.modul_ja')}</span></label>
            <label><input type="radio" name="modul" required checked={modul === false} onChange={() => setModul(false)} /><span>{t('start.modul_nein')}</span></label>
          </div>
        </fieldset>
        <div class="feld">
          <label for="neu-sprache">{t('start.dokumentsprache')}</label>
          <Auswahl id="neu-sprache" style={{ maxWidth: '240px' }} value={sprache} onChange={(e) => setSprache(e.currentTarget.value as Sprache)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </Auswahl>
        </div>
        <div class="leiste">
          <button type="submit" class={projekt.value ? undefined : 'primaer'} id="neu-anlegen">{t('start.anlegen')}</button>
          <button type="button" onClick={abbrechen}>{t('allgemein.abbrechen')}</button>
        </div>
      </form>
    </section>
  );
}

export async function oeffnenAblauf(): Promise<void> {
  startFehler.value = null;
  startReparatur.value = null;
  // Rückfrage vor dem Dialog (Benutzeraktivierung bleibt erhalten); der Zwischenstand wird beim Wechsel gesichert
  if (!(await wechselErlaubt())) return;
  try {
    const r = await holeSpeicher().oeffnen();
    if (!r) return;
    projektUebernehmen(r.projekt, false);
    if (r.zwischenstand && (await bestaetigen({ text: t('start.neuerer_zwischenstand', { datum: zeitpunktText(r.zwischenstand.geaendertAm) }), titel: t('bestaetigen.titel_zwischenstand_uebernehmen'), ja: t('bestaetigen.zwischenstand_uebernehmen'), nein: t('bestaetigen.datei_behalten') }))) {
      projektUebernehmen(await holeSpeicher().wiederherstellen(r.zwischenstand.schluessel), true);
    }
    // Migriert (AF-004): die ursprüngliche Datei steht als Sicherung bereit, bis sie abgelegt oder verworfen ist (nach dem
    // Übernehmen, denn jedes Übernehmen eines Projekts setzt das Angebot zurück)
    migrationsSicherung.value = r.sicherung;
    melde(t('start.geoeffnet', { name: r.projekt.organisation.name || '' }), 'ok');
    navigiere({ art: 'formular', modul: 'uebersicht' });
  } catch (e) {
    ladeFehlerZeigen(e);
  }
}

/** Datei trotz Schemafehlern öffnen: zu lange Texte kürzen, Unzulässiges entfernen; ein neuer Dateiname schützt das Original */
function reparierenUndOeffnen(text: string): void {
  try {
    const roh = projektTextParsen(text);
    const r = projektReparieren(roh, schemaFormat());
    if (!r) {
      startFehler.value = t('laden.reparatur_fehlgeschlagen');
      startReparatur.value = null;
      return;
    }
    projektUebernehmen(r.projekt, true);
    // Vorschlag mit eigenem Namen: Wer «Speichern» wählt, überschreibt die beschädigte Datei nicht aus Versehen
    holeSpeicher().neu(r.projekt, sichererDateiname(`${r.projekt.organisation?.name || 'projekt'} (${t('laden.repariert_zusatz')})`));
    startFehler.value = null;
    startReparatur.value = null;
    melde(t(r.aenderungen.length === 1 ? 'laden.repariert_eins' : 'laden.repariert', { anzahl: r.aenderungen.length }), 'info', 15_000);
    navigiere({ art: 'formular', modul: 'uebersicht' });
  } catch {
    startFehler.value = t('laden.reparatur_fehlgeschlagen');
    startReparatur.value = null;
  }
}

/** Projekte und Beispiele: Wiederherstellen, Neues Projekt, Projektdatei öffnen, Beispiele, Ergebnis des KI-Assistenten */
function ProjekteBereich() {
  const [neu, setNeu] = useState(false);
  const [staende, setStaende] = useState<Zwischenstand[]>([]);
  const laden = () => void zwischenstaende().then(setStaende, () => setStaende([]));
  useEffect(() => laden(), []);
  // Beispiele in der Sprache der Oberfläche (Dateiname <firma>.<sprache>.aims.json); fehlen sie, alle anbieten
  const alleBeispiele = appDaten().beispiele;
  const beispieleSprache = alleBeispiele.filter((b) => b.datei.includes(`.${uiSprache.value}.`));
  const beispiele = beispieleSprache.length ? beispieleSprache : alleBeispiele;

  const wiederherstellen = async (z: Zwischenstand) => {
    if (z.schluessel !== projekt.value?.meta.projektId && !(await wechselErlaubt())) return;
    try {
      const pr = await holeSpeicher().wiederherstellen(z.schluessel);
      projektUebernehmen(pr, true);
      navigiere(pr.meta.gefuehrt.aktuelleSeite ? { art: 'gefuehrt', etappe: pr.meta.gefuehrt.aktuelleEtappe, seite: pr.meta.gefuehrt.aktuelleSeite } : { art: 'formular', modul: 'uebersicht' });
    } catch (e) {
      ladeFehlerZeigen(e);
    }
  };
  const beispielOeffnen = async (datei: string) => {
    const text = beispielText(datei);
    if (!text || !(await wechselErlaubt())) return;
    try {
      const b: Projekt = deserialisieren(text);
      b.meta.projektId = globalThis.crypto?.randomUUID?.() ?? `beispiel-${Date.now()}`;
      projektUebernehmen(b, true);
      holeSpeicher().neu(b);
      beispielUnveraendert.value = true;
      navigiere({ art: 'formular', modul: 'uebersicht' });
    } catch (e) {
      startFehler.value = ladeFehlerText(e);
    }
  };
  return (
    <>
      {startFehler.value && (
        <Hinweis art="fehler" role="alert" id="start-fehler">
          <strong>{t('laden.titel')}</strong>
          <p class="vorformatiert">{startFehler.value}</p>
          {startReparatur.value && (
            <details id="start-reparatur-liste" open={startReparatur.value.aenderungen.length <= 12}>
              <summary>{t('laden.reparatur_aenderungen', { anzahl: startReparatur.value.aenderungen.length })}</summary>
              <ul>{startReparatur.value.aenderungen.map((z, i) => <li key={i}>{z}</li>)}</ul>
            </details>
          )}
          {startReparatur.value && (
            <div class="leiste">
              <button type="button" id="start-reparieren" onClick={() => reparierenUndOeffnen(startReparatur.value!.text)}>{t('laden.reparieren')}</button>
            </div>
          )}
        </Hinweis>
      )}
      {staende.length > 0 && (
        <section class="karte" aria-labelledby="wh-titel">
          <h2 id="wh-titel">{t('start.wiederherstellen_titel')}</h2>
          <p class="zweitext">{t('start.wiederherstellen_text')}</p>
          <ul class="befunde">
            {staende.map((z) => (
              <li key={z.schluessel}>
                <div class="text">
                  <strong>{z.dateiname}</strong>
                  <br />
                  <span class="zweitext">{t('start.stand', { datum: zeitpunktText(z.geaendertAm) })}</span>
                </div>
                <div class="leiste">
                  <button type="button" onClick={() => void wiederherstellen(z)}>{t('start.weitermachen')}</button>
                  <button type="button" onClick={async () => {
                    if (!(await bestaetigen({ text: t('start.verwerfen_frage'), titel: t('bestaetigen.titel_zwischenstand_verwerfen'), ja: t('bestaetigen.zwischenstand_verwerfen'), gefahr: true }))) return;
                    await holeSpeicher().verwerfen(z.schluessel);
                    laden();
                  }}>{t('start.verwerfen')}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {neu ? (
        <NeuesProjekt abbrechen={() => setNeu(false)} />
      ) : (
        <div class="wahl">
          <section class="karte">
            <h2>{t('start.neu')}</h2>
            <p>{t('start.neu_text')}</p>
            <button type="button" class={projekt.value ? '' : 'primaer'} id="start-neu" onClick={() => setNeu(true)}>{t('start.neu')}</button>
          </section>
          <section class="karte">
            <h2>{t('start.oeffnen')}</h2>
            <p>{t('start.oeffnen_text')}</p>
            <button type="button" id="start-oeffnen" onClick={() => void oeffnenAblauf()}>{t('start.oeffnen')}</button>
          </section>
          <section class="karte" data-beispiele="">
            <h2>{t('start.beispiele')}</h2>
            <p>{beispiele.length ? t('start.beispiele_text') : t('start.beispiele_fehlen')}</p>
            <div class="leiste">
              {beispiele.length ? (
                beispiele.map((b) => <button type="button" key={b.datei} onClick={() => beispielOeffnen(b.datei)}>{b.titel}</button>)
              ) : (
                <button type="button" disabled>{t('start.beispiele')}</button>
              )}
            </div>
          </section>
        </div>
      )}
      {!neu && <KiImport />}
    </>
  );
}

/** Erste Schritte (Checkliste wie im Mockup): erledigte Schritte mit Haken, der erste offene aufgeklappt mit Knopf */
function ErsteSchritte({ p }: { p: Projekt }) {
  useEffect(() => bibliothekPruefen(p), [p.meta.projektId]);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const staende = new Map(etappenStaende(p).map((e) => [e.id, e.zustand]));
  const schritte: { id: string; erledigt: boolean; href: string }[] = [
    { id: 'speichern', erledigt: !!speicherStatus.value?.dateiname || (!ungespeichert.value && !beispielUnveraendert.value), href: routeZuHash({ art: 'start', unter: 'projekte' }) },
    { id: 'interview', erledigt: staende.get('E0') === 'erledigt', href: routeZuHash({ art: 'gefuehrt', etappe: 'E0' }) },
    { id: 'inventar', erledigt: p.kiSysteme.length > 0, href: routeZuHash({ art: 'formular', modul: 'inventar' }) },
    // Tatsächlich verbunden (U-10): Ordner mit Berechtigung (Edge, Chrome) oder der Browserspeicher (Firefox, Safari);
    // ein Ordner aus einer früheren Sitzung ohne Freigabe zählt nicht
    { id: 'bibliothek', erledigt: bibliothekVerbunden(), href: routeZuHash({ art: 'bibliothek' }) },
    { id: 'gestaltung', erledigt: !!p.organisation.gestaltung, href: routeZuHash({ art: 'einstellungen', bereich: 'gestaltung' }) },
    { id: 'dokumente', erledigt: p.dokumente.length > 0, href: routeZuHash({ art: 'dokumente' }) },
  ];
  const offen = schritte.filter((x) => !x.erledigt).length;
  const naechster = schritte.find((x) => !x.erledigt)?.id;
  // Ring zeigt den Anteil (U-10): Bogen über die Länge des Kreises (Umfang 2π·7 ≈ 44)
  const anteil = (schritte.length - offen) / schritte.length;
  const zu = offen === 0 && !alleZeigen;
  return (
    <section class={`karte checkliste${zu ? ' zu' : ''}`} aria-labelledby="erste-schritte-titel" id="erste-schritte">
      <div class="ckopf">
        <h2 id="erste-schritte-titel">{tr('start.erste_schritte')}</h2>
        <span class="stand">
          <svg class={`ring${offen === 0 ? ' voll' : ''}`} viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" class="ring-grund" /><circle cx="9" cy="9" r="7" class="ring-wert" stroke-dasharray={`${(anteil * 43.98).toFixed(2)} 44`} /></svg>
          {tr('start.schritte_stand', { erledigt: schritte.length - offen, gesamt: schritte.length })}
        </span>
        <div class={`balken${offen === 0 ? ' voll' : ''}`} role="progressbar" aria-label={tr('start.erste_schritte')} aria-valuemin={0} aria-valuemax={schritte.length} aria-valuenow={schritte.length - offen}>
          <span style={{ width: `${Math.round(anteil * 100)}%` }} />
        </div>
        {offen === 0 && <button type="button" class="klein leise" id="erste-schritte-zeigen" aria-expanded={!zu} onClick={() => setAlleZeigen(!alleZeigen)}>{tr(zu ? 'start.schritte_zeigen' : 'start.schritte_verbergen')}</button>}
      </div>
      {!zu && <ol class="schritte">
        {schritte.map((x) => (
          <li key={x.id} class={`schrittzeile${x.erledigt ? ' erledigt' : ''}${x.id === naechster ? ' offen' : ''}`} data-schritt={x.id}>
            <span class={`schritt${x.erledigt ? ' erledigt' : ''}`} aria-hidden="true" />
            {x.id === naechster ? (
              <div class="schritt-inhalt">
                <h3 class="name">{tr(`start.schritt.${x.id}.titel`)}<span class="nur-sr">, {tr('guide.stand.offen')}</span></h3>
                <p>{tr(`start.schritt.${x.id}.text`)}</p>
                <a class="knopf" href={x.href}>{tr(`start.schritt.${x.id}.knopf`)}</a>
              </div>
            ) : (
              <a class="name" href={x.href}>{tr(`start.schritt.${x.id}.titel`)}<span class="nur-sr">, {tr(x.erledigt ? 'guide.stand.erledigt' : 'guide.stand.offen')}</span></a>
            )}
            {x.id !== naechster && <Symbol name="rechts" klasse="sym pfeil" />}
          </li>
        ))}
      </ol>}
    </section>
  );
}

/** Fällige Aufgaben als Tabelle im Stil des Mockups (Symbolkachel, Titel und Unterzeile, Status mit Punkt und Wort) */
export function FaelligTabelle({ liste, max }: { liste: readonly FaelligeAufgabe[]; max?: number }) {
  if (!liste.length) return <p class="g-leer">{tr('faellig.keine')}</p>;
  const zeigen = max ? liste.slice(0, max) : liste;
  const symbol: Record<FaelligeAufgabe['art'], string> = { ueberpruefung: 'kalender', kalender: 'guide', prozess: 'prozesse', massnahme: 'massnahme', bibliothek: 'bibliothek', geaendert: 'doc', fehlt: 'risiko' };
  return (
    <div class="tabelle-feld">
      <table class="tabelle kartenliste" data-liste="faellig">
        <thead>
          <tr><th scope="col">{tr('faellig.aufgabe')}</th><th scope="col" class="breit-nur">{tr('faellig.bereich')}</th><th scope="col">{tr('faellig.datum')}</th><th scope="col">{tr('faellig.stand')}</th></tr>
        </thead>
        <tbody>
          {zeigen.map((a, i) => (
            <tr key={`${a.art}-${a.id}-${i}`}>
              <td class="k-titel">
                <div class="zelle-symbol">
                  <span class="symbol" aria-hidden="true"><Symbol name={symbol[a.art]} /></span>
                  <div>
                    <a class="titel" href={routeZuHash(a.ziel)}>{a.titel || a.id}</a>
                    <div class="unter">{[a.id, tr(`faellig.art.${a.art}`)].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              </td>
              <td class="breit-nur unter" data-label={tr('faellig.bereich')}>{a.bereich}</td>
              <td class="unter" data-label={tr('faellig.datum')}>{a.datum ? datumText(a.datum) : ''}</td>
              <td class="k-status"><StatusPille art={a.stand === 'ueberfaellig' ? 'kritisch' : 'warnung'}>{tr(`faellig.${a.stand}`)}</StatusPille></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Willkommen({ p }: { p: Projekt }) {
  const liste = faelligListe.value;
  return (
    <>
      <section class="karte" aria-labelledby="faellig-titel" id="start-faellig">
        <div class="karte-kopf">
          <h2 id="faellig-titel">{tr('start.faellig')}</h2>
          {liste.length > 5 && <a href={routeZuHash({ art: 'uebersicht', unter: 'faellig' })}>{tr('start.alle_faelligen', { anzahl: liste.length })}</a>}
        </div>
        <FaelligTabelle liste={liste} max={5} />
      </section>
      <ErsteSchritte p={p} />
    </>
  );
}

export function Start({ unter }: { unter?: 'projekte' } = {}) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  const p = projekt.value;
  useEffect(() => titelRef.current?.focus(), [unter, !!p]);
  if (p && unter !== 'projekte') {
    const stunde = new Date().getHours();
    const gruss = tr(stunde < 11 ? 'start.gruss_morgen' : stunde < 18 ? 'start.gruss_tag' : 'start.gruss_abend');
    return (
      <div class="start">
        <Seitenkopf titel={gruss} titelRef={titelRef} aktion={<button type="button" class="primaer" id="start-ki-erfassen" onClick={kiSystemErfassen}><Symbol name="plus" />{tr('aktion.ki_erfassen')}</button>}
          unter={<p class="zweitext start-projekt">{tr('start.projekt_offen', { name: p.organisation.name || t('kopf.ohne_name') })}</p>} />
        <Willkommen p={p} />
        <section aria-labelledby="start-projekte-titel" class="start-projekte">
          <h2 id="start-projekte-titel">{tr('start.projekte')}</h2>
          <ProjekteBereich />
        </section>
      </div>
    );
  }
  return (
    <div class="start">
      {/* Ohne Hauptaktion im Kopf: die Seite selbst ist die Wahl zwischen neuem Projekt, Projektdatei und Beispiel */}
      <Seitenkopf titel={unter === 'projekte' ? tr('start.projekte') : t('start.titel')} titelRef={titelRef} />
      <Hinweis als="p" klasse="datenschutz">{t('start.datenschutz')}</Hinweis>
      <p>{t('start.einleitung')}</p>
      {p && (
        <p><a class="knopf" href={routeZuHash({ art: 'formular', modul: 'uebersicht' })}>{t('start.zurueck_projekt', { name: p.organisation.name || t('kopf.ohne_name') })}</a></p>
      )}
      <ProjekteBereich />
    </div>
  );
}

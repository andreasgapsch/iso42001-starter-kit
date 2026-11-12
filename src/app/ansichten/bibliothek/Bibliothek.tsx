// Bibliothek (R4): alle Dokumente mit Status, Version, Eigner, Prüftermin, Normbezug, Versionen und Vorschau.
// Dateien im verbundenen Ordner (Edge, Chrome) oder im Browserspeicher (Firefox, Safari) mit Sicherung als ZIP.
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { AbgleichBefund } from '../../../bibliothek/abgleich.ts';
import { archivieren, entwurfAenderbar, freigabeVersion, metadatenSetzen, statusWechseln, WECHSEL, type FreigabeAngaben } from '../../../bibliothek/aenderungen.ts';
import type { BibliothekStatus, BibliothekVerknuepfungen } from '../../../bibliothek/modell.ts';
import { imUnterbereich, pruefungFaellig, statusRang, tageBis, UNTERBEREICHE, type SichtEintrag, type SichtVersion } from '../../../bibliothek/sicht.ts';
import type { Projekt } from '../../../model/typen.ts';
import { holePfad } from '../../../i18n/texte.ts';
import { appDaten } from '../../daten.ts';
import { datumText, fachText, inhalt, uiSprache, zeitpunktText } from '../../i18n.ts';
import { Symbol } from '../../rahmen/symbole.tsx';
import { registriereSuchquelle, trefferRang } from '../../rahmen/suche-quellen.ts';
import { heute, melde, navigiere, projekt, route, stichtag } from '../../zustand/store.ts';
import { Vorschau } from './Vorschau.tsx';
import { freigabeDateiErneuern,
  abgleichen, ablage, aendern, arbeit, aussenUebernehmen, befunde, browserNutzen, bt, einchecken, firmendokumenteAblegen, herunterladenVersion, hochladen, neueAufnehmen,
  ordnerFreigeben, ordnerMoeglich, ordnerVerbinden, sichern, sicht, trennen, verbindung, verbindungPruefen, vorlageHerunterladen, wiederherstellen,
} from './zustand.ts';
import './bibliothek.css';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { StatusPille, type StatusArt } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { zweiterKlick } from '../../ui/beschaeftigt.ts';

// Globale Suche (R6): Treffer aus der Bibliothek
registriereSuchquelle({
  id: 'bibliothek',
  gruppe: () => bt('titel'),
  reihenfolge: 40,
  suche: (q, p) =>
    p
      ? sicht(p)
          .map((e) => ({ e, rang: trefferRang(q, e.id, e.titel, ...e.normbezug) }))
          .filter((x) => x.rang > 0)
          .map(({ e, rang }) => ({ titel: e.titel, unter: `${e.id} · ${bt(`art.${e.art}`)}`, href: `#/bibliothek/${e.art === 'vorlage' ? 'vorlagen' : 'alle'}/${encodeURIComponent(e.id)}`, icon: symbolVon(e).name, rang }))
      : [],
});

/** Versionsnummer als «v1.0»; Freitext (ältere Dateien, Plan-Freigabe) ohne Vorsatz, damit nicht «vFestgelegt» entsteht (C2-25) */
const versionText = (v?: string): string => (!v ? '' : /^\d/.test(v) ? `v${v}` : v);

/** Symbol je Format; ohne Statusfarbe, weil das Format kein Status ist (B8, V-07) */
function symbolVon(e: Pick<SichtEintrag, 'format' | 'art'>): { name: string } {
  const f = e.format ?? '';
  if (f === 'pdf') return { name: 'pdf' };
  if (f === 'xlsx' || f === 'csv' || f === 'xls') return { name: 'tabelle' };
  if (f === 'docx' || f === 'doc') return { name: 'doc' };
  return { name: e.art === 'nachweis' ? 'haken' : 'doc' };
}

const TON: Record<BibliothekStatus, StatusArt> = { entwurf: 'neutral', 'in-pruefung': 'warnung', freigegeben: 'gut', ersetzt: 'neutral', archiviert: 'neutral' };

export function statusText(e: Pick<SichtEintrag, 'art' | 'status'>, s: BibliothekStatus = e.status): string {
  if (e.art === 'vorlage' || e.art === 'rechtstext') return bt(`art.${e.art}`);
  if (e.art === 'nachweis' && s === 'freigegeben') return bt('status.abgelegt');
  return bt(`status.${s}`);
}

function StatusChip({ e, s = e.status }: { e: SichtEintrag; s?: BibliothekStatus }) {
  return <StatusPille art={e.schreibgeschuetzt ? 'info' : TON[s]}>{statusText(e, s)}</StatusPille>;
}

const personName = (p: Projekt, id?: string | number) => (id === undefined ? '' : (p.personen.find((x) => x.id === id)?.name ?? String(id)));

function FaelligChip({ e }: { e: SichtEintrag }) {
  const f = pruefungFaellig(e, stichtag.value);
  if (!f) return null;
  return <StatusPille art={f === 'ueberfaellig' ? 'kritisch' : 'warnung'}>{bt(`faellig.${f}`, { tage: Math.abs(tageBis(stichtag.value, e.naechstePruefung!)) })}</StatusPille>;
}

// ---------- Verbindung ----------

function VerbindungLeiste({ p, anzahl }: { p: Projekt; anzahl: number }) {
  const v = verbindung.value;
  const laeuft = !!arbeit.value;
  const zip = useRef<HTMLInputElement>(null);
  const am = p.bibliothek?.abgleich?.am;
  if (v === 'ordner') {
    return (
      <div class="bib-ordner" id="bib-verbindung">
        <Symbol name="ordner" />
        <span>{bt('verbindung.ordner')} <b>{ablage.value?.name}</b> · {bt('verbindung.anzahl', { anzahl })}{am ? ` · ${bt('verbindung.abgleich_am', { zeit: zeitpunktText(am) })}` : ''}</span>
        <span class="bib-ordner-knoepfe">
          <button type="button" class="klein" id="bib-abgleichen" disabled={laeuft} onClick={() => void abgleichen()}>{bt('aktion.abgleichen')}</button>
          <button type="button" class="klein leise" id="bib-trennen" disabled={laeuft} onClick={() => void trennen()}>{bt('aktion.trennen')}</button>
        </span>
      </div>
    );
  }
  if (v === 'browser') {
    const gesichert = p.bibliothek?.gesichertAm;
    return (
      <div class="karte bib-hinweis" id="bib-verbindung">
        <p><b>{bt('verbindung.browser_titel')}</b> {bt('verbindung.browser_text')} {gesichert ? bt('verbindung.gesichert_am', { zeit: zeitpunktText(gesichert) }) : bt('verbindung.nie_gesichert')}</p>
        <div class="leiste">
          <button type="button" class="klein" id="bib-sichern" disabled={laeuft || !anzahl} onClick={(ev) => !zweiterKlick(ev) && void sichern()}>{bt('aktion.sichern')}</button>
          <button type="button" class="klein" id="bib-laden" disabled={laeuft} onClick={() => zip.current?.click()}>{bt('aktion.laden')}</button>
          <input ref={zip} type="file" accept=".zip,application/zip" hidden id="bib-laden-datei" onChange={(ev) => {
            const f = ev.currentTarget.files?.[0];
            ev.currentTarget.value = '';
            if (f) void wiederherstellen(f);
          }} />
          {ordnerMoeglich() && <button type="button" class="klein leise" disabled={laeuft} onClick={() => void ordnerVerbinden()}>{bt('aktion.zum_ordner')}</button>}
        </div>
      </div>
    );
  }
  return (
    <div class="karte bib-hinweis" id="bib-verbindung">
      {v === 'freigabe' ? (
        <>
          <p>{bt('verbindung.freigabe_text', { name: p.bibliothek?.ordnerName ?? '' })}</p>
          <button type="button" id="bib-freigeben" disabled={laeuft} onClick={() => void ordnerFreigeben()}>{bt('aktion.freigeben_ordner')}</button>
        </>
      ) : (
        <>
          <p><b>{bt('verbindung.keine_titel')}</b> {ordnerMoeglich() ? bt('verbindung.keine_text') : bt('verbindung.ohne_fsa')}</p>
          {p.bibliothek?.ablage === 'ordner' && !ordnerMoeglich() && <p class="zweitext">{bt('verbindung.ordner_anderswo', { name: p.bibliothek.ordnerName ?? '' })}</p>}
          <div class="leiste">
            {ordnerMoeglich() && <button type="button" id="bib-ordner-verbinden" disabled={laeuft} onClick={() => void ordnerVerbinden()}><Symbol name="ordner" />{bt('aktion.verbinden')}</button>}
            <button type="button" class={ordnerMoeglich() ? 'leise' : undefined} id="bib-browser" disabled={laeuft} onClick={browserNutzen}>{bt('aktion.browser')}</button>
          </div>
        </>
      )}
    </div>
  );
}

function AbgleichListe({ p }: { p: Projekt }) {
  const b = befunde.value;
  if (!b.length) return null;
  const laeuft = !!arbeit.value;
  const fehlen = b.filter((x) => x.art === 'fehlt').length;
  return (
    <>
    {fehlen > 0 && verbindung.value === 'browser' && (
      <Hinweis art="warnung" role="alert" id="bib-dateien-fehlen">
        <p><strong>{bt('abgleich.fehlen_titel', { anzahl: fehlen })}</strong> {bt('abgleich.fehlen_text')}</p>
        <button type="button" class="klein" id="bib-fehlen-laden" disabled={laeuft} onClick={() => (document.getElementById('bib-laden-datei') as HTMLInputElement | null)?.click()}>{bt('aktion.laden')}</button>
      </Hinweis>
    )}
    <section class="karte bib-abgleich" id="bib-abgleich" aria-labelledby="bib-abgleich-titel">
      <h2 id="bib-abgleich-titel">{bt('abgleich.titel', { anzahl: b.length })}</h2>
      <ul>
        {b.map((x: AbgleichBefund) => (
          <li key={`${x.art}-${x.pfad}`} data-art={x.art}>
            <StatusPille art={x.art === 'fehlt' ? 'kritisch' : x.art === 'neu' ? 'info' : 'warnung'}>{bt(`abgleich.${x.art}`)}</StatusPille>
            <span class="bib-pfad">{x.id ? `${x.id} v${x.version}: ` : ''}{x.pfad}</span>
            <span class="leiste">
              {x.art === 'geaendert' && (
                <button type="button" class="klein" disabled={laeuft} onClick={() => void aussenUebernehmen(x)}>
                  {entwurfAenderbar(p, x.id!, x.pfad) ? bt('aktion.aenderung_uebernehmen') : bt('aktion.als_version')}
                </button>
              )}
              {x.art === 'neu' && (
                <>
                  <button type="button" class="klein" disabled={laeuft} onClick={() => void neueAufnehmen(x, 'eigene')}>{bt('aktion.aufnehmen_eigene')}</button>
                  <button type="button" class="klein" disabled={laeuft} onClick={() => void neueAufnehmen(x, 'nachweis')}>{bt('aktion.aufnehmen_nachweis')}</button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}

// ---------- Detail ----------

const VERKNUEPFUNG: (keyof BibliothekVerknuepfungen)[] = ['kiSysteme', 'risiken', 'controls', 'prozesse', 'nachweise'];
const liste = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

/** Datum einer Freigabe: das echte Datum, nicht der Stichtag */
const freigabeDatum = () => heute();

/** Sammelaktion (C-13): alle Entwürfe zur Prüfung, alle Dokumente in Prüfung mit denselben Angaben freigeben; Vier-Augen-Regel bleibt */
function Sammelaktionen({ p, alle }: { p: Projekt; alle: SichtEintrag[] }) {
  const firma = alle.filter((e) => e.art === 'firmendokument' && e.versionen.length);
  const entwuerfe = firma.filter((e) => e.status === 'entwurf');
  const inPruefung = firma.filter((e) => e.status === 'in-pruefung');
  const h = freigabeDatum();
  const [pruefer, setPruefer] = useState('');
  const [freigeber, setFreigeber] = useState('');
  if (!firma.length) return null;
  const personen = (id: string, wert: string, setze: (v: string) => void) => (
    <Auswahl id={id} value={wert} onChange={(ev) => setze(ev.currentTarget.value)}>
      <option value="">{bt('feld.waehlen')}</option>
      {p.personen.map((x) => <option key={x.id} value={x.id}>{x.name}{x.funktion ? `, ${x.funktion}` : ''}</option>)}
    </Auswahl>
  );
  const freigeben = async () => {
    const angaben: FreigabeAngaben = { geprueft: { von: pruefer, am: h }, freigabe: { von: freigeber, am: h } };
    const nicht: string[] = [];
    let ok = 0;
    for (const e of inPruefung) {
      let r: ReturnType<typeof statusWechseln> = { warnungen: [] };
      aendern((x) => void (r = statusWechseln(x, e.id, e.art, 'freigegeben', { ...angaben, aenderung: bt('sammel.aenderung') })));
      if (r.fehler) {
        nicht.push(e.id);
        continue;
      }
      ok++;
      const art = await freigabeDateiErneuern(e.id).catch(() => 'fehler' as const);
      if (art === 'fehler' || art === 'extern') nicht.push(e.id);
    }
    melde(nicht.length ? bt('sammel.teilweise', { anzahl: ok, fehler: nicht.length, ids: nicht.slice(0, 8).join(', ') }) : bt('sammel.fertig', { anzahl: ok }), nicht.length ? 'fehler' : 'ok');
  };
  return (
    <details class="karte abschnitt bib-sammel" id="bib-sammel">
      <summary>{bt('sammel.titel')}</summary>
      <p class="zweitext">{bt('naechste_schritte')}</p>
      <p class="zweitext">{bt('sammel.text')}</p>
      <div class="leiste">
        <button type="button" id="bib-sammel-pruefung" disabled={!entwuerfe.length} onClick={() => {
          aendern((x) => { for (const e of entwuerfe) statusWechseln(x, e.id, e.art, 'in-pruefung'); });
          melde(bt('sammel.fertig', { anzahl: entwuerfe.length }), 'ok');
        }}>{bt('sammel.zur_pruefung', { anzahl: entwuerfe.length })}</button>
      </div>
      <div class="bib-formular">
        <label for="bib-sammel-pruefer">{bt('feld.geprueft_von')}</label>
        {personen('bib-sammel-pruefer', pruefer, setPruefer)}
        <label for="bib-sammel-freigeber">{bt('feld.freigabe_von')}</label>
        {personen('bib-sammel-freigeber', freigeber, setFreigeber)}
      </div>
      <div class="leiste">
        <button type="button" id="bib-sammel-freigeben" disabled={!inPruefung.length || !pruefer || !freigeber || pruefer === freigeber} onClick={() => void freigeben()}>{bt('sammel.freigeben', { anzahl: inPruefung.length })}</button>
      </div>
    </details>
  );
}

function Freigabe({ p, e, schliessen }: { p: Projekt; e: SichtEintrag; schliessen: () => void }) {
  const h = freigabeDatum();
  const regel = p.organisation.dokumentenlenkung?.freigabe;
  // A-08: Personen vorbelegt, Freigabe in drei Schritten (zur Prüfung, «Freigeben …», «Freigeben»).
  // Freigabe nach der Regel der Dokumentenlenkung (Eigner/in, Geschäftsleitung, sonst AIMS-Verantwortung); geprüft hat die
  // Eignerin oder der Eigner, ist sie oder er schon Freigebende/r, die AIMS-Verantwortung. Nie dieselbe Person.
  const [a, setA] = useState<FreigabeAngaben>(() => {
    const da = (id: string | undefined) => (id && p.personen.some((x) => x.id === id) ? id : '');
    const aims = da(p.organisation.aimsVerantwortlich);
    const gl = da(p.personen.find((x) => x.aimsRollen.includes('gl'))?.id);
    const eigner = da(e.eigner);
    const fg = regel === 'eigner' ? eigner : regel === 'geschaeftsleitung' ? gl : aims;
    const gp = [eigner, aims, gl].find((x) => x && x !== fg) ?? '';
    return { geprueft: { von: gp, am: h }, freigabe: { von: fg, am: h }, aenderung: '' };
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const gleich = !!a.geprueft?.von && a.geprueft.von === a.freigabe?.von;
  const huelle = useRef<HTMLFieldSetElement>(null);
  // Formular sichtbar machen und den Fokus hineinsetzen (U-24): es erscheint unten in der Detailspalte
  useEffect(() => {
    huelle.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    huelle.current?.querySelector<HTMLElement>('[role=combobox], input')?.focus({ preventScroll: true });
  }, []);
  const version = e.version ?? '';
  const andere = [...e.versionen.map((v) => v.version).filter((v) => v !== version), ...(e.register?.version && e.register.version !== version ? [e.register.version] : [])];
  const neueNummer = freigabeVersion(version, andere);
  // Änderungstext erst, wenn schon eine Fassung freigegeben war (Erstfassung: nichts zu vergleichen)
  const mitAenderung = e.versionen.some((v) => v.version !== version && !!v.freigabe) || !!(e.register?.freigabe && e.register.version !== version);
  const personen = (id: string, wert: string, setze: (v: string) => void, fehlt = false) => (
    <Auswahl id={id} value={wert} onChange={(ev) => setze(ev.currentTarget.value)} aria-invalid={fehlt ? 'true' : undefined} aria-describedby={fehlt ? 'bib-fg-gleich' : undefined}>
      <option value="">{bt('feld.waehlen')}</option>
      {p.personen.map((x) => <option key={x.id} value={x.id}>{x.name}{x.funktion ? `, ${x.funktion}` : ''}</option>)}
    </Auswahl>
  );
  const absenden = () => {
    let r: ReturnType<typeof statusWechseln> = { warnungen: [] };
    // Text für die nachgetragene ältere Version in der Dokumentsprache (Änderungshistorie D-26)
    const text = holePfad(appDaten().texte[p.meta.dokumentSprache], `vorlagen.D-26.register.aenderung_${e.register?.version === '1.0' ? 'erstfassung' : 'ohne_historie'}`);
    const angaben: FreigabeAngaben = { ...a, textAeltere: typeof text === 'string' ? text : '' };
    aendern((x) => void (r = statusWechseln(x, e.id, e.art, 'freigegeben', angaben)));
    if (r.fehler) {
      setFehler(bt(`fehler.${r.fehler}`));
      return;
    }
    schliessen();
    // Datei des Generators trägt danach die Freigabe im Kopf; eigene Dateien bleiben unverändert und erhalten einen Hinweis
    void freigabeDateiErneuern(e.id).then((art) => {
      const zusatz = art === 'eigene' ? [bt('meldung.freigegeben_eigene')] : art === 'erneuert' ? [bt('meldung.freigegeben_erneuert')] : art === 'extern' ? [bt('fehler.datei_extern', { id: e.id })] : [];
      melde([bt('meldung.freigegeben', { id: e.id, version: neueNummer }), ...zusatz, ...r.warnungen.map((w) => bt(`warnung.${w}`))].join(' '), art === 'extern' ? 'fehler' : r.warnungen.length || art === 'eigene' ? 'info' : 'ok', art === 'extern' ? 30_000 : 6000);
    }, (x: unknown) => melde(`${bt('fehler.datei_erneuern')}: ${fehlerVerstaendlich(x)}`, 'fehler'));
  };
  return (
    <fieldset class="bib-freigabe" id="bib-freigabe" ref={huelle}>
      <legend>{bt('freigabe.titel', { version: neueNummer })}</legend>
      {e.versionen.at(-1)?.quelle !== 'generator' && <Hinweis als="p" id="bib-freigabe-eigene">{bt('freigabe.eigene_datei')}</Hinweis>}
      {neueNummer !== version && <p class="zweitext" id="bib-freigabe-nummer">{bt('freigabe.nummer', { entwurf: version, version: neueNummer })}</p>}
      <p class="zweitext">{bt(`freigabe.regel_${regel === 'eigner' || regel === 'aims' || regel === 'geschaeftsleitung' ? regel : 'standard'}`)}</p>
      <div class="bib-felder">
        <label for="bib-gp-von">{bt('feld.geprueft_von')}</label>
        {personen('bib-gp-von', String(a.geprueft?.von ?? ''), (v) => setA({ ...a, geprueft: { von: v, am: a.geprueft?.am ?? h } }))}
        <label for="bib-gp-am">{bt('feld.am')}</label>
        <input type="date" id="bib-gp-am" value={a.geprueft?.am} onInput={(ev) => setA({ ...a, geprueft: { von: a.geprueft?.von ?? '', am: ev.currentTarget.value } })} />
        <label for="bib-fg-von">{bt('feld.freigabe_von')}</label>
        <span class={gleich ? 'fehlt' : undefined}>
          {personen('bib-fg-von', String(a.freigabe?.von ?? ''), (v) => setA({ ...a, freigabe: { von: v, am: a.freigabe?.am ?? h } }), gleich)}
          {/* Dauerhafte Live-Region (Prüfung test.7 N13): Bildschirmleser melden den Text, sobald er erscheint */}
          <span class="fehltext" id="bib-fg-gleich" aria-live="polite">{gleich ? bt('fehler.gleiche-person') : ''}</span>
        </span>
        <label for="bib-fg-am">{bt('feld.am')}</label>
        <input type="date" id="bib-fg-am" value={a.freigabe?.am} onInput={(ev) => setA({ ...a, freigabe: { von: a.freigabe?.von ?? '', am: ev.currentTarget.value } })} />
        {mitAenderung && (
          <>
            <label for="bib-aenderung">{bt('feld.aenderung')}</label>
            <input type="text" id="bib-aenderung" value={a.aenderung} onInput={(ev) => setA({ ...a, aenderung: ev.currentTarget.value })} />
          </>
        )}
      </div>
      {fehler && <Hinweis als="p" art="fehler" role="alert">{fehler}</Hinweis>}
      <div class="leiste">
        <button type="button" id="bib-freigabe-ok" onClick={absenden}>{bt('aktion.freigeben')}</button>
        <button type="button" class="leise" onClick={schliessen}>{bt('aktion.abbrechen')}</button>
      </div>
    </fieldset>
  );
}

function Metadaten({ p, e }: { p: Projekt; e: SichtEintrag }) {
  const setze = (m: Parameters<typeof metadatenSetzen>[3]) => aendern((x) => metadatenSetzen(x, e.id, e.art, m));
  const id = (s: string) => `bib-m-${s}`;
  return (
    <details class="bib-meta">
      <summary>{bt('detail.bearbeiten')}</summary>
      <div class="bib-felder">
        {e.art !== 'firmendokument' && (
          <>
            <label for={id('titel')}>{bt('feld.titel')}</label>
            <input type="text" id={id('titel')} value={e.titel} onChange={(ev) => setze({ titel: ev.currentTarget.value })} />
          </>
        )}
        <label for={id('eigner')}>{bt('feld.eigner')}</label>
        <Auswahl id={id('eigner')} value={e.eigner ?? ''} onChange={(ev) => setze({ eigner: ev.currentTarget.value || undefined })}>
          <option value="">{bt('feld.keiner')}</option>
          {p.personen.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Auswahl>
        <label for={id('pruefung')}>{bt('feld.naechste_pruefung')}</label>
        <input type="date" id={id('pruefung')} value={e.naechstePruefung ?? ''} onChange={(ev) => setze({ naechstePruefung: ev.currentTarget.value || undefined })} />
        <label for={id('norm')}>{bt('feld.normbezug')}</label>
        <input type="text" id={id('norm')} value={e.normbezug.join(', ')} placeholder="6.1.2, A.5.4" onChange={(ev) => setze({ normbezug: liste(ev.currentTarget.value) })} />
        {VERKNUEPFUNG.map((k) => (
          <Fragment key={k}>
            <label for={id(k)}>{bt(`verknuepfung.${k}`)}</label>
            <input type="text" id={id(k)} value={(e.verknuepfungen[k] ?? []).join(', ')} onChange={(ev) => setze({ verknuepfungen: { ...e.verknuepfungen, [k]: liste(ev.currentTarget.value) } })} />
          </Fragment>
        ))}
        <label for={id('beschreibung')}>{bt('feld.beschreibung')}</label>
        <textarea id={id('beschreibung')} rows={2} value={e.beschreibung ?? ''} onChange={(ev) => setze({ beschreibung: ev.currentTarget.value })} />
      </div>
    </details>
  );
}

function Detail({ p, e }: { p: Projekt; e: SichtEintrag }) {
  const [freigabe, setFreigabe] = useState(false);
  const [vorschau, setVorschau] = useState<SichtVersion | null>(null);
  const [projektVorschau, setProjektVorschau] = useState(false);
  const [haupt, setHaupt] = useState(false);
  const datei = useRef<HTMLInputElement>(null);
  const titel = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setFreigabe(false);
    setVorschau(null);
    setProjektVorschau(false);
  }, [e.id, e.versionen.length]);
  const laeuft = !!arbeit.value;
  const verbunden = !!ablage.value;
  const neueste = e.versionen.at(-1);
  const jetzt: BibliothekStatus = neueste ? (e.register && e.register.version === neueste.version && e.register.status !== 'veraltet' ? (e.register.status as BibliothekStatus) : neueste.status) : e.status;
  const wechsel = e.status === 'archiviert' || e.schreibgeschuetzt || !neueste ? [] : WECHSEL[jetzt];
  const s = symbolVon(e);
  const verknuepft = VERKNUEPFUNG.flatMap((k) => e.verknuepfungen[k] ?? []);
  const zeile = (dt: string, dd: ComponentChildren) => (dd ? <><dt>{dt}</dt><dd>{dd}</dd></> : null);
  const wechseln = (ziel: BibliothekStatus) => {
    if (ziel === 'freigegeben') return setFreigabe(true);
    let r: ReturnType<typeof statusWechseln> = { warnungen: [] };
    aendern((x) => void (r = statusWechseln(x, e.id, e.art, ziel)));
    melde(r.fehler ? bt(`fehler.${r.fehler}`) : bt('meldung.status', { id: e.id, status: statusText(e, ziel) }), r.fehler ? 'fehler' : 'ok');
  };
  return (
    <aside class="karte bib-detail" id="bib-detail" aria-labelledby="bib-detail-titel">
      <span class="bib-symbol"><Symbol name={s.name} /></span>
      <h2 id="bib-detail-titel" tabIndex={-1} ref={titel}>{e.titel}</h2>
      <div class="zweitext">{e.id} · {bt(`art.${e.art}`)}{e.nachweis ? ` · ${inhalt(`gefuehrt.optionen.nachweisArt.${e.nachweis.art}`) ?? e.nachweis.art}` : ''}</div>
      <dl>
        <dt>{bt('feld.status')}</dt>
        <dd><StatusChip e={e} /> <FaelligChip e={e} /></dd>
        {zeile(bt('feld.version'), e.version ? `${e.version}${e.gueltig && e.gueltig !== e.version ? ` (${bt('detail.gueltig', { version: e.gueltig })})` : ''}` : e.schreibgeschuetzt ? '' : bt('detail.ohne_version'))}
        {zeile(bt('feld.eigner'), personName(p, e.eigner))}
        {zeile(bt('feld.geprueft_von'), e.geprueft ? `${personName(p, e.geprueft.von)}, ${datumText(e.geprueft.am)}` : '')}
        {zeile(bt('feld.freigabe_von'), e.freigabe ? `${personName(p, e.freigabe.von)}, ${datumText(e.freigabe.am)}` : '')}
        {zeile(bt('feld.naechste_pruefung'), datumText(e.naechstePruefung))}
        {zeile(bt('feld.normbezug'), fachText(e.normbezug.join(', ')))}
        {zeile(bt('feld.verknuepft'), verknuepft.join(', '))}
        {zeile(bt('feld.ablageort'), e.register?.ablageort ?? e.nachweis?.ablageort ?? '')}
        {zeile(bt('feld.beschreibung'), e.beschreibung)}
      </dl>
      <div class="leiste bib-aktionen">
        {e.art === 'rechtstext' && e.pfad && <a class="knopf" href={e.pfad} target="_blank" rel="noopener" id="bib-oeffnen">{bt('aktion.oeffnen')}</a>}
        {e.art === 'vorlage' && e.pfad && <button type="button" id="bib-vorlage" disabled={laeuft} onClick={(ev) => !zweiterKlick(ev) && void vorlageHerunterladen(e.pfad!)}>{bt('aktion.vorlage')}</button>}
        {!e.schreibgeschuetzt && verbunden && e.status !== 'archiviert' && (
          <>
            <button type="button" id="bib-einchecken" disabled={laeuft} onClick={() => datei.current?.click()}>{bt('aktion.einchecken')}</button>
            <input ref={datei} type="file" hidden id="bib-einchecken-datei" onChange={(ev) => {
              const f = ev.currentTarget.files?.[0];
              ev.currentTarget.value = '';
              if (f) void einchecken(e, f, haupt);
            }} />
          </>
        )}
        {neueste && verbunden && <button type="button" id="bib-herunterladen" disabled={laeuft} onClick={(ev) => !zweiterKlick(ev) && void herunterladenVersion(e, neueste)}>{bt('aktion.herunterladen')}</button>}
        {neueste && verbunden && <button type="button" id="bib-vorschau" aria-pressed={!!vorschau} disabled={laeuft} onClick={() => setVorschau(vorschau ? null : neueste)}>{bt('aktion.vorschau')}</button>}
        {!verbunden && e.art === 'firmendokument' && (
          <button type="button" id="bib-vorschau-projekt" aria-pressed={projektVorschau} disabled={laeuft} onClick={() => setProjektVorschau(!projektVorschau)}>{bt('aktion.vorschau_projekt')}</button>
        )}
      </div>
      {!verbunden && !e.schreibgeschuetzt && <p class="zweitext" id="bib-ohne-ablage">{bt(e.art === 'firmendokument' ? 'detail.ohne_ablage_firma' : 'detail.ohne_ablage')}</p>}
      {!e.schreibgeschuetzt && verbunden && e.art !== 'nachweis' && e.status !== 'archiviert' && (
        <label class="bib-haken"><input type="checkbox" checked={haupt} onChange={(ev) => setHaupt(ev.currentTarget.checked)} /> {bt('detail.hauptversion')}</label>
      )}
      {wechsel.length > 0 && !freigabe && (
        <div class="leiste bib-wechsel">
          {wechsel.map((z) => <button type="button" class="klein" key={z} id={`bib-status-${z}`} disabled={laeuft} onClick={() => wechseln(z)}>{bt(`wechsel.${z}`)}</button>)}
        </div>
      )}
      {freigabe && <Freigabe p={p} e={e} schliessen={() => setFreigabe(false)} />}
      {vorschau && <Vorschau p={p} e={e} v={vorschau} />}
      {projektVorschau && !verbunden && <Vorschau p={p} e={e} nurProjekt />}
      {!e.schreibgeschuetzt && <Metadaten p={p} e={e} />}
      {e.versionen.length > 0 && (
        <div class="bib-versionen">
          <h3>{bt('detail.versionen')}</h3>
          <ul>
            {[...e.versionen].reverse().map((v) => (
              <li key={v.version}>
                <b>v{v.version}</b>
                <span>{statusText(e, v.status)}{v.entwurf ? ` (${bt('detail.aus_entwurf', { version: v.entwurf })})` : ''}, {datumText((v.freigabe?.am ?? v.datum).slice(0, 10))}{v.ueberschrieben ? `, ${bt('detail.ueberschrieben')}` : ''}</span>
                {verbunden && <button type="button" class="klein leise" aria-label={bt('aktion.version_laden', { version: v.version })} onClick={() => void herunterladenVersion(e, v)}><Symbol name="hoch" /></button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!e.schreibgeschuetzt && (
        <div class="leiste">
          <button type="button" class="klein leise" id="bib-archivieren" disabled={laeuft} onClick={() => aendern((x) => archivieren(x, e.id, e.art, e.status !== 'archiviert'))}>
            {bt(e.status === 'archiviert' ? 'aktion.zurueckholen' : 'aktion.archivieren')}
          </button>
        </div>
      )}
      <p class="bib-regel">{e.schreibgeschuetzt ? bt(`detail.hinweis_${e.art}`) : bt('detail.hinweis_d26')}</p>
    </aside>
  );
}

// ---------- Seite ----------

function vergleiche(a: SichtEintrag, b: SichtEintrag, nach: string): number {
  if (nach === 'status') return statusRang(a.status) - statusRang(b.status);
  if (nach === 'pruefung') return (a.naechstePruefung ?? '9999').localeCompare(b.naechstePruefung ?? '9999');
  return 0;
}

export function Bibliothek({ unterbereich }: { unterbereich?: string }) {
  const p = projekt.value;
  const u = (UNTERBEREICHE as readonly string[]).includes(unterbereich ?? '') ? unterbereich! : 'alle';
  const r = route.value;
  const gewaehlt = r.art === 'bibliothek' ? r.id : undefined;
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState('');
  const [norm, setNorm] = useState('');
  const [ziehen, setZiehen] = useState(false);
  const datei = useRef<HTMLInputElement>(null);
  const titel = useRef<HTMLHeadingElement>(null);
  useEffect(() => titel.current?.focus(), [u]);
  useEffect(() => {
    if (p) void verbindungPruefen(p);
  }, [p?.meta.projektId]);
  const alle = useMemo(() => (p ? sicht(p) : []), [p, uiSprache.value]);
  if (!p) return <div class="inhalt"><Seitenkopf titel={bt('titel')} /></div>;
  const h = stichtag.value;
  // «Norm 8.2», «Kapitel 6.1» oder «Control A.5.4» finden dasselbe wie die Nummer allein (U-20)
  const q = suche.trim().toLowerCase().replace(/^(?:iso\/iec 42001|norm|kapitel|abschnitt|clause|control)\s+/, '');
  const normen = [...new Set(alle.flatMap((e) => e.normbezug))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  const passtNorm = (e: SichtEintrag) => !norm || e.normbezug.some((x) => x === norm || x.startsWith(`${norm}.`));
  const zeilen = alle
    .filter((e) => imUnterbereich(e, u, h))
    .filter(passtNorm)
    .filter((e) => !q || [e.id, e.titel, personName(p, e.eigner), ...e.normbezug, e.beschreibung ?? ''].some((x) => x.toLowerCase().includes(q)))
    .sort((a, b) => vergleiche(a, b, sortierung));
  const auswahl = alle.find((e) => e.id === gewaehlt);
  const anzahl = alle.filter((e) => e.versionen.length).length;
  const verbunden = !!ablage.value;
  const zielArt = u === 'nachweise' ? 'nachweis' : 'eigene';
  const waehle = (id: string) => navigiere({ art: 'bibliothek', unter: u, id });
  const laden = async (files: File[]) => {
    const id = await hochladen(files, zielArt);
    if (id) waehle(id);
  };
  const arbeitText = arbeit.value;
  return (
    <div class="inhalt bib-seite">
      <Seitenkopf titel={<>{bt('titel')}{u !== 'alle' ? <span class="zweitext"> · {bt(`unter.${u}`)}</span> : null}</>} titelRef={titel}
        aktion={<button type="button" class="primaer" id="bib-hochladen" disabled={!verbunden || !!arbeitText} aria-describedby={verbunden ? undefined : 'bib-hochladen-hinweis'} title={verbunden ? bt(`hochladen.${zielArt}`) : undefined} onClick={() => datei.current?.click()}>
          <Symbol name="hoch" />{bt('aktion.hochladen')}
        </button>}
        unter={!verbunden && <p class="zweitext bib-hochladen-hinweis" id="bib-hochladen-hinweis">{bt('hochladen.erst_ablage')}</p>} />
      <div class="bib-kopf">
        <label class="bib-suche">
          <span class="nur-sr">{bt('suche')}</span>
          <Symbol name="suche" />
          <input type="search" id="bib-suche" placeholder={bt('suche')} value={suche} onInput={(ev) => setSuche(ev.currentTarget.value)} />
        </label>
        {normen.length > 0 && (
          <label class="bib-norm">
            <span class="nur-sr">{bt('norm.filter')}</span>
            <Auswahl id="bib-norm" value={norm} onChange={(ev) => setNorm(ev.currentTarget.value)}>
              <option value="">{bt('norm.alle')}</option>
              {normen.map((x) => <option key={x} value={x}>{bt('norm.wert', { norm: x })}</option>)}
            </Auswahl>
          </label>
        )}
        <input ref={datei} type="file" multiple hidden id="bib-datei" onChange={(ev) => {
          const f = [...(ev.currentTarget.files ?? [])];
          ev.currentTarget.value = '';
          void laden(f);
        }} />
      </div>
      <VerbindungLeiste p={p} anzahl={anzahl} />
      {verbunden && <Sammelaktionen p={p} alle={alle} />}
      <p class="nur-sr" role="status" aria-live="polite">{arbeitText ?? ''}</p>
      {arbeitText && <p class="bib-arbeit" aria-hidden="true">{arbeitText}</p>}
      <AbgleichListe p={p} />
      {(u === 'firma' || u === 'alle') && verbunden && (
        <p class="leiste bib-erzeugen">
          <button type="button" id="bib-erzeugen" disabled={!!arbeitText} aria-busy={arbeitText === bt('arbeit.erzeugen') ? 'true' : undefined} onClick={() => void firmendokumenteAblegen()}><Symbol name="erzeugen" />{bt('aktion.erzeugen')}</button>
          <span class="zweitext">{bt('hochladen.erzeugen_hinweis')}</span>
        </p>
      )}
      <div class={`bib-raster${auswahl ? ' mit-detail' : ''}`}>
        <div
          class={`karte bib-tabelle${ziehen ? ' ziehen' : ''}`}
          onDragOver={(ev) => {
            if (!verbunden || !ev.dataTransfer?.types.includes('Files')) return;
            ev.preventDefault();
            setZiehen(true);
          }}
          onDragLeave={() => setZiehen(false)}
          onDrop={(ev) => {
            setZiehen(false);
            if (!verbunden) return;
            ev.preventDefault();
            void laden([...(ev.dataTransfer?.files ?? [])]);
          }}
        >
          <table class="kartenliste">
            <caption class="nur-sr">{bt('tabelle.titel', { anzahl: zeilen.length })}</caption>
            <thead>
              <tr>
                <th scope="col">{bt('tabelle.dokument')}</th>
                <th scope="col" aria-sort={sortierung === 'status' ? 'ascending' : undefined}><button type="button" class="bib-sort" onClick={() => setSortierung(sortierung === 'status' ? '' : 'status')}>{bt('tabelle.status')}</button></th>
                <th scope="col" class="bib-schmal">{bt('tabelle.version')}</th>
                <th scope="col" class="bib-schmal">{bt('tabelle.gueltig')}</th>
                <th scope="col" class="bib-schmal" aria-sort={sortierung === 'pruefung' ? 'ascending' : undefined}><button type="button" class="bib-sort" onClick={() => setSortierung(sortierung === 'pruefung' ? '' : 'pruefung')}>{bt('tabelle.pruefung')}</button></th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((e) => {
                const s = symbolVon(e);
                return (
                  <tr key={e.id} class={e.id === gewaehlt ? 'gewaehlt' : undefined} onClick={() => waehle(e.id)}>
                    <td class="k-titel">
                      <div class="bib-zelle">
                        <span class="bib-symbol" aria-hidden="true"><Symbol name={s.name} /></span>
                        <div>
                          <a class="bib-titel" href={`#/bibliothek/${u}/${encodeURIComponent(e.id)}`} aria-current={e.id === gewaehlt ? 'true' : undefined} onClick={(ev) => ev.stopPropagation()}>{e.titel}</a>
                          <div class="zweitext">{e.id} · {bt(`art.${e.art}`)}</div>
                        </div>
                      </div>
                    </td>
                    <td class="k-status"><StatusChip e={e} /> <FaelligChip e={e} /></td>
                    <td class="zweitext bib-schmal" data-label={bt('tabelle.version')}>{versionText(e.version)}</td>
                    <td class="zweitext bib-schmal" data-label={bt('tabelle.gueltig')}>{versionText(e.gueltig)}</td>
                    <td class="zweitext bib-schmal" data-label={bt('tabelle.pruefung')}>{datumText(e.naechstePruefung)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!zeilen.length && <p class="bib-leer" id="bib-leer">{q ? bt('tabelle.kein_treffer') : bt(`leer.${u}`)}</p>}
          {verbunden && !auswahl && <p class="bib-ziehen-hinweis zweitext">{bt(`hochladen.ziehen_${zielArt}`)}</p>}
        </div>
        {auswahl && <Detail p={p} e={auswahl} />}
      </div>
    </div>
  );
}

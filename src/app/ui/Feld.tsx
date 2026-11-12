// Eingabefeld für alle Feldtypen des Guides (FORMAT.md, Feldtypen). Wird auch in den Formularansichten verwendet.
import { Symbol } from '../rahmen/symbole.tsx';
import { jsonAusVertrauen } from '../../eingang/lesen.ts';
import { KURZE_FELDER, TEXT_GRENZEN } from '../import/laden.ts';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Person, Projekt } from '../../model/typen.ts';
import { appDaten, controlIds42001, euaiaControls, rmfControls } from '../daten.ts';
import { dokumentTitelUi, inhalt, inhaltRoh, optionText, t } from '../i18n.ts';
import { neuerEintrag, neueTabellenZeile } from '../logik/eintraege.ts';
import type { FeldDef } from '../logik/gefuehrt-typen.ts';
import { vergibId } from '../logik/ids.ts';
import { lies, setze as setzePfad } from '../logik/pfad.ts';
import { aendereMit, projekt as projektSignal } from '../zustand/store.ts';
import { normTitel } from '../normtexte/zustand.ts';
import { RichText } from './RichText.tsx';
import { anwendbar, prozessTitel, prozesseImProjekt, sichtImPfad } from '../../prozesse/katalog.ts';
import { Auswahl } from './Auswahl.tsx';
import { StatusPille } from './StatusPille.tsx';

export interface FeldProps {
  def: FeldDef;
  wert: unknown;
  setze: (wert: unknown) => void;
  /** Textbasis der Seite, z. B. gefuehrt.E4.E4-systeme.felder */
  textBasis?: string;
  /** Zielfeld ist eine Liste (verweis) */
  liste?: boolean;
  id: string;
  fehlt?: boolean;
  norm?: string;
  kompakt?: boolean;
  /** abweichende Beschriftung (Spalten, Formularansicht) */
  label?: string;
  /** Liste von Verweisen kompakt: gewählte Einträge als Pillen, Hinzufügen über eine Auswahl (M3, Guide E8) */
  chips?: boolean;
}

export function feldSchluessel(def: FeldDef): string {
  return def.pfad ?? (def.schluessel ?? '').replace(/\.\{id\}$/, '');
}

function ersatzLabel(def: FeldDef): string {
  const k = feldSchluessel(def).split('.').pop() ?? '';
  return k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export function feldLabel(def: FeldDef, textBasis?: string): string {
  return (textBasis && inhalt(`${textBasis}.${feldSchluessel(def)}.label`)) || ersatzLabel(def);
}

export function feldHilfe(def: FeldDef, textBasis?: string): string | undefined {
  return textBasis ? inhalt(`${textBasis}.${feldSchluessel(def)}.hilfe`) : undefined;
}

export function optionenVon(gruppe: string | undefined): string[] {
  if (!gruppe) return [];
  return (appDaten().gefuehrt.optionen?.[gruppe] ?? []).map(String);
}

/** Optionsgruppe mit Zahlen (z. B. schwere 1 bis 4): gewählte Werte als Zahl speichern. */
function alsWert(gruppe: string | undefined, v: unknown): unknown {
  if (!gruppe || typeof v !== 'string' || v === '') return v;
  return typeof appDaten().gefuehrt.optionen?.[gruppe]?.[0] === 'number' ? Number(v) : v;
}

export interface Option {
  wert: string;
  text: string;
}

export function verweisOptionen(quelle: string | undefined, p: Projekt): Option[] {
  const mit = (id: string, name?: string) => ({ wert: id, text: name ? `${id} ${name}` : id });
  switch (quelle) {
    case 'kiSysteme':
      return p.kiSysteme.map((s) => mit(s.id, s.name));
    case 'lieferanten':
      return p.lieferanten.map((s) => mit(s.id, s.name));
    case 'massnahmen':
      return p.massnahmen.map((s) => mit(s.id, s.titel));
    case 'nachweise':
      return p.nachweise.map((s) => mit(s.id, s.titel));
    case 'audits':
      return p.audits.map((s) => mit(s.id, optionText('auditArt', s.art)));
    case 'controls': {
      const ids = [
        ...controlIds42001(), ...(p.meta.modulAiAct ? euaiaControls().map((c) => c.id) : []), ...(p.meta.modulNistRmf ? rmfControls().map((c) => c.id) : []),
        ...p.eigeneControls.map((c) => c.id),
      ];
      return ids.map((id) => mit(id, (/^A\./.test(id) ? normTitel(id) : undefined) ?? inhalt(`euaia.${id}.name`) ?? inhalt(`nist.controls.${id}.titel`) ?? p.eigeneControls.find((c) => c.id === id)?.titel));
    }
    case 'prozesse': {
      // Prozesse des Projekts im Pfad (AIMS-Prozesse, ohne ISMS der Mindestumfang, eigene Prozesse); nicht anwendbare entfallen
      const q = { roh: inhaltRoh };
      return prozesseImProjekt(p, appDaten().kataloge)
        .filter((kp) => {
          const s = sichtImPfad(kp, p.meta.mitIsms);
          return (s === 'aims' || s === 'minimal') && anwendbar(p, kp) !== 'nein';
        })
        .map((kp) => mit(kp.id, prozessTitel(q, kp.id, p)));
    }
    case 'katalog-27001': {
      const k = appDaten().kataloge['controls27001'] as { controls?: { id: string }[] } | undefined;
      return (k?.controls ?? []).map((c) => mit(c.id, normTitel(c.id)));
    }
    case 'katalog-dokumente': {
      // Mit ISMS (oder wenn schon eingetragen) auch die Ergänzungsblätter, je direkt nach ihrer Vorlage (z. B. D-07-EB nach D-07)
      const blaetter = ((appDaten().kataloge['ergaenzungsblaetter'] as { blaetter?: { id: string; vorlage: string }[] } | undefined)?.blaetter ?? [])
        .filter((b) => p.meta.mitIsms || p.dokumente.some((d) => d.id === b.id));
      return appDaten().kataloge.dokumente.dokumente.flatMap((d) => [
        mit(d.id, inhalt(`dokumente.${d.id}.titel`)),
        ...blaetter.filter((b) => b.vorlage === d.id).map((b) => mit(b.id, dokumentTitelUi(b.id))),
      ]);
    }
    default:
      return [];
  }
}

function personName(p: Person) {
  return p.funktion ? `${p.name}, ${p.funktion}` : p.name || p.id;
}

function PersonWahl({ wert, setze, id, label }: { wert: string | undefined; setze: (v: string | undefined) => void; id: string; label: string }) {
  const p = projektSignal.value;
  const [neu, setNeu] = useState(false);
  const [name, setName] = useState('');
  const [funktion, setFunktion] = useState('');
  if (!p) return null;
  // Langer Name mit Funktion: ganzer Text als Tooltip, falls die Auswahl kürzt
  const gewaehlt = p.personen.find((x) => x.id === wert);
  const anlegen = () => {
    if (!name.trim()) return;
    let neueId = '';
    aendereMit((e) => {
      neueId = vergibId(e, 'personen');
      e.personen.push({ id: neueId, name: name.trim(), funktion: funktion.trim(), aimsRollen: [] });
    });
    setze(neueId);
    setNeu(false);
    setName('');
    setFunktion('');
  };
  return (
    <div>
      <div class="leiste">
        <Auswahl id={id} value={wert ?? ''} onChange={(e) => setze(e.currentTarget.value || undefined)} aria-label={label} class="person-wahl"
          title={gewaehlt ? personName(gewaehlt) : undefined}>
          <option value="">{t('feld.person_waehlen')}</option>
          {p.personen.map((x) => (
            <option key={x.id} value={x.id}>{personName(x)}</option>
          ))}
        </Auswahl>
        <button type="button" class="leise klein" aria-expanded={neu} onClick={() => setNeu(!neu)}>{t('feld.person_neu')}</button>
      </div>
      {neu && (
        <div class="karte" style={{ marginTop: '8px', padding: '12px' }}>
          <div class="feld">
            <label for={`${id}-name`}>{t('feld.person_name')}</label>
            <input id={`${id}-name`} type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), anlegen())} />
          </div>
          <div class="feld">
            <label for={`${id}-funktion`}>{t('feld.person_funktion')}</label>
            <input id={`${id}-funktion`} type="text" value={funktion} onInput={(e) => setFunktion(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), anlegen())} />
          </div>
          <button type="button" class="klein" onClick={anlegen} disabled={!name.trim()}>{t('feld.person_anlegen')}</button>
        </div>
      )}
    </div>
  );
}

/** Lieferant wählen oder direkt einen neuen Eintrag (Name, Leistung) anlegen; Prüfung später unter «Lieferanten» */
function LieferantWahl({ opt, wert, setze, id, label, kompakt }: { opt: Option[]; wert: string | undefined; setze: (v: string | undefined) => void; id: string; label: string; kompakt?: boolean }) {
  const [neu, setNeu] = useState(false);
  const [name, setName] = useState('');
  const [leistung, setLeistung] = useState('');
  const anlegen = () => {
    if (!name.trim()) return;
    let neueId = '';
    aendereMit((e) => {
      const l = neuerEintrag(e, 'lieferanten', { name: name.trim(), leistung: leistung.trim() });
      neueId = String(l['id']);
      e.lieferanten.push(l as never);
    });
    setze(neueId);
    setNeu(false);
    setName('');
    setLeistung('');
  };
  const taste = (e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), anlegen());
  return (
    <div>
      <div class="leiste">
        <Auswahl id={id} value={wert ?? ''} onChange={(e) => setze(e.currentTarget.value || undefined)} aria-label={kompakt ? label : undefined} style={{ maxWidth: '420px' }}>
          <option value="">{opt.length ? t('feld.bitte_waehlen') : t('feld.keine_optionen')}</option>
          {opt.map((o) => <option key={o.wert} value={o.wert}>{o.text}</option>)}
        </Auswahl>
        <button type="button" class="leise klein" aria-expanded={neu} onClick={() => setNeu(!neu)}>{t('feld.lieferant_neu')}</button>
      </div>
      {neu && (
        <div class="karte" style={{ marginTop: '8px', padding: '12px' }}>
          <div class="feld">
            <label for={`${id}-name`}>{t('feld.lieferant_name')}</label>
            <input id={`${id}-name`} type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={taste} />
          </div>
          <div class="feld">
            <label for={`${id}-leistung`}>{t('feld.lieferant_leistung')}</label>
            <input id={`${id}-leistung`} type="text" value={leistung} onInput={(e) => setLeistung(e.currentTarget.value)} onKeyDown={taste} />
          </div>
          <button type="button" class="klein" onClick={anlegen} disabled={!name.trim()}>{t('feld.lieferant_anlegen')}</button>
          <p class="zweitext">{t('feld.lieferant_hinweis')}</p>
        </div>
      )}
    </div>
  );
}

function MehrfachWahl({ optionen, wert, setze, id, label, filterbar }: { optionen: Option[]; wert: string[]; setze: (v: string[]) => void; id: string; label: string; filterbar?: boolean }) {
  const [filter, setFilter] = useState('');
  const f = filter.trim().toLowerCase();
  const sichtbar = f ? optionen.filter((o) => o.text.toLowerCase().includes(f)) : optionen;
  const umschalten = (w: string, an: boolean) => setze(an ? [...wert.filter((x) => x !== w), w] : wert.filter((x) => x !== w));
  if (optionen.length === 0) return <p class="zweitext">{t('feld.keine_optionen')}</p>;
  const lang = filterbar || optionen.length > 12;
  return (
    <fieldset id={id} aria-label={label}>
      {lang && <input type="search" placeholder={t('feld.filtern')} aria-label={`${label}: ${t('feld.filtern')}`} value={filter} onInput={(e) => setFilter(e.currentTarget.value)} style={{ marginBottom: '8px', maxWidth: '320px' }} />}
      <div class={lang ? 'auswahlbox' : 'optionen kompakt'}>
        {sichtbar.map((o) => (
          <label key={o.wert} class={lang ? 'check' : undefined}>
            <input type="checkbox" checked={wert.includes(o.wert)} onChange={(e) => umschalten(o.wert, e.currentTarget.checked)} />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
      {lang && wert.length > 0 && <p class="zweitext">{t('feld.gewaehlt', { anzahl: wert.length })}</p>}
    </fieldset>
  );
}

/** Verweise als Pillen mit Entfernen und einer Auswahl zum Hinzufügen (M3): braucht eine Zeile statt einer Liste von Kästchen */
function ChipWahl({ optionen, wert, setze, id, label }: { optionen: Option[]; wert: string[]; setze: (v: string[]) => void; id: string; label: string }) {
  const frei = optionen.filter((o) => !wert.includes(o.wert));
  return (
    <div class="chip-wahl" id={`${id}-pillen`} role="group" aria-label={label}>
      {wert.length === 0 && <span class="zweitext" id={`${id}-leer`}>{t('feld.noch_keine')}</span>}
      {wert.map((w) => (
        <StatusPille art="neutral" key={w} klasse="wahl-pille">
          {w}
          <button type="button" class="leise klein" aria-label={t('feld.verweis_entfernen', { wert: w, feld: label })} onClick={() => {
            setze(wert.filter((x) => x !== w));
            // Fokus bleibt im Feld: auf «Hinzufügen …» statt auf body
            requestAnimationFrame(() => document.getElementById(id)?.focus());
          }}><Symbol name="schliessen" klasse="sym sym-text" /></button>
        </StatusPille>
      ))}
      {frei.length > 0 && (
        <Auswahl id={id} aria-label={label} value="" onChange={(e) => e.currentTarget.value && setze([...wert, e.currentTarget.value])} class="chip-neu">
          <option value="">{t('feld.verweis_hinzufuegen')}</option>
          {frei.map((o) => <option key={o.wert} value={o.wert}>{o.text}</option>)}
        </Auswahl>
      )}
    </div>
  );
}

function Optionen({ optionen, wert, setze, id, label, name, pflicht }: { optionen: Option[]; wert: unknown; setze: (v: string | undefined) => void; id: string; label: string; name: string; pflicht?: boolean }) {
  if (optionen.length > 7) {
    return (
      <Auswahl id={id} aria-label={label} value={wert === undefined || wert === null ? '' : String(wert)} onChange={(e) => setze(e.currentTarget.value || undefined)}>
        <option value="">{t('feld.bitte_waehlen')}</option>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>{o.text}</option>
        ))}
      </Auswahl>
    );
  }
  return (
    <fieldset id={id} aria-label={label} role="radiogroup" aria-required={pflicht ? 'true' : undefined}>
      <div class="optionen">
        {optionen.map((o) => (
          <label key={o.wert}>
            <input type="radio" name={name} checked={String(wert) === o.wert} onChange={() => setze(o.wert)} />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ListeText({ wert, setze, id, vorschlaege, label }: { wert: string[]; setze: (v: string[]) => void; id: string; vorschlaege?: string; label: string }) {
  const bausteine = vorschlaege ? optionenVon(vorschlaege).map((w) => optionText(vorschlaege, w)) : [];
  return (
    <div id={id}>
      {wert.map((w, i) => (
        <div class="leiste" key={i} style={{ marginBottom: '8px', flexWrap: 'nowrap' }}>
          <input type="text" value={w} aria-label={`${label} ${i + 1}`} onInput={(e) => setze(wert.map((x, j) => (j === i ? e.currentTarget.value : x)))} />
          <button type="button" class="leise klein" aria-label={`${t('feld.entfernen')}: ${label} ${i + 1}`} onClick={() => setze(wert.filter((_, j) => j !== i))}><Symbol name="schliessen" klasse="sym sym-text" /></button>
        </div>
      ))}
      <button type="button" class="klein" onClick={() => setze([...wert, ''])}>{t('feld.zeile_neu')}</button>
      {bausteine.length > 0 && (
        <details style={{ marginTop: '8px' }}>
          <summary>{t('feld.textbausteine')}</summary>
          <ul style={{ paddingLeft: '20px' }}>
            {bausteine.map((b) => (
              <li key={b} style={{ marginBottom: '4px' }}>
                {b}{' '}
                <button type="button" class="leise klein" disabled={wert.includes(b)} onClick={() => setze([...wert.filter((x) => x.trim() !== ''), b])}>{t('feld.uebernehmen')}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Ab so vielen Spalten erscheint jede Zeile als Karte (z. B. Meldungen in E12 mit 12 Spalten). */
const KARTEN_AB = 7;

function Tabelle({ def, wert, setze, id, textBasis }: { def: FeldDef; wert: Record<string, unknown>[]; setze: (v: unknown) => void; id: string; textBasis?: string }) {
  const spalten = def.spalten ?? [];
  const spaltenBasis = textBasis ? `${textBasis}.${def.pfad}` : undefined;
  // Bis KARTEN_AB: Tabelle mit Mindestbreite je Feldtyp, scrollt in sich, ID-Spalte klebt; schmal immer Karten
  const art = spalten.length >= KARTEN_AB ? 'karten' : `karten-schmal${spalten[0]?.pfad === 'id' ? ' mit-id' : ''}`;
  // Zuletzt geschriebener Stand (Prüfung test.7 N9, wie FreigabeFeld): zwei Eingaben vor dem nächsten Zeichnen überschreiben sich nicht
  const stand = useRef(wert);
  stand.current = wert;
  const setzeStand = (neu: Record<string, unknown>[]) => {
    stand.current = neu;
    setze(neu);
  };
  return (
    <div class={`tabelle-feld tabelle-eingabe ${art}`} id={id}>
      {wert.length > 0 && (
        <table>
          <thead>
            <tr>
              {spalten.map((s) => (
                <th key={s.pfad} scope="col" class={`sp-${s.typ}`}>{feldLabel(s, spaltenBasis)}{s.pflicht && <>{' '}<span class="pflicht">{t('feld.pflicht_wort')}</span></>}</th>
              ))}
              <th class="sp-aktion"><span class="nur-sr">{t('feld.aktionen')}</span></th>
            </tr>
          </thead>
          <tbody>
            {wert.map((zeile, i) => (
              <tr key={i}>
                {spalten.map((s) => (
                  <td key={s.pfad} class={`sp-${s.typ}`} data-label={`${feldLabel(s, spaltenBasis)}${s.pflicht ? ` (${t('feld.pflicht_wort')})` : ''}`}>
                    <Eingabe
                      def={s}
                      wert={lies(zeile, s.pfad ?? '')}
                      setze={(v) => setzeStand(stand.current.map((z, j) => (j === i ? setzePfad(z, s.pfad ?? '', v) : z)))}
                      id={`${id}-${i}-${s.pfad}`}
                      label={`${feldLabel(s, spaltenBasis)} ${i + 1}`}
                      kompakt
                    />
                  </td>
                ))}
                <td class="sp-aktion">
                  <button type="button" class="leise klein" aria-label={`${t('feld.zeile_entfernen')} ${i + 1}`} onClick={() => setzeStand(stand.current.filter((_, j) => j !== i))}><Symbol name="schliessen" klasse="sym sym-text" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" class="klein" onClick={() => setzeStand([...stand.current, neueTabellenZeile(def.pfad ?? '', stand.current, spalten)])}>{t('feld.zeile_neu')}</button>
    </div>
  );
}

interface PruefpunktWert {
  nachweis?: string;
  stichprobe?: string;
  ergebnis?: string;
  /** Stand des Controls in der SoA zum Zeitpunkt des Audits (nur Controls aus Anhang A) */
  soaStand?: string;
}

/** Prüfpunkte der Auditcheckliste (D-20): Normabschnitte 4 bis 10 (Schlüssel ohne «K-») und Controls aus Anhang A. */
export function pruefpunktGruppen(): { id: string; titel: string; punkte: { id: string; titel: string }[] }[] {
  const k = appDaten().kataloge;
  const kapitel = k.anforderungen42001.kapitel.map((kap) => ({
    id: kap.id.replace(/^K-/, ''),
    titel: normTitel(kap.id) ?? kap.id,
    punkte: kap.abschnitte.map((a) => ({ id: a.id.replace(/^K-/, ''), titel: normTitel(a.id) ?? '' })),
  }));
  const anhang = k.controls42001.gruppen.map((g) => ({
    id: g.id,
    titel: normTitel(g.id) ?? g.id,
    punkte: g.controls.map((c) => ({ id: c.id, titel: normTitel(c.id) ?? '' })),
  }));
  return [...kapitel, ...anhang];
}

function Pruefliste({ wert, setze, id, label }: { wert: Record<string, PruefpunktWert>; setze: (v: unknown) => void; id: string; label: string }) {
  const ergebnisse = optionenVon('checklistenErgebnis');
  const soaStaende = optionenVon('controlStatus');
  const aendern = (punkt: string, teil: keyof PruefpunktWert, v: string) => {
    const zeile = { ...(wert[punkt] ?? {}), [teil]: v || undefined };
    const neu = { ...wert };
    if (!zeile.nachweis && !zeile.stichprobe && !zeile.ergebnis && !zeile.soaStand) delete neu[punkt];
    else neu[punkt] = jsonAusVertrauen(JSON.stringify(zeile), 'kopie') as PruefpunktWert;
    setze(Object.keys(neu).length ? neu : undefined);
  };
  return (
    <div id={id} class="pruefliste">
      {pruefpunktGruppen().map((g) => {
        const erfasst = g.punkte.filter((x) => wert[x.id]).length;
        return (
          <details key={g.id}>
            <summary>{g.id} {g.titel} <span class="zweitext">· {t('feld.pruefpunkte_erfasst', { anzahl: erfasst, gesamt: g.punkte.length })}</span></summary>
            <div class="tabelle-feld">
              <table>
                <caption class="nur-sr">{label}: {g.id} {g.titel}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('feld.pruefpunkt')}</th>
                    <th scope="col">{t('feld.pruef_nachweis')}</th>
                    <th scope="col">{t('feld.pruef_stichprobe')}</th>
                    <th scope="col">{t('feld.pruef_ergebnis')}</th>
                    {g.id.startsWith('A.') && <th scope="col">{t('feld.pruef_soa')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.punkte.map((x) => {
                    const z = wert[x.id] ?? {};
                    const name = `${x.id} ${x.titel}`;
                    return (
                      <tr key={x.id}>
                        <th scope="row"><span class="marke-id">{x.id}</span> {x.titel}</th>
                        <td><input type="text" value={z.nachweis ?? ''} aria-label={`${name}: ${t('feld.pruef_nachweis')}`} onInput={(e) => aendern(x.id, 'nachweis', e.currentTarget.value)} /></td>
                        <td><input type="text" value={z.stichprobe ?? ''} aria-label={`${name}: ${t('feld.pruef_stichprobe')}`} onInput={(e) => aendern(x.id, 'stichprobe', e.currentTarget.value)} /></td>
                        <td>
                          <Auswahl value={z.ergebnis ?? ''} aria-label={`${name}: ${t('feld.pruef_ergebnis')}`} onChange={(e) => aendern(x.id, 'ergebnis', e.currentTarget.value)}>
                            <option value="">{t('feld.pruef_ergebnis_leer')}</option>
                            {ergebnisse.map((w) => <option key={w} value={w}>{optionText('checklistenErgebnis', w)}</option>)}
                          </Auswahl>
                        </td>
                        {g.id.startsWith('A.') && (
                          <td>
                            <Auswahl value={z.soaStand ?? ''} aria-label={`${name}: ${t('feld.pruef_soa')}`} onChange={(e) => aendern(x.id, 'soaStand', e.currentTarget.value)}>
                              <option value="">{t('feld.pruef_soa_leer')}</option>
                              {soaStaende.map((w) => <option key={w} value={w}>{optionText('controlStatus', w)}</option>)}
                            </Auswahl>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}

interface CheckWert {
  erledigt: boolean;
  nachweis?: string;
  datum?: string;
}

function Checkliste({ wert, setze, id, label }: { wert: CheckWert | undefined; setze: (v: CheckWert) => void; id: string; label: string }) {
  const w = wert ?? { erledigt: false };
  // Zuletzt geschriebener Stand (N9): Haken, Nachweis und Datum in schneller Folge bleiben alle erhalten
  const stand = useRef(w);
  stand.current = w;
  const teil = (x: Partial<CheckWert>) => {
    const neu = { ...stand.current, ...x } as CheckWert;
    stand.current = neu;
    setze(neu);
  };
  return (
    <div class="leiste" style={{ alignItems: 'flex-start' }}>
      <label class="check" style={{ flex: 'none' }}>
        <input type="checkbox" id={id} checked={w.erledigt} onChange={(e) => teil({ erledigt: e.currentTarget.checked, datum: stand.current.datum || (e.currentTarget.checked ? new Date().toISOString().slice(0, 10) : undefined) })} />
        <span>{t('feld.erledigt')}<span class="nur-sr">: {label}</span></span>
      </label>
      <input type="text" style={{ flex: '1 1 220px' }} placeholder={t('feld.nachweis')} aria-label={`${label}: ${t('feld.nachweis')}`} value={w.nachweis ?? ''} onInput={(e) => teil({ nachweis: e.currentTarget.value })} />
      <input type="date" style={{ width: '180px' }} aria-label={`${label}: ${t('feld.datum')}`} value={w.datum ?? ''} onInput={(e) => teil({ datum: e.currentTarget.value || undefined })} />
    </div>
  );
}

/** Nur das Eingabeelement (ohne Beschriftung). */
/**
 * Freigabe aus Person und Datum. Beide Teile schreiben über einen Ref mit dem zuletzt geschriebenen Stand: Folgt die zweite
 * Eingabe der ersten, bevor neu gezeichnet ist (schnelle Bedienung, Last), überschreibt sie den ersten Teil nicht mit dem
 * alten Wert (Untersuchung des Wacklers «Prüfseite im Guide», test.7).
 */
function FreigabeFeld({ def, wert, setze, id, label }: { def: FeldDef; wert: { von?: string; am?: string } | undefined; setze: (v: unknown) => void; id: string; label: string }) {
  const f = wert ?? {};
  const stand = useRef(f);
  stand.current = f;
  // Unterbeschriftung nach Art des Entscheids: geprüft, eingestuft, bestätigt, angenommen, sonst freigegeben (RT-18)
  const art = ({ geprueft: 'geprueft', eingestuft: 'eingestuft', bestaetigt: 'bestaetigt', restrisikoAkzeptiert: 'angenommen' } as Record<string, string>)[(def.pfad ?? '').split('.').pop() ?? ''];
  const von = t(art ? `feld.${art}_von` : 'feld.freigabe_von');
  const am = t(art ? `feld.${art}_am` : 'feld.freigabe_am');
  const setzeTeil = (teil: { von?: string; am?: string }) => {
    const neu = { ...stand.current, ...teil };
    stand.current = neu;
    setze(!neu.von && !neu.am ? undefined : { von: neu.von ?? '', am: neu.am ?? '' });
  };
  return (
    <div class="leiste" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 260px' }}>
        <span class="zweitext">{von}</span>
        <PersonWahl wert={f.von || undefined} setze={(v) => setzeTeil({ von: v })} id={`${id}-von`} label={`${label}: ${von}`} />
      </div>
      <div>
        <label class="zweitext" for={`${id}-am`}>{am}</label>
        <input id={`${id}-am`} type="date" value={f.am ?? ''} onInput={(e) => setzeTeil({ am: e.currentTarget.value })} style={{ width: '200px' }} />
      </div>
    </div>
  );
}

export function Eingabe(props: FeldProps & { label: string }): ComponentChildren {
  const { def, wert, setze, id, label } = props;
  const p = projektSignal.value;
  switch (def.typ) {
    case 'text': {
      // Textbausteine (vorschlaege) als Auswahlliste des Browsers; freie Angaben bleiben möglich
      const bausteine = def.vorschlaege ? optionenVon(def.vorschlaege).map((w) => optionText(def.vorschlaege, w)) : [];
      // Personen-ID im Freitext (z. B. Entscheidungsrechte «P-002») als Name anzeigen; gespeichert bleibt die ID bis zur Änderung
      const person = typeof wert === 'string' && /^P-\d{3}$/.test(wert) ? p?.personen.find((x) => x.id === wert) : undefined;
      return (
        <>
          <input id={id} type="text" maxLength={KURZE_FELDER.has((def.pfad ?? '').split('.').at(-1) ?? '') ? TEXT_GRENZEN.kurz : TEXT_GRENZEN.standard} value={person ? personName(person) : ((wert as string) ?? '')} title={person ? wert as string : undefined} onInput={(e) => setze(e.currentTarget.value)} aria-label={props.kompakt ? label : undefined} list={bausteine.length ? `${id}-bausteine` : undefined} />
          {bausteine.length > 0 && <datalist id={`${id}-bausteine`}>{bausteine.map((b) => <option key={b} value={b} />)}</datalist>}
          {def.pfad === 'version' && typeof wert === 'string' && wert.trim() !== '' && !/^\d+(\.\d+){0,2}$/.test(wert.trim()) && <p class="zweitext fehltext" id={`${id}-version`} role="status">{t('feld.version_format')}</p>}
        </>
      );
    }
    case 'textarea':
      return <textarea id={id} maxLength={TEXT_GRENZEN.standard} rows={props.kompakt ? 2 : 3} value={(wert as string) ?? ''} onInput={(e) => setze(e.currentTarget.value)} aria-label={props.kompakt ? label : undefined} />;
    case 'zahl': {
      // Stufen der eigenen Skala (Risikokriterien) als Auswahl mit Bezeichnung; Werte ausserhalb der Skala sind nicht wählbar
      const eigene = def.skala ? (projektSignal.value?.organisation.risikokriterien[def.skala] ?? []) : [];
      // Noch keine eigene Skala (U-23): Vorgabe 1 bis 4 mit Stufennamen wie im Guide (E6-skalen), statt eines Zahlenfelds
      const vorgabe = (inhaltRoh(`app.feld.stufen_${def.skala}`) as string[] | undefined) ?? [];
      const stufen = eigene.length ? eigene : vorgabe.map((b, i) => ({ stufe: i + 1, bezeichnung: b }));
      if (def.skala && stufen.length) {
        const opt = [...stufen].sort((x, y) => x.stufe - y.stufe).map((s) => ({ wert: String(s.stufe), text: s.bezeichnung ? `${s.stufe} ${s.bezeichnung}` : String(s.stufe) }));
        const ausserhalb = typeof wert === 'number' && !opt.some((o) => o.wert === String(wert));
        return (
          <>
            <Optionen optionen={opt} wert={wert === null || wert === undefined ? undefined : String(wert)} setze={(v) => setze(v === undefined ? null : Number(v))} id={id} label={label} name={id} pflicht={def.pflicht} />
            {!eigene.length && <p class="zweitext">{t('feld.skala_vorgabe')}</p>}
            {ausserhalb && <p class="zweitext fehltext" role="alert">{t('feld.ausserhalb_skala', { wert: String(wert) })}</p>}
          </>
        );
      }
      return (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={wert === null || wert === undefined ? '' : String(wert)}
          onInput={(e) => {
            const v = e.currentTarget.value;
            setze(v === '' ? null : Number(v));
          }}
          aria-label={props.kompakt ? label : undefined}
          style={{ maxWidth: '180px' }}
        />
      );
    }
    case 'datum':
      return (
        <>
          <input id={id} type="date" value={(wert as string) ?? ''} onInput={(e) => setze(e.currentTarget.value || undefined)} style={{ maxWidth: '220px' }} aria-label={props.kompakt ? label : undefined} />
          {/* Zweistelliges Jahr ergibt 0026-03-15: Das Formular sagt es sofort, gespeichert wird nichts verworfen (E2-01) */}
          {typeof wert === 'string' && /^0\d{3}-/.test(wert) && <p class="feldhilfe" role="status">{t('feld.jahr_pruefen')}</p>}
        </>
      );
    // Datum mit Uhrzeit (ab Schemaversion 3, z. B. feststellungen.entdecktAm): gespeichert als JJJJ-MM-TTThh:mm
    case 'zeitpunkt':
      return (
        <input id={id} type="datetime-local" step={60} value={typeof wert === 'string' ? wert.slice(0, 16) : ''} onInput={(e) => setze(e.currentTarget.value.slice(0, 16) || undefined)} style={{ maxWidth: '260px' }} aria-label={props.kompakt ? label : undefined} />
      );
    case 'janein':
      return (
        <Optionen
          optionen={[{ wert: 'true', text: t('feld.ja') }, { wert: 'false', text: t('feld.nein') }]}
          wert={wert === undefined ? undefined : String(wert)}
          setze={(v) => setze(v === 'true')}
          id={id}
          label={label}
          name={id}
        />
      );
    case 'auswahl': {
      const opt = optionenVon(def.optionen).map((w) => ({ wert: w, text: optionText(def.optionen, w) }));
      if (opt.length === 0) return <input id={id} type="text" value={(wert as string) ?? ''} onInput={(e) => setze(e.currentTarget.value)} />;
      if (props.kompakt) {
        return (
          <Auswahl id={id} aria-label={label} value={wert === undefined || wert === null ? '' : String(wert)} onChange={(e) => setze(alsWert(def.optionen, e.currentTarget.value || undefined))}>
            <option value="">{t('feld.bitte_waehlen')}</option>
            {opt.map((o) => (
              <option key={o.wert} value={o.wert}>{o.text}</option>
            ))}
          </Auswahl>
        );
      }
      return <Optionen optionen={opt} wert={wert === undefined || wert === null ? wert : String(wert)} setze={(v) => setze(alsWert(def.optionen, v))} id={id} label={label} name={id} />;
    }
    case 'mehrfach': {
      const opt = optionenVon(def.optionen).map((w) => ({ wert: w, text: optionText(def.optionen, w) }));
      return <MehrfachWahl optionen={opt} wert={Array.isArray(wert) ? (wert as string[]) : []} setze={setze} id={id} label={label} />;
    }
    case 'liste-text':
      return <ListeText wert={Array.isArray(wert) ? (wert as string[]) : []} setze={setze} id={id} vorschlaege={def.vorschlaege} label={label} />;
    case 'person':
      return <PersonWahl wert={wert as string | undefined} setze={setze} id={id} label={label} />;
    case 'personen': {
      const opt = (p?.personen ?? []).map((x) => ({ wert: x.id, text: personName(x) }));
      return <MehrfachWahl optionen={opt} wert={Array.isArray(wert) ? (wert as string[]) : []} setze={setze} id={id} label={label} />;
    }
    case 'freigabe':
      return <FreigabeFeld def={def} wert={wert as { von?: string; am?: string } | undefined} setze={setze} id={id} label={label} />;
    case 'verweis': {
      const opt = p ? verweisOptionen(def.quelle, p) : [];
      // Eingetragener Wert ohne passenden Eintrag (z. B. aus einer älteren Datei): sichtbar lassen statt «Bitte wählen»
      for (const w of Array.isArray(wert) ? (wert as string[]) : typeof wert === 'string' && wert ? [wert] : []) if (!opt.some((o) => o.wert === w)) opt.push({ wert: w, text: w });
      if ((props.liste || Array.isArray(wert)) && props.chips) return <ChipWahl optionen={opt} wert={Array.isArray(wert) ? (wert as string[]) : []} setze={setze} id={id} label={label} />;
      if (props.liste || Array.isArray(wert)) return <MehrfachWahl optionen={opt} wert={Array.isArray(wert) ? (wert as string[]) : []} setze={setze} id={id} label={label} filterbar={opt.length > 12} />;
      if (def.quelle === 'lieferanten') return <LieferantWahl opt={opt} wert={wert as string | undefined} setze={setze} id={id} label={label} kompakt={props.kompakt} />;
      return (
        <Auswahl id={id} value={(wert as string) ?? ''} onChange={(e) => setze(e.currentTarget.value || undefined)} aria-label={props.kompakt ? label : undefined}>
          <option value="">{opt.length ? t('feld.bitte_waehlen') : t('feld.keine_optionen')}</option>
          {opt.map((o) => (
            <option key={o.wert} value={o.wert}>{o.text}</option>
          ))}
        </Auswahl>
      );
    }
    case 'tabelle':
      return <Tabelle def={def} wert={Array.isArray(wert) ? (wert as Record<string, unknown>[]) : []} setze={setze} id={id} textBasis={props.textBasis} />;
    case 'checkliste':
      return <Checkliste wert={wert as CheckWert | undefined} setze={setze} id={id} label={label} />;
    case 'pruefliste':
      return <Pruefliste wert={wert && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, PruefpunktWert>) : {}} setze={setze} id={id} label={label} />;
    default:
      return <p class="ersatz">{t('feld.unbekannt')}</p>;
  }
}

/** Feld mit Beschriftung, Ausfüllhinweis und Normabschnitt. */
export function Feld(props: FeldProps) {
  const label = props.label ?? feldLabel(props.def, props.textBasis);
  const hilfe = feldHilfe(props.def, props.textBasis);
  const gruppe = ['janein', 'auswahl', 'mehrfach', 'personen', 'tabelle', 'liste-text', 'freigabe', 'checkliste', 'pruefliste'].includes(props.def.typ) || (props.def.typ === 'verweis' && (props.liste || Array.isArray(props.wert)));
  // Zugänglicher Name aus der Beschriftung mit dem Wort «Pflicht» (V-08, statt «*»); Normbezug über aria-describedby
  const normId = props.norm ? `${props.id}-norm` : undefined;
  const huelle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = huelle.current?.querySelector<HTMLElement>(`[id="${props.id}"]`);
    if (!el) return;
    if (props.def.pflicht && !gruppe) el.setAttribute('aria-required', 'true');
    if (normId) {
      const da = (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
      if (!da.includes(normId)) el.setAttribute('aria-describedby', [...da, normId].join(' '));
    }
  });
  // V-08: Pflicht steht als Wort neben der Beschriftung, sichtbar und im zugänglichen Namen
  const pflicht = props.def.pflicht && <>{' '}<span class="pflicht">{t('feld.pflicht_wort')}</span></>;
  // Fehler am Feld ansagen (D-10, WCAG 3.3.1): gilt für jede Eingabeart, deshalb am ersten Bedienelement im Feld
  useEffect(() => {
    const el = huelle.current?.querySelector<HTMLElement>('input, select, textarea, [role=combobox], [role=radiogroup]');
    if (!el) return;
    if (props.fehlt) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', `${props.id}-fehlt`);
    } else if (el.getAttribute('aria-invalid')) {
      el.removeAttribute('aria-invalid');
      if (el.getAttribute('aria-describedby') === `${props.id}-fehlt`) el.removeAttribute('aria-describedby');
    }
  }, [props.fehlt, props.id]);
  const norm = props.norm && <span class="norm" id={normId}>{t('feld.norm', { abschnitt: props.norm })}</span>;
  return (
    <div class={`feld${props.fehlt ? ' fehlt' : ''}`} data-feld={feldSchluessel(props.def)} ref={huelle}>
      {gruppe ? <div class="label" id={`${props.id}-label`}>{label}{pflicht}{norm}</div> : <div class="feld-kopf"><label for={props.id}>{label}{pflicht}</label>{norm}</div>}
      {hilfe && !props.chips && <div class="feldhilfe"><RichText text={hilfe} als="span" /></div>}
      {hilfe && props.chips && <span class="nur-sr" id={`${props.id}-hilfe`}>{hilfe.replace(/\[\[g:[^|\]]+\|([^\]]+)\]\]/g, '$1')}</span>}
      <Eingabe {...props} label={props.def.pflicht ? `${label}, ${t('feld.pflicht_wort')}` : label} />
      {props.fehlt && <p class="zweitext fehltext" id={`${props.id}-fehlt`}>{t('feld.fehlt')}</p>}
    </div>
  );
}

/** Rohwert einer Inhaltsliste (z. B. Beteiligte) für Anzeigen. */
export function inhaltsListe(schluessel: string): string[] {
  const r = inhaltRoh(schluessel);
  return Array.isArray(r) ? r.map(String) : [];
}

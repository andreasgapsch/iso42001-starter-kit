// Ergebnis des KI-Assistenten übernehmen: Projektdatei (gleiches Schema) als Datei oder eingefügter Text,
// mit verständlichen Meldungen. Gehört die Antwort zum offenen Projekt (meta.projektId), zeigt eine Vorschau,
// was neu oder geändert ist; übernommen werden nur die gewählten Einträge und Bereiche (Teilimport), auf Wunsch
// auch die ganze Datei. Die Antwort darf dann ein Auszug sein (meta.projektId und die geänderten Listen).
import { useRef, useState } from 'preact/hooks';
import { extrahiereJson, ladeKiErgebnis, type KiErgebnis } from '../../import/ki-ergebnis.ts';
import { schemaFehlerText } from '../../import/laden.ts';
import { alles, anzahlGewaehlt, teilimportMoeglich, teilimportPruefen, vergleiche, type TeilAuswahl, type TeilListe, type TeilVergleich } from '../../import/teilimport.ts';
import { inhalt, t } from '../../i18n.ts';
import { liesTextBegrenzt } from '../../../eingang/lesen.ts';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import type { Projekt } from '../../../model/typen.ts';
import { holeSpeicher, melde, migrationsSicherung, navigiere, nurLesen, projekt, projektUebernehmen } from '../../zustand/store.ts';
import { schemaFormat } from './Start.tsx';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

interface Vorschau {
  daten: Record<string, unknown>;
  vergleich: TeilVergleich;
  auswahl: TeilAuswahl;
  /** vollständige, gültige Datei: «Ganz ersetzen» möglich */
  ganz: KiErgebnis | null;
}

const bereichText = (pfad: string) => inhalt(`app.ki_import.bereiche.${pfad}`) ?? pfad;

/**
 * Würde die Antwort das offene Projekt ändern (Teilimport oder ganzes Projekt mit derselben Kennung), obwohl es nur lesend
 * geöffnet ist (AF-005)? Ein fremdes Projekt ersetzt das offene dagegen wie sonst und ist nicht gesperrt.
 */
export function kiImportGesperrt(aktuell: Projekt | null, nurLesend: boolean, inhaltText: string): boolean {
  if (!aktuell || !nurLesend) return false;
  const j = extrahiereJson(inhaltText.trim() ? inhaltText : '');
  if (j.ok && teilimportMoeglich(aktuell, j.daten)) return true;
  const r = ladeKiErgebnis(inhaltText);
  return r.ok && r.projekt.meta.projektId === aktuell.meta.projektId;
}

export function KiImport() {
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  // V-05, B5: Beschäftigt (aria-busy) während Lesen und Prüfen; die Sperre im Ref verhindert eine zweite Auslösung
  const [laeuft, setLaeuft] = useState(false);
  const sperre = useRef(false);
  const gesperrt = async (f: () => Promise<void>) => {
    if (sperre.current) return;
    sperre.current = true;
    setLaeuft(true);
    try {
      // Zustand Beschäftigt zuerst zeichnen; das Prüfen grosser Antworten läuft danach ohne Unterbruch
      await new Promise((r) => setTimeout(r, 0));
      await f();
    } finally {
      sperre.current = false;
      setLaeuft(false);
    }
  };

  const fehlerZeigen = (r: Extract<KiErgebnis, { ok: false }>) => {
    const details = r.schema ? schemaFehlerText(r.schema, 8, schemaFormat()) : r.details;
    // Fehlende Version: handlungsfähige Meldung statt allgemeinem Text (AF-003)
    if (r.art === 'keine-version') return setFehler(t('ki_import.keine_version'));
    setFehler(`${t(`ki_import.${r.art === 'kein-json' ? 'kein_json' : r.art === 'schema' ? 'schema' : 'allgemein'}`)}\n${t(`laden.${r.art}`)}${details.length ? `\n${details.join('\n')}` : ''}`);
  };

  const ganzUebernehmen = (r: Extract<KiErgebnis, { ok: true }>, gleich: boolean) => {
    // Nur lesend geöffnet (AF-005): das offene Projekt nicht verändern; ein anderes Projekt ersetzt es dagegen wie sonst
    if (gleich && nurLesen.value) return melde(t('laden.nur_lesen_ki_import'), 'info', 15_000);
    projektUebernehmen(r.projekt, true);
    // Neues Projekt aus dem Import: Sicherungsangebot der früheren Datei gilt nicht mehr (AF-004)
    if (!gleich) migrationsSicherung.value = null;
    if (gleich) holeSpeicher().aendern(r.projekt);
    else holeSpeicher().neu(r.projekt);
    melde(
      `${t('ki_import.uebernommen', { name: r.projekt.organisation.name || t('kopf.ohne_name') })}${r.ergaenzt?.length ? ` ${t('ki_import.ergaenzt', { felder: r.ergaenzt.join(', ') })}` : ''}${r.migrationen.length ? ` ${t('ki_import.migriert')}` : ''}`,
      'ok',
    );
    setVorschau(null);
    navigiere({ art: 'formular', modul: 'uebersicht' });
  };

  const uebernehmen = async (inhaltText: string) => {
    setFehler(null);
    setVorschau(null);
    const aktuell = projekt.value;
    // Übernahme in ein nur lesend geöffnetes Projekt: gesperrt, die Anzeige bliebe sonst von der Datei verschieden (AF-005)
    if (kiImportGesperrt(aktuell, nurLesen.value !== null, inhaltText)) return melde(t('laden.nur_lesen_ki_import'), 'info', 15_000);
    const j = extrahiereJson(inhaltText.trim() ? inhaltText : '');
    // Antwort zum offenen Projekt: Vorschau mit Auswahl statt Ersetzen
    if (j.ok && aktuell && teilimportMoeglich(aktuell, j.daten)) {
      const daten = structuredClone(j.daten) as Record<string, unknown>;
      const v = vergleiche(aktuell, daten);
      const ganz = ladeKiErgebnis(inhaltText);
      setVorschau({ daten, vergleich: v, auswahl: alles(v), ganz: ganz.ok ? ganz : null });
      return;
    }
    const r = ladeKiErgebnis(inhaltText);
    if (!r.ok) return fehlerZeigen(r);
    // Fremdes Projekt ersetzt das offene: immer rückfragen, der Zwischenstand des offenen wird dabei gesichert
    if (aktuell && aktuell.meta.projektId !== r.projekt.meta.projektId && !(await bestaetigen({ text: t('ki_import.ersetzen', { name: aktuell.organisation.name || t('kopf.ohne_name') }), titel: t('bestaetigen.titel_projekt_ersetzen'), ja: t('bestaetigen.projekt_ersetzen'), gefahr: true }))) return;
    ganzUebernehmen(r, aktuell?.meta.projektId === r.projekt.meta.projektId);
  };

  const auswahlUebernehmen = (aktuell: Projekt, v: Vorschau) => {
    setFehler(null);
    if (nurLesen.value) return melde(t('laden.nur_lesen_ki_import'), 'info', 15_000);
    const r = teilimportPruefen(aktuell, v.daten, v.auswahl, schemaFormat());
    if (!r.ok) {
      setFehler(`${t('ki_import.teil_schema')}\n${r.details.join('\n')}`);
      return;
    }
    projektUebernehmen(r.projekt, true);
    holeSpeicher().aendern(r.projekt);
    melde(t('ki_import.teil_uebernommen', { anzahl: anzahlGewaehlt(v.auswahl) }), 'ok');
    setVorschau(null);
    setText('');
    navigiere({ art: 'formular', modul: 'uebersicht' });
  };

  const umschalten = (liste: TeilListe, id: string, an: boolean) => {
    if (!vorschau) return;
    const ids = new Set(vorschau.auswahl.eintraege[liste] ?? []);
    if (an) ids.add(id);
    else ids.delete(id);
    setVorschau({ ...vorschau, auswahl: { ...vorschau.auswahl, eintraege: { ...vorschau.auswahl.eintraege, [liste]: [...ids] } } });
  };
  const bereichUmschalten = (pfad: string, an: boolean) => {
    if (!vorschau) return;
    const b = new Set(vorschau.auswahl.bereiche);
    if (an) b.add(pfad);
    else b.delete(pfad);
    setVorschau({ ...vorschau, auswahl: { ...vorschau.auswahl, bereiche: [...b] } });
  };

  const aktuell = projekt.value;
  const aenderungen = vorschau ? vorschau.vergleich.listen.reduce((s, l) => s + l.eintraege.length, 0) + vorschau.vergleich.bereiche.length : 0;

  return (
    <section class="karte ki-import" aria-labelledby="ki-import-titel">
      <h2 id="ki-import-titel">{t('ki_import.titel')}</h2>
      <p>{t('ki_import.text')}</p>
      {!offen ? (
        <button type="button" id="ki-import-start" onClick={() => setOffen(true)}>{t('ki_import.oeffnen')}</button>
      ) : (
        <div>
          <div class="feld">
            <label for="ki-import-text">{t('ki_import.einfuegen')}</label>
            <textarea id="ki-import-text" rows={6} value={text} onInput={(e) => setText(e.currentTarget.value)} spellcheck={false} />
          </div>
          <div class="leiste">
            <button type="button" id="ki-import-uebernehmen" disabled={!text.trim() || laeuft} aria-busy={laeuft ? 'true' : undefined} onClick={() => void gesperrt(() => uebernehmen(text))}>{t('ki_import.uebernehmen')}</button>
            <button type="button" id="ki-import-datei-knopf" disabled={laeuft} onClick={() => datei.current?.click()}>{t('ki_import.datei')}</button>
            <input type="file" id="ki-import-datei" ref={datei} hidden tabIndex={-1} aria-hidden="true" accept=".json,.txt,.md,application/json,text/plain"
              onChange={async (e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (!f) return;
                await gesperrt(async () => {
                  try {
                    // Eingangsmodul: Grösse vor dem Lesen (AF-018)
                    await uebernehmen(await liesTextBegrenzt(f, 'ki-ergebnis'));
                  } catch (x) {
                    setFehler(fehlerVerstaendlich(x));
                  }
                });
              }} />
          </div>
          {vorschau && aktuell && (
            <div class="karte abschnitt" id="ki-teilimport" role="region" aria-labelledby="ki-teilimport-titel">
              <h3 id="ki-teilimport-titel">{t('ki_import.teil_titel')}</h3>
              <p>{t('ki_import.teil_text', { name: aktuell.organisation.name || t('kopf.ohne_name') })}</p>
              {aenderungen === 0 && <Hinweis als="p" art="ok">{t('ki_import.teil_keine')}</Hinweis>}
              {vorschau.vergleich.listen.filter((l) => l.eintraege.length > 0).map((l) => (
                <fieldset key={l.liste} class="teilimport-liste" data-liste={l.liste}>
                  <legend>
                    {inhalt(`app.ki_import.listen.${l.liste}`) ?? l.liste}{' '}
                    <span class="zweitext">{t('ki_import.teil_anzahl', { neu: l.eintraege.filter((e) => e.art === 'neu').length, geaendert: l.eintraege.filter((e) => e.art === 'geaendert').length, gleich: l.gleich })}</span>
                  </legend>
                  {l.eintraege.map((e) => (
                    <label key={e.id} class="check">
                      <input type="checkbox" checked={(vorschau.auswahl.eintraege[l.liste] ?? []).includes(e.id)} onChange={(ev) => umschalten(l.liste, e.id, ev.currentTarget.checked)} />
                      <span><span class="marke-id">{e.id}</span> {e.titel} <StatusPille art={e.art === 'neu' ? 'gut' : 'warnung'}>{t(`ki_import.art.${e.art}`)}</StatusPille></span>
                    </label>
                  ))}
                </fieldset>
              ))}
              {vorschau.vergleich.bereiche.length > 0 && (
                <fieldset class="teilimport-liste" data-liste="bereiche">
                  <legend>{t('ki_import.teil_bereiche')}</legend>
                  {vorschau.vergleich.bereiche.map((b) => (
                    <label key={b.pfad} class="check">
                      <input type="checkbox" checked={vorschau.auswahl.bereiche.includes(b.pfad)} onChange={(ev) => bereichUmschalten(b.pfad, ev.currentTarget.checked)} />
                      <span>{bereichText(b.pfad)} <StatusPille art={b.art === 'neu' ? 'gut' : 'warnung'}>{t(`ki_import.art.${b.art}`)}</StatusPille></span>
                    </label>
                  ))}
                </fieldset>
              )}
              <div class="leiste">
                <button type="button" id="ki-teil-uebernehmen" disabled={anzahlGewaehlt(vorschau.auswahl) === 0 || laeuft} aria-busy={laeuft ? 'true' : undefined} onClick={() => void gesperrt(async () => auswahlUebernehmen(aktuell, vorschau))}>
                  {t('ki_import.teil_uebernehmen', { anzahl: anzahlGewaehlt(vorschau.auswahl) })}
                </button>
                {vorschau.ganz?.ok && (
                  <button type="button" id="ki-ganz-ersetzen" onClick={async () => (await bestaetigen({ text: t('ki_import.ersetzen', { name: aktuell.organisation.name || t('kopf.ohne_name') }), titel: t('bestaetigen.titel_projekt_ersetzen'), ja: t('bestaetigen.projekt_ersetzen'), gefahr: true })) && ganzUebernehmen(vorschau.ganz as Extract<KiErgebnis, { ok: true }>, true)}>
                    {t('ki_import.ganz_ersetzen')}
                  </button>
                )}
                <button type="button" class="leise" onClick={() => setVorschau(null)}>{t('allgemein.abbrechen')}</button>
              </div>
            </div>
          )}
          {fehler && <Hinweis als="p" art="fehler" role="alert" id="ki-import-fehler" style={{ whiteSpace: 'pre-line' }}>{fehler}</Hinweis>}
        </div>
      )}
    </section>
  );
}

// Einstellungen «Normtexte aus Ihrer Normausgabe»: eigene Norm-PDF laden (Lizenzbestätigung vorher), Vorschau mit
// Abgleich je ID und Korrektur, Anzeige des Gespeicherten, Bestätigung für Dokumente, Quellenvermerk, Export, Löschen.
import { useEffect, useRef, useState } from 'preact/hooks';
import { erwartetFuer, pflichtIds } from '../../../normtexte/erwartet.ts';
import type { ParseErgebnis } from '../../../normtexte/parser.ts';
import type { NormEintrag, NormId, Normpaket, NormSprache, NormTeil } from '../../../normtexte/typen.ts';
import { appDaten } from '../../daten.ts';
import { inhalt, t, uiSprache } from '../../i18n.ts';
import { vermerkText } from '../../../normtexte/vermerk.ts';
import { liesNormPdf, PasswortNoetig } from '../../normtexte/pdf.ts';
import { loescheNormtexte, mitTeil, normpaket, normpaketDauerhaft, normpaketExport, ohneTeil, pruefeNormpaket, speichereNormpaket } from '../../normtexte/zustand.ts';
import { herunterladen } from '../../worker/client.ts';
import { melde } from '../../zustand/store.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { EingangsFehler, liesBegrenzt, liesJsonBegrenzt } from '../../../eingang/lesen.ts';
import { bestaetigen } from '../../zustand/bestaetigen.ts';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

const SPRACHE = { de: 'Deutsch', en: 'English' } as const;

function datum(iso: string): string {
  const [j, m, d] = iso.slice(0, 10).split('-');
  return j && m && d ? `${d}.${m}.${j}` : iso;
}

/** Entwurf eines Teils aus dem PDF oder einem vorhandenen Teil (Bearbeiten) */
interface Entwurf {
  teil: NormTeil;
  nurAenderung: boolean;
  neu: boolean;
}

function zaehle(teil: NormTeil): { gefunden: number; pflicht: number } {
  const pflicht = pflichtIds(erwartetFuer(teil.norm, appDaten().kataloge));
  return { gefunden: pflicht.filter((id) => teil.eintraege[id]?.titel && teil.eintraege[id]?.text).length, pflicht: pflicht.length };
}

function Vorschau({ entwurf, schliessen }: { entwurf: Entwurf; schliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [teil, setTeil] = useState<NormTeil>(entwurf.teil);
  const [offen, setOffen] = useState<NormId | null>(null);
  useEffect(() => ref.current?.showModal(), []);
  const e = erwartetFuer(teil.norm, appDaten().kataloge);
  const pflicht = new Set(pflichtIds(e));
  // Reihenfolge: Kapitel und Abschnitte, dann Gruppen und Controls wie im Katalog
  const ids = teil.norm === '42001' ? [...e.zusatz.filter((x) => x.startsWith('K-')), ...e.abschnitte].sort(vergleicheId).concat([...e.zusatz.filter((x) => !x.startsWith('K-')), ...e.controls].sort(vergleicheId)) : [...e.abschnitte, ...e.zusatz, ...e.controls].sort(vergleicheId);
  const { gefunden, pflicht: n } = zaehle(teil);
  const aendere = (id: NormId, wert: Partial<NormEintrag>) => {
    const alt = teil.eintraege[id] ?? { titel: '', text: '' };
    setTeil({ ...teil, eintraege: { ...teil.eintraege, [id]: { ...alt, ...wert, manuell: true } } });
  };
  // B5: Beschäftigt beim Speichern, keine zweite Auslösung
  const [speichert, setSpeichert] = useState(false);
  const sperre = useRef(false);
  const uebernehmen = async () => {
    if (sperre.current) return;
    sperre.current = true;
    setSpeichert(true);
    try {
      const mit = mitTeil(normpaket.value, teil, entwurf.nurAenderung);
      await speichereNormpaket(entwurf.neu ? { ...mit, lizenz: { ...mit.lizenz, bestaetigtAm: new Date().toISOString() } } : mit);
      melde(t('normtexte.geladen', { bezeichnung: teil.bezeichnung }), 'ok');
      ref.current?.close();
    } finally {
      sperre.current = false;
      setSpeichert(false);
    }
  };
  return (
    <dialog ref={ref} onClose={schliessen} aria-labelledby="nt-titel" class="breit-dialog" id="normtexte-vorschau">
      <h2 id="nt-titel">{t('normtexte.vorschau_titel')}</h2>
      <p id="normtexte-abgleich">
        {t('normtexte.vorschau_text', { bezeichnung: teil.bezeichnung, ausgabe: teil.ausgabe, sprache: SPRACHE[teil.sprache], gefunden, pflicht: n, art: t(`normtexte.vorschau_art_${teil.norm}`) })}
      </p>
      {teil.amd && <p class="zweitext">{t(entwurf.nurAenderung ? 'normtexte.vorschau_nur_amd' : 'normtexte.vorschau_amd', { amd: teil.amd })}</p>}
      {teil.norm === '27001' && !teil.amd && <p class="zweitext" id="normtexte-ohne-amd">{t('normtexte.vorschau_ohne_amd')}</p>}
      {gefunden < n && <Hinweis als="p" role="status">{t('normtexte.vorschau_unvollstaendig')}</Hinweis>}
      <div class="feld">
        <label for="normtexte-sprache">{t('normtexte.sprache_label')}</label>
        <Auswahl id="normtexte-sprache" class="schmal" value={teil.sprache} onChange={(ev) => setTeil({ ...teil, sprache: ev.currentTarget.value as NormSprache })}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </Auswahl>
      </div>
      <div class="tabelle-feld dialog-tabelle">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('normtexte.spalte_id')}</th>
              <th scope="col">{t('normtexte.spalte_status')}</th>
              <th scope="col">{t('normtexte.spalte_titel')}</th>
              <th scope="col">{t('normtexte.spalte_text')}</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const x = teil.eintraege[id];
              const nurTitel = !pflicht.has(id) && !e.abschnitte.includes(id);
              const ok = !!x?.titel && (nurTitel || !!x.text);
              return (
                <tr key={id} data-id={id}>
                  <th scope="row">{id.replace(/^27001-/, '').replace(/^K-/, '')}</th>
                  <td>
                    <StatusPille art={ok ? 'gut' : 'warnung'} data-gefunden={ok ? 'ja' : 'nein'}>{t(ok ? 'normtexte.gefunden' : 'normtexte.nicht_gefunden')}</StatusPille>
                    {x?.manuell && <span class="zweitext"> {t('normtexte.manuell')}</span>}
                  </td>
                  <td>
                    {offen === id ? (
                      <input type="text" value={x?.titel ?? ''} aria-label={`${t('normtexte.spalte_titel')} ${id}`} onInput={(ev) => aendere(id, { titel: ev.currentTarget.value })} />
                    ) : (
                      x?.titel ?? ''
                    )}
                  </td>
                  <td>
                    {offen === id && !nurTitel ? (
                      <textarea rows={6} value={x?.text ?? ''} aria-label={`${t('normtexte.spalte_text')} ${id}`} onInput={(ev) => aendere(id, { text: ev.currentTarget.value })} />
                    ) : nurTitel ? (
                      <span class="zweitext">{t('normtexte.nur_titel')}</span>
                    ) : (
                      <span class="zweitext">{(x?.text ?? '').slice(0, 90)}{(x?.text.length ?? 0) > 90 ? ' …' : ''}</span>
                    )}{' '}
                    <button type="button" class="klein leise" aria-label={t('normtexte.zeile_bearbeiten', { id })} onClick={() => setOffen(offen === id ? null : id)}>
                      {offen === id ? t('normtexte.fertig') : t('normtexte.zeile_knopf')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div class="leiste ende">
        <button type="button" class="leise" onClick={() => ref.current?.close()}>{t('allgemein.abbrechen')}</button>
        <button type="button" class="primaer" id="normtexte-uebernehmen" disabled={speichert || (entwurf.nurAenderung ? false : gefunden === 0)} aria-busy={speichert ? 'true' : undefined} onClick={() => void uebernehmen()}>{t('normtexte.uebernehmen')}</button>
      </div>
    </dialog>
  );
}

/** K-4 < K-4.1 < K-10; A.2 < A.2.2 < A.10.4; 27001-5.1 < 27001-5.10 */
function vergleicheId(a: string, b: string): number {
  const z = (s: string) => s.replace(/^27001-/, '').replace(/^K-/, '').replace(/^A\./, '').split('.').map(Number);
  const x = z(a);
  const y = z(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export function Normtexte() {
  const p = normpaket.value;
  const [lizenz, setLizenz] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const paket = useRef<HTMLInputElement>(null);
  // V-05, B5: welcher Import beschäftigt ist (aria-busy); die Sperre verhindert eine zweite Auslösung
  const [art, setArt] = useState<'pdf' | 'paket' | null>(null);
  const sperre = useRef(false);

  const ausPdf = async (datei: File | undefined) => {
    if (!datei || sperre.current) return;
    sperre.current = true;
    setArt('pdf');
    setFehler(null);
    setStatus(t('normtexte.lesen_start'));
    let passwort: string | undefined;
    try {
      for (;;) {
        try {
          // Eingangsmodul: Grösse vor dem Lesen; je Versuch neu gelesen, der Puffer geht ohne Kopie an den Worker (AF-018)
          const daten = await liesBegrenzt(datei, 'norm-pdf');
          const r: ParseErgebnis = await liesNormPdf(daten, { passwort, fortschritt: (fertig, gesamt) => setStatus(t('normtexte.lesen', { fertig, gesamt })) });
          if (!r.norm) {
            setFehler(r.nichtUnterstuetzt ? t('normtexte.fehler_nicht_unterstuetzt', { norm: r.nichtUnterstuetzt }) : t('normtexte.fehler_norm'));
            return;
          }
          const teil: NormTeil = {
            norm: r.norm,
            sprache: r.sprache,
            bezeichnung: r.bezeichnung,
            ausgabe: r.ausgabe,
            ...(r.amd ? { amd: r.amd } : {}),
            quelle: datei.name,
            importiert: new Date().toISOString(),
            eintraege: r.eintraege,
          };
          setEntwurf({ teil, nurAenderung: r.nurAenderung, neu: true });
          return;
        } catch (e) {
          if (!(e instanceof PasswortNoetig)) throw e;
          const eingabe = prompt(t('normtexte.passwort'));
          if (eingabe === null) return;
          passwort = eingabe;
        }
      }
    } catch (e) {
      setFehler(t('normtexte.fehler_pdf', { meldung: fehlerVerstaendlich(e) }));
    } finally {
      setStatus(null);
      sperre.current = false;
      setArt(null);
    }
  };

  const ausPaket = async (datei: File | undefined) => {
    if (!datei || sperre.current) return;
    sperre.current = true;
    setArt('paket');
    setFehler(null);
    try {
      const neu = pruefeNormpaket(await liesJsonBegrenzt(datei, 'normpaket'));
      let ziel: Normpaket = { ...normpaket.value, lizenz: { ...normpaket.value.lizenz, lizenzgeber: normpaket.value.lizenz.lizenzgeber || neu.lizenz.lizenzgeber, lizenznummer: normpaket.value.lizenz.lizenznummer || neu.lizenz.lizenznummer, bestaetigtAm: new Date().toISOString() } };
      for (const teil of neu.teile) ziel = mitTeil(ziel, teil);
      await speichereNormpaket(ziel);
      melde(t('normtexte.geladen', { bezeichnung: neu.teile.map((x) => x.bezeichnung).join(', ') }), 'ok');
    } catch (e) {
      setFehler(e instanceof EingangsFehler ? fehlerVerstaendlich(e) : t('normtexte.fehler_paket'));
    } finally {
      sperre.current = false;
      setArt(null);
    }
  };

  const setzeLizenz = (f: (l: typeof p.lizenz) => typeof p.lizenz) => void speichereNormpaket({ ...normpaket.value, lizenz: f(normpaket.value.lizenz) });
  // Rückfall-Regel: Teile, für deren Norm keine Ausgabe in der Sprache der Oberfläche geladen ist
  const rueckfall = p.teile.filter((teil) => teil.sprache !== uiSprache.value && !p.teile.some((x) => x.norm === teil.norm && x.sprache === uiSprache.value));
  const vermerk = p.teile.map((teil) => vermerkText((k, w) => inhalt(k, w) ?? k, teil, p.lizenz.lizenzgeber, p.lizenz.lizenznummer)).join(' ');

  return (
    <section class="karte" id="normtexte" aria-labelledby="normtexte-titel">
      <h2 id="normtexte-titel">{t('normtexte.titel')}</h2>
      <p>{t('normtexte.text')}</p>
      <p class="zweitext">{t('normtexte.datenschutz')}</p>
      {p.teile.length === 0 ? (
        <p id="normtexte-stand">{t('normtexte.leer')}</p>
      ) : (
        <ul id="normtexte-stand">
          {p.teile.map((teil) => {
            const z = zaehle(teil);
            return (
              <li key={`${teil.norm}-${teil.sprache}`} data-norm={teil.norm}>
                {t('normtexte.teil', { bezeichnung: teil.bezeichnung, sprache: teil.sprache.toUpperCase(), gefunden: z.gefunden, pflicht: z.pflicht, datum: datum(teil.importiert), datei: teil.quelle })}
                {teil.amd ? ` ${t('normtexte.teil_amd', { amd: teil.amd })}` : ''}{' '}
                <button type="button" class="klein" onClick={() => setEntwurf({ teil, nurAenderung: false, neu: false })}>{t('normtexte.bearbeiten')}</button>{' '}
                <button type="button" class="klein leise" onClick={async () => {
                  if (await bestaetigen({ titel: t('bestaetigen.titel_normtexte_entfernen', { bezeichnung: teil.bezeichnung, sprache: teil.sprache.toUpperCase() }), text: t('normtexte.entfernen_frage', { bezeichnung: teil.bezeichnung, sprache: teil.sprache.toUpperCase() }), ja: t('bestaetigen.normtexte_entfernen'), gefahr: true })) void speichereNormpaket(ohneTeil(normpaket.value, teil.norm, teil.sprache));
                }}>{t('normtexte.entfernen')}</button>
              </li>
            );
          })}
        </ul>
      )}
      {rueckfall.length > 0 && <p class="zweitext" id="normtexte-rueckfall">{rueckfall.map((teil) => t(`normtexte.rueckfall_${teil.sprache}`, { bezeichnung: teil.bezeichnung })).join(' ')}</p>}
      {normpaketDauerhaft.value !== null && <p class="zweitext" id="normtexte-ablage">{t(normpaketDauerhaft.value ? 'normtexte.ablage_dauerhaft' : 'normtexte.ablage_sitzung')}</p>}

      <fieldset class="feld">
        <legend>{t('normtexte.lizenz_titel')}</legend>
        <p class="feldhilfe">{t('normtexte.lizenz_hinweis')}</p>
        <label class="check">
          <input type="checkbox" id="normtexte-lizenz" checked={lizenz} onChange={(ev) => setLizenz(ev.currentTarget.checked)} />
          <span>{t('normtexte.lizenz_bestaetigen')}</span>
        </label>
        <div class="leiste">
          <button type="button" id="normtexte-pdf" disabled={!lizenz || !!status || !!art} aria-busy={art === 'pdf' ? 'true' : undefined} onClick={() => pdf.current?.click()}>{t('normtexte.pdf_laden')}</button>
          <button type="button" id="normtexte-paket" disabled={!lizenz || !!status || !!art} aria-busy={art === 'paket' ? 'true' : undefined} onClick={() => paket.current?.click()}>{t('normtexte.paket_laden')}</button>
        </div>
        <input type="file" id="normtexte-datei" ref={pdf} hidden tabIndex={-1} aria-hidden="true" accept=".pdf,application/pdf"
          onChange={(ev) => { const f = ev.currentTarget.files?.[0]; ev.currentTarget.value = ''; void ausPdf(f); }} />
        <input type="file" id="normtexte-paketdatei" ref={paket} hidden tabIndex={-1} aria-hidden="true" accept=".json,application/json"
          onChange={(ev) => { const f = ev.currentTarget.files?.[0]; ev.currentTarget.value = ''; void ausPaket(f); }} />
        {status && <p role="status" id="normtexte-status">{status}</p>}
        {fehler && <Hinweis als="p" art="fehler" role="alert" id="normtexte-fehler">{fehler}</Hinweis>}
      </fieldset>

      {p.teile.length > 0 && (
        <fieldset class="feld">
          <legend>{t('normtexte.dokumente_titel')}</legend>
          <p class="feldhilfe">{t('normtexte.dokumente_text')}</p>
          <label class="check">
            <input type="checkbox" id="normtexte-dokumente" checked={p.lizenz.dokumente} onChange={(ev) => {
              const an = ev.currentTarget.checked;
              setzeLizenz((l) => ({ ...l, dokumente: an, ...(an ? { dokumenteBestaetigtAm: new Date().toISOString() } : { dokumenteBestaetigtAm: undefined }) }));
            }} />
            <span>{t('normtexte.dokumente_bestaetigen')}</span>
          </label>
          <div class="feld">
            <label for="normtexte-lizenzgeber">{t('normtexte.lizenzgeber')}</label>
            <input type="text" id="normtexte-lizenzgeber" value={p.lizenz.lizenzgeber} onChange={(ev) => { const v = ev.currentTarget.value; setzeLizenz((l) => ({ ...l, lizenzgeber: v })); }} />
          </div>
          <div class="feld">
            <label for="normtexte-lizenznummer">{t('normtexte.lizenznummer')}</label>
            <input type="text" id="normtexte-lizenznummer" value={p.lizenz.lizenznummer} onChange={(ev) => { const v = ev.currentTarget.value; setzeLizenz((l) => ({ ...l, lizenznummer: v })); }} />
          </div>
          {p.lizenz.dokumente && <p class="zweitext">{t('normtexte.vermerk_vorschau', { vermerk })}</p>}
        </fieldset>
      )}

      {p.teile.length > 0 && (
        <div class="leiste">
          <button type="button" id="normtexte-export" onClick={async () => {
            if (!(await bestaetigen({ text: t('normtexte.export_frage'), titel: t('bestaetigen.titel_normtexte_exportieren'), ja: t('bestaetigen.normtexte_exportieren') }))) return;
            herunterladen(normpaketExport(normpaket.value, t('normtexte.export_hinweis')), `Normpaket_${new Date().toISOString().slice(0, 10)}.normpaket.json`, 'application/json');
          }}>{t('normtexte.export')}</button>
          <button type="button" id="normtexte-loeschen" class="leise" onClick={async () => {
            if (!(await bestaetigen({ text: t('normtexte.loeschen_frage'), titel: t('bestaetigen.titel_normtexte_loeschen'), ja: t('bestaetigen.normtexte_loeschen'), gefahr: true }))) return;
            void loescheNormtexte().then(() => melde(t('normtexte.geloescht'), 'ok'));
          }}>{t('normtexte.loeschen')}</button>
        </div>
      )}
      {p.teile.length > 0 && <p class="zweitext">{t('normtexte.export_hinweis')}</p>}
      {entwurf && <Vorschau entwurf={entwurf} schliessen={() => setEntwurf(null)} />}
    </section>
  );
}

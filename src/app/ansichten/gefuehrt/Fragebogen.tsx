// Fragebogen für Fachbereiche: Export als XLSX (Blatt aus D-10, je Fachbereich), Import der ausgefüllten Dateien
// mit Bestätigungsansicht, bevor Zeilen ins KI-Inventar übernommen werden.
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { GRENZEN } from '../../../eingang/grenzen.ts';
import { liesBegrenzt } from '../../../eingang/lesen.ts';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { optionText, t } from '../../i18n.ts';
import { neuerEintrag } from '../../logik/eintraege.ts';
import { fragebogenText, liesFragebogen, type FragebogenUmfeld, type ImportZeile } from '../../logik/fragebogen.ts';
import { holePfad } from '../../../i18n/texte.ts';
import { optionenVon } from '../../ui/Feld.tsx';
import { erzeugeFragebogen, herunterladen, liesXlsx } from '../../worker/client.ts';
import { aendereMit, heute, melde } from '../../zustand/store.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';
import { zweiterKlick } from '../../ui/beschaeftigt.ts';

/** Höchstgrösse einer Fragebogen-Datei (XLSX). */
const MAX_BYTES = GRENZEN.fragebogen.maxBytes;

export function fragebogenUmfeld(): FragebogenUmfeld {
  const d = appDaten();
  const text = (s: string, sprache: 'de' | 'en') => {
    const w = holePfad(d.texte[sprache], s);
    return typeof w === 'string' ? w : undefined;
  };
  return {
    sprachen: [fragebogenText(d.texte.de), fragebogenText(d.texte.en)],
    fachbereiche: optionenVon('fachbereich').map((wert) => ({
      wert,
      texte: (['de', 'en'] as const).map((s) => text(`gefuehrt.optionen.fachbereich.${wert}`, s)).filter((x): x is string => !!x),
    })),
    beschriftung: {
      ausgefuelltVon: t('fragebogen.b_ausgefuellt'),
      personen: t('fragebogen.b_personen'),
      haeufigkeit: t('fragebogen.b_haeufigkeit'),
      anbieter: t('fragebogen.b_anbieter'),
      bemerkungen: t('fragebogen.b_bemerkungen'),
      unklar: t('fragebogen.b_unklar'),
    },
  };
}

/** Bestätigte Zeilen als neue KI-Systeme anlegen; liefert die neuen IDs. */
export function zeilenUebernehmen(zeilen: readonly ImportZeile[]): string[] {
  const ids: string[] = [];
  const datum = heute();
  aendereMit((p) => {
    for (const z of zeilen) {
      const werte = Object.fromEntries(Object.entries({ ...z.werte, erfasstAm: datum }).filter(([, v]) => v !== undefined && v !== ''));
      const e = neuerEintrag(p, 'kiSysteme', werte);
      p.kiSysteme.push(e as never);
      ids.push(String(e['id']));
    }
  });
  return ids;
}

function Bestaetigung({ zeilen, schliessen }: { zeilen: ImportZeile[]; schliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [wahl, setWahl] = useState<Set<number>>(() => new Set(zeilen.map((z, i) => (z.doppelt ? -1 : i)).filter((i) => i >= 0)));
  useEffect(() => ref.current?.showModal(), []);
  const umschalten = (i: number) => {
    const n = new Set(wahl);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    setWahl(n);
  };
  const neu = zeilen.filter((z) => !z.doppelt).length;
  return (
    <dialog ref={ref} onClose={schliessen} aria-labelledby="fb-titel" class="breit-dialog" id="fragebogen-dialog">
      <h2 id="fb-titel">{t('fragebogen.bestaetigen_titel')}</h2>
      <p>{t('fragebogen.ergebnis', { anzahl: zeilen.length, neu, doppelt: zeilen.length - neu })}</p>
      <p class="zweitext">{t('fragebogen.bestaetigen_text')}</p>
      <div class="tabelle-feld dialog-tabelle">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('fragebogen.uebernehmen_spalte')}</th>
              <th scope="col">{t('liste.name')}</th>
              <th scope="col">{t('fragebogen.zweck')}</th>
              <th scope="col">{t('liste.typ')}</th>
              <th scope="col">{t('fragebogen.fachbereich')}</th>
              <th scope="col">{t('fragebogen.hinweise')}</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => (
              <tr key={`${z.blatt}-${z.nr}`}>
                <td>
                  <label class="check">
                    <input type="checkbox" checked={wahl.has(i)} onChange={() => umschalten(i)} aria-label={t('fragebogen.zeile_uebernehmen', { name: z.werte.name })} />
                  </label>
                </td>
                <td>{z.werte.name}<br /><span class="zweitext">{t('fragebogen.zeile', { nr: z.nr })}</span></td>
                <td>{z.werte.zweck}</td>
                <td>{optionText('kiTyp', z.werte.typ ?? '')}</td>
                <td>{optionText('fachbereich', z.werte.fachbereich ?? '')}</td>
                <td>
                  {z.doppelt && <StatusPille art="warnung">{t('fragebogen.doppelt', { id: z.doppelt })}</StatusPille>}{' '}
                  {z.hinweise.map((h) => <span key={h} class="zweitext">{t(`fragebogen.hinweis.${h}`)} </span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="leiste ende">
        <button type="button" class="leise" onClick={() => ref.current?.close()}>{t('allgemein.abbrechen')}</button>
        <button type="button" class="primaer" id="fragebogen-uebernehmen" disabled={wahl.size === 0} onClick={() => {
          const ids = zeilenUebernehmen(zeilen.filter((_, i) => wahl.has(i)));
          melde(t('fragebogen.uebernommen', { anzahl: ids.length }), 'ok');
          ref.current?.close();
        }}>{t('fragebogen.uebernehmen', { anzahl: wahl.size })}</button>
      </div>
    </dialog>
  );
}

export function Fragebogen({ p }: { p: Projekt }) {
  const bereiche = (p.meta.gefuehrt.antworten['inventar'] as { fragebogenBereiche?: string[] } | undefined)?.fragebogenBereiche ?? [];
  const [bereich, setBereich] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [zeilen, setZeilen] = useState<ImportZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  const sprache = p.meta.dokumentSprache;

  const sperre = useRef(false);
  const exportieren = async () => {
    // Doppelklick: die Sperre greift vor dem nächsten Zeichnen (Prüfung Dokumente und Download)
    if (sperre.current) return;
    sperre.current = true;
    setLaeuft(true);
    try {
      const r = await erzeugeFragebogen(p, sprache, bereich ? optionText('fachbereich', bereich) : undefined);
      herunterladen(r.daten, r.name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      melde(t('fragebogen.exportiert', { name: r.name }), 'ok');
    } catch (e) {
      melde(`${t('fragebogen.fehler_export')}: ${fehlerVerstaendlich(e)}`, 'fehler');
    } finally {
      sperre.current = false;
      setLaeuft(false);
    }
  };

  const importieren = async (datei: File | undefined) => {
    setFehler(null);
    if (!datei) return;
    if (datei.size > MAX_BYTES) return setFehler(t('fragebogen.zu_gross'));
    setLaeuft(true);
    try {
      const daten = await liesBegrenzt(datei, 'fragebogen');
      if (daten[0] !== 0x50 || daten[1] !== 0x4b) return setFehler(t('fragebogen.kein_xlsx'));
      const gelesen = liesFragebogen(await liesXlsx(daten), p, fragebogenUmfeld());
      if (gelesen === null) return setFehler(t('fragebogen.kein_fragebogen'));
      if (gelesen.length === 0) return setFehler(t('fragebogen.leer'));
      setZeilen(gelesen);
    } catch (e) {
      setFehler(`${t('fragebogen.kein_xlsx')} (${fehlerVerstaendlich(e)})`);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <section class="karte abschnitt fragebogen" aria-labelledby="fragebogen-titel">
      <h2 id="fragebogen-titel">{t('fragebogen.titel')}</h2>
      <p class="zweitext">{t('fragebogen.text')}</p>
      <div class="leiste">
        <label for="fragebogen-bereich">{t('fragebogen.fachbereich')}</label>
        <Auswahl id="fragebogen-bereich" value={bereich} onChange={(e) => setBereich(e.currentTarget.value)} class="schmal">
          <option value="">{t('fragebogen.alle_bereiche')}</option>
          {/* Geplante Bereiche zuerst, alle übrigen danach wählbar (Rollentest RT-20: Bereich fehlte in der Auswahl) */}
          {bereiche.length > 0 && (
            <optgroup label={t('fragebogen.geplant')}>
              {bereiche.map((b) => <option key={b} value={b}>{optionText('fachbereich', b)}</option>)}
            </optgroup>
          )}
          <optgroup label={bereiche.length ? t('fragebogen.weitere') : t('fragebogen.fachbereich')}>
            {optionenVon('fachbereich').filter((b) => !bereiche.includes(b)).map((b) => <option key={b} value={b}>{optionText('fachbereich', b)}</option>)}
          </optgroup>
        </Auswahl>
        <button type="button" id="fragebogen-export" disabled={laeuft} aria-busy={laeuft ? 'true' : undefined} onClick={(ev) => !zweiterKlick(ev) && void exportieren()}>{t('fragebogen.export')}</button>
        <button type="button" id="fragebogen-import" disabled={laeuft} onClick={() => eingabe.current?.click()}>{t('fragebogen.import')}</button>
        <input type="file" id="fragebogen-datei" ref={eingabe} hidden tabIndex={-1} aria-hidden="true" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void importieren(f); }} />
      </div>
      {fehler && <Hinweis als="p" art="fehler" role="alert" id="fragebogen-fehler">{fehler}</Hinweis>}
      {zeilen && <Bestaetigung zeilen={zeilen} schliessen={() => setZeilen(null)} />}
    </section>
  );
}

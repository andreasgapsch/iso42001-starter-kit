// Vorschau einer Version: PDF über pdf.js (Seite als Bild im Worker), Bilder, Excel (Zellwerte), Word (Text) und für
// Firmendokumente der aktuelle Stand aus dem Projekt über die IR-Vorschau. Alles im Browser, nichts verlässt den Rechner.
import { fehlerVerstaendlich } from '../../worker/fehlertext.ts';
import { useEffect, useState } from 'preact/hooks';
import type { SichtEintrag, SichtVersion } from '../../../bibliothek/sicht.ts';
import { endungVon, mimeVon } from '../../../bibliothek/layout.ts';
import type { DocxDokument, XlsxMappe } from '../../../generator/ir.ts';
import type { Projekt } from '../../../model/typen.ts';
import { pdfSeiteBild } from '../../normtexte/pdf.ts';
import { IrVorschau } from '../../ui/IrVorschau.tsx';
import { docxTextLesen, erzeugeIr, liesXlsx } from '../../worker/client.ts';
import { bt, lesen } from './zustand.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

type Inhalt =
  | { art: 'bild'; url: string; seiten?: number }
  | { art: 'tabelle'; blaetter: { name: string; zeilen: (string | number | boolean | null)[][] }[] }
  | { art: 'text'; absaetze: { text: string; ebene?: number; tabelle?: boolean }[] }
  | { art: 'roh'; text: string }
  | { art: 'ir'; ir: DocxDokument | XlsxMappe }
  | { art: 'keine' };

const BILD = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

/** Bild als data:-URL (CSP img-src data:); WebKit lädt blob:-URLs unter file:// nicht zuverlässig */
function dataUrl(daten: Uint8Array, typ: string): string {
  let s = '';
  for (let i = 0; i < daten.length; i += 0x8000) s += String.fromCharCode(...daten.subarray(i, i + 0x8000));
  return `data:${typ};base64,${btoa(s)}`;
}
const TEXT = new Set(['txt', 'csv', 'json', 'md', 'xml', 'drawio']);

/** nurProjekt: ohne Datei (keine Ablage, z. B. im Beispiel) nur der aktuelle Stand aus dem Projekt (Nutzertest rc.10, U-20) */
export function Vorschau({ p, e, v, nurProjekt }: { p: Projekt; e: SichtEintrag; v?: SichtVersion; nurProjekt?: boolean }) {
  const [inhalt, setInhalt] = useState<Inhalt | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [seite, setSeite] = useState(1);
  const [blatt, setBlatt] = useState(0);
  const [projektWahl, setProjektStand] = useState(false);
  const projektStand = projektWahl || nurProjekt || !v;
  const endung = v ? endungVon(v.datei) : '';
  useEffect(() => {
    let aktiv = true;
    setFehler(null);
    setInhalt(null);
    (async (): Promise<Inhalt> => {
      if (projektStand) {
        const r = await erzeugeIr(p, p.meta.dokumentSprache, e.id.replace(/-KI-\d+$/, ''), /-(KI-\d+)$/.exec(e.id)?.[1]);
        return r.ir ? { art: 'ir', ir: r.ir } : { art: 'keine' };
      }
      const daten = await lesen(v!.datei);
      if (endung === 'pdf') {
        const r = await pdfSeiteBild(daten, seite, 900);
        return { art: 'bild', url: dataUrl(r.png, 'image/png'), seiten: r.seiten };
      }
      if (BILD.has(endung)) return { art: 'bild', url: dataUrl(daten, mimeVon(v.datei)) };
      if (endung === 'xlsx') return { art: 'tabelle', blaetter: await liesXlsx(daten) };
      if (endung === 'docx') return { art: 'text', absaetze: await docxTextLesen(daten) };
      if (TEXT.has(endung)) return { art: 'roh', text: new TextDecoder().decode(daten.subarray(0, 40_000)) };
      return { art: 'keine' };
    })().then(
      (i) => aktiv && setInhalt(i),
      (x: unknown) => aktiv && setFehler(fehlerVerstaendlich(x)),
    );
    return () => {
      aktiv = false;
    };
  }, [v?.datei, seite, projektStand]);
  const firma = !!v && !nurProjekt && e.art === 'firmendokument' && (endung === 'docx' || endung === 'xlsx');
  const titel = v && !nurProjekt ? bt('vorschau.titel', { version: v.version }) : bt('vorschau.titel_projekt');
  return (
    <section class="bib-vorschau" id="bib-vorschau-bereich" aria-label={titel}>
      <div class="leiste">
        <strong>{titel}</strong>
        {firma && (
          <label class="bib-haken"><input type="checkbox" checked={projektStand} onChange={(ev) => setProjektStand(ev.currentTarget.checked)} /> {bt('vorschau.projektstand')}</label>
        )}
      </div>
      {fehler && <Hinweis als="p" art="fehler" role="alert">{bt('vorschau.fehler')}: {fehler}</Hinweis>}
      {!inhalt && !fehler && <p class="zweitext" role="status">{bt('vorschau.laedt')}</p>}
      {inhalt?.art === 'bild' && (
        <>
          <img src={inhalt.url} alt={bt('vorschau.bild', { titel: e.titel, seite })} class="bib-bild" />
          {inhalt.seiten && inhalt.seiten > 1 && (
            <div class="leiste">
              <button type="button" class="klein" disabled={seite <= 1} onClick={() => setSeite(seite - 1)}>{bt('vorschau.zurueck')}</button>
              <span class="zweitext">{bt('vorschau.seite', { seite, seiten: inhalt.seiten })}</span>
              <button type="button" class="klein" disabled={seite >= inhalt.seiten} onClick={() => setSeite(seite + 1)}>{bt('vorschau.weiter')}</button>
            </div>
          )}
        </>
      )}
      {inhalt?.art === 'tabelle' && (
        <>
          {inhalt.blaetter.length > 1 && (
            <Auswahl aria-label={bt('vorschau.blatt')} value={blatt} onChange={(ev) => setBlatt(Number(ev.currentTarget.value))}>
              {inhalt.blaetter.map((b, i) => <option key={b.name} value={i}>{b.name}</option>)}
            </Auswahl>
          )}
          <div class="bib-blatt" tabIndex={0} role="region" aria-label={inhalt.blaetter[blatt]?.name ?? ''}>
            <table>
              <tbody>
                {(inhalt.blaetter[blatt]?.zeilen ?? []).slice(0, 60).map((z, i) => (
                  <tr key={i}>{z.slice(0, 14).map((c, j) => <td key={j}>{c === null ? '' : String(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {inhalt?.art === 'text' && (
        <div class="bib-text">
          {inhalt.absaetze.slice(0, 200).map((a, i) => (a.ebene ? <p key={i} class={`bib-h${a.ebene}`}>{a.text}</p> : <p key={i} class={a.tabelle ? 'bib-zellentext' : undefined}>{a.text}</p>))}
        </div>
      )}
      {inhalt?.art === 'roh' && <pre class="bib-text">{inhalt.text}</pre>}
      {inhalt?.art === 'ir' && <div class="bib-ir"><IrVorschau ir={inhalt.ir} /></div>}
      {inhalt?.art === 'keine' && <p class="zweitext">{bt('vorschau.keine')}</p>}
    </section>
  );
}

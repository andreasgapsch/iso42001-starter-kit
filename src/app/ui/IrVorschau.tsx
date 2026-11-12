// HTML-Darstellung des Generator-Zwischenformats (IR): Live-Vorschau und druckfertige Ansicht (PDF über Browserdruck).
// Mit Gestaltung der Firma (ir.gestaltung) zeigt die Vorschau das Dokument wie gedruckt: immer hell, Farben und Schriften
// genau aus palette(gestaltung) (dieselben Werte wie DOCX und XLSX), Logo in der Kopfzeile, Titelseite, Wasserzeichen.
import { Symbol } from '../rahmen/symbole.tsx';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { MACHADO, type Fehlsicht } from '../../generator/farbe.ts';
import { kennungAnzeige, type DruckGestaltung } from '../../generator/gestaltung.ts';
import type { AblaufBlock, Block, DiagrammBlock, DocxDokument, Farbrolle, MatrixBlock, Text, XlsxMatrix, XlsxMappe } from '../../generator/ir.ts';
import { diagrammFarbeIn } from '../../generator/palette.ts';
import { pngDataUrl } from '../../generator/png.ts';
import { t } from '../i18n.ts';

/** Gestaltung des angezeigten Dokuments (Druckfarben statt App-Tokens) */
const GestaltungKontext = createContext<DruckGestaltung | undefined>(undefined);

function T({ text }: { text: Text }) {
  if (typeof text === 'string') return <>{text}</>;
  return (
    <>
      {text.map((l, i) => {
        let el = <>{l.text}</>;
        if (l.fett) el = <strong>{el}</strong>;
        if (l.kursiv) el = <em>{el}</em>;
        return l.platzhalter ? <span key={i} class="ph">{el}</span> : <span key={i}>{el}</span>;
      })}
    </>
  );
}

/** Farbrolle der Dokumente als Tokens der App (Vorschau, hell und dunkel); mit Gestaltung die Druckfarben */
function rolleStil(rolle?: Farbrolle, g?: DruckGestaltung): Record<string, string> {
  if (g && rolle) {
    const f = g.palette.rolle[rolle];
    if (rolle.startsWith('kat-')) return { borderLeft: `3px solid #${f.linie}` };
    return { background: `#${f.fill}`, color: `#${f.schrift}` };
  }
  if (!rolle || rolle === 'leer') return {};
  if (rolle === 'kopf') return { background: 'var(--flaeche-tief)', color: 'var(--tinte)' };
  if (rolle === 'status-gut-stark') return { background: 'var(--status-gut-flaeche)', color: 'var(--auf-status-gut)' };
  if (rolle.startsWith('risiko-') || rolle.startsWith('seq-')) return { background: `var(--${rolle})`, color: `var(--auf-${rolle})` };
  if (rolle.startsWith('status-')) return { background: `var(--${rolle}-hauch)`, color: 'var(--tinte)' };
  return { borderLeft: `3px solid var(--${rolle})` };
}

function MatrixAnsicht({ b }: { b: MatrixBlock }) {
  const g = useContext(GestaltungKontext);
  const kopf = g ? rolleStil('kopf', g) : {};
  return (
    <figure>
      <table>
        {b.titel && <caption>{b.titel}</caption>}
        <thead><tr><th scope="col" style={kopf}><T text={b.ecke} /></th>{b.spalten.map((s, i) => <th key={i} scope="col" style={kopf}><T text={s} /></th>)}</tr></thead>
        <tbody>
          {b.zeilen.map((z, i) => (
            <tr key={i}>
              <th scope="row" style={kopf}><T text={z.kopf} /></th>
              {z.zellen.map((c, j) => <td key={j} style={rolleStil(c.rolle, g)}>{c.zeilen.map((t, k) => <div key={k}>{k === 0 ? <strong><T text={t} /></strong> : <T text={t} />}</div>)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {b.legende && <p class="zweitext">{b.legende.map((l, i) => <span key={i} style={{ ...rolleStil(l.rolle, g), padding: '0 8px', marginRight: '8px' }}><T text={l.text} /></span>)}</p>}
      {b.alt && <figcaption class="zweitext">{b.alt}</figcaption>}
    </figure>
  );
}

/** Diagramm als Wertetabelle (das Dokument enthält das native Word-Diagramm); mit Gestaltung mit Balken in den Reihenfarben */
function DiagrammAnsicht({ b }: { b: DiagrammBlock }) {
  const g = useContext(GestaltungKontext);
  const max = Math.max(1, ...b.reihen.flatMap((r) => r.werte.map((w) => w ?? 0)));
  const farbe = (r: DiagrammBlock['reihen'][number]) => (g ? `#${diagrammFarbeIn(g.palette, r.rolle)}` : undefined);
  return (
    <table data-diagramm={g ? '' : undefined}>
      <caption>{b.titel}</caption>
      <thead><tr><th scope="col"><span class="nur-sr">{t('liste.titel')}</span></th>{b.reihen.map((r, i) => <th key={i} scope="col" style={g ? { borderBottom: `3px solid ${farbe(r)}` } : rolleStil(r.rolle)}>{r.name}</th>)}</tr></thead>
      <tbody>
        {b.kategorien.map((k, i) => (
          <tr key={i}>
            <th scope="row">{k}</th>
            {b.reihen.map((r, j) => (
              <td key={j}>
                {g && <span class="ir-balken" aria-hidden="true" style={{ width: `${(100 * (r.werte[i] ?? 0)) / max}%`, background: farbe(r) }} />}
                {r.werte[i] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ablauf als Liste der Formen mit ihren Verbindungen (das Dokument enthält bearbeitbare Formen) */
function AblaufAnsicht({ b }: { b: AblaufBlock }) {
  const g = useContext(GestaltungKontext);
  const name = (id: string) => b.knoten.find((k) => k.id === id)?.text.replace(/\n/g, ' ') ?? id;
  const knoten = [...b.knoten].sort((x, y) => x.zeile - y.zeile || x.spalte - y.spalte);
  return (
    <figure>
      <figcaption><strong>{b.alt.titel}</strong></figcaption>
      <ol>
        {knoten.map((k) => (
          <li key={k.id}>
            <span style={rolleStil(k.rolle, g)}>{k.text.replace(/\n/g, ' ')}</span>
            {b.kanten.filter((x) => x.von === k.id).map((x, i) => <span key={i} class="zweitext"> <Symbol name="pfeil-rechts" klasse="sym sym-text" /><span class="nur-sr">{t('symbol.weiter_zu')}</span> {x.text ? `${x.text}: ` : ''}{name(x.nach)}</span>)}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function XlsxMatrixAnsicht({ m }: { m: XlsxMatrix }) {
  const g = useContext(GestaltungKontext);
  const stufe = (w: number): Farbrolle => (w <= m.zonen.tiefBis ? 'risiko-tief' : w >= m.zonen.hochAb ? 'risiko-hoch' : 'risiko-mittel');
  return (
    <table>
      <caption>{m.titel}</caption>
      <thead><tr><th scope="col">{m.ecke}</th>{m.spalten.map((s) => <th key={s.wert} scope="col">{s.text}</th>)}</tr></thead>
      <tbody>{m.zeilen.map((z, i) => <tr key={z.wert}><th scope="row">{z.text}</th>{m.spalten.map((s, j) => <td key={s.wert} style={rolleStil(stufe(z.wert * s.wert), g)}>{m.ergebnisse[i]?.[j] ?? 0}</td>)}</tr>)}</tbody>
    </table>
  );
}

function BlockAnsicht({ b }: { b: Block }) {
  switch (b.typ) {
    case 'ueberschrift': {
      const H = (`h${Math.min(6, b.ebene + 2)}`) as 'h3';
      return <H>{b.text}</H>;
    }
    case 'absatz':
      return <p><T text={b.text} /></p>;
    case 'liste': {
      const L = b.nummeriert ? 'ol' : 'ul';
      return <L>{b.punkte.map((p, i) => <li key={i}><T text={p} /></li>)}</L>;
    }
    case 'tabelle':
      return (
        <table>
          <thead><tr>{b.kopf.map((k, i) => <th key={i} scope="col">{k}</th>)}</tr></thead>
          <tbody>{b.zeilen.map((z, i) => <tr key={i}>{z.map((c, j) => <td key={j}><T text={c} /></td>)}</tr>)}</tbody>
        </table>
      );
    case 'hinweis':
      return <div class="ir-hinweis">{b.titel && <strong>{b.titel}: </strong>}<T text={b.text} /></div>;
    case 'felder':
      return (
        <table>
          <tbody>{b.felder.map((f, i) => <tr key={i}><th scope="row">{f.label}</th><td><T text={f.wert} /></td></tr>)}</tbody>
        </table>
      );
    case 'unterschriften':
      return <table><tbody>{b.felder.map((f, i) => <tr key={i}><th scope="row">{typeof f === 'string' ? f : `${f.name}, ${f.funktion}`}</th><td style={{ height: '40px' }}>{typeof f === 'string' ? '' : f.datum}</td></tr>)}</tbody></table>;
    case 'matrix':
      return <MatrixAnsicht b={b} />;
    case 'diagramm':
      return <DiagrammAnsicht b={b} />;
    case 'ablauf':
      return <AblaufAnsicht b={b} />;
    default:
      return null;
  }
}

/** Filter für die Ansicht bei Farbfehlsichtigkeit: Matrizen nach Machado et al. (2009) in linearem RGB */
export function FehlsichtFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      {(Object.keys(MACHADO) as Fehlsicht[]).map((art) => {
        const m = MACHADO[art];
        const werte = [0, 1, 2].map((z) => `${m[z * 3]} ${m[z * 3 + 1]} ${m[z * 3 + 2]} 0 0`).join(' ') + ' 0 0 0 1 0';
        return (
          <filter key={art} id={`fehlsicht-${art}`} color-interpolation-filters="linearRGB">
            <feColorMatrix type="matrix" values={werte} />
          </filter>
        );
      })}
    </svg>
  );
}

/** CSS-Variablen der Druckgestaltung am Wurzelelement (Preact setzt sie über CSSOM, CSP-neutral) */
function gestaltungsVariablen(g: DruckGestaltung): Record<string, string> {
  const d = g.palette.dok;
  const schrift = (n: string, ersatz: string) => `"${n.replace(/"/g, '')}", ${ersatz}`;
  return {
    '--ir-titel': `#${d.titel}`,
    '--ir-text': `#${d.text}`,
    '--ir-leise': `#${d.leise}`,
    '--ir-linie': `#${d.linie}`,
    '--ir-trenn': `#${d.trennlinie}`,
    '--ir-kopf': `#${d.kopf}`,
    '--ir-kopf-text': `#${d.kopfText ?? d.text}`,
    '--ir-label': `#${d.label}`,
    '--ir-band': `#${d.band}`,
    '--ir-auf-band': `#${d.aufBand}`,
    '--ir-akzent': `#${d.akzent}`,
    '--ir-schrift-titel': schrift(g.schrift.titel, 'Arial, sans-serif'),
    '--ir-schrift-text': schrift(g.schrift.text, 'Cambria, Georgia, serif'),
    '--ir-schrift-tabelle': schrift(g.schrift.tabelle, 'Arial, sans-serif'),
  };
}

function Kopfzeile({ ir, g }: { ir: DocxDokument | XlsxMappe; g: DruckGestaltung }) {
  const firma = 'kopf' in ir ? ir.kopf.firmenname : ir.firmenname;
  const name = g.firmennameZeigen ? <strong class="ir-kopf-name">{g.kopfname ?? <T text={firma} />}</strong> : null;
  const logo = g.logo ? <img class="ir-logo" src={pngDataUrl(g.logo.png)} alt={g.logo.alt} width={g.logo.kopf.breite} height={g.logo.kopf.hoehe} /> : null;
  return (
    <div class="ir-kopfzeile">
      {g.logoPosition === 'links' ? <>{logo}{name}</> : <>{name}{logo}</>}
    </div>
  );
}

function Titelseite({ ir, g }: { ir: DocxDokument | XlsxMappe; g: DruckGestaltung }) {
  const firma = 'kopf' in ir ? ir.kopf.firmenname : ir.firmenname;
  return (
    <section class="ir-titelseite" aria-label={ir.lenkung.titel}>
      {g.logo ? <img class="ir-logo" src={pngDataUrl(g.logo.png)} alt={g.logo.alt} width={g.logo.titel.breite} height={g.logo.titel.hoehe} /> : <strong><T text={firma} /></strong>}
      <p class="ir-kennung">{kennungAnzeige(ir.lenkung.dokumentId, g)}</p>
      <p class="ir-band">{ir.lenkung.titel}</p>
      <p><strong><T text={firma} /></strong></p>
    </section>
  );
}

export function IrVorschau({ ir, fehlsicht }: { ir: DocxDokument | XlsxMappe; fehlsicht?: Fehlsicht }) {
  const l = ir.lenkung;
  const g = ir.gestaltung;
  const stil = { ...(g ? gestaltungsVariablen(g) : {}), ...(fehlsicht ? { filter: `url(#fehlsicht-${fehlsicht})` } : {}) };
  const fuss = 'kopf' in ir ? ir.kopf.fusszeile : undefined;
  return (
    <GestaltungKontext.Provider value={g}>
    <div class={`dokument-vorschau${g ? ' gestaltet' : ''}`} lang={ir.sprache} style={stil}>
      {/* Wasserzeichen als CSS-Inhalt: dekorativ, wird nicht vorgelesen (der Status steht in der Lenkungstabelle) */}
      {g?.wasserzeichen && <div class="ir-wasserzeichen" aria-hidden="true" data-text={g.wasserzeichen} />}
      {g && <Kopfzeile ir={ir} g={g} />}
      {g?.titelseite && 'bloecke' in ir && <Titelseite ir={ir} g={g} />}
      <h2>{kennungAnzeige(l.dokumentId, g)} {l.titel}</h2>
      <table>
        <tbody>
          <tr><th scope="row">{t('vorschau.version')}</th><td><T text={l.version} /></td><th scope="row">{t('vorschau.eigner')}</th><td><T text={l.eigner} /></td></tr>
          <tr><th scope="row">{t('vorschau.freigabe')}</th><td><T text={l.freigabeDurch} /></td><th scope="row">{t('vorschau.datum')}</th><td><T text={l.datum} /></td></tr>
        </tbody>
      </table>
      {'bloecke' in ir
        ? ir.bloecke.map((b, i) => <BlockAnsicht key={i} b={b} />)
        : ir.blaetter.map((bl) => (
            <section key={bl.name}>
              <h3>{bl.titel ?? bl.name}</h3>
              {bl.hinweise?.map((h, i) => <div key={i} class="ir-hinweis">{h}</div>)}
              {bl.matrizen?.map((m, i) => <XlsxMatrixAnsicht key={i} m={m} />)}
              {bl.spalten.length > 0 && <table>
                <thead><tr>{bl.spalten.map((s, i) => <th key={i} scope="col">{s.kopf}</th>)}</tr></thead>
                <tbody>
                  {bl.zeilen.slice(0, 200).map((z, i) => (
                    <tr key={i}>{z.map((c, j) => <td key={j}>{c === null ? '' : String(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>}
              {bl.zeilen.length > 200 && <p class="zweitext">{t('vorschau.gekuerzt', { anzahl: bl.zeilen.length })}</p>}
            </section>
          ))}
      {g && (
        <div class="ir-fusszeile">
          {fuss !== undefined && <span><T text={fuss} /></span>}
          {g.fusszeileZusatz && <span>{g.fusszeileZusatz}</span>}
        </div>
      )}
    </div>
    </GestaltungKontext.Provider>
  );
}

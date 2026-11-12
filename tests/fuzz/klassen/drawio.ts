// Klassen draw.io in der App: Befunde E-07, E-08, E-20, E2-03, E2-04, E2-05 (App-Seite; die Diagrammansicht prüft P18 im Browser)
import { deflateSync, inflateSync, strToU8 } from 'fflate';
import { XML_MAX_TIEFE } from '../../../src/eingang/grenzen.ts';
import { MAX_DATEI } from '../../../src/prozesse/drawio.ts';
import type { Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { urteileDrawio } from '../ziele/drawio.ts';
import { text, type Klasse, type KlassenFall } from './typen.ts';

const ZELLE = (id: string, o: { parent?: string; edge?: boolean; source?: string; target?: string; value?: string } = {}): string =>
  `<mxCell id="${id}" value="${o.value ?? ''}" parent="${o.parent ?? '1'}"${o.edge ? ' edge="1"' : ' vertex="1"'}${o.source ? ` source="${o.source}"` : ''}${o.target ? ` target="${o.target}"` : ''}><mxGeometry x="1" y="1" width="80" height="40" as="geometry"/></mxCell>`;
const MODELL = (zellen: string): string => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${zellen}</root></mxGraphModel>`;
const ABLAUF = MODELL(`${ZELLE('s1', { value: 'Start' })}${ZELLE('s2', { value: 'Ende' })}${ZELLE('k1', { edge: true, source: 's1', target: 's2' })}`);
const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');
const komprimiert = (s: string, url: boolean): string => b64(deflateSync(strToU8(url ? encodeURIComponent(s) : s)));
const datei = (seite: string): string => `<mxfile host="x"><diagram id="PR-01" name="S">${seite}</diagram></mxfile>`;
const fall = (name: string, daten: string, mussAbgelehnt = false): KlassenFall => ({ name, endung: 'drawio', daten, mussAbgelehnt });
const ausDatei = (b: Uint8Array): KlassenFall => ({ name: 'original', endung: 'drawio', daten: text(b) });
const urteile = (f: KlassenFall): Urteil => urteileDrawio(f.daten);

/** Was ein Leser ohne Schutz sähe: Seiten entpacken (Base64, Deflate, URL-Kodierung), Entitäten der Attribute auflösen */
function wieLeser(s: string): string {
  const aus = [s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')];
  for (const m of s.matchAll(/<diagram[^>]*>([^<]+)/g)) {
    const t = m[1]!.trim();
    try {
      aus.push(decodeURIComponent(t));
    } catch {
      /* kein URL-Text */
    }
    try {
      const roh = new TextDecoder().decode(inflateSync(Buffer.from(t, 'base64')));
      aus.push(roh);
      try {
        aus.push(decodeURIComponent(roh));
      } catch {
        /* nicht URL-kodiert */
      }
    } catch {
      /* nicht komprimiert */
    }
  }
  return aus.join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------
// E-07, E2-04: DTD und Entitäten in jeder Schreibweise (roh, URL-kodiert, im Strom, neben einem Kind, im SVG-Attribut)

const DTD = ['<!DOCTYPE mxGraphModel [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]>', '<!DOCTYPE x SYSTEM "file:///etc/passwd">', '<!ENTITY x "y">', '<!doctype x>', '<!DOCTYPE x PUBLIC "a" "https://example.org/x.dtd">'];

export const dtd: Klasse = {
  id: 'drawio-dtd',
  art: 'drawio',
  befunde: ['E-07', 'E2-04'],
  titel: 'DTD und eigene Entitäten in jeder Schreibweise und Lage: abgelehnt',
  regression: 'tests/fixtures/fuzz/regression/drawio-dtd.drawio',
  variante: (z) => {
    const m = `${z.wahl(DTD)}${ABLAUF.replace('value="Start"', z.mit(0.5) ? 'value="&b;"' : 'value="Start"')}`;
    const wie = z.ganz(6);
    if (wie === 0) return fall('dtd-roh', datei(m), true);
    if (wie === 1) return fall('dtd-url', datei(encodeURIComponent(m)), true);
    if (wie === 2) return fall('dtd-komprimiert', datei(komprimiert(m, z.mit(0.5))), true);
    if (wie === 3) return fall('dtd-wurzel', m, true);
    if (wie === 4) return fall('dtd-svg-content', `<svg xmlns="http://www.w3.org/2000/svg" content="${datei(m).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"><rect/></svg>`, true);
    // Müll hinter dem Deflate-Strom (E2-04, Fall 2)
    const strom = deflateSync(strToU8(m));
    const muell = new Uint8Array(strom.length + 8);
    muell.set(strom);
    muell.set([1, 2, 3, 4, 5, 6, 7, 8], strom.length);
    return fall('dtd-muell-hinter-strom', datei(b64(muell)), true);
  },
  urteile,
  ohneSchutz: (f) => /<!(DOCTYPE|ENTITY)/i.test(wieLeser(f.daten as string)),
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-08, E2-05: Bomben (komprimierte Seite entpackt über der Grenze; App prüfte erst nach dem Entpacken)

export const bombe: Klasse = {
  id: 'drawio-bombe',
  art: 'drawio',
  befunde: ['E-08', 'E2-05'],
  titel: 'Komprimierte Seite, die entpackt über der Grenze liegt: abgelehnt «grösser», ohne volles Entpacken',
  regression: 'tests/fixtures/fuzz/regression/drawio-bombe.drawio',
  variante: (z) => {
    const mb = z.zwischen(3, 24);
    const fuell = z.wahl(['a', ' ', '<g/>', '0']);
    const modell = MODELL(`<mxCell id="x" value="${fuell.repeat(Math.ceil((mb * 1024 * 1024) / fuell.length))}"/>`);
    const seite = komprimiert(modell, z.mit(0.3));
    const wie = z.ganz(3);
    if (wie === 0) return fall(`bombe ${mb} MB`, datei(seite), true);
    if (wie === 1) return fall(`bombe-zweite-seite ${mb} MB`, `<mxfile><diagram id="a">${ABLAUF}</diagram><diagram id="b">${seite}</diagram></mxfile>`, true);
    return fall(`bombe-svg ${mb} MB`, `<svg xmlns="http://www.w3.org/2000/svg" content="${datei(seite).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>`, true);
  },
  urteile,
  ohneSchutz: (f) => {
    const s = (f.daten as string).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    return [...s.matchAll(/<diagram[^>]*>([A-Za-z0-9+/=\s]{20,})</g)].some((m) => {
      try {
        return inflateSync(Buffer.from(m[1]!, 'base64')).length > MAX_DATEI;
      } catch {
        return false;
      }
    });
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-03, E-20: doppelte Kennungen, Elternzyklen, fehlende Eltern, __proto__ als Kennung (Hänger, Speicher, Rohtext)

export const zellen: Klasse = {
  id: 'drawio-zellen',
  art: 'drawio',
  befunde: ['E2-03', 'E-20'],
  titel: 'Doppelte Kennungen, Elternzyklen, Kanten in den Zyklus: Urteil in höchstens 5 s ohne Rohfehler',
  regression: 'tests/fixtures/fuzz/regression/drawio-zellen.drawio',
  variante: (z) => {
    const ids = ['a', 'b', 'c', '__proto__', 'constructor', 'toString', '0', '1'];
    const n = z.zwischen(2, 8);
    const teile: string[] = [];
    // Kern der Klasse: mindestens ein Zyklus oder eine doppelte Kennung
    const x = z.wahl(ids);
    const y = z.wahl(ids.filter((i) => i !== x));
    if (z.mit(0.5)) teile.push(ZELLE(x, { parent: y }), ZELLE(y, { parent: x }));
    else teile.push(ZELLE(x, { parent: x }), ZELLE(x, { parent: '1' }));
    for (let i = 0; i < n; i++) {
      const art = z.ganz(4);
      if (art === 0) teile.push(ZELLE(z.wahl(ids), { parent: z.wahl(ids) }));
      else if (art === 1) teile.push(ZELLE(`k${i}`, { edge: true, parent: z.wahl(ids), source: z.wahl(ids), target: z.wahl(ids) }));
      else if (art === 2) teile.push(`<object id="${z.wahl(ids)}" label="o"><mxCell parent="${z.wahl(ids)}" vertex="1"><mxGeometry width="8" height="4" as="geometry"/></mxCell></object>`);
      else teile.push(ZELLE(z.wahl(ids), { parent: 'fehlt' }));
    }
    for (let i = teile.length - 1; i > 0; i--) {
      const j = z.ganz(i + 1);
      [teile[i], teile[j]] = [teile[j]!, teile[i]!];
    }
    const m = MODELL(teile.join(''));
    return fall('zellen', z.mit(0.5) ? datei(m) : z.mit(0.5) ? m : datei(komprimiert(m, true)));
  },
  urteile,
  // Ohne Vorprüfung: Elternkette ohne Besuchsliste läuft im Zyklus; doppelte Kennungen überschreiben Zellen
  ohneSchutz: (f) => {
    const s = wieLeser(f.daten as string);
    const eltern = new Map<string, string>();
    let doppelt = false;
    for (const m of s.matchAll(/<mxCell id="([^"]*)"[^>]*parent="([^"]*)"/g)) {
      if (eltern.has(m[1]!)) doppelt = true;
      eltern.set(m[1]!, m[2]!);
    }
    for (const start of eltern.keys()) {
      let k: string | undefined = start;
      for (let i = 0; k !== undefined && i < 1000; i++) k = eltern.get(k);
      if (k !== undefined) return true;
    }
    return doppelt;
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-20 (eltern_tief, selbst): tiefe Verschachtelung des XML

export const tief: Klasse = {
  id: 'drawio-tief',
  art: 'drawio',
  befunde: ['E-20'],
  titel: 'XML tiefer als die Grenze, in jeder Lage: abgelehnt, kein Stapelüberlauf',
  regression: 'tests/fixtures/fuzz/regression/drawio-tief.drawio',
  variante: (z) => {
    const n = z.wahl([XML_MAX_TIEFE + 1, 300, 1000, 20_000, 100_000]);
    const el = z.wahl(['g', 'mxCell', 'object', 'a:b']);
    const tiefXml = `${`<${el}>`.repeat(n)}${`</${el}>`.repeat(n)}`;
    const wie = z.ganz(3);
    const m = `<mxGraphModel><root><mxCell id="0"/>${tiefXml}</root></mxGraphModel>`;
    if (wie === 0) return fall(`tief ${n}`, m, true);
    if (wie === 1) return fall(`tief-mxfile ${n}`, datei(m), true);
    return fall(`tief-komprimiert ${n}`, datei(komprimiert(m, false)), true);
  },
  urteile,
  ohneSchutz: (f) => {
    let t = 0;
    let max = 0;
    for (const m of wieLeser(f.daten as string).matchAll(/<(\/?)[A-Za-z][^>]*?(\/?)>/g)) {
      if (m[1]) t--;
      else if (!m[2]) max = Math.max(max, ++t);
    }
    return max > XML_MAX_TIEFE;
  },
  ausDatei,
};

export const DRAWIO_KLASSEN: Klasse[] = [dtd, bombe, zellen, tief];

// Textvorschau einer Word-Datei (DOCX): Absätze aus word/document.xml, Überschriften an der Formatvorlage erkannt.
// Läuft im Worker (fflate); ohne DOM, damit es auch in Node-Tests läuft.
import { entpackeBegrenzt } from '../generator/zip-grenzen.ts';

export interface VorschauAbsatz {
  text: string;
  /** 1 bis 3 bei Überschriften */
  ebene?: number;
  /** Absatz in einer Tabelle */
  tabelle?: boolean;
}

const entity = (s: string) =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'amp') return '&';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const n = k.startsWith('#x') ? Number.parseInt(k.slice(2), 16) : Number.parseInt(k.slice(1), 10);
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });

/** Word-Teil der Vorschau: Obergrenze vor dem Entpacken, grössere Dateien zeigen wir nicht im Text */
export const VORSCHAU_MAX_XML = 40 * 1024 * 1024;

/** Text eines Absatzes: linear über die Tags, ohne Regex über den ganzen Absatz */
function absatzText(p: string): string {
  const teile: string[] = [];
  let i = 0;
  for (;;) {
    const lt = p.indexOf('<w:', i);
    if (lt < 0) break;
    const gt = p.indexOf('>', lt);
    if (gt < 0) break;
    const nameEnde = /[ />]/.exec(p.slice(lt + 3, Math.min(p.length, lt + 40)));
    const name = nameEnde ? p.slice(lt + 3, lt + 3 + nameEnde.index) : '';
    const leer = p[gt - 1] === '/';
    i = gt + 1;
    if (name === 'tab') teile.push('\t');
    else if (name === 'br') teile.push('\n');
    else if (name === 't' && !leer) {
      const e = p.indexOf('</w:t>', i);
      if (e < 0) break;
      teile.push(entity(p.slice(i, e)));
      i = e + 6;
    }
  }
  return teile.join('').trim();
}

export function docxText(daten: Uint8Array, maxAbsaetze = 400): VorschauAbsatz[] {
  const dateien = entpackeBegrenzt(daten, { maxBytes: VORSCHAU_MAX_XML, maxEintraege: 5000, waehlen: (n) => n === 'word/document.xml' });
  const xml = dateien['word/document.xml'];
  if (!xml) throw new Error('Keine Word-Datei (word/document.xml fehlt)');
  const text = new TextDecoder().decode(xml);
  const aus: VorschauAbsatz[] = [];
  // Linear suchen: präparierte Dateien mit vielen offenen Tags machten die frühere Regex quadratisch (Sperre im Worker).
  // Tabellenbereiche laufen mit, damit Zellen als Tabellenabsatz erscheinen.
  const tabelle = /<w:tbl[ >]/g;
  let tblAnfang = -1;
  let tblEnde = -1;
  const naechsteTabelle = (ab: number) => {
    tabelle.lastIndex = ab;
    const m = tabelle.exec(text);
    tblAnfang = m ? m.index : Number.MAX_SAFE_INTEGER;
    const e = m ? text.indexOf('</w:tbl>', m.index) : -1;
    tblEnde = e < 0 ? Number.MAX_SAFE_INTEGER : e;
  };
  naechsteTabelle(0);
  const absatz = /<w:p[ >]/g;
  for (let m = absatz.exec(text); m; m = absatz.exec(text)) {
    const gt = text.indexOf('>', m.index);
    if (gt < 0) break;
    if (text[gt - 1] === '/') continue; // leerer Absatz <w:p …/>
    const ende = text.indexOf('</w:p>', gt);
    if (ende < 0) break;
    const p = text.slice(m.index, ende);
    absatz.lastIndex = ende + 6;
    while (m.index > tblEnde) naechsteTabelle(tblEnde + 8);
    const s = absatzText(p);
    if (!s) continue;
    const stil = /<w:pStyle w:val="([^"]{1,200})"/.exec(p)?.[1] ?? '';
    const ebene = /(?:heading|berschrift|titel|title)\s*(\d)?/i.exec(stil);
    const inTabelle = m.index > tblAnfang && m.index < tblEnde;
    aus.push({ text: s, ...(ebene ? { ebene: Math.min(3, Number(ebene[1] ?? 1)) } : {}), ...(inTabelle ? { tabelle: true } : {}) });
    if (aus.length >= maxAbsaetze) break;
  }
  return aus;
}

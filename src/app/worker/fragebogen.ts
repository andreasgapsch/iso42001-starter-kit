// Fragebogen für Fachbereiche im Worker: Blatt «Fragebogen» der Vorlage D-10 als eigene Arbeitsmappe erzeugen
// und ausgefüllte Arbeitsmappen lesen (exceljs). Isomorph: läuft im Worker und in Node-Tests.
import { zipPruefen } from '../../generator/zip-grenzen.ts';
import ExcelJS from 'exceljs';
import type { XlsxMappe } from '../../generator/ir.ts';
import { erstelleUebersetzer, type Texte } from '../../i18n/texte.ts';
import type { Kataloge } from '../../kataloge/typen.ts';
import type { Projekt, Sprache } from '../../model/typen.ts';
import { VORLAGEN } from '../../vorlagen/index.ts';
import { dateiPraefix, gestaltungEinsetzen, mitDateiPraefix } from '../../vorlagen/gestaltung.ts';
import type { GelesenesBlatt, Zelle } from '../logik/fragebogen.ts';

/** Höchstens so viele Zeilen und Spalten je Blatt lesen (Schutz vor sehr grossen Dateien). */
export const MAX_ZEILEN = 5000;
export const MAX_SPALTEN = 40;

const sauber = (s: string) => s.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, '-').slice(0, 40);

export function fragebogenMappe(projekt: Projekt, texte: Texte, kataloge: Kataloge, sprache: Sprache, kitVersion: string, fachbereich?: string): { mappe: XlsxMappe; name: string } {
  const u = erstelleUebersetzer(sprache, texte);
  const d10 = VORLAGEN['D-10'];
  if (!d10) throw new Error('Vorlage D-10 fehlt');
  const ir = d10({ u, modus: 'firma', form: 'dokument', projekt, kataloge, kitVersion }) as XlsxMappe;
  const blattName = u.t('vorlagen.D-10.blaetter.fragebogen');
  const blatt = ir.blaetter.find((b) => b.name === blattName) ?? ir.blaetter[2];
  if (!blatt) throw new Error('Blatt Fragebogen fehlt in D-10');
  const titel = u.t('vorlagen.D-10.titel_fragebogen');
  const mappe: XlsxMappe = {
    ...ir,
    // Ohne Kit-Hinweise; Normverweis des Inventars ist für Fachbereiche nicht nötig
    hinweisBlock: [],
    eigenschaften: { ...ir.eigenschaften, titel: fachbereich ? `${titel} (${fachbereich})` : titel },
    blaetter: [{ ...blatt, titel: fachbereich ? `${blatt.titel ?? titel} · ${fachbereich}` : blatt.titel }],
  };
  const stamm = (kataloge.dokumente.dokumente.find((x) => x.id === 'D-10')?.datei[sprache] ?? 'D-10').split('_')[0];
  const name = mitDateiPraefix(`${stamm}_${sauber(blattName)}${fachbereich ? `_${sauber(fachbereich)}` : ''}.xlsx`, dateiPraefix(projekt));
  return { mappe: gestaltungEinsetzen(mappe, projekt, 'firma'), name };
}

function zellwert(v: ExcelJS.CellValue): Zelle {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return zellwert(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text);
    if ('error' in v) return null;
  }
  return String(v);
}

export async function liesArbeitsmappe(daten: Uint8Array): Promise<GelesenesBlatt[]> {
  // Grenzen aus den Kopfdaten, bevor exceljs entpackt
  // Ein Fragebogen hat wenige MB; exceljs braucht ein Vielfaches des entpackten Umfangs im Speicher
  zipPruefen(daten, { maxBytes: 64 * 1024 * 1024, maxEintraege: 5000 });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(daten.buffer.slice(daten.byteOffset, daten.byteOffset + daten.byteLength) as ArrayBuffer);
  const blaetter: GelesenesBlatt[] = [];
  wb.eachSheet((ws) => {
    const zeilen: Zelle[][] = [];
    const bis = Math.min(ws.rowCount, MAX_ZEILEN);
    for (let r = 1; r <= bis; r++) {
      const row = ws.getRow(r);
      const z: Zelle[] = [];
      const n = Math.min(row.cellCount, MAX_SPALTEN);
      for (let c = 1; c <= n; c++) z.push(zellwert(row.getCell(c).value));
      zeilen.push(z);
    }
    blaetter.push({ name: ws.name, zeilen });
  });
  return blaetter;
}

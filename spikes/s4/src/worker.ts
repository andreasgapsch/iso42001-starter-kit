// Generator-Worker des Prototyps: DOCX mit docx, XLSX mit exceljs (beide komplett eingebettet).
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import ExcelJS from 'exceljs';

interface Auftrag {
  controls: { id: string; titel: string; gruppe: string }[];
}

self.onmessage = async (e: MessageEvent<Auftrag>) => {
  const t0 = performance.now();
  try {
    const liste = e.data.controls.slice(0, 120);
    const doc = new Document({
      creator: '',
      sections: [
        {
          children: [
            new Paragraph({ text: 'Erklärung zur Anwendbarkeit', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun({ text: 'Entwurf für Spike S4', italics: true })] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: liste.map(
                (c) =>
                  new TableRow({
                    children: [c.id, c.gruppe, c.titel].map((t) => new TableCell({ children: [new Paragraph(t)] })),
                  }),
              ),
            }),
          ],
        },
      ],
    });
    const docx = new Uint8Array(await Packer.toArrayBuffer(doc));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SoA');
    ws.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Gruppe', key: 'gruppe', width: 8 },
      { header: 'Titel', key: 'titel', width: 50 },
      { header: 'Anwendbar', key: 'anwendbar', width: 12 },
    ];
    for (const c of liste) ws.addRow({ ...c, anwendbar: 'ja' });
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    for (let r = 2; r <= liste.length + 1; r++) {
      ws.getCell(`D${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"ja,nein,teilweise"'] };
    }
    const xlsx = new Uint8Array(await wb.xlsx.writeBuffer());
    self.postMessage({ ok: true, docx, xlsx, ms: Math.round(performance.now() - t0) }, { transfer: [docx.buffer, xlsx.buffer] });
  } catch (x) {
    self.postMessage({ ok: false, fehler: x instanceof Error ? `${x.name}: ${x.message}` : String(x) });
  }
};

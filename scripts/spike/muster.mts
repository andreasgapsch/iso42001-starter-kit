// Musterdateien für die Sichtprüfung erzeugen: tsx scripts/spike/muster.mts <Zielordner>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import { musterDocx, musterDocxLeer, musterXlsx } from '../../tests/unit/generator.muster.ts';

const ziel = process.argv[2];
if (!ziel) throw new Error('Zielordner fehlt');
mkdirSync(ziel, { recursive: true });
writeFileSync(join(ziel, 'Muster.docx'), await renderDocx(musterDocx()));
writeFileSync(join(ziel, 'Muster-leer.docx'), await renderDocx(musterDocxLeer()));
writeFileSync(join(ziel, 'Muster.xlsx'), await renderXlsx(musterXlsx()));
console.log(`Musterdateien in ${ziel}`);

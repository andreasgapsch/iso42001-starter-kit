// Erzeugt das JSON Schema der Projektdatei aus src/model/typen.ts und kompiliert es mit Ajv standalone
// zu einem Validator ohne eval/new Function (CSP). Ausgabe: src/generiert/projekt.schema.json, projekt-validator.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { SCHEMA_VERSION } from '../src/model/typen.ts';

const ZIEL = 'src/generiert';
mkdirSync(ZIEL, { recursive: true });
const roh = execFileSync(
  'npx',
  ['ts-json-schema-generator', '-p', 'src/model/typen.ts', '-t', 'Projekt', '--tsconfig', 'tsconfig.json', '--no-type-check'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);
const schema = JSON.parse(roh) as Record<string, unknown>;
// $id trägt die Schemaversion (projekt-v<SCHEMA_VERSION>.json)
schema['$id'] = `https://kmu-cio.ch/schema/iso42001/projekt-v${SCHEMA_VERSION}.json`;
schema['title'] = 'Projektdatei ISO/IEC 42001 Starter-Kit (*.aims.json)';
writeFileSync(`${ZIEL}/projekt.schema.json`, `${JSON.stringify(schema, null, 2)}\n`);

// Alle Fehler sammeln: Meldungen beim Import (z. B. KI-Ergebnis) nennen jede Stelle; strict aus, weil der Generator Annotationen ausgibt.
const ajv = new Ajv({ code: { source: true, esm: true }, allErrors: true, strict: false });
const pruefe = ajv.compile(schema);
let code = standaloneCode(ajv, pruefe);
// maxLength (Gestaltung, ab 1.1) braucht die Laufzeitfunktion ucs2length (Länge in Unicode-Zeichen): eingebettet statt require()
code = code.replace(/require\("ajv\/dist\/runtime\/ucs2length"\)\.default/g, '((s) => { let n = 0; for (const _ of s) n++; return n; })');
if (/\brequire\(/.test(code)) throw new Error('Standalone-Code enthält require(); Laufzeitfunktionen einbetten');
if (/new Function|eval\(/.test(code)) throw new Error('Standalone-Code enthält eval');
code = `// Erzeugt von scripts/schema.mts. Nicht bearbeiten.\n${code}`;
writeFileSync(`${ZIEL}/projekt-validator.mjs`, code);
writeFileSync(
  `${ZIEL}/projekt-validator.d.mts`,
  'export interface AjvFehler { instancePath: string; keyword: string; message?: string; params: Record<string, unknown> }\n' +
    'declare const validate: ((daten: unknown) => boolean) & { errors?: AjvFehler[] | null };\nexport default validate;\n',
);
console.log('Schema und Validator erzeugt:', readFileSync(`${ZIEL}/projekt-validator.mjs`).length, 'Bytes');

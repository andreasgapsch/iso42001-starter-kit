// Setzt einfache Schlüssel-Wert-Zeilen in Anführungszeichen, wenn der Wert ": " oder " #" enthält (YAML-Falle).
import { readFileSync, writeFileSync } from 'node:fs';
for (const datei of process.argv.slice(2)) {
  const zeilen = readFileSync(datei, 'utf8').split('\n').map((z) => {
    const m = /^(\s*[\w.-]+): (?!["'|>{\[])(.*(?:: | #).*)$/.exec(z);
    if (!m) return z;
    return `${m[1]}: "${m[2]!.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  });
  writeFileSync(datei, zeilen.join('\n'));
}

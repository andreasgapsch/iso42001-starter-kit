// Testprojekt mit vielen KI-Systemen (Seitenlimit, Anlage für Systemtabellen): Beispiel Muster Maschinenbau,
// ergänzt um Kopien der vorhandenen Systeme mit neuen IDs, bis die gewünschte Anzahl erreicht ist.
import { readFileSync } from 'node:fs';
import type { KiSystem, Projekt } from '../../src/model/typen.ts';

export function projektMitVielenSystemen(anzahl = 12, mitIsms?: boolean): Projekt {
  const p = JSON.parse(readFileSync('src/beispiele/muster-maschinenbau.de.aims.json', 'utf8')) as Projekt;
  if (mitIsms !== undefined) p.meta.mitIsms = mitIsms;
  const vorlage = [...p.kiSysteme];
  for (let i = p.kiSysteme.length; i < anzahl; i++) {
    const quelle = vorlage[i % vorlage.length]!;
    const id = `KI-${String(i + 1).padStart(3, '0')}`;
    const kopie: KiSystem = { ...structuredClone(quelle), id, name: `${quelle.name} (Werk Nord)` };
    p.kiSysteme.push(kopie);
  }
  p.kiSysteme = p.kiSysteme.slice(0, anzahl);
  return p;
}

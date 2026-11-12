// Führt alle Prüfskripte aus, druckt eine Übersicht und setzt den Exit-Code.
// Aufruf: npx tsx scripts/pruefen/alle.mts [--lokal]
// --lokal schaltet die lokalen Tore zu (G6 Urheberrecht, G14 Prüfsummen auch ohne Kit-Ordner, G18 NIST-Zitate).
import { type Befund, type Optionen, formatiere, zaehle } from './gemeinsam.mts';
import * as abdeckung from './abdeckung.mts';
import * as i18n from './i18n.mts';
import * as links from './links.mts';
import * as namensnennung from './namensnennung.mts';
import * as nistZitate from './nist-zitate.mts';
import * as pruefsummen from './pruefsummen.mts';
import * as stil from './stil.mts';
import * as urheberrecht from './urheberrecht.mts';
import * as testmarker from './testmarker.mts';
import * as workflow from './workflow.mts';
import * as schemaVersion from './schema-version.mts';
import * as erwartungen from './erwartungen.mts';
import * as version from './version.mts';
import * as rechtsstand from './rechtsstand.mts';
import * as rohtexte from './rohtexte.mts';
import * as testebenen from './testebenen.mts';
import * as fakten from './fakten.mts';
import * as lesestellen from './lesestellen.mts';
import * as erstkontakt from './erstkontakt.mts';
import * as begriffe from './begriffe.mts';
import * as messplan from './messplan.mts';
import * as prozessgraph from './prozessgraph.mts';

interface Tor {
  id: string;
  name: string;
  nurLokal: boolean;
  pruefe: (o: Optionen) => Promise<Befund[]>;
}

export const TORE: Tor[] = [
  { id: 'G4', name: 'i18n vollständig', nurLokal: false, pruefe: i18n.pruefe },
  { id: 'G5', name: 'Stil', nurLokal: false, pruefe: stil.pruefe },
  { id: 'G6', name: 'Urheberrecht', nurLokal: true, pruefe: urheberrecht.pruefe },
  { id: 'G7', name: 'Links und offline', nurLokal: false, pruefe: links.pruefe },
  { id: 'G8', name: 'Namensnennung', nurLokal: false, pruefe: namensnennung.pruefe },
  { id: 'G14', name: 'Prüfsummen Rechtstexte', nurLokal: false, pruefe: pruefsummen.pruefe },
  { id: 'G15', name: 'ID-Abdeckung', nurLokal: false, pruefe: abdeckung.pruefe },
  { id: 'G18', name: 'NIST-Zitate', nurLokal: true, pruefe: nistZitate.pruefe },
  { id: 'G30', name: 'Testmarker', nurLokal: false, pruefe: testmarker.pruefe },
  { id: 'G31', name: 'Schema-Versionstor', nurLokal: false, pruefe: schemaVersion.pruefe },
  { id: 'G32', name: 'Workflows', nurLokal: false, pruefe: workflow.pruefe },
  { id: 'G33', name: 'Erwartungen', nurLokal: false, pruefe: (o) => erwartungen.pruefe(o) },
  { id: 'G36', name: 'Version und Changelog', nurLokal: false, pruefe: (o) => version.pruefe(o) },
  { id: 'G37', name: 'Rechtsstand', nurLokal: false, pruefe: (o) => rechtsstand.pruefe(o) },
  { id: 'G38', name: 'Rohtexte', nurLokal: false, pruefe: (o) => rohtexte.pruefe(o) },
  { id: 'G39', name: 'Testebenen', nurLokal: false, pruefe: (o) => testebenen.pruefe(o) },
  { id: 'G40', name: 'Faktenquelle', nurLokal: false, pruefe: (o) => fakten.pruefe(o) },
  { id: 'G41', name: 'Lesestellen', nurLokal: false, pruefe: (o) => lesestellen.pruefe(o) },
  { id: 'G42', name: 'Erstkontakt START', nurLokal: false, pruefe: async (o) => erstkontakt.pruefe(o) },
  { id: 'G43', name: 'Begriffe erklärt', nurLokal: false, pruefe: (o) => begriffe.pruefe(o) },
  { id: 'G44', name: 'Messplan', nurLokal: false, pruefe: (o) => messplan.pruefe(o) },
  { id: 'G45', name: 'Prozessgraph', nurLokal: false, pruefe: (o) => prozessgraph.pruefe(o) },
];

export async function alle(o: Optionen): Promise<{ befunde: Befund[]; fehlerhaft: boolean }> {
  const befunde: Befund[] = [];
  let fehlerhaft = false;
  const zeilen: string[] = [];
  for (const tor of TORE) {
    if (tor.nurLokal && !o.lokal) {
      zeilen.push(`${tor.id.padEnd(4)} ${tor.name.padEnd(24)} übersprungen (nur mit --lokal)`);
      continue;
    }
    const start = Date.now();
    let ergebnis: Befund[];
    try {
      ergebnis = await tor.pruefe(o);
    } catch (e) {
      ergebnis = [{ tor: tor.id, datei: '-', meldung: `Prüfskript abgebrochen: ${(e as Error).stack ?? String(e)}`, schwere: 'fehler' }];
    }
    befunde.push(...ergebnis);
    const z = zaehle(ergebnis);
    if (z.fehler > 0) fehlerhaft = true;
    const status = z.fehler > 0 ? 'ROT ' : 'GRÜN';
    zeilen.push(`${tor.id.padEnd(4)} ${tor.name.padEnd(24)} ${status}  ${z.fehler} Fehler, ${z.warnungen} Warnungen  (${Date.now() - start} ms)`);
    for (const b of ergebnis) console.log(formatiere(b));
  }
  console.log('');
  console.log(`Übersicht Qualitätstore${o.lokal ? ' (lokal)' : ''}`);
  for (const z of zeilen) console.log(z);
  const s = zaehle(befunde);
  console.log(`Gesamt: ${s.fehler} Fehler, ${s.warnungen} Warnungen`);
  return { befunde, fehlerhaft };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const { fehlerhaft } = await alle({ lokal: process.argv.includes('--lokal') });
  process.exitCode = fehlerhaft ? 1 : 0;
}

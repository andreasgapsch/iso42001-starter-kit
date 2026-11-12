// Ziele zum Prüfen des Werkzeugs selbst: Es muss einen Hänger, einen Speicherabbruch und einen Rohfehler erkennen und
// den Lauf danach fortsetzen. Fall 2 hängt, Fall 3 füllt den Speicher, Fall 4 wirft einen Rohfehler; alle anderen sind in Ordnung.
import type { Fall, Ziel } from '../typen.ts';
import { ablehnung } from './hilfen.ts';

const fall = (nummer: number): Fall => ({ name: `selbsttest-${nummer}`, endung: 'txt', daten: `fall ${nummer}` });

export const selbsttestZiele: Record<'selbsttest-haenger' | 'selbsttest-speicher' | 'selbsttest-rohfehler', Ziel> = {
  'selbsttest-haenger': {
    art: 'selbsttest-haenger',
    erzeuge: (_z, nummer) => fall(nummer),
    urteile: (f) => {
      if (f.daten === 'fall 2') for (;;) /* Endlosschleife im synchronen Code */;
      return { urteil: 'angenommen' };
    },
  },
  'selbsttest-speicher': {
    art: 'selbsttest-speicher',
    erzeuge: (_z, nummer) => fall(nummer),
    urteile: (f) => {
      if (f.daten === 'fall 3') {
        const halde: string[] = [];
        for (;;) halde.push('x'.repeat(1_000_000) + halde.length);
      }
      return { urteil: 'angenommen' };
    },
  },
  'selbsttest-rohfehler': {
    art: 'selbsttest-rohfehler',
    erzeuge: (_z, nummer) => fall(nummer),
    urteile: (f) => {
      if (f.daten === 'fall 4') return ablehnung(new TypeError('Cannot read properties of null'), 'selbsttest');
      if (f.daten === 'fall 5') return ablehnung(new Error(''), 'selbsttest');
      return ablehnung(new Error('Datei abgelehnt'), 'selbsttest');
    },
  },
};

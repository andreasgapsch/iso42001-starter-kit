// Erzeugt deterministische Dummy-Kataloge (ca. 1,5 MB JSON) als Platzhalter für Normkataloge, Fragen und Beispiele.

const WOERTER = (
  'Organisation Risiko Kontrolle Nachweis Verantwortung Dokumentation Bewertung System Daten Qualität ' +
  'Transparenz Aufsicht Lieferant Vorfall Massnahme Ziel Kompetenz Kommunikation Prüfung Freigabe Zweck ' +
  'Lebenszyklus Überwachung Wirksamkeit Anforderung Geltungsbereich Leitlinie Rolle Ressource Folgen'
).split(' ');

/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32). */
function zufall(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KatalogEintrag {
  id: string;
  gruppe: string;
  titel: string;
  beschreibung: string;
  hinweise: string[];
  fragen: { id: string; text: string; optionen: string[] }[];
  mapping: string[];
}

export function erzeugeKataloge(zielBytes = 1_500_000): string {
  const r = zufall(42001);
  const satz = (n: number): string => {
    const w: string[] = [];
    for (let i = 0; i < n; i++) w.push(WOERTER[Math.floor(r() * WOERTER.length)]!);
    const s = w.join(' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  };
  const controls: KatalogEintrag[] = [];
  const branchen = ['Maschinenbau', 'Präzisionsteile', 'Treuhand', 'Gesundheit', 'Handel', 'Software', 'Logistik'];
  let i = 0;
  let laenge = 0;
  while (laenge < zielBytes) {
    i++;
    const e: KatalogEintrag = {
      id: `K-${String(i).padStart(4, '0')}`,
      gruppe: `A.${2 + (i % 9)}`,
      titel: satz(4),
      beschreibung: [satz(14), satz(12), satz(16)].join(' '),
      hinweise: [satz(10), satz(8)],
      fragen: [1, 2, 3].map((k) => ({ id: `F-${i}-${k}`, text: satz(9), optionen: ['ja', 'teilweise', 'nein', 'unklar'] })),
      mapping: [`ISO27001:A.${5 + (i % 4)}.${i % 30}`, `EUAIA-${String(i % 20).padStart(2, '0')}`],
    };
    controls.push(e);
    laenge += JSON.stringify(e).length + 1;
  }
  return JSON.stringify({ version: 'spike', branchen, controls });
}

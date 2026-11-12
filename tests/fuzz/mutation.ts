// Gemeinsame Mutationen für JSON, Text und Bytes. Alle Entscheidungen kommen aus dem übergebenen Zufall.
import type { Zufall } from './zufall.ts';

const EMOJI = '\u{1F600}';

/** Zeichenketten, die in Prüfungen und Verarbeitung Ärger machen können */
export function boeserText(z: Zufall): string {
  switch (z.ganz(22)) {
    case 0: return '';
    case 1: return ' ';
    case 2: return 'x'.repeat(z.wahl([99, 100, 101, 499, 500, 501, 4000, 100_001, 400_001]));
    case 3: return EMOJI.repeat(z.wahl([1, 50, 251, 501]));
    case 4: return '\ud800';
    case 5: return 'a\udfffb';
    case 6: return '\u0000';
    case 7: return '__proto__';
    case 8: return 'constructor';
    case 9: return '2026-03-15 Kick-off KI-Rat';
    case 10: return z.wahl(['0026-03-15', '2026-13-45', '0000-00-00', '2026-02-30', '9999-12-31', '2026-03-15T25:61:00Z']);
    case 11: return '<script>alert(1)</script>';
    case 12: return 'javascript:alert(1)';
    case 13: return '%3C%21DOCTYPE x%3E';
    case 14: return '‮txt.exe';
    case 15: return '../../etc/passwd';
    case 16: return '﻿';
    case 17: return '0'.repeat(z.zwischen(1, 400));
    case 18: return '"\\\n\r\t';
    case 19: return '&#x0;&amp;&lt;';
    case 20: return String.fromCharCode(...Array.from({ length: z.zwischen(1, 30) }, () => z.ganz(0x20)));
    default: return 'Äöü ' + 'é'.repeat(z.zwischen(1, 20)) + '́';
  }
}

/** Zahlen an den Rändern */
export function boeseZahl(z: Zufall): number {
  return z.wahl([0, -1, 1, 0.1, 1e21, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 2 ** 31, 2 ** 32, 65535, 65536]);
}

interface Stelle {
  eltern: Record<string, unknown>;
  schluessel: string;
}

/** Alle Stellen eines JSON-Werts (ohne Rekursion, höchstens `max` Stück) */
function stellen(wurzel: unknown, max = 6000): Stelle[] {
  const aus: Stelle[] = [];
  const stapel: unknown[] = [wurzel];
  while (stapel.length && aus.length < max) {
    const w = stapel.pop();
    if (!w || typeof w !== 'object') continue;
    const o = w as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      aus.push({ eltern: o, schluessel: k });
      stapel.push(o[k]);
    }
  }
  return aus;
}

/** Setzt auch Schlüssel wie __proto__ als eigene Eigenschaft */
function setze(o: Record<string, unknown>, k: string, v: unknown): void {
  Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
}

function wertAendern(z: Zufall, alt: unknown): unknown {
  switch (z.ganz(10)) {
    case 0: return boeserText(z);
    case 1: return boeseZahl(z);
    case 2: return null;
    case 3: return typeof alt === 'string' ? Number(alt) || 7 : String(JSON.stringify(alt)).slice(0, 80);
    case 4: return Array.isArray(alt) ? {} : [alt];
    case 5: return !alt;
    case 6: return typeof alt === 'string' ? alt + boeserText(z) : alt;
    case 7: return { x: 1 };
    case 8: return [];
    default: return Array.isArray(alt) && alt.length ? [...alt, alt[z.ganz(alt.length)]] : alt;
  }
}

/** 1 bis 3 Änderungen an zufälligen Stellen; der Wert wird verändert und zurückgegeben */
export function mutiereJson<T>(z: Zufall, wert: T, anzahl = z.zwischen(1, 3)): T {
  for (let i = 0; i < anzahl; i++) {
    const alle = stellen(wert);
    if (alle.length === 0) return wert;
    const { eltern, schluessel } = z.wahl(alle);
    switch (z.ganz(7)) {
      case 0:
        if (Array.isArray(eltern)) eltern.splice(Number(schluessel), 1);
        else delete eltern[schluessel];
        break;
      case 1:
        if (!Array.isArray(eltern)) setze(eltern, z.wahl(['__proto__', 'constructor', 'prototype', boeserText(z).slice(0, 40)]), boeserText(z));
        break;
      case 2: {
        const v = eltern[schluessel];
        if (Array.isArray(eltern)) eltern.splice(Number(schluessel), 0, structuredClone(v));
        else if (Array.isArray(v) && v.length) v.push(...Array.from({ length: z.zwischen(1, 60) }, () => structuredClone(v[z.ganz(v.length)])));
        break;
      }
      default:
        setze(eltern, schluessel, wertAendern(z, eltern[schluessel]));
    }
  }
  return wert;
}

/** Tief verschachtelter Wert ohne Rekursion: [[[...]]] oder {"a":{"a":...}} */
export function tiefJson(z: Zufall, tiefe = z.wahl([150, 199, 201, 250, 1000, 5000])): string {
  return z.mit(0.5) ? '['.repeat(tiefe) + ']'.repeat(tiefe) : '{"a":'.repeat(tiefe) + '1' + '}'.repeat(tiefe);
}

/** Änderungen auf Textebene: kürzen, einfügen, Zeichen verdrehen, doppeln, BOM, Müll anhängen */
export function mutiereText(z: Zufall, text: string): string {
  let t = text;
  for (let i = 0, n = z.zwischen(1, 3); i < n; i++) {
    const pos = z.ganz(t.length + 1);
    switch (z.ganz(8)) {
      case 0: t = t.slice(0, pos); break;
      case 1: t = t.slice(0, pos) + boeserText(z) + t.slice(pos); break;
      case 2: t = t.slice(0, pos) + t.slice(pos + z.zwischen(1, 50)); break;
      case 3: t = t.slice(0, pos) + String.fromCharCode(z.ganz(0x80)) + t.slice(pos + 1); break;
      case 4: t = '﻿' + t; break;
      case 5: t = t + boeserText(z); break;
      case 6: t = t.slice(0, pos) + t.slice(pos, pos + 200) + t.slice(pos); break;
      default: t = t.replace(/["{}[\],:]/, () => z.wahl(['', ',', '}', ']', '"', ':']));
    }
  }
  return t;
}

/** Bytes: kürzen, verdrehen, einfügen, löschen */
export function mutiereBytes(z: Zufall, daten: Uint8Array): Uint8Array {
  let b = daten.slice();
  for (let i = 0, n = z.zwischen(1, 4); i < n; i++) {
    const pos = z.ganz(Math.max(b.length, 1));
    switch (z.ganz(5)) {
      case 0: b = b.slice(0, pos); break;
      case 1: if (b.length) b[pos] = z.ganz(256); break;
      case 2: if (b.length) b[pos] = b[pos]! ^ (1 << z.ganz(8)); break;
      case 3: b = Uint8Array.from([...b.slice(0, pos), ...z.bytes(z.zwischen(1, 20)), ...b.slice(pos)]); break;
      default: b = Uint8Array.from([...b.slice(0, pos), ...b.slice(pos + z.zwischen(1, 40))]);
    }
  }
  return b;
}

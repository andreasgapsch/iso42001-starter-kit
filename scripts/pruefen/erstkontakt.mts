// Tor G42 Erstkontakt (AF-131, AF-132, QK-73): Die Startseite sagt in den ersten Sekunden, was das Kit ist, was als Nächstes
// zu tun ist und dass nichts das Gerät verlässt. Geprüft wird der Bereich vom Beginn des Hauptteils bis zum Ende der
// Zeile mit dem Hauptknopf (<div class="haupt">), in DE und EN:
//   - höchstens MAX_SAETZE Sätze (Überschrift und Versionszeile zählen nicht),
//   - genau ein Knopf (class «knopf», <button>): der Hauptknopf mit id «aims-oeffnen»,
//   - ein Satz zur Vertraulichkeit (Daten bleiben auf dem Gerät),
//   - kein Fachbegriff der Begriffsliste (Tor G43, src/kataloge/glossar.yaml) ohne Erklärung an der Erstnennung.
// Aufruf: npx tsx scripts/pruefen/erstkontakt.mts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';
import { type Begriff, type Sprache, ladeBegriffe, pruefeText, saetze } from './begriffe.mts';

const TOR = 'G42';
const DATEI = 'src/start/START.html.tpl';
export const MAX_SAETZE = 3;
export const MAX_KNOEPFE = 1;

/** Satz über die Vertraulichkeit: Daten bleiben auf dem Gerät. */
const VERTRAULICH: Record<Sprache, RegExp> = {
  de: /nichts verlässt|bleiben? auf Ihrem|verlässt (?:Ihr|Ihren) (?:Gerät|Rechner)|ohne Übertragung|nichts wird übertragen/i,
  en: /nothing leaves|stays? on your|never leaves|nothing is (?:sent|transmitted)/i,
};

export interface Bereich {
  markup: string;
  schluessel: string[];
}

/** Bereich vor dem ersten Schritt: Beginn des Hauptteils bis zum Ende des Containers mit dem Hauptknopf. */
export function bereich(vorlage: string): Bereich | null {
  const von = vorlage.indexOf('<main');
  const haupt = vorlage.indexOf('class="haupt"', von);
  if (von < 0 || haupt < 0) return null;
  const ende = vorlage.indexOf('</div>', haupt);
  if (ende < 0) return null;
  const markup = vorlage.slice(von, ende + '</div>'.length);
  const schluessel = [...markup.matchAll(/data-t="([\w-]+)"/g)].map((m) => m[1]!).filter((k) => !k.startsWith('stand_'));
  return { markup, schluessel };
}

function texteVon(vorlage: string): Record<Sprache, Record<string, string>> {
  const block = vorlage.match(/<script type="application\/json" id="texte">\s*([\s\S]*?)\s*<\/script>/);
  if (!block) throw new Error('START: Datenblock «texte» fehlt');
  return JSON.parse(block[1]!) as Record<Sprache, Record<string, string>>;
}

export function zaehleKnoepfe(markup: string): number {
  return (markup.match(/class="[^"]*\bknopf\b[^"]*"|<button\b/g) ?? []).length;
}

/** Sätze im Bereich einer Sprache: alle Texte ausser Überschrift und Versionszeile. */
export function zaehleSaetze(vorlage: string, b: Bereich, sprache: Sprache): number {
  const texte = texteVon(vorlage);
  const button = b.markup.match(/<(?:a|button)\b[^>]*\bknopf\b[^>]*data-t="([\w-]+)"/)?.[1];
  return b.schluessel
    .filter((k) => k !== 'h1' && k !== button)
    .reduce((n, k) => n + saetze(texte[sprache][k] ?? '').length, 0);
}

export function pruefe(_o: Optionen = {}, vorlage?: string, begriffe?: Record<Sprache, Begriff[]>): Befund[] {
  const html = vorlage ?? readFileSync(join(REPO, DATEI), 'utf8');
  const befunde: Befund[] = [];
  const melde = (meldung: string): number => befunde.push({ tor: TOR, datei: DATEI, meldung, schwere: 'fehler' });
  const b = bereich(html);
  if (!b) {
    melde('Bereich vor dem ersten Schritt nicht gefunden (<main> und <div class="haupt"> erwartet)');
    return befunde;
  }
  if (!b.markup.includes('id="aims-oeffnen"')) melde('Hauptknopf mit id «aims-oeffnen» liegt nicht im Bereich vor dem ersten Schritt');
  const knoepfe = zaehleKnoepfe(b.markup);
  if (knoepfe > MAX_KNOEPFE) melde(`${knoepfe} Knöpfe vor dem ersten Schritt, höchstens ${MAX_KNOEPFE}`);
  for (const sprache of ['de', 'en'] as const) {
    const n = zaehleSaetze(html, b, sprache);
    if (n > MAX_SAETZE) melde(`${sprache.toUpperCase()}: ${n} Sätze vor dem ersten Schritt, höchstens ${MAX_SAETZE}`);
    const zone = { name: `START vor dem ersten Schritt (${sprache.toUpperCase()})`, datei: DATEI, zeilen: b.schluessel.map((k) => ({ text: texteVon(html)[sprache][k] ?? '' })) };
    if (!zone.zeilen.some((z) => VERTRAULICH[sprache].test(z.text))) melde(`${sprache.toUpperCase()}: kein Satz vor dem ersten Schritt sagt, dass nichts das Gerät verlässt`);
    const liste = begriffe?.[sprache] ?? ladeBegriffe(sprache).liste;
    befunde.push(...pruefeText(zone, liste).map((x) => ({ ...x, tor: TOR })));
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, async (o) => pruefe(o));

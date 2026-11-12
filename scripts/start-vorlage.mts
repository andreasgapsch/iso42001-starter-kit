// Generierte Teile der Startseite src/start/START.html.tpl (Startkachel ab rc.10) nachführen:
//   - Stilblock «schriften»: Inter (nur Teilmenge latin, woff2 aus src/app/schriften, wie im AIMS-Manager) als data:-URL
//   - Content-Security-Policy: SHA-256 der Inline-Skripte und -Stile (scripts/csp.mts), font-src data: für die Schrift
// Die generierten Teile stehen zwischen <!-- generiert:name … --> und <!-- /generiert:name -->, nur im Markup.
// Aufruf: npx tsx scripts/start-vorlage.mts            (Vorlage aktualisieren)
//         npx tsx scripts/start-vorlage.mts --pruefen  (Exit 1, wenn die Vorlage nicht aktuell ist)
//
// Schrift: Eingebettet ist nur die Teilmenge latin von Inter (36 KB, base64 rund 48 KB). latin-ext lohnt sich nicht:
// Die Texte DE und EN brauchen nur latin, seltene Zeichen fallen auf die Systemschrift zurück.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analysiere } from './csp.mts';
import { REPO } from './leitfaden.mts';

export const START_VORLAGE = join(REPO, 'src', 'start', 'START.html.tpl');

/** Eingebettete Schrift in START.html: Inter, Teilmenge latin, Gewichte 400 bis 700 */
export const START_SCHRIFT = 'inter-latin-wght-normal.woff2';
const UNICODE_LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

/** Basis der Policy; {skripte} und {stile} füllt die Hash-Liste. */
const START_CSP = "default-src 'none'; script-src {skripte}; style-src {stile}; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";

export function startSchriften(): string {
  const b64 = readFileSync(join(REPO, 'src', 'app', 'schriften', START_SCHRIFT)).toString('base64');
  const css = `@font-face { font-family: 'Inter Variable'; font-style: normal; font-display: swap; font-weight: 400 700; src: url(data:font/woff2;base64,${b64}) format('woff2'); unicode-range: ${UNICODE_LATIN}; }`;
  return `<style id="schriften">\n${css}\n</style>`;
}

function ersetzeBlock(html: string, name: string, inhalt: string): string {
  const re = new RegExp(`(<!-- generiert:${name}[^>]*-->\\n)[\\s\\S]*?(<!-- /generiert:${name} -->)`);
  if (!re.test(html)) throw new Error(`Marke <!-- generiert:${name} --> fehlt in START.html.tpl`);
  return html.replace(re, (_, a: string, b: string) => `${a}${inhalt}\n${b}`);
}

/** Vorlage mit aktueller Schrift und CSP-Hashes. */
export function aktualisiereStart(vorlage: string): string {
  const html = ersetzeBlock(vorlage, 'schriften', startSchriften());
  const ohneCsp = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  const a = analysiere(ohneCsp);
  const policy = START_CSP.replace('{skripte}', a.skriptHashes.join(' ') || "'none'").replace('{stile}', a.stilHashes.join(' ') || "'none'");
  if (!/<meta http-equiv="Content-Security-Policy" content="[^"]*">/.test(html)) throw new Error('CSP-Meta fehlt in START.html.tpl');
  return html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const alt = readFileSync(START_VORLAGE, 'utf8');
  const neu = aktualisiereStart(alt);
  if (process.argv.includes('--pruefen')) {
    if (neu !== alt) {
      console.error('START.html.tpl ist nicht aktuell: npx tsx scripts/start-vorlage.mts');
      process.exit(1);
    }
    console.log('START.html.tpl aktuell');
  } else {
    writeFileSync(START_VORLAGE, neu);
    console.log(`START.html.tpl aktualisiert (${Math.round(neu.length / 1024)} KB)`);
  }
}

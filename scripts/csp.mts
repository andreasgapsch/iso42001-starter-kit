// Berechnet SHA-256-Hashes aller ausführbaren Inline-Skripte und Inline-Stile einer HTML-Datei
// und schreibt die Content-Security-Policy als <meta> an den Anfang von <head>.
// Aufruf: npx tsx scripts/csp.mts [--trusted-types <policy>] [--schriften] <eingabe.html> [ausgabe.html]   (ohne Ausgabe: Datei wird ersetzt)
//         --schriften erlaubt eingebettete Schriften (font-src data:), z. B. Archivo und Source Serif 4 im AIMS-Manager
//         npx tsx scripts/csp.mts --pruefen <datei.html>           (Hashes gegen Inhalt prüfen)

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** Platzhalter {skripte} und {stile} werden durch die Hash-Listen ersetzt (oder 'none'). */
export const STRENGE_CSP = [
  "default-src 'none'",
  'script-src {skripte}',
  'style-src {stile}',
  'worker-src blob:',
  'img-src data: blob:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Skripttypen, die der Browser ausführt (alles andere, z. B. application/json, ist reiner Text). */
const AUSFUEHRBAR = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
]);

export interface CspBericht {
  skripte: number;
  stile: number;
  /** Nicht ausführbare Datenblöcke (type=application/json, text/plain): brauchen keinen Hash. */
  datenbloecke: number;
  skriptHashes: string[];
  stilHashes: string[];
  /** Inhalte, die die strenge CSP blockieren würde (Attribute style=, on…=, javascript:). */
  probleme: string[];
  policy: string;
}

export function sha256(text: string): string {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

function attribut(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : undefined;
}

/**
 * Zerlegt das HTML grob wie der Browser: Kommentare überspringen, Skript- und Stil-Inhalt bis zum ersten
 * schliessenden Tag. vite-plugin-singlefile maskiert «</script» im Code als «\x3C/script».
 */
export function analysiere(htmlRoh: string): Omit<CspBericht, 'policy'> {
  // Der HTML-Parser normalisiert CRLF zu LF, bevor der Hash berechnet wird.
  const html = htmlRoh.replace(/\r\n?/g, '\n');
  const muster = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
  const skriptHashes = new Set<string>();
  const stilHashes = new Set<string>();
  let skripte = 0;
  let stile = 0;
  let datenbloecke = 0;
  const probleme: string[] = [];
  let rest = '';
  let zuletzt = 0;
  for (const m of html.matchAll(muster)) {
    rest += html.slice(zuletzt, m.index);
    zuletzt = (m.index ?? 0) + m[0].length;
    if (m[0].startsWith('<!--')) continue;
    if (m[1] !== undefined) {
      const attrs = m[1];
      rest += `<script${attrs}>`;
      if (attribut(attrs, 'src') !== undefined) {
        probleme.push(`externes Skript: ${attribut(attrs, 'src')}`);
        continue;
      }
      const typ = (attribut(attrs, 'type') ?? '').trim().toLowerCase();
      if (!AUSFUEHRBAR.has(typ)) {
        datenbloecke++;
        continue;
      }
      skripte++;
      skriptHashes.add(sha256(m[2] ?? ''));
    } else {
      rest += `<style${m[3] ?? ''}>`;
      stile++;
      stilHashes.add(sha256(m[4] ?? ''));
    }
  }
  rest += html.slice(zuletzt);
  // Nur im Markup ausserhalb von Skript/Stil suchen.
  for (const t of rest.matchAll(/<[a-z][^>]*>/gi)) {
    const tag = t[0];
    if (/\sstyle\s*=/i.test(tag)) probleme.push(`style-Attribut: ${tag.slice(0, 60)}`);
    if (/\son[a-z]+\s*=/i.test(tag)) probleme.push(`Event-Attribut: ${tag.slice(0, 60)}`);
    if (/=\s*["']?\s*javascript:/i.test(tag)) probleme.push(`javascript:-URL: ${tag.slice(0, 60)}`);
    if (/<link\b[^>]*rel\s*=\s*["']?stylesheet/i.test(tag)) probleme.push(`externes Stylesheet: ${tag.slice(0, 60)}`);
  }
  return { skripte, stile, datenbloecke, skriptHashes: [...skriptHashes], stilHashes: [...stilHashes], probleme };
}

export function baueCsp(vorlage: string, a: Pick<CspBericht, 'skriptHashes' | 'stilHashes'>): string {
  const liste = (h: string[]): string => (h.length ? h.join(' ') : "'none'");
  return vorlage.replace('{skripte}', () => liste(a.skriptHashes)).replace('{stile}', () => liste(a.stilHashes));
}

const META_CSP = /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>\s*/gi;

/** Entfernt bestehende CSP-Metas und setzt die neue direkt nach <meta charset> (vor jedes Skript). */
export function setzeCsp(htmlRoh: string, vorlage: string = STRENGE_CSP): { html: string; bericht: CspBericht } {
  const ohne = htmlRoh.replace(/\r\n?/g, '\n').replace(META_CSP, '');
  const a = analysiere(ohne);
  const policy = baueCsp(vorlage, a);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  let html: string;
  const charset = /<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>/i.exec(ohne);
  if (charset) {
    const ende = charset.index + charset[0].length;
    html = `${ohne.slice(0, ende)}\n${meta}${ohne.slice(ende)}`;
  } else {
    const kopf = /<head\b[^>]*>/i.exec(ohne);
    if (!kopf) throw new Error('Kein <head> gefunden');
    const ende = kopf.index + kopf[0].length;
    html = `${ohne.slice(0, ende)}\n${meta}${ohne.slice(ende)}`;
  }
  // Das Meta muss vor dem ersten Skript und Stil stehen, sonst gelten diese ungeschützt.
  const posMeta = html.indexOf(meta);
  const posErstes = html.search(/<script\b|<style\b/i);
  if (posErstes !== -1 && posErstes < posMeta) throw new Error('Skript oder Stil vor dem CSP-Meta');
  return { html, bericht: { ...a, policy } };
}

/**
 * Prüft, ob jedes ausführbare Inline-Skript und jeder Stil in der CSP der Datei erlaubt ist.
 * `styleAttrInline`: nur für die Diagrammansicht (scripts/diagrammansicht.mts); erlaubt genau `style-src-attr 'unsafe-inline'`,
 * jedes andere unsafe-inline oder unsafe-eval bleibt ein Fehler.
 */
export function pruefeCsp(html: string, optionen: { styleAttrInline?: boolean } = {}): string[] {
  const meta = /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*content\s*=\s*"([^"]*)"/i.exec(html);
  if (!meta?.[1]) return ['keine CSP gefunden'];
  const policy = meta[1];
  const a = analysiere(html.replace(META_CSP, ''));
  const fehler = [...a.probleme];
  for (const h of a.skriptHashes) if (!policy.includes(h)) fehler.push(`Skript-Hash fehlt: ${h}`);
  for (const h of a.stilHashes) if (!policy.includes(h)) fehler.push(`Stil-Hash fehlt: ${h}`);
  const geprueft = optionen.styleAttrInline ? policy.replace(/(^|;)\s*style-src-attr 'unsafe-inline'\s*(?=;|$)/, '$1') : policy;
  if (/unsafe-inline|unsafe-eval/.test(geprueft)) fehler.push('unsafe-inline oder unsafe-eval in der CSP');
  return fehler;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let args = process.argv.slice(2);
  // --trusted-types <policy>: Trusted Types erzwingen, nur die genannte Policy (Worker-Start aus Blob-URL)
  let vorlage = STRENGE_CSP;
  const tt = args.indexOf('--trusted-types');
  if (tt !== -1) {
    vorlage = `${STRENGE_CSP}; require-trusted-types-for 'script'; trusted-types ${args[tt + 1] ?? 'aims-worker'}`;
    args = args.filter((_, i) => i !== tt && i !== tt + 1);
  }
  const schriften = args.indexOf('--schriften');
  if (schriften !== -1) {
    vorlage = `${vorlage}; font-src data:`;
    args = args.filter((_, i) => i !== schriften);
  }
  if (args[0] === '--pruefen') {
    const fehler = pruefeCsp(await readFile(args[1] ?? '', 'utf8'));
    for (const f of fehler) console.error(f);
    process.exit(fehler.length ? 1 : 0);
  }
  const [ein, aus] = args;
  if (!ein) {
    console.error('Aufruf: tsx scripts/csp.mts <eingabe.html> [ausgabe.html]');
    process.exit(2);
  }
  const r = setzeCsp(await readFile(ein, 'utf8'), vorlage);
  await writeFile(aus ?? ein, r.html);
  const { policy, skriptHashes, stilHashes, ...rest } = r.bericht;
  console.log(JSON.stringify({ ...rest, skriptHashes: skriptHashes.length, stilHashes: stilHashes.length }));
  console.log(policy.length > 300 ? `${policy.slice(0, 300)}…` : policy);
  if (r.bericht.probleme.length) process.exit(1);
}

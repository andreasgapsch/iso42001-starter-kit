// Prüft scripts/csp.mts ohne Browser (läuft nur im Projekt chromium, um Dopplungen zu vermeiden).
import { expect, test } from '@playwright/test';
import { analysiere, pruefeCsp, setzeCsp, sha256, STRENGE_CSP } from '../../../scripts/csp.mts';

test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', 'reine Node-Prüfung'));

test('Hashes über ausführbare Skripte und Stile, Datenblöcke und Kommentare ausgenommen', () => {
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><title>t</title>\r\n' +
    '<meta http-equiv="Content-Security-Policy" content="default-src *">' +
    '<style>a{b:c}</style></head><body><!-- <script>kommentar()</script> -->' +
    '<script>eins()\r\n</script><script type="module">zwei()</script>' +
    '<script type="application/json">{"x":1}</script><script type="text/plain">drei()</script></body></html>';
  const r = setzeCsp(html, STRENGE_CSP);
  expect(r.bericht).toMatchObject({ skripte: 2, stile: 1, datenbloecke: 2, probleme: [] });
  // CRLF wird wie im Browser zu LF normalisiert.
  expect(r.bericht.skriptHashes).toContain(sha256('eins()\n'));
  expect(r.bericht.skriptHashes).toContain(sha256('zwei()'));
  expect(r.bericht.stilHashes).toEqual([sha256('a{b:c}')]);
  expect(r.html.match(/Content-Security-Policy/g)).toHaveLength(1);
  expect(r.html.indexOf('Content-Security-Policy')).toBeLessThan(r.html.indexOf('<style>'));
  expect(pruefeCsp(r.html)).toEqual([]);
  expect(r.bericht.policy).toContain("worker-src blob:; img-src data: blob:; connect-src 'none'");
});

test('meldet Markup, das die strenge CSP blockieren würde', () => {
  const a = analysiere(
    '<head><meta charset="utf-8"></head><body><p style="x">a</p><button onclick="f()">b</button>' +
    '<a href="javascript:void 0">c</a><script src="x.js"></script></body>',
  );
  expect(a.probleme).toHaveLength(4);
  expect(pruefeCsp('<html><head></head></html>')).toEqual(['keine CSP gefunden']);
  const ohneSkript = setzeCsp('<html><head><title>t</title></head><body></body></html>');
  expect(ohneSkript.bericht.policy).toContain("script-src 'none'; style-src 'none'");
});

test('Ersetzung ist sicher gegen $-Muster', () => {
  const r = setzeCsp("<head><meta charset=utf-8></head><script>a=\"$'$&\"</script>", 'script-src {skripte}');
  expect(r.html).toContain("<script>a=\"$'$&\"</script>");
  expect(pruefeCsp(r.html.replace('script-src', "default-src 'none'; script-src"))).toEqual([]);
});

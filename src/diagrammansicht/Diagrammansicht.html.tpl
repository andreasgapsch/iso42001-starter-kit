<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<title>{{t:seitentitel}}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%235a63d4'/%3E%3Ctext x='16' y='21' font-family='Arial,sans-serif' font-size='13' font-weight='600' text-anchor='middle' fill='%23ffffff'%3EAI%3C/text%3E%3C/svg%3E">
<!--
  Vorlage der Diagrammansicht (AIMS-Manager/Diagrammansicht.html) des ISO/IEC 42001 Starter-Kits.
  Baut: npx tsx scripts/diagrammansicht.mts. Der Build setzt die Content-Security-Policy (eigene, enge Policy, siehe
  scripts/diagrammansicht.mts), die Schriften, die Texte DE/EN aus src/i18n/<sprache>/diagrammansicht.yaml und den
  unveränderten Viewer (vendor/drawio-viewer/viewer-static.min.js, deflate-raw, Base64) als Datenblock ein.
  Platzhalter in doppelten geschweiften Klammern: t:schluessel (deutscher Text im Markup), texte, viewer, kit_version;
  nie im Skript oder Stil.
  Ausnahme zu docs/KONVENTIONEN.md Abschnitt 1: Die Seite ist eine eigene Datei ausserhalb des AIMS-Managers.
-->
<style>
/* Diagrammansicht im Designpaket «AIMS Nachtblau» (docs/design-system/nachtblau/tokens.css), Tokens und Schrift Inter wie
   START.html und der AIMS-Manager; dunkel als Standard, hell und System wählbar. Farben nur über Variablen; die Farben
   des Diagramms selbst bestimmt der Viewer. */
:root, :root[data-theme="dark"] {
  --grund: #1f2432; --flaeche: #212838; --flaeche-tief: #1c202e; --hover: #252d3c; --linie: #2b3343; --linie-stark: #3a4356;
  --eingabe-rand: #6b748a; --text: #f3f5fa; --text-2: #aab2c8; --primaer: #5a63d4; --primaer-hover: #6169da; --primaer-text: #ffffff;
  --akzent-text: #a3a8ff; --fokus: #8b92ff; --fehler: #f7707f; --status-info: #5fa8f5; --status-info-grund: rgba(95, 168, 245, .14);
  --schatten: 0 8px 24px rgba(0, 0, 0, .35);
  color-scheme: dark;
}
:root[data-theme="light"] {
  --grund: #f6f7fb; --flaeche: #ffffff; --flaeche-tief: #f6f7fb; --hover: #eceef6; --linie: #e1e4ee; --linie-stark: #cdd2e0;
  --eingabe-rand: #878ea1; --text: #1a1f2c; --text-2: #4e566a; --primaer: #4f57c9; --primaer-hover: #434bb8; --primaer-text: #ffffff;
  --akzent-text: #4148b8; --fokus: #4f57c9; --fehler: #b8233a; --status-info: #1f5fa8; --status-info-grund: #e4effc;
  --schatten: 0 12px 28px -12px rgba(26, 31, 44, .28);
  color-scheme: light;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --grund: #f6f7fb; --flaeche: #ffffff; --flaeche-tief: #f6f7fb; --hover: #eceef6; --linie: #e1e4ee; --linie-stark: #cdd2e0;
    --eingabe-rand: #878ea1; --text: #1a1f2c; --text-2: #4e566a; --primaer: #4f57c9; --primaer-hover: #434bb8; --primaer-text: #ffffff;
    --akzent-text: #4148b8; --fokus: #4f57c9; --fehler: #b8233a; --status-info: #1f5fa8; --status-info-grund: #e4effc;
    --schatten: 0 12px 28px -12px rgba(26, 31, 44, .28);
    color-scheme: light;
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body {
  margin: 0; background: var(--grund); color: var(--text); font: 400 15px/1.55 'Inter Variable', 'Segoe UI', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--akzent-text); text-underline-offset: 0.18em; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--fokus); outline-offset: 2px; border-radius: 4px; }
h1, h2 { color: var(--text); line-height: 1.2; letter-spacing: -0.015em; margin: 0 0 0.5rem; text-wrap: balance; font-weight: 600; }
h1 { font-size: clamp(24px, 4vw, 30px); margin-top: 24px; }
h2 { font-size: 17px; }
p { margin: 0 0 0.75rem; }
.vh { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.huelle { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 40px); }
.sprung { position: absolute; left: -999px; top: 0; z-index: 10; background: var(--flaeche); color: var(--akzent-text); padding: 8px 12px; border-radius: 8px; }
.sprung:focus { left: 8px; top: 8px; }

/* Kopf wie START.html */
.kopf { border-bottom: 1px solid var(--linie); }
.kopf-inhalt { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding: 14px 0; min-height: 64px; }
.marke { display: flex; align-items: center; gap: 12px; min-width: 0; }
.zeichen { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 8px; background: var(--primaer); color: var(--primaer-text); display: grid; place-items: center; font-weight: 600; font-size: 13px; }
.marke-name { font-weight: 600; margin: 0; line-height: 1.3; }
.marke-von { margin: 0; color: var(--text-2); font-size: 13px; line-height: 1.3; }
.steuerung { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.umschalter { border: 0; margin: 0; padding: 0; min-width: 0; display: flex; align-items: center; gap: 8px; }
.umschalter-titel { font-size: 13px; color: var(--text-2); }
.segment { display: inline-flex; border: 1px solid var(--linie-stark); border-radius: 8px; overflow: hidden; }
.segment input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
.segment label { display: inline-flex; align-items: center; min-height: 32px; padding: 0 10px; cursor: pointer; font-size: 13px; color: var(--text-2); user-select: none; }
.segment input:checked + label { background: var(--hover); color: var(--text); font-weight: 500; }
.segment input:focus-visible + label { outline: 2px solid var(--fokus); outline-offset: -2px; }
.segment label:hover { background: var(--hover); }

/* Inhalt */
main { display: block; padding: 32px 0 16px; }
.lead { color: var(--text-2); max-width: 68ch; text-wrap: pretty; }
/* Ablage: Datei wählen oder hierher ziehen */
.ablage {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; margin: 20px 0 12px;
  padding: 18px 22px; border: 1px dashed var(--linie-stark); border-radius: 12px; background: var(--flaeche);
}
.ablage.aktiv { border-style: solid; border-color: var(--primaer); background: var(--status-info-grund); }
.ablage h2 { margin: 0; flex: 1 1 100%; }
.ablage-text { color: var(--text-2); margin: 0; }
.knopf {
  display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border-radius: 8px;
  border: 1px solid var(--primaer); background: var(--primaer); color: var(--primaer-text); font: inherit; font-weight: 500; cursor: pointer;
}
.knopf:hover { background: var(--primaer-hover); border-color: var(--primaer-hover); }
.status { min-height: 1.6rem; margin: 0 0 12px; color: var(--text); }
.status.fehler { color: var(--fehler); font-weight: 600; }
.status-zusatz { margin: -8px 0 12px; color: var(--text-2); }
/* Leiste über der Bühne */
.leiste { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; margin: 0 0 12px; }
.gruppe { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.gruppe-titel { font-size: 13px; color: var(--text-2); margin-right: 2px; }
.werkzeug {
  display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; padding: 0 12px;
  border: 1px solid var(--linie-stark); border-radius: 8px; background: var(--flaeche); color: var(--text); font: inherit; font-weight: 500; cursor: pointer;
}
.werkzeug:hover { background: var(--hover); border-color: var(--eingabe-rand); }
.werkzeug:disabled { opacity: 0.45; cursor: default; }
.auswahl {
  min-height: 40px; max-width: 22rem; padding: 0 12px; border: 1px solid var(--eingabe-rand); border-radius: 8px;
  background: var(--flaeche); color: var(--text); font: inherit;
}
.zoomwert { min-width: 4.2rem; text-align: center; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
/* Inter setzt mit tabular-nums auch Bindestriche breit: nur Zahlen gleich breit (wie im AIMS-Manager) */
/* Bühne: die eine hervorgehobene Fläche mit dem Diagramm */
.buehne {
  position: relative; height: min(72vh, 52rem); min-height: 22rem; overflow: auto; background: var(--flaeche-tief);
  border: 1px solid var(--linie); border-radius: 12px; box-shadow: var(--schatten); padding: 18px;
}
.ansicht { min-width: 100%; min-height: 100%; }
/* Hinweis: ruhige Notiz */
.hinweis { border: 1px solid var(--linie); background: var(--flaeche); border-radius: 12px; padding: 16px 20px; margin-top: 24px; color: var(--text-2); }
.hinweis h2 { font-size: 15px; color: var(--text); }
.hinweis ul { margin: 0; padding-left: 1.25rem; }
.hinweis li { margin-bottom: 0.3rem; }
.hinweis li::marker { color: var(--akzent-text); }
/* Fuss */
.fuss { border-top: 1px solid var(--linie); margin-top: 32px; padding: 20px 0 32px; color: var(--text-2); font-size: 13px; }
.fuss p { margin: 0 0 4px; max-width: 90ch; }
.fuss .absender { color: var(--text); font-weight: 600; }
.fuss ul { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 4px 20px; }
.fuss li { margin: 0; }
.fuss a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 500; }
.ohne-skript { background: var(--flaeche); border-bottom: 1px solid var(--linie); padding: 12px 0; }
[hidden] { display: none !important; }
@media (max-width: 40rem) {
  .steuerung { width: 100%; justify-content: space-between; }
  /* Nur optisch verstecken: das Label bleibt Name des Felds für Bildschirmleser */
  .umschalter-titel, .gruppe-titel { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; margin: 0; }
  .auswahl { min-width: 0; max-width: 100%; }
  .buehne { padding: 8px; }
}
@media print {
  :root, :root[data-theme="dark"], :root[data-theme="light"], :root:not([data-theme]) {
    --grund: #ffffff; --flaeche: #ffffff; --flaeche-tief: #ffffff; --linie: #cdd2e0; --text: #000000; --text-2: #3d444d; color-scheme: light;
  }
  .sprung, .steuerung, .ablage, .leiste, .hinweis { display: none !important; }
  .buehne { height: auto; overflow: visible; box-shadow: none; }
}
</style>
<!-- einsetzen:schriften -->
</head>
<body>
<a class="sprung" href="#buehne" data-t="sprung">{{t:sprung}}</a>
<noscript><div class="ohne-skript"><div class="huelle"><p>{{t:ohne_skript}}</p></div></div></noscript>
<header class="kopf">
  <div class="huelle kopf-inhalt">
    <div class="marke">
      <span class="zeichen" aria-hidden="true">AI</span>
      <div>
        <p class="marke-name" data-t="marke_name">{{t:marke_name}}</p>
        <p class="marke-von" data-t="marke_von">{{t:marke_von}}</p>
      </div>
    </div>
    <div class="steuerung">
      <fieldset class="umschalter">
        <legend class="vh" data-t="sprache_titel">{{t:sprache_titel}}</legend>
        <span class="umschalter-titel" aria-hidden="true" data-t="sprache_titel">{{t:sprache_titel}}</span>
        <span class="segment">
          <input type="radio" name="sprache" id="sprache-de" value="de" checked><label for="sprache-de" lang="de">DE</label>
          <input type="radio" name="sprache" id="sprache-en" value="en"><label for="sprache-en" lang="en">EN</label>
        </span>
      </fieldset>
      <fieldset class="umschalter">
        <legend class="vh" data-t="theme_titel">{{t:theme_titel}}</legend>
        <span class="umschalter-titel" aria-hidden="true" data-t="theme_titel">{{t:theme_titel}}</span>
        <span class="segment">
          <input type="radio" name="theme" id="theme-dunkel" value="dunkel" checked><label for="theme-dunkel" data-t="theme_dunkel">{{t:theme_dunkel}}</label>
          <input type="radio" name="theme" id="theme-hell" value="hell"><label for="theme-hell" data-t="theme_hell">{{t:theme_hell}}</label>
          <input type="radio" name="theme" id="theme-system" value="system"><label for="theme-system" data-t="theme_system">{{t:theme_system}}</label>
        </span>
      </fieldset>
    </div>
  </div>
</header>
<main class="huelle" id="inhalt">
  <h1 data-t="titel">{{t:titel}}</h1>
  <p class="lead" data-t="lead">{{t:lead}}</p>

  <section class="ablage" id="ablage" aria-labelledby="ablage-titel">
    <h2 id="ablage-titel" data-t="ablage_titel">{{t:ablage_titel}}</h2>
    <input type="file" id="datei" class="vh" accept=".drawio,.xml,application/xml,text/xml" aria-labelledby="waehlen">
    <button type="button" class="knopf" id="waehlen" data-t="waehlen">{{t:waehlen}}</button>
    <p class="ablage-text" id="ablage-text" data-t="ablegen">{{t:ablegen}}</p>
  </section>
  <p class="status" id="status" role="status" aria-live="polite"></p>
  <p class="status-zusatz" id="status-zusatz" hidden></p>

  <section id="bereich" hidden>
    <div class="leiste" role="toolbar" id="leiste" aria-label="{{t:leiste_label}}" data-t-aria="leiste_label">
      <div class="gruppe" id="seiten-gruppe">
        <label class="gruppe-titel" for="seite" data-t="seite_label">{{t:seite_label}}</label>
        <button type="button" class="werkzeug" id="seite-zurueck" aria-label="{{t:seite_zurueck}}" data-t-aria="seite_zurueck" data-t-title="seite_zurueck" title="{{t:seite_zurueck}}"><span aria-hidden="true">&#8249;</span></button>
        <select class="auswahl" id="seite"></select>
        <button type="button" class="werkzeug" id="seite-weiter" aria-label="{{t:seite_weiter}}" data-t-aria="seite_weiter" data-t-title="seite_weiter" title="{{t:seite_weiter}}"><span aria-hidden="true">&#8250;</span></button>
      </div>
      <div class="gruppe">
        <span class="gruppe-titel" data-t="zoom_label">{{t:zoom_label}}</span>
        <button type="button" class="werkzeug" id="zoom-aus" aria-label="{{t:zoom_aus}}" data-t-aria="zoom_aus" data-t-title="zoom_aus" title="{{t:zoom_aus}}"><span aria-hidden="true">&#8722;</span></button>
        <output class="zoomwert" id="zoomwert" aria-live="polite">100 %</output>
        <button type="button" class="werkzeug" id="zoom-ein" aria-label="{{t:zoom_ein}}" data-t-aria="zoom_ein" data-t-title="zoom_ein" title="{{t:zoom_ein}}"><span aria-hidden="true">+</span></button>
        <button type="button" class="werkzeug" id="zoom-einpassen" data-t="zoom_einpassen">{{t:zoom_einpassen}}</button>
        <button type="button" class="werkzeug" id="zoom-original" data-t="zoom_original">{{t:zoom_original}}</button>
      </div>
    </div>
    <div class="buehne" id="buehne" tabindex="0" role="region" aria-label="{{t:ansicht_label}}">
      <div class="ansicht" id="ansicht"></div>
    </div>
  </section>

  <aside class="hinweis" aria-labelledby="hinweis-titel">
    <h2 id="hinweis-titel" data-t="hinweis_titel">{{t:hinweis_titel}}</h2>
    <ul data-t="hinweise">{{t:hinweise}}</ul>
  </aside>
</main>
<footer class="fuss">
  <div class="huelle">
    <p class="absender" data-t="fuss_namensnennung">{{t:fuss_namensnennung}}</p>
    <p data-t="fuss_viewer">{{t:fuss_viewer}}</p>
    <p data-t="fuss_marke">{{t:fuss_marke}}</p>
    <p>Version {{kit_version}}</p>
    <ul>
      <li><a href="../LIZENZ_LICENCE/DIAGRAMMANSICHT_DIAGRAM-VIEWER/LIESMICH_README.txt" data-t="fuss_lizenzen">{{t:fuss_lizenzen}}</a></li>
      <li><a href="../START.html" data-t="fuss_start">{{t:fuss_start}}</a></li>
    </ul>
  </div>
</footer>
<script type="application/json" id="texte">{{texte}}</script>
<script type="text/x-deflate-base64" id="viewer">{{viewer}}</script>
<script>
(function () {
  'use strict';
  var SPEICHER_SPRACHE = 'iso42001-starter-kit.diagrammansicht.sprache';
  var SPEICHER_THEME = 'iso42001-starter-kit.diagrammansicht.theme';
  var MAX_MB = 20;
  var wurzel = document.documentElement;
  var texte = JSON.parse(document.getElementById('texte').textContent);
  var sprache = 'de';
  var theme = 'dunkel';
  var viewerBereit = null;
  var viewer = null;
  var aktuell = null;
  var letzterStatus = null;
  var purifyEingerichtet = false;

  function $(id) { return document.getElementById(id); }
  function lesen(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function schreiben(k, w) { try { window.localStorage.setItem(k, w); } catch (e) { /* file:// ohne Speicher: gilt nur für diesen Aufruf */ } }
  function t(schluessel, werte) {
    var s = texte[sprache][schluessel];
    if (typeof s !== 'string') return schluessel;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return werte && werte[k] !== undefined ? String(werte[k]) : m; });
  }
  function leere(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  // ---------------------------------------------------------------- Sprache und Darstellung
  function browserSprache() {
    var liste = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < liste.length; i++) {
      var s = String(liste[i] || '').toLowerCase();
      if (s.indexOf('de') === 0) return 'de';
      if (s.indexOf('en') === 0) return 'en';
    }
    return 'en';
  }
  function anwenden() {
    wurzel.setAttribute('lang', sprache === 'de' ? 'de-CH' : 'en-GB');
    document.title = t('seitentitel');
    var el = document.querySelectorAll('[data-t]');
    for (var i = 0; i < el.length; i++) {
      var wert = texte[sprache][el[i].getAttribute('data-t')];
      if (typeof wert === 'string') el[i].textContent = wert;
      else if (wert && wert.length !== undefined) {
        leere(el[i]);
        for (var j = 0; j < wert.length; j++) { var li = document.createElement('li'); li.textContent = wert[j]; el[i].appendChild(li); }
      }
    }
    var aria = document.querySelectorAll('[data-t-aria]');
    for (var k = 0; k < aria.length; k++) aria[k].setAttribute('aria-label', t(aria[k].getAttribute('data-t-aria')));
    var titel = document.querySelectorAll('[data-t-title]');
    for (var m = 0; m < titel.length; m++) titel[m].setAttribute('title', t(titel[m].getAttribute('data-t-title')));
    $('sprache-' + sprache).checked = true;
    if (aktuell) { $('buehne').setAttribute('aria-label', t('ansicht_label', { datei: aktuell.name })); seitenListe(); }
    if (letzterStatus) zeigeStatus(letzterStatus.schluessel, letzterStatus.werte, letzterStatus.fehler, letzterStatus.zusatz);
  }
  function istDunkel() {
    if (theme === 'dunkel') return true;
    if (theme === 'hell') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function setzeTheme(neu, neuZeichnen) {
    theme = neu;
    if (theme === 'hell') wurzel.setAttribute('data-theme', 'light');
    else if (theme === 'dunkel') wurzel.setAttribute('data-theme', 'dark');
    else wurzel.removeAttribute('data-theme');
    $('theme-' + theme).checked = true;
    if (neuZeichnen && aktuell) zeichne();
  }

  // ---------------------------------------------------------------- Status
  function zeigeStatus(schluessel, werte, fehler, zusatz) {
    letzterStatus = { schluessel: schluessel, werte: werte, fehler: fehler, zusatz: zusatz };
    var el = $('status');
    el.textContent = schluessel ? t(schluessel, werte) : '';
    el.className = fehler ? 'status fehler' : 'status';
    el.setAttribute('role', fehler ? 'alert' : 'status');
    var z = $('status-zusatz');
    if (zusatz) { z.textContent = t(zusatz.schluessel, zusatz.werte); z.hidden = false; } else { z.textContent = ''; z.hidden = true; }
  }

  // ---------------------------------------------------------------- Trusted Types
  // Eigene Policy «diagrammansicht»: nur exakt der eingebettete Viewer-Code als Skript.
  // Policy «default»: der Viewer schreibt HTML über innerHTML; jede solche Zuweisung geht durch das mitgelieferte
  // DOMPurify (plus Haken: keine Verweise ins Internet). DOMParser.parseFromString ist inert und wird durchgelassen.
  // Skripte und Skript-URLs lehnt die Default-Policy ab.
  var HTML_SENKEN = /^(Element innerHTML|Element outerHTML|Element insertAdjacentHTML|ShadowRoot innerHTML|Range createContextualFragment)$/;
  var EXTERN = /^\s*(?:https?:|ftp:|\/\/)/i;
  var EXTERN_CSS = /url\s*\(\s*['"]?\s*(?:https?:|ftp:|\/\/)|@import/i;
  function richtePurifyEin() {
    if (purifyEingerichtet || !window.DOMPurify) return;
    purifyEingerichtet = true;
    window.DOMPurify.addHook('uponSanitizeAttribute', function (knoten, daten) {
      var name = String(daten.attrName || '').toLowerCase();
      var wert = String(daten.attrValue || '');
      if (/^(src|srcset|href|xlink:href|poster|background|action|formaction|data)$/.test(name) && EXTERN.test(wert)) daten.keepAttr = false;
      if (name === 'style' && EXTERN_CSS.test(wert)) daten.keepAttr = false;
    });
  }
  function bereinige(html) {
    if (!window.DOMPurify) throw new TypeError('Diagrammansicht: DOMPurify fehlt');
    richtePurifyEin();
    return window.DOMPurify.sanitize(html, { ADD_TAGS: ['foreignObject'], RETURN_TRUSTED_TYPE: false });
  }
  var ttEigen = null;
  var viewerCode = null;
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    ttEigen = window.trustedTypes.createPolicy('diagrammansicht', {
      createScript: function (s) { if (viewerCode === null || s !== viewerCode) throw new TypeError('diagrammansicht: nur der eingebettete Viewer'); return s; }
    });
    window.trustedTypes.createPolicy('default', {
      createHTML: function (s, typ, senke) {
        if (senke === 'DOMParser parseFromString') return s;
        if (HTML_SENKEN.test(String(senke))) return bereinige(String(s));
        throw new TypeError('default: Senke nicht erlaubt: ' + senke);
      },
      createScript: function () { throw new TypeError('default: keine Skripte'); },
      createScriptURL: function () { throw new TypeError('default: keine Skript-URLs'); }
    });
  }

  // ---------------------------------------------------------------- Viewer laden (einmal, bei Bedarf)
  function base64ZuBytes(b64) {
    var bin = atob(b64.replace(/\s+/g, ''));
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function ladeViewer() {
    if (viewerBereit) return viewerBereit;
    viewerBereit = new Promise(function (aufloesen, ablehnen) {
      if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') { ablehnen(new Error('browser')); return; }
      var strom = new Blob([base64ZuBytes($('viewer').textContent)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      new Response(strom).text().then(function (code) {
        // Konfiguration des unveränderten Viewers über Globale: nichts nachladen, keine Formeln
        window.mxLoadResources = false;
        window.mxLoadStylesheets = false;
        window.mxForceIncludes = false;
        window.DRAW_MATH_URL = 'data:,';
        window.onDrawioViewerLoad = function () {
          try {
            // Netz-Lader des Viewers abschalten (Schablonen, Schriften); die CSP blockiert zusätzlich alles
            window.mxStencilRegistry.loadStencilSet = function () {};
            window.mxStencilRegistry.loadStencil = function () { return null; };
            window.Graph.addFont = function () { return null; };
            window.Graph.createFontElement = function () { return null; };
            richtePurifyEin();
            aufloesen();
          } catch (e) { ablehnen(e); }
        };
        viewerCode = code;
        var el = document.createElement('script');
        el.text = ttEigen ? ttEigen.createScript(code) : code;
        document.head.appendChild(el);
        if (!window.GraphViewer) ablehnen(new Error('GraphViewer fehlt'));
      }, ablehnen);
    });
    return viewerBereit;
  }

  // ---------------------------------------------------------------- Datei lesen und vorbereiten
  var ENTFERNEN = /^(image|imageBackground|fillImage|fontSource|stencil)$/;
  function bereinigeStil(stil, zaehler) {
    var teile = String(stil).split(';');
    var neu = [];
    for (var i = 0; i < teile.length; i++) {
      var p = teile[i];
      var gleich = p.indexOf('=');
      var schluessel = gleich > 0 ? p.slice(0, gleich) : '';
      var wert = gleich > 0 ? p.slice(gleich + 1) : '';
      var roh = wert;
      try { roh = decodeURIComponent(wert); } catch (e) { /* Wert ohne URI-Kodierung */ }
      // Fluss-Animation legt je Kante ein Stil-Element mit zufälligem Namen an, das die CSP (Hashes) nicht erlauben kann:
      // die Kante bleibt, nur ohne Animation
      if (schluessel === 'flowAnimation') continue;
      if (schluessel && (ENTFERNEN.test(schluessel) || /^font/i.test(schluessel)) && (EXTERN.test(roh) || EXTERN_CSS.test(roh))) { zaehler.n++; continue; }
      // Bilder nur eingebettet: relative Pfade und javascript: führten sonst zu Ladeversuchen, die erst die CSP stoppt
      if (schluessel && /^(image|imageBackground|fillImage)$/.test(schluessel) && roh !== '' && roh !== 'none' && !/^data:image\//i.test(roh)) { zaehler.n++; continue; }
      // CSS-Verweise nach aussen in beliebigen Stilwerten (strokeColor mit Adresse): nicht erst die CSP stoppen lassen
      if (/url\s*\(/i.test(roh) && !/url\s*\(\s*['"]?(#|data:image\/)/i.test(roh)) { zaehler.n++; continue; }
      // Eigene Formen (Stencil) können Bilder nach aussen enthalten und sind komprimiert nicht prüfbar
      if (schluessel === 'shape' && /^stencil\(/i.test(roh)) { zaehler.n++; continue; }
      neu.push(p);
    }
    return neu.join(';');
  }
  /** Bilder in HTML-Labels nur eingebettet: relative Pfade und Adressen führten sonst zu Ladeversuchen, die erst die CSP stoppt */
  function labelBilder(wert, zaehler) {
    return wert.replace(/\s(src|srcset|background|poster)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, function (ganz, _n, v) {
      if (/^["']?\s*data:image\//i.test(v)) return ganz;
      zaehler.n++;
      return '';
    }).replace(/url\s*\(\s*(?!['"]?(#|data:image\/))/gi, function () {
      zaehler.n++;
      return 'kein-url(';
    });
  }
  function bereinigeModell(knoten, zaehler) {
    var alle = [knoten].concat(Array.prototype.slice.call(knoten.getElementsByTagName('*')));
    for (var i = 0; i < alle.length; i++) {
      var el = alle[i];
      // HTML in Labels: Ereignis-Attribute vorab entschärfen (DOMPurify entfernt sie ohnehin; so meldet auch das
      // Parsen in DOMPurify keinen CSP-Verstoss)
      for (var a = 0; a < el.attributes.length; a++) {
        var attr = el.attributes[a];
        if (attr.name !== 'style' && attr.value.indexOf('<') >= 0) {
          var wert = attr.value.replace(/\son([a-z]+)\s*=/gi, ' data-entfernt-$1=');
          wert = labelBilder(wert, zaehler);
          if (wert !== attr.value) el.setAttribute(attr.name, wert);
        }
      }
      if (el.hasAttribute('style')) {
        var s = el.getAttribute('style');
        var b = bereinigeStil(s, zaehler);
        if (b !== s) el.setAttribute('style', b);
      }
      if (el.nodeName === 'mxGraphModel') {
        if (el.getAttribute('math') === '1') { el.setAttribute('math', '0'); zaehler.n++; }
        var bild = el.getAttribute('backgroundImage');
        if (bild && /https?:|\/\//i.test(bild)) { el.removeAttribute('backgroundImage'); zaehler.n++; }
      }
    }
  }
  // ---------------------------------------------------------------- Grenzen vor dem Parsen
  var MAX_ENTPACKT = 20 * 1024 * 1024; // alle Seiten zusammen
  var MAX_SEITEN = 200;
  var MAX_ZELLEN = 20000; // je Seite
  var DTD = /<!\s*(DOCTYPE|ENTITY)|%3C!\s*(DOCTYPE|ENTITY)/i;
  /** Grenze überschritten: { schluessel } für die Meldung */
  function grenzFehler(schluessel) { var e = new Error(schluessel); e.grenze = schluessel; return e; }
  function basis64(text) {
    var s = atob(String(text).replace(/\s+/g, ''));
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  /** Rohes DEFLATE als Strom mit fester Obergrenze entpacken: Abbruch, sobald die Grenze überschritten ist */
  function entpackeBegrenzt(bytes, frei) {
    // Ohne Stromschnittstelle läuft auch der Viewer nicht (siehe ladeViewer)
    if (typeof DecompressionStream !== 'function') return Promise.reject(new Error('browser'));
    var strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    var leser = strom.getReader();
    var teile = [];
    var summe = 0;
    function weiter() {
      return leser.read().then(function (r) {
        if (r.done) {
          var aus = new Uint8Array(summe);
          var pos = 0;
          for (var i = 0; i < teile.length; i++) { aus.set(teile[i], pos); pos += teile[i].length; }
          return aus;
        }
        summe += r.value.length;
        if (summe > frei) {
          leser.cancel().catch(function () { /* egal */ });
          throw grenzFehler('fehler_umfang');
        }
        teile.push(r.value);
        return weiter();
      });
    }
    return weiter();
  }
  /** Elemente, die der Viewer nachlädt oder als eigene Seite liest: Die Prüfung sähe sie nicht, darum nicht im Modell zulassen */
  var VERBOTEN_IM_MODELL = ['diagram', 'mxfile', 'include', 'mxGraphModel'];
  var MAX_TIEFE = 500;
  /**
   * Der Viewer läuft die Elternkette ohne Abbruch ab: Doppelte Kennungen und zyklische Eltern lassen die Seite hängen, teils bei
   * ungebremstem Speicherwachstum. draw.io schreibt solche Dateien selbst nicht. Zelle ist jedes mxCell mit Kennung und jedes
   * Element, das ein mxCell als direktes Kind trägt (object, UserObject, wie im Codec des Viewers); mxCell an beliebiger Stelle.
   */
  function zellenPruefen(modell) {
    for (var v = 0; v < VERBOTEN_IM_MODELL.length; v++) {
      if (modell.getElementsByTagName(VERBOTEN_IM_MODELL[v]).length) throw grenzFehler('fehler_format');
    }
    var alle = modell.getElementsByTagName('*');
    if (alle.length > MAX_ZELLEN * 4) throw grenzFehler('fehler_umfang');
    var eltern = new Map();
    var anzahl = 0;
    for (var i = 0; i < alle.length; i++) {
      var el = alle[i];
      var zelle = null;
      if (el.nodeName === 'mxCell') zelle = el;
      else for (var k = el.firstElementChild; k; k = k.nextElementSibling) if (k.nodeName === 'mxCell') { zelle = k; break; }
      if (!zelle) continue;
      anzahl++;
      var id = el.getAttribute('id');
      if (id === null) continue;
      if (eltern.has(id)) throw grenzFehler('fehler_zellen');
      eltern.set(id, zelle.getAttribute('parent'));
    }
    if (anzahl > MAX_ZELLEN) throw grenzFehler('fehler_umfang');
    var geprueft = new Set();
    eltern.forEach(function (_, start) {
      var weg = new Set();
      for (var x = start, tiefe = 0; x !== null && eltern.has(x) && !geprueft.has(x); x = eltern.get(x), tiefe++) {
        if (weg.has(x)) throw grenzFehler('fehler_zellen');
        if (tiefe > MAX_TIEFE) throw grenzFehler('fehler_umfang');
        weg.add(x);
      }
      weg.forEach(function (y) { geprueft.add(y); });
    });
  }
  /** Liest eine Seite wie Editor.parseDiagramNode: Zuerst der Text, sonst das erste Kind. Der Viewer erhält nur dieses Ergebnis */
  function seiteLesen(d, frei) {
    var inhalt = (d.textContent || '').trim();
    if (!inhalt) return Promise.resolve({ modell: d.firstElementChild, laenge: 0 });
    var bytes;
    try { bytes = basis64(inhalt); } catch (e) { return Promise.reject(grenzFehler('fehler_format')); }
    return entpackeBegrenzt(bytes, frei).then(function (aus) {
      var offen;
      try { offen = decodeURIComponent(new TextDecoder().decode(aus)); } catch (e) { throw grenzFehler('fehler_format'); }
      if (DTD.test(offen)) throw grenzFehler('fehler_dtd');
      return { modell: new DOMParser().parseFromString(offen, 'text/xml').documentElement, laenge: aus.length };
    }, function (e) {
      // Nicht entpackbar (auch Müll hinter dem Strom): ablehnen statt übergehen, sonst läse der Viewer, was die Prüfung nie sah
      throw (e && (e.grenze || e.message === 'browser')) ? e : grenzFehler('fehler_format');
    });
  }
  /** Prüfung und Verarbeitung lesen dasselbe: Hier wird jede Seite genau einmal entpackt und geparst; null, wenn kein Diagramm */
  function seitenLesen(text) {
    if (DTD.test(text)) return Promise.reject(grenzFehler('fehler_dtd'));
    var doc = new DOMParser().parseFromString(String(text).replace(/^﻿/, ''), 'text/xml');
    var w = doc.documentElement;
    if (!w || w.nodeName === 'parsererror' || w.getElementsByTagName('parsererror').length) return Promise.resolve(null);
    if (w.nodeName === 'mxGraphModel') return Promise.resolve([{ knoten: null, modell: w }]);
    if (w.nodeName !== 'mxfile') return Promise.resolve(null);
    var d = w.getElementsByTagName('diagram');
    if (!d.length) return Promise.resolve(null);
    if (d.length > MAX_SEITEN) return Promise.reject(grenzFehler('fehler_umfang'));
    var seiten = [];
    var frei = MAX_ENTPACKT;
    var kette = Promise.resolve();
    Array.prototype.forEach.call(d, function (knoten) {
      kette = kette.then(function () { return seiteLesen(knoten, frei); }).then(function (r) {
        frei -= r.laenge;
        seiten.push({ knoten: knoten, modell: r.modell });
      });
    });
    return kette.then(function () { return seiten; });
  }
  /** Geprüfte Seiten in ein mxfile mit offenen Seiten übernehmen; der Viewer entpackt nichts mehr selbst. */
  function vorbereiten(seiten) {
    if (!seiten || !seiten.length) return null;
    var doc = window.mxUtils.createXmlDocument();
    var datei = doc.createElement('mxfile');
    doc.appendChild(datei);
    var zaehler = { n: 0 };
    for (var j = 0; j < seiten.length; j++) {
      var s = seiten[j];
      if (!s.modell || s.modell.nodeName !== 'mxGraphModel' || s.modell.getElementsByTagName('parsererror').length) return null;
      var neu = doc.createElement('diagram');
      neu.setAttribute('id', (s.knoten && s.knoten.getAttribute('id')) || 'seite-' + (j + 1));
      var name = s.knoten && s.knoten.getAttribute('name');
      if (name) neu.setAttribute('name', name);
      zellenPruefen(s.modell);
      var modell = doc.importNode(s.modell, true);
      bereinigeModell(modell, zaehler);
      neu.appendChild(modell);
      datei.appendChild(neu);
    }
    return { knoten: datei, seiten: seiten.length, entfernt: zaehler.n };
  }

  function oeffne(file) {
    if (!file) return;
    var name = String(file.name || 'Diagramm');
    if (file.size > MAX_MB * 1024 * 1024) { zeigeStatus('fehler_gross', { datei: name, mb: MAX_MB }, true); return; }
    zeigeStatus('status_vorbereiten');
    var gelesen = file.text().then(seitenLesen);
    Promise.all([gelesen, ladeViewer()]).then(function (r) {
      var v = null;
      try { v = vorbereiten(r[0]); } catch (e) { if (e && e.grenze) throw e; v = null; }
      if (!v) { zeigeStatus('fehler_format', { datei: name }, true); return; }
      aktuell = { name: name, knoten: v.knoten, seiten: v.seiten, seite: 0, entfernt: v.entfernt };
      // Fehler des Viewers beim Zeichnen sind Rohtexte: Für die Nutzenden ist die Datei nicht darstellbar
      try { zeichne(); } catch (e) {
        if (window.console) window.console.warn(e);
        throw grenzFehler('fehler_format');
      }
      zeigeStatus(v.seiten === 1 ? 'status_eine_seite' : 'status_seiten', { datei: name, anzahl: v.seiten }, false,
        v.entfernt ? { schluessel: 'status_entfernt', werte: { anzahl: v.entfernt } } : null);
    }).catch(function (e) {
      if (e && e.grenze) zeigeStatus(e.grenze, { datei: name, mb: MAX_ENTPACKT / 1048576, seiten: MAX_SEITEN, formen: MAX_ZELLEN }, true);
      else if (e && e.message === 'browser') zeigeStatus('fehler_browser', null, true);
      else zeigeStatus('fehler_start', { meldung: String((e && e.message) || e) }, true);
    });
  }

  // ---------------------------------------------------------------- Anzeige, Seiten, Zoom
  function zeichne() {
    var bereich = $('bereich');
    var ansicht = $('ansicht');
    bereich.hidden = false;
    leere(ansicht);
    var seite = aktuell.seite || 0;
    viewer = new window.GraphViewer(ansicht, aktuell.knoten, {
      lightbox: false, nav: false, page: seite, border: 16, 'dark-mode': istDunkel() ? 'dark' : 'light',
      'show-link-icons': false, 'show-tooltip-icons': false, highlight: '#5a63d4'
    });
    var g = viewer.graph;
    // Nur Seitenlinks folgen; alles andere bleibt zu (die Ansicht öffnet keine fremden Ziele)
    var seitenLink = g.customLinkClicked;
    g.customLinkClicked = function (href) {
      if (window.Graph.isPageLink(href)) { seitenLink.apply(this, arguments); nachSeitenwechsel(); }
      else zeigeStatus('link_blockiert', { ziel: String(href).slice(0, 200) }, true);
      return true;
    };
    g.openLink = function (href) { zeigeStatus('link_blockiert', { ziel: String(href).slice(0, 200) }, true); return null; };
    var auswahl = viewer.selectPage;
    viewer.selectPage = function () { var r = auswahl.apply(viewer, arguments); nachSeitenwechsel(); return r; };
    $('buehne').setAttribute('aria-label', t('ansicht_label', { datei: aktuell.name }));
    seitenListe();
    zoomAnzeige();
  }
  function nachSeitenwechsel() {
    if (!viewer || !aktuell) return;
    aktuell.seite = viewer.currentPage || 0;
    $('seite').value = String(aktuell.seite);
    zoomAnzeige();
  }
  function seitenListe() {
    var sel = $('seite');
    leere(sel);
    var seiten = viewer && viewer.diagrams ? viewer.diagrams : [];
    for (var i = 0; i < seiten.length; i++) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = seiten[i].getAttribute('name') || t('seite_nummer', { nummer: i + 1 });
      sel.appendChild(o);
    }
    sel.value = String(aktuell ? aktuell.seite : 0);
    var mehrere = seiten.length > 1;
    $('seiten-gruppe').hidden = !mehrere;
  }
  function zoomAnzeige() {
    if (!viewer) return;
    $('zoomwert').textContent = Math.round(viewer.graph.view.scale * 100) + ' %';
  }
  function zoomen(art) {
    if (!viewer) return;
    var g = viewer.graph;
    if (art === 'ein') g.zoomIn();
    else if (art === 'aus') g.zoomOut();
    else if (art === 'original') g.zoomTo(1);
    else if (art === 'einpassen') {
      var s = g.view.scale;
      var b = g.getGraphBounds();
      var breite = b.width / s + 2 * g.border;
      var hoehe = b.height / s + 2 * g.border;
      var buehne = $('buehne');
      var z = Math.min((buehne.clientWidth - 40) / breite, (buehne.clientHeight - 40) / hoehe, 4);
      g.zoomTo(Math.max(0.1, Math.floor(z * 100) / 100));
    }
    zoomAnzeige();
  }

  // ---------------------------------------------------------------- Bedienung
  function start() {
    var s = lesen(SPEICHER_SPRACHE);
    sprache = s === 'de' || s === 'en' ? s : browserSprache();
    var th = lesen(SPEICHER_THEME);
    // Standard dunkel wie START.html und der AIMS-Manager (Designpaket «AIMS Nachtblau»)
    setzeTheme(th === 'hell' || th === 'dunkel' || th === 'system' ? th : 'dunkel', false);
    anwenden();
    var radios = document.querySelectorAll('input[name="sprache"]');
    for (var i = 0; i < radios.length; i++) radios[i].addEventListener('change', function (e) { sprache = e.target.value; schreiben(SPEICHER_SPRACHE, sprache); anwenden(); });
    var themes = document.querySelectorAll('input[name="theme"]');
    for (var j = 0; j < themes.length; j++) themes[j].addEventListener('change', function (e) { schreiben(SPEICHER_THEME, e.target.value); setzeTheme(e.target.value, true); });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var neu = function () { if (theme === 'system' && aktuell) zeichne(); };
      if (mq.addEventListener) mq.addEventListener('change', neu); else if (mq.addListener) mq.addListener(neu);
    }
    var eingabe = $('datei');
    $('waehlen').addEventListener('click', function () { eingabe.click(); });
    eingabe.addEventListener('change', function () { oeffne(eingabe.files && eingabe.files[0]); eingabe.value = ''; });
    var ablage = $('ablage');
    var tiefe = 0;
    function istDatei(e) { var ty = e.dataTransfer && e.dataTransfer.types; return !!ty && Array.prototype.indexOf.call(ty, 'Files') >= 0; }
    document.addEventListener('dragenter', function (e) { if (!istDatei(e)) return; e.preventDefault(); tiefe++; ablage.classList.add('aktiv'); $('ablage-text').textContent = t('ablage_aktiv'); });
    document.addEventListener('dragover', function (e) { if (!istDatei(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    document.addEventListener('dragleave', function (e) { if (!istDatei(e)) return; tiefe = Math.max(0, tiefe - 1); if (!tiefe) { ablage.classList.remove('aktiv'); $('ablage-text').textContent = t('ablegen'); } });
    document.addEventListener('drop', function (e) {
      if (!istDatei(e)) return;
      e.preventDefault(); tiefe = 0; ablage.classList.remove('aktiv'); $('ablage-text').textContent = t('ablegen');
      oeffne(e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    $('seite').addEventListener('change', function (e) { if (viewer) viewer.selectPage(Number(e.target.value)); });
    $('seite-zurueck').addEventListener('click', function () { if (viewer) viewer.selectPage(viewer.currentPage - 1); });
    $('seite-weiter').addEventListener('click', function () { if (viewer) viewer.selectPage(viewer.currentPage + 1); });
    $('zoom-ein').addEventListener('click', function () { zoomen('ein'); });
    $('zoom-aus').addEventListener('click', function () { zoomen('aus'); });
    $('zoom-einpassen').addEventListener('click', function () { zoomen('einpassen'); });
    $('zoom-original').addEventListener('click', function () { zoomen('original'); });
    // Für Tests und Fehlersuche: Zustand lesen, ohne die Bedienung zu umgehen
    window.diagrammansicht = { zustand: function () { return { viewer: !!viewer, seite: viewer ? viewer.currentPage : null, seiten: aktuell ? aktuell.seiten : 0, zoom: viewer ? viewer.graph.view.scale : null, entfernt: aktuell ? aktuell.entfernt : 0, bearbeitbar: viewer ? viewer.graph.isEnabled() : null }; } };
  }
  start();
})();
</script>
</body>
</html>

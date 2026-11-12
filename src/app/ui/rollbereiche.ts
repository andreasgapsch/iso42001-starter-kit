// Scrollbare Bereiche bedienbar machen (Nutzertest rc.10, U-14 und U-19; WCAG 2.1.1, axe scrollable-region-focusable):
// Tabellen, Abläufe und Grafiken, die breiter als ihr Platz sind, scrollen in ihrem eigenen Bereich statt die Seite zu
// verbreitern. Solche Bereiche erhalten tabindex 0, die Rolle region und einen Namen (Beschriftung der Tabelle oder die
// Überschrift davor), damit man sie mit der Tastatur erreicht und mit den Pfeiltasten scrollt. Passt der Inhalt wieder,
// werden die Angaben entfernt (kein unnötiger Tabulatorhalt).
const AUSWAHL = '.tabelle-feld, .prozess-ablauf, .g-scroll, .bib-blatt';
const MARKE = 'data-rollbereich';

function name(el: HTMLElement): string {
  const titel = el.querySelector('caption, figcaption, [role=img][aria-label]');
  const text = titel?.getAttribute('aria-label') ?? titel?.textContent;
  if (text?.trim()) return text.trim().slice(0, 120);
  let v: Element | null = el;
  while (v && v.tagName !== 'MAIN') {
    let s = v.previousElementSibling;
    while (s) {
      if (/^H[1-4]$/.test(s.tagName) && s.textContent?.trim()) return s.textContent.trim().slice(0, 120);
      const h = s.querySelector?.('h1, h2, h3, h4, summary');
      if (h?.textContent?.trim()) return h.textContent.trim().slice(0, 120);
      s = s.previousElementSibling;
    }
    v = v.parentElement;
  }
  return document.querySelector('main h1')?.textContent?.trim() ?? '';
}

/**
 * Tabellen ohne Namen erhalten den Titel ihres Abschnitts, Kopfzellen die Spaltenangabe (D-19): an einer Stelle statt in jeder
 * Ansicht, auch für künftige Tabellen.
 */
export function tabellenBenennen(wurzel: ParentNode = document): void {
  for (const tab of wurzel.querySelectorAll<HTMLTableElement>('table')) {
    for (const th of tab.querySelectorAll<HTMLElement>('thead th:not([scope])')) th.setAttribute('scope', 'col');
    // Tabellen ohne thead: Erste Zeile nur aus Kopfzellen sind Spaltenköpfe, weitere Kopfzellen gelten für ihre Zeile
    const erste = tab.rows[0];
    if (erste && !tab.tHead && [...erste.cells].every((c) => c.tagName === 'TH')) for (const c of erste.cells) if (!c.hasAttribute('scope')) c.setAttribute('scope', 'col');
    for (const th of tab.querySelectorAll<HTMLElement>('tbody th:not([scope])')) th.setAttribute('scope', 'row');
    if (tab.hasAttribute('aria-label') || tab.hasAttribute('aria-labelledby') || tab.querySelector('caption') || tab.getAttribute('role') === 'presentation') continue;
    const abschnitt = tab.closest('section, article, details, .karte, main');
    // Sonst der Seitentitel: Der Guide stellt Tabellen ohne eigene Überschrift in den Bereich
    const titel = (abschnitt?.querySelector('h1, h2, h3, h4, summary') ?? tab.ownerDocument.querySelector('main h1, h1'))?.textContent?.trim();
    if (titel) tab.setAttribute('aria-label', titel);
  }
}

export function rollbereicheMarkieren(wurzel: ParentNode = document): void {
  tabellenBenennen(wurzel);
  for (const el of wurzel.querySelectorAll<HTMLElement>(AUSWAHL)) {
    const rollt = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible';
    if (rollt && !el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
      el.setAttribute(MARKE, '');
      // Gruppe statt Orientierungspunkt: Bereiche mit gleichem Namen wie ihr Abschnitt wären sonst doppelte Landmarks (D-17)
      if (!el.hasAttribute('role')) el.setAttribute('role', 'group');
      if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', name(el));
    } else if (!rollt && el.hasAttribute(MARKE)) {
      el.removeAttribute('tabindex');
      el.removeAttribute(MARKE);
      if (el.getAttribute('role') === 'group') el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
  }
}

/** Beobachtet Änderungen im Inhalt und die Fenstergrösse; liefert die Abmeldung. */
export function rollbereicheBeobachten(wurzel: HTMLElement): () => void {
  let geplant = 0;
  const planen = () => {
    if (geplant) return;
    geplant = requestAnimationFrame(() => {
      geplant = 0;
      rollbereicheMarkieren(wurzel);
    });
  };
  const mo = new MutationObserver(planen);
  mo.observe(wurzel, { childList: true, subtree: true });
  globalThis.addEventListener('resize', planen);
  planen();
  return () => {
    mo.disconnect();
    globalThis.removeEventListener('resize', planen);
    cancelAnimationFrame(geplant);
  };
}

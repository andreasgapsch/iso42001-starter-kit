// Blätter des Rahmens (Untermenü unter 900 px, «Mehr» unter 640 px): modal wie ein Dialog. Solange ein Blatt offen ist,
// sind die übrigen Teile des Rahmens inert, Tab und Shift+Tab bleiben im Blatt (Fokusfalle), Escape schliesst. Beim
// Öffnen erhält der aktuelle Eintrag oder das erste Bedienelement den Fokus; wohin der Fokus beim Schliessen geht,
// entscheidet der Aufrufer (Knopf, der das Blatt geöffnet hat, oder der Titel der neuen Seite).
import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function fokussierbar(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(FOKUSSIERBAR)].filter((x) => x.offsetParent !== null || x === document.activeElement);
}

export function useBlatt(offen: boolean, ref: RefObject<HTMLElement>, schliessen: () => void): void {
  // Layout-Effekt: inert wird im selben Commit aufgehoben, in dem das Blatt schliesst; der Fokus kann danach zurück
  useLayoutEffect(() => {
    const el = ref.current;
    if (!offen || !el) return;
    const app = el.closest('.app') ?? document.body;
    const andere = [...app.children].filter((x): x is HTMLElement => x instanceof HTMLElement && x !== el && !x.contains(el) && !x.classList.contains('abdecken'));
    for (const x of andere) x.inert = true;
    const start = requestAnimationFrame(() => (el.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"]') ?? fokussierbar(el)[0])?.focus());
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        schliessen();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = fokussierbar(el);
      if (!f.length) return;
      const erstes = f[0]!;
      const letztes = f[f.length - 1]!;
      if (!el.contains(document.activeElement)) { e.preventDefault(); erstes.focus(); }
      else if (e.shiftKey && document.activeElement === erstes) { e.preventDefault(); letztes.focus(); }
      else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus(); }
    };
    document.addEventListener('keydown', taste, true);
    return () => {
      cancelAnimationFrame(start);
      document.removeEventListener('keydown', taste, true);
      for (const x of andere) x.inert = false;
    };
  }, [offen]);
}

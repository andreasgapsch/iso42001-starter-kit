// Fokus bei gesperrten Knöpfen (N13, Prüfung test.6): Ein Knopf mit Zustand Beschäftigt ist gesperrt (disabled), solange die
// Arbeit läuft. Chromium nimmt einem gesperrten Element den Fokus (document.activeElement wird body); wer mit der Tastatur
// arbeitet, stünde danach am Anfang der Seite. Diese Wache merkt sich das zuletzt fokussierte Element. Verliert es den Fokus
// durch die Sperre und wird es wieder frei, erhält es ihn zurück, sofern der Fokus inzwischen nirgends sonst liegt.
// Gilt für alle Knöpfe der App (V-05, B5, D2), ohne Änderung an den einzelnen Ansichten.

export function fokusHalten(doc: Document = document): () => void {
  let zuletzt: Element | null = null;
  let wartend: HTMLElement | null = null;
  const ohneFokus = () => !doc.activeElement || doc.activeElement === doc.body;
  const fokus = (e: FocusEvent) => {
    zuletzt = e.target as Element;
    if (wartend && e.target !== wartend) wartend = null;
  };
  const beobachter = new MutationObserver((liste) => {
    for (const m of liste) {
      const el = m.target as HTMLElement & { disabled?: boolean };
      if (el.disabled === true && el === zuletzt && (ohneFokus() || doc.activeElement === el)) wartend = el;
      else if (el.disabled === false && el === wartend) {
        wartend = null;
        if (el.isConnected && ohneFokus()) el.focus({ preventScroll: true });
      }
    }
  });
  // Bedient die Person inzwischen anderswo (Klick, Tippen), gilt der Wartezustand nicht mehr (Prüfung test.7 N7)
  const anderswo = (e: Event) => {
    if (wartend && e.target !== wartend) wartend = null;
  };
  doc.addEventListener('focusin', fokus);
  doc.addEventListener('pointerdown', anderswo, true);
  beobachter.observe(doc.documentElement, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  return () => {
    doc.removeEventListener('focusin', fokus);
    doc.removeEventListener('pointerdown', anderswo, true);
    beobachter.disconnect();
  };
}

// Eigene Symbole des Rahmens (Designpaket «AIMS Nachtblau», docs/design-system/nachtblau/mockup-shell.html): 24×24,
// Strich in currentColor, keine fremden Symbolsätze. Bereiche können über den Namen (MenuePunkt.icon) darauf verweisen;
// unbekannte Namen zeigen das Dokumentsymbol.
const PFADE: Record<string, string> = {
  start: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  uebersicht: 'M4 20a8 8 0 1 1 16 0M12 20l4-6M4 20h16',
  guide: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  register: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 9h16M4 14h16M9 4v16',
  prozesse: 'M4 4h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM16 4h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM10 15h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zM6 9v3h12V9M12 12v3',
  bibliothek: 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15-3.5 1z',
  wissen: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h6',
  pruefung: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  glocke: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  hilfe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  einstellungen: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  tabelle: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 10h16M10 10v10',
  pdf: 'M6 3h8l4 4v14H6zM14 3v4h4M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5',
  ordner: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  hoch: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  plus: 'M12 5v14M5 12h14',
  suche: 'M11 5a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM20 20l-4-4',
  links: 'M15 6l-6 6 6 6',
  // A-24: Pfeile mit Schaft für Pfeiltasten, Übergänge und Verweise (statt «←», «→» ausserhalb der eingebetteten Inter)
  'pfeil-links': 'M19 12H5M11 6l-6 6 6 6',
  'pfeil-rechts': 'M5 12h14M13 6l6 6-6 6',
  'pfeil-hoch': 'M12 19V5M6 11l6-6 6 6',
  'pfeil-runter': 'M12 5v14M6 13l6 6 6-6',
  rechts: 'M9 6l6 6-6 6',
  ki: 'M7 7h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM12 3v4M9 12h.01M15 12h.01M9 15h6',
  risiko: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  haken: 'M5 12l4 4 10-10',
  liste: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  landkarte: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  person: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4 21a8 8 0 0 1 16 0',
  personen: 'M9 5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 5.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  kalender: 'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
  menue: 'M4 6h16M4 12h16M4 18h16',
  schliessen: 'M6 6l12 12M18 6L6 18',
  einklappen: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 4v16M15 9l-3 3 3 3',
  ausklappen: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 4v16M13 9l3 3-3 3',
  ziel: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z',
  massnahme: 'M4 7h11M4 12h8M4 17h6M15 15l2 2 4-4',
  meldung: 'M4 5h16v11H9l-5 4zM9 9h6M9 12h4',
  lieferant: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM17 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4z',
  modul: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  bruecke: 'M3 17h18M5 17V9M19 17V9M5 9c3 3 11 3 14 0M9 17v-4M15 17v-4',
  sprache: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  pinsel: 'M14 4l6 6-8 8H6v-6zM12 6l6 6M6 18l-2 2',
  speicher: 'M5 4h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 4v5h7V4M8 20v-6h8v6',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01',
  tasten: 'M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM7 10h.01M11 10h.01M15 10h.01M8 14h8',
  glossar: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  waage: 'M12 4v16M6 20h12M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z',
  erzeugen: 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6',
  mehr: 'M6 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3zM18 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  drucken: 'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  aktivitaet: 'M3 12h4l3-7 4 14 3-7h4',
};

export function Symbol({ name, klasse = 'sym' }: { name: string; klasse?: string }) {
  return (
    <svg class={klasse} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PFADE[name] ?? PFADE['doc']} />
    </svg>
  );
}

export function hatSymbol(name: string): boolean {
  return name in PFADE;
}

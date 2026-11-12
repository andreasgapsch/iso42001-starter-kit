// Zweiter Tab mit demselben Projekt: beide schreiben denselben Zwischenstand, der letzte gewinnt. Erkennen und warnen über
// BroadcastChannel und zusätzlich über das Ereignis «storage»: WebKit stellt unter file:// den Kanal zwischen Tabs nicht zu, das
// Ereignis schon (gemessen, tests/e2e/app/runde2-letzte.e2e.ts). Doppelte Nachrichten schaden nicht: Die Wache führt einen Stand
// je Tab. Ohne beide Wege bleibt nur die Erkennung beim Schreiben (projekt-speicher.ts).

import { jsonAusVertrauen } from '../../eingang/lesen.ts';
export interface TabNachricht {
  art: 'hallo' | 'da' | 'weg';
  tab: string;
  schluessel: string | null;
}

export interface KanalLike {
  postMessage(n: TabNachricht): void;
  addEventListener(typ: 'message', f: (e: { data: TabNachricht }) => void): void;
  close(): void;
}

/** Minimale Sicht auf localStorage und das Ereignis «storage» */
export interface SpeicherKanalQuelle {
  setItem(k: string, w: string): void;
  horchen(f: (schluessel: string | null, wert: string | null) => void): () => void;
}

const SPEICHER_KANAL = 'aims-manager-tabs';

/** Nachrichten über einen Schlüssel im localStorage; die laufende Nummer macht jede Nachricht zu einer Änderung */
export function speicherKanal(q: SpeicherKanalQuelle): KanalLike {
  let nr = 0;
  let hoererEnde = () => {};
  return {
    postMessage(n) {
      try {
        q.setItem(SPEICHER_KANAL, JSON.stringify({ ...n, nr: ++nr }));
      } catch {
        // Speicher voll oder gesperrt: bleibt der andere Weg
      }
    },
    addEventListener(_typ, f) {
      hoererEnde = q.horchen((k, w) => {
        if (k !== SPEICHER_KANAL || !w) return;
        try {
          f({ data: jsonAusVertrauen(w, 'tab-nachricht') as TabNachricht });
        } catch {
          // Kein gültiger Inhalt: nicht von diesem Werkzeug
        }
      });
    },
    close() {
      hoererEnde();
    },
  };
}

/** Mehrere Wege als ein Kanal */
export function kanaeleVereint(kanaele: readonly KanalLike[]): KanalLike {
  return {
    postMessage: (n) => kanaele.forEach((k) => k.postMessage(n)),
    addEventListener: (t, f) => kanaele.forEach((k) => k.addEventListener(t, f)),
    close: () => kanaele.forEach((k) => k.close()),
  };
}

export interface TabWache {
  /** Dieses Projekt ist jetzt hier offen (null: keines) */
  setze(schluessel: string | null): void;
  /** Tabs mit demselben Projekt */
  andere(): number;
  ende(): void;
}

/** Hält fest, welche anderen Tabs dasselbe Projekt offen haben; meldet jede Änderung der Zahl. */
export function tabWache(kanal: KanalLike | null, tab: string, gemeldet: (andere: number) => void): TabWache {
  let schluessel: string | null = null;
  const fremd = new Map<string, string | null>();
  let letzte = 0;
  const zahl = () => (schluessel === null ? 0 : [...fremd.values()].filter((s) => s === schluessel).length);
  const pruefen = () => {
    const n = zahl();
    if (n !== letzte) {
      letzte = n;
      gemeldet(n);
    }
  };
  kanal?.addEventListener('message', ({ data: d }) => {
    if (!d || d.tab === tab) return;
    if (d.art === 'weg') fremd.delete(d.tab);
    else fremd.set(d.tab, d.schluessel);
    if (d.art === 'hallo') kanal.postMessage({ art: 'da', tab, schluessel });
    pruefen();
  });
  kanal?.postMessage({ art: 'hallo', tab, schluessel });
  return {
    setze(s) {
      if (s === schluessel) return;
      schluessel = s;
      kanal?.postMessage({ art: 'hallo', tab, schluessel });
      pruefen();
    },
    andere: zahl,
    ende() {
      kanal?.postMessage({ art: 'weg', tab, schluessel });
      kanal?.close();
    },
  };
}

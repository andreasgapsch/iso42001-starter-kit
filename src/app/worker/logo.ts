// Bildarbeit der Dokumentgestaltung im Generator-Worker (bei Bedarf geladen, nicht im Startcode der App): Normalisierung
// des Logos, Farbvorschläge, Prüfung des gespeicherten Logos, SVG-Bereinigung und Vorschlag aus einer Word-Vorlage.
// Der Hauptthread liefert nur Dateibytes und die Pixel aus dem Canvas (src/app/logik/logo.ts). Isomorph und rein.
import { farbvorschlaege, fuerDunklenGrund, inhaltRahmen, LogoFehler, logoNormalisieren, type LogoForm, type LogoHinweis, type Rahmen } from '../../generator/bild.ts';
import { pngDekodieren, type Rgba } from '../../generator/png.ts';
import { SvgFehler, svgBereinigen } from '../../generator/svg.ts';
import { ausWordVorlage, type VorlagenVorschlag } from '../../generator/vorlage-import.ts';

export type LogoAufgabe =
  | { aufgabe: 'normalisieren'; bild: Rgba }
  | { aufgabe: 'analyse'; png: Uint8Array }
  | { aufgabe: 'svg'; text: string }
  | { aufgabe: 'vorlage'; daten: Uint8Array };

export interface Normalisiert {
  png: Uint8Array;
  breite: number;
  hoehe: number;
  form: LogoForm;
  hinweise: LogoHinweis[];
  vorschlaege: string[];
  /** Inhalt ohne Ränder in Pixeln der Eingabe (für den Zuschnitt des SVG) */
  rahmen: Rahmen;
}

export interface SvgBereinigt {
  svg: string;
  breite?: number;
  hoehe?: number;
  entfernt: string[];
}

export type LogoErgebnis =
  | { aufgabe: 'normalisieren'; ok: true; wert: Normalisiert }
  | { aufgabe: 'analyse'; ok: true; wert: { vorschlaege: string[]; dunkel: boolean; hoehe: number } }
  | { aufgabe: 'svg'; ok: true; wert: SvgBereinigt }
  | { aufgabe: 'vorlage'; ok: true; wert: VorlagenVorschlag }
  | { aufgabe: LogoAufgabe['aufgabe']; ok: false; fehler: 'leer' | 'logo-zu-gross' | 'svg-ungueltig' | 'format-unbekannt'; detail?: string };

export function logoAufgabe(a: LogoAufgabe): LogoErgebnis {
  switch (a.aufgabe) {
    case 'normalisieren':
      try {
        const n = logoNormalisieren(a.bild);
        const rahmen = inhaltRahmen(a.bild) ?? { x: 0, y: 0, breite: a.bild.breite, hoehe: a.bild.hoehe };
        return { aufgabe: a.aufgabe, ok: true, wert: { png: n.png, breite: n.breite, hoehe: n.hoehe, form: n.form, hinweise: n.hinweise, vorschlaege: farbvorschlaege(n.bild), rahmen } };
      } catch (e) {
        if (e instanceof LogoFehler) return { aufgabe: a.aufgabe, ok: false, fehler: e.art === 'leer' ? 'leer' : 'logo-zu-gross' };
        throw e;
      }
    case 'analyse': {
      const b = pngDekodieren(a.png);
      return { aufgabe: a.aufgabe, ok: true, wert: { vorschlaege: farbvorschlaege(b), dunkel: fuerDunklenGrund(b), hoehe: b.hoehe } };
    }
    case 'svg':
      try {
        return { aufgabe: a.aufgabe, ok: true, wert: svgBereinigen(a.text) };
      } catch (e) {
        if (e instanceof SvgFehler) return { aufgabe: a.aufgabe, ok: false, fehler: 'svg-ungueltig', detail: e.code };
        throw e;
      }
    case 'vorlage':
      try {
        return { aufgabe: a.aufgabe, ok: true, wert: ausWordVorlage(a.daten) };
      } catch {
        return { aufgabe: a.aufgabe, ok: false, fehler: 'format-unbekannt' };
      }
  }
}

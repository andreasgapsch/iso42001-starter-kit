// Funde des Werkzeugs, die nicht in dieses Paket gehören (P2 behebt keine Funde). Jeder Eintrag ist ein erwarteter
// Fehlschlag mit Fall-Datei unter tests/fixtures/fuzz/ und dem Paket, das ihn behebt. Der Test «erwartete Fehlschläge»
// verlangt, dass der Fall weiter fehlschlägt: Wird er behoben, schlägt dieser Test an, und der Eintrag muss weg.
// Nie still überspringen: Ein Fehlschlag ohne Eintrag ist ein roter Test.
import type { Eingabeart } from './typen.ts';

export interface BekannterFund {
  art: Eingabeart;
  seed: number;
  nummer: number;
  /** Fall-Datei unter tests/fixtures/fuzz/ */
  datei: string;
  /** Teil der erwarteten Fehlermeldung */
  meldung: string;
  /** Paket, das den Fund behebt */
  paket: string;
  /** Kurzbeschreibung und Ursache */
  beschreibung: string;
}

// F1 (Normpaket, Eintrag null in teile: TypeError) ist in P8 behoben (src/app/normtexte/zustand.ts); die Fall-Dateien
// tests/fixtures/fuzz/normpaket-*.json bleiben als Regression (tests/fuzz/regression.ts), die Klasse steht in tests/fuzz/klassen/.
export const BEKANNTE_FUNDE: BekannterFund[] = [];

// Mutationsklassen (AF-022): je Sicherheitsbefund der Runden 1 und 2 zu Eingaben eine Klasse mit Generator. Gesperrt wird die
// Klasse, nicht die Originaleingabe: Jede Klasse erzeugt je Lauf mindestens 50 Varianten (verkleinert, umkodiert, verschachtelt,
// an anderer Stelle), der Originalfall bleibt als Regressionsdatei unter tests/fixtures/fuzz/regression/.
//
// Gegenprobe (W28), ein Modellwert, keine Messung: `ohneSchutz` bildet nach, was der Code ohne die Behebung täte (Prüfung weggelassen oder Altverhalten), und
// sagt, ob die Variante den Befund dort auslöst. Der Klassentest verlangt, dass das für den Originalfall und den grössten Teil
// der Varianten zutrifft: Die Klasse findet den Befund also, wenn die Behebung fehlt.
import type { Eingabeart, Fall, Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';

export interface KlassenFall extends Fall {
  /** Die Variante muss abgelehnt werden (Ablehnung mit Meldung); sonst genügt ein Urteil ohne Fehler */
  mussAbgelehnt?: boolean;
}

export interface Klasse {
  /** Kennung, auch Dateistamm der Regressionsdatei */
  id: string;
  art: Eingabeart;
  /** Befunde der Runden 1 und 2, die diese Klasse sperrt */
  befunde: string[];
  titel: string;
  /** Variante Nummer i; rein (nur Zufall und Nummer) */
  variante(z: Zufall, i: number): KlassenFall;
  /** Urteil mit dem echten Code; wirft OrakelFehler bei einer Verletzung, Ablehnung nur mit eigener Meldung */
  urteile(f: KlassenFall): Urteil | Promise<Urteil>;
  /** Gegenprobe: löst die Variante den Befund aus, wenn die Behebung fehlt? */
  ohneSchutz(f: KlassenFall): boolean;
  /** Regressionsdatei (Originalfall) relativ zum Repository */
  regression: string;
  /** Fall aus der Regressionsdatei */
  ausDatei(bytes: Uint8Array): KlassenFall;
}

export const text = (b: Uint8Array): string => new TextDecoder().decode(b);

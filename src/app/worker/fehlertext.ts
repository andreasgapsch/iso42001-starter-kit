// Fehlertexte laufen über eine Abbildung auf Ursache und nächsten Schritt (AF-015, QK-07). Technische Rohtexte aus Worker,
// Parsern und Browser (err.message, String(e)) erreichen die Oberfläche nicht: Sie gehören nur in die Technikzeile des
// Fehlerberichts und in den Speicherstatus, nie in eine Meldung. Das Tor G38 (scripts/pruefen/rohtexte.mts) prüft die Quellen.
import { EingangsFehler } from '../../eingang/lesen.ts';
import { t } from '../i18n.ts';
import { rohtextVon, technikText } from '../speicher/technik.ts';

/** Muster auf Rohtexte; Ursache (Schlüssel `fehler.*`) und, wo sinnvoll, der nächste Schritt (Schlüssel `fehler.schritt_*`) */
const MUSTER: [RegExp, string, string?][] = [
  // Datenträger oder Browserspeicher voll (grosse Nachweise, E2-10)
  [/storage quota|quota has been exceeded|QuotaExceeded|no space left|exceeded the quota/i, 'fehler.speicher_voll'],
  [/ZIP entpackt zu gross|Eintrag im ZIP zu gross|ZIP mit zu vielen|Sicherung zu gross/, 'fehler.datei_aufwand', 'fehler.schritt_datei'],
  [/Ungültiger Pfad|Unzulässiger Name/, 'fehler.datei_pfad', 'fehler.schritt_datei'],
  [/could not be cloned|Failed to execute|Self Reference|The string to be decoded|Invalid code point|invalid (zip|stored block|block type|distance|length)|unexpected EOF|invalid zip data|unknown compression|ZIP nicht lesbar/i, 'fehler.datei_defekt', 'fehler.schritt_datei'],
  [/Maximum call stack|too much recursion|Out of memory|allocation failed|Array buffer allocation|Invalid (array|typed array|string) length|Invalid shape group/i, 'fehler.datei_aufwand', 'fehler.schritt_datei'],
  // Rohtexte der Bibliotheken bei kaputten Dateien (exceljs: setting 'sheetNo')
  [/Cannot (set|read) propert|is not a function|is not iterable|of undefined|of null/i, 'fehler.datei_defekt', 'fehler.schritt_datei'],
  [/is not valid JSON|JSON at position|Unexpected token|Expected .* in JSON|Unexpected end of JSON|JSON\.parse/i, 'fehler.datei_defekt', 'fehler.schritt_datei'],
  // Schreiben in Datei oder Ordner (Browser: Rechte, gesperrte Datei)
  [/NotAllowed|NoModificationAllowed|Schreibrecht|permission|denied|verweigert/i, 'fehler.schreibrecht'],
  [/NotFoundError|could not be found/i, 'fehler.nicht_gefunden'],
];

export { technikText };

/**
 * Eigener Klartext der App (zum Beispiel «Die Datei ist grösser als 512 MB»): Er ist schon verständlich, eine Abbildung würde ihn
 * durch die allgemeine Meldung ersetzen. Nur eigene, übersetzte Texte werfen diese Klasse; Rohtexte fremder Quellen nie.
 */
export class KlartextFehler extends Error {
  constructor(readonly klartext: string) {
    super(klartext);
    this.name = 'KlartextFehler';
  }
}

/** Bekannte Ursache als Klartext mit nächstem Schritt, sonst undefined */
export function fehlerAbbildung(e: unknown): string | undefined {
  // Grenzen des Eingangsmoduls: Text mit den Werten aus der Konfiguration (AF-020)
  if (e instanceof EingangsFehler) return `${t(`eingang.${e.grund}`, { ...e.werte(), art: t(`eingang.art.${e.art}`) })} ${t(e.grund === 'zwischenstand-gross' ? 'eingang.schritt_zwischenstand' : 'fehler.schritt_datei')}`;
  if (e instanceof KlartextFehler) return e.klartext;
  const { name, roh } = rohtextVon(e);
  if (name === 'ZeitFehler') return t('fehler.zeitgrenze');
  if (name === 'QuotaExceededError') return t('fehler.speicher_voll');
  for (const [m, k, schritt] of MUSTER) if (m.test(roh) || m.test(name)) return schritt ? `${t(k)} ${t(schritt)}` : t(k);
  return undefined;
}

/** Text für eine Meldung: bekannte Ursache mit nächstem Schritt, sonst der allgemeine Text ohne Rohtext */
export function fehlerVerstaendlich(e: unknown): string {
  return fehlerAbbildung(e) ?? t('fehler.unbekannt');
}

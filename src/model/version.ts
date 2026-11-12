// Version des Kits, einzige Quelle package.json (AF-177).
// Node-ESM (Playwright), tsx und Vitest laden die Datei mit Importattribut. Im AIMS-Manager ersetzt das Plugin
// «kit-version» in vite.config.ts diesen Modulinhalt durch die Konstante aus package.json, damit das Bündel nicht die
// ganze package.json (Skripte, Abhängigkeiten) enthält.
import paket from '../../package.json' with { type: 'json' };

/** Version des Kits aus package.json; START, Projektdateien, Diagrammansicht, Ordnername und Dokumente lesen sie von hier. */
export const KIT_VERSION: string = paket.version;

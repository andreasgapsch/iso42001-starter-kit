# Sicherheit

Der AIMS-Manager läuft vollständig offline im Browser (`connect-src 'none'`, strikte Content Security Policy mit Trusted Types). Projektdaten bleiben auf dem eigenen Rechner: in der Projektdatei und im Zwischenspeicher des Browsers.

## Bekannte Grenze: gemeinsamer Speicher unter file://

Browser behandeln lokal geöffnete HTML-Dateien als dieselbe Herkunft. Eine andere lokal geöffnete HTML-Datei könnte deshalb den Zwischenspeicher des AIMS-Managers lesen, darunter Projektstand, Logo und von Ihnen geladene Normtexte. Öffnen Sie im selben Browser keine fremden HTML-Dateien aus unbekannter Quelle. Der AIMS-Manager befristet gesicherte Stände auf 30 Tage und bietet unter Einstellungen, Speicher «Zwischenspeicher leeren» und die Option, keine Zwischenstände abzulegen. Normtexte löschen Sie unter Einstellungen, Normtexte.

## Schwachstelle melden

Bitte melden Sie Sicherheitslücken nicht als öffentliches Issue, sondern über GitHub Private Vulnerability Reporting: [Report a vulnerability](https://github.com/andreasgapsch/iso42001-starter-kit/security/advisories/new) (private Meldung, nur für die Betreuer des Repos sichtbar). Sie erhalten innert 10 Arbeitstagen eine Antwort.

## Unterstützte Versionen

Sicherheitskorrekturen gibt es für die jeweils neueste Version des Kits.

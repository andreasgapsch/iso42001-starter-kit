# Mitwirken

Rückmeldungen sind willkommen: Fehler in Vorlagen oder im Werkzeug, unklare Texte, Erfahrungen aus Audits.

## Issues

Nutzen Sie die Vorlagen «Fehler melden» oder «Verbesserung vorschlagen». Nennen Sie Version, Sprache, Datei oder Ansicht und was Sie erwartet hätten. Keine vertraulichen Firmendaten anhängen.

## Pull Requests

- Texte stehen in `src/i18n/de` und `src/i18n/en` und werden immer in beiden Sprachen geändert.
- Kein Normtext: Aus ISO/IEC 42001, 42005, 27001 oder anderen Normen dürfen nur Abschnitts- und Control-Nummern mit eigenen Kurztiteln übernommen werden. Keine Inhalte, Strukturen oder Nummerierungen aus fremden Kurs- oder Schulungsunterlagen.
- Stil: Schweizer Rechtschreibung (kein Eszett, «Mitarbeitende»), Englisch britisch mit -ize, keine Gedankenstriche, auch nicht in Zahlenbereichen («5 bis 10»). Details in [docs/KONVENTIONEN.md](docs/KONVENTIONEN.md).
- Vor dem Pull Request: `npm run typecheck`, `npm test`, `npm run pruefen` (Einzelheiten unter «Entwicklung»).
- Mit dem Pull Request bringen Sie Ihren Beitrag unter den Lizenzen dieses Repos ein (Inhalte CC BY 4.0, Code MIT), einschliesslich der Zusatzerlaubnis für eigene Dokumente ([ZUSATZERLAUBNIS_DE.txt](src/lizenz/ZUSATZERLAUBNIS_DE.txt), [ADDITIONAL-PERMISSION_EN.txt](src/lizenz/ADDITIONAL-PERMISSION_EN.txt)). Sie bestätigen, dass Sie dazu berechtigt sind.
- Verhalten: Es gilt der [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Entwicklung

Voraussetzung ist Node.js 24; für Dokumententests LibreOffice (headless), für E2E-Tests die Playwright-Browser.

```bash
npm ci                                            # Abhängigkeiten genau nach package-lock.json
npm run kataloge && npm run schema                # erzeugte Kataloge und Schema (nicht im Repo)
npm run typecheck                                 # Typen
npm test                                          # Unit- und Dokumententests (Vitest)
npm run pruefen                                   # Qualitätstore G4, G5, G7, G8, G14, G15, G36, G37
npx playwright install chromium firefox webkit    # einmalig, nur für E2E-Tests
npm run build:app && npm run build:kit            # AIMS-Manager und Kit nach dist/
npm run test:e2e                                  # E2E über file:// in drei Engines
npm run bildschirmfotos                           # Bilder für README neu erzeugen (docs/bilder, braucht das gebaute Kit)
```

`npm run pruefen:lokal` prüft zusätzlich G6 (Urheberrecht) und G18 (NIST-Zitate); beide brauchen lokale Quellen, die nie im Repo liegen (Ordner aus `QUELLEN_DIR`).

Ändert ein Beitrag eine Testerwartung, einen Snapshot, ein Referenzbild, eine Schwelle oder die Abdeckungsbasis, verlangt das Tor G33 einen Vermerk «Erwartung geändert: <Grund>» in der Commit-Nachricht oder als neue Zeile in [docs/entwicklung/erwartungen-begruendung.md](docs/entwicklung/erwartungen-begruendung.md). Die Zählweise der Robustheitsmessung (`npm run abnahme:q9`) steht in [docs/entwicklung/ZAEHLWEISE-Q9.md](docs/entwicklung/ZAEHLWEISE-Q9.md).

Speichergrenze: Browser-, Build- und Massenläufe immer mit `scripts/werkzeug/begrenzt.sh <Grenze>` starten, zum Beispiel `scripts/werkzeug/begrenzt.sh 4G npm run build:app` oder `scripts/werkzeug/begrenzt.sh 6G npx playwright test --workers=2`. Temporäre Dateien gehören in einen Ordner ausserhalb des Repos (`TMPDIR`).

## Versionen und Release

Die Version steht nur in `package.json`. Werkzeug, Projektdateien, Beispiele, START, CHANGELOG.txt, Ordnername und Diagrammansicht lesen sie beim Bau (`KIT_VERSION` in `src/model/neu.ts`, Platzhalter `{{version}}`). Das Tor G36 meldet jede handgepflegte Version in `src/`, `scripts/` und `README.md`.

| Art | Wann | Beispiel |
|---|---|---|
| Vorabversion `test.N` | Testversion für Anwender vor einem Release | 1.1.0-test.1 auf 1.1.0-test.2 |
| Vorabversion `rc.N` | Release-Kandidat | 1.1.0-rc.1 |
| PATCH | nur Fehlerbehebung, Projektdateien unverändert | 1.0.0 auf 1.0.1 |
| MINOR | neue Funktion, alte Projektdateien bleiben lesbar (mit Migration) | 1.0.1 auf 1.1.0 |
| MAJOR | alte Projektdateien lassen sich ohne Migration nicht mehr öffnen | 1.1.0 auf 2.0.0 |

Nach SemVer ist 1.1.0 höher als jede Vorabversion 1.1.0-test.N; `package.json` trägt deshalb bis zur fertigen Version die zuletzt veröffentlichte Vorabversion.

Changelog (`CHANGELOG.md`): oben «## [Unveröffentlicht]», darunter je Version «## [x.y.z] - JJJJ-MM-TT» (ISO-Datum), neueste zuerst. Jede Aufzählung steht unter einer Änderungsart: Für Anwender, Neu, Geändert, Behoben, Entfernt, Veraltet, Sicherheit. Jeder Release hat den Abschnitt «Für Anwender»: was sich an den eigenen Dateien ändert und was zu tun ist. Jeder Tag `v<Version>` hat einen Eintrag und jeder Eintrag einen Tag.

Ablauf eines Releases:

1. Rechtsstand an den Quellen prüfen und `geprueft_am` in `src/ai-act/stand.yaml` setzen (höchstens 30 Tage vor dem Release, Tor G37).
2. «Unveröffentlicht» in «## [x.y.z] - JJJJ-MM-TT» umbenennen, neuen leeren Abschnitt «Unveröffentlicht» darüber.
3. Version in `package.json` erhöhen (`npm version --no-git-tag-version <Version>`).
4. `npm run build:app` und `npm run build:kit`, danach Tag `v<Version>` setzen.
5. `RELEASE_TAG=v<Version> npm run pruefen:release` (Version, Changelog, Tag, gebautes Kit, Rechtsstand); bei einem Fehler kein Release.
6. ZIP mit Prüfsumme an den GitHub-Release hängen.

# Konventionen für Quellen im Repo

Verbindlich für alle, die Inhalte unter `src/` schreiben.

## 1. Trennung Struktur und Text

- **Struktur** (IDs, Beziehungen, Bedingungen, Formate) steht sprachneutral in `src/kataloge/`, `src/ai-act/`, `src/vorlagen/`, `src/gefuehrt/`, `src/regeln/`.
- **Texte** stehen ausschliesslich in `src/i18n/de/<bereich>.yaml` und `src/i18n/en/<bereich>.yaml`, mit identischer Schlüsselstruktur. Schlüssel sind die IDs aus der Struktur.
- Platzhalter in Texten: `{name}`. Beide Sprachen verwenden dieselben Platzhalter.
- Ausnahme: wörtliche AI-Act-Auszüge unter `src/ai-act/auszuege/{de,en}/` (gekennzeichnete Zitate mit Artikelangabe und Stand).
- Ausnahme: Die Startseite `src/start/START.html.tpl` ist eine eigenständige Seite und enthält ihre Texte DE/EN selbst (Datenblock `texte`); ebenso die zweisprachigen Textvorlagen unter `src/start/`, `src/lizenz/` und `src/rechtstexte/`.

## 2. IDs

| Objekt | Muster | Beispiel |
|---|---|---|
| Normabschnitt 42001 | `K-<Nr>` | `K-6.1.4` |
| Control 42001 Anhang A | Normnummer | `A.5.2` |
| Control 27001:2022 Anhang A | `27001-<Nr>` | `27001-5.23` |
| Pflicht AI Act | `P-<rolle>-<nr>` | `P-BETR-05` |
| Zusatz-Control AI Act | `EUAIA-<nn>` | `EUAIA-07` |
| Eigenes Control | `EC-<nn>` | `EC-01` |
| Vorlage Kern / Modul | `D-<nn>`, `E-<nn>` | `D-11`, `E-03` |
| Ergänzungsblatt | `D-<nn>-EB` | `D-06-EB` |
| Projektdaten | siehe `src/model/typen.ts` (`ID_PRAEFIX`) | `KI-001` |

IDs ändern sich nie. Gestrichene IDs werden nicht neu vergeben (D-18, D-19).

## 3. Urheberrecht

- Kein Normtext, keine Control-Formulierungen, keine Tabellen der Norm, keine Folientexte. Erlaubt: Nummern und **eigene** Kurzbezeichnungen und Erklärungen.
- Eigene Worte heisst: aus dem Verständnis neu formulieren, nicht umstellen. Keine Folge von 8 Wörtern darf mit Norm oder fremden Kursunterlagen übereinstimmen (Prüfskript G6).
- Jede Vorlage und jedes Feld nennt den Abschnitt zum Nachlesen: «Anforderungstext siehe ISO/IEC 42001, Abschnitt X. Die Norm ist bei SNV, DIN oder ISO zu beziehen.»
- Keine Strukturen oder Nummerierungen fremder Kursunterlagen (z. B. Phasen 1.1 bis 4.2).

## 4. Sprache und Stil

- Deutsch: Schweizer Rechtschreibung (ss, nie Eszett), «Mitarbeitende», Sie-Form, kurze aktive Sätze, keine Beratersprache.
- Englisch: britisches Englisch mit Oxford-Endung «-ize» wie ISO («organization», «programme», «behaviour», «analyse»), Normbegriffe («statement of applicability», «AI system impact assessment»).
- In beiden Sprachen **keine Gedankenstriche** (U+2013, U+2014), auch nicht in Zahlenbereichen: «5 bis 10», «5 to 10».
- **Anführungszeichen:** Deutsch Guillemets in Schweizer Art «…», verschachtelt ‹…›. Englisch britisch einfache Anführungszeichen ‘…’ (U+2018, U+2019), verschachtelt doppelte “…” (U+201C, U+201D): ‘the column “Origin” in D-07’. In englischen Texten nie «…» oder ‹…›, auch nicht in Kommentaren englischer Dateien. Das Zeichen › mit Leerzeichen auf beiden Seiten ist kein Anführungszeichen, sondern der Pfadtrenner der Oberfläche (Settings › Document design) und in beiden Sprachen erlaubt. Code, der Text in Anführungszeichen setzt, nimmt die Zeichen aus der Sprache des Dokuments, nicht fest «…». Tor G5 prüft englische Zeilen (Sprache aus Pfad, Zeilenschlüssel `en:`/`titel_en:`, Wert `en: '…'` in der Zeile, Abschnitt «English» in zweisprachigen Textdateien, Liste `DATEI_SPRACHE` in `scripts/pruefen/stil.mts`); begründete Ausnahmen nur mit `stil-ok: <Grund>`.
- **Endung -ise im Englischen:** Alles auf «-ize» (organization, optimization, authorization, recognize), wie ISO. Die einzige Ausnahme sind diese Rechtsbegriffe aus dem englischen Amtstext des AI Act; sie bleiben wörtlich:
  - authorised representative(s)
  - harmonised standard(s), harmonised rules, harmonised legislation
  - (Union) harmonisation legislation
  - European standardisation organisation(s)
  - standardisation request(s), standardisation deliverable(s)

  Wörter, die immer auf -ise enden (exercise, otherwise, enterprise, expertise, raise), sind davon nicht berührt. Tor G5 prüft das auch in `src/beispiele`. Ergänzungen dieser Liste stehen in `ISE_RECHTSBEGRIFFE` in `scripts/pruefen/stil.mts`.
- **Rollenbegriff im Englischen:** Die Rolle «AIMS-Verantwortliche/r» heisst immer «AIMS lead». «AIMS Manager» mit grossem M ist nur das Werkzeug.
- **Begriffe im Englischen:** «Etappe» des Geführten Modus heisst «phase», das Audit «stage 1» und «stage 2» (am Satzanfang gross). «Massnahme» heisst «action» (Seite und Dokumente «Actions»), «Basisprozess» «base process», «Name, Funktion» «Name, role», «Erklärung zur Anwendbarkeit» «statement of applicability» (klein ausser am Satzanfang), «Textbaustein» «template wording»; «Normtext» ist immer «text of the standard», nie «template wording».
- **Datum:** Deutsch TT.MM.JJJJ, Englisch TT/MM/JJJJ, in Text und Datumszellen. Keine ausgeschriebenen Monate mit Tag, keine Kurzdaten wie 2.8.2026. Monat und Jahr allein («January 2027») sind erlaubt.
- Deutsch ist Leitsprache. Englisch wird fachlich übertragen, nicht wörtlich.

## 4a. Beispielprojekte

`src/beispiele/*.aims.json` sind führend und werden direkt geändert; `src/beispiele/bau/bauen.mts` erzeugt diesen Stand nicht mehr und darf nicht neu laufen. DE und EN bleiben strukturgleich: gleiche Kennungen, Daten, Status und Zahlen, nur der Text ist übersetzt. `tests/unit/stimmigkeit.test.ts` prüft das zusammen mit Datumsketten, Nachweisen, Kennzahlen, Reife und Prüfumfang (`src/regeln/stimmigkeit.ts`). Messwerte der Prozesse werden aus den Aufzeichnungen ausgezählt, mit Zähler, Nenner und Sollvergleich; wo keine Messung möglich ist, steht «noch keine Messung» mit Grund, keine Zahl.

## 5. YAML-Form

- UTF-8, zwei Leerzeichen Einzug, Listen statt Maps, wenn die Reihenfolge zählt.
- Mehrzeilige Texte mit `|` (Absätze durch Leerzeile).
- Inline-Auszeichnung in Texten: `**fett**`, `[[Platzhalter]]` (wird im Dokument gelb hinterlegt).

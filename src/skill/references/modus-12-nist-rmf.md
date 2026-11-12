# Modus 12: NIST AI RMF (nur mit Modul / module only)

## Ziel

Für Firmen, die sich zusätzlich am NIST AI Risk Management Framework (AI RMF 1.0, NIST AI 100-1) ausrichten wollen: ein **Ziel-Profil** festlegen, das **Ist-Profil** aus der Projektdatei ableiten, die **Lücken** priorisieren, die **Zusatz-Controls RMF-xx** in die SoA aufnehmen und Systeme mit generativer KI gegen die **12 Risiken des GenAI-Profils** (NIST AI 600-1) prüfen. Ergebnis: **N-01** (Profil Ist und Ziel), **N-02** (Abdeckung AI RMF und ISO/IEC 42001, Zusammenfassung), **N-04** (generative KI), bei Bedarf **N-03** (Mess- und Prüfkonzept) und die Projektdatei mit `meta.modulNistRmf: true`.

Nur ausführen, wenn das Modul eingeschaltet ist (`meta.modulNistRmf: true` oder Zusage der Person). Sonst einmal fragen, ob es eingeschaltet werden soll, mit dieser Erklärung (DE): «Das Modul NIST AI RMF lohnt sich, wenn US-Kunden, eine US-Konzernmutter oder Kundenfragebögen nach dem AI RMF fragen oder wenn Sie eine Messmethodik für Ihre KI-Systeme wollen. Es ist freiwillig, ergänzt ISO/IEC 42001 und kostet rund 3 bis 5 Personentage zusätzlich.» (EN: «The NIST AI RMF module is worth it if US customers, a US parent company or customer questionnaires ask about the AI RMF, or if you want a measurement method for your AI systems. It is voluntary, complements ISO/IEC 42001 and takes about 3 to 5 person-days extra.»)

Wenn `rmf-subkategorien.md`, `rmf-controls.md` und `genai-profil.md` vorhanden sind (vom Build erzeugt), gelten deren IDs, Kurztitel, Zuordnungen und Vorschlagsbedingungen vorrangig. `genai-sicherheit.md` (GS-01 bis GS-22) gehört zum Kern und gilt auch ohne Modul.

## Was Sie sagen und was nicht

- Das AI RMF ist ein **freiwilliges Rahmenwerk**, kein Recht und keine Norm. **NIST zertifiziert nicht.** Sagen Sie nie «NIST-zertifiziert» oder «NIST-konform». Zulässig ist «ausgerichtet am AI RMF 1.0», belegt durch das Profil N-01.
- ISO/IEC 42001 bleibt das zertifizierbare Managementsystem; das AI RMF ist ein Katalog von Ergebnissen. Das Modul ersetzt keinen Schritt des AIMS.
- Stand: AI RMF 1.0 (26.01.2023) ist massgebend. Eine Überarbeitung ist angekündigt, ohne Entwurf oder Termin (geprüft am 21.10.2026). Nennen Sie das Prüfdatum, wenn Sie über den Stand sprechen.
- Eigene Worte und Zitate: Formulieren Sie Erklärungen in eigenen Worten. Texte von NIST geben Sie nur als gekennzeichnetes Zitat wieder, und zwar wörtlich so, wie sie in `rmf-subkategorien.md` und `genai-profil.md` unter «Original (NIST, wörtlich)» stehen (Englisch, mit Dokument und Seite); die deutsche Fassung kennzeichnen Sie als «Übersetzung KMU-CIO, nicht amtlich». Wo Sie NIST-Inhalte nutzen, gilt der Vermerk «Republished courtesy of the National Institute of Standards and Technology»; die Nennung bedeutet keine Billigung durch NIST.
- OWASP Top 10 for LLM Applications 2026 nur als Verweis (Lizenz CC BY-SA 4.0); keine Texte daraus.

## Ablauf

1. **Anlass und Ziel-Profil erfragen** (Gruppe 1). Anlass bestimmt den Umfang: Kundenfragebogen, US-Kunde oder Konzernvorgabe, Wunsch nach Messmethodik, viel generative KI. Vorschlag für das Ziel: Stufe 2 für alle Subkategorien mit `stufe: lite`, Stufe 2 für `ausbau` nur bei Eigenentwicklung, Anbieterrolle, sicherheitsrelevanter oder personenbezogener Entscheidungs-KI, sonst Stufe 1 oder 0 mit Begründung. Stufe 3 (wirksam) nur, wo der Anlass es verlangt, etwa für die vom Kunden abgefragten Subkategorien.
2. **Ist aus der Projektdatei ableiten** (Regeln unten). Fragen Sie nur nach, was die Datei nicht hergibt. Ohne Projektdatei: Ist grob je Kategorie schätzen und als «Annahme» kennzeichnen.
3. **Lücken** = Ziel über Ist. Priorisieren (hoch: vom Kunden verlangt oder Lücke bei einem System mit hohem Risiko; mittel; tief) und je Lücke eine Massnahme `M-xxx` mit Verantwortung und Termin anlegen (Prüfregel H37).
4. **Zusatz-Controls RMF-xx**: Vorschläge nach `vorschlag_wenn` (in `rmf-controls.md`), je Control Entscheid und Begründung in der SoA. Bei Subkategorien mit `praezisierung` statt Control den Entscheid in `nistProfil[<id>].notiz` festhalten (Prüfregel F27).
5. **GenAI-Check** für jedes System mit `generativ: true`: alle 12 Risiken bewerten (relevant ja/nein mit Begründung, Massnahme oder Control), Prüfregeln F28 und H39. Für Sicherheitsrisiken zusätzlich die Vorschlagsliste GS-01 bis GS-22 nutzen und passende Einträge als Risiken je System aufnehmen (für reine Betreiber meist GS-01, GS-02, GS-03, GS-04, GS-07, GS-09).
6. **Mess- und Prüfkonzept** (N-03) mindestens für freigegebene Systeme mit hohem Risiko: drei bis vier wichtigste Vertrauensmerkmale, Zielkonflikte, Prüfungen mit Prüffällen, Messgrösse, Schwelle, Häufigkeit, bei Nichtmessbarkeit die Begründung, und wer unabhängig überprüft (F29, H40). Bei grossem Umfang anbieten statt sofort ausführen.
7. Tabellen und Projektdatei ausgeben.

## Ist-Stufe aus der Projektdatei

Stufen: 0 nicht erreicht, 1 teilweise, 2 erreicht (festgelegt und angewendet), 3 wirksam (überprüft). Ein Eintrag `nistProfil[<id>].ist` gilt immer vor der Ableitung. Sonst:

- **Dokumente** der Subkategorie (Spalte «Kit» in `rmf-subkategorien.md`; ohne Leitfäden, E-xx nur mit Modul AI Act, D-23 nur mit ISMS): alle freigegeben (`status: "freigegeben"` mit `freigabe.am`) ergibt 2, einige vorhanden 1, keines 0. D-09 zählt als freigegeben, wenn jede aktive Folgenabschätzung eine Freigabe hat.
- **Controls** (A.x.y der Zuordnung und das Zusatz-Control, nur `anwendbar: "ja"`): Status `offen`/`geplant` 0, `teilweise` 1, `umgesetzt` 2, `wirksam` 3; massgebend ist das schwächste. «Umgesetzt» mit offener Massnahme in `umsetzung` zählt als teilweise.
- Kombination: das Tiefere aus Dokumenten und Controls; ohne Controls höchstens 2.
- **Höchstens 1**, wenn Angaben fehlen oder die Lücke offen ist: Kit deckt die Subkategorie nur teilweise ab und das Zusatz-Control ist nicht mindestens umgesetzt (ausser Präzisierung mit Notiz).

Angaben, ohne die eine Subkategorie höchstens 1 erreicht:

| Subkategorie | Angabe in der Projektdatei |
|---|---|
| GV-1.2 | freigegebene Systeme mit `messkonzept.merkmale` |
| GV-1.6 | jedes aktive System mit `eigner` |
| GV-1.7 | Systeme ausser Betrieb oder abgelöst mit `ausserbetrieb.schritteErledigt: true` |
| GV-3.1, MP-1.2 | freigegebene Folgenabschätzungen mit `mitgewirkt` |
| GV-3.2, MP-3.5 | aktive Systeme mit `aufsicht` |
| GV-6.2 | kritische Systeme (`kritisch: true`) mit `rueckfallweg` |
| MG-2.4 | handelnde Systeme (ab `fuehrt-begrenzt-aus`) mit `stoppmoeglichkeit` |
| MP-1.4, MP-3.1 | freigegebene Systeme mit `einsatzentscheid.nutzen` |
| MG-1.1 | dazu `einsatzentscheid.wiedervorlage` |
| MG-2.1 | `einsatzentscheid.alternativeOhneKi` |
| MS-1.1, MS-2.3, MS-4.2 | `messkonzept.pruefungen` mit Messgrösse oder Begründung «nicht messbar», mit Prüffällen, mit Ergebnis |
| MS-2.7 | generative Systeme mit fremden Inhalten oder öffentlich erreichbar: `missbrauchsfaelle` |
| MG-3.2 | eingekaufte und SaaS-Systeme mit `modell.name` und `modell.version` |

## Fragen in Dreiergruppen

**Gruppe 1: Anlass und Ziel**
1. Warum wollen Sie sich am NIST AI RMF ausrichten? Beispiel: «Ein US-Kunde schickt einen Fragebogen dazu.»
2. Welche Teile fragt der Kunde konkret ab, oder sollen alle 72 Subkategorien ins Profil? Beispiel: «Vor allem Inventar, Tests und Lieferanten.»
3. Bis wann brauchen Sie das Profil? Beispiel: «Ende Quartal, mit der Antwort an den Kunden.»

**Gruppe 2: Messen**
4. Welche ein bis zwei Systeme sind am wichtigsten für ein Messkonzept? Beispiel: «Der Kunden-Chatbot.»
5. Wie prüfen Sie diese Systeme heute vor und nach Änderungen? Beispiel: «Gar nicht systematisch.»
6. Wer ausserhalb des Projektteams könnte die Messungen überprüfen? Beispiel: «Die Qualitätsleiterin.»

**Gruppe 3: Generative KI**
7. Welche Systeme erzeugen Texte, Bilder, Code oder Audio? Beispiel: «Copilot und der Chatbot.»
8. Lesen diese Systeme fremde Inhalte (Mails, Webseiten, Kundendokumente) oder sind sie öffentlich erreichbar? Beispiel: «Der Chatbot ist öffentlich.»
9. Kennen Sie Modell und Version und wie der Anbieter Modellwechsel ankündigt? Beispiel: «Nein.»

## Fallback-Listen (wenn die erzeugten Referenzen fehlen)

**Zusatz-Controls (eigene Kurztitel):** RMF-01 Vertrauensmerkmale und Zielkonflikte festlegen; RMF-02 Ausserbetriebnahme geordnet durchführen; RMF-03 Beurteilungen fachübergreifend besetzen; RMF-04 Aufsicht und Eingriff je KI-System festlegen; RMF-05 Rückmeldungen und Einsprüche auswerten; RMF-06 Rechte Dritter bei KI-Bausteinen und Ausgaben prüfen; RMF-07 Abschaltung und Rückfallweg je KI-System; RMF-08 Einsatzentscheid mit Nutzen, Kosten und Alternativen; RMF-09 Prüf- und Messkonzept je KI-System; RMF-10 Messungen unabhängig überprüfen; RMF-11 Gefährdung und sicheres Versagen nachweisen; RMF-12 KI-typische Angriffe prüfen; RMF-13 Ungleichbehandlung messen und begrenzen; RMF-14 Neue und schwer messbare Risiken beobachten; RMF-15 Restrisiken an Nutzende und Abnehmer mitteilen; RMF-16 Modell- und Versionswechsel der Anbieter verfolgen. Nur bei generativer KI: RMF-G01 Erfundene Inhalte vor Verwendung prüfen; RMF-G02 Keine vertraulichen Daten in ungeprüfte KI-Dienste; RMF-G03 Herkunft und Kennzeichnung KI-erzeugter Inhalte; RMF-G04 Schutz vor Prompt-Injection und Werkzeugmissbrauch; RMF-G05 Urheberrecht an Eingaben und Ausgaben beachten; RMF-G06 Schädliche Ausgaben extern genutzter Chatbots verhindern; RMF-G07 Übermässiges Vertrauen in KI-Ausgaben vermeiden.

**12 Risiken generativer KI (Schlüssel für `genaiBewertung`):** `gai-cbrn` Hilfe zu Massenvernichtungswaffen; `gai-konfabulation` erfundene, aber überzeugend wirkende Inhalte; `gai-gefaehrlich` gefährliche, gewaltbezogene oder hetzerische Inhalte; `gai-datenschutz` Abfluss und Rückschluss auf Personendaten; `gai-umwelt` hoher Energie- und Ressourcenverbrauch; `gai-verzerrung` verzerrte oder gleichförmige Ausgaben; `gai-mensch-ki` Übervertrauen, Ablehnung, Vermenschlichung; `gai-integritaet` Falschinformation und Fälschungen; `gai-sicherheit` Angriffe mit und auf generative KI; `gai-schutzrechte` Verletzung von Urheber- und Schutzrechten; `gai-anstoessig` anstössige und missbräuchliche Bildinhalte; `gai-lieferkette` undurchsichtige Bausteine in der Lieferkette.

**Vertrauensmerkmale (Schlüssel):** `gueltig`, `sicher`, `geschuetzt`, `rechenschaft`, `erklaerbar`, `datenschutz`, `fair`.

## Ergebnis

1. **N-01 Profil:** Subkategorie | Kurztitel | Ist | Ziel | Lücke | Priorität | Massnahme | Nachweis. Bei grossem Umfang je Funktion zusammenfassen und nur Lücken einzeln zeigen.
2. **N-02 Zusammenfassung:** Abdeckung durch ISO/IEC 42001 und durch das Kit, Zusatz-Controls mit Entscheid.
3. **N-04 generative KI:** System × 12 Risiken | relevant | Begründung | Massnahme oder Control.
4. Zusatz-Controls als SoA-Einträge, Massnahmen als `massnahmen[]`.
5. Hinweis: «Ausrichtung am NIST AI RMF 1.0 (Stand geprüft am 21.10.2026). Freiwilliges Rahmenwerk; NIST zertifiziert nicht. Republished courtesy of the National Institute of Standards and Technology.»

## JSON-Ausschnitt

```json
"meta": { "modulNistRmf": true },
"nistProfil": {
  "GV-1.6": { "ist": 2, "ziel": 2 },
  "MS-1.1": { "ist": 0, "ziel": 2, "prioritaet": "hoch", "massnahmen": ["M-014"], "notiz": "Kunde fragt nach Testmethodik für den Chatbot." },
  "MS-2.12": { "ziel": 1, "notiz": "Präzisierung: Rechenressourcen in D-10 und Ziel Umwelt in D-09 genügen." }
},
"controls": [
  { "id": "RMF-09", "rahmenwerk": "NISTRMF", "anwendbar": "ja", "begruendung": "Kunden-Chatbot KI-003 ohne festgelegte Prüfungen; Lücke MS-1.1 und MS-2.3.", "status": "geplant", "verantwortlich": "P-002", "nachweise": [], "umsetzung": "Mess- und Prüfkonzept N-03 für KI-003 (M-014)", "iso27001": [], "kiSysteme": ["KI-003"], "vorschlag": "nistrmf" }
]
```

Im KI-System (nur bei `generativ: true`): `"genaiBewertung": { "gai-konfabulation": { "relevant": "ja", "begruendung": "Antworten an Kundschaft", "massnahme": "RMF-G01, Stichprobe wöchentlich (M-015)" }, "gai-cbrn": { "relevant": "nein", "begruendung": "Keine Fachfragen zu gefährlichen Stoffen" } }` mit allen 12 Schlüsseln; dazu `"messkonzept": { "merkmale": ["gueltig", "datenschutz", "geschuetzt"], "pruefungen": [{ "merkmal": "gueltig", "prueffaelle": "20 typische und 5 schwierige Anfragen", "messgroesse": "Anteil korrekter Antworten", "schwelle": "unter 90 % stoppen", "haeufigkeit": "vor Freigabe und nach Modellwechsel" }], "unabhaengig": { "wer": "Qualitätsleiterin", "wann": "jährlich" } }`. Profil-Einträge nur für Subkategorien, zu denen Sie etwas festgelegt haben; ohne `ist` leitet das Werkzeug die Stufe selbst ab.

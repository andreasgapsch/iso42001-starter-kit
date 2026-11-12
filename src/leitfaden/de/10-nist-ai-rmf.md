# 10 NIST AI RMF als Ergänzung

Das **AI Risk Management Framework** (AI RMF) der US-Behörde National Institute of Standards and Technology (NIST) beschreibt, welche Ergebnisse eine Organisation im Umgang mit KI-Risiken erreichen sollte. Das Kit enthält dazu ein zweites optionales Modul neben dem EU AI Act: die Vorlagen N-01 bis N-04 im Ordner `02_Modul_NIST-AI-RMF`, Zusatz-Controls RMF-xx für die Erklärung zur Anwendbarkeit und die drei NIST-Dokumente als PDF im Ordner `Rechtstexte_Legal-Texts/NIST-AI-RMF`.

## Was das AI RMF ist und was nicht

| Das AI RMF ist | Das AI RMF ist nicht |
|---|---|
| ein freiwilliges Rahmenwerk mit 4 Funktionen (GOVERN, MAP, MEASURE, MANAGE), 19 Kategorien und 72 Subkategorien | Recht: Es verpflichtet weder in den USA noch in der Schweiz oder der EU |
| eine Liste von Ergebnissen, die Sie anstreben; den Weg dahin wählen Sie selbst | ein Managementsystem mit festen Kapiteln wie ISO/IEC 42001 |
| eine gemeinsame Sprache, etwa für Fragebögen von US-Kunden | zertifizierbar: NIST zertifiziert nicht, und es gibt kein akkreditiertes Zertifikat |
| stark beim Messen: Vertrauensmerkmale, Tests, Überwachung im Betrieb | eine Konformitätsvermutung für den EU AI Act |

Wer sagt, er richte sich am AI RMF aus, belegt das am besten mit einem **Profil**: Für jede Subkategorie steht, wie weit sie heute umgesetzt ist (Ist-Profil) und wohin Sie wollen (Ziel-Profil). Das ist die Vorlage N-01; der AIMS-Manager leitet das Ist aus Ihrer Projektdatei ab.

## Verhältnis zu ISO/IEC 42001

ISO/IEC 42001 ist das zertifizierbare Managementsystem, das AI RMF ein freiwilliger Katalog von Ergebnissen. Beide passen gut zusammen, denn viele Subkategorien beschreiben, was ein AIMS ohnehin verlangt. Das Kit ordnet jede Subkategorie den Abschnitten und Controls der ISO/IEC 42001 und den eigenen Vorlagen zu (N-02). Die Zuordnung ist eine fachliche Einschätzung des Kits. Abgeglichen wurde sie mit einem Crosswalk eines Dritten, den NIST auf seiner Website listet; Fehler darin sind korrigiert, seine Tabellen nicht übernommen.

<!-- abb:nist -->

<!-- nistbilanz -->

Die Vorlagen gehen an mehreren Stellen über die Norm hinaus, etwa mit Einsatzentscheid, Einspruch und Ausserbetriebnahme. Offen bleibt ohne Modul vor allem das Messen: welche Vertrauensmerkmale je System zählen, wie Sie sie prüfen und wer unabhängig überprüft (N-03).

## Wann sich das Modul lohnt

- Ihre Kundschaft oder Ihre Konzernmutter sitzt in den USA und nennt das AI RMF.
- Kundenfragebögen, Ausschreibungen oder Lieferantenaudits fragen danach.
- Sie wollen eine Messmethodik für Ihre KI-Systeme: was gemessen wird, ab welcher Schwelle Sie handeln und wer unabhängig prüft.
- Sie setzen viel generative KI ein und wollen die Risiken je System strukturiert bewerten (N-04).

Ohne einen dieser Gründe genügt das Kit ohne Modul. Mit Modul rechnen Sie mit rund **3 bis 5 PT** zusätzlich, vor allem für Profil, Messkonzept der wichtigsten Systeme und die Bewertung generativer KI. Sie schalten das Modul im Startinterview des AIMS-Managers ein; die zusätzlichen Seiten erscheinen in den bestehenden Etappen. Im KI-Assistenten gibt es dafür Modus 12.

## Stand und Revision

<!-- niststand -->

## Das GenAI-Profil NIST AI 600-1

NIST AI 600-1 ist ein Profil zum AI RMF 1.0 für generative KI. Es nennt 12 Risiken, die generative KI neu bringt oder verstärkt, und schlägt je Subkategorie Massnahmen vor. Viele davon richten sich an Entwickler grosser Modelle. Für KMU, die eingekaufte generative KI nutzen, zählen vor allem erfundene, aber überzeugend wirkende Inhalte (im Profil «Konfabulation»), Abfluss von Personendaten, Übervertrauen, Angriffe wie Prompt-Injection, Schutzrechte und undurchsichtige Bausteine in der Lieferkette. N-04 bewertet die 12 Risiken je System mit generativer KI; die Kurztitel sind eigene Formulierungen des Kits.

<!-- nistgenai -->

## Quellen und Nutzungsrecht

Die NIST-Dokumente (DOI in der Tabelle oben) sind Werke der US-Regierung und in den USA gemeinfrei; ausserhalb der USA erlaubt NIST Nachdruck und Bearbeitung unentgeltlich. Das Kit zitiert die Funktionen, Kategorien und Subkategorien, die Vertrauensmerkmale, die zwölf Risiken generativer KI und die Massnahmen aus NIST AI 600-1, auf die sich die Zusatz-Controls stützen, wörtlich auf Englisch mit Seitenangabe (im Werkzeug, in N-01, N-02 und N-04 und im KI-Assistenten). Dazu kommt eine eigene, sinngetreue Übersetzung, gekennzeichnet als «Übersetzung KMU-CIO, nicht amtlich»; massgebend ist der englische Text. Kurztitel und Erläuterungen sind eigene Formulierungen, die PDFs liegen unverändert bei. Wo das Kit NIST-Inhalte nutzt, gilt der Vermerk: «Republished courtesy of the National Institute of Standards and Technology». Die Nennung bedeutet keine Billigung durch NIST.

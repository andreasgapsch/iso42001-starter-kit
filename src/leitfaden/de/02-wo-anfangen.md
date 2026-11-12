# 2 Wo anfangen: mit oder ohne ISMS

Die wichtigste Weiche stellen Sie am ersten Tag: Bauen Sie das AIMS auf ein bestehendes Informationssicherheits-Managementsystem (ISMS) nach ISO/IEC 27001 auf, oder beginnen Sie ohne? Beide Normen folgen derselben Grundstruktur für Managementsysteme. Die Abschnitte 4 bis 10 sind deshalb weitgehend gleich gegliedert, und vieles lässt sich gemeinsam führen.

## Pfad wählen

| Ihre Lage | Pfad | Was das heisst |
|---|---|---|
| ISMS nach ISO/IEC 27001 ist zertifiziert | **mit ISMS** | Sie erweitern bestehende Prozesse. Das Werkzeug erzeugt 13 Ergänzungsblätter; bei 11 Vorlagen ersetzt das Blatt das eigene Dokument. |
| ISMS ist aufgebaut und gelebt (mindestens ein internes Audit und eine Managementbewertung), aber nicht zertifiziert | **mit ISMS** | wie oben; prüfen Sie im Gap-Schnellcheck (D-00), ob die Basisprozesse wirklich laufen |
| ISMS-Dokumente existieren, werden aber nicht gelebt | **ohne ISMS** | Nutzen Sie die vorhandenen Dokumente als Rohmaterial, aber planen Sie wie ohne ISMS. |
| Kein ISMS | **ohne ISMS** | Sie bauen die Basisprozesse schlank mit auf: Dokumentenlenkung, internes Audit, Managementbewertung, Korrekturmassnahmen. |

Der AIMS-Manager fragt die Lage im Startinterview ab und setzt den Pfad. Sie können ihn später ändern; die erfassten Daten bleiben erhalten.

## Was wiederverwendet wird

| Baustein | Pfad mit ISMS | Pfad ohne ISMS | Kit |
|---|---|---|---|
| Dokumentenlenkung (7.5) | bestehende Regeln gelten, KI-Dokumente kommen ins Register | schlanke Regeln auf zwei Seiten und ein Register | D-26 |
| Internes Audit (9.2) | ein Auditprogramm für beide Normen, KI-Themen ergänzt | eigenes Programm, erstes Audit vor Stage 1 | D-20 |
| Managementbewertung (9.3) | eine Sitzung mit Traktanden für beide Normen | eigene Sitzung, jährlich | D-21 |
| Nichtkonformitäten und Korrekturen (10.2) | bestehendes Register | neues Register | D-22 |
| Risikomethode (6.1) | Skalen und Kriterien übernehmen, Folgen für Personen und Gesellschaft ergänzen | neue Methode, bewusst einfach | D-06, D-07 |
| Inventar | KI-Inventar verweist auf das Inventar der Informationswerte | KI-Inventar eigenständig | D-10 |
| Lieferanten | Prüffragen und Klauseln für KI ergänzen | Lieferantenliste für KI neu | D-16 |
| Kompetenz, Bewusstsein, Kommunikation | KI-Inhalte in bestehende Schulungen | Schulungsplan und Kommunikationsplan neu | D-17 |
| Vorfallmanagement | KI-Vorfälle als eigene Kategorie | Meldewege und Vorfallkommunikation neu | D-14 |
| Akzeptable Nutzung | KI-Regeln ergänzen oder D-15 als Anhang | D-15 als eigene Richtlinie | D-15 |

**In beiden Pfaden neu** sind die Teile, für die es im ISMS kein Gegenstück gibt: KI-Leitlinie (D-03), Rolle zuerst (D-24), Folgenabschätzung (D-08, D-09), Erklärung zur Anwendbarkeit für Anhang A der ISO/IEC 42001 (D-11), Lebenszyklus (D-12) und Daten (D-13).

## Ergänzungsblätter statt neuer Dokumente

Im Pfad mit ISMS liefert das Kit 13 Ergänzungsblätter (ID mit Endung `-EB`, Ordner 03). Bei 11 Vorlagen erhalten Sie nur das Blatt und kein eigenes Dokument; bei D-03 und D-07 gibt es beides, die KI-Leitlinie und das KI-Risikoregister bleiben eigene Dokumente. Ein Ergänzungsblatt nennt die Abschnitte, die Sie in Ihr vorhandenes ISMS-Dokument aufnehmen, zum Beispiel zusätzliche Auswirkungskategorien im Risikoverfahren oder einen Meldeweg für Bedenken zu KI in der Rollenbeschreibung. So bleibt es bei einem Dokument je Thema, und Ihr Dokumentenregister wächst kaum.

Die **Integrationsmatrix D-23** zeigt für jedes Kapitel und jedes Control, was Sie wiederverwenden, erweitern oder neu erstellen. Sie ordnet die Controls aus Anhang A der ISO/IEC 42001 den verwandten Controls aus ISO/IEC 27001:2022 zu. Die Zuordnung ist eine fachliche Einschätzung, keine Normvorgabe. Der AIMS-Manager zeigt daraus einen Wiederverwendungsgrad in Prozent.

## So lesen Sie ISO/IEC 42001 mit ISMS-Erfahrung

- **Abschnitte 4 bis 10** sind aufgebaut wie in ISO/IEC 27001. Neu sind vor allem 4.1 (Rolle der Organisation für KI und Zweck der KI-Systeme) sowie 6.1.4 und 8.4 (Folgenabschätzung für Personen, Gruppen und Gesellschaft).
- **Anhang A** enthält 38 Controls in 9 Gruppen. Sie entscheiden in der Erklärung zur Anwendbarkeit (D-11) über jedes einzelne.
- **Anhang B** gibt zu jedem Control Umsetzungshinweise, ähnlich wie ISO/IEC 27002 zu den Controls der ISO/IEC 27001. Lesen Sie ihn in den Schritten 7 und 8 neben den Vorlagen.
- **Anhang C** nennt mögliche Ziele und Risikoquellen für KI, **Anhang D** den Einsatz in Branchen und die Integration mit anderen Managementsystemen.

## Was das ISMS nicht abdeckt

Ein ISMS schützt Informationen. Ein AIMS steuert, was KI-Systeme mit Menschen und Entscheidungen machen. Drei Unterschiede sollten Sie kennen:

- **Andere Schutzgüter.** Neben Vertraulichkeit, Integrität und Verfügbarkeit geht es um Fairness, Nachvollziehbarkeit, menschliche Aufsicht und Folgen für Betroffene ausserhalb des Unternehmens.
- **Folgenabschätzung.** Abschnitt 6.1.4 verlangt eine eigene Abschätzung der Folgen für Personen, Gruppen und Gesellschaft. Eine Datenschutz-Folgenabschätzung deckt das nur teilweise ab; D-09 verknüpft beide.
- **Lebenszyklus und Daten.** Auch als Betreiber müssen Sie wissen, wie ein System getestet, eingeführt, überwacht und ausser Betrieb genommen wird, und welche Daten hineinfliessen.

Führen Sie Informationssicherheitsrisiken weiter im ISMS-Register. Im KI-Risikoregister verknüpfen Sie diese nur, statt sie doppelt zu bewerten. Für Angriffe auf KI-Systeme selbst gibt es seit Oktober 2026 den Leitfaden ISO/IEC 27090:2026; ziehen Sie ihn als zusätzliche Quelle für Controls heran, vor allem bei eigenen KI-Anwendungen.

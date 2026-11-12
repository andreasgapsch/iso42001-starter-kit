// Löschen mit Abhängigkeitsanzeige (AF-009): Verweisen andere Einträge auf den zu löschenden, zeigt der Dialog (V-18) sie mit
// Kennung und Bezeichnung (höchstens acht, Rest als Zahl, W3) und bietet «Verweise entfernen und löschen» oder «Abbrechen».
// Ohne Abhängigkeiten bleibt es bei der bisherigen Rückfrage. Gelöscht wird über eintragLoeschen (Verweise mit, Zähler, AF-010),
// aufgerufen von eintragEntfernen (Listen) oder eigenenProzessLoeschen (eigene Prozesse).
import { t } from '../i18n.ts';
import { eintragBezeichnung, istLoeschListe, loeschVorschau, type AbhaengigGruppe } from '../logik/eintraege.ts';
import { projekt } from '../zustand/store.ts';
import { bestaetigen } from '../zustand/bestaetigen.ts';

function gruppeText(g: AbhaengigGruppe): string {
  const kopf = g.quelleId ?? t(`loeschen.bereich_${g.wurzel}`);
  return g.name && g.name !== g.quelleId ? `${kopf} ${g.name}` : kopf;
}

export function LoeschKnopf(props: {
  liste: string;
  id: string;
  /** Text des Knopfs und der einfachen Rückfrage ohne Abhängigkeiten */
  text: string;
  frage: string;
  klasse?: string;
  /** id des Knopfs (Tests, Sprungziele) */
  knopfId?: string;
  /** Löscht den Eintrag samt Verweisen (eintragEntfernen) und führt Folgeschritte aus */
  entfernen: () => void;
}) {
  // V-18 (A-12): eine Dialogart. Der Titel nennt Handlung und Gegenstand («KI-002 «Übersetzer» löschen?»); mit Verweisen
  // stehen sie als Liste im selben Dialog (Bestaetigen.tsx), nicht mehr in einem eigenen Löschdialog.
  const klick = async () => {
    const p = projekt.value;
    const v = p && istLoeschListe(props.liste) ? loeschVorschau(p, props.liste, props.id) : null;
    const name = p && istLoeschListe(props.liste) ? eintragBezeichnung(p, props.liste, props.id) : '';
    const titel = name && name !== props.id ? t('loeschen.titel_name', { eintrag: props.id, name }) : t('loeschen.titel', { eintrag: props.id });
    if (!p || !v || v.verweise === 0) {
      if (await bestaetigen({ titel, text: props.frage, ja: props.text, gefahr: true })) props.entfernen();
      return;
    }
    const inhalt = (
      <>
        <ul class="bestaetigen-liste">
          {v.gruppen.map((g) => (
            <li key={`${g.wurzel}|${g.quelleId ?? ''}`}>
              {gruppeText(g)}
              {g.anzahl > 1 && ` (${t('loeschen.verweise', { anzahl: g.anzahl })})`}
              {g.mitGeloescht && <> <em>{t('loeschen.mitgeloescht')}</em></>}
              {g.endstatus && <> <strong>{t('loeschen.endstatus')}</strong></>}
            </li>
          ))}
        </ul>
        {v.weitere > 0 && <p>{t('loeschen.weitere', { anzahl: v.weitere })}</p>}
      </>
    );
    if (await bestaetigen({ titel, text: t('loeschen.abhaengig', { anzahl: v.eintraege }), inhalt, ja: t('loeschen.verweise_entfernen'), gefahr: true })) props.entfernen();
  };
  return (
    <button type="button" class={props.klasse ?? 'gefahr'} {...(props.knopfId ? { id: props.knopfId } : {})} onClick={() => void klick()}>{props.text}</button>
  );
}

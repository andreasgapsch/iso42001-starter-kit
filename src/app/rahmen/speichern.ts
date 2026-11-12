// Speichern der Projektdatei (Kopf, Projekt-Kachel, Ctrl+S): Stelle im Guide mitspeichern, Meldung über aria-live.
import { appDaten } from '../daten.ts';
import { t } from '../i18n.ts';
import { stelleMerken } from '../ansichten/gefuehrt/aktionen.ts';
import { herunterladen } from '../worker/client.ts';
import { ExternGeaendertFehler, NurLesendFehler } from '../speicher/projekt-speicher.ts';
import { beispielUnveraendert, browserspeicherLeeren, holeSpeicher, melde, migrationsSicherung, navigiere, nurLesen, projekt, route, SpeicherPruefFehler, ungespeichert, zustand } from '../zustand/store.ts';
import { rohtextVon } from '../speicher/technik.ts';
import { signal } from '@preact/signals';
import { bestaetigen } from '../zustand/bestaetigen.ts';

/** V-05: Speichern läuft (Knopf im Seitenkopf zeigt Beschäftigt); ein zweiter Aufruf in dieser Zeit löst nichts aus */
export const speichertGerade = signal(false);

export async function speichern(unter = false): Promise<void> {
  if (speichertGerade.value) return;
  speichertGerade.value = true;
  try {
    await speichernJetzt(unter);
  } finally {
    speichertGerade.value = false;
  }
}

async function speichernJetzt(unter: boolean): Promise<void> {
  // Nur lesend geöffnet (Datei aus neuerer Version, AF-005): nichts wird geschrieben
  if (nurLesen.value) {
    melde(t('laden.nur_lesen_gesperrt'), 'info', MELDUNG_LANG);
    return;
  }
  try {
    // Datei wurde beim Öffnen migriert und wird gleich überschrieben: zuerst die Sicherung anbieten (AF-004)
    // OK legt die Sicherung ab und speichert danach; Abbrechen speichert nichts. Ohne Sicherung weiter: Knopf im Hinweis.
    if (migrationsSicherung.value && !unter && holeSpeicher().status.direkt) {
      if (!(await bestaetigen({ text: t('laden.sicherung_vor_speichern', { name: migrationsSicherung.value.name }), titel: t('bestaetigen.titel_sicherung_speichern'), ja: t('bestaetigen.sicherung_speichern') }))) {
        melde(t('laden.sicherung_nicht_gespeichert'), 'info', MELDUNG_LANG);
        return;
      }
      await sicherungAblegen();
      // Auswahl abgebrochen oder Schreiben gescheitert: das Original bleibt unberührt
      if (migrationsSicherung.value) return;
    }
    // Stelle im Guide mitspeichern: nach dem Öffnen führt «Weitermachen» auf dieselbe Seite
    const ort = route.value;
    if (ort.art === 'gefuehrt' && ort.etappe) {
      const seite = ort.seite ?? appDaten().gefuehrt.etappen.etappen.find((e) => e.id === ort.etappe)?.seiten[0];
      if (seite) stelleMerken(ort.etappe, seite);
    }
    const s = holeSpeicher();
    const r = await (unter ? s.speichernUnter() : s.speichern());
    if (r) melde(t(r.art === 'datei' ? 'kopf.gespeichert_datei' : 'kopf.gespeichert_download', { name: r.name }), 'ok');
  } catch (e) {
    if (e instanceof ExternGeaendertFehler) return nachExternerAenderung(e.dateiname);
    if (e instanceof SpeicherPruefFehler) return nachPruefFehler(e);
    if (e instanceof NurLesendFehler) return melde(t('laden.nur_lesen_gesperrt'), 'info', MELDUNG_LANG);
    melde(`${t('kopf.speichern_fehler')}: ${schreibfehlerText(e)}`, 'fehler', MELDUNG_LANG);
  }
}

const MELDUNG_LANG = 30_000;

/** Rohtext des Browsers nur als Technikzeile: Die Meldung sagt, was zu tun ist (C2-15) */
function schreibfehlerText(e: unknown): string {
  const { name: art, roh } = rohtextVon(e);
  if (art === 'NoModificationAllowedError' || art === 'NotAllowedError' || /verweigert/.test(roh)) return t('kopf.schreibfehler_recht');
  if (art === 'QuotaExceededError') return t('kopf.schreibfehler_voll');
  return t('kopf.schreibfehler_allgemein');
}

/** Datei wurde ausserhalb geändert: nie ohne Rückfrage überschreiben; der sichere Weg ist ein neuer Dateiname */
async function nachExternerAenderung(name: string): Promise<void> {
  if (!(await bestaetigen({ text: t('kopf.extern_frage', { name }), titel: t('bestaetigen.titel_neuer_name'), ja: t('bestaetigen.neuer_name') }))) {
    melde(t('kopf.extern_abbruch', { name }), 'fehler', MELDUNG_LANG);
    return;
  }
  await speichernJetzt(true);
}

/** Prüfung vor dem Speichern schlägt an: Änderungen zeigen und fragen, Original nicht überschreiben; sonst Rettungsdatei */
async function nachPruefFehler(e: SpeicherPruefFehler): Promise<void> {
  if (e.reparatur) {
    const liste = e.reparatur.aenderungen.join('\n');
    if (!(await bestaetigen({ text: `${t('kopf.repariert_frage')}\n\n${liste}`, titel: t('bestaetigen.titel_geaendert_speichern'), ja: t('bestaetigen.geaendert_speichern') }))) {
      melde(`${t('kopf.repariert_abbruch')}\n${e.details.join('\n')}`, 'fehler', MELDUNG_LANG);
      return;
    }
    zustand.laden(e.reparatur.projekt, true);
    const s = holeSpeicher();
    s.aendern(e.reparatur.projekt);
    try {
      const r = await s.speichernUnter();
      // Die Meldung nennt das Geänderte und bleibt lange stehen; sie wird nicht durch «Gespeichert» ersetzt
      if (r) melde(`${t('kopf.repariert')}\n${liste}`, 'info', MELDUNG_LANG);
    } catch (x) {
      melde(`${t('kopf.speichern_fehler')}: ${schreibfehlerText(x)}`, 'fehler', MELDUNG_LANG);
    }
    return;
  }
  // Nie eine Datei schreiben, die sich nicht mehr öffnen lässt; die Daten gehen aber nicht verloren
  const name = `AIMS-Rettung_${new Date().toISOString().slice(0, 10)}.rettung.json`;
  herunterladen(e.roh, name, 'application/json');
  melde(`${t('kopf.rettung', { name })}\n${e.details.join('\n')}`, 'fehler', MELDUNG_LANG);
}

/** Sicherung der Datei vor der Migration ablegen (Download oder «Speichern unter»); danach ist der Hinweis erledigt (AF-004) */
export async function sicherungAblegen(): Promise<void> {
  const sicherung = migrationsSicherung.value;
  if (!sicherung) return;
  try {
    const r = await holeSpeicher().sicherungAblegen(sicherung);
    if (!r) return;
    migrationsSicherung.value = null;
    melde(t('laden.sicherung_abgelegt', { name: r.name }), 'ok', MELDUNG_LANG);
  } catch (e) {
    melde(`${t('kopf.speichern_fehler')}: ${schreibfehlerText(e)}`, 'fehler', MELDUNG_LANG);
  }
}

/**
 * Arbeit beenden (AF-032): das Projekt schliessen und vorschlagen, den Zwischenspeicher des Browsers zu leeren, etwa auf einem
 * gemeinsam genutzten Rechner. Ungespeicherte Änderungen gehen nur nach Rückfrage verloren; ohne Leeren bleibt ein Zwischenstand.
 */
export async function beenden(): Promise<void> {
  if (projekt.value && ungespeichert.value && !beispielUnveraendert.value && !nurLesen.value && !(await bestaetigen({ text: t('beenden.ungespeichert'), titel: t('bestaetigen.titel_ohne_speichern_beenden'), ja: t('bestaetigen.ohne_speichern_beenden'), gefahr: true }))) return;
  const leeren = await bestaetigen({ text: t('beenden.leeren_frage'), titel: t('bestaetigen.titel_speicher_leeren'), ja: t('bestaetigen.speicher_leeren'), nein: t('bestaetigen.nicht_leeren'), gefahr: true });
  const s = holeSpeicher();
  try {
    await s.schliessen({ sichern: !leeren });
    zustand.laden(null);
    migrationsSicherung.value = null;
    if (leeren) {
      await browserspeicherLeeren();
      melde(t('beenden.geleert'), 'ok');
    } else melde(t('beenden.beendet'), 'info');
  } catch (e) {
    melde(`${t('kopf.speichern_fehler')}: ${schreibfehlerText(e)}`, 'fehler', MELDUNG_LANG);
  }
  navigiere({ art: 'start' });
}

// Profil NIST AI RMF (Projekt.nistProfil): 72 Subkategorien nach Funktion gruppiert, Ist und Ziel 0 bis 3, Priorität,
// Massnahmen und Notiz; Ist-Vorschlag aus der Projektdatei. Seitentyp «nist-profil» (E12-rmf-profil, J-rmf) und
// Formularmodul «NIST AI RMF». Optional mit dem Stand der Fassung (Jahreskalender). Je Funktion und Subkategorie aufklappbar
// der Originaltext NIST mit Übersetzung (NistZitat.tsx).
import { Symbol } from '../../rahmen/symbole.tsx';
import { useState } from 'preact/hooks';
import type { NistStand, NistSubkategorie } from '../../../kataloge/typen.ts';
import type { NistProfilEintrag, Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { datumText, inhalt, optionText, t, zahlText } from '../../i18n.ts';
import { funktionMittel, funktionStand, istVorschlag, luecke, standVeraltet, vorschlagGruende } from '../../logik/nistrmf.ts';
import { Hantel } from '../../../grafik/preact/Diagramme.tsx';
import { STUFEN, type Stufe } from '../../../nist-rmf/logik.ts';
import { routeZuHash } from '../../logik/routen.ts';
import { RichText } from '../../ui/RichText.tsx';
import { aendereMit, melde, stichtag } from '../../zustand/store.ts';
import { NistOriginal } from '../formular/NistZitat.tsx';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

const PRIORITAETEN = ['hoch', 'mittel', 'tief'];

function kern() {
  return appDaten().kataloge.nistrmf_subkategorien;
}

/** Name der Funktion ohne Doppelung (U-31): im Englischen gleicht der Titel dem Kürzel («GOVERN Govern») und entfällt */
export function funktionsName(kuerzel: string, id: string): string {
  const titel = inhalt(`nist.funktionen.${id}.titel`) ?? '';
  return titel.toUpperCase() === kuerzel.toUpperCase() ? '' : titel;
}

export function nistStand(): NistStand | undefined {
  return appDaten().kataloge.nistrmf_stand;
}

/** Eintrag im Profil setzen; leere Einträge entfallen. */
function setzeProfil(id: string, teil: Partial<NistProfilEintrag>): void {
  aendereMit((p) => {
    const profil = { ...(p.nistProfil ?? {}) };
    const neu: NistProfilEintrag = { ...(profil[id] ?? {}), ...teil };
    for (const k of Object.keys(neu) as (keyof NistProfilEintrag)[]) {
      const w = neu[k];
      if (w === undefined || w === '' || (Array.isArray(w) && w.length === 0)) delete neu[k];
    }
    if (Object.keys(neu).length) profil[id] = neu;
    else delete profil[id];
    p.nistProfil = profil;
  });
}

/** Ist-Vorschlag für alle Subkategorien ohne Ist übernehmen. Liefert die Anzahl. */
export function istVorschlaegeUebernehmen(p: Projekt, subkategorien: readonly NistSubkategorie[]): number {
  const k = appDaten().kataloge;
  const neu = subkategorien.filter((s) => p.nistProfil?.[s.id]?.ist === undefined).map((s) => [s.id, istVorschlag(p, k, s).stufe] as const);
  aendereMit((x) => {
    const profil = { ...(x.nistProfil ?? {}) };
    for (const [id, stufe] of neu) profil[id] = { ...(profil[id] ?? {}), ist: stufe };
    x.nistProfil = profil;
  });
  return neu.length;
}

function StufeWahl({ id, wert, setze, label }: { id: string; wert: Stufe | undefined; setze: (v: Stufe | undefined) => void; label: string }) {
  return (
    <Auswahl id={id} aria-label={label} value={wert === undefined ? '' : String(wert)} onChange={(e) => setze(e.currentTarget.value === '' ? undefined : (Number(e.currentTarget.value) as Stufe))}>
      <option value="">{t('nist.stufe_leer')}</option>
      {STUFEN.map((s) => <option key={s} value={String(s)}>{t(`nist.stufe.${s}`)}</option>)}
    </Auswahl>
  );
}

function MassnahmenWahl({ p, id, wert, setze, label }: { p: Projekt; id: string; wert: string[]; setze: (v: string[]) => void; label: string }) {
  const frei = p.massnahmen.filter((m) => !wert.includes(m.id));
  return (
    <div class="leiste" style={{ gap: '4px' }}>
      {wert.map((m) => (
        <StatusPille art="neutral" key={m}>
          {m}{' '}
          <button type="button" class="leise klein" aria-label={t('nist.massnahme_entfernen', { id: m, subkategorie: label })} onClick={() => setze(wert.filter((x) => x !== m))}><Symbol name="schliessen" klasse="sym sym-text" /></button>
        </StatusPille>
      ))}
      {frei.length > 0 && (
        <Auswahl id={id} aria-label={`${t('nist.spalte.massnahmen')}: ${label}`} value="" onChange={(e) => e.currentTarget.value && setze([...wert, e.currentTarget.value])} style={{ maxWidth: '12rem' }}>
          <option value="">{t('nist.massnahme_wahl')}</option>
          {frei.map((m) => <option key={m.id} value={m.id}>{m.id} {m.titel}</option>)}
        </Auswahl>
      )}
    </div>
  );
}

function Zeile({ p, s }: { p: Projekt; s: NistSubkategorie }) {
  const e = p.nistProfil?.[s.id];
  const titel = inhalt(`nist.subkategorien.${s.id}.titel`) ?? s.id;
  const v = istVorschlag(p, appDaten().kataloge, s);
  const gruende = vorschlagGruende(v, { angabenFehlen: t('nist.angaben_fehlen'), luecke: t('nist.luecke_kit') });
  const basis = `nist-${s.id}`.replace(/\./g, '_');
  const name = `${s.id} ${titel}`;
  return (
    <tr id={basis} class={luecke(e) && !(e?.massnahmen ?? []).length ? 'luecke' : undefined}>
      <th scope="row">
        <span class="marke-id">{s.id}</span> {titel}
        <br />
        <span class="zweitext">
          {t('nist.abdeckung', { abdeckung: inhalt(`nist.werte.abdeckung.${s.abdeckung_kit}`) ?? s.abdeckung_kit })}
          {s.kit.length > 0 && ` · ${s.kit.join(', ')}`}
          {s.zusatz_control && ` · ${s.zusatz_control}`}
        </span>
        <NistOriginal art="subkategorie" id={s.id} />
      </th>
      <td>
        <StufeWahl id={`${basis}-ist`} wert={e?.ist} setze={(w) => setzeProfil(s.id, { ist: w })} label={`${t('nist.spalte.ist')}: ${name}`} />
        {e?.ist !== v.stufe && (
          <button type="button" class="leise klein" id={`${basis}-vorschlag`} title={gruende || t('nist.vorschlag_ohne')} onClick={() => setzeProfil(s.id, { ist: v.stufe })}>
            {t('nist.vorschlag', { stufe: v.stufe })}
          </button>
        )}
      </td>
      <td><StufeWahl id={`${basis}-ziel`} wert={e?.ziel} setze={(w) => setzeProfil(s.id, { ziel: w })} label={`${t('nist.spalte.ziel')}: ${name}`} /></td>
      <td>
        <Auswahl id={`${basis}-prioritaet`} aria-label={`${t('nist.spalte.prioritaet')}: ${name}`} value={e?.prioritaet ?? ''} onChange={(x) => setzeProfil(s.id, { prioritaet: x.currentTarget.value || undefined })}>
          <option value="">{t('nist.stufe_leer')}</option>
          {PRIORITAETEN.map((w) => <option key={w} value={w}>{optionText('prioritaet', w)}</option>)}
        </Auswahl>
      </td>
      <td><MassnahmenWahl p={p} id={`${basis}-massnahmen`} wert={e?.massnahmen ?? []} setze={(w) => setzeProfil(s.id, { massnahmen: w })} label={name} /></td>
      <td><input type="text" id={`${basis}-notiz`} aria-label={`${t('nist.spalte.notiz')}: ${name}`} value={e?.notiz ?? ''} onInput={(x) => setzeProfil(s.id, { notiz: x.currentTarget.value })} /></td>
    </tr>
  );
}

export function NistStandAnzeige() {
  const stand = nistStand();
  if (!stand) return null;
  const veraltet = standVeraltet(stand, stichtag.value);
  return (
    <section class="karte abschnitt" id="nist-stand">
      <h2>{inhalt('nist.stand.modul') ?? 'NIST AI RMF'}</h2>
      <p>{t('nist.stand_text', { geprueft: datumText(stand.geprueft_am), naechste: datumText(stand.naechste_pruefung) })}</p>
      {veraltet && <Hinweis als="p" art="warnung">{inhalt('nist.stand.veraltet', { datum: datumText(stand.geprueft_am) })}</Hinweis>}
      <RichText text={inhalt('nist.stand.revision')} />
      <ul>
        {stand.fassungen.map((f) => <li key={f.id}>{inhalt(`nist.stand.fassungen.${f.id}`) ?? f.dokument}</li>)}
      </ul>
      <p class="zweitext">{inhalt('nist.stand.botschaft')}</p>
    </section>
  );
}

/** Hantel Ist/Ziel je Funktion (Mittel der Stufen 0 bis 3), mit Tabelle als Textalternative. */
function ProfilHantel({ p }: { p: Projekt }) {
  const k = kern();
  if (!k) return null;
  const zahl = (n: number | null) => (n === null ? t('grafik.hantel_leer') : zahlText(n, 1));
  const zeilen = k.funktionen.map((f) => ({ titel: f.nist_id, ...funktionMittel(p, k.subkategorien, f.id) }));
  const beschreibung = t('grafik.hantel_beschreibung', { zeilen: zeilen.map((z) => t('grafik.hantel_zeile', { funktion: z.titel, ist: zahl(z.ist), ziel: zahl(z.ziel) })).join('; ') });
  return (
    <section class="karte abschnitt" id="nist-hantel" aria-labelledby="nist-hantel-titel">
      <h2 id="nist-hantel-titel">{t('grafik.hantel_titel')}</h2>
      <Hantel id="nist-hantel-grafik" zeilen={zeilen} titelSichtbar={false}
        texte={{ titel: t('grafik.hantel_titel'), beschreibung, stufen: [0, 1, 2, 3].map((s) => t(`nist.stufe.${s}`).replace(/^\d\s*/, '')), wert: (z) => t('grafik.hantel_wert', { ist: zahl(z.ist), ziel: zahl(z.ziel) }) }}
        tabelle={{ zusammenfassung: t('grafik.werte_tabelle'), kopf: [t('grafik.hantel_kopf_funktion'), t('nist.spalte.ist'), t('nist.spalte.ziel')], zahl }} />
      <p class="zweitext">{t('grafik.hantel_legende')}</p>
    </section>
  );
}

/** fokus: Subkategorie aus einem Sprung der Prüfung (F27, H37); deren Funktion ist geöffnet. */
export function NistProfil({ p, mitStand, fokus }: { p: Projekt; mitStand?: boolean; fokus?: string }) {
  const k = kern();
  const [offen, setOffen] = useState<string | null>(() => k?.subkategorien.find((s) => s.id === fokus)?.funktion ?? null);
  if (!k) return <p class="ersatz">{t('nist.katalog_fehlt')}</p>;
  const ohneIst = k.subkategorien.filter((s) => p.nistProfil?.[s.id]?.ist === undefined).length;
  return (
    <div id="nist-profil">
      {mitStand && <NistStandAnzeige />}
      <p class="zweitext">{t('nist.profil_text')}</p>
      <p class="leiste">
        {ohneIst > 0 ? (
          <button type="button" id="nist-vorschlaege" onClick={() => melde(t('nist.vorschlaege_uebernommen', { anzahl: istVorschlaegeUebernehmen(p, k.subkategorien) }), 'ok')}>
            {t('nist.vorschlaege_uebernehmen', { anzahl: ohneIst })}
          </button>
        ) : (
          <span class="zweitext">{t('nist.alle_mit_ist')}</span>
        )}
      </p>
      <ProfilHantel p={p} />
      {k.funktionen.map((f) => {
        const st = funktionStand(p, k.subkategorien, f.id);
        const zeilen = k.subkategorien.filter((s) => s.funktion === f.id);
        const auf = offen === f.id;
        return (
          <details class="karte abschnitt" key={f.id} id={`nist-funktion-${f.id}`} open={auf} onToggle={(e) => {
            const jetzt = (e.currentTarget as HTMLDetailsElement).open;
            if (jetzt !== auf) setOffen(jetzt ? f.id : null);
          }}>
            <summary>
              <strong>{f.nist_id}</strong> {funktionsName(f.nist_id, f.id)} ·{' '}
              <span class="zweitext">{t('nist.funktion_stand', { bewertet: st.bewertet, gesamt: st.gesamt, luecken: st.luecken, ohne: st.ohneMassnahme })}</span>
            </summary>
            <p class="zweitext">{inhalt(`nist.funktionen.${f.id}.kurz`) ?? ''}</p>
            <NistOriginal art="funktion" id={f.id} />
            {auf && (
              <div class="tabelle-feld">
                <table>
                  <caption class="nur-sr">{f.nist_id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('nist.spalte.subkategorie')}</th>
                      <th scope="col">{t('nist.spalte.ist')}</th>
                      <th scope="col">{t('nist.spalte.ziel')}</th>
                      <th scope="col">{t('nist.spalte.prioritaet')}</th>
                      <th scope="col">{t('nist.spalte.massnahmen')}</th>
                      <th scope="col">{t('nist.spalte.notiz')}</th>
                    </tr>
                  </thead>
                  <tbody>{zeilen.map((s) => <Zeile key={s.id} p={p} s={s} />)}</tbody>
                </table>
              </div>
            )}
          </details>
        );
      })}
      <p class="zweitext"><a href={routeZuHash({ art: 'formular', modul: 'massnahmen' })}>{t('nist.zu_massnahmen')}</a></p>
    </div>
  );
}

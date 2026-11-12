// Formularmodul EU AI Act (nur mit Modul): Rolle und Risikoklasse je System, Pflichten je System mit Abdeckung durch das AIMS,
// vorgeschlagene Zusatz-Controls (EUAIA) übernehmen oder begründet ablehnen, offene Pflichten als Massnahmen, Fristen.
import { useState } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { fristDokument, seitenSchluessel, type Frist, type Stand } from '../../../vorlagen/E-0x.ts';
import { appDaten, euaiaControls } from '../../daten.ts';
import { datumText, fachText, inhalt, optionText, t, uiSprache } from '../../i18n.ts';
import { fristenUebersicht, giltAb, massnahmenRef, pflichtenJeSystem, pflichtenKatalog, standKatalog, type PflichtZeile } from '../../logik/aiact.ts';
import { neuerControlEintrag, neuerEintrag } from '../../logik/eintraege.ts';
import { formularFelder } from '../../logik/formularfelder.ts';
import { REITER, routeZuHash } from '../../logik/routen.ts';
import { soaVorschlaege } from '../../logik/vorschlaege.ts';
import { RichText } from '../../ui/RichText.tsx';
import { aendereMit, melde, stichtag, stichtagAbweichend, umfeld } from '../../zustand/store.ts';
import { Zeitleiste } from '../../../grafik/preact/Diagramme.tsx';
import { aiActLinks } from '../gefuehrt/Hilfe.tsx';
import { ListenModul } from './ListenModul.tsx';
import { eintraegeVon } from './Organisation.tsx';
import { ReiterModul } from './Reiter.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { ENTSCHEID_ART, GRAD_ART, StatusPille } from '../../ui/StatusPille.tsx';
import { Hinweis } from '../../ui/Hinweis.tsx';

/** Verweise mit eigenem Kürzel (Anhang, Art. 8 VO …) ohne vorangestelltes «Art.», in der Sprache der Oberfläche */
function artikelText(artikel: string): string {
  return fachText(`${/^(Anhang|Annex|Art\.)/.test(artikel) ? '' : t('aiact.art')} ${artikel}`.trim());
}

function ArtikelLink({ artikel }: { artikel: string }) {
  // Fundstellen in anderen Rechtsakten (Maschinenverordnung) nie auf eine Seite der konsolidierten Fassung des AI Act
  const k = /VO \(EU\)|Verordnung|Richtlinie/.test(artikel) ? undefined : seitenSchluessel(artikel);
  const l = k ? aiActLinks([k])[0] : undefined;
  const text = artikelText(artikel);
  if (!l) return <>{text}</>;
  return <a href={l.href} target="_blank" rel="noopener" title={l.text}>{text}{l.seite ? ` (${t('aiact.seite', { seite: l.seite })})` : ''}</a>;
}

/** Fundstelle einer Frist: mit Linkziel in einem anderen Rechtsakt (stand.yaml, dokument) dessen PDF und Seite, sonst wie ArtikelLink */
function FristLink({ f, stand }: { f: Frist; stand: Stand | null }) {
  const d = fristDokument(stand, f, uiSprache.value);
  if (!d) return <ArtikelLink artikel={f.artikel} />;
  return (
    <a href={`../Rechtstexte_Legal-Texts/EU-AI-Act/${d.datei}${d.seite ? `#page=${d.seite}` : ''}`} target="_blank" rel="noopener">
      {artikelText(f.artikel)}{d.seite ? ` (${t('aiact.seite', { seite: d.seite })})` : ''}
    </a>
  );
}

/** Zusatz-Control in die SoA übernehmen (anwendbar) oder mit Begründung ablehnen. */
export function entscheideZusatzControl(id: string, anwendbar: 'ja' | 'nein', begruendung: string, vorschlag: 'aiact' | 'nistrmf' = 'aiact'): void {
  aendereMit((p) => {
    let c = p.controls.find((x) => x.id === id);
    if (!c) {
      c = neuerControlEintrag(id);
      p.controls.push(c);
    }
    c.anwendbar = anwendbar;
    c.begruendung = begruendung;
    c.vorschlag = vorschlag;
    if (anwendbar === 'ja' && c.status === 'offen') c.status = 'geplant';
  });
}

/** Offene Pflichten als Massnahmen (herkunft aiact, ref «Pflicht:System»); bestehende werden nicht verdoppelt. */
export function pflichtenAlsMassnahmen(zeilen: readonly PflichtZeile[]): string[] {
  const neu: string[] = [];
  aendereMit((p) => {
    for (const z of zeilen) {
      const ref = massnahmenRef(z.pflicht.id, z.system.id);
      if (p.massnahmen.some((m) => m.herkunft.art === 'aiact' && m.herkunft.ref === ref)) continue;
      const kurz = inhalt(`pflichten.${z.pflicht.id}.kurz`) ?? z.pflicht.id;
      const m = neuerEintrag(p, 'massnahmen', {
        titel: `${z.pflicht.id} ${z.system.name}`.trim(),
        beschreibung: kurz,
        prioritaet: z.pflicht.kmu_relevanz === 'hoch' ? 'hoch' : 'mittel',
        herkunft: { art: 'aiact', ref },
        termin: giltAb(z.pflicht, z.system.aiAct.risikoklasse),
      });
      p.massnahmen.push(m as never);
      neu.push(String(m['id']));
    }
  });
  return neu;
}

function Systeme({ p, gewaehlt }: { p: Projekt; gewaehlt?: string }) {
  const felder = formularFelder(umfeld.value.gefuehrt, 'kiSysteme').filter((f) => f.etappe === 'E5');
  return (
    <ListenModul p={p} modul="aiact" liste="kiSysteme" titel={t('reiter.aiact.systeme')} unterteil anlegen={false} felder={felder} gewaehlt={gewaehlt}
      routeFuer={(id) => ({ art: 'formular', modul: 'aiact', id: 'systeme', filter: id ? { eintrag: id } : undefined })}
      eintraege={eintraegeVon(p, 'kiSysteme', (o) => String(o['name'] ?? ''))}
      spalten={[
        { titel: t('liste.id'), breite: '8ch', wert: (e) => <span class="marke-id">{e.id}</span> },
        { titel: t('liste.name'), breite: '2fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
        { titel: t('aiact.rolle'), breite: '1fr', wert: (e) => ((e.objekt['aiAct'] as { rollen: string[] }).rollen.map((r) => optionText('aiActRolle', r)).join(', ') || t('liste.offen')) },
        { titel: t('aiact.klasse'), breite: '1fr', wert: (e) => optionText('risikoklasse', (e.objekt['aiAct'] as { risikoklasse: string }).risikoklasse) },
      ]}
    />
  );
}

function Pflichten({ p }: { p: Projekt }) {
  const jeSystem = pflichtenJeSystem(p, pflichtenKatalog(appDaten().kataloge));
  const offen = jeSystem.flatMap((x) => x.zeilen.filter((z) => z.stand === 'offen' && !z.massnahme));
  if (jeSystem.length === 0) return <p class="ersatz">{t('aiact.keine_systeme')}</p>;
  return (
    <div>
      <p class="zweitext">{t('aiact.pflichten_text')}</p>
      <p class="leiste">
        <span>{t('aiact.offen_anzahl', { anzahl: offen.length })}</span>
        {offen.length > 0 && (
          <button type="button" id="pflichten-massnahmen" onClick={() => melde(t('aiact.massnahmen_angelegt', { anzahl: pflichtenAlsMassnahmen(offen).length }), 'ok')}>
            {t('aiact.alle_als_massnahmen')}
          </button>
        )}
      </p>
      {jeSystem.map(({ system, zeilen }) => (
        <details class="karte abschnitt" key={system.id} open={jeSystem.length <= 3}>
          <summary>
            <span class="marke-id">{system.id}</span> {system.name} · {optionText('risikoklasse', system.aiAct.risikoklasse)} ·{' '}
            {t('aiact.pflichten_anzahl', { anzahl: zeilen.length, offen: zeilen.filter((z) => z.stand === 'offen').length })}
          </summary>
          {/* Art. 50(1) und 50(2) treffen den Anbieter; ein reiner Betreiber fordert den Hinweis ein und prüft ihn im Betrieb (RT-27) */}
          {system.aiAct.rollen.includes('betreiber') && !system.aiAct.rollen.includes('anbieter') && (system.aiAct.transparenz ?? []).some((x) => x === '50-1' || x === '50-2') && (
            <Hinweis als="p" data-hinweis="art50-anbieter">{t('aiact.art50_anbieter', { absaetze: (system.aiAct.transparenz ?? []).filter((x) => x === '50-1' || x === '50-2').map((x) => x.replace('-', '(') + ')').join(', ') })}</Hinweis>
          )}
          {zeilen.length === 0 ? (
            <p class="zweitext">{system.aiAct.rollen.length ? t('aiact.keine_pflichten') : t('aiact.rolle_fehlt')}</p>
          ) : (
            <div class="tabelle-feld karten-schmal">
              <table>
                <caption class="nur-sr">{t('aiact.pflichten_von', { name: system.name })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('aiact.pflicht')}</th>
                    <th scope="col">{t('aiact.abdeckung')}</th>
                    <th scope="col">{t('aiact.zusatz')}</th>
                    <th scope="col">{t('aiact.gilt_ab')}</th>
                    <th scope="col">{t('aiact.stand')}</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.pflicht.id}>
                      <td data-label={t('aiact.pflicht')}>
                        <strong class="ohne-umbruch">{z.pflicht.id}</strong> · <ArtikelLink artikel={z.pflicht.artikel} />
                        <br />
                        <span class="zweitext">{inhalt(`pflichten.${z.pflicht.id}.kurz`) ?? ''}</span>
                      </td>
                      <td data-label={t('aiact.abdeckung')}><StatusPille art={GRAD_ART[z.pflicht.abdeckung_42001.grad] ?? 'neutral'}>{t(`aiact.grad.${z.pflicht.abdeckung_42001.grad}`)}</StatusPille></td>
                      <td data-label={t('aiact.zusatz')}>{z.pflicht.zusatz_control ? <a class="ohne-umbruch" href={routeZuHash({ art: 'formular', modul: 'soa', id: z.pflicht.zusatz_control })}>{z.pflicht.zusatz_control}</a> : ''}</td>
                      <td data-label={t('aiact.gilt_ab')}>{datumText(giltAb(z.pflicht, system.aiAct.risikoklasse))}</td>
                      <td data-label={t('aiact.stand')}>
                        {t(`aiact.pflichtstand.${z.stand}`)}
                        {z.massnahme ? (
                          <> · <a class="ohne-umbruch" href={routeZuHash({ art: 'formular', modul: 'massnahmen', id: z.massnahme.id })}>{z.massnahme.id}</a></>
                        ) : z.stand === 'offen' ? (
                          <> · <button type="button" class="klein leise" onClick={() => melde(t('aiact.massnahmen_angelegt', { anzahl: pflichtenAlsMassnahmen([z]).length }), 'ok')}>{t('aiact.als_massnahme')}</button></>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      ))}
    </div>
  );
}

function Vorschlaege({ p }: { p: Projekt }) {
  const [ablehnen, setAblehnen] = useState<string | null>(null);
  const [grund, setGrund] = useState('');
  const vorschlaege = soaVorschlaege(p, euaiaControls()).filter((v) => v.grund === 'aiact');
  const entschieden = p.controls.filter((c) => c.rahmenwerk === 'EUAIA' && !vorschlaege.some((v) => v.id === c.id));
  const liste = [...vorschlaege.map((v) => ({ id: v.id, quellen: v.quellen })), ...entschieden.map((c) => ({ id: c.id, quellen: [] as string[] }))];
  if (liste.length === 0) return <p class="ersatz">{t('aiact.keine_vorschlaege')}</p>;
  return (
    <div>
      <p class="zweitext">{t('aiact.vorschlaege_text')}</p>
      {liste.map(({ id, quellen }) => {
        const c = p.controls.find((x) => x.id === id);
        const status = !c || c.anwendbar === 'offen' ? 'offen' : c.anwendbar;
        const hinweis = (inhalt(`euaia.${id}.hinweis`) ?? '').split(/\n\s*\n/)[0];
        return (
          <section class="karte abschnitt" key={id} id={`vorschlag-${id}`} aria-labelledby={`vorschlag-${id}-titel`}>
            <h3 id={`vorschlag-${id}-titel`}><span class="marke-id">{id}</span> {inhalt(`euaia.${id}.name`) ?? ''}</h3>
            <RichText text={hinweis} />
            {quellen.length > 0 && <p class="zweitext">{t('aiact.ausgeloest', { systeme: quellen.map((q) => `${q} ${p.kiSysteme.find((s) => s.id === q)?.name ?? ''}`.trim()).join(', ') })}</p>}
            <p>
              <StatusPille art={ENTSCHEID_ART[status] ?? 'neutral'}>{t(`aiact.entscheid.${status}`)}</StatusPille>
              {c?.begruendung && <span class="zweitext"> {c.begruendung}</span>}
            </p>
            {ablehnen === id ? (
              <div class="feld">
                <label for={`grund-${id}`}>{t('aiact.ablehnen_grund')}</label>
                <textarea id={`grund-${id}`} value={grund} onInput={(e) => setGrund(e.currentTarget.value)} rows={3} />
                <div class="leiste">
                  <button type="button" disabled={!grund.trim()} onClick={() => { entscheideZusatzControl(id, 'nein', grund.trim()); setAblehnen(null); setGrund(''); }}>{t('aiact.ablehnen_bestaetigen')}</button>
                  <button type="button" class="leise" onClick={() => setAblehnen(null)}>{t('allgemein.abbrechen')}</button>
                </div>
              </div>
            ) : (
              <div class="leiste">
                {status !== 'ja' && (
                  <button type="button" id={`uebernehmen-${id}`} onClick={() => {
                    entscheideZusatzControl(id, 'ja', c?.begruendung?.trim() && c.anwendbar === 'ja' ? c.begruendung : t('soa.begruendung_aiact', { quellen: quellen.join(', ') || id }));
                    melde(t('aiact.uebernommen', { id }), 'ok');
                  }}>{t('aiact.in_soa')}</button>
                )}
                {status !== 'nein' && <button type="button" onClick={() => { setAblehnen(id); setGrund(''); }}>{t('aiact.ablehnen')}</button>}
                <a class="knopf leise" href={routeZuHash({ art: 'formular', modul: 'soa', id })}>{t('aiact.in_soa_oeffnen')}</a>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Fristen() {
  const stand = standKatalog(appDaten().kataloge);
  const { fristen, naechste } = fristenUebersicht(stand, stichtag.value);
  return (
    <div>
      <section class="karte abschnitt">
        <h2>{inhalt('stand.fassung.titel') ?? t('aiact.fassung')}</h2>
        <p>{t('aiact.stand_text', { fassung: datumText(stand?.fassung.datum), geprueft: datumText(stand?.geprueft_am) })}</p>
        <RichText text={(inhalt('stand.fassung.text') ?? '').split(/\n\s*\n/)[0]} />
      </section>
      <section class="karte abschnitt" id="fristen-zeitleiste" aria-labelledby="fristen-zeitleiste-titel">
        <h2 id="fristen-zeitleiste-titel">{t('grafik.fristen_titel')}</h2>
        <Zeitleiste
          beschriftung={t('grafik.fristen_titel')}
          heute={{ vorIndex: naechste ? fristen.findIndex((f) => f.id === naechste) : fristen.length, text: `${stichtagAbweichend.value ? t('grafik.stichtag') : t('grafik.heute')} ${datumText(stichtag.value)}` }}
          eintraege={fristen.map((f) => {
            const zustand = f.vorbei ? 'erledigt' : f.id === naechste ? 'aktiv' : 'offen';
            return {
              id: f.id, titel: `${t(`aiact.fristart.${f.art}`)}, ${artikelText(f.artikel)}`, datum: datumText(f.datum), iso: f.datum, zustand,
              zustandText: t(f.vorbei ? 'grafik.fristen_vorbei' : f.id === naechste ? 'grafik.fristen_naechste' : 'grafik.fristen_offen'),
              ...(f.id === naechste ? { pille: { ton: 'info' as const, text: t('aiact.naechste') } } : {}),
            };
          })}
        />
      </section>
      <div class="tabelle-feld karten-schmal">
        <table>
          <caption class="nur-sr">{t('reiter.aiact.fristen')}</caption>
          <thead><tr><th scope="col">{t('aiact.datum')}</th><th scope="col">{t('aiact.art_frist')}</th><th scope="col">{t('aiact.artikel')}</th><th scope="col">{t('aiact.inhalt')}</th></tr></thead>
          <tbody>
            {fristen.map((f) => (
              <tr key={f.id} class={f.vorbei ? 'vorbei' : f.id === naechste ? 'naechste' : ''}>
                <td data-label={t('aiact.datum')}>{datumText(f.datum)}{f.id === naechste && <> <StatusPille art="info">{t('aiact.naechste')}</StatusPille></>}</td>
                <td data-label={t('aiact.art_frist')}>{t(`aiact.fristart.${f.art}`)}</td>
                <td data-label={t('aiact.artikel')}><FristLink f={f} stand={stand} /></td>
                <td data-label={t('aiact.inhalt')}>{inhalt(`stand.fristen.${f.id}`) ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AiActModul({ p, reiter, filter }: { p: Projekt; reiter?: string; filter?: Record<string, string> }) {
  const alle = REITER.aiact!;
  const r = alle.includes(reiter ?? '') ? reiter! : 'systeme';
  if (!p.meta.modulAiAct) {
    return (
      <div class="inhalt">
        <Seitenkopf titel={t('module.aiact')} aktion={<a class="knopf primaer" href={routeZuHash({ art: 'einstellungen', bereich: 'projekt' })}>{t('navi.einstellungen')}</a>} />
        <p class="ersatz">{t('aiact.modul_aus')}</p>
      </div>
    );
  }
  return (
    <ReiterModul modul="aiact" titel={t('module.aiact')} einleitung={t('module.aiact_text')} reiter={alle.map((id) => ({ id, text: t(`reiter.aiact.${id}`) }))} aktiv={r}>
      {r === 'pflichten' ? <Pflichten p={p} /> : r === 'vorschlaege' ? <Vorschlaege p={p} /> : r === 'fristen' ? <Fristen /> : <Systeme p={p} gewaehlt={filter?.['eintrag']} />}
    </ReiterModul>
  );
}

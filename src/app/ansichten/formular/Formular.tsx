// Formularansicht: Übersicht und alle Module (Listen, Organisation, Ziele, Kompetenz, EU AI Act, 27001-Brücke, Generator).
import { useEffect, useRef } from 'preact/hooks';
import { lokalLesen, lokalSchreiben } from '../../lokal.ts';
import type { Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { datumText, dokumentTitelUi, inhalt, optionText, t } from '../../i18n.ts';
import { neuerControlEintrag } from '../../logik/eintraege.ts';
import { routeZuHash, type Modul } from '../../logik/routen.ts';
import { soaVorschlaege } from '../../logik/vorschlaege.ts';
import { navigiere, umfeld } from '../../zustand/store.ts';
import { unter1024 } from '../../rahmen/zustand.ts';
import { RisikoMatrizen, StufePille, risikenInZelle } from '../../ui/Grafik.tsx';
import { Lagebild } from './Lagebild.tsx';
import { restLage } from '../../../grafik/daten.ts';
import { schreibeFeld } from '../gefuehrt/aktionen.ts';
import { Dokumente } from '../dokumente/Dokumente.tsx';
import { ListenModul, type ListenEintrag } from './ListenModul.tsx';
import { AiActModul } from './AiAct.tsx';
import { NistRmfModul } from './NistRmf.tsx';
import { KatalogVorschlaege } from '../gefuehrt/KatalogVorschlaege.tsx';
import { dokumentImModul } from '../../logik/nistrmf.ts';
import { Fragebogen } from '../gefuehrt/Fragebogen.tsx';
import { BrueckeModul } from './Bruecke.tsx';
import { KompetenzModul, OrganisationModul, ZieleModul } from './Organisation.tsx';
import { SeitenAbschnitte } from './Reiter.tsx';
import { FuerMitarbeitende } from './Mitarbeitende.tsx';
import { NormtextSprache } from '../../normtexte/NormtextHilfe.tsx';
import { normErlaeuterung, normTitel } from '../../normtexte/zustand.ts';
import { Auswahl } from '../../ui/Auswahl.tsx';
import { DruckAktion } from '../../rahmen/aktionen.tsx';
import { Seitenkopf } from '../../rahmen/Seitenkopf.tsx';
import { Symbol } from '../../rahmen/symbole.tsx';
import { StatusPille, type StatusArt } from '../../ui/StatusPille.tsx';
import { tr } from '../../rahmen/text.ts';

/** Status eines Risikos als StatusPille (A-04): offen Warnung, in Behandlung Info, behandelt und angenommen gut, geschlossen neutral */
const RISIKO_STATUS_ART: Record<string, StatusArt> = { offen: 'warnung', 'in-behandlung': 'info', behandelt: 'gut', akzeptiert: 'gut', geschlossen: 'neutral' };

export const MODUL_LISTE: { modul: Modul; etappe?: string; modulAiAct?: boolean; modulNistRmf?: boolean }[] = [
  { modul: 'uebersicht' },
  { modul: 'organisation', etappe: 'E2' },
  { modul: 'inventar' },
  { modul: 'risiken' },
  { modul: 'folgen' },
  { modul: 'soa' },
  { modul: 'dokumente' },
  { modul: 'nachweise' },
  { modul: 'massnahmen' },
  { modul: 'lieferanten' },
  { modul: 'ziele' },
  { modul: 'kompetenz' },
  { modul: 'audits' },
  { modul: 'feststellungen' },
  { modul: 'meldungen' },
  // «generator» bleibt als Route erreichbar, steht aber nicht mehr doppelt zu «Dokumente erzeugen» in der Navigation (RT-38)
  { modul: 'aiact', modulAiAct: true },
  { modul: 'nistrmf', modulNistRmf: true },
  { modul: 'brucke27001' },
];

function aktivesSystem(s: { status: string }) {
  return s.status !== 'abgeloest' && s.status !== 'untersagt';
}

/** Verknüpfte Angaben eines KI-Systems mit Sprung in die gefilterten Module (Rollentest RT-36: Rückverfolgung im Audit) */
function Verknuepft({ p, ki }: { p: Projekt; ki: string }) {
  const risiken = p.risiken.filter((r) => r.kiSystem === ki);
  const rIds = new Set(risiken.map((r) => r.id));
  const fa = p.folgenabschaetzungen.find((f) => f.kiSystem === ki);
  const controls = p.controls.filter((c) => c.anwendbar === 'ja' && (c.kiSysteme ?? []).includes(ki));
  const massnahmen = p.massnahmen.filter((m) => m.herkunft.art === 'risiko' && rIds.has(m.herkunft.ref ?? ''));
  const feststellungen = p.feststellungen.filter((f) => f.kiSystem === ki);
  const meldungen = (p.meldungen ?? []).filter((m) => m.kiSystem === ki);
  const lieferant = p.kiSysteme.find((s) => s.id === ki)?.lieferant;
  const eintrag = (text: string, href: string, n?: number) => <li><a href={href}>{text}</a>{n !== undefined && <span class="zweitext"> · {n}</span>}</li>;
  return (
    <details class="karte abschnitt verknuepft" open id={`verknuepft-${ki}`}>
      <summary><strong>{t('verknuepft.titel')}</strong></summary>
      <ul class="lb-liste">
        {eintrag(t('verknuepft.risiken'), routeZuHash({ art: 'formular', modul: 'risiken', filter: { ki } }), risiken.length)}
        {eintrag(fa ? t('verknuepft.folgen', { id: fa.id }) : t('verknuepft.folgen_offen'), routeZuHash({ art: 'formular', modul: 'folgen', filter: { ki } }))}
        {eintrag(t('verknuepft.controls'), routeZuHash({ art: 'formular', modul: 'soa', filter: { ki } }), controls.length)}
        {massnahmen.length > 0 && <li>{t('verknuepft.massnahmen')} {massnahmen.map((m, i) => <span key={m.id}>{i > 0 && ', '}<a href={routeZuHash({ art: 'formular', modul: 'massnahmen', id: m.id })}>{m.id}</a></span>)}</li>}
        {eintrag(t('verknuepft.feststellungen'), routeZuHash({ art: 'formular', modul: 'feststellungen', filter: { ki } }), feststellungen.length)}
        {meldungen.length > 0 && eintrag(t('verknuepft.meldungen'), routeZuHash({ art: 'formular', modul: 'meldungen' }), meldungen.length)}
        {lieferant && eintrag(t('verknuepft.lieferant', { id: lieferant }), routeZuHash({ art: 'formular', modul: 'lieferanten', id: lieferant }))}
      </ul>
    </details>
  );
}

function Platzhalter({ modul, etappe }: { modul: Modul; etappe?: string }) {
  return (
    <div class="inhalt">
      <Seitenkopf titel={t(`module.${modul}`)} aktion={etappe && <a class="knopf primaer" href={routeZuHash({ art: 'gefuehrt', etappe })}>{t('module.im_gefuehrten', { etappe: inhalt(`gefuehrt.etappen.${etappe}.titel`) ?? etappe })}</a>} />
      <p class="ersatz">{t('module.folgt')}</p>
    </div>
  );
}

/** Meldungen an Behörden und Betroffene: Fokus auf dem Titel wie in allen Ansichten (D-09) */
function Meldungen({ p, titel }: { p: Projekt; titel: string }) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titelRef.current?.focus(), []);
  return (
    <div class="inhalt">
      <Seitenkopf titel={titel} titelRef={titelRef} aktion={<DruckAktion />} />
      <p class="zweitext">{t('module.meldungen_text')}</p>
      <SeitenAbschnitte p={p} seiten={['E12-meldungen']} />
    </div>
  );
}

export function Formular({ p, modul, id, filter }: { p: Projekt; modul: string; id?: string; filter?: Record<string, string> }) {
  const titel = t(`module.${modul}`);
  switch (modul) {
    case 'uebersicht':
      return <Lagebild p={p} />;
    case 'organisation':
      return <OrganisationModul p={p} reiter={id} filter={filter} />;
    case 'ziele':
      return <ZieleModul p={p} id={id} />;
    case 'kompetenz':
      return <KompetenzModul p={p} reiter={id} filter={filter} />;
    case 'aiact':
      return <AiActModul p={p} reiter={id} filter={filter} />;
    case 'nistrmf':
      return <NistRmfModul p={p} reiter={id} fokus={filter?.['eintrag']} />;
    case 'brucke27001':
      return <BrueckeModul p={p} reiter={id} />;
    case 'inventar': {
      const eintraege: ListenEintrag[] = p.kiSysteme.map((s) => ({ id: s.id, objekt: s as never, liste: 'kiSysteme', neu: false, titel: s.name }));
      return (
        <ListenModul p={p} modul="inventar" liste="kiSysteme" titel={titel} einleitung={t('module.inventar_text')} eintraege={eintraege} gewaehlt={id} oben={<Fragebogen p={p} />}
          zusatz={(e) => <Verknuepft p={p} ki={e.id} />}
          spalten={[
            { titel: t('liste.id'), breite: '8ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.name'), breite: '2fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
            { titel: t('liste.typ'), breite: '1fr', kurz: true, wert: (e) => optionText('kiTyp', String(e.objekt['typ'])) },
            { titel: t('liste.status'), breite: '1fr', kurz: true, wert: (e) => optionText('kiStatus', String(e.objekt['status'])) },
          ]}
        />
      );
    }
    case 'risiken': {
      const ki = filter?.['ki'];
      // Filter aus der Risikomatrix: Zelle W×A vor oder nach Behandlung (?w=&a=&stand=)
      const fw = Number(filter?.['w']);
      const fa = Number(filter?.['a']);
      const stand = filter?.['stand'] === 'nach' ? 'nach' : 'vor';
      const zelle = Number.isInteger(fw) && Number.isInteger(fa) && fw > 0 && fa > 0 ? { w: fw, a: fa, stand: stand as 'vor' | 'nach' } : undefined;
      const roh = zelle ? risikenInZelle(p.risiken, zelle.stand, zelle.w, zelle.a, ki) : ki ? p.risiken.filter((r) => r.kiSystem === ki) : p.risiken;
      // Statusfilter (U-05): Status der Risiken oder Lage zur Akzeptanzgrenze (über der Grenze, Annahme offen)
      const kr = p.organisation.risikokriterien;
      const sf = filter?.['status'] ?? '';
      const lage = (r: (typeof roh)[number]) => restLage(r, kr);
      const quelle = !sf ? roh : sf === 'ueber' ? roh.filter((r) => { const l = lage(r); return l === 'ueber' || l === 'annahme-offen' || l === 'angenommen'; })
        : sf === 'annahme-offen' ? roh.filter((r) => lage(r) === 'annahme-offen') : roh.filter((r) => r.status === sf);
      const eintraege: ListenEintrag[] = quelle.map((r) => ({ id: r.id, objekt: r as never, liste: 'risiken', neu: false, titel: r.titel }));
      const setzeFilter = (k: string, v: string) => {
        const f: Record<string, string> = { ...(ki ? { ki } : {}), ...(sf ? { status: sf } : {}), [k]: v };
        if (!v) delete f[k];
        navigiere({ art: 'formular', modul: 'risiken', filter: Object.keys(f).length ? f : undefined });
      };
      const statusText = sf ? (sf === 'ueber' || sf === 'annahme-offen' ? t(`risiken.lage_${sf}`) : optionText('risikoStatus', sf)) : '';
      const person = (id?: string | number) => (id === undefined ? '' : (p.personen.find((x) => x.id === id)?.name ?? String(id)));
      const kiText = ki ? t('liste.filter_ki', { ki: `${ki} ${p.kiSysteme.find((s) => s.id === ki)?.name ?? ''}` }) : '';
      const zellText = zelle ? t('grafik.filter_zelle', { kurzW: t('grafik.kurz_w'), kurzA: t('grafik.kurz_a'), w: zelle.w, a: zelle.a, stand: t(`grafik.stand_${zelle.stand}`) }) : '';
      const genai = p.kiSysteme.some((s) => s.generativ === true && aktivesSystem(s));
      return (
        <ListenModul p={p} modul="risiken" liste="risiken" titel={titel} einleitung={t('module.risiken_text')} eintraege={eintraege} gewaehlt={id} filter={filter}
          oben={
            <>
              <div class="leiste filterleiste" id="risiken-filter">
                <label>{t('soa.filter_ki')}{' '}
                  <Auswahl value={ki ?? ''} onChange={(e) => setzeFilter('ki', e.currentTarget.value)}>
                    <option value="">{t('soa.filter_alle')}</option>
                    {p.kiSysteme.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
                  </Auswahl>
                </label>
                <label>{t('risiken.filter_status')}{' '}
                  <Auswahl id="risiken-status" value={sf} onChange={(e) => setzeFilter('status', e.currentTarget.value)}>
                    <option value="">{t('soa.filter_alle')}</option>
                    <optgroup label={t('risiken.gruppe_grenze')}>
                      <option value="ueber">{t('risiken.lage_ueber')}</option>
                      <option value="annahme-offen">{t('risiken.lage_annahme-offen')}</option>
                    </optgroup>
                    <optgroup label={t('liste.status')}>
                      {(appDaten().gefuehrt.optionen?.['risikoStatus'] ?? []).map(String).map((s) => <option key={s} value={s}>{optionText('risikoStatus', s)}</option>)}
                    </optgroup>
                  </Auswahl>
                </label>
              </div>
              <details class="karte abschnitt" id="risiken-matrix" open={lokalLesen('risikomatrix') === 'offen'} onToggle={(e) => lokalSchreiben('risikomatrix', e.currentTarget.open ? 'offen' : 'zu')}>
                <summary>{t('lagebild.risiken')}</summary>
                <RisikoMatrizen p={p} ki={ki} aktiv={zelle} id="risiken-matrix-tabelle" mitListe={false} />
              </details>
              {genai && (
                <details class="karte abschnitt" id="genai-vorschlaege">
                  <summary>{t('vorschlaege.genai_titel')}</summary>
                  <KatalogVorschlaege p={p} katalog="genaiRisiken" risikoRoute={(rid) => ({ art: 'formular', modul: 'risiken', id: rid })} />
                </details>
              )}
            </>
          }
          // A-18: Name und Datum der Annahme brechen um statt zu kürzen; Platz für Pille und zwei Zeilen.
          // A-25: zwischen 640 und 1023 px 80 px, damit lange Bezeichnungen vier Zeilen haben
          zeilenHoehe={unter1024.value ? 80 : 64}
          vorgabe={{ art: 'risiko', status: 'offen', ...(ki ? { kiSystem: ki } : {}) }}
          filterHinweis={ki || zelle || sf ? [kiText, zellText, sf ? t('risiken.filter_hinweis', { status: statusText }) : ''].filter(Boolean).join(' ') : undefined}
          spalten={[
            // A-25: unter 1024 px steht das KI-System unter der ID, damit die Bezeichnung Platz hat
            { titel: t('liste.id'), breite: '7ch', wert: (e) => <><span class="marke-id">{e.id}</span>{unter1024.value && e.objekt['kiSystem'] ? <span class="status-zusatz"><span class="nur-sr">{t('liste.system')}: </span>{String(e.objekt['kiSystem'])}</span> : null}</> },
            { titel: t('liste.titel'), breite: '3fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
            ...(unter1024.value ? [] : [{ titel: t('liste.system'), breite: '7ch', wert: (e: ListenEintrag) => String(e.objekt['kiSystem'] ?? '') }]),
            // Wert vor und nach Behandlung (U-05): «12 → 6 mittel», Stufe des heutigen Werts als Pille
            { titel: t('risiken.wert_vor_nach'), breite: '12ch', wert: (e) => {
              const r = e.objekt as unknown as (typeof roh)[number];
              const nach = typeof r.wNach === 'number' && typeof r.aNach === 'number' && r.wNach && r.aNach;
              if (!nach) return <StufePille p={p} w={r.w} a={r.a} />;
              return <span class="wert-vor-nach">{typeof r.w === 'number' && typeof r.a === 'number' && r.w * r.a ? <>{r.w * r.a} <Symbol name="pfeil-rechts" klasse="sym sym-text" /><span class="nur-sr"> {t('symbol.nach')}</span> </> : ''}<StufePille p={p} w={r.wNach} a={r.aNach} /></span>;
            } },
            // Status mit Restrisiko in der zweiten Zeile (U-05): angenommen von, am; oder Annahme offen
            // A-21: Status mindestens so breit wie die längste Pille («Restrisiko angenommen»), auch unter 1366 px
            { titel: t('liste.status'), breite: 'minmax(11rem, 1fr)', wert: (e) => {
              const r = e.objekt as unknown as (typeof roh)[number];
              const l = lage(r);
              // Status «Restrisiko angenommen»: nur «von …, am» anhängen, nicht ein zweites «angenommen» (Druckprüfung D5)
              const zusatz = r.restrisikoAkzeptiert ? t(r.status === 'akzeptiert' ? 'risiken.angenommen_durch' : 'risiken.angenommen_von', { name: person(r.restrisikoAkzeptiert.von), datum: datumText(r.restrisikoAkzeptiert.am) })
                : l === 'annahme-offen' ? t('risiken.lage_annahme-offen') : l === 'ueber' ? t('risiken.lage_ueber') : '';
              // A-04: Status als StatusPille mit Form und Wort, Person und Datum in der Zeile darunter
              const status = optionText('risikoStatus', String(r.status));
              const art: StatusArt = l === 'ueber' || l === 'annahme-offen' ? 'warnung' : RISIKO_STATUS_ART[String(r.status)] ?? 'neutral';
              return <><StatusPille art={art} klasse="risiko-status">{status}</StatusPille>{zusatz && <>{' '}<span class="status-zusatz">{zusatz}</span></>}</>;
            } },
          ]}
        />
      );
    }
    case 'massnahmen': {
      const eintraege: ListenEintrag[] = p.massnahmen.map((m) => ({ id: m.id, objekt: m as never, liste: 'massnahmen', neu: false, titel: m.titel }));
      return (
        <ListenModul p={p} modul="massnahmen" liste="massnahmen" titel={titel} eintraege={eintraege} gewaehlt={id} vorgabe={{ status: 'offen' }}
          spalten={[
            { titel: t('liste.id'), breite: '7ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.titel'), breite: '3fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
            { titel: t('liste.termin'), breite: '11ch', wert: (e) => datumText(e.objekt['termin'] as string | undefined) },
            { titel: t('liste.status'), breite: '1fr', wert: (e) => optionText('massnahmeStatus', String(e.objekt['status'])) },
          ]}
        />
      );
    }
    case 'lieferanten': {
      const eintraege: ListenEintrag[] = p.lieferanten.map((m) => ({ id: m.id, objekt: m as never, liste: 'lieferanten', neu: false, titel: m.name }));
      return (
        <ListenModul p={p} modul="lieferanten" liste="lieferanten" titel={titel} eintraege={eintraege} gewaehlt={id}
          spalten={[
            { titel: t('liste.id'), breite: '7ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.name'), breite: '2fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
            { titel: t('liste.status'), breite: '1fr', wert: (e) => optionText('pruefstatus', String(e.objekt['pruefstatus'])) },
          ]}
        />
      );
    }
    case 'nachweise': {
      const eintraege: ListenEintrag[] = p.nachweise.map((n) => ({ id: n.id, objekt: n as never, liste: 'nachweise', neu: false, titel: n.titel }));
      return (
        <ListenModul p={p} modul="nachweise" liste="nachweise" titel={titel} einleitung={t('module.nachweise_text')} eintraege={eintraege} gewaehlt={id}
          spalten={[
            { titel: t('liste.id'), breite: '8ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.titel'), breite: '3fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
            { titel: t('liste.typ'), breite: '1fr', wert: (e) => optionText('nachweisArt', String(e.objekt['art'] ?? '')) },
            { titel: t('liste.termin'), breite: '11ch', wert: (e) => datumText(e.objekt['datum'] as string | undefined) },
          ]}
        />
      );
    }
    case 'feststellungen': {
      const ki = filter?.['ki'];
      const eintraege: ListenEintrag[] = p.feststellungen
        .filter((f) => !ki || f.kiSystem === ki)
        .map((f) => ({ id: f.id, objekt: f as never, liste: 'feststellungen', neu: false, titel: `${optionText('feststellungQuelle', f.quelle)} · ${f.beschreibung}` }));
      return (
        <ListenModul p={p} modul="feststellungen" liste="feststellungen" titel={titel} einleitung={t('module.feststellungen_text')} eintraege={eintraege} gewaehlt={id} filter={filter} vorgabe={{ status: 'offen', ...(ki ? { kiSystem: ki } : {}) }}
          oben={
            <div class="leiste filterleiste" id="feststellungen-filter">
              <label>{t('soa.filter_ki')}{' '}
                <Auswahl value={ki ?? ''} onChange={(e) => navigiere({ art: 'formular', modul: 'feststellungen', filter: e.currentTarget.value ? { ki: e.currentTarget.value } : undefined })}>
                  <option value="">{t('soa.filter_alle')}</option>
                  {p.kiSysteme.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
                </Auswahl>
              </label>
            </div>
          }
          spalten={[
            { titel: t('liste.id'), breite: '7ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.titel'), breite: '3fr', wert: (e) => e.titel },
            { titel: t('liste.system'), breite: '8ch', wert: (e) => String(e.objekt['kiSystem'] ?? '') },
            { titel: t('liste.status'), breite: '12ch', wert: (e) => optionText('feststellungStatus', String(e.objekt['status'] ?? '')) },
          ]}
        />
      );
    }
    case 'meldungen':
      return <Meldungen p={p} titel={titel} />;
    case 'mitarbeitende':
      return <FuerMitarbeitende p={p} />;
    case 'audits': {
      const eintraege: ListenEintrag[] = p.audits.map((m) => ({ id: m.id, objekt: m as never, liste: 'audits', neu: false, titel: optionText('auditArt', m.art) }));
      return (
        <ListenModul p={p} modul="audits" liste="audits" titel={titel} einleitung={t('module.audits_text')} eintraege={eintraege} gewaehlt={id}
          oben={<SeitenAbschnitte p={p} seiten={['E12-programm']} />}
          spalten={[
            { titel: t('liste.id'), breite: '8ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.typ'), breite: '2fr', wert: (e) => e.titel },
            { titel: t('liste.termin'), breite: '12ch', wert: (e) => datumText((e.objekt['durchgefuehrt'] ?? e.objekt['geplant']) as string | undefined) },
          ]}
        />
      );
    }
    case 'folgen': {
      const ki = filter?.['ki'];
      const eintraege: ListenEintrag[] = p.kiSysteme
        .filter(aktivesSystem)
        .filter((s) => !ki || s.id === ki)
        .map((s) => {
          const fa = p.folgenabschaetzungen.find((f) => f.kiSystem === s.id);
          return { id: fa?.id ?? `neu:${s.id}`, objekt: (fa ?? { kiSystem: s.id, triage: { ergebnis: 'offen' } }) as never, liste: 'folgenabschaetzungen', neu: !fa, kiSystem: s.id, titel: s.name };
        });
      return (
        <ListenModul p={p} modul="folgen" liste="folgenabschaetzungen" titel={titel} aktion={<a class="knopf primaer" id="folgen-guide" href={routeZuHash({ art: 'gefuehrt', etappe: 'E7' })}>{t('reiter.im_gefuehrten', { etappe: 'E7' })}</a>} einleitung={t('module.folgen_text')} eintraege={eintraege} gewaehlt={id ?? (ki ? eintraege[0]?.id : undefined)} anlegen={false} filter={filter}
          spalten={[
            { titel: t('liste.system'), breite: '8ch', wert: (e) => <span class="marke-id">{e.kiSystem}</span> },
            { titel: t('liste.name'), breite: '2fr', wert: (e) => e.titel },
            { titel: t('liste.ergebnis'), breite: '1fr', wert: (e) => optionText('triageErgebnis', String((e.objekt['triage'] as { ergebnis?: string } | undefined)?.ergebnis ?? 'offen')) },
          ]}
        />
      );
    }
    case 'dokumente': {
      const eintraege: ListenEintrag[] = appDaten().kataloge.dokumente.dokumente
        .filter((d) => dokumentImModul(d, p))
        .map((d) => {
          const id = p.meta.mitIsms && d.eb ? `${d.id}-EB` : d.id;
          const e = p.dokumente.find((x) => x.id === id || x.id === d.id);
          return { id: e?.id ?? id, objekt: (e ?? { id, version: '', status: 'entwurf', ablageort: '', giltFuerIsms: false }) as never, liste: 'dokumente', neu: !e, titel: dokumentTitelUi(e?.id ?? id) };
        });
      return (
        <ListenModul p={p} modul="dokumente" liste="dokumente" titel={titel} einleitung={t('module.dokumente_text')} eintraege={eintraege} gewaehlt={id} anlegen={false} ausschluss={['id']}
          aktion={<a class="knopf primaer" href={routeZuHash({ art: 'dokumente' })}><Symbol name="erzeugen" />{tr('aktion.dokumente')}</a>}
          oben={<SeitenAbschnitte p={p} seiten={['E11-lenkung-isms', 'E11-lenkung']} />}
          spalten={[
            { titel: t('liste.id'), breite: '9ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.titel'), breite: '3fr', wert: (e) => e.titel },
            { titel: t('liste.status'), breite: '1fr', wert: (e) => optionText('dokumentStatus', String(e.objekt['status'])) },
          ]}
        />
      );
    }
    case 'soa': {
      const vorschlaege = new Map(soaVorschlaege(p, umfeld.value.euaia, umfeld.value.rmf).map((v) => [v.id, v]));
      const ids = [...umfeld.value.controlIds42001];
      if (p.meta.modulAiAct) for (const v of vorschlaege.values()) if (v.grund === 'aiact') ids.push(v.id);
      if (p.meta.modulNistRmf) for (const v of vorschlaege.values()) if (v.grund === 'nistrmf') ids.push(v.id);
      // Einträge ausgeschalteter Module bleiben in der Projektdatei, erscheinen aber nicht
      const sichtbar = (r: string) => (r !== 'EUAIA' || p.meta.modulAiAct) && (r !== 'NISTRMF' || p.meta.modulNistRmf === true);
      for (const c of p.controls) if (!ids.includes(c.id) && sichtbar(c.rahmenwerk)) ids.push(c.id);
      const alle: ListenEintrag[] = ids.map((cid) => {
        const c = p.controls.find((x) => x.id === cid);
        return { id: cid, objekt: (c ?? neuerControlEintrag(cid)) as never, liste: 'controls', neu: !c, titel: (/^A\./.test(cid) ? normTitel(cid) : undefined) ?? inhalt(`euaia.${cid}.name`) ?? inhalt(`nist.controls.${cid}.titel`) ?? p.eigeneControls.find((x) => x.id === cid)?.titel ?? '' };
      });
      // Filter nach Umsetzung, Wirksamkeitsprüfung und KI-System (Rollentest RT-16: ISMS-Verantwortliche, Auditor)
      const fStatus = filter?.['status'];
      const fWirksam = filter?.['wirksamkeit'];
      const fKi = filter?.['ki'];
      const geprueft = (o: Record<string, unknown>) => !!String((o['wirksamkeit'] as { ergebnis?: string } | undefined)?.ergebnis ?? '').trim();
      const eintraege = alle.filter((e) => {
        const o = e.objekt as Record<string, unknown>;
        const anwendbar = String(o['anwendbar']) === 'ja';
        const kis = (o['kiSysteme'] as string[] | undefined) ?? [];
        if (fStatus && (!anwendbar || String(o['status']) !== fStatus)) return false;
        if (fWirksam === 'ja' && !geprueft(o)) return false;
        if (fWirksam === 'nein' && (!anwendbar || geprueft(o))) return false;
        // KI-System: anwendbare Controls, die das System nennen oder für alle Systeme gelten (leere Liste)
        if (fKi && (!anwendbar || (kis.length > 0 && !kis.includes(fKi)))) return false;
        return true;
      });
      const setzeFilter = (k: string, v: string) => navigiere({ art: 'formular', modul: 'soa', id, filter: Object.fromEntries(Object.entries({ ...(filter ?? {}), [k]: v }).filter(([, w]) => w)) });
      return (
        <ListenModul p={p} modul="soa" liste="controls" titel={titel} einleitung={t('module.soa_text')} eintraege={eintraege} gewaehlt={id} anlegen={false} filter={filter}
          aktion={<a class="knopf primaer" href={routeZuHash({ art: 'dokumente' })}><Symbol name="erzeugen" />{tr('aktion.dokumente')}</a>}
          oben={
            <div class="leiste filterleiste" id="soa-filter">
              <label>{t('soa.filter_status')}{' '}
                <Auswahl value={fStatus ?? ''} onChange={(e) => setzeFilter('status', e.currentTarget.value)}>
                  <option value="">{t('soa.filter_alle')}</option>
                  {(['offen', 'geplant', 'teilweise', 'umgesetzt', 'wirksam'] as const).map((x) => <option key={x} value={x}>{optionText('controlStatus', x)}</option>)}
                </Auswahl>
              </label>
              <label>{t('soa.filter_wirksamkeit')}{' '}
                <Auswahl value={fWirksam ?? ''} onChange={(e) => setzeFilter('wirksamkeit', e.currentTarget.value)}>
                  <option value="">{t('soa.filter_alle')}</option>
                  <option value="ja">{t('soa.filter_geprueft')}</option>
                  <option value="nein">{t('soa.filter_ungeprueft')}</option>
                </Auswahl>
              </label>
              <label>{t('soa.filter_ki')}{' '}
                <Auswahl value={fKi ?? ''} onChange={(e) => setzeFilter('ki', e.currentTarget.value)}>
                  <option value="">{t('soa.filter_alle')}</option>
                  {p.kiSysteme.filter(aktivesSystem).map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
                </Auswahl>
              </label>
            </div>
          }
          filterHinweis={fStatus || fWirksam || fKi ? t('soa.filter_aktiv', { anzahl: eintraege.length, gesamt: alle.length }) : undefined}
          zusatz={(e) => {
            const v = vorschlaege.get(e.id);
            return (
              <>
                <p class="zweitext">{(/^A\./.test(e.id) ? normErlaeuterung(e.id) : undefined) ?? inhalt(`nist.controls.${e.id}.zweck`) ?? ''}{/^A\./.test(e.id) && <> <NormtextSprache id={e.id} /></>}</p>
                {v && (
                  <p>
                    <StatusPille art="info">{t(`soa.vorschlag_${v.grund}`, { quellen: v.quellen.join(', ') })}</StatusPille>{' '}
                    {String(e.objekt['anwendbar']) === 'offen' && (
                      <button type="button" class="klein" onClick={() => {
                        schreibeFeld({ typ: 'auswahl', pfad: 'anwendbar' }, 'ja', e);
                        const ee = { ...e, neu: false };
                        if (!String(e.objekt['begruendung'] ?? '').trim()) schreibeFeld({ typ: 'textarea', pfad: 'begruendung' }, t(`soa.begruendung_${v.grund}`, { quellen: v.quellen.join(', ') }), ee);
                        schreibeFeld({ typ: 'text', pfad: 'vorschlag' }, v.grund, ee);
                      }}>{t('soa.vorschlag_uebernehmen')}</button>
                    )}
                  </p>
                )}
              </>
            );
          }}
          spalten={[
            { titel: t('liste.id'), breite: '9ch', wert: (e) => <span class="marke-id">{e.id}</span> },
            { titel: t('liste.titel'), breite: '3fr', wert: (e) => e.titel },
            // Entscheid, Umsetzung und Wirksamkeit in einer Spalte, damit die Bezeichnung lesbar bleibt (RT-16, RT-32)
            { titel: t('liste.stand'), breite: '20ch', wert: (e) => {
              const a = String(e.objekt['anwendbar']);
              if (a !== 'ja') return a === 'nein' ? t('soa.nicht_anwendbar') : t('liste.offen');
              const geprueft = String((e.objekt['wirksamkeit'] as { ergebnis?: string } | undefined)?.ergebnis ?? '').trim();
              return `${optionText('controlStatus', String(e.objekt['status']))}${geprueft ? ` · ${t('soa.filter_geprueft')}` : ''}`;
            } },
            { titel: t('liste.vorschlag'), breite: '10ch', wert: (e) => (vorschlaege.has(e.id) ? <StatusPille art="info">{t(`soa.kurz_${vorschlaege.get(e.id)!.grund}`)}</StatusPille> : '') },
          ]}
        />
      );
    }
    case 'generator':
      return <Dokumente p={p} />;
    default: {
      const m = MODUL_LISTE.find((x) => x.modul === modul);
      return <Platzhalter modul={(m?.modul ?? 'uebersicht') as Modul} etappe={m?.etappe} />;
    }
  }
}

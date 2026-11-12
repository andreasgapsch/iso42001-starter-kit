// Formularmodule Organisation (Kontext, Parteien, Geltungsbereich, Leitlinie, Rollen, Risikokriterien),
// Ziele sowie Kompetenz und Kommunikation. Felder und Texte stammen aus den Seiten des Guides.
import type { Projekt } from '../../../model/typen.ts';
import { MatrixVorschau } from '../../ui/Grafik.tsx';
import { datumText, optionText, t } from '../../i18n.ts';
import { REITER, type Modul, type Route } from '../../logik/routen.ts';
import { ListenModul, type ListenEintrag } from './ListenModul.tsx';
import { ReiterModul, SeitenAbschnitte } from './Reiter.tsx';

type Objekt = Record<string, unknown>;

export function eintraegeVon(p: Projekt, liste: keyof Projekt, titel: (o: Objekt) => string): ListenEintrag[] {
  return (p[liste] as unknown as Objekt[]).map((o) => ({ id: String(o['id']), objekt: o, liste: String(liste), neu: false, titel: titel(o) }));
}

const idSpalte = { titel: '', breite: '8ch', wert: (e: ListenEintrag) => <span class="marke-id">{e.id}</span> };

function reiterVon(modul: Modul): { id: string; text: string }[] {
  return (REITER[modul] ?? []).map((id) => ({ id, text: t(`reiter.${modul}.${id}`) }));
}

/** Route einer Auswahl in einem Reiter: der Reiter steht an der Stelle der ID, die Auswahl im Parameter. */
function auswahlRoute(modul: Modul, reiter: string, schluessel = 'eintrag') {
  return (id?: string): Route => ({ art: 'formular', modul, id: reiter, filter: id ? { [schluessel]: id } : undefined });
}

const KONTEXT = ['E0-firma', 'E0-groesse', 'E0-eu', 'E0-ki', 'E0-termin', 'E2-isms-bezug', 'E2-grundlagen', 'E2-themen', 'E2-klima', 'E2-zweck', 'E2-rollen-iso'];
const GELTUNG = ['E2-grenzen', 'E2-schnittstellen', 'E2-prozesse', 'E2-freigabe'];
const LEITLINIE = ['E3-grundsaetze', 'E3-elemente', 'E3-andere-leitlinien', 'E3-ausnahmen', 'E3-leitlinie-freigabe', 'E3-isms', 'E3-meldeweg'];
const KRITERIEN = ['E6-isms-skalen', 'E6-zeitraum', 'E6-skalen', 'E6-akzeptanz', 'E6-neubeurteilung'];

export function OrganisationModul({ p, reiter, filter }: { p: Projekt; reiter?: string; filter?: Record<string, string> }) {
  const r = REITER.organisation!.includes(reiter ?? '') ? reiter! : 'kontext';
  const id = { ...idSpalte, titel: t('liste.id') };
  let inhalt;
  switch (r) {
    case 'parteien':
      inhalt = (
        <ListenModul p={p} modul="organisation" liste="parteien" titel={t('reiter.organisation.parteien')} unterteil
          eintraege={eintraegeVon(p, 'parteien', (o) => String(o['name'] ?? ''))} gewaehlt={filter?.['eintrag']} routeFuer={auswahlRoute('organisation', 'parteien')}
          spalten={[id, { titel: t('liste.name'), breite: '2fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
            { titel: t('liste.typ'), breite: '1fr', wert: (e) => optionText('parteiArt', String(e.objekt['art'])) },
            { titel: t('liste.offen'), breite: '8ch', wert: (e) => String(((e.objekt['anforderungen'] as { adressiert?: string }[] | undefined) ?? []).filter((a) => a.adressiert === 'offen').length || '') }]}
        />
      );
      break;
    case 'geltungsbereich':
      inhalt = <SeitenAbschnitte p={p} seiten={GELTUNG} />;
      break;
    case 'leitlinie':
      inhalt = <SeitenAbschnitte p={p} seiten={LEITLINIE} />;
      break;
    case 'rollen':
      inhalt = (
        <>
          <SeitenAbschnitte p={p} seiten={['E0-verantwortung']} />
          {/* Entscheidungsrechte und Gremien auch in der Formularansicht (Rollentest RT-13: Sicht der Geschäftsleitung) */}
          <SeitenAbschnitte p={p} seiten={['E3-entscheidungsrechte', 'E3-gremien']} />
          <ListenModul p={p} modul="organisation" liste="rollen" titel={t('organisation.rollen')} unterteil
            eintraege={eintraegeVon(p, 'rollen', (o) => optionText('rollenBereich', String(o['bereich'] ?? '')))} gewaehlt={filter?.['eintrag']} routeFuer={auswahlRoute('organisation', 'rollen')}
            spalten={[id, { titel: t('liste.bereich'), breite: '2fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
              { titel: t('liste.verantwortlich'), breite: '1fr', wert: (e) => p.personen.find((x) => x.id === e.objekt['verantwortlich'])?.name ?? '' }]}
          />
          <ListenModul p={p} modul="organisation" liste="personen" titel={t('organisation.personen')} unterteil
            eintraege={eintraegeVon(p, 'personen', (o) => String(o['name'] ?? ''))} gewaehlt={filter?.['person']} routeFuer={auswahlRoute('organisation', 'rollen', 'person')}
            spalten={[id, { titel: t('liste.name'), breite: '2fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
              { titel: t('liste.funktion'), breite: '1fr', wert: (e) => String(e.objekt['funktion'] ?? '') }]}
          />
        </>
      );
      break;
    case 'risikokriterien':
      inhalt = (
        <>
          <SeitenAbschnitte p={p} seiten={KRITERIEN} />
          <MatrixVorschau p={p} id="kriterien-matrix" />
        </>
      );
      break;
    default:
      inhalt = <SeitenAbschnitte p={p} seiten={KONTEXT} />;
  }
  return (
    <ReiterModul modul="organisation" titel={t('module.organisation')} einleitung={t('module.organisation_text')} reiter={reiterVon('organisation')} aktiv={r}>
      {inhalt}
    </ReiterModul>
  );
}

export function ZieleModul({ p, id }: { p: Projekt; id?: string }) {
  return (
    <ListenModul p={p} modul="ziele" liste="ziele" titel={t('module.ziele')} einleitung={t('module.ziele_text')} gewaehlt={id}
      eintraege={eintraegeVon(p, 'ziele', (o) => String(o['ziel'] ?? ''))}
      spalten={[{ ...idSpalte, titel: t('liste.id') }, { titel: t('liste.ziel'), breite: '3fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
        { titel: t('liste.termin'), breite: '11ch', wert: (e) => datumText(e.objekt['termin'] as string | undefined) },
        { titel: t('liste.messungen'), breite: '9ch', wert: (e) => String(((e.objekt['messungen'] as unknown[] | undefined) ?? []).length) }]}
    />
  );
}

export function KompetenzModul({ p, reiter, filter }: { p: Projekt; reiter?: string; filter?: Record<string, string> }) {
  const r = REITER.kompetenz!.includes(reiter ?? '') ? reiter! : 'kompetenzen';
  const id = { ...idSpalte, titel: t('liste.id') };
  return (
    <ReiterModul modul="kompetenz" titel={t('module.kompetenz')} einleitung={t('module.kompetenz_text')} reiter={reiterVon('kompetenz')} aktiv={r}>
      {r === 'kommunikation' ? (
        <>
          <ListenModul p={p} modul="kompetenz" liste="kommunikation" titel={t('reiter.kompetenz.kommunikation')} unterteil
            eintraege={eintraegeVon(p, 'kommunikation', (o) => String(o['was'] ?? ''))} gewaehlt={filter?.['eintrag']} routeFuer={auswahlRoute('kompetenz', 'kommunikation')}
            spalten={[id, { titel: t('liste.was'), breite: '3fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
              { titel: t('liste.richtung'), breite: '1fr', wert: (e) => optionText('richtung', String(e.objekt['richtung'])) }]}
          />
        </>
      ) : (
        <>
          <ListenModul p={p} modul="kompetenz" liste="kompetenzen" titel={t('reiter.kompetenz.kompetenzen')} unterteil
            eintraege={eintraegeVon(p, 'kompetenzen', (o) => String(o['rolle'] ?? ''))} gewaehlt={filter?.['eintrag']} routeFuer={auswahlRoute('kompetenz', 'kompetenzen')}
            spalten={[id, { titel: t('liste.rolle'), breite: '3fr', wert: (e) => e.titel || t('gefuehrt.ohne_titel') },
              { titel: t('liste.status'), breite: '1fr', wert: (e) => optionText('kompetenzStatus', String(e.objekt['status'])) }]}
          />
          <SeitenAbschnitte p={p} seiten={['E10-bewusstsein', 'E10-ki-kompetenz']} />
        </>
      )}
    </ReiterModul>
  );
}

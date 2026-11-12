// Bauwerkzeug für die Beispielprojekte: Hilfsfunktionen. Die massgebenden Daten sind die *.aims.json im Ordner darüber.
// Aufruf: npx tsx src/beispiele/bau/bauen.mts
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ladeKataloge } from '../../kataloge/laden-node.ts';
import type { ControlEintrag, ControlStatus, Projekt, Risiko } from '../../model/typen.ts';

export const SRC = fileURLToPath(new URL('../../', import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const kataloge = ladeKataloge() as any;

export const CONTROLS_42001: string[] = kataloge.controls42001.gruppen.flatMap((g: { controls: { id: string }[] }) => g.controls.map((c) => c.id));

/** 27001-Zuordnungen mit Stärke hoch oder mittel aus dem Mapping */
export function mapping27001(id: string): string[] {
  const z = (kataloge.mapping4200127001.zuordnungen as { id: string; verwandt: { control: string; staerke: string }[] }[]).find((m) => m.id === id);
  return z ? z.verwandt.filter((v) => v.staerke !== 'tief').map((v) => v.control) : [];
}

/** 27001-Bezug eines EUAIA-Controls aus dem Katalog */
export function euaia27001(id: string): string[] {
  const c = (kataloge.aiact_euaiaControls.controls as { id: string; verwandt_27001: string[] }[]).find((x) => x.id === id);
  if (!c) throw new Error(`Unbekanntes Zusatz-Control ${id}`);
  return c.verwandt_27001;
}

export interface CTeil {
  anwendbar?: 'ja' | 'nein';
  begruendung: string;
  status?: ControlEintrag['status'];
  verantwortlich?: string;
  nachweise?: string[];
  umsetzung?: string;
  kiSysteme?: string[];
  iso27001?: string[];
}

export function soa(eintraege: Record<string, CTeil>, risiken: Risiko[], mitIsms: boolean): ControlEintrag[] {
  const fehlend = CONTROLS_42001.filter((id) => !eintraege[id]);
  if (fehlend.length) throw new Error(`SoA unvollständig: ${fehlend.join(', ')}`);
  return CONTROLS_42001.map((id) => {
    const e = eintraege[id]!;
    const anwendbar = e.anwendbar ?? 'ja';
    const ausRisiko = risiken.some((r) => r.art === 'risiko' && r.controls.includes(id));
    const c: ControlEintrag = {
      id,
      rahmenwerk: 'ISO42001',
      anwendbar,
      begruendung: e.begruendung,
      status: anwendbar === 'ja' ? (e.status ?? 'umgesetzt') : 'offen',
      ...(anwendbar === 'ja' && e.verantwortlich ? { verantwortlich: e.verantwortlich } : {}),
      nachweise: anwendbar === 'ja' ? (e.nachweise ?? []) : [],
      umsetzung: anwendbar === 'ja' ? (e.umsetzung ?? '') : '',
      iso27001: anwendbar === 'ja' && mitIsms ? (e.iso27001 ?? mapping27001(id)) : [],
      kiSysteme: e.kiSysteme ?? [],
    };
    if (ausRisiko) c.vorschlag = 'risiko';
    return c;
  });
}

/**
 * Stand der Erklärung zur Anwendbarkeit zum Audit in der Checkliste (audits[].checkliste[].soaStand, D-20): Status, wie
 * D-11 ihn zeigt (umgesetzt mit offener Massnahme als «teilweise»), ausser den abweichenden Werten zum Zeitpunkt des
 * Audits, die D-11 erst später nachgeführt hat.
 */
export function soaStandZumAudit(p: Projekt, auditId: string, abweichend: Record<string, ControlStatus>): void {
  const a = p.audits.find((x) => x.id === auditId);
  if (!a?.checkliste) return;
  for (const [id, e] of Object.entries(a.checkliste)) {
    const c = p.controls.find((x) => x.id === id);
    if (!c || c.anwendbar !== 'ja') continue;
    const offen = (c.umsetzung.match(/\bM-\d{3}\b/g) ?? []).some((m) => {
      const x = p.massnahmen.find((y) => y.id === m);
      return !!x && x.status !== 'erledigt' && x.status !== 'verworfen';
    });
    e.soaStand = abweichend[id] ?? ((c.status === 'umgesetzt' || c.status === 'wirksam') && offen ? 'teilweise' : c.status);
  }
}

/**
 * Risiken, die inhaltlich einem Vorschlag GenAI-Sicherheit entsprechen (Katalog genaiRisiken, GS-xx): Zuordnung über das
 * Feld vorschlag, damit die Vorschlagsliste sie als übernommen zeigt. Prüft System (generativ) und Katalog-ID.
 */
export function vorschlaegeZuordnen(p: Projekt, zuordnung: Record<string, string>): void {
  const gs = new Set((kataloge.genaiRisiken.risiken as { id: string }[]).map((r) => r.id));
  for (const [rid, vid] of Object.entries(zuordnung)) {
    const r = p.risiken.find((x) => x.id === rid);
    if (!r) throw new Error(`Vorschlag ${vid}: Risiko ${rid} fehlt`);
    if (!gs.has(vid)) throw new Error(`Vorschlag ${vid} nicht im Katalog`);
    if (!p.kiSysteme.find((s) => s.id === r.kiSystem)?.generativ) throw new Error(`Vorschlag ${vid}: ${rid} betrifft kein generatives System`);
    r.vorschlag = vid;
  }
}

/**
 * Controls mit positiver Wirksamkeitsprüfung stehen auf «wirksam» (Feldhilfe: wirksam erst nach geprüfter Wirkung). Ausnahmen:
 * Prüfungen mit Feststellung oder offener Korrektur bleiben «umgesetzt». Erst nach soaStandZumAudit aufrufen: Der Stand
 * zum Audit bleibt «umgesetzt», weil die Prüfung im Audit selbst stattfand.
 */
export function wirksamNachPruefung(p: Projekt, bleibtUmgesetzt: string[]): void {
  for (const c of p.controls) {
    if (c.anwendbar !== 'ja' || c.status !== 'umgesetzt' || !c.wirksamkeit?.ergebnis?.trim() || bleibtUmgesetzt.includes(c.id)) continue;
    c.status = 'wirksam';
  }
}

interface Wenn { mitIsms?: boolean; modul?: boolean; modulNistRmf?: boolean; generativ?: boolean; typ?: string; rolle?: string; entwickeltKi?: boolean; verkauftKiProdukte?: boolean }
interface EtappeYaml { id: string; wenn?: Wenn; seiten: string[]; checkliste: (string | { id: string; wenn: Wenn })[] }

const etappenYaml = (): EtappeYaml[] => (parse(readFileSync(`${SRC}gefuehrt/etappen.yaml`, 'utf8')) as { etappen: EtappeYaml[] }).etappen;

function trifft(p: Projekt, w?: Wenn): boolean {
  if (!w) return true;
  if (w.mitIsms !== undefined && w.mitIsms !== p.meta.mitIsms) return false;
  if (w.modul !== undefined && w.modul !== p.meta.modulAiAct) return false;
  if (w.modulNistRmf !== undefined && (p.meta.modulNistRmf ?? false) !== w.modulNistRmf) return false;
  if (w.generativ !== undefined && p.kiSysteme.some((s) => s.generativ === true && s.status !== 'abgeloest' && s.status !== 'untersagt') !== w.generativ) return false;
  if (w.typ && !p.kiSysteme.some((s) => s.typ === w.typ)) return false;
  if (w.rolle && !p.kiSysteme.some((s) => s.aiAct.rollen.includes(w.rolle as never))) return false;
  if (w.entwickeltKi !== undefined && w.entwickeltKi !== p.organisation.entwickeltKi) return false;
  if (w.verkauftKiProdukte !== undefined && w.verkauftKiProdukte !== p.organisation.verkauftKiProdukte) return false;
  return true;
}

/** Etappen und besuchte Seiten aus src/gefuehrt */
export function etappenStand(p: Projekt, erledigt: string[], inArbeit: string[]): Projekt['meta']['gefuehrt']['etappen'] {
  const seiten: Record<string, { wenn?: Wenn }> = {};
  for (const d of readdirSync(`${SRC}gefuehrt/seiten`)) {
    for (const s of (parse(readFileSync(`${SRC}gefuehrt/seiten/${d}`, 'utf8')) as { seiten: { id: string; wenn?: Wenn }[] }).seiten) seiten[s.id] = s;
  }
  const ergebnis: Projekt['meta']['gefuehrt']['etappen'] = {};
  for (const e of etappenYaml()) {
    if (!trifft(p, e.wenn)) continue;
    const besucht = e.seiten.filter((id) => trifft(p, seiten[id]?.wenn));
    if (erledigt.includes(e.id)) ergebnis[e.id] = { status: 'erledigt', spaeter: [], besucht };
    else if (inArbeit.includes(e.id)) ergebnis[e.id] = { status: 'in-arbeit', spaeter: [], besucht: besucht.slice(0, Math.max(1, besucht.length - 1)) };
    else ergebnis[e.id] = { status: 'offen', spaeter: [], besucht: [] };
  }
  return ergebnis;
}

/** Checklisten-IDs je Etappe (mit Bedingungen) */
export function etappenChecklisten(p: Projekt): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const e of etappenYaml()) r[e.id] = e.checkliste.filter((c) => typeof c === 'string' || trifft(p, c.wenn)).map((c) => (typeof c === 'string' ? c : c.id));
  return r;
}

/** Stilregeln in allen Texten: kein Eszett, keine Gedankenstriche, kein Kit-Absender; EN mit ‘…’ statt Guillemets (wie Tor G5) */
export function stilPruefen(p: unknown, name: string): void {
  const s = JSON.stringify(p);
  const fehler: string[] = [];
  if (/\u00df/.test(s)) fehler.push('Eszett');
  if (/[\u2013\u2014]/.test(s)) fehler.push('Gedankenstrich');
  if (/kmu-cio/i.test(s)) fehler.push('kmu-cio');
  if (/\.en\./.test(name) && /[\u00ab\u00bb\u2039]|(?<! )\u203a|\u203a(?! )/.test(s)) fehler.push('Guillemets im englischen Text (‘…’ verwenden)');
  if (fehler.length) throw new Error(`${name}: ${fehler.join(', ')}`);
}

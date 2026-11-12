// D-22 Nichtkonformitäten, Korrekturmassnahmen und Verbesserungen (10.1, 10.2)
import type { XlsxBlatt, XlsxMappe, XlsxSpalte, Zellwert } from '../generator/ir.ts';
import type { Feststellung } from '../model/typen.ts';
import { erstelleHelfer, type VorlagenKontext } from './kontext.ts';

export function d22(ctx: VorlagenKontext): XlsxMappe {
  const h = erstelleHelfer(ctx);
  const { u, projekt } = ctx;
  const k = (s: string) => `vorlagen.D-22.${s}`;
  const liste = (s: string) => u.liste(k(`listen.${s}`));
  const eb = ctx.form === 'ergaenzungsblatt';
  const text = (kopf: string, breite = 18, umbruch = true): XlsxSpalte => ({ kopf, breite, umbruch });
  const personName = (id?: string) => projekt.personen.find((p) => p.id === id)?.name ?? id ?? '';
  // Spalte «Bereich» (AIMS, ISMS, beide): Feststellungen dieses Registers betreffen das AIMS. Firmendokument ohne ISMS:
  // Spalte entfällt (es gibt kein ISMS, das betroffen sein könnte)
  const bereich = liste('bereich')[0]!;
  const mitBereich = h.istLeer || projekt.meta.mitIsms;
  const ohneBereich = <T>(z: T[], index: number): T[] => (mitBereich ? z : z.filter((_, i) => i !== index));

  const quelle = (f: Feststellung): string => {
    const q = liste('quelle');
    if (f.quelle === 'audit') return q[projekt.audits.find((a) => a.id === f.audit)?.art === 'intern' || !f.audit ? 0 : 1]!;
    // «Beinahe-Vorfall» (ab rc.2): Ereignis ohne Schaden, gezählt mit Fehlern und Vorfällen an einem Ort
    const index: Record<Exclude<Feststellung['quelle'], 'audit'>, number> = { managementbewertung: 2, vorfall: 3, 'beinahe-vorfall': 4, pruefung: 5, meldung: 6 };
    return q[index[f.quelle]]!;
  };
  const status = (f: Feststellung): string => {
    const s = liste('status');
    if (f.status === 'geschlossen') return s[3]!;
    // In Arbeit: «Wirksamkeit offen», sobald alle Massnahmen erledigt sind und die Wirksamkeitsprüfung aussteht
    if (f.status === 'in-arbeit') {
      const ms = projekt.massnahmen.filter((x) => f.massnahmen.includes(x.id));
      return s[ms.length && ms.every((x) => x.status === 'erledigt') && !f.wirksamkeit ? 2 : 1]!;
    }
    return s[0]!;
  };

  const systemName = (id?: string) => {
    const s = projekt.kiSysteme.find((x) => x.id === id);
    return s ? `${s.id} ${s.name}` : (id ?? '');
  };
  // Methode der Ursachenanalyse auf den Listenwert abbilden («5 Warum» = «5-Warum»), sonst Freitext
  const methode = (m?: string) => {
    if (!m) return '';
    const norm = (x: string) => x.toLowerCase().replace(/[\s-]+/g, '');
    return liste('methode').find((x) => norm(x) === norm(m)) ?? m;
  };
  // Schweregrad bei Vorfällen und Beinahe-Vorfällen (Stufen wie D-14): «2 mittel»
  const schwere = (f: Feststellung) => (f.schwere ? `${f.schwere} ${liste('schwere')[f.schwere - 1] ?? ''}`.trim() : '');
  const jaNein = (b?: boolean) => (b === undefined ? '' : liste('ja_nein')[b ? 0 : 1]!);
  // Entdeckung und Eindämmung (ab Schemaversion 3, AF-104): Datum im Format der Sprache und Uhrzeit, Datenquelle PR-19
  const zeitpunkt = (z?: string) => (z ? `${h.datum(z.slice(0, 10)) ?? z.slice(0, 10)}${/T\d{2}:\d{2}/.test(z) ? ` ${z.slice(11, 16)}` : ''}` : '');
  // Betroffener Prozess (Feststellung.bereich) vor der Beschreibung; die Spalte «Bereich» meint ISMS/AIMS
  // Später erfasst als das Ereignis (Feststellung.erfasstAm): Datum der Erfassung, ab dem die Kennung gilt
  const erfasst = (f: Feststellung) => (f.erfasstAm && f.erfasstAm !== f.datum ? ` ${u.t(k('erfasst_am'), { datum: h.datum(f.erfasstAm) ?? f.erfasstAm })}` : '');
  const beschreibung = (f: Feststellung) => `${f.bereich ? `${f.bereich}: ${f.beschreibung}` : f.beschreibung}${erfasst(f)}`;

  // Nichtkonformitäten (ohne Verbesserungen)
  const nkZeilen: Zellwert[][] = h.istLeer
    ? []
    : projekt.feststellungen
        .filter((f) => f.einstufung !== 'verbesserung')
        .map((f) => {
          const m = projekt.massnahmen.filter((x) => f.massnahmen.includes(x.id));
          const audit = projekt.audits.find((a) => a.id === f.audit);
          return [
            f.id,
            f.datum ?? audit?.durchgefuehrt ?? '',
            quelle(f),
            liste('einstufung')[['nk-schwer', 'nk-leicht', 'beobachtung'].indexOf(f.einstufung)]!,
            bereich,
            beschreibung(f),
            f.normbezug,
            systemName(f.kiSystem),
            schwere(f),
            zeitpunkt(f.entdecktAm),
            zeitpunkt(f.eingedaemmtAm),
            f.korrektur,
            f.ursache,
            methode(f.ursacheMethode),
            f.ursacheKategorie ?? '',
            f.aehnlicheFaelle ?? '',
            m.map((x) => x.titel).join('; '),
            f.massnahmen.join(', '),
            personName(m[0]?.verantwortlich),
            m[0]?.termin ?? '',
            f.wirksamkeitGeplant ?? '',
            f.wirksamkeit?.am ?? '',
            f.wirksamkeit?.ergebnis ?? '',
            jaNein(f.risikoAngepasst),
            f.meldepflicht ? liste('ja_nein')[['ja', 'nein', 'nicht-noetig'].indexOf(f.meldepflicht)]! : '',
            status(f),
          ];
        });
  // Spalten «Entdeckt» und «Eingedämmt» nach «Schwere (Vorfall)»; eigene Liste, damit die Schlüssel spalten_nk.<n> bleiben
  const sv = u.liste(k('spalten_vorfall'));
  const sp = u.liste(k('spalten_nk'));
  // Ergänzungsblatt im Firmendokument: Auszug der Nichtkonformitäten aus dem führenden Register (aufgenommenIn)
  const auszug = eb && !h.istLeer;
  const register = h.istLeer ? undefined : h.dokEintrag('D-22-EB')?.aufgenommenIn?.trim();
  const nk: XlsxBlatt = {
    name: u.t(k('blaetter.nk')),
    titel: u.t(k(auszug ? 'titel_nk_auszug' : 'titel_nk')),
    hinweise: h.istLeer
      ? u.liste(k('hinweise_nk'))
      : ((l: string[]) => (l.length ? l : undefined))([
          ...(auszug ? [register ? u.t(k('auszug_register'), { register }) : u.t(k('auszug_ohne_register'))] : []),
          // Nachgetragene Einträge: Kennungen fortlaufend nach Erfassung, für alle Quellen gemeinsam
          ...(projekt.feststellungen.some((f) => f.erfasstAm && f.erfasstAm !== f.datum) ? [u.t(k('kennung_nach_erfassung'))] : []),
        ]),
    fixiert: true,
    spalten: ohneBereich<XlsxSpalte>(
      [
        text(sp[0]!, 9, false),
        { kopf: sp[1]!, breite: 12, typ: 'datum' },
        { kopf: sp[2]!, breite: 18, typ: 'liste', liste: liste('quelle') },
        { kopf: sp[3]!, breite: 13, typ: 'liste', liste: liste('einstufung') },
        { kopf: sp[4]!, breite: 9, typ: 'liste', liste: liste('bereich') },
        text(sp[5]!, 40),
        text(sp[6]!, 12),
        text(sp[7]!, 12),
        { kopf: sp[8]!, breite: 13, typ: 'liste', liste: liste('schwere').map((x, i) => `${i + 1} ${x}`) },
        text(sv[0]!, 16, false),
        text(sv[1]!, 16, false),
        text(sp[9]!, 30),
        text(sp[10]!, 34),
        { kopf: sp[11]!, breite: 16, typ: 'liste', liste: liste('methode') },
        { kopf: sp[12]!, breite: 16, typ: 'liste', liste: liste('ursache_ki') },
        text(sp[13]!, 24),
        text(sp[14]!, 34),
        text(sp[15]!, 11),
        text(sp[16]!, 18),
        { kopf: sp[17]!, breite: 12, typ: 'datum' },
        { kopf: sp[18]!, breite: 12, typ: 'datum' },
        { kopf: sp[19]!, breite: 12, typ: 'datum' },
        text(sp[20]!, 28),
        { kopf: sp[21]!, breite: 14, typ: 'liste', liste: liste('ja_nein') },
        { kopf: sp[22]!, breite: 14, typ: 'liste', liste: liste('ja_nein') },
        { kopf: sp[23]!, breite: 14, typ: 'liste', liste: liste('status') },
      ],
      4,
    ),
    zeilen: nkZeilen.map((z) => ohneBereich(z, 4)),
    leereZeilen: h.istLeer ? 30 : 10,
  };

  // Verbesserungen (aus Feststellungen mit Einstufung «verbesserung»)
  const vbZeilen: Zellwert[][] = h.istLeer
    ? []
    : projekt.feststellungen
        .filter((f) => f.einstufung === 'verbesserung')
        .map((f) => {
          const m = projekt.massnahmen.find((x) => f.massnahmen.includes(x.id));
          const prio = m ? liste('prioritaet')[['hoch', 'mittel', 'tief'].indexOf(m.prioritaet)]! : '';
          // Stand der Verbesserung auch aus der Massnahme: beschlossen (Massnahme vorhanden) heisst «freigegeben»
          const st =
            liste('status_verbesserung')[
              f.status === 'geschlossen' || m?.status === 'erledigt'
                ? 3
                : m?.status === 'verworfen'
                  ? 4
                  : f.status === 'in-arbeit' || m?.status === 'in-arbeit'
                    ? 2
                    : m
                      ? 1
                      : 0
            ]!;
          // Ergebnis: Wirksamkeit der Verbesserung, sonst Abschluss der Massnahme
          const ergebnis = f.wirksamkeit?.ergebnis?.trim() || (m?.status === 'erledigt' ? u.t(k('ergebnis_massnahme'), { id: m.id, datum: h.datum(m.erledigtAm ?? m.termin) ?? '', beschreibung: m.beschreibung.trim().replace(/\.$/, '') }) : '');
          return [f.id, f.datum ?? '', beschreibung(f), quelle(f), bereich, prio, personName(m?.verantwortlich), m?.start ?? '', m?.erledigtAm ?? m?.termin ?? '', st, ergebnis];
        });
  // Geplante Änderungen am AIMS (6.3): Massnahmen mit Herkunft «aenderung» (Regeln in D-26)
  const statusMassnahme = (s: string) => liste('status_verbesserung')[s === 'erledigt' ? 3 : s === 'verworfen' ? 4 : s === 'in-arbeit' ? 2 : 1]!;
  const aenderungZeilen: Zellwert[][] = h.istLeer
    ? []
    : projekt.massnahmen
        .filter((m) => m.herkunft.art === 'aenderung')
        .map((m) => [
          m.id,
          m.erfasstAm ?? m.start ?? '',
          `${m.titel}: ${m.beschreibung}`,
          liste('quelle').at(-1)!,
          bereich,
          liste('prioritaet')[['hoch', 'mittel', 'tief'].indexOf(m.prioritaet)]!,
          personName(m.verantwortlich),
          m.start ?? '',
          m.erledigtAm ?? m.termin ?? '',
          statusMassnahme(m.status),
          m.status === 'erledigt' ? u.t(k('ergebnis_massnahme'), { id: m.id, datum: h.datum(m.erledigtAm ?? m.termin) ?? '', beschreibung: m.beschreibung.trim().replace(/\.$/, '') }) : '',
        ]);
  const spV = u.liste(k('spalten_verbesserungen'));
  const verbesserungen: XlsxBlatt = {
    name: u.t(k('blaetter.verbesserungen')),
    titel: u.t(k('titel_verbesserungen')),
    hinweise: h.istLeer ? u.liste(k('hinweise_verbesserungen')) : undefined,
    fixiert: true,
    spalten: ohneBereich<XlsxSpalte>([
      text(spV[0]!, 8, false),
      { kopf: spV[1]!, breite: 12, typ: 'datum' },
      text(spV[2]!, 44),
      { kopf: spV[3]!, breite: 18, typ: 'liste', liste: liste('quelle') },
      { kopf: spV[4]!, breite: 9, typ: 'liste', liste: liste('bereich') },
      { kopf: spV[5]!, breite: 10, typ: 'liste', liste: liste('prioritaet') },
      text(spV[6]!, 18),
      { kopf: spV[7]!, breite: 12, typ: 'datum' },
      { kopf: spV[8]!, breite: 12, typ: 'datum' },
      { kopf: spV[9]!, breite: 14, typ: 'liste', liste: liste('status_verbesserung') },
      text(spV[10]!, 30),
    ], 4),
    zeilen: [...vbZeilen, ...aenderungZeilen].map((z) => ohneBereich(z, 4)),
    leereZeilen: h.istLeer ? 20 : 5,
  };

  // Meldungen, Rückmeldungen und Einsprüche (projekt.meldungen): Register nach D-04 (Meldeweg) und D-14 (Meldekanal,
  // Einspruch), mit Tagen bis zur Eingangsbestätigung; Abweichungen daraus stehen als Feststellung im Blatt
  // «Nichtkonformitäten»
  const ARTEN = ['bedenken', 'rueckmeldung', 'einspruch', 'beschwerde'];
  const HERKUNFT = ['intern', 'extern'];
  const STATUS_M = ['offen', 'in-arbeit', 'erledigt'];
  const tage = (von?: string, bis?: string) => (von && bis ? String(Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000)) : '');
  const meldungZeilen: Zellwert[][] = h.istLeer
    ? []
    : [...(projekt.meldungen ?? [])]
        .sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id))
        .map((m) => [
          m.id,
          m.datum,
          liste('meldung_art')[ARTEN.indexOf(m.art)] ?? m.art,
          liste('meldung_herkunft')[HERKUNFT.indexOf(m.herkunft)] ?? m.herkunft,
          m.kanal ?? '',
          systemName(m.kiSystem),
          m.beschreibung,
          personName(m.bearbeitung),
          m.bestaetigtAm ?? '',
          tage(m.datum, m.bestaetigtAm),
          m.erledigtAm ?? '',
          m.ergebnis ?? '',
          liste('meldung_status')[STATUS_M.indexOf(m.status)] ?? m.status,
        ]);
  const spM = u.liste(k('spalten_meldungen'));
  const meldungen: XlsxBlatt = {
    name: u.t(k('blaetter.meldungen')),
    titel: u.t(k('titel_meldungen')),
    hinweise: h.istLeer ? u.liste(k('hinweise_meldungen')) : undefined,
    fixiert: true,
    spalten: [
      text(spM[0]!, 9, false),
      { kopf: spM[1]!, breite: 12, typ: 'datum' },
      { kopf: spM[2]!, breite: 14, typ: 'liste', liste: liste('meldung_art') },
      { kopf: spM[3]!, breite: 10, typ: 'liste', liste: liste('meldung_herkunft') },
      text(spM[4]!, 18),
      text(spM[5]!, 18),
      text(spM[6]!, 44),
      text(spM[7]!, 18),
      { kopf: spM[8]!, breite: 12, typ: 'datum' },
      text(spM[9]!, 10, false),
      { kopf: spM[10]!, breite: 12, typ: 'datum' },
      text(spM[11]!, 36),
      { kopf: spM[12]!, breite: 12, typ: 'liste', liste: liste('meldung_status') },
    ],
    zeilen: meldungZeilen,
    leereZeilen: h.istLeer ? 20 : meldungZeilen.length ? 0 : 3,
  };

  // Ergänzungsblatt: nur die Felder, die das bestehende ISMS-Register für KI braucht
  const spZ = u.liste(k('spalten_zusatz'));
  const zusatz: XlsxBlatt = {
    name: u.t(k('blaetter.zusatz')),
    titel: u.t(k('titel_zusatz')),
    hinweise: h.istLeer ? u.liste(k('hinweise_zusatz')) : [register ? u.t(k('zusatz_firma_register'), { register }) : u.t(k('zusatz_firma'))],
    spalten: [text(spZ[0]!, 26), text(spZ[1]!, 50), text(spZ[2]!, 40), text(spZ[3]!, 16)],
    zeilen: u.roh(k('zusatz_zeilen')) as string[][],
  };

  const id = eb ? 'D-22-EB' : 'D-22';
  return {
    sprache: u.sprache,
    eigenschaften: h.eigenschaften(id),
    lenkung: h.lenkung(id),
    firmenname: h.firmenname(),
    hinweisBlock: [...h.kitBlock(), h.normverweis('10.1, 10.2'), ...(h.istLeer ? h.ausbau(k('ausbau'), []) : [])],
    blaetter: eb ? (auszug ? [zusatz, nk, verbesserungen, meldungen] : [zusatz, verbesserungen, meldungen]) : [nk, verbesserungen, meldungen],
  };
}

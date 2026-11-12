// Baut den Skill-Ordner iso42001-kmu/ und das Skill-ZIP (Ordner auf oberster Ebene).
// Aufruf: npx tsx scripts/skill.mts --ziel <ordner> [--kit <kit-wurzel>]
//   --kit: Kit-Wurzel mit den leeren Vorlagen (DE/01_Vorlagen usw.), daraus entstehen assets/de und assets/en
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'yaml';
import { zipErstellen } from '../src/generator/zip.ts';
import { ladeTexte } from '../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../src/i18n/texte.ts';
import { ladeKataloge } from '../src/kataloge/laden-node.ts';
import { alleControls42001 } from '../src/kataloge/typen.ts';
import { nistZitat, type ZitatArt } from '../src/nist-rmf/original.ts';
import { KIT_VERSION } from '../src/model/neu.ts';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const ziel = arg('--ziel') ?? 'dist/skill';
const kit = arg('--kit');
const NAME = 'iso42001-kmu';
const ordner = join(ziel, NAME);
rmSync(ordner, { recursive: true, force: true });
mkdirSync(ordner, { recursive: true });

const schreibe = (pfad: string, inhalt: string | Uint8Array) => {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
};

// 1. Handgeschriebene Teile
cpSync('src/skill/SKILL.md', join(ordner, 'SKILL.md'));
cpSync('src/skill/agents', join(ordner, 'agents'), { recursive: true });
cpSync('src/skill/references', join(ordner, 'references'), { recursive: true });
// Version aus package.json (AF-177): Platzhalter {{version}} vor dem ZIP einsetzen, Ordner und ZIP gleich
for (const d of ['SKILL.md', join('references', 'json-ausgabe.md')]) {
  const p = join(ordner, d);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('{{version}}', KIT_VERSION));
}

// 2. Generierte Referenzen aus den Katalogen
const kataloge = ladeKataloge();
const sprachen = ['de', 'en'] as const;
const u = Object.fromEntries(sprachen.map((s) => [s, erstelleUebersetzer(s, ladeTexte(s))])) as Record<'de' | 'en', ReturnType<typeof erstelleUebersetzer>>;

{
  const z: string[] = ['# Controls ISO/IEC 42001 Anhang A / Annex A', '', 'Eigene Kurzbezeichnungen und Erläuterungen, kein Normtext. Den Anforderungstext lesen Sie in Ihrer eigenen Normausgabe nach. / Own short titles and explanations, no standard text.', ''];
  for (const c of alleControls42001(kataloge)) {
    const de = u.de.roh(`controls42001.controls.${c.id}`) as Record<string, string>;
    const en = u.en.roh(`controls42001.controls.${c.id}`) as Record<string, string> | undefined;
    z.push(`## ${c.id} ${de.titel}${en ? ` / ${en.titel}` : ''}`, '');
    z.push(`- Zweck: ${de.zweck}`, `- Umsetzung (KMU): ${de.umsetzung}`, `- Nachweis: ${de.nachweis}`, `- Auditor: ${de.auditor}`, `- Kit-Vorlagen: ${c.vorlagen.join(', ')}`);
    if (en) z.push(`- Purpose: ${en.zweck}`, `- Implementation (SME): ${en.umsetzung}`, `- Evidence: ${en.nachweis}`, `- Auditor: ${en.auditor}`);
    z.push('');
  }
  schreibe(join(ordner, 'references', 'controls-42001.md'), z.join('\n'));
}
{
  const euaia = (kataloge as unknown as { aiact_euaiaControls: { controls?: { id: string; artikel: string[] | string; rollen: string[]; verwandt_42001?: string[] }[] } }).aiact_euaiaControls;
  const liste = euaia.controls ?? (Object.values(euaia).find(Array.isArray) as { id: string; artikel: string[] | string; rollen: string[]; verwandt_42001?: string[] }[]);
  const z: string[] = ['# Zusatz-Controls EU AI Act (EUAIA-xx) / Additional controls', '', 'Stand: konsolidierte Fassung der Verordnung (EU) 2024/1689 vom 27.07.2026. Keine Rechtsberatung. / Not legal advice.', ''];
  for (const c of liste) {
    const de = u.de.roh(`euaia.${c.id}`) as Record<string, string> | undefined;
    const en = u.en.roh(`euaia.${c.id}`) as Record<string, string> | undefined;
    const titelDe = de?.titel ?? de?.kurz ?? Object.values(de ?? {})[0] ?? '';
    const titelEn = en?.titel ?? en?.kurz ?? Object.values(en ?? {})[0] ?? '';
    z.push(`## ${c.id} ${titelDe}${titelEn ? ` / ${titelEn}` : ''}`, '', `- Artikel: ${[c.artikel].flat().join(', ')}`, `- Rollen: ${c.rollen.join(', ')}`, `- Verwandte 42001-Controls: ${(c.verwandt_42001 ?? []).join(', ')}`);
    for (const [k, v] of Object.entries(de ?? {})) if (typeof v === 'string' && k !== 'titel') z.push(`- ${k}: ${v}`);
    z.push('');
  }
  schreibe(join(ordner, 'references', 'euaia-controls.md'), z.join('\n'));
}
// Modul NIST AI RMF und GenAI-Sicherheit: Kopf mit Quelle, Nutzungsrecht und Vermerk (NIST bittet darum, wo seine Inhalte genutzt werden)
const NIST_KOPF = [
  'Nur mit Modul NIST AI RMF (`meta.modulNistRmf: true`), ausser wo vermerkt. Eigene Kurztitel und Texte des Kits; Texte von NIST nur als gekennzeichnete Zitate («Original (NIST, wörtlich)», Englisch, mit Seite im PDF) und mit eigener Übersetzung («Übersetzung KMU-CIO, nicht amtlich»). Zitate wörtlich wiedergeben, nicht umformulieren; die Übersetzung nie als NIST-Text ausgeben. Das AI RMF ist ein freiwilliges Rahmenwerk; NIST zertifiziert nicht. / Module only. Own short titles and wording; NIST texts only as marked verbatim quotations with page; voluntary framework, no certification by NIST.',
  '',
  'Quellen / Sources: NIST AI 100-1, AI RMF 1.0 (January 2023), https://doi.org/10.6028/NIST.AI.100-1; NIST AI 600-1, Generative AI Profile (July 2024), https://doi.org/10.6028/NIST.AI.600-1. Republished courtesy of the National Institute of Standards and Technology. Die Nennung bedeutet keine Billigung durch NIST. / No endorsement by NIST implied.',
  '',
];
const iso = (ids: string[]) => ids.map((x) => x.replace(/^K-/, '')).join(', ');
const nist = kataloge.nistrmf_subkategorien;
const rmfControls = kataloge.nistrmf_rmfControls?.controls ?? [];
const gaiRisiken = kataloge.nistrmf_genaiRisiken?.risiken ?? [];
const merkmale = kataloge.nistrmf_merkmale?.merkmale ?? [];
const nistStand = kataloge.nistrmf_stand;
// Wörtliche Auszüge mit eigener Übersetzung (src/nist-rmf/original-*.yaml)
const zitat = (art: ZitatArt, id: string): string[] => {
  const z = nistZitat(kataloge, art, id);
  if (!z) return [];
  const seite = z.bisSeite ? `S. ${z.seite} bis ${z.bisSeite}` : `S. ${z.seite}`;
  return [`- Original (NIST, wörtlich; ${z.quelle.dokument}, ${seite}): «${z.titel ? `${z.titel}: ` : ''}${z.zitat}»`, `- Übersetzung KMU-CIO, nicht amtlich: ${z.titelDe ? `${z.titelDe}: ` : ''}${z.de}`];
};
{
  // Subkategorien mit Zuordnung zu ISO/IEC 42001 und zum Kit, Lite-Massnahmen, Nachweise; Vertrauensmerkmale; Stand
  const z: string[] = ['# NIST AI RMF: 72 Subkategorien / subcategories', '', ...NIST_KOPF];
  if (nist && nistStand) {
    const grad = (feld: 'abdeckung' | 'abdeckung_kit', g: string) => nist.subkategorien.filter((x) => x[feld] === g).length;
    z.push(
      '## Stand und Bilanz / Status and coverage',
      '',
      `- Stand geprüft am ${nistStand.geprueft_am}; Hinweis im Werkzeug nach ${nistStand.hinweis_nach_monaten} Monaten. ${u.de.t('nist.stand.revision')}`,
      `- Fassungen: ${nistStand.fassungen.map((f) => u.de.t(`nist.stand.fassungen.${f.id}`)).join('; ')}`,
      `- Abdeckung durch ISO/IEC 42001 (Norm): ${grad('abdeckung', 'ganz')} ganz, ${grad('abdeckung', 'teilweise')} teilweise, ${grad('abdeckung', 'nicht')} nicht.`,
      `- Abdeckung durch das Kit ohne Modul: ${grad('abdeckung_kit', 'ganz')} ganz, ${grad('abdeckung_kit', 'teilweise')} teilweise, ${grad('abdeckung_kit', 'nicht')} nicht. Mit Modul: jede Subkategorie ganz oder mit Zusatz-Control RMF-xx bzw. Präzisierung (Hinweis in bestehender Vorlage).`,
      '- Ist- und Zielstufen im Profil (`nistProfil[<id>].ist`, `.ziel`): 0 nicht erreicht, 1 teilweise, 2 erreicht (festgelegt und angewendet), 3 wirksam (überprüft). / 0 not achieved, 1 partly, 2 achieved, 3 effective (reviewed).',
      '',
      '## Vertrauensmerkmale / Trustworthiness characteristics',
      '',
      'Schlüssel für `kiSysteme[].messkonzept.merkmale` und `messkonzept.pruefungen[].merkmal`:',
      '',
    );
    for (const m of merkmale) {
      const o = nistZitat(kataloge, 'merkmal', m.id);
      z.push(`- \`${m.id}\`: ${u.de.t(`nist.merkmale.${m.id}.titel`)} / ${u.en.t(`nist.merkmale.${m.id}.titel`)} (Ziele in D-09: ${m.ziele_d09.join(', ')}; Subkategorien ${m.subkategorien.join(', ')})${o ? `; NIST AI 100-1 Abschnitt ${m.abschnitt_100_1}, S. ${o.seite}: «${o.zitat}» (Übersetzung: ${o.de})` : ''}`);
    }
    z.push('');
    for (const f of nist.funktionen) {
      z.push(`## ${f.nist_id} (${f.kuerzel}): ${u.de.t(`nist.funktionen.${f.id}.titel`)} / ${u.en.t(`nist.funktionen.${f.id}.titel`)}`, '', u.de.t(`nist.funktionen.${f.id}.kurz`), '', ...zitat('funktion', f.id), '');
      for (const kat of nist.kategorien.filter((x) => x.funktion === f.id)) z.push(`### Kategorie ${kat.id} (${kat.nist_id})`, '', ...zitat('kategorie', kat.id), '');
      for (const sk of nist.subkategorien.filter((x) => x.funktion === f.id)) {
        const de = u.de.roh(`nist.subkategorien.${sk.id}`) as { titel: string; massnahmen?: string[]; nachweise?: string[]; praezisierung?: string; genai?: string; revision?: string };
        const en = u.en.roh(`nist.subkategorien.${sk.id}`) as { titel: string } | undefined;
        z.push(`### ${sk.id} (${sk.nist_id}) ${de.titel}${en ? ` / ${en.titel}` : ''}`, '');
        z.push(...zitat('subkategorie', sk.id));
        z.push(`- ISO/IEC 42001: ${iso(sk.iso42001)}`);
        z.push(`- Abdeckung Norm: ${sk.abdeckung}; Kit ohne Modul: ${sk.abdeckung_kit}`);
        z.push(`- Kit: ${sk.kit.join(', ')}${sk.nist_vorlagen?.length ? `; Modul: ${sk.nist_vorlagen.join(', ')}` : ''}${sk.pruefregeln?.length ? `; Prüfregeln: ${sk.pruefregeln.join(', ')}` : ''}`);
        if (sk.zusatz_control) z.push(`- Zusatz-Control: ${sk.zusatz_control}`);
        if (sk.praezisierung && de.praezisierung) z.push(`- Präzisierung (kein Control): ${de.praezisierung}`);
        z.push(`- Stufe: ${sk.stufe}; Etappe: ${sk.etappe}; GenAI-Massnahmen in 600-1: ${sk.genai_600_1}`);
        if (de.massnahmen?.length) z.push(`- Lite-Massnahmen: ${de.massnahmen.join(' ')}`);
        if (de.nachweise?.length) z.push(`- Nachweise: ${de.nachweise.join('; ')}`);
        if (de.genai) z.push(`- ${de.genai}`);
        if (sk.revision_hinweis && de.revision) z.push(`- Revision: ${de.revision}`);
        z.push('');
      }
    }
  }
  schreibe(join(ordner, 'references', 'rmf-subkategorien.md'), z.join('\n'));
}
{
  // Zusatz-Controls des Moduls NIST AI RMF (RMF-xx, RMF-Gxx), aus src/nist-rmf/rmf-controls.yaml und nist.yaml
  const z: string[] = ['# Zusatz-Controls NIST AI RMF (RMF-xx) / Additional controls', '', ...NIST_KOPF, 'In der SoA (D-11) als `rahmenwerk: "NISTRMF"`, `vorschlag: "nistrmf"`. RMF-Gxx nur für Systeme mit `generativ: true`. «Betreiber-Lite»: auch für reine Betreiber eingekaufter KI sinnvoll (verkürzte Form).', ''];
  for (const c of rmfControls) {
    const de = u.de.roh(`nist.controls.${c.id}`) as Record<string, string>;
    const en = u.en.roh(`nist.controls.${c.id}`) as Record<string, string> | undefined;
    z.push(`## ${c.id} ${de.titel}${en ? ` / ${en.titel}` : ''}`, '');
    z.push(`- Art: ${c.art}; Betreiber-Lite: ${c.betreiber_lite ? 'ja' : 'nein'}`, `- Subkategorien: ${c.subkategorien.join(', ')}`);
    if (c.risiken?.length) z.push(`- GenAI-Risiken (600-1): ${c.risiken.join(', ')}`);
    z.push(`- Verwandte 42001: ${iso(c.verwandt_42001)}; verwandte 27001: ${c.verwandt_27001.join(', ') || 'keine'}`, `- Kit-Vorlagen: ${[...c.kit, ...c.nist_vorlagen].join(', ')}`, `- Vorschlag wenn: ${JSON.stringify(c.vorschlag_wenn)}`);
    if (c.bezug_600_1.length) z.push(`- Bezug 600-1 (Originaltexte in genai-profil.md): ${c.bezug_600_1.join(', ')}`);
    for (const f of ['zweck', 'umsetzung', 'nachweis']) if (de[f]) z.push(`- ${f}: ${de[f]}`);
    z.push('');
  }
  schreibe(join(ordner, 'references', 'rmf-controls.md'), z.join('\n'));
}
{
  // GenAI-Profil NIST AI 600-1: 12 Risiken mit Kurztitel, KMU-Relevanz, Merkmalen, Controls und typischem KMU-Fall
  const z: string[] = ['# GenAI-Profil NIST AI 600-1: 12 Risiken / 12 risks of generative AI', '', ...NIST_KOPF];
  z.push('Bewertung je System mit `generativ: true` in `kiSysteme[].genaiBewertung["<risiko-id>"] = { "relevant": "ja"|"nein"|"offen", "begruendung": "...", "massnahme": "..." }` (Vorlage N-04, Prüfregeln F28, H39). Für reine Betreiber eingekaufter generativer KI sind meist 2, 4, 7, 9, 10 und 12 relevant.', '');
  z.push('| Nr | ID | Kurztitel (DE) | Short title (EN) | 600-1 | KMU-Relevanz | Controls |', '|---|---|---|---|---|---|---|');
  for (const r of [...gaiRisiken].sort((a, b) => a.nr - b.nr)) {
    z.push(`| ${r.nr} | \`${r.id}\` | ${u.de.t(`nist.genai_risiken.${r.id}.titel`)} | ${u.en.t(`nist.genai_risiken.${r.id}.titel`)} | ${r.abschnitt_600_1} | ${r.kmu_relevanz} | ${r.controls.join(', ') || 'Präzisierung'} |`);
  }
  z.push('');
  for (const r of [...gaiRisiken].sort((a, b) => a.nr - b.nr)) {
    const de = u.de.roh(`nist.genai_risiken.${r.id}`) as { titel: string; kmu_fall: string; praezisierung?: string };
    z.push(`## ${r.nr} ${de.titel} (\`${r.id}\`)`, '', ...zitat('risiko', r.id), `- Typischer KMU-Fall: ${de.kmu_fall}`, `- Vertrauensmerkmale: ${r.merkmale.join(', ')}`, `- Subkategorien: ${r.subkategorien.join(', ')}`, `- Controls: ${r.controls.join(', ') || 'keins'}`);
    if (de.praezisierung) z.push(`- ${de.praezisierung}`);
    z.push('');
  }
  // Massnahmen aus 600-1, auf die sich die Zusatz-Controls stützen (bezug_600_1), wörtlich mit eigener Übersetzung
  const massnahmen = kataloge.nistrmf_original6001?.massnahmen ?? [];
  if (massnahmen.length) {
    z.push('## Massnahmen aus NIST AI 600-1, auf die sich die Zusatz-Controls stützen / Suggested actions referenced by the kit', '');
    for (const m of massnahmen) {
      const controls = rmfControls.filter((c) => c.bezug_600_1.includes(m.id)).map((c) => c.id);
      z.push(`### ${m.id} (Subkategorie ${m.subkategorie}; Controls ${controls.join(', ')})`, '', ...zitat('massnahme', m.id), '');
    }
  }
  schreibe(join(ordner, 'references', 'genai-profil.md'), z.join('\n'));
}
{
  // Vorschlagsliste GenAI-Sicherheit GS-01 bis GS-22 (Kern, auch ohne Modul; D-07), aus src/kataloge/genai-risiken.yaml
  type Q = { titel: string; herausgeber: string; url: string; lizenz: string; stand: string };
  const gs = kataloge['genaiRisiken'] as unknown as { quelle: Q; quelle_agenten?: Q; risiken: { id: string; bereich?: string; owasp?: string; nur_handelnd?: boolean; nist_600_1?: string[]; quelle: string; ebenen: string[]; controls: string[]; zielgruppe: string[] }[] } | undefined;
  const z: string[] = [`# GenAI-Sicherheit GS-01 bis GS-${gs ? String(gs.risiken.length).padStart(2, '0') : '22'} / GenAI security`, ''];
  if (gs) {
    z.push(
      'Kernbestand des Kits, gilt auch ohne Modul: Vorschlagsliste in D-07 (Blatt «Vorschläge GenAI-Sicherheit») für Systeme mit generativer KI. Übernehmen Sie passende Einträge als eigene Risiken (`risiken[]` mit `kiSystem`, eigener Bewertung von `w` und `a`), nie als Pauschalliste für alle Systeme. Zielgruppe «betreiber»: schon bei reiner Nutzung relevant; «entwickler»: erst bei eigenem Chatbot, eigener Anwendung oder Entwicklung. Bereich «agenten» (GS-11 bis GS-16, «nur handelnd»): nur für Systeme mit `handlungsbefugnis` ab «bereitet-vor» oder `gedaechtnis: true`. Bereich «daten» (GS-17 bis GS-22): eigene Zusatzvorschläge ohne OWASP-Verweis.',
      '',
      `GS-01 bis GS-10 lehnen sich an die ${gs.quelle.titel} an${gs.quelle_agenten ? `, GS-11 bis GS-16 an die ${gs.quelle_agenten.titel}` : ''} (${gs.quelle.herausgeber}, Lizenz ${gs.quelle.lizenz}). Texte, Massnahmen und Zuordnungen zu ISO/IEC 42001 und NIST AI 600-1 sind eigene Formulierungen des Kits, nicht von OWASP geprüft; vom OWASP-Dokument wird nur die ID als Verweis genannt. Geben Sie keine Texte aus den OWASP-Listen wieder. OWASP-Kennungen immer mit Jahr nennen (z. B. «LLM01:2026»); die Nummern der Listen 2025 und 2026 bezeichnen verschiedene Risiken. / Own wording; OWASP IDs as reference only (CC BY-SA 4.0), always with the year, do not reproduce OWASP text.`,
      '',
    );
    for (const r of gs.risiken) {
      const de = u.de.roh(`genai-risiken.${r.id}`) as { titel: string; ursache: string; folge: string; massnahmen: string[] };
      const en = u.en.roh(`genai-risiken.${r.id}`) as { titel: string } | undefined;
      z.push(`## ${r.id} ${de.titel}${en ? ` / ${en.titel}` : ''}`, '');
      z.push(
        `- Bereich: ${r.bereich ?? 'llm'}${r.nur_handelnd ? ' (nur handelnde KI oder Gedächtnis)' : ''}; Verweis OWASP: ${r.owasp ?? 'eigener Vorschlag'}; Zielgruppe: ${r.zielgruppe.join(', ')}`,
        `- Risikoquelle (\`risiken[].quelle\`): ${r.quelle}; Ebenen: ${r.ebenen.join(', ')}`,
        `- Vorgeschlagene Controls: ${r.controls.join(', ')}`,
        `- Bezug NIST AI 600-1: ${(r.nist_600_1 ?? []).join(', ') || 'keiner'}`,
        `- Ursache: ${de.ursache}`,
        `- Folge: ${de.folge}`,
        `- Typische Massnahmen: ${de.massnahmen.join('; ')}`,
        '',
      );
    }
  }
  schreibe(join(ordner, 'references', 'genai-sicherheit.md'), z.join('\n'));
}

// 3. AI-Act-Auszüge und Stand
for (const s of sprachen) {
  const quelle = join('src', 'ai-act', 'auszuege', s);
  if (!existsSync(quelle)) continue;
  const teile = readdirSync(quelle).filter((d) => d.endsWith('.md')).sort().map((d) => readFileSync(join(quelle, d), 'utf8').trim());
  schreibe(join(ordner, 'references', 'ai-act', `auszuege-${s}.md`), teile.join('\n\n---\n\n') + '\n');
}
{
  const stand = parse(readFileSync('src/ai-act/stand.yaml', 'utf8'));
  schreibe(join(ordner, 'references', 'ai-act', 'stand.md'), '# Stand EU AI Act / Status\n\n```yaml\n' + JSON.stringify(stand, null, 2) + '\n```\n');
}

// 4. JSON Schema der Projektdatei
const schema = execFileSync('npx', ['ts-json-schema-generator', '-p', 'src/model/typen.ts', '-t', 'Projekt', '--tsconfig', 'tsconfig.json', '--no-type-check'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
schreibe(join(ordner, 'references', 'projektdatei-schema.json'), schema);

// 5. Vorlagen als assets
if (kit) {
  const ko = parse(readFileSync('src/kataloge/kit-ordner.yaml', 'utf8')) as { sprachen: Record<'de' | 'en', Record<string, string>> };
  for (const s of sprachen) {
    const sp = ko.sprachen[s]!;
    for (const teil of ['vorlagen', 'modul', 'modul_nist', 'integration']) {
      const q = join(kit, sp.ordner!, sp[teil]!);
      if (!existsSync(q)) continue;
      for (const d of readdirSync(q)) {
        const p = join(q, d);
        if (statSync(p).isFile() && /\.(docx|xlsx)$/.test(d)) cpSync(p, join(ordner, 'assets', s, d));
      }
    }
  }
}

// 6. Fallback-Anweisung neben dem Skill-Ordner
cpSync('src/skill/PROJEKT-ANWEISUNG.md', join(ziel, 'PROJEKT-ANWEISUNG.md'));

// 7. Skill-ZIP mit dem Ordner auf oberster Ebene
const dateien = (o: string): string[] => readdirSync(o).flatMap((n) => (statSync(join(o, n)).isDirectory() ? dateien(join(o, n)) : [join(o, n)]));
const eintraege = dateien(ordner).sort().map((p) => ({ pfad: `${NAME}/${relative(ordner, p).split('\\').join('/')}`, inhalt: readFileSync(p) }));
const zeitpunkt = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
schreibe(join(ziel, `${NAME}.zip`), zipErstellen(eintraege, { zeitpunkt }));
const zeilen = readFileSync(join(ordner, 'SKILL.md'), 'utf8').split('\n').length;
console.log(`Skill: ${ordner} (${eintraege.length} Dateien, SKILL.md ${zeilen} Zeilen), ZIP ${join(ziel, `${NAME}.zip`)}`);

// Stand vor rc.6: NICHT mehr laufen lassen. Die *.aims.json sind führend und werden direkt geändert (docs/KONVENTIONEN.md, 4a).
// Schreibt die Beispielprojekte je Sprache als *.<sprache>.aims.json und prüft sie (Stil, Prüfregeln).
// EN: gleiche Logik, Freitexte aus den Textpaaren in texte-en-*.mts (englisch.mts).
// Aufruf: npx tsx src/beispiele/bau/bauen.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { pruefeProjekt, type Regel } from '../../regeln/pruefungen.ts';
import type { Projekt } from '../../model/typen.ts';
import { aufEnglisch, unbenutzteTexte } from './englisch.mts';
import { CONTROLS_42001, kataloge, SRC, stilPruefen } from './gemeinsam.mts';
import { mitDrawioBeispiel, ohneDrawio } from './prozesse.mts';
import { musterMaschinenbau } from './muster.mts';
import { praezisionsteile } from './praezision.mts';

const regeln = (parse(readFileSync(`${SRC}regeln/pruefregeln.yaml`, 'utf8')) as { regeln: Regel[] }).regeln;

function schreibe(datei: string, p: Projekt) {
  stilPruefen(p, datei);
  writeFileSync(`${SRC}beispiele/${datei}`, `${JSON.stringify(p, null, 2)}\n`);
  const befunde = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
  console.log(`${datei}: ${befunde.length ? befunde.map((b) => `${b.regel}${b.id ? ` ${b.id}` : ''}`).join(', ') : 'keine Befunde'}`);
}

const muster = musterMaschinenbau();
const praezision = praezisionsteile();
// Ablauf PR-07 aus draw.io je Sprache (Texte und Rohdaten der Seite passen zur Sprache)
schreibe('muster-maschinenbau.de.aims.json', mitDrawioBeispiel(structuredClone(muster), 'de'));
schreibe('praezisionsteile.de.aims.json', praezision);
// EN mit eigener Projekt-ID, damit DE und EN im Werkzeug nebeneinander gespeichert werden können
schreibe('muster-maschinenbau.en.aims.json', mitDrawioBeispiel(aufEnglisch(ohneDrawio(muster), 'c3a7e1d5-2f84-4b6e-8d19-5a0c7e3b9f61'), 'en'));
schreibe('praezisionsteile.en.aims.json', aufEnglisch(praezision, '8e2d5b14-6a9f-4c37-b1e8-3f7a0d6c2e95'));
const veraltet = unbenutzteTexte(muster, praezision);
if (veraltet.length) console.log(`Veraltete Textpaare in texte-en-*.mts (${veraltet.length}):\n${veraltet.map((t) => `  ${t}`).join('\n')}`);

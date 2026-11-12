#!/bin/bash
# Rot-Grün-Beleg (AF-058, QK-34): reproduziert, dass ein Test vor der Behebung rot und danach grün ist.
# Aufruf: scripts/werkzeug/rot-gruen.sh <test> <rot> <gruen>
#   <test>   Testdatei oder Muster (Pfad im Repo), z. B. tests/unit/foo.test.ts
#   <rot>    Commit vor der Behebung (Test muss dort scheitern)
#   <gruen>  Commit mit der Behebung (Test muss dort bestehen)
# Beide Läufe geschehen in einem eigenen, vorübergehenden Arbeitsbaum (git worktree, losgelöst) unter $TMPDIR; der eigene
# Arbeitsbaum bleibt unberührt. Fehlt die Testdatei im Rot-Commit, wird sie aus dem Grün-Commit dorthin kopiert (Test vor der
# Behebung geschrieben, Behebung noch nicht vorhanden); die Ausgabe nennt das.
# Der Testbefehl kommt aus dem eigenen Arbeitsbaum (begrenzt.sh des Aufrufers), nicht aus dem alten Stand.
# «Rot» zählt nur, wenn Tests gelaufen und gescheitert sind oder die Testdatei nicht laden konnte (z. B. fehlendes Modul vor
# der Behebung). Befehl nicht gefunden oder nicht ausführbar (126, 127), Abbruch durch Signal (137) oder ein Lauf ohne Tests
# und ohne Ladefehler sind Umgebungsfehler (Ausgang 3), kein Beleg.
# Ausgabe: je Lauf «ROT bestätigt» oder «GRÜN bestätigt», am Ende «Beleg gültig». Ausgangscode:
#   0 Beleg gültig (rot, dann grün)   1 Test war im Rot-Commit nicht rot (kein Beleg)
#   2 Test ist im Grün-Commit nicht grün   3 Aufruf oder Umgebung fehlerhaft
# Umgebung: RG_BEFEHL  Testbefehl (Standard: <Wurzel>/scripts/werkzeug/begrenzt.sh 2G npx vitest run, mit JSON-Bericht)
#           RG_BERICHT  «vitest-json»: der Befehl schreibt einen Vitest-JSON-Bericht nach $RG_JSON_DATEI (Standard bei
#                       Standardbefehl); sonst zählt nur der Ausgangscode (126, 127, 137 sind dann Umgebungsfehler)
#           RG_VORBEREITUNG  Befehl vor jedem Lauf im Arbeitsbaum (Standard: npm run kataloge && npm run schema; leer = keiner)
set -u
if [ "$#" -ne 3 ]; then
  echo "Aufruf: $0 <test> <rot> <gruen>" >&2
  exit 3
fi
TEST=$1
ROT=$2
GRUEN=$3
WURZEL=$(git rev-parse --show-toplevel) || { echo "Kein Git-Arbeitsbaum" >&2; exit 3; }
ROT_ID=$(git -C "$WURZEL" rev-parse --verify --quiet "$ROT^{commit}") || { echo "Rot-Commit '$ROT' nicht lesbar" >&2; exit 3; }
GRUEN_ID=$(git -C "$WURZEL" rev-parse --verify --quiet "$GRUEN^{commit}") || { echo "Grün-Commit '$GRUEN' nicht lesbar" >&2; exit 3; }
if [ "$ROT_ID" = "$GRUEN_ID" ]; then
  echo "Rot- und Grün-Commit sind derselbe Commit: kein Beleg möglich" >&2
  exit 3
fi
if [ -z "${RG_BEFEHL+x}" ]; then
  BEFEHL="$WURZEL/scripts/werkzeug/begrenzt.sh 2G npx vitest run"
  BERICHT=${RG_BERICHT-vitest-json}
else
  BEFEHL=$RG_BEFEHL
  BERICHT=${RG_BERICHT-}
fi
VORBEREITUNG=${RG_VORBEREITUNG-"npm run kataloge && npm run schema"}
BASISVERZ=${TMPDIR:-/tmp}
mkdir -p "$BASISVERZ" || exit 3
TMP=$(mktemp -d "$BASISVERZ/rot-gruen.XXXXXX") || exit 3
AKTIV=""
aufraeumen() {
  if [ -n "$AKTIV" ]; then git -C "$WURZEL" worktree remove --force "$AKTIV" >/dev/null 2>&1; fi
  rm -rf "$TMP"
  git -C "$WURZEL" worktree prune >/dev/null 2>&1
}
trap aufraeumen EXIT

# Wertet den Vitest-JSON-Bericht aus: ROT (Test gescheitert oder Datei nicht ladbar), GRUEN (Tests bestanden), UMGEBUNG
bewerte_bericht() {
  node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch { console.log("UMGEBUNG"); process.exit(0); }
    const gescheitert = (j.numFailedTests || 0) > 0 || (j.testResults || []).some((r) => r.status === "failed");
    if (gescheitert) console.log("ROT");
    else if ((j.numTotalTests || 0) > 0) console.log("GRUEN");
    else console.log("UMGEBUNG");
  ' "$1" 2>/dev/null || echo UMGEBUNG
}

# lauf <Name> <Commit> <Testdatei aus Grün kopieren: ja|nein>; setzt KLASSE (ROT, GRUEN, UMGEBUNG) und RC; Rückgabe 0 oder 255
KLASSE=""
RC=0
lauf() {
  local name=$1 commit=$2 kopieren=$3
  local verz="$TMP/$name"
  KLASSE=UMGEBUNG
  git -C "$WURZEL" worktree add --detach --quiet "$verz" "$commit" || return 255
  AKTIV=$verz
  [ -e "$WURZEL/node_modules" ] && ln -s "$WURZEL/node_modules" "$verz/node_modules"
  if [ "$kopieren" = "ja" ] && [ ! -e "$verz/$TEST" ]; then
    mkdir -p "$(dirname "$verz/$TEST")"
    git -C "$WURZEL" show "$GRUEN_ID:$TEST" > "$verz/$TEST" 2>/dev/null || { echo "Testdatei $TEST fehlt auch im Grün-Commit" >&2; return 255; }
    echo "Hinweis: $TEST fehlt im Rot-Commit, aus dem Grün-Commit übernommen"
  fi
  if [ -n "$VORBEREITUNG" ]; then
    (cd "$verz" && bash -c "$VORBEREITUNG") >"$TMP/$name.vorbereitung.log" 2>&1 || { echo "Vorbereitung fehlgeschlagen (Protokoll: $TMP/$name.vorbereitung.log)" >&2; tail -n 20 "$TMP/$name.vorbereitung.log" >&2; return 255; }
  fi
  local json="$TMP/$name.json"
  export RG_JSON_DATEI=$json
  if [ "$BERICHT" = "vitest-json" ] && [ -z "${RG_BEFEHL+x}" ]; then
    (cd "$verz" && bash -c "$BEFEHL --reporter=json --outputFile=\"$json\" \"\$1\"" _ "$TEST") >"$TMP/$name.log" 2>&1
  else
    (cd "$verz" && bash -c "$BEFEHL \"\$1\"" _ "$TEST") >"$TMP/$name.log" 2>&1
  fi
  RC=$?
  tail -n 8 "$TMP/$name.log"
  git -C "$WURZEL" worktree remove --force "$verz" >/dev/null 2>&1
  AKTIV=""
  case "$RC" in
    126|127|137) KLASSE=UMGEBUNG; return 0 ;;
  esac
  if [ "$BERICHT" = "vitest-json" ]; then
    local b
    b=$(bewerte_bericht "$json")
    if [ "$RC" -ne 0 ] && [ "$b" = "ROT" ]; then KLASSE=ROT
    elif [ "$RC" -eq 0 ] && [ "$b" = "GRUEN" ]; then KLASSE=GRUEN
    else KLASSE=UMGEBUNG; fi
  elif [ "$RC" -eq 0 ]; then KLASSE=GRUEN
  else KLASSE=ROT; fi
  return 0
}

echo "== Rot-Lauf: $TEST auf ${ROT_ID:0:9}"
lauf rot "$ROT_ID" ja || { echo "Rot-Lauf nicht möglich" >&2; exit 3; }
if [ "$KLASSE" = "UMGEBUNG" ]; then
  echo "UMGEBUNGSFEHLER im Rot-Lauf (Ausgangscode $RC: Befehl fehlt, Abbruch durch Signal, Bericht fehlt oder keine Tests gelaufen): kein Beleg" >&2
  exit 3
fi
if [ "$KLASSE" = "GRUEN" ]; then
  echo "KEIN BELEG: der Test ist auf ${ROT_ID:0:9} grün, er müsste vor der Behebung scheitern"
  exit 1
fi
echo "ROT bestätigt (Ausgangscode $RC)"

echo "== Grün-Lauf: $TEST auf ${GRUEN_ID:0:9}"
lauf gruen "$GRUEN_ID" nein || { echo "Grün-Lauf nicht möglich" >&2; exit 3; }
if [ "$KLASSE" = "UMGEBUNG" ]; then
  echo "UMGEBUNGSFEHLER im Grün-Lauf (Ausgangscode $RC: Befehl fehlt, Abbruch durch Signal, Bericht fehlt oder keine Tests gelaufen): kein Beleg" >&2
  exit 3
fi
if [ "$KLASSE" = "ROT" ]; then
  echo "KEIN BELEG: der Test ist auf ${GRUEN_ID:0:9} nicht grün (Ausgangscode $RC)"
  exit 2
fi
echo "GRÜN bestätigt"
echo "Beleg gültig: $TEST rot auf ${ROT_ID:0:9}, grün auf ${GRUEN_ID:0:9}"

// Hilfsprogramm des Determinismustests: gibt Fallliste (Nummer, Name, Prüfsumme) und Urteil je Fall für alle Ziele als JSON aus.
// Läuft in einem eigenen Prozess; mit FUZZ_UHR_VERSATZ_MS wird die Uhr verschoben, damit Zeitabhängigkeiten (zum Beispiel
// fflate-Zeitstempel in ZIP) auffallen.
const versatz = Number(process.env['FUZZ_UHR_VERSATZ_MS'] ?? 0);
if (versatz) {
  const Echt = Date;
  const verschoben = new Proxy(Echt, {
    construct: (ziel, args) => (args.length === 0 ? new ziel(Echt.now() + versatz) : new (ziel as unknown as new (...a: unknown[]) => Date)(...args)),
    get: (ziel, k, r) => (k === 'now' ? () => Echt.now() + versatz : Reflect.get(ziel, k, r)),
  });
  (globalThis as { Date: DateConstructor }).Date = verschoben;
}
const { fuehreAus, erzeugeFall, fallHash } = await import('./kern.ts');
const { EINGABEARTEN } = await import('./typen.ts');
const faelle = Number(process.argv[2] ?? 50);
const seed = Number(process.argv[3] ?? 77123);
const aus: Record<string, { nummer: number; name: string; hash: string; status: string; meldung: string }[]> = {};
for (const art of EINGABEARTEN) {
  aus[art] = [];
  for (let i = 1; i <= faelle; i++) {
    const f = erzeugeFall(art, seed, i);
    const e = await fuehreAus(art, seed, i);
    aus[art]!.push({ nummer: i, name: f.name, hash: fallHash(f), status: e.status, meldung: e.meldung ?? '' });
  }
}
process.stdout.write(JSON.stringify(aus));

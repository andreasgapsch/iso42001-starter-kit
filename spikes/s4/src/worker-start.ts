// Startet einen Worker aus eingebettetem Code über eine Blob-URL; mit Trusted Types über die Policy «aims-worker».
interface TtPolicy {
  createScriptURL(u: string): unknown;
}
interface TtFabrik {
  createPolicy(name: string, regeln: { createScriptURL(u: string): string }): TtPolicy;
}

let policy: TtPolicy | null | undefined;

function holePolicy(): TtPolicy | null {
  if (policy === undefined) {
    const tt = (globalThis as { trustedTypes?: TtFabrik }).trustedTypes;
    // Nur Blob-URLs zulassen; alles andere ist ein Angriffsversuch oder ein Fehler.
    policy = tt
      ? tt.createPolicy('aims-worker', {
          createScriptURL: (u) => {
            if (!u.startsWith('blob:')) throw new TypeError('aims-worker: nur blob:-URLs');
            return u;
          },
        })
      : null;
  }
  return policy;
}

export function workerAusText(code: string): Worker {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const p = holePolicy();
  const w = new Worker((p ? p.createScriptURL(url) : url) as string);
  // Freigeben erst, wenn der Worker geladen hat (sofortiges Freigeben bricht in einzelnen Engines den Start ab).
  const frei = (): void => URL.revokeObjectURL(url);
  w.addEventListener('message', frei, { once: true });
  w.addEventListener('error', frei, { once: true });
  return w;
}

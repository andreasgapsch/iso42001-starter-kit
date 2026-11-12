// Startet den eingebetteten Generator-Worker (deflate + Base64 im Block #code-generator) über eine Blob-URL.
// Mit Trusted Types über die Policy «aims-worker», die nur blob:-URLs zulässt (Spike S4/S5).
import { inflateSync, strFromU8 } from 'fflate';

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

export function base64(text: string): Uint8Array {
  const neu = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
  if (neu) return neu(text);
  const s = atob(text);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/** Inhalt eines komprimierten Datenblocks (deflate + Base64). */
export function entpackeBlock(id: string): string | null {
  const el = document.getElementById(id);
  const roh = el?.textContent?.trim();
  if (!roh) return null;
  return strFromU8(inflateSync(base64(roh)));
}

export function workerAusText(code: string): Worker {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const p = holePolicy();
  const w = new Worker((p ? p.createScriptURL(url) : url) as string);
  const frei = (): void => URL.revokeObjectURL(url);
  w.addEventListener('message', frei, { once: true });
  w.addEventListener('error', frei, { once: true });
  return w;
}

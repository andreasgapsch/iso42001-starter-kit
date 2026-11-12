// Baut die Spike-Seiten vor dem Lauf (SPIKES_BAUEN=0 überspringt).
import { execFileSync } from 'node:child_process';

export default function globalSetup(): void {
  if (process.env['SPIKES_BAUEN'] === '0') return;
  execFileSync('npx', ['tsx', 'spikes/bauen.mts'], { stdio: 'inherit' });
}

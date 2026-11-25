import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const environmentFile = new URL('../src/environments/environment.ts', import.meta.url);
const original = readFileSync(environmentFile);
const environment = {
  production: true,
  localAuth: false,
  demoAuth: true,
  apiUrl: '/api',
  keycloakUrl: '',
};

try {
  writeFileSync(environmentFile, `export const environment = ${JSON.stringify(environment, null, 2)};\n`);
  const cli = fileURLToPath(new URL('../node_modules/@angular/cli/bin/ng.js', import.meta.url));
  const build = spawnSync(process.execPath, [cli, 'build', '--configuration', 'production'], {
    stdio: 'inherit',
  });
  if (build.error) throw build.error;
  process.exitCode = build.status ?? 1;
} finally {
  writeFileSync(environmentFile, original);
}

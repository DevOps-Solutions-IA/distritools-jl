import 'reflect-metadata';

import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.test');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');

for (const line of envLines) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    continue;
  }

  const separatorIndex = trimmed.indexOf('=');

  if (separatorIndex === -1) {
    continue;
  }

  const key = trimmed.slice(0, separatorIndex);
  const value = trimmed.slice(separatorIndex + 1);

  if (!process.env[key]) {
    process.env[key] = value;
  }
}

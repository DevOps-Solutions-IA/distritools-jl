// Stable command leader: npm changes process.title/argv after /usr/bin/env exec.
// Child commands inherit only this runner's newly created exclusive session/group.
import process from 'node:process';
import console from 'node:console';
import { spawn } from 'node:child_process';
const [executable, ...args] = process.argv.slice(2);
if (!executable) throw new Error('Missing owned command');
const child = spawn(executable, args, { env: process.env, stdio: 'inherit' });
child.once('error', () => { console.error('FAIL owned command launch (private details omitted)'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });

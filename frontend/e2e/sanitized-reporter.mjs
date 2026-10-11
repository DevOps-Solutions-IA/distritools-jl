import console from 'node:console';
import process from 'node:process';
// Deliberately omit assertion values, screenshots, traces, cookies and stdout.
import fs from 'node:fs';
import path from 'node:path';
class SanitizedReporter {
  constructor() { this.cases = []; }
  onTestEnd(test, result) {
    this.cases.push({ title: test.title, status: result.status, durationMs: result.duration, retry: result.retry, errorCount: result.errors.length, locations: result.errors.flatMap(error => Array.from((error.stack ?? '').matchAll(/platform\.spec\.mjs:(\d+):(\d+)/g), match => ({ line: Number(match[1]), column: Number(match[2]) }))) });
    console.log(`${result.status.toUpperCase()} ${test.title}`);
  }
  onEnd(result) {
    fs.writeFileSync(path.join(process.env.EX08_BROWSER_RUN_DIR, 'browser-results.json'), JSON.stringify({ status: result.status, cases: this.cases, certification: 'Selected platform baseline only; all42/71 complete domain workflows remain NOT_TESTED' }, null, 2));
  }
}
export default SanitizedReporter;

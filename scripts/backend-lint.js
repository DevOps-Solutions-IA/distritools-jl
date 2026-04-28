const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const includeDirs = ['src', 'tests', 'prisma'];
const fileExtensions = new Set(['.ts']);
const issues = [];

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'frontend') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!fileExtensions.has(path.extname(entry.name))) {
      continue;
    }

    lintFile(fullPath);
  }
}

function lintFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(rootDir, filePath);
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (/\bany\b/.test(line) && !line.includes('company')) {
      issues.push(`${relativePath}:${lineNumber} contiene "any" explícito.`);
    }

    if (/console\.(log|warn|debug|error)\(/.test(line)) {
      issues.push(`${relativePath}:${lineNumber} usa console.*; mueve eso a logger o test assertion.`);
    }
  });
}

for (const relativeDir of includeDirs) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (fs.existsSync(absoluteDir)) {
    walk(absoluteDir);
  }
}

if (issues.length > 0) {
  console.error('Backend lint failed:\n' + issues.join('\n'));
  process.exit(1);
}

console.log('Backend lint passed');

#!/usr/bin/env node
"use strict";

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const issues = [];

function walk(dir, extensions) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      results.push(...walk(fullPath, extensions));
    } else if (entry.isFile() && extensions.some(ext => fullPath.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function lintFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(rootDir, filePath);
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check 1: PrismaService in application layer
    if (line.includes('PrismaService') && relativePath.includes('/application/')) {
      issues.push(`ARCH-001: ${relativePath}:${lineNumber} — PrismaService en application layer. Mover a repositorio.`);
    }

    // Check 2: as never in any file (allow only documented exceptions)
    if (/\bas never\b/.test(line) && !line.includes('// safe cast') && !line.includes('// documented')) {
      issues.push(`ARCH-002: ${relativePath}:${lineNumber} — Usa "as never". Reemplazar por tipo de Prisma explícito o documentar.`);
    }

    // Check 3: Controllers importing PrismaService
    if (line.includes('PrismaService') && relativePath.includes('/controllers/')) {
      issues.push(`ARCH-003: ${relativePath}:${lineNumber} — Controller importa PrismaService. Delegar en use case/repositorio.`);
    }

    // Check 4: God controller detection (files > 800 lines in controllers)
  });

  // Check 5: File size for controllers
  if (relativePath.includes('/controllers/') && lines.length > 800) {
    issues.push(`ARCH-005: ${relativePath} — Controller de ${lines.length} líneas. Refactorizar a use cases.`);
  }
}

const srcFiles = walk(path.join(rootDir, 'src'), ['.ts']);
for (const file of srcFiles) {
  lintFile(file);
}

if (issues.length > 0) {
  console.error('Architecture check failed:\n' + issues.join('\n'));
  process.exit(1);
}

console.log('Architecture check passed');

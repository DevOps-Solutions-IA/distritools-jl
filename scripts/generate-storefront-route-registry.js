const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const artifactPaths = [
  'src/modules/admin-operations/application/storefront-route-registry.ts',
  'frontend/src/lib/generated/storefront-route-registry.ts',
];

let typescript;
function parser() {
  if (!typescript) {
    // Each CI job installs its own existing dependency graph, not both graphs.
    const frontendParser = path.join(root, 'frontend/node_modules/typescript');
    typescript = fs.existsSync(frontendParser) ? require(frontendParser) : require('typescript');
  }
  return typescript;
}

function pageSources(appDirectory) {
  const pages = [];
  function walk(directory, segments) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Route source must not contain symlinks.');
      if (entry.isDirectory()) walk(path.join(directory, entry.name), [...segments, entry.name]);
      else if (pageFile.test(entry.name)) {
        const route = publicRoute(segments);
        if (route !== null) pages.push({ route, file: path.join(...segments, entry.name), source: fs.readFileSync(path.join(directory, entry.name), 'utf8') });
      }
    }
  }
  walk(appDirectory, []);
  return pages.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);
}

function extractPageQueryKeys(source) {
  const ts = parser();
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // Footer query support is bounded to actual public catalog/search page contracts.
  // Transaction/payment confirmation parameters have no approved footer resource authority.
  const catalogPage = tree.statements.some((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('@/features/catalog/'));
  if (!catalogPage) return [];
  const keys = new Set();
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'resolvedSearchParams') keys.add(node.name.text);
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'resolvedSearchParams') {
      if (!ts.isStringLiteral(node.argumentExpression)) throw new Error('Computed catalog query keys require an explicit generator update.');
      keys.add(node.argumentExpression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...keys].sort();
}

function extractRedirects(config) {
  const ts = parser();
  const tree = ts.createSourceFile('next.config.ts', config, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const redirects = new Map();
  function pattern(href) { return href.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '[$1]'); }
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const strings = {};
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && ts.isStringLiteral(property.initializer)) strings[property.name.text] = property.initializer.text;
      }
      if (strings.source?.startsWith('/') && strings.destination?.startsWith('/') && !strings.source.includes('*') && !strings.destination.includes('?')) redirects.set(pattern(strings.source), pattern(strings.destination));
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return redirects;
}

function extractQueryValues(source) {
  const ts = parser();
  const tree = ts.createSourceFile('CatalogToolbar.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = {};
  function attribute(opening, name) {
    const item = opening.attributes.properties.find((node) => ts.isJsxAttribute(node) && node.name.text === name);
    return item && item.initializer && ts.isStringLiteral(item.initializer) ? item.initializer.text : null;
  }
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'select') {
      const name = attribute(node.openingElement, 'name');
      if (name === 'status' || name === 'sort') {
        const values = new Set();
        for (const child of node.children) {
          if (ts.isJsxElement(child) && child.openingElement.tagName.getText(tree) === 'option') {
            const value = attribute(child.openingElement, 'value');
            if (value === null) throw new Error('Nonliteral catalog status/sort options require an explicit generator update.');
            values.add(value);
          }
        }
        if (!values.size) throw new Error('Catalog status/sort options are missing.');
        result[name] = [...values].sort();
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!result.status || !result.sort) throw new Error('Catalog query value authority is missing.');
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left < right ? -1 : 1));
}

function queryMetadata(pages, config) {
  const redirects = extractRedirects(config);
  const actual = new Map(pages.map((page) => [page.route, extractPageQueryKeys(page.source)]));
  function keys(route, visited = new Set()) {
    if (visited.has(route)) throw new Error('Cyclic storefront redirect authority.');
    visited.add(route);
    const target = redirects.get(route);
    return target && actual.has(target) ? keys(target, visited) : actual.get(route) || [];
  }
  return Object.fromEntries([...actual.keys()].sort().map((route) => [route, keys(route)]));
}


// These are Next's default page extensions; this project has no pageExtensions override.
const pageFile = /^page\.(tsx|ts|jsx|js)$/;
function publicRoute(segments) {
  // Private folders, parallel slots and intercepted pages are not standalone public destinations.
  if (segments.some((part) => part.startsWith('_') || part.startsWith('@') || /^\(\.{1,3}\)/.test(part))) return null;
  const visible = segments.filter((part) => !/^\([^)]*\)$/.test(part));
  if (visible[0] === 'admin' || visible[0] === 'api') return null;
  return `/${visible.join('/')}`;
}

function discoverRoutes(appDirectory) {
  const routes = new Set();
  function walk(directory, segments) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Route source must not contain symlinks.');
      if (entry.isDirectory()) walk(path.join(directory, entry.name), [...segments, entry.name]);
      else if (pageFile.test(entry.name)) {
        const route = publicRoute(segments);
        if (route !== null) routes.add(route);
      }
    }
  }
  walk(appDirectory, []);
  return [...routes].sort();
}

function routesFromManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid Next app-paths manifest.');
  const routes = new Set();
  for (const [appPath, builtPath] of Object.entries(manifest)) {
    if (typeof builtPath !== 'string' || !appPath.startsWith('/')) throw new Error('Invalid Next app-paths manifest entry.');
    if (!appPath.endsWith('/page')) continue; // Route handlers are APIs, not pages.
    const route = publicRoute(appPath.slice(1, -5).split('/').filter(Boolean));
    if (route !== null) routes.add(route);
  }
  return [...routes].sort();
}

function assertManifestParity(sourceRoutes, manifest) {
  const builtRoutes = routesFromManifest(manifest);
  if (JSON.stringify([...sourceRoutes].sort()) !== JSON.stringify(builtRoutes)) {
    throw new Error('Next app-paths manifest differs from the canonical public route registry.');
  }
}

function renderRegistry(projectRoot = root) {
  const pages = pageSources(path.join(projectRoot, 'frontend/src/app'));
  const routes = [...new Set(pages.map((page) => page.route))].sort();
  const config = fs.readFileSync(path.join(projectRoot, 'frontend/next.config.ts'), 'utf8');
  if (/\bpageExtensions\s*:/.test(config)) throw new Error('Custom Next pageExtensions require an explicit generator update.');
  const toolbar = fs.readFileSync(path.join(projectRoot, 'frontend/src/components/catalog/CatalogToolbar.tsx'), 'utf8');
  const metadata = queryMetadata(pages, config);
  const values = extractQueryValues(toolbar);
  const digest = crypto.createHash('sha256').update(JSON.stringify(pages)).update('\n').update(config).update(toolbar);
  for (const file of ['filtering.ts', 'mappers.ts']) digest.update(fs.readFileSync(path.join(projectRoot, 'frontend/src/features/catalog', file), 'utf8'));
  const sourceHash = digest.digest('hex');
  return `// Generated by scripts/generate-storefront-route-registry.js from real Next App Router pages and catalog query contracts.\n// Do not edit manually. Regenerate after route, query-source or Next configuration changes.\nexport const STOREFRONT_ROUTE_SOURCE_SHA256 = '${sourceHash}';\nexport const STOREFRONT_PUBLIC_ROUTES = ${JSON.stringify(routes, null, 2)} as const;\nexport const STOREFRONT_ROUTE_QUERY_KEYS = ${JSON.stringify(metadata, null, 2)} as const;\nexport const STOREFRONT_QUERY_VALUES = ${JSON.stringify(values, null, 2)} as const;\n`;
}

function assertRegistryArtifacts(projectRoot = root, expected = renderRegistry(projectRoot)) {
  for (const relativePath of artifactPaths) {
    const artifact = path.join(projectRoot, relativePath);
    if (!fs.existsSync(artifact) || fs.readFileSync(artifact, 'utf8') !== expected) {
      throw new Error(`Canonical storefront route registry is missing/stale: ${relativePath}; run node scripts/generate-storefront-route-registry.js.`);
    }
  }
}

function main(args) {
  const registry = renderRegistry();
  if (args.includes('--check') || args.includes('--check-manifest')) {
    assertRegistryArtifacts(root, registry);
  } else {
    for (const relativePath of artifactPaths) {
      const artifact = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(artifact), { recursive: true });
      fs.writeFileSync(artifact, registry);
    }
  }
  if (args.includes('--check-manifest')) {
    const at = args.indexOf('--check-manifest');
    const manifestPath = args[at + 1] && !args[at + 1].startsWith('--') ? path.resolve(root, args[at + 1]) : path.join(root, 'frontend/.next/server/app-paths-manifest.json');
    assertManifestParity(discoverRoutes(path.join(root, 'frontend/src/app')), JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  }
}

module.exports = { assertRegistryArtifacts, discoverRoutes, routesFromManifest, assertManifestParity, renderRegistry, extractPageQueryKeys, extractRedirects, extractQueryValues, queryMetadata };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

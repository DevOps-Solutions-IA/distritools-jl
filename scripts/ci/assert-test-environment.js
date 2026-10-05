#!/usr/bin/env node
'use strict';

const { URL } = require('node:url');

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DEVELOPER_SERVICE_PORTS = new Set(['55440', '56379']);

function parseUrl(value, key, failures) {
  try {
    return new URL(value);
  } catch {
    failures.push(`${key} is missing or invalid.`);
    return null;
  }
}

function validateTestEnvironment(env) {
  const failures = [];
  if (env.CI !== 'true') failures.push('Critical integration must run with CI-owned isolated test services.');
  if (env.NODE_ENV !== 'test') failures.push('NODE_ENV must be test.');

  const database = parseUrl(env.DATABASE_URL, 'DATABASE_URL', failures);
  if (database) {
    const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ''));
    if (!['postgres:', 'postgresql:'].includes(database.protocol)) failures.push('DATABASE_URL must use PostgreSQL.');
    if (!LOOPBACK_HOSTS.has(database.hostname)) failures.push('DATABASE_URL host must be local or the isolated postgres service.');
    if (DEVELOPER_SERVICE_PORTS.has(database.port)) failures.push('DATABASE_URL must not target the shared developer database service.');
    if (database.port === '5432' && env.CI !== 'true') failures.push('The default PostgreSQL service port is allowed only inside CI-owned service containers.');
    if (!/(?:^|[_-])test(?:$|[_-])/i.test(databaseName)) failures.push('DATABASE_URL database name must explicitly identify a test database.');
  }

  const redis = parseUrl(env.REDIS_URL, 'REDIS_URL', failures);
  if (redis) {
    if (!['redis:', 'rediss:'].includes(redis.protocol)) failures.push('REDIS_URL must use Redis.');
    if (!LOOPBACK_HOSTS.has(redis.hostname)) failures.push('REDIS_URL host must be local or the isolated redis service.');
    if (DEVELOPER_SERVICE_PORTS.has(redis.port)) failures.push('REDIS_URL must not target the shared developer Redis service.');
    if (redis.port === '6379' && env.CI !== 'true') failures.push('The default Redis service port is allowed only inside CI-owned service containers.');
  }

  return { ok: failures.length === 0, failures };
}

if (require.main === module) {
  const result = validateTestEnvironment(process.env);
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  } else {
    const database = new URL(process.env.DATABASE_URL);
    const redis = new URL(process.env.REDIS_URL);
    console.log(`PASS CI isolated test targets: postgres/${decodeURIComponent(database.pathname.slice(1))} and redis/${redis.hostname}`);
  }
}

module.exports = { validateTestEnvironment };

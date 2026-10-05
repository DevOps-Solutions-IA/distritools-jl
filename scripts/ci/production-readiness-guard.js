#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function isConfiguredSecret(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && !/^(?:change[-_ ]?me|replace[-_ ]?me|your[-_ ].*|example)(?:[-_].*)?$/i.test(value.trim());
}

function isStrongSecret(value) {
  return isConfiguredSecret(value) && value.trim().length >= 32;
}

function isStableHttpsDomain(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !/(?:localhost|127\.0\.0\.1|trycloudflare)/i.test(url.hostname)
      && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
  } catch {
    return false;
  }
}

function evaluateProductionConfig(config) {
  const failures = [];
  const production = config.APP_ENV === 'production' || config.NODE_ENV === 'production';
  const readinessClaimsReady = config.PRODUCTION_READINESS_STATUS === 'READY_FOR_PRODUCTION';
  if (!production) return { failures };

  if (config.ADMIN_AUTH_DISABLED !== 'false') failures.push('ADMIN_AUTH_DISABLED must be explicitly false in production.');
  if (!['READY_FOR_PRODUCTION', 'BLOCKED_FOR_PRODUCTION'].includes(config.PRODUCTION_READINESS_STATUS)) {
    failures.push('Production readiness status must be explicit and fail closed.');
  }
  if (config.SHIPPING_PROVIDER === 'mock_99envios') failures.push('mock provider is forbidden in production.');
  if (config.AUTO_SHIPPING_MODE === 'quote_and_create_guide' && config.SHIPPING_PROVIDER !== '99envios') {
    failures.push('Automatic guide creation requires SHIPPING_PROVIDER=99envios.');
  }

  if (readinessClaimsReady) {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_2FA_CHALLENGE_SECRET']) {
      if (!isStrongSecret(config[key])) failures.push(`${key} is missing, weak, or a placeholder while readiness claims ready.`);
    }
    if (!isStrongSecret(config.TWO_FACTOR_ENCRYPTION_KEY)) {
      failures.push('TWO_FACTOR_ENCRYPTION_KEY is missing, weak, or a placeholder while readiness claims ready.');
    }
    if (!isStableHttpsDomain(config.PUBLIC_APP_URL)) failures.push('A stable HTTPS domain is required while readiness claims ready.');
    if (config.SHIPPING_PROVIDER !== '99envios') failures.push('A real shipping provider is required while readiness claims ready.');
    if (config.SHIPPING_PROVIDER === '99envios') {
      const hasBaseUrl = isStableHttpsDomain(config.NINETY_NINE_ENVIOS_API_BASE_URL);
      const hasCredentials = isConfiguredSecret(config.NINETY_NINE_ENVIOS_AUTH_EMAIL)
        && isConfiguredSecret(config.NINETY_NINE_ENVIOS_AUTH_PASSWORD)
        && isConfiguredSecret(config.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE)
        && /^\d{8}$/.test(config.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE ?? '');
      if (!hasBaseUrl || !hasCredentials) failures.push('99 Envíos credentials/configuration are incomplete while readiness claims ready.');
    }
    if (!config.EMAIL_PROVIDER || ['none', 'mock', 'local'].includes(config.EMAIL_PROVIDER.toLowerCase())) {
      failures.push('A productive email provider is required while readiness claims ready.');
    }
  }

  const onlinePaymentsEnabled = config.PSE_ENABLED === 'true' || config.PAYMENTS_REAL_PROVIDER_ENABLED === 'true';
  if (onlinePaymentsEnabled) {
    const provider = (config.PAYMENT_PROVIDER ?? '').toLowerCase();
    if (provider === 'wompi' && !isConfiguredSecret(config.WOMPI_PRIVATE_KEY)) {
      failures.push('WOMPI_PRIVATE_KEY is required when Wompi online payments are enabled.');
    } else if (provider === 'payu' && !isConfiguredSecret(config.PAYU_API_KEY)) {
      failures.push('PAYU_API_KEY is required when PayU online payments are enabled.');
    } else if (!['wompi', 'payu'].includes(provider)) {
      failures.push('Online payments use an unsupported payment provider; only configured Wompi or PayU credentials are recognized.');
    }
  }

  if (config.NOTIFICATIONS_REAL_PROVIDER_ENABLED === 'true'
      && (!config.EMAIL_PROVIDER || ['none', 'mock', 'local'].includes(config.EMAIL_PROVIDER.toLowerCase()))) {
    failures.push('Real notifications require a configured productive email provider.');
  }

  return { failures };
}

function main(argv) {
  if (argv.length !== 1) throw new Error('Usage: production-readiness-guard.js CONFIG.json');
  const config = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  const result = evaluateProductionConfig(config);
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`);
    return 1;
  }
  console.log('PASS production mock/readiness policy');
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { evaluateProductionConfig };

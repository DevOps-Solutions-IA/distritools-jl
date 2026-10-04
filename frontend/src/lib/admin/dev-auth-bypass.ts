export function isDevAdminAuthDisabled() {
  const appEnv = process.env.APP_ENV;

  return (
    process.env.NODE_ENV !== 'production' &&
    (appEnv === 'local' || appEnv === 'test') &&
    process.env.ADMIN_AUTH_DISABLED === 'true'
  );
}

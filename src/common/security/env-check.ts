export function isProductionOrStaging(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'staging';
}

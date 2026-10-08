export function isProductionOrStaging(env: NodeJS.ProcessEnv = process.env): boolean {
  return [env.APP_ENV, env.NODE_ENV]
    .some((env) => ['prod', 'production', 'staging'].includes((env ?? '').trim().toLowerCase()));
}

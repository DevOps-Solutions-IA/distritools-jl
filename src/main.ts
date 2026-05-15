import { bootstrap } from 'src/app/bootstrap';

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.stack : String(reason));
  process.exitCode = 1;
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error.stack);
  process.exitCode = 1;
});

bootstrap().catch((error: unknown) => {
  console.error('Failed to bootstrap application:', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

// Production entry: hosting launchers can import this module instead of running
// it directly. Keep factories in api-app.mjs so tests never start a server by import.
console.log('API startup: loading application modules.');
import('./api-app.mjs')
  .then(({ startApiServer }) => startApiServer())
  .catch((error) => {
    // Log fixed configuration messages or a system error code, never raw errors
    // (which can contain database URLs, SMTP credentials, or connection details).
    const configurationError = [
      'DATABASE_URL', 'CORS_ORIGINS', 'Configure a valid ADMIN_PASSWORD_HASH', 'PORT must',
    ].some((prefix) => error?.message?.startsWith(prefix));
    console.error('API startup failed.', configurationError
      ? { configuration: error.message }
      : { errorCode: /^[A-Z][A-Z0-9_]{0,63}$/.test(error?.code) ? error.code : 'unknown' });
    process.exitCode = 1;
  });

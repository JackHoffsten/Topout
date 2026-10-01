import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { serveWeb } from './serve-web.mjs';

// Own disposable database only; never reads development database credentials.
export async function startTestServer() {
  const apiPort = Number(process.env.TOPOUT_E2E_API_PORT ?? 5081);
  const configuration = process.env.TOPOUT_E2E_CONFIGURATION ?? 'Debug';
  if (!['Debug', 'Release'].includes(configuration))
    throw new Error('Invalid test build configuration');
  const name = 'topout-e2e-' + randomUUID();
  let container;
  let api;
  let server;
  let cleaning = false;
  function cleanup() {
    if (cleaning) return;
    cleaning = true;
    server?.close();
    api?.kill();
    if (container && /^[a-f0-9]{64}$/.test(container))
      execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
  }
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('exit', cleanup);
  try {
    const password = randomBytes(24).toString('hex');
    container = execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-d',
        '--name',
        name,
        '-e',
        'POSTGRES_PASSWORD=' + password,
        '-p',
        '127.0.0.1::5432',
        'postgres:18-alpine',
      ],
      { encoding: 'utf8' },
    ).trim();
    const port = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' })
      .trim()
      .split(':')
      .at(-1);
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], {
          stdio: 'ignore',
        });
        break;
      } catch {
        if (attempt === 30) throw new Error('PostgreSQL did not start');
        await setTimeout(500);
      }
    }
    const env = {
      ...process.env,
      Logging__LogLevel__Default: 'Warning',
      ASPNETCORE_ENVIRONMENT: 'Testing',
      ASPNETCORE_URLS: `http://127.0.0.1:${apiPort}`,
      ConnectionStrings__Default: `Host=127.0.0.1;Port=${port};Database=postgres;Username=postgres;Password=${password}`,
      Jwt__SigningKey: randomBytes(48).toString('base64'),
      Web__AllowedOrigins__0: 'https://localhost:8443',
    };
    execFileSync(
      'dotnet',
      [
        'ef',
        'database',
        'update',
        '--no-build',
        '--configuration',
        configuration,
        '--project',
        'server/src/Topout.Infrastructure',
        '--startup-project',
        'server/src/Topout.Api',
      ],
      { env, stdio: 'inherit' },
    );
    api = spawn(
      'dotnet',
      [resolve(`server/src/Topout.Api/bin/${configuration}/net10.0/Topout.Api.dll`)],
      {
        env,
        cwd: resolve('server/src/Topout.Api'),
        stdio: 'inherit',
      },
    );
    for (let attempt = 0; ; attempt++) {
      try {
        if (api.exitCode !== null) throw new Error('Test API exited before startup');
        await fetch(`http://127.0.0.1:${apiPort}/api/exercises`);
        break;
      } catch {
        if (attempt === 60) throw new Error('API did not start');
        await setTimeout(500);
      }
    }
    server = await serveWeb({ apiPort });
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}

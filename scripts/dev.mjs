import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const parserServiceDir = path.join(repoRoot, 'services', 'parser-service');

loadEnvConfig(repoRoot, true);

function checkTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function checkPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set (check .env). Cannot verify Postgres is reachable.');
    process.exit(1);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error(`DATABASE_URL is not a valid connection URL: ${url}`);
    process.exit(1);
  }
  const host = parsed.hostname || 'localhost';
  const port = Number(parsed.port) || 5432;
  const reachable = await checkTcp(host, port);
  if (!reachable) {
    console.error(
      `\nPostgres is not reachable at ${host}:${port}.\n` +
        `Start it, then re-run npm run dev. On this machine that's usually:\n` +
        `  brew services start postgresql@18\n`,
    );
    process.exit(1);
  }
}

function warnIfParserOpenAiKeyMissing() {
  let contents;
  try {
    contents = readFileSync(path.join(parserServiceDir, '.env'), 'utf8');
  } catch {
    console.warn(
      `[dev] services/parser-service/.env is missing. Copy .env.example and set OPENAI_API_KEY, ` +
        `or source indexing will fail once the parser service is up.`,
    );
    return;
  }
  const match = contents.match(/^OPENAI_API_KEY=(.*)$/m);
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  if (!value || value.includes('your-openai-api-key')) {
    console.warn(
      `[dev] services/parser-service/.env has no real OPENAI_API_KEY set. The parser service will ` +
        `start, but document indexing and AI generation will fail until you set one.`,
    );
  }
}

function runPrefixed(name, command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ['inherit', 'pipe', 'pipe'] });

  const pipeLines = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) out.write(`[${name}] ${line}\n`);
    });
    stream.on('close', () => {
      if (buffer.length) out.write(`[${name}] ${buffer}\n`);
    });
  };
  pipeLines(child.stdout, process.stdout);
  pipeLines(child.stderr, process.stderr);

  return child;
}

async function main() {
  await checkPostgres();
  warnIfParserOpenAiKeyMissing();

  const web = runPrefixed('web', 'npm', ['run', 'dev', '--workspace=@lb-studio/web'], {
    env: process.env,
  });
  const parser = runPrefixed('parser', path.join(parserServiceDir, 'venv', 'bin', 'python'), [
    '-m',
    'lb_studio_parser',
  ], { cwd: parserServiceDir, env: process.env });

  const children = [web, parser];
  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) child.kill(signal);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (shuttingDown) return;
      const other = children.find((candidate) => candidate !== child);
      console.error(
        `\n[dev] ${child === web ? 'web' : 'parser'} exited (${signal ?? code}); stopping the other process.\n`,
      );
      shutdown('SIGTERM');
      other?.once('exit', () => process.exit(code ?? 1));
    });
    child.on('error', (error) => {
      console.error(`[dev] failed to start:`, error);
      shutdown('SIGTERM');
      process.exit(1);
    });
  }
}

main();

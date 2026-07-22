import { spawn } from 'node:child_process';
import process from 'node:process';

import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const [workspace, script, ...args] = process.argv.slice(2);

if (!workspace || !script) {
  console.error('Usage: node scripts/run-workspace.mjs <workspace> <script> [...args]');
  process.exit(2);
}

loadEnvConfig(process.cwd(), script === 'dev');

const child = spawn('npm', ['run', script, `--workspace=${workspace}`, '--', ...args], {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Could not start ${workspace}:${script}:`, error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

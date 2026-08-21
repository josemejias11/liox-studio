import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/next-env.d.ts',
    'packages/database/src/generated/**',
    // Generated esbuild output — not authored source.
    'packages/scorm-export/dist/**',
    // The parser service uses Python tooling and is not part of ESLint.
    'services/parser-service/**',
  ]),
  {
    settings: {
      next: {
        rootDir: 'apps/web/',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
]);

export default eslintConfig;

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' },
      ],
    },
  },
  {
    // SPEC §3: components never touch Dexie; they go through lib/db/repositories.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'stores/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'Use lib/db/repositories/* instead of importing dexie.' },
            {
              name: 'dexie-react-hooks',
              message: 'Wrap useLiveQuery inside lib/db/repositories/* instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // D10: user-facing copy comes from the next-intl catalogue, never JSX literals.
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ['·', '—', '–', ':', '/', '%', '+', '-'],
        },
      ],
    },
  },
  prettier,
];

export default config;

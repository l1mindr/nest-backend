import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ['documentation/template-playground/**']
  },
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.eslint.json']
      }
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // ============================================================
  // Architecture Boundary Rules
  // ============================================================
  //
  // Dependency direction (top → bottom is allowed):
  //
  //   Presentation  →  Application  →  Domain
  //       ↓               ↓               ↓
  //   Core  ←──── shared layer ────→  Infrastructure
  //
  // ============================================================

  // ------------------------------------------------------------------
  // Core layer: must be 100% framework-agnostic.
  // Core is pure TypeScript — no NestJS, no TypeORM, no Express,
  // no Infrastructure, no Features, no Presentation.
  // ------------------------------------------------------------------
  {
    files: ['src/core/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/**'],
              message:
                'Core must not depend on NestJS. Core is a framework-agnostic layer.'
            },
            {
              group: ['typeorm', 'typeorm/**'],
              message:
                'Core must not depend on TypeORM. Core is a framework-agnostic layer.'
            },
            {
              group: ['express', 'express/**'],
              message:
                'Core must not depend on Express. Core is a framework-agnostic layer.'
            },
            {
              group: ['@infrastructure/**'],
              message:
                'Core must not import Infrastructure. Core is shared pure logic; infrastructure details belong in infra/.'
            },
            {
              group: ['@features/**'],
              message:
                'Core must not import Features. Core is a shared layer; features depend on core, not the reverse.'
            },
            {
              group: ['@presentation/**'],
              message:
                'Core must not import Presentation. Core is shared pure logic; presentation is a framework layer.'
            }
          ]
        }
      ]
    }
  },

  // ------------------------------------------------------------------
  // Presentation layer (shared + feature-level):
  // must NOT import Infrastructure directly.
  //
  // Presentation depends on Application (via dependency injection)
  // and on Core. Infrastructure is wired through DI, never imported.
  // ------------------------------------------------------------------
  {
    files: [
      'src/presentation/**',
      'src/features/*/presentation/**'
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@infrastructure/**'],
              message:
                'Presentation must not import Infrastructure directly. Inject infrastructure dependencies through the module layer.'
            }
          ]
        }
      ]
    }
  }

  // ------------------------------------------------------------------
  // FUTURE: Domain layer isolation
  //
  // Domain should only depend on Core, not on NestJS, TypeORM,
  // Infrastructure, or Presentation.
  //
  // Currently NOT enforced because domain entities still carry
  // TypeORM decorators and error classes import HttpStatus from
  // @nestjs/common. This is known architectural debt.
  //
  // Re-enable once:
  //  - domain entities are separated from ORM models
  //  - error classes use numeric status codes instead of HttpStatus
  //
  //   {
  //     files: ['src/features/*/domain/**'],
  //     rules: {
  //       '@typescript-eslint/no-restricted-imports': ['error', {
  //         patterns: [
  //           { group: ['@nestjs/**'],             message: 'Domain must not import NestJS.' },
  //           { group: ['typeorm', 'typeorm/**'],   message: 'Domain must not import TypeORM.' },
  //           { group: ['@infrastructure/**'],      message: 'Domain must not import Infrastructure.' },
  //           { group: ['@presentation/**'],        message: 'Domain must not import Presentation.' },
  //         ]
  //       }]
  //     }
  //   }
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // FUTURE: Cross-feature infrastructure containment
  //
  // Each feature's infrastructure layer should not import another
  // feature's infrastructure. Currently feature modules are
  // well-separated, so this is a guard against future violations.
  //
  // Cannot use no-restricted-imports for this because it also matches
  // same-feature imports (the pattern @features/*/infrastructure/*
  // can't distinguish self from others). Revisit with a custom rule
  // or eslint-plugin-boundaries.
  // ------------------------------------------------------------------
];

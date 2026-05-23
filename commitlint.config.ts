import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    /**
     * Allowed conventional commit types
     */
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'docs',
        'style',
        'chore',
        'revert'
      ]
    ],

    /**
     * Require scope
     * Example:
     * feat(auth): add login flow
     */
    'scope-empty': [2, 'never'],

    /**
     * Scope naming convention
     */
    'scope-case': [2, 'always', 'kebab-case'],

    /**
     * Subject rules
     */
    'subject-empty': [2, 'never'],

    'subject-full-stop': [2, 'never', '.'],

    /**
     * Allow sentence case in subject
     */
    'subject-case': [0],

    /**
     * Header max length
     */
    'header-max-length': [2, 'always', 100]
  },

  /**
   * Custom scopes for project architecture
   */
  prompt: {
    settings: {},

    questions: {
      scope: {
        description: 'Select the scope of this change',

        enum: {
          auth: {
            description: 'Authentication flow'
          },

          session: {
            description: 'Session lifecycle'
          },

          token: {
            description: 'JWT/token logic'
          },

          user: {
            description: 'User module'
          },

          db: {
            description: 'Database/migrations'
          },

          infra: {
            description: 'Infrastructure/devops'
          },

          redis: {
            description: 'Redis/cache layer'
          },

          test: {
            description: 'Testing infrastructure'
          },

          config: {
            description: 'Configuration'
          }
        }
      }
    }
  }
};

export default Configuration;

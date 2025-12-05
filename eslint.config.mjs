import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Ignore patterns
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  },

  // Base config for all files
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
  },

  // ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Prettier config (disables conflicting rules)
  prettierConfig,

  // Custom rules
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    plugins: {
      prettier,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // Naming conventions - enforce camelCase
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'property',
          format: null, // Allow any format for object properties
        },
        {
          selector: 'parameter',
          format: ['camelCase', 'snake_case'],
          leadingUnderscore: 'allow',
        },
      ],

      // Console warnings (allow error and warn)
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // Unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Allow any type (with warning)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Turn off explicit return types (optional)
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];

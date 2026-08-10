import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      'packages/database/generated/**',
      'apps/api/uploads/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Rules that apply to every TypeScript file in the workspace.
  {
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // The project bans `any` outright — see .claude/rules/typescript/coding-style.md
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // NestJS leans on decorators and empty constructor-injected classes.
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // Dependency injection reads constructor parameter types at runtime via
      // emitDecoratorMetadata. Rewriting those to `import type` erases the class
      // and breaks DI, so the rule must not apply here.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // The web app runs in the browser and uses React.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Claude Code hook scripts are plain CommonJS Node scripts.
  {
    files: ['.claude/scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  // Route modules export a component and its route definition by design.
  {
    files: ['apps/web/src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Seeds and scripts legitimately log to stdout.
  {
    files: ['packages/database/prisma/**/*.ts', '**/*.config.{ts,mts}'],
    rules: { 'no-console': 'off' },
  },

  // Tests may use loose typing for fixtures and mocks.
  {
    files: ['**/*.{spec,test}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  prettier,
);

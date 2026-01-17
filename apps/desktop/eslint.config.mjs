import globals from 'globals'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  // Ignore build outputs + heavy folders
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', '.vite/**', 'resources/**', 'build/**'],
  },

  // Base TS recommended
  ...tseslint.configs.recommended,

  // Your project (typed)
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        // IMPORTANT: points ESLint at your TS configs
        project: [
          path.join(__dirname, 'tsconfig.json'),
          path.join(__dirname, 'tsconfig.node.json'),
          path.join(__dirname, 'tsconfig.web.json'),
        ],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      prettier: prettierPlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // React 17+ doesn't need React in scope
      'react/react-in-jsx-scope': 'off',

      // Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Nice TS defaults
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Formatting
      'prettier/prettier': 'error',
    },
  },

  // ✅ Override: tests can use any / Function
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // ✅ Override: preload (IPC types often require any)
  {
    files: ['src/preload/**/*.{ts,tsx,d.ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
    },
  },

  // IMPORTANT: last = disables formatting conflicts with Prettier
  prettierConfig,
]

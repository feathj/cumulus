import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'mockup/**',
      'dist/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'next-env.d.ts',
      'src/generated/**',
    ],
  },
  // Next.js, React and React Hooks rules. Comes first so the type-checked
  // typescript-eslint setup below has the final say on TypeScript files.
  ...nextVitals,
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

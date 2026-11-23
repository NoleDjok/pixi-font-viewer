import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import prettierConfig from 'eslint-config-prettier';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

const scriptGlobals = { ...globals.browser, ...globals.es2021 };

const METHOD_ORDER = ['public-method', 'protected-method', 'private-method'];

const scriptRules = {
    'prettier/prettier': 'error',
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/member-ordering': ['error', { default: METHOD_ORDER }],
    'no-undef': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            ignoreRestSiblings: true,
        },
    ],
    'no-console': 'error',
    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': 'error',
};

export default [
    { ignores: ['dist/**', 'node_modules/**'] },
    { ...js.configs.recommended, files: ['src/**/*.ts'] },
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: scriptGlobals,
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            import: importPlugin,
            prettier: prettierPlugin,
            'unused-imports': unusedImportsPlugin,
        },
        settings: {
            'import/resolver': {
                typescript: { project: ['./tsconfig.app.json'] },
            },
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...importPlugin.flatConfigs.recommended.rules,
            ...importPlugin.flatConfigs.typescript.rules,
            ...prettierConfig.rules,
            ...scriptRules,
            'import/no-unresolved': 'error',
        },
    },
    ...vuePlugin.configs['flat/recommended'].map((config) => ({ ...config, files: ['src/**/*.vue'] })),
    {
        files: ['src/**/*.vue'],
        languageOptions: {
            parser: vueParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: { parser: tsParser },
            globals: scriptGlobals,
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            prettier: prettierPlugin,
            'unused-imports': unusedImportsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
            ...scriptRules,
        },
    },
];

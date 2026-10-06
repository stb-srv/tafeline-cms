import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/**',
            'web/**',
            'uploads/**',
            'backups/**',
            'data/**',
            '**/*.min.js',
        ],
    },
    js.configs.recommended,
    // Node.js / CommonJS backend
    {
        files: ['server/**/*.js', 'scripts/**/*.js', 'plugins/**/server.js', '*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: {
            'no-var': 'error',
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-console': 'warn',
        },
    },
    // Node:test Tests (CommonJS)
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: {
            'no-console': 'off',
        },
    },
    // CLI-Skripte und Startup: Ausgabe auf der Konsole ist gewollt
    {
        files: [
            'scripts/**/*.js',
            'reset-admin.js',
            'test-integration.js',
            'config.js',
            'server.js',
        ],
        rules: { 'no-console': 'off' },
    },
    // Browser ES modules frontend (Admin-Panel + Gäste-Frontend)
    {
        files: ['cms/**/*.js', 'menu-app/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.serviceworker,
                // Externe Bibliotheken (via <script> geladen)
                io: 'readonly',
                QRCode: 'readonly',
                puter: 'readonly',
                // App-interne, modulübergreifende Globals (kein Bundler)
                OpaI18n: 'readonly',
                toast: 'readonly',
                showToast: 'readonly',
                updateDashboardBadges: 'readonly',
                _closeNavSearch: 'readonly',
            },
        },
        rules: {
            'no-var': 'error',
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
    // Plugin-Frontend-Erweiterungen (CMS/Website-API als Global)
    {
        files: ['plugins/**/cms.js', 'plugins/**/website.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.browser, CMS: 'readonly', Website: 'readonly' },
        },
        rules: {
            'no-var': 'error',
            'prefer-const': 'warn',
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
];

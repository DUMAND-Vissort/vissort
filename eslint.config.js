export default [
    {
        ignores: [
            'node_modules/**',
            'playwright-report/**',
            'test-results/**',
            '*.min.js',
            'eslint.config.js'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                screen: 'readonly',
                performance: 'readonly',
                fetch: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                indexedDB: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
                FontFace: 'readonly',
                SpeechSynthesisUtterance: 'readonly',
                MutationObserver: 'readonly',
                DOMParser: 'readonly',
                getComputedStyle: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                AbortController: 'readonly',
                CompressionStream: 'readonly',
                Response: 'readonly',
                Request: 'readonly',
                crypto: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                self: 'readonly',
                caches: 'readonly',
                importScripts: 'readonly',
                // Project globals (window.X)
                VC: 'readonly',
                VissortCore: 'readonly',
                VissortCamera: 'readonly',
                VissortGraph: 'readonly',
                VissortReading: 'readonly',
                VissortAnimation: 'readonly',
                VissortDevice: 'readonly',
                AppEditorCore: 'readonly',
                Data: 'readonly',
                Voice: 'readonly',
                Toast: 'readonly',
                Onboarding: 'readonly',
                PlayerState: 'readonly',
                supabase: 'readonly',
                faceapi: 'readonly',
                JSZip: 'readonly',
                Sentry: 'readonly',
                Deno: 'readonly',
                // TODO(phase3): временные globals для player-runtime.
                // dir/direction/answer/stimArea/stimDisplay объявлены локально,
                // но player-animation.js использует их как глобальные.
                // Требуется рефакторинг: явный window.X в player-runtime.js.
                dir: 'writable',
                direction: 'writable',
                answer: 'writable',
                stimArea: 'writable',
                stimDisplay: 'writable'
            }
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^(_|e|err)$'
                }
            ],
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-unreachable': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }]
        }
    },
    {
        files: ['tests/**/*.js', 'playwright.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                test: 'readonly',
                expect: 'readonly',
                describe: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                process: 'readonly'
            }
        }
    }
];

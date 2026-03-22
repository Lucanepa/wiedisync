import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['pb_hooks/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        // PocketBase JSVM globals
        $app: 'readonly',
        $os: 'readonly',
        $http: 'readonly',
        $security: 'readonly',
        $apis: 'readonly',
        __hooks: 'readonly',
        routerAdd: 'readonly',
        routerUse: 'readonly',
        cronAdd: 'readonly',
        onRecordAfterCreateRequest: 'readonly',
        onRecordAfterUpdateRequest: 'readonly',
        onRecordAfterDeleteRequest: 'readonly',
        onRecordBeforeCreateRequest: 'readonly',
        onRecordBeforeUpdateRequest: 'readonly',
        onRecordBeforeDeleteRequest: 'readonly',
        onRecordAuthRequest: 'readonly',
        onMailerRecordPasswordResetSend: 'readonly',
        onMailerRecordVerificationEmailSend: 'readonly',
        onModelAfterCreate: 'readonly',
        onModelAfterUpdate: 'readonly',
        onModelAfterDelete: 'readonly',
        onBootstrap: 'readonly',
        onRecordCreate: 'readonly',
        onRecordUpdate: 'readonly',
        onRecordDelete: 'readonly',
        onRecordCreateRequest: 'readonly',
        onRecordUpdateRequest: 'readonly',
        onRecordDeleteRequest: 'readonly',
        onRecordAfterCreateSuccess: 'readonly',
        onRecordAfterUpdateSuccess: 'readonly',
        onRecordAfterDeleteSuccess: 'readonly',
        onMailerRecordVerificationSend: 'readonly',
        onMailerRecordEmailChangeSend: 'readonly',
        onMailerRecordAuthAlertSend: 'readonly',
        require: 'readonly',
        console: 'readonly',
        module: 'writable',
        Record: 'readonly',
        DynamicModel: 'readonly',
        MailerMessage: 'readonly',
        arrayOf: 'readonly',
        BadRequestError: 'readonly',
        NotFoundError: 'readonly',
        ForbiddenError: 'readonly',
        UnauthorizedError: 'readonly',
      },
    },
    rules: {
      'no-var': 'off',
      'no-unused-vars': ['warn', { vars: 'all', args: 'none', caughtErrors: 'none' }],
      'no-redeclare': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'off',
    },
  },
])

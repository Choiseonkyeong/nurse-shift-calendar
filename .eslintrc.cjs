// 코드 검사: 정의 안 된 변수(no-undef), 훅 규칙, 미사용 변수 등
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.2' } },
  plugins: ['react', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^(_|React$)', ignoreRestSiblings: true }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    // 기존 코드의 의도된 1회 실행 effect 가 많아 경고로 유지
    'react-hooks/exhaustive-deps': 'warn'
  },
  ignorePatterns: ['dist', 'node_modules', 'android', 'ios', 'supabase/functions']
};

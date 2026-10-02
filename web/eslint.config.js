import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/* RULEBOOK 2.1: "A lint rule bans screens/ and ui/ from importing engine-*
   or touching AudioContext or getUserMedia." RULEBOOK 2.4: all user-facing
   text comes from core/copy, so screens/ and ui/ may not write words into
   JSX themselves. */
const NO_SOUND = 'Screens and ui never touch sound: ask the conductor.';
const NO_WORDS = 'Words the singer reads come from core/copy.';
const NO_FORGED_TAP = 'Only a real tap starts sound: pass the event itself.';
const soundBan = {
  'no-restricted-imports': ['error', { patterns: [
    { group: ['**/engine-*', '**/engine-*/**'], message: NO_SOUND },
  ] }],
  'no-restricted-globals': ['error',
    { name: 'AudioContext', message: NO_SOUND },
    { name: 'webkitAudioContext', message: NO_SOUND },
    { name: 'OfflineAudioContext', message: NO_SOUND },
    { name: 'MediaStream', message: NO_SOUND },
  ],
  'no-restricted-syntax': ['error',
    { selector: "MemberExpression[property.name='getUserMedia']", message: NO_SOUND },
    { selector: "MemberExpression[property.name='mediaDevices']", message: NO_SOUND },
    { selector: "MemberExpression[property.name=/AudioContext$/]", message: NO_SOUND },
    { selector: "Identifier[name=/AudioContext$/]", message: NO_SOUND },
    { selector: "Property[key.name='isTrusted']", message: NO_FORGED_TAP },
    { selector: "JSXAttribute[name.name=/^(aria-label|title|alt|placeholder)$/] > Literal", message: NO_WORDS },
  ],
  'react/jsx-no-literals': ['error', { noStrings: true, allowedStrings: [], ignoreProps: true }],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: '19' } },
    rules: { ...hooks.configs.recommended.rules },
  },
  { files: ['src/screens/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'], rules: soundBan },
);

/* Every word the singer reads (RULEBOOK 2.4). Screens and ui take their
   words from here and nowhere else; the lint rule refuses words written
   into them, and copy.test.ts checks these against the rulebook: plain
   words, no jargon, no line over eight words. */

export const copy = {
  app: {
    name: 'Repertoire',
    tabsLabel: 'Sections',
  },
  tabs: {
    home: 'Home',
    train: 'Train',
    sing: 'Sing',
    coach: 'Coach',
    learn: 'Learn',
    library: 'Library',
    profile: 'Profile',
  },
  profile: {
    soundCheck: 'Sound check',
  },
  soundCheck: {
    title: 'Sound check',
    back: 'Profile',
    start: 'Start',
    stop: 'Stop',
    ready: 'Tap Start. A piano note plays.',
    note: 'Listen to the note.',
    opening: 'Allow the microphone to continue.',
    listening: 'Sing or speak. The bar should move.',
    level: 'How loud the microphone hears you',
    refused: 'No microphone. The note still works.',
    unavailable: 'No microphone found. The note still works.',
    failed: 'The microphone would not start.',
    carryOn: 'Carry on without it',
    again: 'Tap Start to hear it again.',
  },
} as const;

export type Copy = typeof copy;

/** Every string in the copy, with where it lives, for the copy-lint test. */
export function allCopy(node: unknown = copy, at = 'copy'): Array<{ at: string; text: string }> {
  if (typeof node === 'string') return [{ at, text: node }];
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => allCopy(v, at + '.' + k));
  }
  return [];
}

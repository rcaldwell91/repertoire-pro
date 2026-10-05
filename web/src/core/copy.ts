/* Every word the singer reads (RULEBOOK 2.4). Screens and ui take their
   words from here and nowhere else; the lint rule refuses words written
   into them, and copy.test.ts checks these against the rulebook: plain
   words, no jargon, no line over eight words.

   A line with {name} in it is a template: fill(template, { name: ... })
   puts the value in. The browser test recognises a filled template as
   coming from here. */

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
    account: 'Account',
    look: 'Look',
  },
  look: {
    title: 'Look',
    back: 'Profile',
    dark: 'Dark',
    light: 'Light',
    phone: 'Same as my phone',
    label: 'Colours',
  },
  account: {
    title: 'Account',
    back: 'Profile',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    orLink: 'Or get a sign-in link by email',
    sendLink: 'Email me a link',
    linkSent: 'Check your email for the link.',
    signedInAs: 'Signed in as {email}',
    signOut: 'Sign out',
    wrong: 'Email or password is wrong.',
    noAccount: 'No account with that email.',
    needEmail: 'Type your email first.',
    offline: "Can't reach the sign-in. Try again soon.",
  },
  sing: {
    title: 'Sing',
    learnSong: 'Learn a song',
    learnSongLine: 'Hear the voice, then sing it.',
    pitchTracker: 'Pitch Tracker',
    freeSing: 'Free Sing',
    karaoke: 'Karaoke',
    soon: 'Coming soon',
  },
  songs: {
    title: 'Learn a song',
    back: 'Sing',
    add: 'Add a song',
    none: 'No songs yet.',
    signInFirst: 'Sign in to add and split songs.',
    signIn: 'Sign in',
    ready: 'Ready',
    splitting: 'Splitting…',
    first30: 'First 30 seconds ready',
    needsSplit: 'Not split yet',
  },
  addSong: {
    title: 'Add a song',
    back: 'Learn a song',
    name: 'Song title',
    own: 'I own this copy',
    save: 'Save and split',
    noFile: 'Pick a song first.',
  },
  song: {
    back: 'Learn a song',
    start: 'Start',
    pause: 'Pause',
    back10: 'Back 10 seconds',
    repeat: 'Repeat this part',
    repeating: 'Repeating {from}–{to}',
    position: 'Where you are in the song',
    sound: 'Sound',
    voice: 'Voice',
    music: 'Music',
    percent: '{n}%',
    time: '{at} / {of}',
    sending: 'Sending the song… {n}%',
    waiting: 'Waiting for a free server…',
    splitting: 'Splitting: ready to {at} of {of}',
    first30: 'The first 30 seconds are ready to play.',
    saving: 'Saving the voice and music…',
    ready: 'Ready. Tap Start.',
    signIn: 'Sign in to split this song.',
    signInButton: 'Sign in',
    offline: "Can't reach the server. Try again soon.",
    tooBig: 'Over 30 MB. Pick a smaller file.',
    tooLong: 'Over 10 minutes. Pick a shorter song.',
    notAudio: "This file isn't a song we can play.",
    busy: 'The server is busy. Try again soon.',
    failed: "Splitting didn't work. Try again.",
    expired: 'The split was lost. Split it again.',
    tryAgain: 'Try again',
    splitNow: 'Split this song',
    map: "The singer's notes, and yours",
    reading: "Reading the singer's line… {at} of {of}",
    anyOctave: 'Any octave',
    hearYourself: 'Hear yourself',
    yourLevel: 'How loud the microphone hears you',
    headphones: 'Wired headphones work best.',
    micRefused: 'No microphone. The song still plays.',
    micMissing: 'No microphone found. The song still plays.',
    micFailed: 'The microphone would not start.',
    carryOn: 'Carry on without it',
  },
  take: {
    title: 'Your take',
    summary: '{length} · {pct}% right notes',
    unscored: '{length} · too little sung to score',
    hear: 'Hear it',
    stop: 'Stop',
    save: 'Save',
    send: 'Send to a coach',
    again: 'Try again',
    volume: 'Your take',
  },
  takes: {
    title: 'Your takes',
    row: '{date} · {length} · {pct}% right notes',
    rowUnscored: '{date} · {length}',
    hear: 'Hear this take',
    more: 'More for this take',
    delete: 'Delete',
    deleted: 'Take deleted.',
    undo: 'Undo',
    onPhone: 'On this phone. Saves online when connected.',
    signIn: 'On this phone. Sign in to save online.',
    uploading: 'Saving online… {n}%',
    saved: 'Saved',
    sending: 'Sending to {names}…',
    sent: 'Sent to {names}',
  },
  send: {
    title: 'Send to a coach',
    back: 'Back',
    pick: 'Choose who hears it.',
    none: "You haven't got a coach yet.",
    go: 'Send',
    signIn: 'Sign in to send it.',
    signInButton: 'Sign in',
    offline: "Can't reach your coaches. Try again soon.",
    noTake: 'Nothing to send. Record a take first.',
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

/** Put values into a template line: fill('Ready to {at}', { at: '0:30' }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : '{' + k + '}'));
}

/** Every string in the copy, with where it lives, for the copy-lint test. */
export function allCopy(node: unknown = copy, at = 'copy'): Array<{ at: string; text: string }> {
  if (typeof node === 'string') return [{ at, text: node }];
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => allCopy(v, at + '.' + k));
  }
  return [];
}

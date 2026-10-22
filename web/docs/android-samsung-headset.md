# Samsung S24 + USB-C headset: the facts (21 Oct 2026)

Source: Robert's error report, item 6, saved word for word.

Samsung S24 with a USB-C headset: ask for the mic once in raw mode, open the mic before the sound engine, and after a stall await the old engine's close and wait 800 ms before building the new one. The automatic mic ladder was removed on 5 Sep (v9.4) and must not return. A phone restart clears a jammed sound service.

## Never bring back

- The automatic mic ladder (trying several mic modes by itself, remembering which worked). It was the old app's v8.1 idea, withdrawn in v9.4 because every extra request made Android reconfigure its audio hardware and the phone froze for minutes. Other modes are reachable only by a hand tap, and only that hand choice is remembered.
- Automatic rebuilds or automatic mic retries of any kind. A tap, or nothing.

## Where the full story is

`web/docs/android-audio-history.md` (the old app's Android audio doc, v8 to v9.6, copied in whole).

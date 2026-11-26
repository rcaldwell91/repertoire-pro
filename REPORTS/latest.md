# Report, 25 Nov 2026, commit 19e62e5

As you asked: Vibrato's speed and width are now saved to your account with each session, so they follow you to a new phone and your coach can read them. Main hadn't moved since my 24 Nov report. Nothing that waits on your phone check was changed: the bubbles, the zoom and Mum's gap between rounds are as they were.

## What works

1. **Saved to your account.** When you're signed in, each Vibrato session goes to your account with its speed (to two places, such as 5.49 a second) and its width (whole cents). These are the same two numbers the result card shows first: over the held notes that wobbled. A session where nothing wobbled saves no numbers.
2. **Last time, from your account when you're signed in.** It comes from your account even on a phone that remembers something else. Under the numbers it says "Last time from your account."
3. **Last time, from the phone when you're signed out,** as before. Under the numbers it says "Last time kept on this phone."
4. **Try again** compares with the session you just sang.
5. **Sessions kept only on a phone stay there.** They aren't moved or deleted. They count as last time when you're signed out on that phone, not when you're signed in.
6. **Your coach can read them,** through the same rule that already lets a linked coach read your results. Nothing about who can read or write results changed.

## What was measured

- **The database:** two new places in the results table, for the speed and the width. Both can be left empty, so all earlier results and every other exercise stay as they were. I checked the table's rules before and after: who can add a result and who can read one are word for word the same. The definitions are kept with the app's other database scripts, as before.
- **With the two test accounts** (a singer, and a coach linked to them), signed in on a phone that remembered a different last time:
  - Vibrato showed last time from the account, not the phone, and said so.
  - The session reached the account with its speed and width. The number shown and the number saved matched.
  - Try again compared with the session just sung.
  - The linked coach read exactly the singer's Vibrato results, with both numbers. The coach couldn't add one for the singer or change one.
  - With the link taken away, the coach read nothing. I put the link back afterwards and checked it.
  - Signed out, no one could read any of it.
- **Signed out:** last time came from the phone, and said so.
- **Checks:** all 374 quick checks pass, and every check in a browser made to behave like your phone passes (206 of them, across all eight groups), as do the old app's checks.
- **Broken builds:** I broke the app on purpose 642 ways, 13 of them new for this change (such as never saving the numbers, or taking last time from the phone while signed in). The checks caught every one.
- **Test takes:** none left behind on either test account. Your account and Briar's weren't touched.

## What I decided

- **Signed in but no signal:** last time comes from the phone, and the card says "kept on this phone", so it never claims the account.
- **Signed in, nothing on your account yet:** no last time is shown, even if the phone remembers one. That's your rule: the account when signed in.

## Held

- **Where your coach sees the numbers.** Your coach can read them now, but no screen shows them yet. The new app's Coach tab isn't built. The old app's coach page counts a Vibrato session as a day practised but doesn't show its numbers, and that app is frozen. **Your decision: add a small coach view of them now, or leave it for when the Coach tab is built.**
- The test account keeps the Vibrato results the checks saved, as it keeps every other check's results: the results table lets no one delete them, and I didn't change that.

## Not tried on a real phone

Saving to your account and last time from it were run in Chrome made to behave like an Android phone, with a real recorded voice, not on your Samsung.

## Mistakes of mine

- When I first set the page to fetch last time from your account, I missed one case: moving straight from one exercise to another without leaving the page. The code checker caught it before anything was saved, and it's fixed.
- I started the last broken-build checks as one long job that could have hit its time limit. I stopped it and ran them in four parts. Nothing was lost.

## Your taps

Add this one to the end of the list from 24 Nov. Wired headphones on, as always.

3. Make sure you're signed in (Profile). Train, Tone, Vibrato: sing one or two rounds and tap the cross. Under the numbers it should say "Last time from your account.", with last time's numbers beside the new ones.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { copy, fill } from '../core/copy';
import { sendLink, signIn, signOut } from '../data/auth';
import { useUser } from '../shell/hooks';
import { back } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* Sign in to the existing Repertoire accounts: email and password, or a
   link by email. */
export function Account() {
  const me = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; problem: boolean } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const r = await signIn(email, password);
    setBusy(false);
    if (r === 'wrong') setNote({ text: copy.account.wrong, problem: true });
    if (r === 'offline') setNote({ text: copy.account.offline, problem: true });
    if (r === 'ok') setPassword('');
  }

  async function link() {
    if (!email.trim()) {
      setNote({ text: copy.account.needEmail, problem: true });
      return;
    }
    setBusy(true);
    const r = await sendLink(email, location.origin + location.pathname);
    setBusy(false);
    setNote(
      r === 'sent' ? { text: copy.account.linkSent, problem: false }
        : r === 'no-account' ? { text: copy.account.noAccount, problem: true }
          : { text: copy.account.offline, problem: true },
    );
  }

  return (
    <>
      <BackButton label={copy.account.back} onBack={() => back('/profile')} />
      <h1>{copy.account.title}</h1>
      {me ? (
        <>
          <p className="line" id="signed-in-as">{fill(copy.account.signedInAs, { email: me.email })}</p>
          <button type="button" className="btn btn-quiet" id="sign-out" onClick={() => void signOut()}>
            {copy.account.signOut}
          </button>
        </>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <label className="field">
            <span>{copy.account.email}</span>
            <input className="input" id="email" type="email" autoComplete="email" inputMode="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>{copy.account.password}</span>
            <input className="input" id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className="btn" id="sign-in" disabled={busy}>
            {busy ? copy.account.signingIn : copy.account.signIn}
          </button>
          <p className="line">{copy.account.orLink}</p>
          <button type="button" className="btn btn-quiet" id="send-link" disabled={busy} onClick={() => void link()}>
            {copy.account.sendLink}
          </button>
          <p className={'line' + (note?.problem ? ' problem' : '')} role="status">{note?.text}</p>
        </form>
      )}
    </>
  );
}

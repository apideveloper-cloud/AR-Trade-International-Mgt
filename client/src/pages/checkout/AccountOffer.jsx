import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import { loginKey, readSession, writeSession } from './constants.js';

/**
 * Right column of the order-placed page: offers a quick account made from the order. The generated login `{ id, password }` is kept in
 * sessionStorage and shown again after a reload until the customer presses "I have saved it".
 * `onLoginChange(login)` tells the parent whether a login is on screen (it widens the layout).
 */
export default function AccountOffer({ order, onLoginChange }) {
  const { user, say, autoAccount } = useStore();
  const key = loginKey(order.id);
  const [state, setState] = useState(() => ({ busy: false, err: '', login: readSession(key) }));
  const setLogin = login => { writeSession(key, login); setState({ busy: false, err: '', login }); onLoginChange(!!login); };

  const create = async () => {
    setState(s => ({ ...s, busy: true, err: '' }));
    try {
      const r = await autoAccount(order.id, order.customer.phone);
      setLogin(r.login);
    } catch (e) { setState({ busy: false, err: e.message, login: null }); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Mobile: ${state.login.id}\nPassword: ${state.login.password}`); say('Login details copied'); } catch { say('Could not copy: please note them down'); }
  };

  if (state.login) {
    return (
      <div className="ok-auto ok-auto-done" role="status">
        <i className="ok-auto-ic" aria-hidden="true">✅</i>
        <div className="ok-auto-t"><b>Your account is ready and you are signed in</b><span>Save these login details. You can change the password in Account → Settings.</span>
          <div className="ok-cred"><span>Mobile<b>{state.login.id}</b></span><span>Password<b>{state.login.password}</b></span></div>
        </div>
        <div className="ok-auto-act">
          <button type="button" className="btn btn-ghost btn-pill" onClick={copy}>Copy</button>
          <button type="button" className="btn btn-ghost btn-pill" onClick={() => setLogin(null)}>I have saved it</button>
          <Link className="btn btn-pill ok-auto-b" to={`/account/orders/${order.id}`}>Go to my account</Link>
        </div>
      </div>
    );
  }
  if (user) return null;
  return (
    <div className="ok-auto" role="region" aria-label="Create your account">
      <i className="ok-auto-ic" aria-hidden="true">🔑</i>
      <div className="ok-auto-t"><b>Get your own account in one tap</b><span>We will create it from this order and sign you in now. Your login is your mobile number <b>{order.customer.phone}</b>, with a password we generate for you.</span>
        <ul className="ok-perks"><li>Live order tracking</li><li>Invoices and warranty</li><li>Faster re-orders</li></ul>
        {state.err && <em className="ok-auto-err" role="alert">{state.err}</em>}</div>
      <button type="button" className="btn btn-pill ok-auto-b" disabled={state.busy} onClick={create}>{state.busy ? 'Creating…' : 'Create account & sign me in'}</button>
    </div>
  );
}

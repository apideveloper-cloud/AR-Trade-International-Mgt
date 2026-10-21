import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';

const load = (src, id) => new Promise((res, rej) => {
  if (document.getElementById(id)) return res();
  const s = document.createElement('script');
  s.id = id; s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Could not load the sign-in script'));
  document.head.appendChild(s);
});

/** "Continue with Google / Facebook" for the sign-in and register tabs. Works once the credentials are in server/.env. */
export default function Social({ onDone, onError }) {
  const { social } = useStore();
  const [cfg, setCfg] = useState(null);
  const gbox = useRef(null);
  const [busy, setBusy] = useState('');

  useEffect(() => { api.get('/auth/social/config').then(setCfg).catch(() => setCfg({})); }, []);

  const finish = async (provider, token) => {
    setBusy(provider);
    try { await social({ provider, token }); onDone(); } catch (e) { onError(e.message); }
    setBusy('');
  };

  // Google renders its own official button (it returns a signed ID token the server verifies)
  useEffect(() => {
    if (!cfg || !cfg.google || !gbox.current) return undefined;
    let dead = false;
    load('https://accounts.google.com/gsi/client', 'gsi-client').then(() => {
      if (dead || !window.google) return;
      window.google.accounts.id.initialize({ client_id: cfg.google, callback: r => finish('google', r.credential) });
      window.google.accounts.id.renderButton(gbox.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: gbox.current.clientWidth || 320 });
    }).catch(e => onError(e.message));
    return () => { dead = true; };
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const facebook = async () => {
    if (!cfg || !cfg.facebook) return onError('Facebook sign-in is not set up yet. An admin needs to add the Facebook app ID in server/.env.');
    try {
      await load('https://connect.facebook.net/en_US/sdk.js', 'fb-sdk');
      window.FB.init({ appId: cfg.facebook, cookie: false, xfbml: false, version: 'v19.0' });
      window.FB.login(r => { if (r.authResponse && r.authResponse.accessToken) finish('facebook', r.authResponse.accessToken); }, { scope: 'public_profile,email' });
    } catch (e) { onError(e.message); }
  };

  return (
    <div className="lg-social">
      <div className="lg-or"><span>or continue with</span></div>
      <div className="lg-sbtns">
        {cfg && cfg.google
          ? <div ref={gbox} className="g-slot" />
          : <button type="button" className="sbtn g" onClick={() => onError('Google sign-in is not set up yet. An admin needs to add the Google client ID in server/.env.')}><svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.200.8-4.700l-7.900-6.100C.9 16.500 0 20.100 0 24s.9 7.500 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.100 1.400-4.900 2.300-8.200 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>Google</button>}
        <button type="button" className="sbtn f" disabled={busy === 'facebook'} onClick={facebook}><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M14 8h3V4h-3c-2.800 0-4.500 1.800-4.500 4.600V11H7v4h2.500v9h4v-9H17l.6-4h-4.100V8.900c0-.6.300-.9.500-.9z"/></svg>Facebook</button>
      </div>
    </div>
  );
}

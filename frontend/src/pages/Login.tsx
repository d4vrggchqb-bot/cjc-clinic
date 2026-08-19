import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import {
  FiUser, FiLock, FiEye, FiEyeOff, FiShield,
  FiFolder, FiBox, FiBarChart2, FiArrowRight, FiChevronRight,
} from 'react-icons/fi';

const GOOGLE_CLIENT_ID = '814203352511-rp2uq7eajh56v8k9gnspbmureb2hpk3a.apps.googleusercontent.com';

/* ─────────────────────────────────────────────────────────────────
   Responsive CSS injected at mount time.
   We use a <style> block because inline styles cannot express
   media queries, :hover pseudo-classes, or CSS calc with viewport
   units that depend on sibling dimensions.
───────────────────────────────────────────────────────────────── */
const RESPONSIVE_CSS = `
  /* ── Root layout ─────────────────────────────────────────────── */
  .cjc-root {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    font-family: 'Mulish', sans-serif;
    position: relative;
  }

  /* ── Left column (login card) ─────────────────────────────────── */
  .cjc-left {
    width: 36%;
    min-width: 300px;
    max-width: 460px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 16px;
    z-index: 30;
    flex-shrink: 0;
  }

  /* ── Right column (branding + cards) ─────────────────────────── */
  .cjc-right {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 30;
    padding-top: clamp(28px, 8vh, 64px);
    padding-bottom: 24px;
    padding-left: 8px;
    padding-right: 16px;
    overflow: hidden;
  }

  /* ── Cards container ──────────────────────────────────────────── */
  .cjc-cards {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: stretch;
    gap: clamp(8px, 1.4vw, 18px);
    width: 100%;
    max-width: 820px;
    padding: 0 8px;
  }

  /* ── Individual feature card ──────────────────────────────────── */
  .cjc-card {
    position: relative;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    cursor: default;
    overflow: hidden;
    border-radius: 18px;
    padding: 18px 16px 14px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05);
    transition: transform 0.24s ease, box-shadow 0.24s ease;
    /* fluid width: fills row evenly, but collapses to 2-per-row if space is tight */
    flex: 1 1 clamp(110px, 18vw, 160px);
    max-width: 180px;
    min-width: 110px;
  }

  .cjc-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 18px 44px rgba(0,0,0,0.13), 0 4px 10px rgba(192,29,56,0.09);
  }

  /* ── CJC branding block ───────────────────────────────────────── */
  .cjc-brand {
    text-align: center;
    width: 100%;
    padding: 0 12px;
    margin-bottom: clamp(14px, 3.5vh, 30px);
  }

  .cjc-wordmark {
    font-family: 'Fraunces', 'Georgia', serif;
    font-weight: 900;
    color: #C01D38;
    line-height: 1;
    letter-spacing: -0.03em;
    text-shadow: 0 2px 14px rgba(192,29,56,0.15);
    font-size: clamp(38px, 5.5vw, 72px);
  }

  .cjc-subtitle {
    font-size: clamp(10px, 1.2vw, 16px);
    font-weight: 800;
    color: #1e293b;
    letter-spacing: 0.05em;
    text-shadow: 0 1px 4px rgba(255,255,255,0.45);
    text-transform: uppercase;
  }

  /* ── Powered-by pill ──────────────────────────────────────────── */
  .cjc-footer {
    margin-top: auto;
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 0 8px;
  }

  /* ══════════════════════════════════════════
     RESPONSIVE BREAKPOINTS
  ══════════════════════════════════════════ */

  /* Medium screens — cards go 2×2 */
  @media (max-width: 900px) {
    .cjc-left {
      width: 42%;
      min-width: 280px;
    }
    .cjc-card {
      flex: 1 1 calc(50% - 12px);
      max-width: calc(50% - 12px);
    }
    .cjc-wordmark {
      font-size: clamp(30px, 5vw, 50px);
    }
  }

  /* Small screens — stack vertically */
  @media (max-width: 680px) {
    .cjc-root {
      flex-direction: column;
      height: auto;
      overflow-y: auto;
    }
    .cjc-left {
      width: 100%;
      max-width: 100%;
      height: auto;
      padding: 24px 16px;
    }
    .cjc-right {
      width: 100%;
      height: auto;
      padding: 24px 16px 32px;
    }
    .cjc-card {
      flex: 1 1 calc(50% - 10px);
      max-width: calc(50% - 10px);
    }
  }

  /* Very small screens — 1-column cards */
  @media (max-width: 420px) {
    .cjc-card {
      flex: 1 1 100%;
      max-width: 100%;
    }
  }

  /* input focus ring — easier in CSS than inline onFocus */
  .cjc-input {
    width: 100%;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    padding: 13px 16px 13px 44px;
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    background: #f8fafc;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    font-family: inherit;
    box-sizing: border-box;
  }
  .cjc-input:focus {
    border-color: #C01D38;
    box-shadow: 0 0 0 3px rgba(192,29,56,0.10);
    background: #fff;
  }
  .cjc-input-pr {
    padding-right: 44px;
  }
  .cjc-input-readonly {
    color: #94a3b8;
    background: #f1f5f9;
    padding-left: 16px;
  }
`;

/* ─── Heartbeat / ECG line ──────────────────────────────────────── */
const HeartbeatLine = () => (
  <svg viewBox="0 0 120 24" fill="none" style={{ width: 'clamp(80px, 10vw, 120px)', height: 24, color: '#C01D38', opacity: 0.9 }}>
    <polyline
      points="0,12 18,12 24,4 30,20 36,4 42,20 48,12 56,12 60,2 64,22 68,12 120,12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/* ─── Medical cross ─────────────────────────────────────────────── */
const MedCross = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="0 0 28 28" style={{ width: size, height: size, flexShrink: 0 }}>
    <rect x="10" y="2" width="8" height="24" rx="3" fill="#C01D38" />
    <rect x="2" y="10" width="24" height="8" rx="3" fill="#C01D38" />
    <rect x="11" y="3" width="6" height="22" rx="2" fill="#DF3A50" opacity="0.45" />
  </svg>
);

/* ─── Feature Card ──────────────────────────────────────────────── */
const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="cjc-card">
    {/* Top accent stripe */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #C01D38, #DF3A50)', borderRadius: '18px 18px 0 0' }} />

    {/* Icon bubble */}
    <div style={{
      background: 'linear-gradient(135deg, #fff0f2 0%, #fde8eb 100%)',
      border: '1px solid #fbc8d0',
      borderRadius: 13,
      padding: 9,
      marginBottom: 10,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties }>, {
        style: { width: 18, height: 18, color: '#C01D38', strokeWidth: 2.5 },
      })}
    </div>

    <h4 style={{ fontWeight: 800, fontSize: 11, color: '#1e293b', marginBottom: 3, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
      {title}
    </h4>
    <p style={{ fontSize: 9.5, color: '#64748b', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
      {desc}
    </p>

    {/* Chevron */}
    <div style={{
      marginTop: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #C01D38, #9B1530)',
      alignSelf: 'flex-end',
    }}>
      <FiChevronRight style={{ width: 11, height: 11, color: '#fff', strokeWidth: 3 }} />
    </div>
  </div>
);

/* ─── Main Login Component ──────────────────────────────────────── */
const Login: React.FC = () => {
  const [view, setView] = useState<'login' | 'request_reset' | 'perform_reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const response = await apiFetch('/api/index.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (response.success) {
        if (response.user?.username) {
          try {
            const raw = localStorage.getItem('cjc_saved_switch_accounts');
            const list = raw ? JSON.parse(raw) : [];
            const idx = list.findIndex((a: any) => a.username.toLowerCase() === response.user.username.toLowerCase());
            const item = { username: response.user.username, name: response.user.name || response.user.username, role: response.user.role || 'Staff', branch: response.user.clinic_branch || 'College Clinic' };
            if (idx >= 0) list[idx] = { ...list[idx], ...item }; else list.push(item);
            localStorage.setItem('cjc_saved_switch_accounts', JSON.stringify(list));
          } catch { /* silent */ }
        }
        window.location.href = '/dashboard';
      } else {
        setError(response.error || 'Login failed. Please try again.');
      }
    } catch {
      setError('Network error. Could not connect to the server.');
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(''); setMessage('');
    try {
      const response = await apiFetch('/api/index.php?action=google_login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      if (response.success) {
        window.location.href = '/dashboard';
      } else {
        setError(response.error || 'Google Login failed. Ensure you are using a @g.cjc.edu.ph account.');
      }
    } catch {
      setError('Network error. Could not connect to the server.');
    }
  };

  const handleGoogleError = () => setError('Google Sign-In was unsuccessful. Try again later.');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const res = await apiFetch('/api/index.php?action=request_password_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername }),
      });
      if (res.success) {
        if (res.token) { setResetToken(res.token); setView('perform_reset'); setMessage('Reset token generated. Please enter a new password.'); }
        else setMessage(res.message || 'If the account exists, reset instructions were sent.');
      } else setError(res.message || 'Failed to create reset request.');
    } catch { setError('Network error. Could not connect to the server.'); }
  };

  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const res = await apiFetch('/api/index.php?action=perform_password_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });
      if (res.success) { setView('login'); setMessage('Password reset successful. You may now sign in.'); setUsername(resetUsername); setPassword(''); }
      else setError(res.message || 'Failed to reset password.');
    } catch { setError('Network error. Could not connect to the server.'); }
  };

  /* ── Shared reusable sub-styles ──────────────────────────────── */
  const alertBase: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 11, textAlign: 'center', fontWeight: 700 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: '#1e293b', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' };
  const iconWrap: React.CSSProperties = { position: 'absolute', top: '50%', left: 14, transform: 'translateY(-50%)', pointerEvents: 'none' };
  const redBtn: React.CSSProperties = {
    width: '100%', background: 'linear-gradient(135deg, #DF1A2E 0%, #C01D38 55%, #9B1530 100%)',
    color: '#fff', fontWeight: 800, letterSpacing: '0.12em', border: 'none', cursor: 'pointer',
    borderRadius: 14, boxShadow: '0 6px 20px rgba(192,29,56,0.38)', fontFamily: 'inherit',
    transition: 'transform 0.18s, box-shadow 0.18s',
  };

  return (
    <>
      {/* Inject responsive CSS once */}
      <style>{RESPONSIVE_CSS}</style>

      <div className="cjc-root">

        {/* ══════════════════════════════════════════════════════
            LAYER 0 — Full-bleed clinic photograph
        ══════════════════════════════════════════════════════ */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: "url('/Norbert.jpg')",
          backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 30%, rgba(10,5,5,0.16) 100%)', zIndex: 1 }} />

        {/* ══════════════════════════════════════════════════════
            LAYER 1 — Deep sweeping red arc (left ~68%)
        ══════════════════════════════════════════════════════ */}
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '68vw', zIndex: 10, pointerEvents: 'none', filter: 'drop-shadow(18px 0 48px rgba(0,0,0,0.52))' }}>
          <svg style={{ width: '100%', height: '100%' }} preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="bgRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5a0010" />
                <stop offset="38%" stopColor="#8B0D1E" />
                <stop offset="72%" stopColor="#B8192F" />
                <stop offset="100%" stopColor="#D42036" />
              </linearGradient>
              <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C01D38" stopOpacity="0" />
                <stop offset="50%" stopColor="#ff5072" stopOpacity="0.11" />
                <stop offset="100%" stopColor="#C01D38" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,0 L63,0 C58,34 68,67 98,100 L0,100 Z" fill="url(#bgRedGrad)" />
            <path d="M0,0 L51,0 C47,29 55,59 79,100 L69,100 C45,59 37,29 41,0 Z" fill="url(#ribbonGrad)" />
            <path d="M0,20 C6,21 15,24 23,32 C31,40 35,57 29,72 C23,86 8,93 0,96 Z" fill="rgba(255,255,255,0.022)" />
          </svg>

          {/* Dot grid — fades right */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '18vw', height: '100%',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.17) 1.2px, transparent 1.2px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
          }} />

          {/* Decorative plus marks */}
          <div style={{ position: 'absolute', top: '7%',  right: '39%', color: 'rgba(255,255,255,0.07)', fontSize: 40, fontWeight: 900 }}>+</div>
          <div style={{ position: 'absolute', top: '34%', right: '32%', color: 'rgba(255,255,255,0.05)', fontSize: 54, fontWeight: 900 }}>+</div>
          <div style={{ position: 'absolute', bottom: '17%', right: '15%', color: 'rgba(255,255,255,0.04)', fontSize: 70, fontWeight: 900 }}>+</div>
          <div style={{ position: 'absolute', top: '60%', left: '6%', color: 'rgba(255,255,255,0.06)', fontSize: 26, fontWeight: 900 }}>+</div>
        </div>

        {/* ══════════════════════════════════════════════════════
            LAYER 2 — Content columns
        ══════════════════════════════════════════════════════ */}

        {/* ─── LEFT COLUMN — Login card ────────────────────────── */}
        <div className="cjc-left">
          {/* White glass card */}
          <div style={{
            width: '100%',
            maxWidth: 420,
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 28,
            padding: 'clamp(22px, 4vh, 36px) clamp(20px, 3.5vw, 32px) clamp(18px, 3vh, 28px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.17), 0 4px 16px rgba(0,0,0,0.07)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxSizing: 'border-box',
          }}>
            {/* Card top accent */}
            <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 3, background: 'linear-gradient(90deg, transparent, #C01D38, #DF3A50, transparent)', borderRadius: '0 0 4px 4px' }} />

            {/* Logo ring */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', padding: 3, background: 'linear-gradient(135deg, #C01D38, #8B0D1E)', boxShadow: '0 6px 20px rgba(192,29,56,0.32)' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src="/assets/logo.png" alt="CJC Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
                </div>
              </div>
            </div>

            {/* Heading */}
            <h2 style={{ fontSize: view === 'login' ? 'clamp(20px, 2.4vw, 26px)' : 'clamp(18px, 2vw, 22px)', fontWeight: 900, color: '#0f172a', textAlign: 'center', marginBottom: 5, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {view === 'login' ? 'Welcome Back!' : view === 'request_reset' ? 'Forgot Password' : 'Reset Password'}
            </h2>
            <p style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 1.55, fontWeight: 500, padding: '0 6px' }}>
              {view === 'login' ? 'Sign in to access your patient records and inventory system.' : 'Enter your details to reset your password and regain access.'}
            </p>

            {/* Alerts */}
            {error   && <div style={{ ...alertBase, background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c' }}>{error}</div>}
            {message && <div style={{ ...alertBase, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>{message}</div>}

            {/* ═══════════════ LOGIN FORM ═══════════════ */}
            {view === 'login' && (
              <form onSubmit={handleLogin} style={{ width: '100%' }}>
                {/* Username */}
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="username" style={labelStyle}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><FiUser style={{ width: 16, height: 16, color: '#94a3b8', strokeWidth: 2.5 }} /></div>
                    <input id="username" type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" className="cjc-input" />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor="password" style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><FiLock style={{ width: 16, height: 16, color: '#94a3b8', strokeWidth: 2.5 }} /></div>
                    <input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="cjc-input cjc-input-pr" />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                      {showPassword ? <FiEyeOff style={{ width: 16, height: 16, strokeWidth: 2.5 }} /> : <FiEye style={{ width: 16, height: 16, strokeWidth: 2.5 }} />}
                    </button>
                  </div>
                </div>

                {/* Forgot */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
                  <button type="button" onClick={() => { setView('request_reset'); setError(''); setMessage(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#C01D38', padding: 0, fontFamily: 'inherit' }}>
                    Forgot Password?
                  </button>
                </div>

                {/* Sign In */}
                <button type="submit" style={{ ...redBtn, fontSize: 13, padding: '13px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ flex: 1, textAlign: 'center', paddingLeft: 18 }}>SIGN IN</span>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.17)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiArrowRight style={{ width: 14, height: 14, strokeWidth: 3 }} />
                  </div>
                </button>

                {/* OR */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ position: 'absolute', background: 'rgba(255,255,255,0.97)', padding: '0 10px', fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase' }}>OR</span>
                </div>

                {/* Google */}
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} useOneTap theme="outline" size="large" text="continue_with" shape="rectangular" width="320" />
                  </GoogleOAuthProvider>
                </div>
              </form>
            )}

            {/* ═══════════════ REQUEST RESET ═══════════════ */}
            {view === 'request_reset' && (
              <form onSubmit={handleRequestReset} style={{ width: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="resetUsername" style={labelStyle}>Enter your username</label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><FiUser style={{ width: 16, height: 16, color: '#94a3b8', strokeWidth: 2.5 }} /></div>
                    <input id="resetUsername" type="text" required value={resetUsername} onChange={e => setResetUsername(e.target.value)} placeholder="e.g. j.delacruz" className="cjc-input" />
                  </div>
                </div>
                <button type="submit" style={{ ...redBtn, fontSize: 12, padding: '12px 20px', marginBottom: 12 }}>REQUEST RESET LINK</button>
                <div style={{ textAlign: 'center' }}>
                  <button type="button" onClick={() => { setView('login'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 700, fontFamily: 'inherit' }}>← Back to Login</button>
                </div>
              </form>
            )}

            {/* ═══════════════ PERFORM RESET ═══════════════ */}
            {view === 'perform_reset' && (
              <form onSubmit={handlePerformReset} style={{ width: '100%' }}>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="resetToken" style={labelStyle}>Reset Token</label>
                  <input id="resetToken" type="text" required value={resetToken} readOnly className="cjc-input cjc-input-readonly" />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label htmlFor="newPassword" style={labelStyle}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <div style={iconWrap}><FiLock style={{ width: 16, height: 16, color: '#94a3b8', strokeWidth: 2.5 }} /></div>
                    <input id="newPassword" type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="cjc-input" />
                  </div>
                </div>
                <button type="submit" style={{ ...redBtn, fontSize: 12, padding: '12px 20px', marginBottom: 12 }}>RESET PASSWORD</button>
                <div style={{ textAlign: 'center' }}>
                  <button type="button" onClick={() => { setView('login'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748b', fontWeight: 700, fontFamily: 'inherit' }}>← Back to Login</button>
                </div>
              </form>
            )}

            {/* Security badge */}
            <div style={{ marginTop: 18, background: 'linear-gradient(135deg,#fff5f6,#fdeced)', borderRadius: 13, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 11, border: '1px solid #fbc8d0' }}>
              <div style={{ background: '#fff', borderRadius: 9, padding: 6, boxShadow: '0 2px 8px rgba(192,29,56,0.13)', flexShrink: 0 }}>
                <FiShield style={{ color: '#C01D38', width: 14, height: 14, strokeWidth: 2.5 }} />
              </div>
              <div>
                <h4 style={{ color: '#C01D38', fontWeight: 800, fontSize: 9.5, letterSpacing: '0.04em' }}>Secure · Reliable · Trusted</h4>
                <p style={{ color: '#64748b', fontSize: 9, marginTop: 2, fontWeight: 500, lineHeight: 1.4 }}>Your data is protected with enterprise-grade security.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN — Branding + Cards + Footer ────────── */}
        <div className="cjc-right">

          {/* CJC-Clinic branding */}
          <div className="cjc-brand">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
              <MedCross size={Math.max(20, Math.min(28, window.innerWidth * 0.022))} />
              <span className="cjc-wordmark">CJC-Clinic</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <HeartbeatLine />
            </div>

            <h3 className="cjc-subtitle">Clinic Patient Records System and Inventory</h3>
          </div>

          {/* ── Feature Cards ────────────────────────────────── */}
          <div className="cjc-cards">
            <FeatureCard icon={<FiFolder />}    title="Patient Records" desc="Secure patient information" />
            <FeatureCard icon={<FiBox />}        title="Inventory"       desc="Track and manage clinic supplies" />
            <FeatureCard icon={<FiBarChart2 />}  title="Reports"         desc="Generate accurate statistics" />
            <FeatureCard icon={<FiShield />}     title="Secure Access"   desc="Role-based system access" />
          </div>

          {/* ── Powered-by pill ──────────────────────────────── */}
          <div className="cjc-footer">
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 9999,
              padding: '11px clamp(20px, 4vw, 36px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.07)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              maxWidth: '90%',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.85)',
            }}>
              {/* Shield pin */}
              <div style={{ position: 'absolute', top: -14, background: '#fff', borderRadius: '50%', padding: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', border: '1px solid #f1f5f9' }}>
                <div style={{ background: 'linear-gradient(135deg, #C01D38, #9B1530)', borderRadius: '50%', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiShield style={{ color: '#fff', width: 13, height: 13, strokeWidth: 2.5 }} />
                </div>
              </div>

              <p style={{ fontSize: 8, color: '#94a3b8', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 10 }}>Powered by</p>
              <p style={{ fontSize: 'clamp(11px, 1.2vw, 13px)', fontWeight: 900, color: '#C01D38', marginTop: 2, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                Rhea Grace Balatero &amp; John Mark Limsan
              </p>
              <p style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>
                Originally conceived and developed by Bangcalan, Diva, Ngojo, and Sipalay
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

export default Login;

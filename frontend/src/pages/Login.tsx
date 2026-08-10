import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { FiUser, FiLock, FiEye, FiEyeOff, FiShield, FiFolder, FiBox, FiBarChart2, FiHeart, FiArrowRight } from 'react-icons/fi';

const GOOGLE_CLIENT_ID = '814203352511-rp2uq7eajh56v8k9gnspbmureb2hpk3a.apps.googleusercontent.com';

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="bg-white rounded-[1.5rem] p-3 md:p-4 lg:p-5 flex flex-col items-center text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-transform w-[23%] min-w-[110px] max-w-[160px] cursor-default shrink-0">
    <div className="bg-[#fdf4f5] text-[#C01D38] p-3 rounded-2xl mb-3 border border-red-50">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5 lg:w-6 lg:h-6 stroke-[2.5]' })}
    </div>
    <h4 className="font-extrabold text-slate-800 text-[11px] lg:text-[13px] mb-1">{title}</h4>
    <p className="text-[9px] lg:text-[10px] text-slate-500 font-medium px-1 leading-tight">{desc}</p>
  </div>
);

const Login: React.FC = () => {
  const [view, setView] = useState<'login' | 'request_reset' | 'perform_reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Reset password states
  const [resetUsername, setResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/api/index.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.success) {
        window.location.href = '/dashboard';
      } else {
        setError(response.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Could not connect to the server.');
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError('');
    setMessage('');
    
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
    } catch (err) {
      setError('Network error. Could not connect to the server.');
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was unsuccessful. Try again later.');
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const res = await apiFetch('/api/index.php?action=request_password_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername }),
      });

      if (res.success) {
        if (res.token) {
          setResetToken(res.token);
          setView('perform_reset');
          setMessage('Reset token generated. Please enter a new password.');
        } else {
          setMessage(res.message || 'If the account exists, reset instructions were sent.');
        }
      } else {
        setError(res.message || 'Failed to create reset request.');
      }
    } catch (err) {
      setError('Network error. Could not connect to the server.');
    }
  };

  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const res = await apiFetch('/api/index.php?action=perform_password_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });

      if (res.success) {
        setView('login');
        setMessage('Password reset successful. You may now sign in.');
        setUsername(resetUsername);
        setPassword('');
      } else {
        setError(res.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Network error. Could not connect to the server.');
    }
  };

  return (
    <div className="relative w-full h-screen font-sans overflow-hidden bg-slate-50 flex">
      
      {/* Background Image - Object Cover positioned at top */}
      <div 
        className="absolute inset-0 z-0 w-full h-full object-cover bg-cover bg-top bg-no-repeat" 
        style={{ backgroundImage: `url('/Norbert.jpg')` }}
      ></div>

      {/* Massive Sweeping Red Arc */}
      <div className="absolute top-0 left-0 h-full w-[70vw] z-10 pointer-events-none drop-shadow-[20px_0_40px_rgba(0,0,0,0.6)]">
        <svg 
          className="w-full h-full" 
          preserveAspectRatio="none" 
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="redCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7B0411" />
              <stop offset="50%" stopColor="#A41222" />
              <stop offset="100%" stopColor="#d61a2e" />
            </linearGradient>
          </defs>
          {/* Exact Mockup Curve: Top at 60%, curves gently inward to 55%, sweeps aggressively to 95% at bottom */}
          <path d="M0,0 L60,0 C55,40 65,70 95,100 L0,100 Z" fill="url(#redCurveGrad)" />
        </svg>
        
        {/* Subtle dot pattern restricted to the left edge */}
        <div 
          className="absolute top-0 left-0 w-[15vw] h-full opacity-[0.06]" 
          style={{ 
            backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', 
            backgroundSize: '16px 16px',
            maskImage: 'linear-gradient(to right, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, black, transparent)'
          }}
        ></div>
        
        {/* Subtle background plus marks on the red wave */}
        <div className="absolute top-[10%] right-[42%] text-white/5 text-4xl font-black">+</div>
        <div className="absolute top-[38%] right-[35%] text-white/10 text-5xl font-black">+</div>
        <div className="absolute bottom-[20%] right-[18%] text-white/5 text-6xl font-black">+</div>
      </div>

      {/* Main Content Layout - Exact 35% / 65% split always forced */}
      <div className="relative z-20 w-full h-full flex flex-row">
        
        {/* LEFT COLUMN: 35% fixed width */}
        <div className="w-[35vw] h-full flex flex-col items-center justify-center p-4 z-30 min-w-[320px]">
           
           <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] px-8 py-10 flex flex-col relative z-40 mx-auto">
              
              <img src="/assets/logo.png" alt="CJC Logo" className="w-[85px] h-[85px] mx-auto mb-5 object-contain" />
              
              <h2 className="text-[28px] lg:text-[32px] font-black text-slate-800 text-center mb-1.5 tracking-tight">
                {view === 'login' ? 'Welcome Back!' : view === 'request_reset' ? 'Forgot Password' : 'Reset Password'}
              </h2>
              <p className="text-[12px] lg:text-[13px] text-slate-500 text-center mb-8 px-2 font-medium leading-relaxed">
                {view === 'login' 
                  ? 'Sign in to access your patient records and inventory system.' 
                  : 'Enter your details to reset your password and regain access.'}
              </p>
              
              {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg py-2.5 px-4 mb-5 text-xs text-center font-semibold">
                  {error}
                </div>
              )}
              {message && (
                <div className="bg-green-50 text-green-600 border border-green-100 rounded-lg py-2.5 px-4 mb-5 text-xs text-center font-semibold">
                  {message}
                </div>
              )}
              
              {/* Forms */}
              {view === 'login' && (
                <form onSubmit={handleLogin} className="w-full">
                  <div className="mb-4">
                    <label className="block text-[12px] font-extrabold text-slate-800 mb-1.5" htmlFor="username">Username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FiUser className="h-[18px] w-[18px] text-slate-400" />
                      </div>
                      <input 
                        id="username" 
                        type="text" 
                        required 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3.5 pl-[42px] text-[13px] lg:text-[14px] font-medium focus:border-[#C01D38] focus:ring-1 focus:ring-[#C01D38] outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-[12px] font-extrabold text-slate-800 mb-1.5" htmlFor="password">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FiLock className="h-[18px] w-[18px] text-slate-400" />
                      </div>
                      <input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3.5 pl-[42px] pr-10 text-[13px] lg:text-[14px] font-medium focus:border-[#C01D38] focus:ring-1 focus:ring-[#C01D38] outline-none transition-all placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#C01D38] focus:outline-none transition-colors"
                      >
                        {showPassword ? <FiEyeOff className="w-[18px] h-[18px]" /> : <FiEye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end mb-6">
                    <button
                      type="button"
                      onClick={() => { setView('request_reset'); setError(''); setMessage(''); }}
                      className="text-[11px] lg:text-[12px] text-[#C01D38] hover:text-red-800 font-bold transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  
                  <button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#DF1A2E] to-[#B01323] text-white font-bold text-[13px] lg:text-[14px] tracking-wide py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-between px-6 mb-5"
                  >
                    <span className="flex-1 text-center pl-4">SIGN IN</span>
                    <FiArrowRight className="w-[18px] h-[18px]" />
                  </button>
                  
                  <div className="relative flex items-center justify-center w-full mb-5 mt-1">
                    <div className="border-t border-slate-200 w-full"></div>
                    <span className="absolute bg-white px-2 text-[9px] uppercase text-slate-400 font-bold tracking-widest">OR</span>
                  </div>
                  
                  <div className="flex justify-center w-full mt-1">
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        useOneTap
                        theme="outline"
                        size="large"
                        text="continue_with"
                        shape="rectangular"
                        width="320"
                      />
                    </GoogleOAuthProvider>
                  </div>
                </form>
              )}

              {view === 'request_reset' && (
                <form onSubmit={handleRequestReset} className="w-full">
                  <div className="mb-5">
                    <label className="block text-[11px] font-extrabold text-slate-800 mb-1.5" htmlFor="resetUsername">Enter your username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <FiUser className="h-[16px] w-[16px] text-slate-400" />
                      </div>
                      <input 
                        id="resetUsername" 
                        type="text" 
                        required 
                        value={resetUsername}
                        onChange={(e) => setResetUsername(e.target.value)}
                        placeholder="e.g. j.delacruz"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3.5 pl-[38px] text-[12px] lg:text-[13px] font-medium focus:border-[#C01D38] focus:ring-1 focus:ring-[#C01D38] outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-[#DF1A2E] to-[#B01323] text-white font-bold text-[12px] lg:text-[13px] tracking-wide py-3.5 rounded-xl hover:shadow-lg transition-all mb-4">
                    REQUEST RESET LINK
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setView('login'); setError(''); setMessage(''); }} className="text-xs text-slate-500 hover:text-slate-800 font-bold transition-colors">
                      Back to Login
                    </button>
                  </div>
                </form>
              )}

              {view === 'perform_reset' && (
                <form onSubmit={handlePerformReset} className="w-full">
                  <div className="mb-4">
                    <label className="block text-[11px] font-extrabold text-slate-800 mb-1.5" htmlFor="resetToken">Reset Token</label>
                    <input 
                      id="resetToken" 
                      type="text" 
                      required 
                      value={resetToken}
                      readOnly
                      className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3.5 text-[12px] lg:text-[13px] font-medium text-slate-500 outline-none"
                    />
                  </div>
                  <div className="mb-5">
                    <label className="block text-[11px] font-extrabold text-slate-800 mb-1.5" htmlFor="newPassword">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <FiLock className="h-[16px] w-[16px] text-slate-400" />
                      </div>
                      <input 
                        id="newPassword" 
                        type="password" 
                        required 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3.5 pl-[38px] text-[12px] lg:text-[13px] font-medium focus:border-[#C01D38] focus:ring-1 focus:ring-[#C01D38] outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-[#DF1A2E] to-[#B01323] text-white font-bold text-[12px] lg:text-[13px] tracking-wide py-3.5 rounded-xl hover:shadow-lg transition-all mb-4">
                    RESET PASSWORD
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setView('login'); setError(''); setMessage(''); }} className="text-xs text-slate-500 hover:text-slate-800 font-bold transition-colors">
                      Back to Login
                    </button>
                  </div>
                </form>
              )}

              {/* Security Badge */}
              <div className="mt-6 bg-[#fdf5f6] rounded-xl p-2.5 flex items-center gap-3 border border-red-50">
                 <div className="bg-white rounded-lg p-1.5 shadow-sm shrink-0">
                   <FiShield className="text-[#C01D38] w-[14px] h-[14px] stroke-[2.5]" />
                 </div>
                 <div>
                   <h4 className="text-[#C01D38] font-extrabold text-[10px] tracking-wide">Secure • Reliable • Trusted</h4>
                   <p className="text-[9px] text-slate-500 mt-[1px] font-medium leading-snug">Your data is protected with enterprise-grade security.</p>
                 </div>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN: Exactly 65% width ALWAYS */}
        <div className="w-[65vw] flex h-full flex-col items-center relative z-30 pt-[8vh] lg:pt-[10vh] pb-8">
           
           {/* Top Headers */}
           <div className="text-center mb-10 w-full px-4">
              <div className="text-[#C01D38] text-[20px] md:text-[24px] lg:text-[28px] font-black leading-none mb-1">+</div>
              <div className="text-[#C01D38] text-[48px] md:text-[56px] lg:text-[72px] font-black leading-none tracking-tight">
                CJC-Clinic
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 mb-3 text-[#C01D38]">
                 <div className="h-[2px] w-[24px] bg-[#C01D38] rounded-full"></div>
                 <FiHeart className="w-[14px] h-[14px] lg:w-[16px] lg:h-[16px] fill-current" />
                 <div className="h-[2px] w-[24px] bg-[#C01D38] rounded-full"></div>
              </div>
              <h3 className="text-[14px] md:text-[16px] lg:text-[18px] font-black text-slate-900 tracking-wide mt-1 drop-shadow-sm">
                Clinic Patient Records System and Inventory
              </h3>
           </div>

           {/* 4 Feature Cards (Fixed width layout that wraps safely) */}
           <div className="flex flex-row flex-wrap justify-center gap-3 md:gap-4 lg:gap-5 w-full max-w-[850px] px-2">
              <FeatureCard icon={<FiFolder />} title="Patient Records" desc="Secure patient information" />
              <FeatureCard icon={<FiBox />} title="Inventory" desc="Track and manage clinic supplies" />
              <FeatureCard icon={<FiBarChart2 />} title="Reports" desc="Generate accurate statistics" />
              <FeatureCard icon={<FiShield />} title="Secure Access" desc="Role-based system access" />
           </div>

           {/* Elegant Footer Pill pushed to bottom */}
           <div className="mt-auto bg-white rounded-full px-8 py-3 lg:px-12 lg:py-3.5 shadow-lg flex flex-col items-center text-center relative w-fit mx-auto min-w-[280px] lg:min-w-[400px]">
              {/* Shield Pin */}
              <div className="absolute -top-[16px] bg-white rounded-full p-[3px] shadow-sm border border-slate-50">
                 <div className="bg-[#C01D38] rounded-full p-[6px]">
                    <FiShield className="text-white w-[14px] h-[14px] fill-current stroke-[2.5]" />
                 </div>
              </div>
              
              <p className="text-[8px] lg:text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">Powered by</p>
              <p className="text-[12px] lg:text-[14px] font-black text-[#C01D38] mt-[1px] tracking-tight">Rhea Balatero & John Mark Limsan</p>
              <p className="text-[8px] lg:text-[9px] text-slate-400 mt-[3px] font-medium">Originally conceived and developed by Bangcalian, Diva, Ngojo, and Sipayon</p>
           </div>
           
        </div>
      </div>
    </div>
  );
};

export default Login;

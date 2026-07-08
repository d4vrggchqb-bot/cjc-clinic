import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await apiFetch('/api/index.php?action=login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.success) {
        navigate('/dashboard');
      } else {
        setError(response.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Could not connect to the server.');
    }
  };

  return (
    <div className="min-h-screen font-sans flex w-full">
      {/* Left Side: Login Form */}
      <section className="flex flex-col items-center justify-center bg-[#F9F9F9] w-full lg:w-1/2 p-6 md:p-12 relative shadow-xl z-20">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-[2rem] font-medium text-[#C01D38] mb-1 tracking-tight">Sign In</h2>
            <p className="text-slate-600 text-sm font-medium">Access your patient information</p>
          </div>
          
          {/* Card */}
          <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 rounded-sm p-8 md:px-10 md:py-12 w-full relative z-10">
            {error && (
              <div className="bg-red-50 text-red-600 border border-red-100 rounded py-3 px-4 mb-6 text-sm text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleLogin}>
              {/* Username Field */}
              <div className="mb-5">
                <label className="block text-[0.8rem] text-slate-700 mb-1.5 font-medium" htmlFor="username">
                  Username
                </label>
                <input 
                  id="username" 
                  type="text" 
                  required 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border-t border-l border-b-2 border-r-2 border-slate-200/70 bg-[#FAFAFA] rounded-sm px-4 py-2.5 text-sm focus:border-[#C01D38] focus:bg-white outline-none transition-all shadow-inner"
                />
              </div>
              
              {/* Password Field */}
              <div className="mb-3">
                <label className="block text-[0.8rem] text-slate-700 mb-1.5 font-medium" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border-t border-l border-b-2 border-r-2 border-slate-200/70 bg-[#FAFAFA] rounded-sm px-4 py-2.5 pr-10 text-sm focus:border-[#C01D38] focus:bg-white outline-none transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#C01D38] focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end mb-8">
                <a href="#" className="text-[0.7rem] text-[#C01D38] hover:underline font-medium">
                  Forgot Password?
                </a>
              </div>
              
              {/* Submit Button */}
              <button 
                type="submit" 
                className="w-full bg-[#C01D38] text-white font-bold text-sm tracking-wide py-3.5 rounded-sm hover:bg-[#a0182f] transition-colors shadow-sm"
              >
                SIGN IN
              </button>
            </form>
          </div>
        </div>

        {/* Copyright */}
        <div className="absolute bottom-6 left-8 lg:left-12">
          <p className="text-[0.65rem] text-slate-400 font-medium">
            &copy; 2026 CJC-Clinic. All Rights Reserved.
          </p>
        </div>
      </section>

      {/* Right Side: Branding */}
      <section 
        className="w-full lg:w-1/2 flex-col items-center justify-center border-l border-slate-100 p-12" 
        style={{ display: 'flex', backgroundColor: '#ffffff' }}
      >
        <div className="text-center max-w-md w-full">
          <img 
            src="/assets/logo.png" 
            alt="CJC Logo" 
            style={{ width: '14rem', height: '14rem', margin: '0 auto 1.5rem', objectFit: 'contain' }}
          />
          <h1 style={{ fontSize: '2.25rem', color: '#C01D38', fontWeight: 'bold', margin: '0', position: 'relative', display: 'inline-block' }}>
            CJC-Clinic<sup style={{ position: 'absolute', top: '-1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>+</sup>
          </h1>
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>
            Clinic Patient Records System and Inventory
          </p>
          
          <div style={{ margin: '2rem auto', borderTop: '1px solid rgba(226, 232, 240, 0.6)', width: '75%' }}></div>
          
          <div style={{ color: '#64748b' }}>
            <div style={{ fontSize: '0.65rem', opacity: 0.75 }}>Powered by</div>
            <div style={{ fontSize: '0.7rem', fontStyle: 'italic', opacity: 0.85, marginTop: '0.25rem', color: '#475569' }}>
              Rhea Balatero &amp; John Mark Limsan
            </div>
            <div style={{ fontSize: '0.6rem', fontStyle: 'italic', opacity: 0.5, marginTop: '0.25rem' }}>
              Originally conceived and developed by Margarilyn Zosa, Elgin Manlisig
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;

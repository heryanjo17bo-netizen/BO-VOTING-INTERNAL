import React, { useState } from 'react';
import type { StaffUser } from '../types/index.ts';
import { loginStaff } from '../utils/api.ts';

interface AdminLoginGateProps {
  allowedStaff: StaffUser[];
  onLoginSuccess: (user: StaffUser) => void;
  onBackToHome: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  allowedStaff,
  onLoginSuccess,
  onBackToHome,
}) => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your authorized staff email address.');
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Please enter your security PIN.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await loginStaff(email.trim(), pin.trim());
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg('Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Access Denied. You are not on the authorized staff list.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#211D1C] text-[#F7F0EA] flex flex-col justify-between selection:bg-[#F6AC67]/30">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90vw] h-[450px] bg-gradient-to-b from-[#D8B37A]/15 via-[#F6AC67]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container */}
      <main className="relative z-10 max-w-md w-full mx-auto px-4 py-12 flex-1 flex flex-col justify-center items-center">
        {/* Brand Card */}
        <div className="w-full bg-[#2A2422] rounded-3xl border border-[#4A3F39] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Top highlight line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D8B37A] to-transparent" />

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <img
              src="/assets/aistudio/BO_LOGO_cc0ca4aa.png"
              alt="Black Owl Logo"
              className="w-16 h-16 object-contain drop-shadow-[0_4px_20px_rgba(216,179,122,0.35)] mb-3"
            />
            <h1 className="font-['Cinzel'] tracking-[0.2em] text-xl font-black text-[#F7F0EA] uppercase">
              BLACK OWL
            </h1>
            <p className="tracking-[0.25em] text-[11px] font-bold text-[#D8B37A] uppercase mt-0.5">
              STAFF & STAGE CONTROL
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#211D1C] border border-[#4A3F39] text-[10px] text-[#AFA39B]">
              <svg className="w-3 h-3 text-[#D8B37A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Restricted Staff Portal</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs text-center flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1 text-left leading-tight">{errorMsg}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="staff-email" className="block text-[11px] font-bold uppercase tracking-wider text-[#D8B37A] mb-1">
                Authorized Staff Email
              </label>
              <input
                id="staff-email"
                type="email"
                required
                placeholder="staff@blackowl.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#211D1C] border border-[#4A3F39] focus:border-[#D8B37A] rounded-xl px-3.5 py-2.5 text-xs text-[#F7F0EA] placeholder-[#AFA39B]/40 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="staff-pin" className="block text-[11px] font-bold uppercase tracking-wider text-[#D8B37A] mb-1">
                Security PIN
              </label>
              <input
                id="staff-pin"
                type="password"
                required
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-[#211D1C] border border-[#4A3F39] focus:border-[#D8B37A] rounded-xl px-3.5 py-2.5 text-xs text-[#F7F0EA] placeholder-[#AFA39B]/40 focus:outline-none transition-colors tracking-widest"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#D8B37A] to-[#F6AC67] hover:from-[#e2be84] hover:to-[#f8b678] text-[#211D1C] font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg hover:shadow-[0_4px_20px_rgba(216,179,122,0.3)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#211D1C] border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign In as Staff</span>
                </>
              )}
            </button>
          </form>

          {/* Notice for guests */}
          <div className="mt-5 text-center">
            <p className="text-[11px] text-[#AFA39B] leading-relaxed">
              Are you a guest wishing to vote?
            </p>
            <button
              onClick={onBackToHome}
              className="mt-1 text-xs text-[#F6AC67] hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
            >
              <span>← Return to Guest Voting Portal</span>
            </button>
          </div>
        </div>

        {/* Security watermark */}
        <p className="mt-6 text-[10px] text-[#AFA39B]/60 text-center uppercase tracking-widest">
          BLACK OWL SECURITY • SESSION AUDITED & SCENIC RESTRICTED
        </p>
      </main>
    </div>
  );
};

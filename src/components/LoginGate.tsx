import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  History,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { auth } from '../firebase';
import { ADMIN_LOGIN_EMAIL, AGENT_LOGIN_DOMAIN } from '../types';

function resolveLoginEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim().toLowerCase();
  if (trimmed === 'admin') {
    return ADMIN_LOGIN_EMAIL.toLowerCase();
  }
  if (trimmed && !trimmed.includes('@')) {
    return `${trimmed}@${AGENT_LOGIN_DOMAIN}`;
  }
  return trimmed;
}

export function LoginGate() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const resolvedEmail = resolveLoginEmail(username);
    if (!resolvedEmail || !resolvedEmail.includes('@')) {
      setError('Enter your user login, "admin", or a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, resolvedEmail, password);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not enabled yet. Enable Email/Password in Firebase Console under Authentication → Sign-in method.',
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setError(
          `Invalid credentials for ${resolvedEmail}. Confirm the user exists under Firebase Authentication → Users with a 6+ character password.`,
        );
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a moment and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in.');
      }
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/assets/aistudio/image_3b1feb10.png"
              alt="Cerebus Cyber Forensics"
              referrerPolicy="no-referrer"
              className="h-9 w-auto object-contain"
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
            Monthly Cutoff: 2nd · Payout: 7th
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="lg:col-span-7 p-8 lg:p-10 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#0812B8] tracking-wide uppercase">
                Cerebus Cyber Forensics · Operations Ledger
              </p>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                Staff Payment & Compliance Confirmation
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Centralize agent onboarding records, confirm or update monthly banking details ahead of the 2nd-of-month cutoff, verify payouts for the 7th, and inspect an immutable forensic paper trail.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Monthly YYYYMM Cycles:</span> Agents confirm existing accounts or upload updated bank statements 5 days before the 7th.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <FileCheck2 className="w-4 h-4 text-[#0812B8] mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Verified Compliance Vault:</span> Manage ID/Passport copies, contracts, uniform sizing, and bank proofs in one dossier.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <History className="w-4 h-4 text-slate-800 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Forensic Paper Trail:</span> Every personal info edit, document upload, and bank change records who changed what and when.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#0B1120] text-white p-8 lg:p-10 flex flex-col justify-center space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-300">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Agent, Staff & Admin Access</span>
              </div>
              <h2 className="text-lg font-semibold text-white">
                Sign in to Cerebus Ledger
              </h2>
            </div>

            {error && (
              <div className="p-3 bg-red-950/70 border border-red-700/60 rounded-lg text-xs text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username or Email
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3 py-2.5 text-sm text-white bg-slate-900/90 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm text-white bg-slate-900/90 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-medium text-white bg-[#0812B8] hover:bg-[#1420D8] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{signingIn ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Late updates submitted after the 2nd of the payment month remain enabled and are automatically flagged for Admin review.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        Cerebus Cyber Forensics · Staff Payments & Documentation Ledger
      </footer>
    </div>
  );
}

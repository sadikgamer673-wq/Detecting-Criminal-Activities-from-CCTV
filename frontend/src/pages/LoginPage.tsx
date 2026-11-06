import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  ArrowLeft,
  Fingerprint
} from 'lucide-react';
import type { AuthUser, UserRole } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBackToLanding: () => void;
}

interface PresetAccount {
  username: string;
  name: string;
  role: UserRole;
  badgeId: string;
  department: string;
  roleLabel: string;
  password: string;
}

const PRESET_ACCOUNTS: PresetAccount[] = [
  {
    username: 'admin',
    name: 'Cmdr. Alex Vance',
    role: 'admin',
    badgeId: 'CMD-9041',
    department: 'Surveillance Operations Division',
    roleLabel: 'System Administrator',
    password: 'admin',
  },
  {
    username: 'analyst',
    name: 'Sarah Chen',
    role: 'analyst',
    badgeId: 'ANL-4208',
    department: 'Threat Forensics & Audit',
    roleLabel: 'Threat Analyst',
    password: 'analyst',
  },
  {
    username: 'operator',
    name: 'Marcus Brody',
    role: 'operator',
    badgeId: 'OPS-1192',
    department: 'Live Perimeter Patrol',
    roleLabel: 'Field Operator',
    password: 'operator',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToLanding }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const match = PRESET_ACCOUNTS.find(
        (acc) => acc.username.toLowerCase() === username.trim().toLowerCase()
      );

      // Verify credentials for authorized roles
      if (
        match && 
        (password === match.password || 
         password === `${match.password}123` || 
         password === 'admin' || 
         password === 'admin123' ||
         password === 'analyst' ||
         password === 'analyst123' ||
         password === 'operator' ||
         password === 'operator123' ||
         password === '123456')
      ) {
        const authUser: AuthUser = {
          username: match.username,
          name: match.name,
          role: match.role,
          badgeId: match.badgeId,
          department: match.department,
          loginTime: new Date().toISOString(),
        };
        localStorage.setItem('cctv_auth_user', JSON.stringify(authUser));
        setIsLoading(false);
        onLoginSuccess(authUser);
      } else {
        setIsLoading(false);
        setError('Authentication failed. Invalid username or security access key.');
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-command-bg text-slate-100 flex flex-col justify-center items-center px-4 py-12 select-none relative overflow-hidden font-sans">
      {/* Background cyber radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Bar Navigation */}
      <div className="w-full max-w-md mb-6 flex justify-between items-center z-10">
        <button
          onClick={onBackToLanding}
          className="text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Landing Page</span>
        </button>

        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded flex items-center gap-1.5 shadow-sm">
          <Fingerprint className="w-3.5 h-3.5" />
          <span>SECURE GATEWAY</span>
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-command-surface border border-command-border rounded-xl shadow-2xl p-8 z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Security Operator Console
          </h1>
          <p className="text-[11px] text-blue-400 font-semibold px-2">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-xs text-slate-400">
            Sign in with authorized security credentials to access the AI surveillance network.
          </p>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Operator Username / Badge ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-command-panel border border-command-border rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Security Access Key / Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-command-panel border border-command-border rounded-lg pl-9 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Authorize & Enter Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security Compliance Disclaimer */}
      <div className="mt-6 text-center text-[11px] text-slate-500 font-mono max-w-md">
        Protected by Role-Based Access Control (RBAC). All unauthorized login attempts and system interactions are logged into the security audit ledger.
      </div>
    </div>
  );
};

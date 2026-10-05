'use client';

import React, { useState } from 'react';
import { ShieldCheck, LogIn, AlertCircle, RefreshCw, KeyRound, FileText, UserCheck, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { User } from '@/types';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('abhishekad152003@gmail.com');
  const [password, setPassword] = useState('123456');
  const [selectedPreset, setSelectedPreset] = useState<'master_admin' | 'employee' | 'custom'>('master_admin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.login(email, password);
      onLoginSuccess({
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_master_admin: data.is_master_admin,
        department: data.department,
      });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectMasterAdminPreset = () => {
    setSelectedPreset('master_admin');
    setEmail('abhishekad152003@gmail.com');
    setPassword('123456');
    setError(null);
  };

  const selectEmployeePreset = () => {
    setSelectedPreset('employee');
    setEmail('employee@sop.com');
    setPassword('123456');
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#1f1f1f] border border-zinc-750 rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden text-zinc-100">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50 mb-3">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">SOP Intelligence Platform</h2>
          <p className="text-xs text-zinc-400">
            Select your account type or sign in with your assigned credentials.
          </p>
        </div>

        {/* Quick Role Selection Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={selectMasterAdminPreset}
            className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              selectedPreset === 'master_admin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Master Admin</span>
          </button>

          <button
            type="button"
            onClick={selectEmployeePreset}
            className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              selectedPreset === 'employee'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Employee</span>
          </button>
        </div>

        {/* Quick Role Badge Info */}
        <div className="p-3 bg-zinc-850/80 rounded-xl border border-zinc-750/80 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedPreset === 'master_admin' ? (
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div>
              <p className="font-semibold text-zinc-200">
                {selectedPreset === 'master_admin' ? 'Master Administrator' : 'Department Employee'}
              </p>
              <p className="text-[11px] text-zinc-400">
                {selectedPreset === 'master_admin'
                  ? 'Full document management & RBAC access'
                  : 'Restricted to department assigned SOPs'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
            Preset
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="e.g. employee@sop.com"
              className="w-full bg-zinc-900 text-sm text-zinc-100 rounded-xl px-3.5 py-2.5 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="••••••••"
              className="w-full bg-zinc-900 text-sm text-zinc-100 rounded-xl px-3.5 py-2.5 border border-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In as {selectedPreset === 'master_admin' ? 'Master Admin' : selectedPreset === 'employee' ? 'Employee' : 'User'}</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-1">
          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1">
            <KeyRound className="w-3 h-3" />
            <span>Role-Based Access Control (RBAC) Enforced</span>
          </p>
        </div>
      </div>
    </div>
  );
};

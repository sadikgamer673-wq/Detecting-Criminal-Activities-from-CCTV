import React from 'react';
import { Activity, Database, RefreshCw, Cpu, HardDrive, LogOut, User, Globe } from 'lucide-react';
import type { HealthResponse, AuthUser } from '../types';

interface HeaderProps {
  health: HealthResponse | null;
  latencyMs: number;
  isLoading: boolean;
  error: string | null;
  currentUser?: AuthUser | null;
  onRefresh: () => void;
  onLogout?: () => void;
  onViewLanding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  latencyMs,
  isLoading,
  error,
  currentUser,
  onRefresh,
  onLogout,
  onViewLanding,
}) => {
  const isOnline = health?.status === 'healthy';
  const isDegraded = health?.status === 'degraded';

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'analyst':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'operator':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <header className="h-16 bg-command-surface border-b border-command-border px-6 flex items-center justify-between select-none">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            System Status:
          </span>
          {/* Status Pill */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isDegraded
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline
                  ? 'bg-emerald-400 animate-pulse'
                  : isDegraded
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
            />
            <span className="capitalize">
              {health ? health.status : error ? 'Offline' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Latency & DB status */}
        {health && (
          <div className="hidden lg:flex items-center space-x-4 text-xs text-slate-400 font-mono border-l border-command-border pl-4">
            <span className="flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Ping: {latencyMs}ms</span>
            </span>
            <span className="flex items-center space-x-1">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>{health.database_type}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>CPU: {health.system.cpu_percent}%</span>
            </span>
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span>Free Disk: {health.system.disk_free_gb} GB</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {onViewLanding && (
          <button
            onClick={onViewLanding}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 hover:text-white text-xs font-medium transition-colors border border-command-border"
            title="View Public Landing Page"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Landing Page</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 hover:text-white text-xs font-medium transition-colors border border-command-border disabled:opacity-50"
          title="Refresh Backend Telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          <span>Sync</span>
        </button>

        {currentUser && (
          <div className="flex items-center space-x-2 pl-2 border-l border-command-border">
            <div className="flex items-center space-x-2 bg-command-panel px-2.5 py-1 rounded border border-command-border text-xs">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-200 hidden md:inline">{currentUser.name}</span>
              <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${getRoleBadgeClass(currentUser.role)}`}>
                {currentUser.role}
              </span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded bg-command-panel hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-command-border hover:border-red-500/30 transition-colors"
                title="Sign Out of Console"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

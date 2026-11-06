import React from 'react';
import { 
  LayoutDashboard, 
  Cctv, 
  FileVideo, 
  AlertTriangle, 
  Film, 
  Sliders, 
  FileText, 
  Settings,
  ShieldCheck,
  Crosshair,
  Globe,
  Lock
} from 'lucide-react';
import type { NavTab, AuthUser } from '../types';
import { hasPermission, type PermissionKey } from '../services/permissions';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreviewedCount?: number;
  onViewLanding?: () => void;
  currentUser?: AuthUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  unreviewedCount = 0, 
  onViewLanding,
  currentUser 
}) => {
  const navItems: { id: NavTab; label: string; icon: any; requiredPermission?: PermissionKey; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'live_monitoring', label: 'Live Monitoring', icon: Cctv, requiredPermission: 'view_live_monitoring' },
    { id: 'video_analysis', label: 'Video Analysis', icon: FileVideo, requiredPermission: 'upload_videos' },
    { 
      id: 'incident_center', 
      label: 'Incident Center', 
      icon: AlertTriangle,
      badge: unreviewedCount > 0 ? unreviewedCount : undefined 
    },
    { id: 'weapon_validation', label: 'Weapon Validation', icon: Crosshair },
    { id: 'evidence_library', label: 'Evidence Library', icon: Film },
    { id: 'camera_management', label: 'Camera Management', icon: Sliders, requiredPermission: 'manage_cameras' },
    { id: 'reports', label: 'Reports', icon: FileText, requiredPermission: 'export_reports' },
    { id: 'settings', label: 'Settings', icon: Settings, requiredPermission: 'manage_settings' },
  ];

  return (
    <aside className="w-64 bg-command-surface border-r border-command-border flex flex-col h-screen select-none">
      {/* Brand & System Title */}
      <div className="p-5 border-b border-command-border flex items-center space-x-3">
        <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/40 text-blue-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xs font-bold tracking-wider text-slate-100 uppercase line-clamp-1" title="Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms">
            Criminal Activity AI
          </h1>
          <p className="text-[10px] font-mono text-slate-400 line-clamp-1" title="Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms">
            CCTV AI & ML Detection
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400 px-3 pb-2 tracking-wider">
          <span>Core Operations</span>
          {currentUser && (
            <span className="font-mono text-[9px] text-blue-400 bg-blue-500/10 px-1 rounded">
              {currentUser.role}
            </span>
          )}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isPermitted = !item.requiredPermission || hasPermission(currentUser || null, item.requiredPermission);

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : isPermitted
                  ? 'text-slate-300 hover:text-white hover:bg-command-panel'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-command-panel/40 opacity-80'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isPermitted ? 'text-slate-400' : 'text-slate-600'}`} />
                <span>{item.label}</span>
              </div>
              
              <div className="flex items-center space-x-1.5">
                {!isPermitted && (
                  <span title="Requires elevated clearance" className="text-amber-500/80">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                )}
                {item.badge !== undefined && (
                  <span className="bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-command-border bg-command-bg/40 space-y-2">
        {onViewLanding && (
          <button
            onClick={onViewLanding}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 hover:text-white text-xs font-medium transition-colors border border-command-border"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Public Landing Page</span>
          </button>
        )}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
          <span>Inference: CPU Mode</span>
          <span className="text-emerald-400">Ready</span>
        </div>
      </div>
    </aside>
  );
};

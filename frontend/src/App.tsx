import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { Overview } from './pages/Overview';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { VideoAnalysis } from './pages/VideoAnalysis';
import { IncidentCenter } from './pages/IncidentCenter';
import { WeaponValidationDashboard } from './pages/WeaponValidationDashboard';
import { EvidenceLibrary } from './pages/EvidenceLibrary';
import { CameraManagement } from './pages/CameraManagement';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import type { NavTab, HealthResponse, AuthUser } from './types';
import { fetchHealth } from './services/api';
import { hasPermission, type PermissionKey } from './services/permissions';
import { Lock, ArrowLeft, LogIn } from 'lucide-react';

type AppView = 'landing' | 'login' | 'dashboard';

const TAB_PERMISSIONS: Partial<Record<NavTab, { key: PermissionKey; title: string; requiredClearance: string }>> = {
  live_monitoring: { key: 'view_live_monitoring', title: 'Live Camera Monitoring', requiredClearance: 'Field Operator or Commander' },
  video_analysis: { key: 'upload_videos', title: 'Forensic Video Upload & Analysis', requiredClearance: 'Forensic Analyst or Commander' },
  camera_management: { key: 'manage_cameras', title: 'CCTV Camera Endpoint Management', requiredClearance: 'Lead Commander (Admin)' },
  reports: { key: 'export_reports', title: 'Forensic Reports & Data Export', requiredClearance: 'Forensic Analyst or Commander' },
  settings: { key: 'manage_settings', title: 'System Governance & AI Tuning', requiredClearance: 'Lead Commander (Admin)' },
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('cctv_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentView, setCurrentView] = useState<AppView>(() => {
    try {
      const stored = localStorage.getItem('cctv_auth_user');
      return stored ? 'dashboard' : 'landing';
    } catch {
      return 'landing';
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [, setPermVersion] = useState<number>(0);

  const checkHealth = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    const result = await fetchHealth();
    setHealth(result.data);
    setLatencyMs(result.latencyMs);
    setError(result.error);
    if (!isBackground) setIsLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
    // Poll health every 10 seconds silently
    const interval = setInterval(() => checkHealth(true), 10000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('cctv_auth_user');
    setCurrentUser(null);
    setCurrentView('landing');
  };

  // Render Landing Page
  if (currentView === 'landing') {
    return (
      <LandingPage
        health={health}
        latencyMs={latencyMs}
        isAuthenticated={!!currentUser}
        onEnterApp={() => setCurrentView('dashboard')}
        onGoToLogin={() => setCurrentView('login')}
      />
    );
  }

  // Render Login Page
  if (currentView === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={() => setCurrentView('landing')}
      />
    );
  }

  // Check RBAC clearance for active tab
  const tabRequirement = TAB_PERMISSIONS[activeTab];
  const isTabPermitted = !tabRequirement || hasPermission(currentUser, tabRequirement.key);

  // Render Surveillance Command Dashboard
  const renderDashboardContent = () => {
    if (!isTabPermitted && tabRequirement) {
      return (
        <div className="p-8 max-w-3xl mx-auto space-y-6">
          <div className="bg-command-surface border border-red-500/30 rounded-xl p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                CLEARANCE INSUFFICIENT
              </span>
              <h2 className="text-xl font-bold text-white">
                Access Restricted: {tabRequirement.title}
              </h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Your active role profile (<strong className="text-amber-400 capitalize">{currentUser?.role || 'Guest'}</strong>) is not authorized to access this module under current Access Control policies.
              </p>
            </div>

            <div className="p-4 bg-command-panel rounded-lg border border-command-border text-xs text-slate-300 font-mono text-left space-y-1.5 max-w-lg mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Operator:</span>
                <span className="text-white font-semibold">{currentUser?.name} ({currentUser?.badgeId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Required Clearance:</span>
                <span className="text-emerald-400 font-semibold">{tabRequirement.requiredClearance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security Policy:</span>
                <span className="text-blue-400">RBAC Clearance Gate v1.0</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-lg bg-command-panel hover:bg-command-border text-slate-200 text-xs font-semibold border border-command-border flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </button>
              <button
                onClick={() => setCurrentView('login')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Switch Security Role</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview health={health} error={error} onNavigate={setActiveTab} />;
      case 'live_monitoring':
        return <LiveMonitoring onNavigateTab={setActiveTab} />;
      case 'video_analysis':
        return <VideoAnalysis />;
      case 'incident_center':
        return (
          <IncidentCenter 
            onNavigateTab={setActiveTab} 
            onRefreshBadge={() => checkHealth(true)} 
            currentUser={currentUser} 
          />
        );
      case 'weapon_validation':
        return <WeaponValidationDashboard onNavigateTab={setActiveTab} onRefreshBadge={checkHealth} />;
      case 'evidence_library':
        return <EvidenceLibrary onNavigateTab={setActiveTab} />;
      case 'camera_management':
        return <CameraManagement />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return (
          <SettingsPage 
            currentUser={currentUser} 
            onPermissionsUpdated={() => setPermVersion(v => v + 1)} 
          />
        );
      default:
        return <Overview health={health} error={error} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-command-bg text-slate-100 overflow-hidden font-sans">
      {/* Fixed Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        unreviewedCount={health?.unreviewed_incidents_count ?? 0}
        onViewLanding={() => setCurrentView('landing')}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <Header 
          health={health} 
          latencyMs={latencyMs} 
          isLoading={isLoading} 
          error={error} 
          currentUser={currentUser}
          onRefresh={checkHealth}
          onLogout={handleLogout}
          onViewLanding={() => setCurrentView('landing')}
        />
        <main className="flex-1 overflow-y-auto">
          {renderDashboardContent()}
        </main>
      </div>
    </div>
  );
};

export default App;

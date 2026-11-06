import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  HardDrive, 
  Sliders, 
  Clock, 
  Target,
  RefreshCw,
  Lock,
  UserCheck,
  Shield,
  KeyRound
} from 'lucide-react';
import { fetchSettings, updateSettings, resetSettings } from '../services/api';
import { 
  PERMISSION_DEFINITIONS, 
  getRolePermissions, 
  saveRolePermissions, 
  resetRolePermissions,
  hasPermission
} from '../services/permissions';
import type { SystemSettings, AuthUser, RolePermissions, PermissionKey, UserRole } from '../types';

interface SettingsPageProps {
  currentUser?: AuthUser | null;
  onPermissionsUpdated?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, onPermissionsUpdated }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ai_tuning' | 'access_control'>('ai_tuning');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [samplingRate, setSamplingRate] = useState<number>(5);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [weaponConfidenceThreshold, setWeaponConfidenceThreshold] = useState<number>(0.35);
  const [weaponFrames, setWeaponFrames] = useState<number>(2);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(10);

  // RBAC state
  const [permissions, setPermissions] = useState<RolePermissions>(getRolePermissions());
  const [rbacChanged, setRbacChanged] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canManageSettings = hasPermission(currentUser || null, 'manage_settings');
  const isAdmin = currentUser?.role === 'admin';

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchSettings();
      setSettings(data);
      setSamplingRate(data.sampling_rate_fps);
      setConfidenceThreshold(data.confidence_threshold);
      setWeaponConfidenceThreshold(data.weapon_confidence_threshold);
      setWeaponFrames(data.weapon_consecutive_frames);
      setCooldownSeconds(data.event_cooldown_seconds);
      setPermissions(getRolePermissions());
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load system settings' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await updateSettings({
        sampling_rate_fps: Number(samplingRate),
        confidence_threshold: Number(confidenceThreshold),
        weapon_confidence_threshold: Number(weaponConfidenceThreshold),
        weapon_consecutive_frames: Number(weaponFrames),
        event_cooldown_seconds: Number(cooldownSeconds),
      });
      setSettings(updated);
      setSamplingRate(updated.sampling_rate_fps);
      setConfidenceThreshold(updated.confidence_threshold);
      setWeaponConfidenceThreshold(updated.weapon_confidence_threshold);
      setWeaponFrames(updated.weapon_consecutive_frames);
      setCooldownSeconds(updated.event_cooldown_seconds);
      setFeedback({ type: 'success', message: 'Inference settings saved. Real-time changes active.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update system settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!window.confirm('Reset all AI inference and detection thresholds to factory defaults?')) {
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const reset = await resetSettings();
      setSettings(reset);
      setSamplingRate(reset.sampling_rate_fps);
      setConfidenceThreshold(reset.confidence_threshold);
      setWeaponConfidenceThreshold(reset.weapon_confidence_threshold);
      setWeaponFrames(reset.weapon_consecutive_frames);
      setCooldownSeconds(reset.event_cooldown_seconds);
      setFeedback({ type: 'success', message: 'System settings restored to factory defaults.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reset settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermission = (role: UserRole, key: PermissionKey) => {
    if (role === 'admin') return; // Admin always retains full clearance
    setPermissions((prev) => {
      const updatedRole = { ...prev[role], [key]: !prev[role][key] };
      return { ...prev, [role]: updatedRole };
    });
    setRbacChanged(true);
  };

  const handleSavePermissions = () => {
    saveRolePermissions(permissions);
    setRbacChanged(false);
    if (onPermissionsUpdated) onPermissionsUpdated();
    setFeedback({
      type: 'success',
      message: 'Access Control policies updated. Lower-level roles now reflect these clearance rules.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleResetPermissions = () => {
    if (!window.confirm('Reset role permissions to default security clearance policies?')) {
      return;
    }
    const defaults = resetRolePermissions();
    setPermissions(defaults);
    setRbacChanged(false);
    if (onPermissionsUpdated) onPermissionsUpdated();
    setFeedback({
      type: 'success',
      message: 'Default Role-Based Access Control policy restored.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // If user lacks permission to view settings
  if (!canManageSettings && !isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="bg-command-surface border border-red-500/30 rounded-lg p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Clearance Restricted</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Your logged-in role (<strong className="text-amber-400 capitalize">{currentUser?.role || 'Guest'}</strong>) does not have permission to modify system hyperparameters, frame rates, or access control matrices.
            </p>
          </div>
          <div className="p-4 bg-command-panel rounded border border-command-border text-xs text-slate-400 max-w-md mx-auto text-left font-mono">
            <span className="text-slate-300 font-semibold block mb-1">Security Directive:</span>
            To modify AI detection sensitivity, consecutive verification frames, or grant clearance controls, log in as a <strong>Lead Surveillance Commander (Admin)</strong>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Sliders className="w-7 h-7 text-blue-400" />
            System Governance & AI Settings
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Configure CPU inference sampling rates, detection thresholds, and manage role-based security clearances.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadSettings}
            disabled={isLoading || isSaving}
            className="p-2 rounded bg-command-panel hover:bg-command-border text-slate-300 border border-command-border transition-colors disabled:opacity-50"
            title="Reload settings"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : 'text-slate-300'}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-command-border space-x-6 text-sm">
        <button
          onClick={() => setActiveSubTab('ai_tuning')}
          className={`pb-3 font-semibold flex items-center space-x-2 transition-colors relative ${
            activeSubTab === 'ai_tuning'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Inference & Detection Tuning</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('access_control')}
            className={`pb-3 font-semibold flex items-center space-x-2 transition-colors relative ${
              activeSubTab === 'access_control'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span>Role-Based Access Control (RBAC)</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
              Admin Only
            </span>
          </button>
        )}
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border flex items-center space-x-3 text-xs animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sub-Tab 1: AI Tuning */}
      {activeSubTab === 'ai_tuning' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inference Performance */}
            <div className="bg-command-surface border border-command-border rounded-lg p-6 space-y-5">
              <div className="flex items-center space-x-2.5 text-white font-semibold text-sm border-b border-command-border pb-3">
                <Cpu className="w-5 h-5 text-blue-400" />
                <span>Inference & CPU Performance Tuning</span>
              </div>

              <div className="space-y-4 text-xs">
                {/* Sampling Rate FPS */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-slate-300 font-medium">Sampling Rate (FPS)</label>
                    <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {samplingRate} FPS
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={samplingRate}
                    onChange={(e) => setSamplingRate(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-2 bg-command-panel rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Controls how many frames per second are processed by YOLOv8n CPU. Lower values reduce CPU load; higher values increase real-time responsiveness.
                  </p>
                </div>

                {/* Person Confidence Threshold */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-slate-300 font-medium">Person Detection Confidence Threshold</label>
                    <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {Math.round(confidenceThreshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.10}
                    max={0.90}
                    step={0.05}
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-command-panel rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Minimum confidence score required for YOLOv8n to register a detected person.
                  </p>
                </div>

                {/* Weapon Confidence Threshold */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-orange-400" />
                      Weapon Detection Confidence Threshold
                    </label>
                    <span className="font-mono text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                      {Math.round(weaponConfidenceThreshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={0.90}
                    step={0.05}
                    value={weaponConfidenceThreshold}
                    onChange={(e) => setWeaponConfidenceThreshold(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer h-2 bg-command-panel rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Softmax threshold for knife and firearm classifications. Higher thresholds prevent false alarms from household objects.
                  </p>
                </div>
              </div>
            </div>

            {/* Threat Verification & Alert Cooldown */}
            <div className="bg-command-surface border border-command-border rounded-lg p-6 space-y-5">
              <div className="flex items-center space-x-2.5 text-white font-semibold text-sm border-b border-command-border pb-3">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Multi-Frame Verification & Alert Rules</span>
              </div>

              <div className="space-y-4 text-xs">
                {/* Consecutive Confirmation Frames */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      Weapon Multi-Frame Confirmation
                    </label>
                    <span className="font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {weaponFrames} {weaponFrames === 1 ? 'Frame' : 'Consecutive Frames'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={weaponFrames}
                    onChange={(e) => setWeaponFrames(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer h-2 bg-command-panel rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Requires consistent weapon detection across consecutive frames before raising a confirmed threat incident.
                  </p>
                </div>

                {/* Event Cooldown Window */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Alert Suppression Cooldown Window
                    </label>
                    <span className="font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {cooldownSeconds}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={60}
                    step={1}
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer h-2 bg-command-panel rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Suppresses duplicate incident creation during continuous ongoing activities on the same camera stream.
                  </p>
                </div>

                {/* Context Buffer info */}
                <div className="p-3 bg-command-panel rounded border border-command-border space-y-1">
                  <span className="font-medium text-slate-300 block">Forensics Video Buffer</span>
                  <p className="text-[11px] text-slate-400">
                    A 3.0s pre-incident ring buffer is maintained in RAM for every active camera. When an incident triggers, the prior 3s and subsequent 3s are automatically extracted into the evidence clip.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Subsystem Metadata */}
          <div className="bg-command-surface border border-command-border rounded-lg p-6 space-y-4">
            <div className="flex items-center space-x-2 text-white font-semibold text-sm border-b border-command-border pb-3">
              <HardDrive className="w-5 h-5 text-emerald-400" />
              <span>Active System Subsystems & Model Weights</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-command-panel rounded border border-command-border">
                <span className="text-slate-400 block text-[11px] mb-1">Compute Device</span>
                <span className="text-emerald-400 font-bold">{settings?.inference_device || 'CPU (Windows 11)'}</span>
              </div>
              <div className="p-3 bg-command-panel rounded border border-command-border">
                <span className="text-slate-400 block text-[11px] mb-1">Object Detector</span>
                <span className="text-blue-400 font-bold">{settings?.model_name || 'yolov8n.pt (COCO)'}</span>
              </div>
              <div className="p-3 bg-command-panel rounded border border-command-border">
                <span className="text-slate-400 block text-[11px] mb-1">Weapon Threat Model</span>
                <span className="text-orange-400 font-bold">{settings?.weapon_model_name || 'yolov8n_weapon.pt'}</span>
              </div>
              <div className="p-3 bg-command-panel rounded border border-command-border">
                <span className="text-slate-400 block text-[11px] mb-1">Database Engine</span>
                <span className="text-purple-400 font-bold">{settings?.database_engine || 'SQLite 3 (WAL)'}</span>
              </div>
            </div>
          </div>

          {/* Save Controls */}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleResetSettings}
              disabled={isLoading || isSaving}
              className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Factory Defaults</span>
            </button>

            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Sub-Tab 2: Role-Based Access Control (RBAC) */}
      {activeSubTab === 'access_control' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-command-surface border border-command-border rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-command-border pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  Role Clearance & Access Control Policy Matrix
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  As Lead Surveillance Commander (Admin), define which operational privileges and data views are granted to lower-level roles (Forensic Analyst and Field Operator).
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleResetPermissions}
                  className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border flex items-center space-x-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default Policy</span>
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={!rbacChanged}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md ${
                    rbacChanged
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer animate-pulse'
                      : 'bg-command-panel text-slate-500 border border-command-border cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Apply Access Controls</span>
                </button>
              </div>
            </div>

            {/* Clearance Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-command-border bg-command-panel/60 font-mono text-slate-300">
                    <th className="p-3 w-2/5">Capability & Privilege</th>
                    <th className="p-3 w-1/5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-blue-400">ADMIN</span>
                        <span className="text-[10px] text-slate-400 font-sans">Lead Commander</span>
                      </div>
                    </th>
                    <th className="p-3 w-1/5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-emerald-400">ANALYST</span>
                        <span className="text-[10px] text-slate-400 font-sans">Forensic Triage</span>
                      </div>
                    </th>
                    <th className="p-3 w-1/5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-purple-400">OPERATOR</span>
                        <span className="text-[10px] text-slate-400 font-sans">Field Patrol</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-command-border">
                  {PERMISSION_DEFINITIONS.map((def) => {
                    const analystAllowed = permissions.analyst[def.key];
                    const operatorAllowed = permissions.operator[def.key];

                    return (
                      <tr key={def.key} className="hover:bg-command-panel/30 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-200">{def.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{def.description}</div>
                          <div className="mt-1">
                            <span className="text-[9px] font-mono uppercase bg-command-panel px-1.5 py-0.5 rounded border border-command-border text-slate-400">
                              {def.category}
                            </span>
                          </div>
                        </td>

                        {/* Admin Column: Always Full Clearance */}
                        <td className="p-3 text-center align-middle">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>FULL ACCESS</span>
                          </span>
                        </td>

                        {/* Analyst Column: Interactive Toggle */}
                        <td className="p-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleTogglePermission('analyst', def.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-all cursor-pointer ${
                              analystAllowed
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                            }`}
                          >
                            {analystAllowed ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Allowed</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-red-400" />
                                <span>Restricted</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Operator Column: Interactive Toggle */}
                        <td className="p-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleTogglePermission('operator', def.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-all cursor-pointer ${
                              operatorAllowed
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                                : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                            }`}
                          >
                            {operatorAllowed ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                                <span>Allowed</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-red-400" />
                                <span>Restricted</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-command-panel/70 rounded-lg border border-command-border flex items-start space-x-3 text-xs text-slate-300">
              <UserCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block mb-0.5">Role Governance Rule:</span>
                Changes applied to the Clearance Matrix immediately affect session views for users logged in as Analyst or Operator. Restricted pages in the sidebar are disabled and protected by clearance gates.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

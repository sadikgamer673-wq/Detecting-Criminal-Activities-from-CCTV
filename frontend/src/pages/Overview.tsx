import React from 'react';
import { 
  Cctv, 
  FileVideo, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  HardDrive, 
  FolderCheck, 
  FolderX,
  Server,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { HealthResponse, NavTab } from '../types';

interface OverviewProps {
  health: HealthResponse | null;
  error: string | null;
  onNavigate: (tab: NavTab) => void;
}

export const Overview: React.FC<OverviewProps> = ({ health, error, onNavigate }) => {
  if (error && !health) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-2xl">
          <div className="flex items-center space-x-3 text-red-400 mb-3">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-lg font-semibold">Backend Disconnected</h2>
          </div>
          <p className="text-sm text-slate-300 mb-4">
            Could not reach the FastAPI backend at <code className="text-red-300 bg-red-950/40 px-1.5 py-0.5 rounded">http://localhost:8000</code>.
          </p>
          <div className="text-xs font-mono text-slate-400 bg-command-bg p-3 rounded border border-command-border">
            Error: {error}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Verify that the backend server is running via PowerShell:
            <br />
            <code className="text-blue-400">backend\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000</code>
          </p>
        </div>
      </div>
    );
  }

  const activeCameras = health?.active_cameras_count ?? 0;
  const activeJobs = health?.active_jobs_count ?? 0;
  const unreviewedIncidents = health?.unreviewed_incidents_count ?? 0;
  const memoryPercent = health?.system.memory_percent ?? 0;
  const cpuPercent = health?.system.cpu_percent ?? 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Title & Mission Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Detecting Criminal Activities from CCTV
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of CCTV streams, batch video analysis, and detected security incidents.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono bg-command-panel px-3 py-1.5 rounded border border-command-border text-slate-300">
          <Server className="w-4 h-4 text-blue-400" />
          <span>Uptime: {health ? `${Math.floor(health.uptime_seconds)}s` : '0s'}</span>
        </div>
      </div>

      {/* Primary Telemetry Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Cameras */}
        <div 
          onClick={() => onNavigate('camera_management')}
          className="bg-command-surface border border-command-border p-5 rounded-lg hover:border-blue-500/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Cameras</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded group-hover:bg-blue-500/20">
              <Cctv className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-mono">{activeCameras}</span>
            <span className="text-xs text-slate-400 flex items-center group-hover:text-blue-400">
              Manage <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {activeCameras === 0 ? 'No RTSP cameras configured' : `${activeCameras} streams connected`}
          </p>
        </div>

        {/* Active Analysis Jobs */}
        <div 
          onClick={() => onNavigate('video_analysis')}
          className="bg-command-surface border border-command-border p-5 rounded-lg hover:border-blue-500/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Video Jobs</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded group-hover:bg-purple-500/20">
              <FileVideo className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-mono">{activeJobs}</span>
            <span className="text-xs text-slate-400 flex items-center group-hover:text-purple-400">
              Upload <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {activeJobs === 0 ? 'Queue is currently idle' : `${activeJobs} jobs processing`}
          </p>
        </div>

        {/* Potential Incidents */}
        <div 
          onClick={() => onNavigate('incident_center')}
          className="bg-command-surface border border-command-border p-5 rounded-lg hover:border-amber-500/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Awaiting Review</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded group-hover:bg-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-amber-400 font-mono">{unreviewedIncidents}</span>
            <span className="text-xs text-slate-400 flex items-center group-hover:text-amber-400">
              Review <ArrowRight className="w-3 h-3 ml-1" />
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {unreviewedIncidents === 0 ? 'No unresolved alerts' : 'Requires security triage'}
          </p>
        </div>

        {/* Database Health */}
        <div className="bg-command-surface border border-command-border p-5 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Database Engine</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-lg font-bold text-white font-mono">SQLite (WAL)</span>
            <span className="text-xs text-emerald-400 font-medium">Connected</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            ACID persistent storage
          </p>
        </div>
      </div>

      {/* System Resources & Hardware Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU & Memory Panel */}
        <div className="lg:col-span-2 bg-command-surface border border-command-border rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-command-border pb-4">
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
                Host Performance & Compute Telemetry
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">Windows 11 CPU Mode</span>
          </div>

          <div className="space-y-4">
            {/* CPU Metric */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300">
                  CPU Usage ({health?.system.cpu_cores_physical} Cores / {health?.system.cpu_cores_logical} Threads)
                </span>
                <span className="text-blue-400 font-semibold">{cpuPercent}%</span>
              </div>
              <div className="w-full bg-command-bg rounded-full h-2.5 overflow-hidden border border-command-border">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* RAM Metric */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300">
                  System Memory ({health?.system.memory_used_mb} MB / {health?.system.memory_total_mb} MB)
                </span>
                <span className="text-purple-400 font-semibold">{memoryPercent}%</span>
              </div>
              <div className="w-full bg-command-bg rounded-full h-2.5 overflow-hidden border border-command-border">
                <div 
                  className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Storage Metric */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300">Disk Free Space (C:\ Volume)</span>
                <span className="text-emerald-400 font-semibold">{health?.system.disk_free_gb} GB Free</span>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Health & Paths */}
        <div className="bg-command-surface border border-command-border rounded-lg p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-command-border pb-4">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Storage Subsystems
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            {/* Uploads Dir */}
            <div className="p-3 bg-command-panel rounded border border-command-border">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Video Uploads</span>
                {health?.storage.uploads_writable ? (
                  <span className="flex items-center text-emerald-400 text-[11px]">
                    <FolderCheck className="w-3.5 h-3.5 mr-1" /> Writable
                  </span>
                ) : (
                  <span className="flex items-center text-red-400 text-[11px]">
                    <FolderX className="w-3.5 h-3.5 mr-1" /> Read-Only
                  </span>
                )}
              </div>
              <p className="font-mono text-[10px] text-slate-400 truncate" title={health?.storage.uploads_dir}>
                {health?.storage.uploads_dir}
              </p>
            </div>

            {/* Incidents Dir */}
            <div className="p-3 bg-command-panel rounded border border-command-border">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Incident Evidence</span>
                {health?.storage.incidents_writable ? (
                  <span className="flex items-center text-emerald-400 text-[11px]">
                    <FolderCheck className="w-3.5 h-3.5 mr-1" /> Writable
                  </span>
                ) : (
                  <span className="flex items-center text-red-400 text-[11px]">
                    <FolderX className="w-3.5 h-3.5 mr-1" /> Read-Only
                  </span>
                )}
              </div>
              <p className="font-mono text-[10px] text-slate-400 truncate" title={health?.storage.incidents_dir}>
                {health?.storage.incidents_dir}
              </p>
            </div>

            {/* Models Dir */}
            <div className="p-3 bg-command-panel rounded border border-command-border">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Model Weights</span>
                {health?.storage.models_writable ? (
                  <span className="flex items-center text-emerald-400 text-[11px]">
                    <FolderCheck className="w-3.5 h-3.5 mr-1" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center text-red-400 text-[11px]">
                    <FolderX className="w-3.5 h-3.5 mr-1" /> Error
                  </span>
                )}
              </div>
              <p className="font-mono text-[10px] text-slate-400 truncate" title={health?.storage.models_dir}>
                {health?.storage.models_dir}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Feed & Genuine Empty State */}
      <div className="bg-command-surface border border-command-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-white tracking-wide uppercase mb-4">
          Live Operational Activity Feed
        </h2>
        {unreviewedIncidents === 0 && activeJobs === 0 && activeCameras === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-command-panel border border-command-border flex items-center justify-center text-slate-400 mb-3">
              <CheckCircle2 className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">System Ready & Standing By</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              No cameras are currently connected and no video jobs are queued. You can add RTSP camera feeds in Camera Management or upload video footage in Video Analysis.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => onNavigate('camera_management')}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                Configure RTSP Stream
              </button>
              <button
                onClick={() => onNavigate('video_analysis')}
                className="px-3.5 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-200 text-xs font-medium transition-colors border border-command-border"
              >
                Upload Video File
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">
            Active telemetry is connected.
          </div>
        )}
      </div>
    </div>
  );
};

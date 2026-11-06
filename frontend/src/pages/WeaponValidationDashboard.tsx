import React, { useState, useEffect, useCallback } from 'react';
import { 
  Crosshair, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Film, 
  RefreshCw, 
  Play, 
  Filter, 
  Search, 
  X, 
  FileVideo, 
  Cctv, 
  Check, 
  ThumbsDown, 
  AlertOctagon, 
  Eye, 
  AlertTriangle, 
  Activity, 
  Cpu, 
  FileCheck, 
  FileWarning, 
  Info 
} from 'lucide-react';
import { 
  fetchWeaponValidationStats, 
  fetchWeaponValidationIncidents, 
  updateIncidentReview,
  getEvidenceStreamUrl
} from '../services/api';
import type { 
  WeaponValidationStats, 
  WeaponValidationIncident, 
  NavTab 
} from '../types';

interface WeaponValidationDashboardProps {
  onNavigateTab?: (tab: NavTab) => void;
  onRefreshBadge?: () => void;
}

export const WeaponValidationDashboard: React.FC<WeaponValidationDashboardProps> = ({ 
  onNavigateTab: _onNavigateTab, 
  onRefreshBadge 
}) => {
  const [stats, setStats] = useState<WeaponValidationStats | null>(null);
  const [incidents, setIncidents] = useState<WeaponValidationIncident[]>([]);
  const [totalIncidents, setTotalIncidents] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [evidenceFilter, setEvidenceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Review Modal
  const [activeIncident, setActiveIncident] = useState<WeaponValidationIncident | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, incidentsData] = await Promise.all([
        fetchWeaponValidationStats(cameraFilter === 'all' ? undefined : cameraFilter),
        fetchWeaponValidationIncidents({
          review_status: statusFilter === 'all' ? undefined : statusFilter,
          weapon_class: classFilter === 'all' ? undefined : classFilter,
          camera_id: cameraFilter === 'all' ? undefined : cameraFilter,
          evidence_status: evidenceFilter === 'all' ? undefined : evidenceFilter,
          limit: 100,
        })
      ]);
      setStats(statsData);
      setIncidents(incidentsData.incidents);
      setTotalIncidents(incidentsData.total);
    } catch (err: any) {
      console.error('Failed to load weapon validation data:', err);
      setError(err.message || 'Failed to retrieve weapon validation data from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, classFilter, cameraFilter, evidenceFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenReviewModal = (incident: WeaponValidationIncident) => {
    setActiveIncident(incident);
    setReviewNote(incident.reviewer_notes || '');
    setVideoPlaybackError(false);
  };

  const handleCloseReviewModal = () => {
    setActiveIncident(null);
    setReviewNote('');
    setVideoPlaybackError(false);
  };

  const handleApplyReview = async (newStatus: string) => {
    if (!activeIncident) return;
    setIsSubmittingReview(true);
    try {
      await updateIncidentReview(activeIncident.id, newStatus, reviewNote);
      if (onRefreshBadge) onRefreshBadge();
      await loadData();
      handleCloseReviewModal();
    } catch (err: any) {
      alert(`Failed to update review status: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Filter incidents locally by search query
  const displayedIncidents = incidents.filter((inc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cat = inc.category.toLowerCase();
    const cls = inc.weapon_class.toLowerCase();
    const src = inc.source_name.toLowerCase();
    const notes = (inc.reviewer_notes || '').toLowerCase();
    return cat.includes(q) || cls.includes(q) || src.includes(q) || notes.includes(q);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'potential':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Pending Review
          </span>
        );
      case 'reviewed':
      case 'resolved':
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Reviewed (Confirmed)
          </span>
        );
      case 'false_positive':
      case 'dismissed':
        return (
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            False Positive
          </span>
        );
      case 'acknowledged':
        return (
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase inline-flex items-center gap-1">
            <Eye className="w-3 h-3 text-blue-400" />
            Acknowledged
          </span>
        );
      default:
        return (
          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[11px]">
            {status}
          </span>
        );
    }
  };

  const getEvidenceBadge = (ev: WeaponValidationIncident['evidence']) => {
    switch (ev.status) {
      case 'available':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono inline-flex items-center gap-1">
            <FileCheck className="w-3 h-3 text-emerald-400" />
            Clip Verified ({ev.duration_seconds.toFixed(1)}s)
          </span>
        );
      case 'missing':
        return (
          <span className="bg-red-500/15 text-red-400 border border-red-500/40 px-2 py-0.5 rounded text-[10px] font-mono inline-flex items-center gap-1 font-semibold">
            <FileWarning className="w-3 h-3 text-red-400" />
            Evidence Missing on Disk
          </span>
        );
      case 'playback_error':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono inline-flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-amber-400" />
            0-Byte / Corrupt File
          </span>
        );
      case 'not_generated':
      default:
        return (
          <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            No Evidence Linked
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider">
              Safety Verification & Triage
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3 mt-1">
            <Crosshair className="w-7 h-7 text-orange-400" />
            Weapon Detection Validation & Reliability Dashboard
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Audit AI weapon alerts against actual database records, verify video evidence integrity, triage false positives, and inspect model reliability metrics.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-orange-400' : 'text-orange-400'}`} />
            <span>Refresh Dashboard</span>
          </button>
        </div>
      </div>

      {/* Critical Scientific / Ethical Disclaimer Banner */}
      <div className="p-3.5 rounded-lg bg-orange-950/30 border border-orange-500/40 flex items-start gap-3 text-xs text-orange-200">
        <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <strong className="text-orange-300 font-semibold block">
            Operational Reliability & Confidence Clarification:
          </strong>
          <p className="text-[11px] text-orange-200/90 leading-relaxed">
            All statistics on this page are computed dynamically from actual database records. <strong>Detection confidence scores represent raw neural softmax certainty</strong>, not ground-truth detection accuracy. Accuracy percentages cannot be claimed without formal evaluation against a documented, labeled CCTV benchmark dataset. Detections flagged as false positives are preserved for model tuning and audit compliance.
          </p>
        </div>
      </div>

      {/* Detection Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Weapon Events */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Events</span>
          <span className="text-xl font-bold text-white font-mono mt-0.5 block">
            {stats?.total_weapon_events ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">From database</span>
        </div>

        {/* Awaiting Review */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-amber-400 block">Awaiting Review</span>
          <span className="text-xl font-bold text-amber-300 font-mono mt-0.5 block">
            {stats?.awaiting_review ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Pending triage</span>
        </div>

        {/* Reviewed */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-emerald-400 block">Reviewed (Confirmed)</span>
          <span className="text-xl font-bold text-emerald-300 font-mono mt-0.5 block">
            {stats?.reviewed_count ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Verified threats</span>
        </div>

        {/* False Positives */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-rose-400 block">False Positives</span>
          <span className="text-xl font-bold text-rose-300 font-mono mt-0.5 block">
            {stats?.false_positive_count ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Triage rejected</span>
        </div>

        {/* Gun Detections */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-orange-400 block">Gun / Firearm</span>
          <span className="text-xl font-bold text-orange-300 font-mono mt-0.5 block">
            {stats?.class_breakdown.gun ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Pistol / Rifle / Shotgun</span>
        </div>

        {/* Knife Detections */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-cyan-400 block">Knife / Bladed</span>
          <span className="text-xl font-bold text-cyan-300 font-mono mt-0.5 block">
            {stats?.class_breakdown.knife ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Edged weapons</span>
        </div>

        {/* Missing / Unavailable Evidence */}
        <div className="p-3.5 rounded-lg bg-command-surface border border-command-border">
          <span className="text-[10px] uppercase font-mono text-red-400 block">Evidence Issues</span>
          <span className="text-xl font-bold text-red-300 font-mono mt-0.5 block">
            {(stats?.evidence_verification.evidence_missing ?? 0) + (stats?.evidence_verification.evidence_playback_errors ?? 0)}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Missing or corrupt</span>
        </div>
      </div>

      {/* Detection Reliability & Evidence Verification Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Confidence Distribution */}
        <div className="bg-command-surface border border-command-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-command-border pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-orange-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Confidence Distribution
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Avg: <strong className="text-white">{stats ? Math.round(stats.confidence_statistics.average * 100) : 0}%</strong>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* 35% - 49% */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-mono">35% – 49% (Initial Threshold)</span>
                <span className="text-slate-200 font-mono font-semibold">{stats?.confidence_statistics.distribution.bucket_35_49 ?? 0}</span>
              </div>
              <div className="w-full bg-command-panel h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-slate-500 h-full rounded-full transition-all"
                  style={{ 
                    width: `${stats && stats.total_weapon_events > 0 ? (stats.confidence_statistics.distribution.bucket_35_49 / stats.total_weapon_events) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* 50% - 69% */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-mono">50% – 69% (Moderate Confidence)</span>
                <span className="text-slate-200 font-mono font-semibold">{stats?.confidence_statistics.distribution.bucket_50_69 ?? 0}</span>
              </div>
              <div className="w-full bg-command-panel h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ 
                    width: `${stats && stats.total_weapon_events > 0 ? (stats.confidence_statistics.distribution.bucket_50_69 / stats.total_weapon_events) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* 70% - 84% */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-mono">70% – 84% (High Confidence)</span>
                <span className="text-slate-200 font-mono font-semibold">{stats?.confidence_statistics.distribution.bucket_70_84 ?? 0}</span>
              </div>
              <div className="w-full bg-command-panel h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ 
                    width: `${stats && stats.total_weapon_events > 0 ? (stats.confidence_statistics.distribution.bucket_70_84 / stats.total_weapon_events) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* 85% - 100% */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-mono">85% – 100% (Very High Confidence)</span>
                <span className="text-slate-200 font-mono font-semibold">{stats?.confidence_statistics.distribution.bucket_85_100 ?? 0}</span>
              </div>
              <div className="w-full bg-command-panel h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-500 h-full rounded-full transition-all"
                  style={{ 
                    width: `${stats && stats.total_weapon_events > 0 ? (stats.confidence_statistics.distribution.bucket_85_100 / stats.total_weapon_events) * 100 : 0}%` 
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-command-border/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Min: <strong className="text-slate-200">{stats ? Math.round(stats.confidence_statistics.min * 100) : 0}%</strong></span>
            <span>Max: <strong className="text-slate-200">{stats ? Math.round(stats.confidence_statistics.max * 100) : 0}%</strong></span>
            <span>Threshold: <strong className="text-orange-400">35%</strong></span>
          </div>
        </div>

        {/* Card 2: Evidence Filesystem Verification */}
        <div className="bg-command-surface border border-command-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-command-border pb-3">
            <div className="flex items-center space-x-2">
              <Film className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Evidence Integrity Audit
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Audited: <strong className="text-white">{stats?.evidence_verification.total_incidents_audited ?? 0}</strong>
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2 rounded bg-command-panel flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">Evidence Verified on Disk</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                {stats?.evidence_verification.evidence_available ?? 0}
              </span>
            </div>

            <div className="p-2 rounded bg-command-panel flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileWarning className="w-4 h-4 text-red-400" />
                <span className="text-slate-300">Evidence Missing (File Deleted/Lost)</span>
              </div>
              <span className="font-mono font-bold text-red-400">
                {stats?.evidence_verification.evidence_missing ?? 0}
              </span>
            </div>

            <div className="p-2 rounded bg-command-panel flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">Evidence Not Yet Generated</span>
              </div>
              <span className="font-mono font-bold text-slate-400">
                {stats?.evidence_verification.evidence_not_generated ?? 0}
              </span>
            </div>

            <div className="p-2 rounded bg-command-panel flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">Corrupted / 0-Byte Clip</span>
              </div>
              <span className="font-mono font-bold text-amber-400">
                {stats?.evidence_verification.evidence_playback_errors ?? 0}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            Filesystem audit checks both video clip and keyframe thumbnail availability in real time. Missing files are never mocked.
          </p>
        </div>

        {/* Card 3: Model & Hardware Telemetry */}
        <div className="bg-command-surface border border-command-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-command-border pb-3">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Model & Hardware Telemetry
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded">
              Active
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-command-border/40">
              <span className="text-slate-400">Model Name:</span>
              <span className="text-slate-200 font-semibold">{stats?.model_telemetry.model_name || 'Threat-Detection-YOLOv8n'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-command-border/40">
              <span className="text-slate-400">Weights File:</span>
              <span className="text-slate-200">{stats?.model_telemetry.model_filename || 'yolov8n_weapon.pt'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-command-border/40">
              <span className="text-slate-400">Inference Device:</span>
              <span className="text-emerald-400 font-semibold">{stats?.model_telemetry.inference_mode || 'CPU (Windows 11)'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-command-border/40">
              <span className="text-slate-400">Average Latency:</span>
              <span className="text-white font-semibold">~{stats?.model_telemetry.average_latency_ms || 170} ms</span>
            </div>
            <div className="flex justify-between py-1 border-b border-command-border/40">
              <span className="text-slate-400">Processing Rate:</span>
              <span className="text-white font-semibold">{stats?.model_telemetry.stream_fps || 15.0} FPS</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Confirmation Gate:</span>
              <span className="text-orange-400 font-semibold">&gt;= {stats?.model_telemetry.consecutive_confirmation_frames || 2} frames</span>
            </div>
          </div>
        </div>
      </div>

      {/* Camera / Source Grouping Summary Table */}
      {stats && stats.by_camera.length > 0 && (
        <div className="bg-command-surface border border-command-border rounded-lg overflow-hidden space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cctv className="w-4 h-4 text-orange-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Detections Grouped by Camera Source
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {stats.by_camera.length} Active Video Sources
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-command-panel text-slate-400 uppercase text-[10px] tracking-wider border-y border-command-border">
                <tr>
                  <th className="py-2.5 px-3">Camera / Source</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Total Events</th>
                  <th className="py-2.5 px-3 text-right text-amber-400">Pending Review</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Reviewed</th>
                  <th className="py-2.5 px-3 text-right text-rose-400">False Positives</th>
                  <th className="py-2.5 px-3 text-right text-orange-400">Guns</th>
                  <th className="py-2.5 px-3 text-right text-cyan-400">Knives</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-command-border/40 text-slate-300">
                {stats.by_camera.map((cam) => (
                  <tr key={cam.source_id} className="hover:bg-command-panel/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                      {cam.source_type === 'camera' ? (
                        <Cctv className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <FileVideo className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>{cam.source_name}</span>
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[10px] text-slate-400">
                      {cam.source_type}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {cam.total_events}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-300">
                      {cam.awaiting_review}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">
                      {cam.reviewed}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-300">
                      {cam.false_positives}
                    </td>
                    <td className="py-2.5 px-3 text-right text-orange-300">
                      {cam.gun_count}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-300">
                      {cam.knife_count}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setCameraFilter(cam.source_id)}
                        className="px-2 py-1 rounded bg-command-panel hover:bg-slate-700 text-slate-200 text-[10px] transition-colors"
                      >
                        Filter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters Bar for Incident Audit Table */}
      <div className="bg-command-surface border border-command-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Review Statuses</option>
            <option value="potential">Pending Review</option>
            <option value="reviewed">Reviewed (Confirmed)</option>
            <option value="false_positive">False Positive</option>
            <option value="acknowledged">Acknowledged</option>
          </select>

          {/* Weapon Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Weapon Classes</option>
            <option value="gun">Gun / Firearms</option>
            <option value="knife">Knife / Bladed</option>
            <option value="explosive">Explosives</option>
          </select>

          {/* Evidence Status Filter */}
          <select
            value={evidenceFilter}
            onChange={(e) => setEvidenceFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Evidence States</option>
            <option value="available">Verified Clip Available</option>
            <option value="missing">Missing Clip on Disk</option>
            <option value="playback_error">Playback / Corrupt Error</option>
            <option value="not_generated">No Clip Generated</option>
          </select>

          {/* Camera Filter Reset */}
          {cameraFilter !== 'all' && (
            <button
              onClick={() => setCameraFilter('all')}
              className="px-2 py-1 bg-command-panel text-orange-400 rounded border border-orange-500/30 flex items-center gap-1 text-[11px]"
            >
              <span>Reset Camera Filter</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search category, camera, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-command-panel border border-command-border rounded pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 text-xs"
          />
        </div>
      </div>

      {/* Incidents Audit List */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-command-surface border border-command-border rounded-lg">
          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Querying weapon events from SQLite database...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-lg text-center space-y-3">
          <AlertOctagon className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-red-300">Database Query Failed</h3>
          <p className="text-xs text-red-200/80 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      ) : displayedIncidents.length === 0 ? (
        <div className="bg-command-surface border border-command-border rounded-lg p-16 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No Weapon Detection Events Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {incidents.length === 0
              ? 'No weapon detection incidents are recorded in the surveillance database.'
              : 'No weapon detection incidents match your current status, class, camera, or evidence filters.'}
          </p>
          {(statusFilter !== 'all' || classFilter !== 'all' || cameraFilter !== 'all' || evidenceFilter !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setClassFilter('all');
                setCameraFilter('all');
                setEvidenceFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-orange-400 hover:underline pt-1 block mx-auto font-medium"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 flex items-center justify-between px-1">
            <span>Showing <strong className="text-white">{displayedIncidents.length}</strong> of <strong className="text-white">{totalIncidents}</strong> weapon detection events</span>
            <span className="text-[11px] text-slate-500">Sorted by most recent detection</span>
          </div>

          <div className="space-y-3">
            {displayedIncidents.map((incident) => {
              return (
                <div
                  key={incident.id}
                  className="bg-command-surface border border-command-border rounded-lg p-4 space-y-3 shadow-sm hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Metadata */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-orange-600/20 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded text-xs font-bold font-mono">
                          {incident.weapon_class.toUpperCase()}
                        </span>
                        {getStatusBadge(incident.review_status)}
                        {getEvidenceBadge(incident.evidence)}

                        <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                          Confidence: <strong className="text-white">{Math.round(incident.confidence * 100)}%</strong>
                        </span>

                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {incident.timestamp_start.toFixed(1)}s – {incident.timestamp_end.toFixed(1)}s
                        </span>
                      </div>

                      {/* Source & Timestamp Info */}
                      <div className="flex items-center gap-3 text-xs text-slate-300 pt-0.5">
                        <span className="flex items-center gap-1 text-slate-400">
                          {incident.source_type === 'camera' ? (
                            <Cctv className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <FileVideo className="w-3.5 h-3.5 text-blue-400" />
                          )}
                          Source:
                        </span>
                        <strong className="text-white font-medium">
                          {incident.source_name}
                        </strong>
                        <span className="text-slate-500 font-mono text-[10px]">
                          ({incident.source_type === 'camera' ? 'Live Stream' : 'Video Upload'})
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          Logged: {new Date(incident.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Reviewer Notes if present */}
                      {incident.reviewer_notes && (
                        <div className="p-2 rounded bg-command-panel border border-command-border text-xs text-slate-300 space-y-0.5">
                          <span className="text-[10px] uppercase font-mono text-slate-400 block">
                            Audit Note ({incident.reviewed_by || 'Reviewer'} on {incident.reviewed_at ? new Date(incident.reviewed_at).toLocaleDateString() : ''}):
                          </span>
                          <p>{incident.reviewer_notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenReviewModal(incident)}
                        className="px-3.5 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-orange-500/20 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Inspect & Review</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review & Evidence Verification Modal */}
      {activeIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-command-surface border border-command-border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-command-panel border-b border-command-border flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Crosshair className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Incident Review: {activeIncident.weapon_class}</span>
                    <span className="text-[11px] font-mono text-orange-400">
                      ({Math.round(activeIncident.confidence * 100)}% Model Confidence)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Source: {activeIncident.source_name} | Event ID: {activeIncident.id.slice(0, 12)}...
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseReviewModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-command-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Video Player or Missing File Banner */}
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center relative">
                {activeIncident.evidence.id && activeIncident.evidence.clip_exists && !videoPlaybackError ? (
                  <video
                    key={activeIncident.evidence.id}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    className="w-full h-full object-contain"
                    onError={() => setVideoPlaybackError(true)}
                  >
                    <source src={getEvidenceStreamUrl(activeIncident.evidence.id)} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-center p-8 space-y-2 max-w-md">
                    <FileWarning className="w-12 h-12 text-red-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Video Evidence Unavailable on Disk</h4>
                    <p className="text-xs text-slate-400">
                      {activeIncident.evidence.id
                        ? 'The evidence record exists in the database, but the physical video clip file is missing or unreadable on disk.'
                        : 'No video evidence was generated or captured for this incident.'}
                    </p>
                    <div className="pt-2">
                      <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-mono px-2 py-1 rounded">
                        Integrity Flag: Evidence File Missing
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Incident Details Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-command-panel p-3 rounded-lg border border-command-border">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Category</span>
                  <span className="text-white font-semibold">{activeIncident.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Confidence</span>
                  <span className="text-orange-400 font-semibold">{Math.round(activeIncident.confidence * 100)}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Time Window</span>
                  <span className="text-slate-200">{activeIncident.timestamp_start.toFixed(1)}s – {activeIncident.timestamp_end.toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Current Status</span>
                  <span>{getStatusBadge(activeIncident.review_status)}</span>
                </div>
              </div>

              {/* Reviewer Note Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Reviewer Assessment Notes (Optional):</span>
                  <span className="text-[10px] text-slate-500 font-normal">Will be preserved in audit trail</span>
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g., Verified handgun visible in suspect's right hand at 00:03. Escalating to security..."
                  className="w-full bg-command-panel border border-command-border rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-3 rounded bg-blue-950/20 border border-blue-500/30 text-[11px] text-blue-200">
                Marking an event as <strong>False Positive</strong> updates its review status in the database while preserving the original detection record for algorithm auditability. Detections are never silently erased.
              </div>
            </div>

            {/* Modal Footer / Review Actions */}
            <div className="p-4 bg-command-panel border-t border-command-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={handleCloseReviewModal}
                disabled={isSubmittingReview}
                className="w-full sm:w-auto px-4 py-2 rounded bg-command-surface hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Mark as False Positive */}
                <button
                  onClick={() => handleApplyReview('false_positive')}
                  disabled={isSubmittingReview}
                  className="flex-1 sm:flex-none px-4 py-2 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Mark as False Positive</span>
                </button>

                {/* Mark as Reviewed (Confirmed) */}
                <button
                  onClick={() => handleApplyReview('reviewed')}
                  disabled={isSubmittingReview}
                  className="flex-1 sm:flex-none px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark as Reviewed (Confirmed)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

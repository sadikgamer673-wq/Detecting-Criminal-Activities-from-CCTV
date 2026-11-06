import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
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
  MessageSquare,
  AlertOctagon,
  Eye,
  Crosshair,
  RotateCcw,
  Lock
} from 'lucide-react';
import { 
  fetchIncidents, 
  fetchIncidentSummary, 
  updateIncidentReview, 
  getEvidenceStreamUrl, 
  getEvidenceThumbnailUrl 
} from '../services/api';
import type { IncidentItem, IncidentSummary, NavTab, AuthUser } from '../types';
import { hasPermission } from '../services/permissions';

interface IncidentCenterProps {
  onNavigateTab?: (tab: NavTab) => void;
  onRefreshBadge?: () => void;
  currentUser?: AuthUser | null;
}

export const IncidentCenter: React.FC<IncidentCenterProps> = ({ onNavigateTab, onRefreshBadge, currentUser }) => {
  const canReviewIncidents = hasPermission(currentUser || null, 'review_incidents');
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'potential', 'acknowledged', 'reviewed', 'dismissed'
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Active Video Modal for playing evidence clip
  const [activeEvidence, setActiveEvidence] = useState<{
    evidenceId: string;
    incident: IncidentItem;
  } | null>(null);

  // Note dialog
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const [incData, sumData] = await Promise.all([
        fetchIncidents({
          review_status: statusFilter === 'all' ? undefined : statusFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          source_type: sourceTypeFilter === 'all' ? undefined : sourceTypeFilter,
        }),
        fetchIncidentSummary()
      ]);
      setIncidents(incData);
      setSummary(sumData);
    } catch (err: any) {
      console.error('Failed to load incidents:', err);
      if (!silent) {
        setError(err.message || 'Failed to retrieve incidents from surveillance backend');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, sourceTypeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard escape listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeEvidence) {
        setActiveEvidence(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEvidence]);

  const handleUpdateStatus = async (incidentId: string, newStatus: string, notes?: string) => {
    if (!canReviewIncidents) {
      showToast('Access Denied: Operator role has View-Only clearance. Incident triage requires Analyst or Commander authorization.', 'error');
      return;
    }
    setActionBusy(prev => ({ ...prev, [incidentId]: true }));

    // Optimistically update incident in local state
    const prevIncidents = [...incidents];
    setIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return {
          ...inc,
          review_status: newStatus,
          reviewer_notes: notes !== undefined ? notes : inc.reviewer_notes
        };
      }
      return inc;
    }));

    try {
      await updateIncidentReview(incidentId, newStatus, notes);

      const statusLabels: Record<string, string> = {
        acknowledged: 'Incident marked as Acknowledged',
        reviewed: 'Incident confirmed as Reviewed',
        dismissed: 'Incident marked as Dismissed',
        potential: 'Incident re-opened for Review'
      };
      const label = notes !== undefined && !statusLabels[newStatus]
        ? 'Review note saved'
        : (statusLabels[newStatus] || `Incident updated to ${newStatus}`);
      showToast(label, 'success');

      // Silent background refresh to synchronize server counts
      await loadData(true);
      if (onRefreshBadge) {
        onRefreshBadge();
      }
    } catch (err: any) {
      setIncidents(prevIncidents);
      showToast(`Failed to update review status: ${err.message}`, 'error');
    } finally {
      setActionBusy(prev => ({ ...prev, [incidentId]: false }));
      setEditingNoteId(null);
      setNoteText('');
    }
  };

  // Filter incidents locally by search query
  const filteredIncidents = incidents.filter(inc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cat = inc.category.toLowerCase();
    const src = (inc.source_name || inc.source_id).toLowerCase();
    const notes = (inc.reviewer_notes || '').toLowerCase();
    return cat.includes(q) || src.includes(q) || notes.includes(q);
  });

  const getCategoryBadge = (category: string) => {
    const isAltercation = category.includes('altercation') || category.includes('fighting');
    const isFall = category.includes('fall');
    const isWeapon = category.includes('weapon');
    const isCrowd = category.includes('crowd');

    let color = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (isWeapon) color = 'bg-red-500/20 text-red-300 border-red-500/50';
    else if (isAltercation) color = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    else if (isFall) color = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    else if (isCrowd) color = 'bg-purple-500/20 text-purple-300 border-purple-500/40';

    const formatted = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${color}`}>
        {formatted}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'potential':
      case 'pending':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[11px] font-mono uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Pending Review
          </span>
        );
      case 'acknowledged':
        return (
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded text-[11px] font-mono uppercase flex items-center gap-1">
            <Eye className="w-3 h-3 text-blue-400" />
            Acknowledged
          </span>
        );
      case 'reviewed':
      case 'resolved':
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[11px] font-mono uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Confirmed
          </span>
        );
      case 'dismissed':
      case 'false_positive':
        return (
          <span className="bg-slate-700/60 text-slate-400 border border-slate-600 px-2 py-0.5 rounded text-[11px] font-mono uppercase flex items-center gap-1">
            <XCircle className="w-3 h-3 text-slate-400" />
            Dismissed
          </span>
        );
      default:
        return (
          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono uppercase">
            {status}
          </span>
        );
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== 'all' || sourceTypeFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Title & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-amber-400" />
            Incident Triage & Review Center
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Review potential security events, verify evidence clips, triage false positives, and audit classified anomalies.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('weapon_validation')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 text-xs font-medium border border-orange-500/40 transition-colors"
            >
              <Crosshair className="w-3.5 h-3.5 text-orange-400" />
              <span>Weapon Validation</span>
            </button>
          )}

          <button
            onClick={() => loadData(false)}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
            <span>Refresh Incidents</span>
          </button>
        </div>
      </div>

      {/* Operator View-Only Clearance Notice */}
      {!canReviewIncidents && currentUser?.role === 'operator' && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3.5 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <span className="font-semibold text-purple-300">Operator Clearance (View-Only Mode):</span>{' '}
              <span className="text-purple-200/90">You have read-only access to monitor active threat alerts. Incident acknowledgments, reviews, and dismissals require Analyst or Commander clearance.</span>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
            Read-Only
          </span>
        </div>
      )}

      {/* KPI Counters with 1-Click Status Filter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3 rounded-lg border text-left transition-all ${
            statusFilter === 'all'
              ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm shadow-blue-500/20'
              : 'bg-command-surface border-command-border text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] block uppercase font-mono">Total Logged</span>
          <span className="text-xl font-bold text-white font-mono mt-0.5 block">
            {summary?.total_incidents ?? 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('potential')}
          className={`p-3 rounded-lg border text-left transition-all ${
            statusFilter === 'potential'
              ? 'bg-amber-600/20 border-amber-500 text-white shadow-sm shadow-amber-500/20'
              : 'bg-command-surface border-command-border text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] block uppercase font-mono text-amber-400 flex items-center justify-between">
            <span>Pending Review</span>
            {(summary?.unreviewed_count ?? 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </span>
          <span className="text-xl font-bold text-amber-300 font-mono mt-0.5 block">
            {summary?.unreviewed_count ?? 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('acknowledged')}
          className={`p-3 rounded-lg border text-left transition-all ${
            statusFilter === 'acknowledged'
              ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm shadow-blue-500/20'
              : 'bg-command-surface border-command-border text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] block uppercase font-mono text-blue-400">Acknowledged</span>
          <span className="text-xl font-bold text-blue-300 font-mono mt-0.5 block">
            {summary?.acknowledged_count ?? 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('reviewed')}
          className={`p-3 rounded-lg border text-left transition-all ${
            statusFilter === 'reviewed'
              ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-sm shadow-emerald-500/20'
              : 'bg-command-surface border-command-border text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] block uppercase font-mono text-emerald-400">Confirmed</span>
          <span className="text-xl font-bold text-emerald-300 font-mono mt-0.5 block">
            {summary?.reviewed_count ?? 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('dismissed')}
          className={`p-3 rounded-lg border text-left transition-all ${
            statusFilter === 'dismissed'
              ? 'bg-slate-700/50 border-slate-500 text-white shadow-sm'
              : 'bg-command-surface border-command-border text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] block uppercase font-mono text-slate-400">Dismissed</span>
          <span className="text-xl font-bold text-slate-300 font-mono mt-0.5 block">
            {summary?.dismissed_count ?? 0}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-command-surface border border-command-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="weapon">All Weapons / Threat Items</option>
            <option value="potential_weapon_gun">Firearm / Gun Detection</option>
            <option value="potential_weapon_knife">Knife / Edged Weapon</option>
            <option value="possible_physical_altercation">Physical Altercation</option>
            <option value="possible_fall">Possible Fall</option>
            <option value="unusual_movement">Unusual Movement</option>
            <option value="crowd_disturbance">Crowd Disturbance</option>
            <option value="crowd_surge">Crowd Surge</option>
            <option value="loitering">Loitering</option>
          </select>

          {/* Source Type Filter */}
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="uploaded_video">Uploaded Videos</option>
            <option value="camera">Live CCTV Cameras</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search category, source file, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-command-panel border border-command-border rounded pl-8 pr-8 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Summary Pill Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Active Filters:</span>
          {statusFilter !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
              Status: {statusFilter}
              <button onClick={() => setStatusFilter('all')} className="hover:text-white ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {categoryFilter !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              Category: {categoryFilter}
              <button onClick={() => setCategoryFilter('all')} className="hover:text-white ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {sourceTypeFilter !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1">
              Source: {sourceTypeFilter}
              <button onClick={() => setSourceTypeFilter('all')} className="hover:text-white ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          {searchQuery.trim() && (
            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 border border-slate-600 flex items-center gap-1">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-white ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('all');
              setSourceTypeFilter('all');
              setSearchQuery('');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 underline ml-2"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Main Incident Content Area */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-command-surface border border-command-border rounded-lg">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Retrieving incidents from surveillance database...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-lg text-center space-y-3">
          <AlertOctagon className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-red-300">Database Query Failed</h3>
          <p className="text-xs text-red-200/80 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => loadData(false)}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="bg-command-surface border border-command-border rounded-lg p-16 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No Incidents Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {incidents.length === 0 
              ? 'No security incidents have been detected by the surveillance pipeline yet.'
              : 'No incidents match your current status, category, or search filters.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setSourceTypeFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-blue-400 hover:underline pt-1 block mx-auto"
            >
              Reset All Filters
            </button>
          )}
          {incidents.length === 0 && onNavigateTab && (
            <div className="pt-2">
              <button
                onClick={() => onNavigateTab('video_analysis')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors"
              >
                <Film className="w-4 h-4" />
                <span>Go to Video Analysis</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => {
            const isBusy = !!actionBusy[incident.id];
            const evidence = (incident.evidence_items && incident.evidence_items.length > 0)
              ? incident.evidence_items[0]
              : (incident.evidence_clips && incident.evidence_clips.length > 0 ? incident.evidence_clips[0] : null);

            return (
              <div
                key={incident.id}
                className="bg-command-surface border border-command-border rounded-lg p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Metadata */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {getCategoryBadge(incident.category)}
                      {getStatusBadge(incident.review_status)}

                      {/* Score Badge */}
                      <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                        Score: <strong className="text-white">{Math.round(incident.confidence * 100)}%</strong>
                      </span>

                      {/* Timestamp range */}
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {incident.timestamp_start.toFixed(1)}s – {incident.timestamp_end.toFixed(1)}s
                      </span>
                    </div>

                    {/* Source Information */}
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
                        {incident.source_name || incident.source_id}
                      </strong>
                      <span className="text-slate-500 font-mono text-[10px]">
                        ({incident.source_type === 'camera' ? 'Live Stream' : 'Video Upload'})
                      </span>
                    </div>

                    {/* Weapon Advisory Note */}
                    {incident.category.includes('weapon') && (
                      <div className="flex items-center gap-2 p-2 rounded bg-orange-950/40 border border-orange-500/30 text-[11px] text-orange-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Potential weapon alert requires human review. Model confidence must be visually confirmed before escalation.</span>
                      </div>
                    )}

                    {/* Reviewer Notes if present */}
                    {incident.reviewer_notes && (
                      <div className="p-2.5 rounded bg-command-panel border border-command-border text-xs text-slate-300 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-400 block">
                          Triage Notes ({incident.reviewed_by || 'Operator'}):
                        </span>
                        <p>{incident.reviewer_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Center: Evidence Clip Preview Thumbnail */}
                  {evidence && (
                    <div className="shrink-0 flex items-center gap-3 bg-command-panel p-2 rounded-lg border border-command-border">
                      <div 
                        onClick={() => setActiveEvidence({ evidenceId: evidence.id, incident })}
                        className="relative w-36 h-20 bg-black rounded overflow-hidden cursor-pointer group border border-slate-700"
                        title="Click to play evidence clip"
                      >
                        {evidence.has_thumbnail ? (
                          <img
                            src={getEvidenceThumbnailUrl(evidence.id)}
                            alt="Keyframe Thumbnail"
                            onError={(e) => {
                              // If image fails to load, replace with graceful fallback
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <Film className="w-6 h-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-1 right-1 bg-black/80 font-mono text-[9px] text-slate-300 px-1 rounded">
                          {evidence.duration_seconds.toFixed(1)}s
                        </span>
                      </div>

                      <div className="text-xs space-y-1 font-mono text-slate-400">
                        <span className="block text-slate-300 font-medium">Evidence Video</span>
                        <span className="block text-[11px]">
                          {(evidence.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <button
                          onClick={() => setActiveEvidence({ evidenceId: evidence.id, incident })}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 pt-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play Clip</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Right: Operator Triage Actions */}
                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-command-border">
                    {incident.review_status === 'potential' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'acknowledged')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Acknowledge</span>
                        </button>

                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'reviewed')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>

                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'dismissed')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-command-panel hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-command-border text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>Dismiss</span>
                        </button>
                      </>
                    )}

                    {incident.review_status === 'acknowledged' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'reviewed')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm Incident</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'dismissed')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-command-panel hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-command-border text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>Dismiss</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'potential')}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 rounded bg-command-panel hover:bg-command-border text-amber-300 hover:text-white border border-command-border text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                          title="Move back to Pending Review"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>Re-open</span>
                        </button>
                      </>
                    )}

                    {(incident.review_status === 'reviewed' || incident.review_status === 'resolved') && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'potential')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 hover:text-white border border-command-border text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                          <span>Re-open for Review</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'dismissed')}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 rounded bg-command-panel hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-command-border text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>Dismiss</span>
                        </button>
                      </>
                    )}

                    {(incident.review_status === 'dismissed' || incident.review_status === 'false_positive') && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'potential')}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 hover:text-white border border-command-border text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                          <span>Re-open for Review</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(incident.id, 'reviewed')}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          <span>Confirm</span>
                        </button>
                      </>
                    )}

                    {/* Add note toggle */}
                    <button
                      onClick={() => {
                        setEditingNoteId(editingNoteId === incident.id ? null : incident.id);
                        setNoteText(incident.reviewer_notes || '');
                      }}
                      className="px-2.5 py-1 rounded text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1.5 hover:bg-command-panel transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{incident.reviewer_notes ? 'Edit Note' : 'Add Note'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Note Editor */}
                {editingNoteId === incident.id && (
                  <div className="pt-3 border-t border-command-border space-y-2">
                    <label className="text-[11px] text-slate-300 font-medium block">
                      Triage Operator Notes:
                    </label>
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add investigation details, verified suspect notes, or justification..."
                      className="w-full bg-command-panel border border-command-border rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(incident.id, incident.review_status, noteText)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Video Evidence Playback Modal */}
      {activeEvidence && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveEvidence(null);
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-command-surface border border-command-border rounded-lg max-w-3xl w-full overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-command-border bg-command-panel">
              <div className="flex items-center space-x-3">
                <Film className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Evidence Video Clip</span>
                    {getCategoryBadge(activeEvidence.incident.category)}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Source: {activeEvidence.incident.source_name || activeEvidence.incident.source_id} (Timestamp: {activeEvidence.incident.timestamp_start}s – {activeEvidence.incident.timestamp_end}s)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveEvidence(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Window */}
            <div className="p-4 bg-black flex items-center justify-center min-h-[360px]">
              <video
                key={activeEvidence.evidenceId}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="max-h-[460px] w-auto rounded border border-command-border"
              >
                <source src={getEvidenceStreamUrl(activeEvidence.evidenceId)} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Modal Footer with Triage Controls */}
            <div className="p-4 bg-command-panel border-t border-command-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-400 font-mono text-[11px] flex items-center gap-2">
                <span>Current Status:</span>
                {getStatusBadge(activeEvidence.incident.review_status)}
              </div>

              <div className="flex items-center space-x-2">
                {activeEvidence.incident.review_status === 'potential' && (
                  <>
                    <button
                      onClick={() => {
                        handleUpdateStatus(activeEvidence.incident.id, 'acknowledged');
                        setActiveEvidence(null);
                      }}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateStatus(activeEvidence.incident.id, 'reviewed');
                        setActiveEvidence(null);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm</span>
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateStatus(activeEvidence.incident.id, 'dismissed');
                        setActiveEvidence(null);
                      }}
                      className="px-3 py-1.5 rounded bg-command-bg hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-command-border font-medium flex items-center gap-1"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </>
                )}

                {activeEvidence.incident.review_status !== 'potential' && (
                  <>
                    <button
                      onClick={() => {
                        handleUpdateStatus(activeEvidence.incident.id, 'potential');
                        setActiveEvidence(null);
                      }}
                      className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-200 border border-command-border font-medium flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                      <span>Re-open for Review</span>
                    </button>
                    {activeEvidence.incident.review_status !== 'reviewed' && (
                      <button
                        onClick={() => {
                          handleUpdateStatus(activeEvidence.incident.id, 'reviewed');
                          setActiveEvidence(null);
                        }}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm</span>
                      </button>
                    )}
                    {activeEvidence.incident.review_status !== 'dismissed' && (
                      <button
                        onClick={() => {
                          handleUpdateStatus(activeEvidence.incident.id, 'dismissed');
                          setActiveEvidence(null);
                        }}
                        className="px-3 py-1.5 rounded bg-command-bg hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-command-border font-medium flex items-center gap-1"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => setActiveEvidence(null)}
                  className="px-3 py-1.5 rounded bg-command-border text-slate-300 hover:text-white font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium transition-all duration-300 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-950/40'
            : toastMessage.type === 'error'
            ? 'bg-red-950/90 text-red-200 border-red-500/50 shadow-red-950/40'
            : 'bg-blue-950/90 text-blue-200 border-blue-500/50 shadow-blue-950/40'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />}
          {toastMessage.type === 'info' && <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

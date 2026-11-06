import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Filter, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  FileVideo, 
  Cctv, 
  Eye, 
  Calendar,
  ExternalLink
} from 'lucide-react';
import { fetchIncidents, fetchIncidentSummary } from '../services/api';
import type { IncidentItem, IncidentSummary, NavTab } from '../types';

interface ReportsProps {
  onNavigateTab?: (tab: NavTab) => void;
}

export const Reports: React.FC<ReportsProps> = ({ onNavigateTab }) => {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeRange, setTimeRange] = useState<string>('all'); // 'all', '24h', '7d', '30d'
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [incData, sumData] = await Promise.all([
        fetchIncidents({ limit: 200 }),
        fetchIncidentSummary()
      ]);
      setIncidents(incData);
      setSummary(sumData);
    } catch (err: any) {
      console.error('Failed to load report data:', err);
      setError(err.message || 'Failed to retrieve incident logs for reporting');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter incidents based on time range, status, category, search
  const filteredIncidents = useMemo(() => {
    const now = Date.now();
    return incidents.filter(inc => {
      // 1. Time range filter
      if (timeRange !== 'all') {
        const incDate = new Date(inc.created_at).getTime();
        const diffHours = (now - incDate) / (1000 * 60 * 60);
        if (timeRange === '24h' && diffHours > 24) return false;
        if (timeRange === '7d' && diffHours > 24 * 7) return false;
        if (timeRange === '30d' && diffHours > 24 * 30) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'reviewed' && !['reviewed', 'resolved'].includes(inc.review_status)) return false;
        if (statusFilter === 'dismissed' && !['dismissed', 'false_positive'].includes(inc.review_status)) return false;
        if (statusFilter === 'potential' && inc.review_status !== 'potential') return false;
        if (statusFilter === 'acknowledged' && inc.review_status !== 'acknowledged') return false;
      }

      // 3. Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'weapon' && !inc.category.startsWith('potential_weapon')) return false;
        if (categoryFilter !== 'weapon' && inc.category !== categoryFilter) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = inc.category.toLowerCase();
        const src = (inc.source_name || inc.source_id).toLowerCase();
        const notes = (inc.reviewer_notes || '').toLowerCase();
        const id = inc.id.toLowerCase();
        if (!cat.includes(q) && !src.includes(q) && !notes.includes(q) && !id.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, timeRange, statusFilter, categoryFilter, searchQuery]);

  // Computed Report Metrics
  const totalInFilter = filteredIncidents.length;
  const confirmedCount = filteredIncidents.filter(i => ['reviewed', 'resolved'].includes(i.review_status)).length;
  const pendingCount = filteredIncidents.filter(i => i.review_status === 'potential').length;
  const acknowledgedCount = filteredIncidents.filter(i => i.review_status === 'acknowledged').length;
  const dismissedCount = filteredIncidents.filter(i => ['dismissed', 'false_positive'].includes(i.review_status)).length;
  const avgConfidence = totalInFilter > 0 
    ? Math.round((filteredIncidents.reduce((acc, c) => acc + c.confidence, 0) / totalInFilter) * 100) 
    : 0;

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredIncidents.length === 0) return;

    const headers = [
      'Incident ID',
      'Created At (UTC)',
      'Category',
      'Confidence Score (%)',
      'Review Status',
      'Source Type',
      'Source Name',
      'Timestamp Start (s)',
      'Timestamp End (s)',
      'Duration (s)',
      'Has Evidence Clip',
      'Reviewer Notes',
      'Reviewed By'
    ];

    const rows = filteredIncidents.map(inc => [
      `"${inc.id}"`,
      `"${inc.created_at}"`,
      `"${inc.category.replaceAll('_', ' ').toUpperCase()}"`,
      Math.round(inc.confidence * 100),
      `"${inc.review_status.toUpperCase()}"`,
      `"${inc.source_type}"`,
      `"${(inc.source_name || inc.source_id).replace(/"/g, '""')}"`,
      inc.timestamp_start.toFixed(1),
      inc.timestamp_end.toFixed(1),
      (inc.timestamp_end - inc.timestamp_start).toFixed(1),
      (inc.evidence_items && inc.evidence_items.length > 0) ? 'YES' : 'NO',
      `"${(inc.reviewer_notes || '').replace(/"/g, '""')}"`,
      `"${inc.reviewed_by || 'Unassigned'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cctv_security_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export JSON Handler
  const handleExportJSON = () => {
    if (filteredIncidents.length === 0) return;

    const reportData = {
      report_generated_at: new Date().toISOString(),
      system_name: 'Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms',
      audit_scope: {
        time_range: timeRange,
        status_filter: statusFilter,
        category_filter: categoryFilter,
        total_events_in_scope: totalInFilter
      },
      audit_metrics: {
        total_incidents: totalInFilter,
        confirmed_incidents: confirmedCount,
        pending_review: pendingCount,
        acknowledged: acknowledgedCount,
        false_positives_dismissed: dismissedCount,
        average_model_confidence_percent: avgConfidence
      },
      incidents: filteredIncidents.map(inc => ({
        id: inc.id,
        created_at: inc.created_at,
        category: inc.category,
        confidence: inc.confidence,
        review_status: inc.review_status,
        source_type: inc.source_type,
        source_id: inc.source_id,
        source_name: inc.source_name || inc.source_id,
        timestamp_start_sec: inc.timestamp_start,
        timestamp_end_sec: inc.timestamp_end,
        has_evidence: !!(inc.evidence_items && inc.evidence_items.length > 0),
        reviewer_notes: inc.reviewer_notes,
        reviewed_by: inc.reviewed_by
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cctv_security_audit_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCategoryBadge = (category: string) => {
    const isAltercation = category.includes('altercation');
    const isWeapon = category.includes('weapon');
    const isFall = category.includes('fall');

    let color = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (isWeapon) color = 'bg-red-500/20 text-red-300 border-red-500/50';
    else if (isAltercation) color = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    else if (isFall) color = 'bg-amber-500/20 text-amber-300 border-amber-500/40';

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${color}`}>
        {category.replace(/_/g, ' ')}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'potential':
        return (
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono uppercase inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Pending
          </span>
        );
      case 'acknowledged':
        return (
          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded text-[10px] font-mono uppercase inline-flex items-center gap-1">
            <Eye className="w-3 h-3 text-blue-400" />
            Acknowledged
          </span>
        );
      case 'reviewed':
      case 'resolved':
        return (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-mono uppercase inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Confirmed
          </span>
        );
      case 'dismissed':
      case 'false_positive':
        return (
          <span className="bg-slate-700/60 text-slate-400 border border-slate-600 px-2 py-0.5 rounded text-[10px] font-mono uppercase inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-slate-400" />
            Dismissed
          </span>
        );
      default:
        return (
          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-blue-400" />
            Incident Reports & Auditing
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Generate, filter, and export auditable security incident summaries, triage audit logs, and human-verified findings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredIncidents.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={filteredIncidents.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-command-surface border border-command-border p-4 rounded-lg">
          <span className="text-[11px] block uppercase font-mono text-slate-400">Total In Scope</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">
            {totalInFilter}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            {summary?.total_incidents ?? 0} all-time logged
          </span>
        </div>

        <div className="bg-command-surface border border-command-border p-4 rounded-lg">
          <span className="text-[11px] block uppercase font-mono text-emerald-400">Confirmed Threats</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
            {confirmedCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            Human verified
          </span>
        </div>

        <div className="bg-command-surface border border-command-border p-4 rounded-lg">
          <span className="text-[11px] block uppercase font-mono text-amber-400">Pending Triage</span>
          <span className="text-2xl font-bold text-amber-400 font-mono mt-1 block">
            {pendingCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            Awaiting inspection
          </span>
        </div>

        <div className="bg-command-surface border border-command-border p-4 rounded-lg">
          <span className="text-[11px] block uppercase font-mono text-slate-400">Dismissed / FP</span>
          <span className="text-2xl font-bold text-slate-300 font-mono mt-1 block">
            {dismissedCount}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            False alarms cleared
          </span>
        </div>

        <div className="bg-command-surface border border-command-border p-4 rounded-lg">
          <span className="text-[11px] block uppercase font-mono text-blue-400">Avg Model Score</span>
          <span className="text-2xl font-bold text-blue-400 font-mono mt-1 block">
            {avgConfidence}%
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block font-mono">
            Softmax certainty
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-command-surface border border-command-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />

          {/* Time Range */}
          <div className="flex items-center space-x-1 bg-command-panel border border-command-border rounded px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {/* Review Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="reviewed">Confirmed Incidents</option>
            <option value="potential">Pending Review</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="dismissed">Dismissed / False Positives</option>
          </select>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="weapon">All Weapons / Threats</option>
            <option value="potential_weapon_gun">Firearm / Gun</option>
            <option value="potential_weapon_knife">Knife / Blade</option>
            <option value="possible_physical_altercation">Physical Altercation</option>
            <option value="possible_fall">Possible Fall</option>
            <option value="unusual_movement">Unusual Movement</option>
            <option value="crowd_disturbance">Crowd Disturbance</option>
            <option value="loitering">Loitering</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search report logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-command-panel border border-command-border rounded pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
          />
        </div>
      </div>

      {/* Auditable Incident Table */}
      <div className="bg-command-surface border border-command-border rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 bg-command-panel border-b border-command-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
              Incident Audit Log Records ({filteredIncidents.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Export ready (CSV / JSON)
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300">Compiling report data from surveillance database...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-300">
            <p className="text-sm font-semibold">Error Loading Report</p>
            <p className="text-xs text-red-400 mt-1">{error}</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-medium text-white">No Incident Logs Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No surveillance incidents match your selected filters. Adjust date ranges or category criteria to display records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-command-panel/70 border-b border-command-border text-[11px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Event ID / Created</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Timing</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4">Audit Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-command-border/60">
                {filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-command-panel/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-white block font-medium">{inc.id.slice(0, 8)}...</span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(inc.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getCategoryBadge(inc.category)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-white truncate max-w-[160px]" title={inc.source_name || inc.source_id}>
                        {inc.source_type === 'camera' ? (
                          <Cctv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <FileVideo className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                        <span className="truncate">{inc.source_name || inc.source_id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {inc.timestamp_start.toFixed(1)}s – {inc.timestamp_end.toFixed(1)}s
                      <span className="block text-[10px] text-slate-500">
                        {(inc.timestamp_end - inc.timestamp_start).toFixed(1)}s span
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-white font-semibold">{Math.round(inc.confidence * 100)}%</span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(inc.review_status)}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      {inc.reviewer_notes ? (
                        <p className="truncate text-slate-300 text-[11px]" title={inc.reviewer_notes}>
                          {inc.reviewer_notes}
                        </p>
                      ) : (
                        <span className="text-slate-600 italic text-[10px]">No notes</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onNavigateTab && (
                        <button
                          onClick={() => onNavigateTab('incident_center')}
                          className="px-2 py-1 rounded bg-command-panel hover:bg-command-border text-slate-300 hover:text-white text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                          title="Open in Incident Center"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3 h-3 text-blue-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

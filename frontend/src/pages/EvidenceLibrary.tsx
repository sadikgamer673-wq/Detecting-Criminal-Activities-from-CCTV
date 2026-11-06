import React, { useState, useEffect, useCallback } from 'react';
import { 
  Film, 
  Play, 
  Download, 
  RefreshCw, 
  Filter, 
  Search, 
  X, 
  HardDrive, 
  FileVideo, 
  Cctv, 
  AlertOctagon, 
  ExternalLink
} from 'lucide-react';
import { 
  fetchEvidenceList, 
  getEvidenceStreamUrl, 
  getEvidenceThumbnailUrl 
} from '../services/api';
import type { EvidenceListItem, NavTab } from '../types';

interface EvidenceLibraryProps {
  onNavigateTab?: (tab: NavTab) => void;
}

export const EvidenceLibrary: React.FC<EvidenceLibraryProps> = ({ onNavigateTab }) => {
  const [evidenceList, setEvidenceList] = useState<EvidenceListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Video Modal
  const [activeClip, setActiveClip] = useState<EvidenceListItem | null>(null);

  const loadEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchEvidenceList({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        source_type: sourceTypeFilter === 'all' ? undefined : sourceTypeFilter,
      });
      setEvidenceList(data);
    } catch (err: any) {
      console.error('Failed to load evidence library:', err);
      setError(err.message || 'Failed to load evidence records from backend');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, sourceTypeFilter]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence]);

  // Keyboard Escape listener to close video modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeClip) {
        setActiveClip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeClip]);

  // Compute storage metrics
  const totalBytes = evidenceList.reduce((acc, curr) => acc + curr.file_size_bytes, 0);
  const totalMegabytes = (totalBytes / (1024 * 1024)).toFixed(1);
  const verifiedCount = evidenceList.filter(e => e.clip_exists).length;

  // Local search filter
  const filteredClips = evidenceList.filter(clip => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cat = clip.incident_category.toLowerCase();
    const src = clip.source_name.toLowerCase();
    const incId = clip.incident_id.toLowerCase();
    return cat.includes(q) || src.includes(q) || incId.includes(q);
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
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${color}`}>
        {formatted}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Title & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Film className="w-7 h-7 text-blue-400" />
            Surveillance Evidence Video Library
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Archived video sub-clips and keyframe thumbnails persisted during detected incident triggers for audit, verification, and export.
          </p>
        </div>

        <button
          onClick={loadEvidence}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
          <span>Refresh Library</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-command-surface border border-command-border rounded-lg p-4 space-y-1">
          <span className="text-xs font-mono uppercase text-slate-400 block">Total Extracted Clips</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{evidenceList.length}</span>
            <span className="text-xs text-slate-500 font-mono">records in SQLite</span>
          </div>
        </div>

        <div className="bg-command-surface border border-command-border rounded-lg p-4 space-y-1">
          <span className="text-xs font-mono uppercase text-slate-400 block">Verified On Disk</span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{verifiedCount}</span>
            <span className="text-xs text-slate-500 font-mono">of {evidenceList.length} files playable</span>
          </div>
        </div>

        <div className="bg-command-surface border border-command-border rounded-lg p-4 space-y-1">
          <span className="text-xs font-mono uppercase text-slate-400 block flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            Storage Footprint
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-blue-400 font-mono">{totalMegabytes}</span>
            <span className="text-xs text-slate-500 font-mono">MB in storage/incidents</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-command-surface border border-command-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-command-panel border border-command-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Incident Categories</option>
            <option value="possible_physical_altercation">Physical Altercation</option>
            <option value="possible_fall">Possible Fall</option>
            <option value="unusual_movement">Unusual Movement</option>
            <option value="crowd_disturbance">Crowd Disturbance</option>
            <option value="crowd_surge">Crowd Surge</option>
            <option value="loitering">Loitering</option>
          </select>

          {/* Source Filter */}
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
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search category, source file, clip ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-command-panel border border-command-border rounded pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
          />
        </div>
      </div>

      {/* Main Grid Content */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-command-surface border border-command-border rounded-lg">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Loading stored evidence clips...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-lg text-center space-y-3">
          <AlertOctagon className="w-10 h-10 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-red-300">Failed to Retrieve Evidence</h3>
          <p className="text-xs text-red-200/80 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadEvidence}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="bg-command-surface border border-command-border rounded-lg p-16 text-center space-y-3">
          <Film className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No Evidence Clips Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {evidenceList.length === 0
              ? 'Evidence clips will appear here when suspicious activities or incidents are flagged during video processing or live monitoring.'
              : 'No evidence clips match your selected filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClips.map((clip) => {
            const sizeMb = (clip.file_size_bytes / (1024 * 1024)).toFixed(1);
            return (
              <div
                key={clip.id}
                className="bg-command-surface border border-command-border rounded-lg overflow-hidden flex flex-col shadow-md hover:border-slate-700 transition-colors group"
              >
                {/* Thumbnail Header with Play Overlay */}
                <div
                  onClick={() => setActiveClip(clip)}
                  className="relative aspect-video bg-black cursor-pointer overflow-hidden"
                  title="Click to play evidence clip"
                >
                  {clip.has_thumbnail ? (
                    <img
                      src={getEvidenceThumbnailUrl(clip.id)}
                      alt={clip.incident_category}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Film className="w-10 h-10" />
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Badges on Thumbnail */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="bg-black/80 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                      {clip.duration_seconds.toFixed(1)}s
                    </span>
                    <span className="bg-black/80 text-slate-300 px-2 py-0.5 rounded backdrop-blur-sm">
                      {sizeMb} MB
                    </span>
                  </div>

                  <div className="absolute top-2 right-2">
                    {clip.clip_exists ? (
                      <span className="bg-emerald-500/90 text-white text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shadow">
                        Stored
                      </span>
                    ) : (
                      <span className="bg-red-500/90 text-white text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shadow">
                        Missing File
                      </span>
                    )}
                  </div>
                </div>

                {/* Clip Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      {getCategoryBadge(clip.incident_category)}
                      <span className="text-[11px] font-mono text-slate-400">
                        {clip.timestamp_start.toFixed(1)}s – {clip.timestamp_end.toFixed(1)}s
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300 truncate" title={clip.source_name}>
                        {clip.source_type === 'camera' ? (
                          <Cctv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <FileVideo className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                        <span className="truncate font-medium">{clip.source_name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block truncate">
                        Incident: {clip.incident_id}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-command-border flex items-center justify-between text-xs">
                    <button
                      onClick={() => setActiveClip(clip)}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play Clip</span>
                    </button>

                    {onNavigateTab && (
                      <button
                        onClick={() => onNavigateTab('incident_center')}
                        className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
                        title="View details in Incident Center"
                      >
                        <span>View Incident</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Modal Player */}
      {activeClip && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveClip(null);
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-command-surface border border-command-border rounded-lg max-w-3xl w-full overflow-hidden shadow-2xl space-y-0">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-command-border bg-command-panel">
              <div className="flex items-center space-x-3">
                <Film className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Evidence Clip: {activeClip.source_name}</span>
                    {getCategoryBadge(activeClip.incident_category)}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Trigger Window: {activeClip.timestamp_start}s – {activeClip.timestamp_end}s ({activeClip.duration_seconds.toFixed(1)}s total duration)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveClip(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="p-4 bg-black flex items-center justify-center min-h-[380px]">
              <video
                key={activeClip.id}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="max-h-[480px] w-auto rounded border border-command-border"
              >
                <source src={getEvidenceStreamUrl(activeClip.id)} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Footer */}
            <div className="p-3 bg-command-panel border-t border-command-border flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-3 font-mono text-[11px]">
                <span>Status: <strong className="text-white uppercase">{activeClip.review_status}</strong></span>
                <span>Size: <strong className="text-white">{(activeClip.file_size_bytes / (1024 * 1024)).toFixed(2)} MB</strong></span>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={getEvidenceStreamUrl(activeClip.id)}
                  download={`evidence_${activeClip.id}.mp4`}
                  className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-200 border border-command-border font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>

                <button
                  onClick={() => setActiveClip(null)}
                  className="px-3 py-1.5 rounded bg-command-border text-slate-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

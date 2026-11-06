import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  FileVideo, 
  Play, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  RefreshCw, 
  ShieldAlert,
  ShieldCheck,
  Film,
  Ban,
  Users,
  UserCheck,
  Eye,
  Layers,
  Activity
} from 'lucide-react';
import type { VideoJob, JobDetailResponse } from '../types';
import { 
  uploadVideo, 
  fetchJobs, 
  fetchJobDetail, 
  cancelJob,
  getVideoStreamUrl, 
  getEvidenceStreamUrl 
} from '../services/api';

export const VideoAnalysis: React.FC = () => {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetailResponse | null>(null);
  
  // Upload states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Video Player state
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [activeMediaTitle, setActiveMediaTitle] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load jobs list
  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
      if (data.length > 0 && !selectedJobId) {
        setSelectedJobId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load video jobs:', err);
    }
  }, [selectedJobId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Load selected job details
  const loadJobDetail = useCallback(async (jobId: string) => {
    try {
      const data = await fetchJobDetail(jobId);
      setJobDetail(data);

      // If active media not set, set original video
      if (data.job.status !== 'failed') {
        setActiveMediaUrl((prev) => prev || getVideoStreamUrl(data.job.id));
        setActiveMediaTitle((prev) => prev || `Original Video: ${data.job.filename}`);
      }
      return data;
    } catch (err: any) {
      console.error('Failed to load job detail:', err);
      return null;
    }
  }, []);

  // Poll active job whenever selectedJobId changes or status is incomplete
  useEffect(() => {
    if (!selectedJobId) return;

    let isMounted = true;
    let timeoutId: any = null;

    const poll = async () => {
      const data = await loadJobDetail(selectedJobId);
      if (!isMounted || !data) return;

      // If still processing or queued, poll again in 1.5s
      if (data.job.status === 'queued' || data.job.status === 'processing') {
        loadJobs();
        timeoutId = setTimeout(poll, 1500);
      } else {
        // Once completed or finished, refresh the job list
        loadJobs();
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedJobId, loadJobDetail, loadJobs]);

  // File Upload Handler
  const handleFileUpload = async (file: File) => {
    setUploadError(null);

    // Validation: format
    const validExtensions = ['.mp4', '.avi', '.mov', '.mkv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setUploadError(`Unsupported format. Please select an MP4, AVI, MOV, or MKV file.`);
      return;
    }

    // Validation: size <= 500MB
    const maxSizeBytes = 500 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError(`File is too large (${Math.round(file.size / (1024 * 1024))} MB). Max size is 500 MB.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadVideo(file, (progress) => {
        setUploadProgress(progress);
      });

      setIsUploading(false);
      await loadJobs();
      setSelectedJobId(result.job_id);
      setActiveMediaUrl(getVideoStreamUrl(result.job_id));
      setActiveMediaTitle(`Original Video: ${file.name}`);
      await loadJobDetail(result.job_id);
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err.message || 'Video upload failed');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleCancelCurrentJob = async () => {
    if (!selectedJobId) return;
    try {
      await cancelJob(selectedJobId);
      await loadJobDetail(selectedJobId);
      await loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  const playEvidenceClip = (evidenceId: string, category: string, timestampStart: number) => {
    const url = getEvidenceStreamUrl(evidenceId);
    setActiveMediaUrl(url);
    setActiveMediaTitle(`Evidence Clip: ${category.replace('_', ' ')} (at ${Math.floor(timestampStart)}s)`);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const playOriginalAtTimestamp = (sec: number) => {
    if (!selectedJobId) return;
    const url = getVideoStreamUrl(selectedJobId);
    setActiveMediaUrl(url);
    setActiveMediaTitle(`Original Video: ${jobDetail?.job.filename}`);
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const currentJob = jobDetail?.job;
  const incidents = jobDetail?.incidents || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Offline Video Analysis Pipeline
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Upload recorded surveillance footage for CPU-accelerated AI object detection and temporal event triage.
          </p>
        </div>
        <button
          onClick={() => {
            loadJobs();
            if (selectedJobId) loadJobDetail(selectedJobId);
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-command-border hover:border-blue-500/50 bg-command-surface/60'
        }`}
      >
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".mp4,.avi,.mov,.mkv" 
          className="hidden" 
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h3 className="text-sm font-semibold text-white">
          {isUploading ? 'Uploading Video to Storage...' : 'Click to Upload or Drag Video Here'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
          Supported formats: MP4, AVI, MOV, MKV (Maximum file size: 500 MB).
        </p>

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="mt-4 max-w-md mx-auto">
            <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
              <span>Transferring...</span>
              <span className="text-blue-400 font-semibold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-command-panel rounded-full h-2 overflow-hidden border border-command-border">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="mt-4 inline-flex items-center space-x-2 px-3 py-1.5 rounded bg-red-500/20 text-red-300 text-xs border border-red-500/40">
            <XCircle className="w-4 h-4 text-red-400" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Jobs History List */}
        <div className="bg-command-surface border border-command-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-command-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-blue-400" />
              <span>Video Analysis Jobs</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">{jobs.length} total</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {jobs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No videos processed yet. Upload a video file above to start analysis.
              </p>
            ) : (
              jobs.map((j) => {
                const isSelected = selectedJobId === j.id;
                const isCompleted = j.status === 'completed';
                const isProcessing = j.status === 'processing';
                const isFailed = j.status === 'failed';
                const isSuspicious = isCompleted && ((j.events_classified !== undefined && j.events_classified > 0) || j.activity_verdict === 'suspicious');
                const isNormal = isCompleted && !isSuspicious;

                return (
                  <div
                    key={j.id}
                    onClick={() => {
                      setSelectedJobId(j.id);
                      setActiveMediaUrl(getVideoStreamUrl(j.id));
                      setActiveMediaTitle(`Original Video: ${j.filename}`);
                    }}
                    className={`p-3 rounded border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/50'
                        : 'bg-command-panel/60 hover:bg-command-panel border-command-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white truncate max-w-[150px]" title={j.filename}>
                        {j.filename}
                      </span>
                      {isProcessing ? (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
                          ANALYZING
                        </span>
                      ) : isNormal ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                          ✓ NORMAL
                        </span>
                      ) : isSuspicious ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          ⚠ SUSPICIOUS
                        </span>
                      ) : isFailed ? (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          FAILED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {j.status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{j.duration_seconds ? `${Math.round(j.duration_seconds)}s` : '--'}</span>
                      {isProcessing ? (
                        <span className="text-blue-400">{j.progress}%</span>
                      ) : (
                        <span>{new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>

                    {isProcessing && (
                      <div className="w-full bg-command-bg rounded-full h-1 mt-2 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-1 rounded-full transition-all"
                          style={{ width: `${j.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center & Right Columns: Selected Job Inspector, Video Player, and Incident Feed */}
        <div className="lg:col-span-2 space-y-6">
          {currentJob ? (
            <>
              {/* Job Status Banner */}
              <div className="bg-command-surface border border-command-border rounded-lg p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{currentJob.filename}</span>
                    </h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      Job ID: {currentJob.id}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {currentJob.status === 'processing' && (
                      <button
                        onClick={handleCancelCurrentJob}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}
                    {currentJob.status === 'completed' && incidents.length === 0 && (
                      <div className="px-3 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>NORMAL ACTIVITY</span>
                      </div>
                    )}
                    {currentJob.status === 'completed' && incidents.length > 0 && (
                      <div className="px-3 py-1 rounded-full text-xs font-bold border flex items-center space-x-1.5 bg-amber-500/20 text-amber-300 border-amber-500/40">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>SUSPICIOUS ACTIVITY ({incidents.length})</span>
                      </div>
                    )}
                    {currentJob.status === 'processing' && (
                      <div className="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center space-x-1.5 bg-blue-500/10 text-blue-400 border-blue-500/30">
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Video...</span>
                      </div>
                    )}
                    {currentJob.status === 'failed' && (
                      <div className="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center space-x-1.5 bg-red-500/10 text-red-400 border-red-500/30">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Failed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Real Processing Progress */}
                {currentJob.status === 'processing' && (
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">Inference Progress</span>
                      <span className="text-blue-400 font-semibold">{currentJob.progress}% ({currentJob.processed_frames} / {currentJob.total_frames} frames)</span>
                    </div>
                    <div className="w-full bg-command-bg rounded-full h-2 overflow-hidden border border-command-border">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${currentJob.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Pipeline Telemetry Counters (Separated Metrics) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono text-slate-300">
                  <div className="bg-command-panel p-2.5 rounded border border-command-border">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                      <Layers className="w-3 h-3 text-blue-400" /> Frames Analyzed
                    </span>
                    <span className="text-sm font-bold text-white mt-1 block">
                      {currentJob.processed_frames} / {currentJob.total_frames || '--'}
                    </span>
                  </div>

                  <div className="bg-command-panel p-2.5 rounded border border-command-border">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider" title="Number of distinct confirmed individuals tracked across video">
                      <Users className="w-3 h-3 text-emerald-400" /> Unique People
                    </span>
                    <span className="text-sm font-bold text-emerald-400 mt-1 block">
                      {currentJob.unique_people !== undefined ? currentJob.unique_people : '--'}
                    </span>
                  </div>

                  <div className="bg-command-panel p-2.5 rounded border border-command-border">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider" title="People visible in the current/latest sampled frame">
                      <UserCheck className="w-3 h-3 text-teal-400" /> Current People
                    </span>
                    <span className="text-sm font-bold text-teal-400 mt-1 block">
                      {currentJob.current_people !== undefined ? currentJob.current_people : '--'}
                    </span>
                  </div>

                  <div className="bg-command-panel p-2.5 rounded border border-command-border">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider" title="Total bounding-box detections summed across all frames">
                      <Eye className="w-3 h-3 text-cyan-400" /> Person Detections
                    </span>
                    <span className="text-sm font-bold text-cyan-400 mt-1 block">
                      {currentJob.people_detected || 0}
                    </span>
                  </div>

                  <div className="bg-command-panel p-2.5 rounded border border-command-border">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                      <ShieldAlert className="w-3 h-3 text-amber-400" /> Incidents Logged
                    </span>
                    <span className="text-sm font-bold text-amber-400 mt-1 block">
                      {incidents.length} Potential
                    </span>
                  </div>
                </div>

                {/* Video Info Pills */}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono text-slate-400 border-t border-command-border/60 pt-3">
                  <span>Duration: <strong className="text-slate-200">{currentJob.duration_seconds ? `${currentJob.duration_seconds}s` : '--'}</strong></span>
                  <span>•</span>
                  <span>FPS: <strong className="text-slate-200">{currentJob.fps ? Math.round(currentJob.fps) : '--'}</strong></span>
                  <span>•</span>
                  <span>Sampling: <strong className="text-blue-400">5 FPS CPU Subsampling</strong></span>
                  <span>•</span>
                  <span>Model: <strong className="text-slate-200">YOLOv8n (0.25 conf)</strong></span>
                </div>

                {currentJob.error_message && (
                  <div className="mt-3 p-3 bg-red-950/40 border border-red-500/40 rounded text-xs text-red-300">
                    Error: {currentJob.error_message}
                  </div>
                )}
              </div>

              {/* AI Surveillance Verdict Banner */}
              {currentJob.status === 'completed' && incidents.length === 0 && (
                <div className="bg-gradient-to-r from-emerald-950/40 via-command-surface to-command-surface border-2 border-emerald-500/40 rounded-lg p-5 shadow-lg shadow-emerald-950/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                            AI Surveillance Verdict
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-black uppercase tracking-wider">
                            NORMAL ACTIVITY
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          Normal Routine Activity Verified — No Suspicious Behavior Detected
                        </h3>
                      </div>
                    </div>
                    <div className="text-left sm:text-right font-mono text-xs text-slate-300">
                      <span className="text-emerald-400 font-bold">✓ 0 Threats Logged</span>
                      <span className="block text-[11px] text-slate-400">{currentJob.processed_frames} Frames Evaluated</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    The multi-factor AI surveillance pipeline evaluated all {currentJob.processed_frames} sampled frames. 
                    The detected individual ({currentJob.unique_people || 1} tracked) exhibited calm, stationary or normal routine motion. 
                    No weapon threats, physical fighting, rapid running, falls, or anomalous crowding were detected.
                  </p>

                  {/* Multi-Factor Safety Audit Checklist */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-emerald-500/15 text-[11px] font-mono">
                    <div className="bg-emerald-950/30 border border-emerald-500/25 rounded p-2.5 flex items-center space-x-2 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block font-semibold">Weapon Scan</span>
                        <span className="text-[10px] text-slate-400">Clean (0 Weapons)</span>
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-500/25 rounded p-2.5 flex items-center space-x-2 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block font-semibold">Physical Interaction</span>
                        <span className="text-[10px] text-slate-400">Peaceful (0 Altercations)</span>
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-500/25 rounded p-2.5 flex items-center space-x-2 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block font-semibold">Motion Velocity</span>
                        <span className="text-[10px] text-slate-400">Calm (No Sprinting)</span>
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-500/25 rounded p-2.5 flex items-center space-x-2 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="block font-semibold">Stability / Posture</span>
                        <span className="text-[10px] text-slate-400">Stable (0 Falls)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentJob.status === 'completed' && incidents.length > 0 && (
                <div className="bg-gradient-to-r from-amber-950/40 via-command-surface to-command-surface border-2 border-amber-500/50 rounded-lg p-5 shadow-lg shadow-amber-950/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-400">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                            AI Surveillance Verdict
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-black uppercase tracking-wider">
                            SUSPICIOUS ACTIVITY DETECTED
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          {incidents.length} Potential Threat Event{incidents.length > 1 ? 's' : ''} Flagged For Human Verification
                        </h3>
                      </div>
                    </div>
                    <div className="text-left sm:text-right font-mono text-xs text-slate-300">
                      <span className="text-amber-400 font-bold">⚠ {incidents.length} Alert{incidents.length > 1 ? 's' : ''} Active</span>
                      <span className="block text-[11px] text-slate-400">{currentJob.processed_frames} Frames Analyzed</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    The AI surveillance engine flagged anomalous kinematic motion, high-velocity running, potential physical disturbance, or weapon presence exceeding threshold baselines. Review the timestamped evidence clips and telemetry below.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-amber-500/15">
                    {Array.from(new Set(incidents.map(i => i.category))).map(cat => (
                      <span key={cat} className="px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-500/40 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        {cat.replaceAll('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Video Player Section */}
              <div className="bg-command-surface border border-command-border rounded-lg overflow-hidden">
                <div className="p-3 bg-command-panel border-b border-command-border flex items-center justify-between text-xs font-mono text-slate-300">
                  <span className="font-semibold text-white truncate max-w-md">{activeMediaTitle}</span>
                  {activeMediaUrl && (
                    <button
                      onClick={() => {
                        setActiveMediaUrl(getVideoStreamUrl(currentJob.id));
                        setActiveMediaTitle(`Original Video: ${currentJob.filename}`);
                      }}
                      className="text-blue-400 hover:text-blue-300 text-[11px] underline"
                    >
                      Reset to Full Video
                    </button>
                  )}
                </div>

                <div className="relative bg-black aspect-video flex items-center justify-center">
                  {activeMediaUrl ? (
                    <video
                      ref={videoRef}
                      key={activeMediaUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    >
                      <source src={activeMediaUrl} type="video/mp4" />
                      Your browser does not support HTML5 video streaming.
                    </video>
                  ) : (
                    <div className="text-center text-slate-500">
                      <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Select a video or evidence clip to preview</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Detected Incidents Table & Timeline */}
              <div className="bg-command-surface border border-command-border rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-command-border pb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                      Detected Events & Potential Incidents ({incidents.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Requires Human Verification
                  </span>
                </div>

                {incidents.length === 0 ? (
                  <div className="py-8 px-4 text-center bg-command-panel/40 border border-emerald-500/30 rounded-lg space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        Verified Normal Activity — 0 Security Threats
                      </h4>
                      <p className="text-xs text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                        {currentJob.status === 'processing' 
                          ? 'Analysis in progress on CPU...' 
                          : 'This video recording was analyzed across all frames. No anomalous motion, physical altercation, weapon, fall, or crowd disturbance was detected. Safe for standard archival.'}
                      </p>
                    </div>
                    {currentJob.status === 'completed' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Security Baseline Passed: Normal Routine</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="bg-command-panel p-3 rounded border border-command-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-amber-500/10 text-amber-400 rounded">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                inc.category.includes('altercation') 
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' 
                                  : inc.category.includes('weapon')
                                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                  : inc.category.includes('fall')
                                  ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                  : inc.category.includes('crowd')
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}>
                                {inc.category.replaceAll('_', ' ')}
                              </span>
                              <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700" title="Kinematic heuristic indicator - requires human verification, does not prove a crime">
                                {Math.round(inc.confidence * 100)}% {inc.category.includes('weapon') ? 'Model Score' : 'Motion Heuristic Score'}
                              </span>
                              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono px-1.5 py-0.5 rounded capitalize">
                                {inc.review_status} (Verification Req.)
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                              Timestamp: {Math.floor(inc.timestamp_start)}s - {Math.ceil(inc.timestamp_end)}s
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                          <button
                            onClick={() => playOriginalAtTimestamp(inc.timestamp_start)}
                            className="px-2.5 py-1.5 rounded bg-command-bg hover:bg-command-border text-slate-300 hover:text-white text-xs font-mono transition-colors border border-command-border flex items-center space-x-1"
                            title="Jump original video to timestamp"
                          >
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span>Jump</span>
                          </button>

                          {inc.evidence_clips && inc.evidence_clips.length > 0 && (
                            <button
                              onClick={() => playEvidenceClip(inc.evidence_clips![0].id, inc.category, inc.timestamp_start)}
                              className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center space-x-1"
                              title="Play extracted evidence clip"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Play Clip</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-command-surface border border-command-border rounded-lg p-12 text-center">
              <FileVideo className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No Video Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Upload a CCTV video recording or select a previously processed file from the jobs panel to inspect detections.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

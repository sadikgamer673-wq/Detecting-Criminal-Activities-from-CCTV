import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Cctv, 
  FileVideo, 
  Crosshair, 
  Cpu, 
  Layers, 
  Lock, 
  ArrowRight, 
  Activity, 
  FileText,
  Users,
  Eye,
  LogIn,
  ShieldAlert,
  HelpCircle,
  KeyRound,
  Check,
  X
} from 'lucide-react';
import type { HealthResponse } from '../types';

interface LandingPageProps {
  health: HealthResponse | null;
  latencyMs: number;
  isAuthenticated: boolean;
  onEnterApp: () => void;
  onGoToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  health,
  latencyMs,
  isAuthenticated,
  onEnterApp,
  onGoToLogin,
}) => {
  const isHealthy = health?.status === 'healthy';
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Does this CCTV AI system require an expensive NVIDIA GPU?",
      a: "No. The system is engineered specifically for CPU-only inference using an optimized YOLOv8n architecture and OpenCV processing pipeline. On standard modern multi-core processors (Intel Core i5/i7/i9 or AMD Ryzen), it delivers sustained 15-20 FPS inference per stream without requiring dedicated GPU acceleration."
    },
    {
      q: "What types of cameras and video feeds can be connected?",
      a: "The ingestion subsystem supports any RTSP IP camera (Hikvision, Dahua, Axis, Reolink, Hanwha), DVR/NVR multichannel RTSP feeds, USB/UVC laptop webcams (Index 0), Android phone IP webcam streams (HTTP MJPEG), and uploaded MP4/AVI forensic surveillance recordings."
    },
    {
      q: "How does the system prevent false alarms from ordinary objects?",
      a: "Unlike naive object detectors that trigger on a single blurry frame, our architecture implements a 3-layer safeguard: (1) Configurable softmax confidence thresholding, (2) Temporal multi-frame confirmation requiring consistent presence across 2 to 6 consecutive frames, and (3) Geometric human-context sanity filtering to distinguish kitchen utensils, phones, or power tools from genuine threats."
    },
    {
      q: "How does the automated incident evidence buffer work?",
      a: "A high-performance circular memory ring buffer retains 3 seconds of pre-incident frames in RAM. When a threat triggers, the system automatically captures the preceding 3 seconds and subsequent 3 seconds, stitching them into an auditable MP4 clip with full frame-accurate thumbnails stored on disk."
    },
    {
      q: "How does Role-Based Access Control (RBAC) protect system integrity?",
      a: "The Lead Surveillance Commander (Admin) has full administrative control and can grant or revoke specific operational permissions (e.g., live stream control, incident triage, video uploads, report export, and AI threshold tuning) for lower-level roles like Forensic Analysts and Field Operators."
    },
    {
      q: "Is any surveillance footage or metadata sent to third-party cloud servers?",
      a: "Zero bytes leave your local deployment. All video ingestion, frame decoding, neural network inference, and SQLite database transactions execute 100% on-premise on your local machine, fully compliant with privacy regulations and air-gapped facility requirements."
    }
  ];

  return (
    <div className="min-h-screen bg-command-bg text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-command-surface/85 backdrop-blur-md border-b border-command-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/40 text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-wider text-sm uppercase text-white">
                Detecting Criminal Activities from CCTV
              </span>
              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-blue-500/30">
                AI & ML v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Using Object Detection and Machine Learning Algorithms
            </p>
          </div>
        </div>

        {/* Center Live Telemetry Pill */}
        <div className="hidden lg:flex items-center space-x-4 bg-command-panel/60 border border-command-border px-4 py-1.5 rounded-full text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300">Backend Core:</span>
            <span className={isHealthy ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {health?.status ? health.status.toUpperCase() : 'CONNECTING'}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Ping: {latencyMs}ms</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>CPU Accelerated (x86_64)</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <button
              onClick={onEnterApp}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <span>Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onGoToLogin}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Operator Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-20 lg:py-28 overflow-hidden flex flex-col items-center justify-center text-center">
        {/* Ambient Glow & Grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.18),rgba(255,255,255,0))] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] bg-blue-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AI-Powered Surveillance & Crime Detection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Detecting Criminal Activities from CCTV <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Using Object Detection and Machine Learning Algorithms
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Ingest live CCTV streams, RTSP feeds, NVR channels, and forensic video footage.
            Detect persons, verify dangerous weapons across consecutive frames, and triage security incidents with automated pre-roll video clipping and role-based clearance gates.
          </p>

          {/* Call to Actions */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={onEnterApp}
                className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-xl shadow-blue-600/30 hover:scale-105 cursor-pointer"
              >
                <span>Launch Command Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={onGoToLogin}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-xl shadow-blue-600/30 hover:scale-105 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Access Operator Console</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('project-architecture');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-lg bg-command-panel hover:bg-command-border text-slate-200 text-sm font-semibold border border-command-border flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>Explore Architecture</span>
                </button>
              </>
            )}
          </div>

          {/* Quick Metrics Strip */}
          <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="bg-command-surface/90 border border-command-border p-4 rounded-lg">
              <span className="text-[11px] text-slate-400 font-mono block uppercase">Object Model</span>
              <span className="text-sm font-bold text-white mt-1 block">YOLOv8n (COCO)</span>
              <span className="text-[11px] text-emerald-400 mt-0.5 block font-mono">CPU Optimized (~18ms)</span>
            </div>
            <div className="bg-command-surface/90 border border-command-border p-4 rounded-lg">
              <span className="text-[11px] text-slate-400 font-mono block uppercase">Threat Classifier</span>
              <span className="text-sm font-bold text-white mt-1 block">Knives & Firearms</span>
              <span className="text-[11px] text-orange-400 mt-0.5 block font-mono">Multi-Frame Verified</span>
            </div>
            <div className="bg-command-surface/90 border border-command-border p-4 rounded-lg">
              <span className="text-[11px] text-slate-400 font-mono block uppercase">Forensics Buffer</span>
              <span className="text-sm font-bold text-white mt-1 block">Rolling RAM Ring</span>
              <span className="text-[11px] text-purple-400 mt-0.5 block font-mono">3s Pre + 3s Post Clip</span>
            </div>
            <div className="bg-command-surface/90 border border-command-border p-4 rounded-lg">
              <span className="text-[11px] text-slate-400 font-mono block uppercase">Access Governance</span>
              <span className="text-sm font-bold text-white mt-1 block">Role-Based RBAC</span>
              <span className="text-[11px] text-blue-400 mt-0.5 block font-mono">Admin Delegated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section id="project-architecture" className="px-6 py-16 bg-command-surface/40 border-y border-command-border">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-blue-400 font-semibold">
              Deep Architecture & Capabilities
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">
              Built for Real-World Physical Security Operations
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Traditional CCTV systems only record footage for post-incident review. This platform transforms passive cameras into an autonomous real-time threat alert system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-command-surface border border-command-border p-6 rounded-lg hover:border-blue-500/50 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Cctv className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-white mb-2">
                Multi-Source CCTV Ingestion Engine
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and ingest RTSP security streams, NVR/DVR channels, Android IP webcams, or your laptop camera with low-latency streaming and automatic reconnect recovery.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-command-surface border border-command-border p-6 rounded-lg hover:border-emerald-500/50 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-white mb-2">
                Real-Time Person & Crowd Counting
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Powered by YOLOv8n CPU inference with persistent track IDs. Accurately distinguishes between current people visible in frame and cumulative unique individuals across time.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-command-surface border border-command-border p-6 rounded-lg hover:border-orange-500/50 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Crosshair className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-white mb-2">
                Multi-Frame Threat & Weapon Verification
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Detects knives, handguns, and rifles using consecutive-frame persistence logic and geometric human context to eliminate single-frame false positives from phones or ordinary tools.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-command-surface border border-command-border p-6 rounded-lg hover:border-purple-500/50 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileVideo className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-white mb-2">
                Automated Evidence Clip Extraction
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A rolling pre-incident ring buffer saves the $3$ seconds prior to a detected threat trigger plus $3$ seconds of post-event footage directly into an MP4 evidence vault with thumbnails.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-command-surface border border-command-border p-6 rounded-lg hover:border-cyan-500/50 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-white mb-2">
                AI Surveillance Safety Audit
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Processes video uploads and delivers a multi-factor verdict (Normal Activity vs. Suspicious Activity) inspecting weapons, altercations, rapid velocity spikes, and crowd density.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-command-surface border border-command-border p-6 rounded-lg hover:border-pink-500/50 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-white mb-2">
                Auditable Reports & Export
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Human-in-the-loop incident triage with status tracking (Potential, Acknowledged, Reviewed, Dismissed). Export auditable forensics records to CSV, JSON, and print-ready briefs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Threat Detection & False Positive Filtering Comparison */}
      <section className="px-6 py-16 max-w-7xl mx-auto w-full space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-orange-400 font-semibold">
            Precision Filtering
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">
            Target Threat Classes vs. Suppressed Objects
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Real surveillance environments are filled with handheld tools, phones, and utensils. The system maintains high sensitivity to threats while aggressively suppressing false alarms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Threat Card */}
          <div className="bg-command-surface border border-red-500/30 rounded-lg p-6 space-y-4">
            <div className="flex items-center space-x-2 text-red-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Target Dangerous Threat Classes</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-start space-x-2.5 p-2.5 bg-red-500/10 rounded border border-red-500/20">
                <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Handguns & Pistols</strong>
                  <span className="text-slate-400 text-[11px]">Short-barrel firearms, revolvers, and semi-automatic handguns in hand or holster.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2.5 p-2.5 bg-red-500/10 rounded border border-red-500/20">
                <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Rifles & Long Guns</strong>
                  <span className="text-slate-400 text-[11px]">Tactical rifles, shotguns, carbines, and elongated firearm contours.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2.5 p-2.5 bg-red-500/10 rounded border border-red-500/20">
                <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Knives & Blades</strong>
                  <span className="text-slate-400 text-[11px]">Tactical knives, daggers, cleavers, and bladed instruments brandished in active spaces.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filtered Non-Threat Card */}
          <div className="bg-command-surface border border-emerald-500/30 rounded-lg p-6 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>Filtered Benign Objects (False-Positive Suppression)</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-start space-x-2.5 p-2.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                <X className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Smartphones & Mobile Devices</strong>
                  <span className="text-slate-400 text-[11px]">Filtered out via aspect ratio analysis and temporal trajectory stability.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2.5 p-2.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                <X className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Handheld Tools & Hardware</strong>
                  <span className="text-slate-400 text-[11px]">Drills, barcode scanners, and flashlights filtered by human-activity classification.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2.5 p-2.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                <X className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Benign Utensils & Food Preparation</strong>
                  <span className="text-slate-400 text-[11px]">Cutlery in passive posture without aggressive acceleration or human altercation.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Access Control (RBAC) Architecture Section */}
      <section className="px-6 py-16 bg-command-surface/60 border-t border-command-border">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              Security Governance & Clearance
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">
              Role-Based Access Control (RBAC)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              The Lead Surveillance Commander manages operational clearances across the team, ensuring lower-level personnel operate strictly within authorized boundaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Admin Tier */}
            <div className="bg-command-surface border border-blue-500/40 rounded-lg p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold">
                  LEVEL 1 CLEARANCE
                </span>
                <KeyRound className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Lead Surveillance Commander</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Full administrative authority over surveillance streams, AI models, and user permissions.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Configure & delete camera feeds</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Tune CPU sampling rates & AI thresholds</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Administer RBAC clearance policies</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Full access to all 9 system modules</span>
                </li>
              </ul>
            </div>

            {/* Analyst Tier */}
            <div className="bg-command-surface border border-emerald-500/40 rounded-lg p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                  LEVEL 2 CLEARANCE
                </span>
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Forensic Triage Analyst</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Investigative clearance to review incidents, evaluate evidence clips, and export reports.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Triage & resolve flagged incidents</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Upload recordings for batch analysis</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Export auditable CSV & JSON records</span>
                </li>
                <li className="flex items-center gap-2 text-red-400">
                  <X className="w-3.5 h-3.5" />
                  <span>No access to modify camera feeds or AI models</span>
                </li>
              </ul>
            </div>

            {/* Operator Tier */}
            <div className="bg-command-surface border border-purple-500/40 rounded-lg p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono text-[10px] font-bold">
                  LEVEL 3 CLEARANCE
                </span>
                <Eye className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Field Security Operator</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Patrol clearance focused on live perimeter monitoring and situational occupancy awareness.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Real-time multi-camera live viewing</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Occupancy & unique person telemetry</span>
                </li>
                <li className="flex items-center gap-2 text-red-400">
                  <X className="w-3.5 h-3.5" />
                  <span>Cannot dismiss or alter incident statuses</span>
                </li>
                <li className="flex items-center gap-2 text-red-400">
                  <X className="w-3.5 h-3.5" />
                  <span>Locked out of system configuration & camera edit</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications Matrix */}
      <section className="px-6 py-16 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
            System Specifications
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">
            Engineering & Deployment Benchmark
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-command-surface border border-command-border p-4 rounded-lg space-y-2">
            <span className="text-slate-400 block text-[11px] uppercase">Host Processor</span>
            <span className="text-sm font-bold text-white block">Multi-Core CPU</span>
            <span className="text-[11px] text-emerald-400 block">Intel / AMD x86_64</span>
            <p className="text-[11px] text-slate-400 font-sans mt-2">Zero reliance on CUDA or dedicated GPUs.</p>
          </div>

          <div className="bg-command-surface border border-command-border p-4 rounded-lg space-y-2">
            <span className="text-slate-400 block text-[11px] uppercase">Stream Ingestion</span>
            <span className="text-sm font-bold text-white block">RTSP & HTTP MJPEG</span>
            <span className="text-[11px] text-blue-400 block">OpenCV VideoCapture</span>
            <p className="text-[11px] text-slate-400 font-sans mt-2">Auto-reconnect with non-blocking threads.</p>
          </div>

          <div className="bg-command-surface border border-command-border p-4 rounded-lg space-y-2">
            <span className="text-slate-400 block text-[11px] uppercase">Database Engine</span>
            <span className="text-sm font-bold text-white block">SQLite 3 (WAL)</span>
            <span className="text-[11px] text-purple-400 block">Write-Ahead Logging</span>
            <p className="text-[11px] text-slate-400 font-sans mt-2">Concurrent read/write without locks.</p>
          </div>

          <div className="bg-command-surface border border-command-border p-4 rounded-lg space-y-2">
            <span className="text-slate-400 block text-[11px] uppercase">Privacy & Compliance</span>
            <span className="text-sm font-bold text-white block">100% On-Premise</span>
            <span className="text-[11px] text-emerald-400 block">Air-Gap Capable</span>
            <p className="text-[11px] text-slate-400 font-sans mt-2">No external telemetry or cloud upload.</p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions Accordion */}
      <section className="px-6 py-16 bg-command-surface/40 border-t border-command-border">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-widest text-blue-400 font-semibold flex items-center justify-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              Frequently Asked Questions
            </h2>
            <h3 className="text-2xl font-bold text-white">
              Questions & Deployment Details
            </h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-command-surface border border-command-border rounded-lg overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className="text-blue-400 font-mono text-sm ml-4">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-command-border pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="px-6 py-16 text-center space-y-6">
        <div className="max-w-xl mx-auto space-y-3">
          <h3 className="text-2xl font-bold text-white">
            Ready to Begin Surveillance Monitoring?
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Sign in with authorized security operator credentials or access the live command console.
          </p>
          <div className="pt-2">
            <button
              onClick={onGoToLogin}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center space-x-2 shadow-xl shadow-blue-600/30 transition-all cursor-pointer hover:scale-105"
            >
              <LogIn className="w-4 h-4" />
              <span>Launch Operator Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-command-border bg-command-surface/90 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300 font-semibold">Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span>Inference: CPU (Windows 11)</span>
            <span>Storage: SQLite (WAL)</span>
            <span className="text-emerald-400">System Healthy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

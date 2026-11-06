import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cctv, 
  Play, 
  Square, 
  RefreshCw, 
  Activity, 
  WifiOff, 
  Laptop, 
  Server, 
  Smartphone, 
  Camera, 
  ShieldCheck, 
  Users, 
  Flame,
  ArrowRight,
  Crosshair,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { 
  fetchCameras, 
  startCameraMonitoring, 
  stopCameraMonitoring, 
  getCameraStreamUrl,
  fetchCameraTelemetry
} from '../services/api';
import type { CameraItem, CameraTelemetry, NavTab } from '../types';

interface LiveMonitoringProps {
  onNavigateTab?: (tab: NavTab) => void;
}

export const LiveMonitoring: React.FC<LiveMonitoringProps> = ({ onNavigateTab }) => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, CameraTelemetry>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [streamErrors, setStreamErrors] = useState<Record<string, boolean>>({});
  const [streamRetryTokens, setStreamRetryTokens] = useState<Record<string, number>>({});

  const handleRetryStream = (camId: string) => {
    setStreamErrors((prev) => ({ ...prev, [camId]: false }));
    setStreamRetryTokens((prev) => ({ ...prev, [camId]: (prev[camId] || 0) + 1 }));
  };

  const loadCameras = useCallback(async () => {
    try {
      const data = await fetchCameras();
      setCameras(data);
    } catch (err: any) {
      console.error('Failed to load cameras for live monitoring:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll camera list and telemetry periodically
  useEffect(() => {
    loadCameras();
    const interval = setInterval(async () => {
      // Refresh telemetry for active cameras
      try {
        const data = await fetchCameras();
        setCameras(data);
        for (const cam of data) {
          if (cam.monitoring_active) {
            try {
              const tel = await fetchCameraTelemetry(cam.id);
              setTelemetry((prev) => ({ ...prev, [cam.id]: tel }));
            } catch {}
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [loadCameras]);

  const handleToggleMonitoring = async (cam: CameraItem) => {
    setActionBusy((prev) => ({ ...prev, [cam.id]: true }));
    try {
      if (cam.monitoring_active) {
        await stopCameraMonitoring(cam.id);
      } else {
        await startCameraMonitoring(cam.id, true);
      }
      await loadCameras();
    } catch (err: any) {
      alert(`Failed to toggle monitoring: ${err.message}`);
    } finally {
      setActionBusy((prev) => ({ ...prev, [cam.id]: false }));
    }
  };

  const handleStartAll = async () => {
    for (const cam of cameras) {
      if (!cam.monitoring_active) {
        try {
          await startCameraMonitoring(cam.id, true);
        } catch {}
      }
    }
    await loadCameras();
  };

  const handleStopAll = async () => {
    for (const cam of cameras) {
      if (cam.monitoring_active) {
        try {
          await stopCameraMonitoring(cam.id);
        } catch {}
      }
    }
    await loadCameras();
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'webcam':
        return <Laptop className="w-4 h-4 text-blue-400" />;
      case 'dvr_nvr':
        return <Server className="w-4 h-4 text-purple-400" />;
      case 'android_phone':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      default:
        return <Camera className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Cctv className="w-7 h-7 text-blue-400" />
            Live Surveillance & Threat Monitoring
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Real-time video ingestion, low-latency browser streaming, and CPU-compatible YOLOv8n object & activity classification.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {cameras.length > 0 && (
            <>
              <button
                onClick={handleStartAll}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm shadow-emerald-600/20"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start All Feeds</span>
              </button>
              <button
                onClick={handleStopAll}
                className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border flex items-center space-x-1.5 transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop All</span>
              </button>
            </>
          )}

          <button
            onClick={loadCameras}
            disabled={isLoading}
            className="p-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 border border-command-border transition-colors disabled:opacity-50"
            title="Refresh Feeds"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
          </button>
        </div>
      </div>

      {/* Real-time Status / Model Banner */}
      <div className="p-3 rounded-lg bg-command-surface border border-command-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-medium">Inference Engines:</span>
          <span className="text-slate-400">YOLOv8n Person + YOLOv8n Weapon Threat Detector (CPU) + Temporal Activity Tracker</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px] text-slate-400">
          <span>Active Feeds: <strong className="text-white font-mono">{cameras.filter(c => c.monitoring_active).length} / {cameras.length}</strong></span>
          <span className="flex items-center gap-1 text-orange-400 font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
            Weapon Triage: Multi-Frame Verified
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Rolling Buffer Auto-Clip
          </span>
        </div>
      </div>

      {/* Feeds Grid */}
      {cameras.length === 0 ? (
        <div className="bg-command-surface border border-command-border rounded-lg p-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-command-panel border border-command-border flex items-center justify-center mx-auto text-slate-400">
            <Cctv className="w-8 h-8 text-blue-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No CCTV Endpoints Configured</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Add your Laptop Webcam (device index 0), an IP CCTV camera, DVR/NVR channel, or Android phone feed in Camera Management to begin live surveillance.
            </p>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('camera_management')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition-colors"
            >
              <span>Go to Camera Management</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cameras.map((cam) => {
            const tel = telemetry[cam.id];
            const isBusy = !!actionBusy[cam.id];
            const isLive = cam.monitoring_active;

            return (
              <div
                key={cam.id}
                className="bg-command-surface border border-command-border rounded-lg overflow-hidden flex flex-col shadow-lg"
              >
                {/* Camera Feed Card Header */}
                <div className="p-3 bg-command-panel border-b border-command-border flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getSourceIcon(cam.source_type)}
                    <span className="text-xs font-bold text-white tracking-wide">{cam.name}</span>
                    {cam.location && (
                      <span className="text-[10px] text-slate-400">({cam.location})</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {isLive ? (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                        LIVE
                      </span>
                    ) : (
                      <span className="bg-slate-700 text-slate-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded">
                        STANDBY
                      </span>
                    )}
                  </div>
                </div>

                {/* Video Feed Window */}
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {isLive ? (
                    <>
                      <img
                        key={`cam-stream-${cam.id}-${streamRetryTokens[cam.id] || 0}`}
                        src={`${getCameraStreamUrl(cam.id)}?t=${streamRetryTokens[cam.id] || 0}`}
                        alt={cam.name}
                        className={`w-full h-full object-cover ${streamErrors[cam.id] ? 'opacity-20' : 'opacity-100'} transition-opacity duration-300`}
                        onLoad={() => {
                          setStreamErrors((prev) => ({ ...prev, [cam.id]: false }));
                        }}
                        onError={() => {
                          setStreamErrors((prev) => ({ ...prev, [cam.id]: true }));
                        }}
                      />

                      {/* Stream Interruption / Drop Overlay */}
                      {streamErrors[cam.id] && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                          <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-white">Stream Signal Interrupted</h4>
                            <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                              Live video ingestion lost connection or frames are temporarily delayed.
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => handleRetryStream(cam.id)}
                              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center space-x-1.5 transition-colors shadow-sm"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Reconnect Stream</span>
                            </button>
                            <button
                              onClick={() => handleToggleMonitoring(cam)}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors disabled:opacity-50"
                            >
                              <span>Restart Feed</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center p-6 space-y-2">
                      <WifiOff className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        Camera feed is in standby mode.
                      </p>
                      <button
                        onClick={() => handleToggleMonitoring(cam)}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center space-x-1 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start Monitoring</span>
                      </button>
                    </div>
                  )}

                  {/* Overlaid Live Badges */}
                  {/* Overlaid Live Badges */}
                  {isLive && (
                    <div className="absolute top-2 left-2 flex items-center space-x-2 font-mono text-[10px]">
                      <span className="bg-black/70 backdrop-blur-sm text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        FPS: {tel?.fps || cam.fps || '15.0'}
                      </span>
                      <span className="bg-black/70 backdrop-blur-sm text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                        {tel?.resolution || cam.resolution || 'Auto'}
                      </span>
                      {tel?.inference_time_ms !== undefined && tel.inference_time_ms > 0 && (
                        <span className="bg-black/70 backdrop-blur-sm text-blue-400 px-2 py-0.5 rounded border border-blue-500/30" title="YOLOv8n CPU Inference Latency">
                          AI: {tel.inference_time_ms}ms
                        </span>
                      )}
                    </div>
                  )}

                  {/* Incident Alert Overlay badge if incidents detected */}
                  {isLive && tel && tel.incidents_detected > 0 && (
                    <div className="absolute top-2 right-2 bg-red-500/90 text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 shadow-md">
                      <Flame className="w-3 h-3 fill-current" />
                      <span>{tel.incidents_detected} Alerts Logged</span>
                    </div>
                  )}

                  {/* Weapon Alert Overlay badge if active weapons detected */}
                  {isLive && tel?.active_weapons && tel.active_weapons.length > 0 && (
                    <div className="absolute top-8 right-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center space-x-1.5 shadow-lg border border-red-400 animate-pulse">
                      <Crosshair className="w-3.5 h-3.5 text-white" />
                      <span>WEAPON: {tel.active_weapons[0].class_name.toUpperCase()} ({Math.round(tel.active_weapons[0].confidence * 100)}%)</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Telemetry & Controls */}
                <div className="p-3 bg-command-panel border-t border-command-border flex items-center justify-between text-xs">
                  {/* Telemetry metrics */}
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1" title="People currently visible in frame">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      Current: <strong className={tel && tel.current_people > 0 ? "text-emerald-400 font-bold" : "text-slate-200"}>{tel ? tel.current_people : 0}</strong>
                    </span>
                    <span title="Distinct tracked people across stream">
                      Unique: <strong className="text-slate-200">{tel ? tel.unique_people : 0}</strong>
                    </span>
                    <span title="Processed video frames">
                      Frames: <strong className="text-slate-200">{tel ? tel.frames_received : 0}</strong>
                    </span>
                    {tel?.frames_processed_ai !== undefined && (
                      <span title="Frames analyzed by YOLOv8n CPU">
                        AI: <strong className="text-slate-300">{tel.frames_processed_ai}</strong>
                      </span>
                    )}
                    {tel?.weapons_detected !== undefined && (
                      <span title="Confirmed weapon events detected" className={tel.weapons_detected > 0 ? "text-orange-400 font-semibold" : ""}>
                        Weapons: <strong className={tel.weapons_detected > 0 ? "text-orange-400" : "text-slate-200"}>{tel.weapons_detected}</strong>
                      </span>
                    )}
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggleMonitoring(cam)}
                    disabled={isBusy}
                    className={`px-3 py-1 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50 ${
                      isLive
                        ? 'bg-amber-600/80 hover:bg-amber-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isLive ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

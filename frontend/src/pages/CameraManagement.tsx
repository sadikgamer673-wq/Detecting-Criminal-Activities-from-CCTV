import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Activity, 
  RefreshCw, 
  Camera, 
  CheckCircle2, 
  XCircle,
  Video,
  Play,
  Square,
  Smartphone,
  Server,
  Laptop,
  AlertTriangle,
  Info,
  ShieldCheck,
  Eye,
  X
} from 'lucide-react';
import { 
  fetchCameras, 
  createCamera, 
  deleteCamera, 
  testCameraConnection, 
  testSavedCamera,
  startCameraMonitoring,
  stopCameraMonitoring,
  getCameraStreamUrl
} from '../services/api';
import type { CameraItem, CameraTestResult } from '../types';

type SourceType = 'webcam' | 'ip_cctv' | 'dvr_nvr' | 'android_phone';

export const CameraManagement: React.FC = () => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Selected Source Type Tab
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType>('webcam');

  // Form Fields
  const [name, setName] = useState<string>('Laptop Webcam');
  const [rtspUrl, setRtspUrl] = useState<string>('0');
  const [location, setLocation] = useState<string>('Local Workstation');
  
  // Camera Vendor Preset helper for IP/DVR
  const [vendorPreset, setVendorPreset] = useState<string>('generic');
  const cameraIp = '192.168.1.100';
  const cameraPort = '554';
  const [channelNum, setChannelNum] = useState<string>('1');

  // Connection Test State
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<CameraTestResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Preview Modal
  const [previewCamera, setPreviewCamera] = useState<CameraItem | null>(null);

  // Action busy states
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

  const loadCameras = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCameras();
      setCameras(data);
    } catch (err: any) {
      console.error('Failed to load cameras:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  // Update default fields when changing source type tab
  const handleTabChange = (type: SourceType) => {
    setSelectedSourceType(type);
    setTestResult(null);
    setFormError(null);

    if (type === 'webcam') {
      setName('Laptop Integrated Webcam');
      setRtspUrl('0');
      setLocation('Local Workstation');
    } else if (type === 'ip_cctv') {
      setName('Main Gate IP Camera');
      setRtspUrl(`rtsp://${cameraIp}:${cameraPort}/live/ch0`);
      setLocation('Perimeter Entrance');
    } else if (type === 'dvr_nvr') {
      setName(`DVR Channel ${channelNum}`);
      setRtspUrl(`rtsp://${cameraIp}:${cameraPort}/Streaming/Channels/${channelNum}01`);
      setLocation('Building Perimeter');
    } else if (type === 'android_phone') {
      setName('Android Phone Live Feed');
      setRtspUrl('http://192.168.1.50:8080/video');
      setLocation('Mobile Surveillance Unit');
    }
  };

  // Vendor preset updater for IP CCTV and DVR
  const applyPreset = (vendor: string, ip: string, port: string, ch: string) => {
    setVendorPreset(vendor);
    if (selectedSourceType === 'ip_cctv') {
      switch (vendor) {
        case 'hikvision':
          setRtspUrl(`rtsp://admin:password@${ip}:${port}/Streaming/Channels/101`);
          break;
        case 'dahua':
          setRtspUrl(`rtsp://admin:password@${ip}:${port}/cam/realmonitor?channel=1&subtype=0`);
          break;
        case 'reolink':
          setRtspUrl(`rtsp://admin:password@${ip}:${port}/h264Preview_01_main`);
          break;
        case 'axis':
          setRtspUrl(`rtsp://root:password@${ip}:${port}/axis-media/media.amp`);
          break;
        default:
          setRtspUrl(`rtsp://${ip}:${port}/live/ch0`);
          break;
      }
    } else if (selectedSourceType === 'dvr_nvr') {
      switch (vendor) {
        case 'hikvision':
          setRtspUrl(`rtsp://admin:password@${ip}:${port}/Streaming/Channels/${ch}01`);
          break;
        case 'dahua':
          setRtspUrl(`rtsp://admin:password@${ip}:${port}/cam/realmonitor?channel=${ch}&subtype=0`);
          break;
        default:
          setRtspUrl(`rtsp://${ip}:${port}/ch0${ch}/0`);
          break;
      }
    }
  };

  const handleTestConnection = async () => {
    if (!rtspUrl.trim()) {
      setFormError('Please enter a camera stream URL or device index.');
      return;
    }
    setFormError(null);
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testCameraConnection(rtspUrl.trim(), name.trim() || 'Test Camera');
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        camera_name: name || 'Test Camera',
        source_type: selectedSourceType,
        status: 'connection_failed',
        stream_opened: false,
        frames_received: false,
        latency_ms: 0,
        success: false,
        message: err.message || 'Camera connection probe failed',
        error_message: err.message || 'Network timeout or unreachable endpoint',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rtspUrl.trim()) {
      setFormError('Camera label and endpoint/device index are required.');
      return;
    }
    setFormError(null);

    try {
      await createCamera({
        name: name.trim(),
        rtsp_url: rtspUrl.trim(),
        source_type: selectedSourceType,
        location: location.trim() || undefined,
      });
      setName('');
      setRtspUrl('');
      setLocation('');
      setTestResult(null);
      await loadCameras();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register camera endpoint');
    }
  };

  const handleTestSaved = async (cam: CameraItem) => {
    setActionBusy((prev) => ({ ...prev, [cam.id]: true }));
    try {
      const result = await testSavedCamera(cam.id);
      alert(
        result.success 
          ? `✓ ${result.camera_name} Connected Successfully!\nResolution: ${result.resolution}\nMeasured FPS: ${result.fps}\nLatency: ${result.latency_ms}ms`
          : `✗ Connection Failed for ${result.camera_name}\nStatus: ${result.status}\nError: ${result.error_message}`
      );
      await loadCameras();
    } catch (err: any) {
      alert(`Test failed: ${err.message}`);
    } finally {
      setActionBusy((prev) => ({ ...prev, [cam.id]: false }));
    }
  };

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

  const handleDeleteCamera = async (id: string) => {
    if (!confirm('Are you sure you want to remove this camera endpoint?')) return;
    try {
      await deleteCamera(id);
      await loadCameras();
    } catch (err: any) {
      alert(err.message || 'Failed to delete camera');
    }
  };

  const getStatusBadge = (status: string, isMonitored: boolean) => {
    if (isMonitored) {
      return (
        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
          <Activity className="w-3 h-3 mr-1 animate-pulse text-emerald-400" />
          <span>Monitoring Active</span>
        </span>
      );
    }
    switch (status) {
      case 'connected':
        return (
          <span className="bg-blue-500/20 text-blue-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
            <Wifi className="w-3 h-3 mr-1 text-blue-400" />
            <span>Connected (Idle)</span>
          </span>
        );
      case 'reconnecting':
        return (
          <span className="bg-amber-500/20 text-amber-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin text-amber-400" />
            <span>Reconnecting</span>
          </span>
        );
      case 'no_video_frames':
        return (
          <span className="bg-amber-500/20 text-amber-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" />
            <span>No Video Frames</span>
          </span>
        );
      case 'authentication_failed':
        return (
          <span className="bg-red-500/20 text-red-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
            <ShieldCheck className="w-3 h-3 mr-1 text-red-400" />
            <span>Auth Failed</span>
          </span>
        );
      case 'connection_failed':
        return (
          <span className="bg-red-500/20 text-red-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
            <WifiOff className="w-3 h-3 mr-1 text-red-400" />
            <span>Connection Failed</span>
          </span>
        );
      default:
        return (
          <span className="bg-slate-700 text-slate-300 text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center space-x-1">
            <WifiOff className="w-3 h-3 mr-1 text-slate-400" />
            <span>Disconnected</span>
          </span>
        );
    }
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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            Live CCTV Camera Connection & Diagnostics
          </h1>
          <p className="text-xs text-blue-400 font-semibold mt-0.5">
            Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Connect and verify Laptop Webcams, IP CCTV cameras, DVR/NVR channels, and Android phone feeds with real-time AI inference.
          </p>
        </div>
        <button
          onClick={loadCameras}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-command-panel hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border transition-colors self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
          <span>Refresh All Feeds</span>
        </button>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Source Type Tabs & Add Form */}
        <div className="bg-command-surface border border-command-border rounded-lg p-6 space-y-5">
          <div className="border-b border-command-border pb-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Configure Camera Source
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Select one of the 4 supported video stream source types:
            </p>
          </div>

          {/* Source Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleTabChange('webcam')}
              className={`p-2.5 rounded border flex items-center space-x-2 transition-colors text-left ${
                selectedSourceType === 'webcam'
                  ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                  : 'bg-command-panel border-command-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Laptop className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="block text-xs">Laptop Webcam</span>
                <span className="text-[10px] text-slate-400">Index 0, 1, 2</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('ip_cctv')}
              className={`p-2.5 rounded border flex items-center space-x-2 transition-colors text-left ${
                selectedSourceType === 'ip_cctv'
                  ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                  : 'bg-command-panel border-command-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="block text-xs">IP CCTV Camera</span>
                <span className="text-[10px] text-slate-400">RTSP Stream (554)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('dvr_nvr')}
              className={`p-2.5 rounded border flex items-center space-x-2 transition-colors text-left ${
                selectedSourceType === 'dvr_nvr'
                  ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                  : 'bg-command-panel border-command-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="block text-xs">DVR / NVR Channel</span>
                <span className="text-[10px] text-slate-400">Channel Streams</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('android_phone')}
              className={`p-2.5 rounded border flex items-center space-x-2 transition-colors text-left ${
                selectedSourceType === 'android_phone'
                  ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                  : 'bg-command-panel border-command-border text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="block text-xs">Android Phone</span>
                <span className="text-[10px] text-slate-400">Wi-Fi Stream App</span>
              </div>
            </button>
          </div>

          {/* Context Guidance Box */}
          {selectedSourceType === 'webcam' && (
            <div className="p-3 rounded bg-blue-950/20 border border-blue-800/40 text-[11px] text-blue-300 space-y-1">
              <span className="font-semibold block flex items-center gap-1.5 text-blue-200">
                <Info className="w-3.5 h-3.5 text-blue-400" /> Laptop Webcam Configuration
              </span>
              <p className="text-slate-400">
                Uses OpenCV DirectShow / MediaFoundation. Device index <code className="text-blue-300 bg-blue-950/60 px-1 rounded">0</code> targets your integrated laptop webcam. Device indices 1 or 2 target external USB cameras. The camera hardware is automatically released when monitoring stops.
              </p>
            </div>
          )}

          {selectedSourceType === 'ip_cctv' && (
            <div className="p-3 rounded bg-cyan-950/20 border border-cyan-800/40 text-[11px] text-cyan-300 space-y-1.5">
              <span className="font-semibold block flex items-center gap-1.5 text-cyan-200">
                <Info className="w-3.5 h-3.5 text-cyan-400" /> IP CCTV RTSP Configuration
              </span>
              <p className="text-slate-400">
                RTSP stream URLs vary by manufacturer. Use standard port 554. Passwords and credentials are masked across all logs and browser displays.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="text-[10px] text-slate-400 mr-1">Templates:</span>
                {['generic', 'hikvision', 'dahua', 'reolink', 'axis'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => applyPreset(v, cameraIp, cameraPort, channelNum)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                      vendorPreset === v 
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' 
                        : 'bg-command-bg border-command-border text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedSourceType === 'dvr_nvr' && (
            <div className="p-3 rounded bg-purple-950/20 border border-purple-800/40 text-[11px] text-purple-300 space-y-1.5">
              <span className="font-semibold block flex items-center gap-1.5 text-purple-200">
                <Info className="w-3.5 h-3.5 text-purple-400" /> DVR/NVR Channel Stream
              </span>
              <p className="text-slate-400">
                DVR/NVR systems expose individual camera channels via specific RTSP paths (e.g. Hikvision Channel 1 Main is <code className="text-purple-300 bg-purple-950/60 px-1 rounded">/Streaming/Channels/101</code>, Sub-stream is <code className="text-purple-300 bg-purple-950/60 px-1 rounded">102</code>).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[10px] text-slate-300">Channel #:</label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={channelNum}
                  onChange={(e) => {
                    setChannelNum(e.target.value);
                    applyPreset(vendorPreset, cameraIp, cameraPort, e.target.value);
                  }}
                  className="w-16 bg-command-bg border border-command-border rounded px-2 py-0.5 text-white font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => applyPreset('hikvision', cameraIp, cameraPort, channelNum)}
                  className="text-[10px] px-1.5 py-0.5 rounded border bg-command-bg border-command-border text-purple-300 hover:border-purple-400"
                >
                  Hikvision Path
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('dahua', cameraIp, cameraPort, channelNum)}
                  className="text-[10px] px-1.5 py-0.5 rounded border bg-command-bg border-command-border text-purple-300 hover:border-purple-400"
                >
                  Dahua Path
                </button>
              </div>
            </div>
          )}

          {selectedSourceType === 'android_phone' && (
            <div className="p-3 rounded bg-emerald-950/20 border border-emerald-800/40 text-[11px] text-emerald-300 space-y-2">
              <span className="font-semibold block flex items-center gap-1.5 text-emerald-200">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Android Phone Stream Instructions
              </span>
              <ol className="list-decimal list-inside text-slate-400 space-y-1 text-[10px]">
                <li>Connect your Android phone to the same Wi-Fi network as this PC.</li>
                <li>Install a streaming app such as <strong className="text-emerald-300">"IP Webcam"</strong> (by Pavel Khlebovich) or "RTSP Camera" from Google Play.</li>
                <li>Open the app, scroll to the bottom, and tap <strong className="text-emerald-300">"Start Server"</strong>.</li>
                <li>Enter the stream URL shown on your phone (e.g. <code className="text-emerald-300 bg-emerald-950/60 px-1 rounded">http://192.168.1.50:8080/video</code>).</li>
              </ol>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAddCamera} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Camera Label</label>
              <input
                type="text"
                placeholder="e.g. North Gate Entrance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-command-panel border border-command-border rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {selectedSourceType === 'webcam' ? 'Device Index' : 'Stream URL (RTSP / HTTP)'}
              </label>
              <input
                type="text"
                placeholder={
                  selectedSourceType === 'webcam'
                    ? '0 (default integrated webcam)'
                    : 'rtsp://user:pass@192.168.1.100:554/live or http://192.168.1.50:8080/video'
                }
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                className="w-full bg-command-panel border border-command-border rounded px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {selectedSourceType === 'webcam'
                  ? 'Enter 0 for built-in camera, 1 for external USB webcam.'
                  : 'Passwords in URLs are securely parsed by backend workers and masked in all UI views.'}
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Location Zone (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Security Command Post"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-command-panel border border-command-border rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Test Connection Probe Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !rtspUrl.trim()}
                className="w-full py-2 px-3 rounded bg-command-panel hover:bg-command-border text-slate-200 border border-command-border font-medium flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-amber-400' : 'text-blue-400'}`} />
                <span>{isTesting ? 'Probing Camera Feed...' : 'Test Connection & Decode Frames'}</span>
              </button>

              {/* Comprehensive Diagnostic Test Result Box */}
              {testResult && (
                <div className={`mt-3 p-3 rounded text-[11px] border space-y-2 ${
                  testResult.success 
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                    : 'bg-red-500/10 text-red-300 border-red-500/30'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className="font-bold text-xs uppercase tracking-wide">
                        {testResult.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {testResult.latency_ms}ms latency
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {testResult.message}
                  </p>

                  {/* Telemetry Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50 font-mono text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Stream Opened:</span>
                      <span className={testResult.stream_opened ? 'text-emerald-400' : 'text-red-400'}>
                        {testResult.stream_opened ? 'Yes (Socket OK)' : 'Failed'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Frames Decoded:</span>
                      <span className={testResult.frames_received ? 'text-emerald-400' : 'text-red-400'}>
                        {testResult.frames_received ? 'Yes (Video OK)' : 'No Frames Decoded'}
                      </span>
                    </div>
                    {testResult.resolution && (
                      <div>
                        <span className="text-slate-400 block">Resolution:</span>
                        <span className="text-slate-200">{testResult.resolution}</span>
                      </div>
                    )}
                    {testResult.fps && (
                      <div>
                        <span className="text-slate-400 block">Measured FPS:</span>
                        <span className="text-slate-200">{testResult.fps} FPS</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-red-500/10 text-red-300 text-[11px] border border-red-500/30">
                {formError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm shadow-blue-500/20 transition-colors"
            >
              Save Camera Endpoint
            </button>
          </form>
        </div>

        {/* Right Column: Configured Surveillance Endpoints */}
        <div className="lg:col-span-2 bg-command-surface border border-command-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-command-border pb-3">
            <div className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Configured Surveillance Endpoints ({cameras.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Credentials Masked
            </span>
          </div>

          {cameras.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Video className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Cameras Configured</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add an integrated laptop webcam (index 0), an RTSP CCTV camera, DVR channel, or Android phone stream to begin live surveillance.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cameras.map((cam) => {
                const isBusy = !!actionBusy[cam.id];
                return (
                  <div
                    key={cam.id}
                    className="bg-command-panel p-4 rounded-lg border border-command-border space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {getSourceIcon(cam.source_type)}
                          <span className="text-sm font-bold text-white">{cam.name}</span>
                          {getStatusBadge(cam.status, cam.monitoring_active)}
                        </div>

                        <p className="text-xs font-mono text-slate-400 truncate max-w-lg" title={cam.rtsp_url}>
                          Endpoint: {cam.rtsp_url}
                        </p>

                        <div className="flex items-center gap-4 text-[11px] text-slate-400">
                          {cam.location && (
                            <span>Zone: <strong className="text-slate-300">{cam.location}</strong></span>
                          )}
                          {cam.resolution && (
                            <span>Res: <strong className="text-slate-300">{cam.resolution}</strong></span>
                          )}
                          {cam.fps && (
                            <span>FPS: <strong className="text-slate-300">{cam.fps}</strong></span>
                          )}
                        </div>

                        {cam.last_error && (
                          <p className="text-[11px] text-red-400 flex items-center gap-1 pt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{cam.last_error}</span>
                          </p>
                        )}
                      </div>

                      {/* Control Actions */}
                      <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                        {/* Test Connection */}
                        <button
                          type="button"
                          onClick={() => handleTestSaved(cam)}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 rounded bg-command-bg hover:bg-command-border text-slate-300 text-xs font-medium border border-command-border flex items-center space-x-1 transition-colors disabled:opacity-50"
                          title="Run Connection Diagnostics"
                        >
                          <Activity className="w-3.5 h-3.5 text-blue-400" />
                          <span>Test</span>
                        </button>

                        {/* Start / Stop Monitoring */}
                        <button
                          type="button"
                          onClick={() => handleToggleMonitoring(cam)}
                          disabled={isBusy}
                          className={`px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50 ${
                            cam.monitoring_active
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {cam.monitoring_active ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop AI</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>Start AI</span>
                            </>
                          )}
                        </button>

                        {/* Live Stream Preview Modal */}
                        <button
                          type="button"
                          onClick={() => setPreviewCamera(cam)}
                          className="p-1.5 rounded bg-command-bg hover:bg-command-border text-slate-300 border border-command-border transition-colors"
                          title="View Live Stream Preview"
                        >
                          <Eye className="w-4 h-4 text-cyan-400" />
                        </button>

                        {/* Remove Camera */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCamera(cam.id)}
                          disabled={isBusy}
                          className="p-1.5 rounded bg-command-bg hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-command-border transition-colors"
                          title="Remove Camera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Stream Modal */}
      {previewCamera && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-command-surface border border-command-border rounded-lg max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-command-border bg-command-panel">
              <div className="flex items-center space-x-2">
                {getSourceIcon(previewCamera.source_type)}
                <h3 className="text-sm font-bold text-white">{previewCamera.name}</h3>
                <span className="text-[10px] font-mono text-slate-400">({previewCamera.rtsp_url})</span>
              </div>
              <button
                onClick={() => setPreviewCamera(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-black flex items-center justify-center min-h-[380px]">
              <img
                src={getCameraStreamUrl(previewCamera.id)}
                alt={previewCamera.name}
                className="max-h-[500px] w-auto rounded border border-command-border"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div className="p-3 bg-command-panel border-t border-command-border flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live MJPEG Stream Active
                </span>
                <span>YOLOv8n CPU Overlays Enabled</span>
              </div>
              <button
                onClick={() => setPreviewCamera(null)}
                className="px-3 py-1 rounded bg-command-border text-slate-200 text-xs font-medium"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

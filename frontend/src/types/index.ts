export interface SystemMetrics {
  cpu_percent: number;
  cpu_cores_physical: number;
  cpu_cores_logical: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_free_gb: number;
}

export interface StorageStatus {
  uploads_dir: string;
  uploads_writable: boolean;
  incidents_dir: string;
  incidents_writable: boolean;
  models_dir: string;
  models_writable: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'offline';
  app_name: string;
  environment: string;
  database_connected: boolean;
  database_type: string;
  uptime_seconds: number;
  system: SystemMetrics;
  storage: StorageStatus;
  active_cameras_count: number;
  active_jobs_count: number;
  unreviewed_incidents_count: number;
  version: string;
}

export interface IncidentSummary {
  total_incidents: number;
  unreviewed_count: number;
  acknowledged_count: number;
  reviewed_count: number;
  dismissed_count: number;
}

export interface EvidenceClipItem {
  id: string;
  duration_seconds: number;
  file_size_bytes: number;
  has_thumbnail: boolean;
}

export interface IncidentItem {
  id: string;
  source_type: string;
  source_id: string;
  source_name?: string;
  category: string;
  confidence: number;
  timestamp_start: number;
  timestamp_end: number;
  frame_index?: number;
  review_status: string;
  reviewer_notes: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  evidence_items?: EvidenceClipItem[];
  evidence_clips?: EvidenceClipItem[];
}

export interface EvidenceListItem {
  id: string;
  incident_id: string;
  incident_category: string;
  incident_confidence: number;
  review_status: string;
  source_type: string;
  source_id: string;
  source_name: string;
  timestamp_start: number;
  timestamp_end: number;
  duration_seconds: number;
  file_size_bytes: number;
  has_thumbnail: boolean;
  clip_exists: boolean;
  created_at: string;
}

export interface VideoJob {
  id: string;
  filename: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  activity_verdict?: 'normal' | 'suspicious' | 'analyzing' | 'failed' | 'cancelled' | string;
  progress: number;
  duration_seconds: number | null;
  fps: number | null;
  total_frames: number;
  processed_frames: number;
  people_detected: number; // Cumulative person bounding box detections
  unique_people?: number;  // Distinct tracked individuals across video
  current_people?: number; // Person count in current/latest frame
  events_classified: number;
  error_message: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface JobDetailResponse {
  job: VideoJob;
  incidents: IncidentItem[];
}

export interface CameraItem {
  id: string;
  name: string;
  rtsp_url: string;
  source_type: 'webcam' | 'ip_cctv' | 'dvr_nvr' | 'android_phone' | string;
  location?: string | null;
  is_active: boolean;
  monitoring_active: boolean;
  status: string;
  resolution?: string | null;
  fps?: string | null;
  last_error?: string | null;
  last_seen_at?: string | null;
  created_at: string;
}

export interface CameraTestResult {
  camera_name: string;
  source_type: string;
  status: 'not_tested' | 'connecting' | 'connected' | 'no_video_frames' | 'authentication_failed' | 'connection_failed' | 'disconnected';
  stream_opened: boolean;
  frames_received: boolean;
  resolution?: string | null;
  fps?: string | null;
  last_frame_time?: string | null;
  latency_ms: number;
  error_message?: string | null;
  success: boolean;
  message: string;
  stream_info?: {
    resolution: string;
    fps: string;
    latency_ms: number;
    last_frame_time?: string;
  } | null;
}

export interface CameraTelemetry {
  camera_id: string;
  name: string;
  source_type: string;
  status: string;
  is_running: boolean;
  ai_monitoring: boolean;
  resolution: string;
  fps: string;
  frames_received: number;
  frames_processed_ai: number;
  unique_people: number;
  current_people: number;
  incidents_detected: number;
  weapons_detected?: number;
  active_weapons?: Array<{
    track_id: number;
    class_name: string;
    confidence: number;
    is_confirmed: boolean;
    consecutive_frames: number;
    box: number[];
  }>;
  latest_weapon_alert?: string | null;
  last_frame_time: string | null;
  last_error: string | null;
  uptime_seconds: number;
  inference_status?: string;
  inference_time_ms?: number;
  latest_detections?: Array<{
    class_name: string;
    confidence: number;
    box: number[];
  }>;
}

export type NavTab = 
  | 'overview' 
  | 'live_monitoring' 
  | 'video_analysis' 
  | 'incident_center' 
  | 'weapon_validation'
  | 'evidence_library' 
  | 'camera_management' 
  | 'reports' 
  | 'settings';

export interface WeaponValidationStats {
  total_weapon_events: number;
  awaiting_review: number;
  reviewed_count: number;
  false_positive_count: number;
  acknowledged_count: number;
  class_breakdown: {
    gun: number;
    knife: number;
    explosive: number;
    other: number;
  };
  confidence_statistics: {
    average: number;
    min: number;
    max: number;
    distribution: {
      bucket_35_49: number;
      bucket_50_69: number;
      bucket_70_84: number;
      bucket_85_100: number;
    };
  };
  evidence_verification: {
    total_incidents_audited: number;
    evidence_available: number;
    evidence_missing: number;
    evidence_not_generated: number;
    evidence_playback_errors: number;
  };
  by_camera: Array<{
    source_id: string;
    source_type: string;
    source_name: string;
    total_events: number;
    awaiting_review: number;
    reviewed: number;
    false_positives: number;
    gun_count: number;
    knife_count: number;
    explosive_count?: number;
  }>;
  model_telemetry: {
    model_name: string;
    model_filename: string;
    inference_mode: string;
    supported_classes: string[];
    confidence_threshold: number;
    consecutive_confirmation_frames: number;
    average_latency_ms: number;
    stream_fps: number;
    accuracy_evaluated: boolean;
    accuracy_disclaimer: string;
  };
}

export interface WeaponValidationIncident {
  id: string;
  category: string;
  weapon_class: string;
  confidence: number;
  timestamp_start: number;
  timestamp_end: number;
  frame_index?: number;
  review_status: string;
  reviewer_notes: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  source_type: string;
  source_id: string;
  source_name: string;
  evidence: {
    id: string | null;
    status: 'available' | 'missing' | 'not_generated' | 'playback_error';
    clip_exists: boolean;
    thumbnail_exists: boolean;
    duration_seconds: number;
    file_size_bytes: number;
  };
}

export interface WeaponValidationIncidentsResponse {
  total: number;
  limit: number;
  offset: number;
  incidents: WeaponValidationIncident[];
}

export interface SystemSettings {
  sampling_rate_fps: number;
  confidence_threshold: number;
  weapon_confidence_threshold: number;
  weapon_consecutive_frames: number;
  event_cooldown_seconds: number;
  max_upload_size_mb: number;
  app_name: string;
  app_env: string;
  inference_device: string;
  model_name: string;
  weapon_model_name: string;
  database_engine: string;
  upload_dir: string;
  incident_dir: string;
  model_dir: string;
}

export interface SystemSettingsUpdate {
  sampling_rate_fps?: number;
  confidence_threshold?: number;
  weapon_confidence_threshold?: number;
  weapon_consecutive_frames?: number;
  event_cooldown_seconds?: number;
}

export type UserRole = 'admin' | 'analyst' | 'operator';

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  badgeId: string;
  department: string;
  loginTime: string;
}

export type { PermissionKey, RolePermissions } from '../services/permissions';




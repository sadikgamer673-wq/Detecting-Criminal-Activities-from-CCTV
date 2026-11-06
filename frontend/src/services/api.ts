import type { 
  HealthResponse, 
  VideoJob, 
  JobDetailResponse, 
  CameraItem, 
  CameraTestResult, 
  CameraTelemetry,
  IncidentItem,
  IncidentSummary,
  EvidenceListItem,
  WeaponValidationStats,
  WeaponValidationIncidentsResponse,
  SystemSettings,
  SystemSettingsUpdate
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface HealthResult {
  data: HealthResponse | null;
  latencyMs: number;
  error: string | null;
}

export async function fetchHealth(): Promise<HealthResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        data: null,
        latencyMs,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data: HealthResponse = await res.json();
    return {
      data,
      latencyMs,
      error: null,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      data: null,
      latencyMs,
      error: err.message || 'Failed to connect to backend server',
    };
  }
}

export async function uploadVideo(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/v1/videos/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.detail || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload'));
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

export async function fetchJobs(): Promise<VideoJob[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/videos/jobs`);
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchJobDetail(jobId: string): Promise<JobDetailResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/videos/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch job details (HTTP ${res.status})`);
  }
  return res.json();
}

export async function cancelJob(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/videos/jobs/${jobId}/cancel`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to cancel job (HTTP ${res.status})`);
  }
  return res.json();
}

export function getVideoStreamUrl(jobId: string): string {
  return `${API_BASE_URL}/api/v1/videos/${jobId}/stream`;
}

export function getEvidenceStreamUrl(evidenceId: string): string {
  return `${API_BASE_URL}/api/v1/incidents/evidence/${evidenceId}/stream`;
}

export function getEvidenceThumbnailUrl(evidenceId: string): string {
  return `${API_BASE_URL}/api/v1/incidents/evidence/${evidenceId}/thumbnail`;
}

// Incident APIs
export async function fetchIncidents(params?: {
  source_type?: string;
  review_status?: string;
  category?: string;
  limit?: number;
}): Promise<IncidentItem[]> {
  const query = new URLSearchParams();
  if (params?.source_type) query.set('source_type', params.source_type);
  if (params?.review_status) query.set('review_status', params.review_status);
  if (params?.category) query.set('category', params.category);
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch incidents (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchIncidentSummary(): Promise<IncidentSummary> {
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents/summary`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch incident summary (HTTP ${res.status})`);
  }
  return res.json();
}

export async function updateIncidentReview(
  incidentId: string,
  reviewStatus: string,
  reviewerNotes?: string
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${incidentId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      review_status: reviewStatus,
      reviewer_notes: reviewerNotes !== undefined ? reviewerNotes : undefined,
      reviewed_by: 'Security Officer'
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update incident review (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchEvidenceList(params?: {
  category?: string;
  source_type?: string;
}): Promise<EvidenceListItem[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.source_type) query.set('source_type', params.source_type);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents/evidence${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch evidence list (HTTP ${res.status})`);
  }
  return res.json();
}

// Camera APIs
export async function fetchCameras(): Promise<CameraItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras`);
  if (!res.ok) {
    throw new Error(`Failed to fetch cameras (HTTP ${res.status})`);
  }
  return res.json();
}

export async function createCamera(data: { name: string; rtsp_url: string; source_type?: string; location?: string }): Promise<CameraItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create camera (HTTP ${res.status})`);
  }
  return res.json();
}

export async function deleteCamera(cameraId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras/${cameraId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete camera (HTTP ${res.status})`);
  }
  return res.json();
}

export async function testCameraConnection(rtspUrl: string, cameraName?: string): Promise<CameraTestResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rtsp_url: rtspUrl, camera_name: cameraName || 'Test Feed' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Connection test request failed');
  }
  return res.json();
}

export async function testSavedCamera(cameraId: string): Promise<CameraTestResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras/${cameraId}/test`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Connection test request failed');
  }
  return res.json();
}

export async function startCameraMonitoring(cameraId: string, aiMonitoring: boolean = true): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras/${cameraId}/start-monitoring`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ai_monitoring: aiMonitoring }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to start monitoring (HTTP ${res.status})`);
  }
  return res.json();
}

export async function stopCameraMonitoring(cameraId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras/${cameraId}/stop-monitoring`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to stop monitoring (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchCameraTelemetry(cameraId: string): Promise<CameraTelemetry> {
  const res = await fetch(`${API_BASE_URL}/api/v1/cameras/${cameraId}/telemetry`);
  if (!res.ok) {
    throw new Error(`Failed to fetch camera telemetry (HTTP ${res.status})`);
  }
  return res.json();
}

export function getCameraStreamUrl(cameraId: string): string {
  return `${API_BASE_URL}/api/v1/cameras/${cameraId}/stream`;
}

export function getCameraSnapshotUrl(cameraId: string): string {
  return `${API_BASE_URL}/api/v1/cameras/${cameraId}/snapshot`;
}

export async function fetchWeaponValidationStats(
  cameraId?: string,
  sourceType?: string
): Promise<WeaponValidationStats> {
  const params = new URLSearchParams();
  if (cameraId && cameraId !== 'all') params.append('camera_id', cameraId);
  if (sourceType && sourceType !== 'all') params.append('source_type', sourceType);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents/weapon-validation/stats${queryStr}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch weapon validation statistics (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchWeaponValidationIncidents(params: {
  review_status?: string;
  weapon_class?: string;
  camera_id?: string;
  source_type?: string;
  evidence_status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<WeaponValidationIncidentsResponse> {
  const qp = new URLSearchParams();
  if (params.review_status && params.review_status !== 'all') qp.append('review_status', params.review_status);
  if (params.weapon_class && params.weapon_class !== 'all') qp.append('weapon_class', params.weapon_class);
  if (params.camera_id && params.camera_id !== 'all') qp.append('camera_id', params.camera_id);
  if (params.source_type && params.source_type !== 'all') qp.append('source_type', params.source_type);
  if (params.evidence_status && params.evidence_status !== 'all') qp.append('evidence_status', params.evidence_status);
  if (params.limit !== undefined) qp.append('limit', String(params.limit));
  if (params.offset !== undefined) qp.append('offset', String(params.offset));

  const queryStr = qp.toString() ? `?${qp.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents/weapon-validation/incidents${queryStr}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch weapon validation incidents (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings`);
  if (!res.ok) {
    throw new Error(`Failed to fetch system settings (HTTP ${res.status})`);
  }
  return res.json();
}

export async function updateSettings(settings: SystemSettingsUpdate): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.detail || `Failed to update settings (HTTP ${res.status})`);
  }
  return res.json();
}

export async function resetSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/api/v1/settings/reset`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reset settings (HTTP ${res.status})`);
  }
  return res.json();
}


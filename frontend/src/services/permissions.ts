import type { AuthUser, UserRole } from '../types';

export type PermissionKey =
  | 'view_live_monitoring'
  | 'control_camera_streams'
  | 'manage_cameras'
  | 'upload_videos'
  | 'review_incidents'
  | 'export_reports'
  | 'manage_settings'
  | 'manage_access_control';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: 'Live Operations' | 'Analysis & Forensics' | 'System Administration';
  defaultForAnalyst: boolean;
  defaultForOperator: boolean;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'view_live_monitoring',
    label: 'View Live Camera Feeds',
    description: 'Monitor real-time CCTV streams, occupancy telemetry, and person bounding boxes.',
    category: 'Live Operations',
    defaultForAnalyst: true,
    defaultForOperator: true,
  },
  {
    key: 'control_camera_streams',
    label: 'Start / Stop Stream Monitoring',
    description: 'Activate or pause live AI camera worker threads and RTSP stream ingestion.',
    category: 'Live Operations',
    defaultForAnalyst: false,
    defaultForOperator: true,
  },
  {
    key: 'manage_cameras',
    label: 'Configure & Delete Camera Endpoints',
    description: 'Add new RTSP/DVR endpoints, modify credentials, and delete camera channels.',
    category: 'Live Operations',
    defaultForAnalyst: false,
    defaultForOperator: false,
  },
  {
    key: 'upload_videos',
    label: 'Upload Forensic Videos for Batch Analysis',
    description: 'Upload local MP4/AVI surveillance recordings to queue AI batch classification.',
    category: 'Analysis & Forensics',
    defaultForAnalyst: true,
    defaultForOperator: false,
  },
  {
    key: 'review_incidents',
    label: 'Triage, Acknowledge & Dismiss Incidents',
    description: 'Modify incident status (Acknowledge, Review, False Positive) and record notes.',
    category: 'Analysis & Forensics',
    defaultForAnalyst: true,
    defaultForOperator: false,
  },
  {
    key: 'export_reports',
    label: 'Export Security Reports (CSV / JSON)',
    description: 'Download structured forensic threat records and print executive summary reports.',
    category: 'Analysis & Forensics',
    defaultForAnalyst: true,
    defaultForOperator: false,
  },
  {
    key: 'manage_settings',
    label: 'Modify AI Confidence & Sampling Settings',
    description: 'Tune CPU frame rates, person/weapon softmax thresholds, and event cooldowns.',
    category: 'System Administration',
    defaultForAnalyst: false,
    defaultForOperator: false,
  },
  {
    key: 'manage_access_control',
    label: 'Administer Role Permissions & Access Control',
    description: 'Grant or revoke permissions assigned to Analyst and Field Operator clearance tiers.',
    category: 'System Administration',
    defaultForAnalyst: false,
    defaultForOperator: false,
  },
];

export type RolePermissions = Record<UserRole, Record<PermissionKey, boolean>>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: {
    view_live_monitoring: true,
    control_camera_streams: true,
    manage_cameras: true,
    upload_videos: true,
    review_incidents: true,
    export_reports: true,
    manage_settings: true,
    manage_access_control: true,
  },
  analyst: {
    view_live_monitoring: true,
    control_camera_streams: false,
    manage_cameras: false,
    upload_videos: true,
    review_incidents: true,
    export_reports: true,
    manage_settings: false,
    manage_access_control: false,
  },
  operator: {
    view_live_monitoring: true,
    control_camera_streams: true,
    manage_cameras: false,
    upload_videos: false,
    review_incidents: false,
    export_reports: false,
    manage_settings: false,
    manage_access_control: false,
  },
};

const STORAGE_KEY = 'cctv_role_permissions_v1';

export function getRolePermissions(): RolePermissions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROLE_PERMISSIONS;
    const parsed = JSON.parse(raw);
    return {
      admin: { ...DEFAULT_ROLE_PERMISSIONS.admin, ...(parsed.admin || {}) },
      analyst: { ...DEFAULT_ROLE_PERMISSIONS.analyst, ...(parsed.analyst || {}) },
      operator: { ...DEFAULT_ROLE_PERMISSIONS.operator, ...(parsed.operator || {}) },
    };
  } catch {
    return DEFAULT_ROLE_PERMISSIONS;
  }
}

export function saveRolePermissions(permissions: RolePermissions): void {
  // Always guarantee admin retains full access
  const safePermissions: RolePermissions = {
    ...permissions,
    admin: { ...DEFAULT_ROLE_PERMISSIONS.admin },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safePermissions));
}

export function resetRolePermissions(): RolePermissions {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_ROLE_PERMISSIONS;
}

export function hasPermission(
  user: AuthUser | null,
  permission: PermissionKey,
  customPermissions?: RolePermissions
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const perms = customPermissions || getRolePermissions();
  const rolePerms = perms[user.role];
  if (!rolePerms) return false;

  return !!rolePerms[permission];
}

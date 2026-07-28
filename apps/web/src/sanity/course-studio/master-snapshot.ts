import type { AuthoringCourse } from './authoring-types';

export interface MasterSnapshot {
  course: AuthoringCourse;
  sourceCourseId: string;
  sourceRevision: string;
  sourceTitle: string;
  fingerprint: string;
}

function stableSnapshot(course: AuthoringCourse): Omit<MasterSnapshot, 'fingerprint'> {
  return {
    course,
    sourceCourseId: course._id,
    sourceRevision: course._rev,
    sourceTitle: course.title ?? 'Untitled course',
  };
}

export async function buildMasterSnapshot(course: AuthoringCourse): Promise<MasterSnapshot> {
  const snapshot = stableSnapshot(course);
  const encoded = new TextEncoder().encode(JSON.stringify(snapshot));
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  const fingerprint = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { ...snapshot, fingerprint };
}

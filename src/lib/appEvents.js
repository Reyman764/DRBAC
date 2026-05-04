const OPEN_TASK = 'karyasync:open-task';
const OPEN_PROFILE = 'karyasync:open-profile';
const PROFILE_UPDATED = 'karyasync:profile-updated';

export function emitOpenTask(taskId) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK, { detail: { taskId } }));
}

export function emitOpenProfile() {
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE));
}

export function emitProfileUpdated() {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED));
}

export function listenOpenTask(handler) {
  const fn = (e) => {
    const id = e.detail?.taskId;
    if (id) handler(id);
  };
  window.addEventListener(OPEN_TASK, fn);
  return () => window.removeEventListener(OPEN_TASK, fn);
}

export function listenOpenProfile(handler) {
  window.addEventListener(OPEN_PROFILE, handler);
  return () => window.removeEventListener(OPEN_PROFILE, handler);
}

export function listenProfileUpdated(handler) {
  window.addEventListener(PROFILE_UPDATED, handler);
  return () => window.removeEventListener(PROFILE_UPDATED, handler);
}

// Permission matching shared by the API (authoritative) and the UI (advisory, hides what the API would refuse).
// granted may be '*', 'domain.*' or an exact key. required is an exact key such as 'finance.read'.
export function permissionMatches(granted, required) {
  if (granted === '*') return true;
  if (granted === required) return true;
  if (typeof granted === 'string' && granted.endsWith('.*')) {
    const prefix = granted.slice(0, -1); // keeps the trailing dot: 'interns.'
    return required.startsWith(prefix);
  }
  return false;
}

export function hasGranted(grantedList = [], required) {
  return grantedList.some((g) => permissionMatches(g, required));
}

export function hasAnyGranted(grantedList = [], requiredList = []) {
  return requiredList.some((r) => hasGranted(grantedList, r));
}

export function normalizeMediaUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const isLocalHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0';
    if (!isLocalHost && typeof window !== 'undefined' && window.location.protocol === 'https:') {
      parsed.protocol = 'https:';
    }
    parsed.pathname = parsed.pathname
      .split('/')
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return parsed.toString();
  } catch {
    return trimmed.replace(/ /g, '%20');
  }
}

export const FALLBACK_POSTER = '/src/assets/images/cinema_hero_premiere_1795637611164.jpg';

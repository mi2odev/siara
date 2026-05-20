// Parses incoming deep links and QR-decoded strings into a pairing payload.
//
// The QR / link carries ONLY the short-lived pairing code; no tokens or
// secrets ever travel through this URL. The mobile app is expected to be
// signed in as the same SIARA user before completing the pairing.

const PAIRING_HOST = 'pair-device';

export function parsePairingUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Accept siara://pair-device?code=... AND https://*/m/pair?code=...
    // (the latter is reserved for future Universal Links). Both shapes carry
    // the code in a single query parameter named "code".
    const url = new URL(trimmed);
    const isSiaraScheme = url.protocol === 'siara:' && url.host === PAIRING_HOST;
    const isHttpsAlias = (url.protocol === 'https:' || url.protocol === 'http:')
      && /\/m\/pair\/?$/.test(url.pathname);
    if (!isSiaraScheme && !isHttpsAlias) return null;

    const code = (url.searchParams.get('code') || '').trim();
    if (!code) return null;

    return { code };
  } catch {
    return null;
  }
}

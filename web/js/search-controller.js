const HEX_CODE_PATTERN = /^[01]{6}$/;

export function moveSelection(currentIndex, key, length) {
  if (length <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowDown') return currentIndex < length - 1 ? currentIndex + 1 : 0;
  if (key === 'ArrowUp') return currentIndex > 0 ? currentIndex - 1 : length - 1;
  return currentIndex;
}

export function getHexCodeFromUrl(url) {
  try {
    const code = new URL(url).searchParams.get('hex');
    return HEX_CODE_PATTERN.test(code || '') ? code : null;
  } catch {
    return null;
  }
}

export function withHexCode(url, code) {
  const next = new URL(url);
  if (HEX_CODE_PATTERN.test(code || '')) {
    next.searchParams.set('hex', code);
    if (next.hash.startsWith('#lesson-')) next.hash = '';
  } else {
    next.searchParams.delete('hex');
    if (next.hash.startsWith('#detail-')) next.hash = '';
  }
  return next.toString();
}

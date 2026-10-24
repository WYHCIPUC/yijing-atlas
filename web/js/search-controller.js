const HEX_CODE_PATTERN = /^[01]{6}$/;

// 只解析明确语法；上下卦名称由调用方使用实际八卦资料解析为编码。
export function parseHexagramQuery(keyword) {
  if (typeof keyword !== 'string') return { kind: 'invalid' };
  const query = keyword.trim();
  if (!query) return { kind: 'empty' };
  if (HEX_CODE_PATTERN.test(query)) return { kind: 'code', code: query };
  const ordinal = /^第(\d+)卦$/.exec(query);
  if (/^\d+$/.test(query) || ordinal) {
    const digits = ordinal ? ordinal[1] : query;
    const number = Number(digits);
    return /^[1-9]\d?$/.test(digits) && number <= 64
      ? { kind: 'number', number } : { kind: 'invalid' };
  }
  const upperFirst = /^上(.)下(.)$/u.exec(query);
  if (upperFirst) return { kind: 'trigrams', lowerName: upperFirst[2], upperName: upperFirst[1] };
  const lowerFirst = /^下(.)上(.)$/u.exec(query);
  if (lowerFirst) return { kind: 'trigrams', lowerName: lowerFirst[1], upperName: lowerFirst[2] };
  return { kind: 'text', text: query.toLowerCase() };
}

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

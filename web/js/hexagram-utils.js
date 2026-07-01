// 卦象纯逻辑工具。所有运算基于 6 位二进制串（自下而上）。
// 这些函数是卦际关系学习与（后续）占筮解读的基础。

function validate(code) {
  if (!/^[01]{6}$/.test(code)) {
    throw new Error(`需要 6 位 0/1 串，得到: ${code}`);
  }
}

// 错卦（旁通卦）：每位取反。乾 111111 → 坤 000000。
export function oppositeCode(code) {
  validate(code);
  return code.split('').map((b) => (b === '1' ? '0' : '1')).join('');
}

// 综卦（反卦）：整体上下翻转（爻序倒置）。泰 111000 → 否 000111。
export function reversedCode(code) {
  validate(code);
  return code.split('').reverse().join('');
}

// 下卦（内卦）= 前 3 位（爻1-3）
export function lowerOf(code) {
  validate(code);
  return code.substring(0, 3);
}

// 上卦（外卦）= 后 3 位（爻4-6）
export function upperOf(code) {
  validate(code);
  return code.substring(3, 6);
}

// 由下上两卦合成 6 位串
export function combine(lower, upper) {
  return `${lower}${upper}`;
}

// 爻题：阳爻用"九"，阴爻用"六"，配位置名（初/二三四/五/上）。
// 初、上：位名+阴阳（初九、上六）；中位：阴阳+位名（九二、六五）。
export function yaoLabel(position, isYang) {
  const names = ['', '初', '二', '三', '四', '五', '上'];
  const yinYang = isYang ? '九' : '六';
  if (position === 1 || position === 6) {
    return `${names[position]}${yinYang}`;
  }
  return `${yinYang}${names[position]}`;
}

// 当位：阳爻居奇位(1,3,5)、阴爻居偶位(2,4,6)。
export function isCorrectPosition(position, isYang) {
  return isYang ? position % 2 === 1 : position % 2 === 0;
}

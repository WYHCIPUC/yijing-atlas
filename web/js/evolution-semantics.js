import { yaoLabel } from './hexagram-utils.js';

const SECTION_LABELS = {
  judgement: '卦辞',
  tuan: '彖传',
  image: '象传',
};

function requireHexagram(hexagram, label) {
  if (!hexagram || !/^[01]{6}$/.test(hexagram.binaryCode || '') || !hexagram.name) {
    throw new Error(`${label}不是有效卦象`);
  }
}

function requirePosition(position) {
  if (!Number.isInteger(position) || position < 1 || position > 6) {
    throw new Error(`爻位必须为 1-6，得到: ${position}`);
  }
}

export function classicalCitation(hexagram, section, position = null) {
  requireHexagram(hexagram, '引文所属');
  if (section === 'line' || section === 'lineImage') {
    requirePosition(position);
    const line = hexagram.lines?.[position - 1];
    const lineName = yaoLabel(position, Boolean(line?.isYang));
    return section === 'line'
      ? `《周易·${hexagram.name}卦·${lineName}》`
      : `《周易·象传·${hexagram.name}卦·${lineName}》`;
  }
  const label = SECTION_LABELS[section];
  if (!label) throw new Error(`未知经传分区: ${section}`);
  return section === 'judgement'
    ? `《周易·${hexagram.name}卦·${label}》`
    : `《周易·${label}·${hexagram.name}卦》`;
}

function lineMeaning(hexagram, position) {
  if (!hexagram || position == null) return null;
  requireHexagram(hexagram, '爻义所属');
  requirePosition(position);
  const line = hexagram.lines?.[position - 1];
  if (!line) return null;
  return {
    hexagramName: hexagram.name,
    label: yaoLabel(position, line.isYang),
    text: line.text || '',
    textCitation: classicalCitation(hexagram, 'line', position),
    image: line.xiang || '',
    imageCitation: classicalCitation(hexagram, 'lineImage', position),
    note: line.note || '',
  };
}

export function evolutionSemantics(currentHexagram, previousHexagram = null, changedPosition = null) {
  requireHexagram(currentHexagram, '当前');
  if (previousHexagram) requireHexagram(previousHexagram, '上一步');
  if (changedPosition != null) requirePosition(changedPosition);
  return {
    current: {
      name: currentHexagram.name,
      fullName: currentHexagram.fullName || currentHexagram.name,
      binaryCode: currentHexagram.binaryCode,
      scenario: currentHexagram.scenario || '',
      summary: currentHexagram.judgementNote || '',
      evidence: ['judgement', 'tuan', 'image'].map((section) => ({
        section,
        label: SECTION_LABELS[section],
        text: currentHexagram[section] || '',
        note: currentHexagram[`${section}Note`] || '',
        citation: classicalCitation(currentHexagram, section),
      })).filter((item) => item.text),
    },
    transition: changedPosition == null ? null : {
      position: changedPosition,
      before: lineMeaning(previousHexagram, changedPosition),
      after: lineMeaning(currentHexagram, changedPosition),
      disclaimer: '本步仅作卦象结构与经文对读，不等同于传统占筮断法。',
    },
    sourceNote: '经传原文为公版《周易》整理；白话说明为项目自撰，古籍标点与版本仍须持续校对。',
  };
}

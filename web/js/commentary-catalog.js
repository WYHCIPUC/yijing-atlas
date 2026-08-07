const CODE_PATTERN = /^[01]{6}$/;
const RECORD_STATUSES = new Set(['verified', 'not-applicable']);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRecord(record, path, reviewersPerRecord, errors) {
  if (!record || !RECORD_STATUSES.has(record.status)) {
    errors.push(`${path} 缺少有效 status`);
    return;
  }
  ['volume', 'locator', 'sourceUrl'].forEach((field) => {
    if (!nonEmpty(record[field])) errors.push(`${path}.${field} 不能为空`);
  });
  if (record.status === 'verified' && !nonEmpty(record.text)) errors.push(`${path}.text 不能为空`);
  if (record.status === 'not-applicable' && !nonEmpty(record.reason)) errors.push(`${path}.reason 不能为空`);
  const reviewers = Array.isArray(record.reviewers) ? new Set(record.reviewers.filter(nonEmpty)) : new Set();
  if (reviewers.size < reviewersPerRecord) errors.push(`${path} 校对者不足 ${reviewersPerRecord} 人`);
}

export function validateCommentaryCatalog(manifest, sources, documents = []) {
  const errors = [];
  const warnings = [];
  if (manifest?.schemaVersion !== 1) errors.push('manifest.schemaVersion 必须为 1');
  const requiredAuthorities = Array.isArray(manifest?.requiredAuthorities) ? manifest.requiredAuthorities : [];
  const requiredAnchors = Array.isArray(manifest?.requiredAnchors) ? manifest.requiredAnchors : [];
  const authorityList = Array.isArray(sources?.authorities) ? sources.authorities : [];
  const authorityIds = new Set(authorityList.map((item) => item.id));
  requiredAuthorities.forEach((id) => {
    if (!authorityIds.has(id)) errors.push(`缺少注家来源: ${id}`);
  });
  authorityList.forEach((source) => {
    ['id', 'author', 'dynasty', 'work', 'edition', 'editionStatus', 'digitalIndex'].forEach((field) => {
      if (!nonEmpty(source[field])) errors.push(`来源 ${source.id || '?'} 的 ${field} 不能为空`);
    });
  });
  if (!manifest?.releaseReady) {
    warnings.push('六家注疏尚未达到发布门禁，独立入口必须保持关闭');
    return { valid: errors.length === 0, canRelease: false, errors, warnings };
  }
  authorityList.forEach((source) => {
    if (requiredAuthorities.includes(source.id) && source.editionStatus !== 'verified') {
      errors.push(`来源 ${source.id} 的底本尚未完成校勘登记`);
    }
  });
  const byCode = new Map();
  documents.forEach((document) => {
    if (!CODE_PATTERN.test(document?.binaryCode || '')) errors.push('注疏文档含无效 binaryCode');
    else if (byCode.has(document.binaryCode)) errors.push(`重复卦码文档: ${document.binaryCode}`);
    else byCode.set(document.binaryCode, document);
  });
  for (let value = 0; value < 64; value += 1) {
    const code = value.toString(2).padStart(6, '0');
    const document = byCode.get(code);
    if (!document) {
      errors.push(`缺少卦象注疏文档: ${code}`);
      continue;
    }
    requiredAuthorities.forEach((authorityId) => {
      const anchors = document.authorities?.[authorityId]?.anchors;
      if (!anchors) {
        errors.push(`${code} 缺少注家 ${authorityId}`);
        return;
      }
      requiredAnchors.forEach((anchor) => {
        validateRecord(
          anchors[anchor],
          `${code}.${authorityId}.${anchor}`,
          manifest.reviewersPerRecord || 2,
          errors,
        );
      });
    });
  }
  return { valid: errors.length === 0, canRelease: errors.length === 0, errors, warnings };
}

function requireFragment(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty trusted HTML fragment`);
  }
  return value;
}

function requireAction(value, field) {
  const html = requireFragment(value, field);
  const control = html.trim().match(/^<(button|a)\b[^>]*>[\s\S]*<\/\1>$/i);
  const controls = html.match(/<\/?(?:button|a)\b[^>]*>/gi) || [];
  if (!control || controls.length !== 2) {
    throw new TypeError(`${field} must contain exactly one native button or link`);
  }
  return html;
}

/**
 * Render caller-owned, trusted template HTML in the shared feedback order.
 * Callers must escape all dynamic text before interpolation. This is not an
 * HTML sanitizer: never pass raw user text, model output or fetched HTML.
 * Each action is one complete native button/a template; existing attributes
 * are preserved for the caller to bind. Rendering does not save or focus.
 */
export function renderLearningFeedback(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('feedback must be an object');
  }
  const result = requireFragment(input.result, 'result');
  const basis = requireFragment(input.basis, 'basis');
  const changes = requireFragment(input.changes, 'changes');
  const primaryAction = requireAction(input.primaryAction, 'primaryAction');
  const secondaryActions = input.secondaryActions === undefined ? [] : input.secondaryActions;
  if (!Array.isArray(secondaryActions)) throw new TypeError('secondaryActions must be an array');
  if (secondaryActions.length > 2) throw new RangeError('secondaryActions allows at most two actions');
  const secondary = Array.from(secondaryActions, (action, index) => requireAction(action, `secondaryActions[${index}]`));
  const actions = `<div class="learning-feedback-actions">
      <div data-feedback-action="primary">${primaryAction}</div>
      ${secondary.map(action => `<div data-feedback-action="secondary">${action}</div>`).join('\n')}
    </div>`;
  return `<div class="learning-feedback">
    <section class="learning-feedback-section" data-feedback-section="result"><h3>本次结果</h3>${result}</section>
    <section class="learning-feedback-section" data-feedback-section="basis"><h3>判断依据</h3>${basis}</section>
    <section class="learning-feedback-section" data-feedback-section="changes"><h3>学习记录</h3>${changes}</section>
    <section class="learning-feedback-section" data-feedback-section="actions"><h3>下一步</h3>${actions}</section>
  </div>`;
}

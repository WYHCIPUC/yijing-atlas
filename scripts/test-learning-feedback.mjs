import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLearningQuestionBank, getLesson } from '../web/js/learning-curriculum.js';
import { applyProgressEvent, createAchievementState, createProgressEvent, isAchievementState } from '../web/js/achievement-engine.js';

const scenarioNames = ['review-card-retry', 'review-activity-retry', 'review-achievement-retry', 'review-leave',
  'oral-self-record-retry', 'oral-self-activity-retry', 'oral-ai-save-retry', 'oral-ai-stale-course',
  'oral-ai-stale-edit', 'oral-ai-stale-leave', 'assessment-result', 'assessment-save-retry', 'quiz-result', 'quiz-save-retry', 'divination-result', 'divination-save-retry',
  'meihua-number-result', 'meihua-number-save-retry', 'meihua-time-result', 'meihua-time-save-retry'];
const representativeNames = ['quiz-save-retry', 'assessment-save-retry', 'oral-self-record-retry',
  'review-card-retry', 'meihua-number-save-retry'];
const allScopes = [...[1440, 390].flatMap(width => scenarioNames.map(name => `${width}-${name}`)), '320-quiz-save-retry',
  ...[1280, 768].flatMap(width => representativeNames.map(name => `${width}-${name}`))];
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Usage: node scripts/test-learning-feedback.mjs [--scope NAME] [--output DIR] [--browser PATH] [--list]
Run only after source freeze. --scope is an exact name; omission runs all ${allScopes.length} scopes.
Each process uses a new synthetic browser profile and random-port local server. No business functions or DOM.click are invoked.
All business actions use CDP Input. Data/read/quota faults and synthetic Fetch replies are explicitly logged.
Checks automatic feedback visibility BEFORE locator scrolling. Evidence: trace.json, run.log, screenshots, source hashes and exitCode.
BROWSER_PATH is the fallback browser override. --output must be a new directory (existing evidence is never overwritten).
Recommended first scope: 1440-oral-self-record-retry. --list prints all independent scopes.
390 includes CDP touch; quiz-result also inspects 320 CSS px after a result.
1280x720 mouse and 768x1024 CDP touch each cover five representative feedback/retry flows, not the entire scenario set.
320-quiz-save-retry starts at 320 CSS px before navigation and checks initial failure visibility before any probe scroll.
divination-save-retry combines write failure, then same-key read denial with writes restored, then recovery of the original submission.
meihua-number/time scopes select the actual tab and controls; numbers use keyboard events, time uses the existing simplified time button.
Both methods check the first cast focus before locator scrolling, then four-part result or the same-event write/read recovery flow.
Oral self/AI save scenarios also return to the current course after success and after abandoning a failed save.
Course navigation may save legitimate reading progress; oral records and AI request counts must remain unchanged.
Snapshots use the saved native getItem only for evidence; application reads still hit the explicit read fault.
These are not real-device, screen-reader or native 200% zoom evidence.`);
  process.exit(0);
}
if (args.includes('--list')) { console.log(allScopes.join('\n')); process.exit(0); }
const options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--scope', '--output', '--browser'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--'), `Invalid argument: ${args[i]}`);
  assert.equal(options[args[i]], undefined, `Repeated argument: ${args[i]}`); options[args[i]] = args[i + 1];
}
assert.ok(!options['--scope'] || allScopes.includes(options['--scope']), 'Unknown --scope; use --list.');
const root = fileURLToPath(new URL('../', import.meta.url));
// Node-side public-data lookup only; never invoke the browser's assessment functions.
const publicData = Object.fromEntries([['hexagrams', 'hexagrams'], ['trigrams', 'trigrams'], ['wings', 'wings'],
  ['theorems', 'theorems'], ['almanacTerms', 'almanac-terms']].map(([key, file]) =>
  [key, JSON.parse(readFileSync(join(root, `web/data/${file}.json`), 'utf8'))]));
const publicQuestions = buildLearningQuestionBank(publicData);
const browserPath = [options['--browser'], process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
assert.ok(browserPath, 'Set --browser or BROWSER_PATH to an installed Chromium executable.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(options['--output'] || join(root, 'docs/development/evidence/2026-10-25-learning-feedback-input', stamp));
assert.equal(existsSync(output), false, 'Refusing to overwrite an existing evidence directory.');
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(join(realpathSync(tmpdir()), 'yijing-learning-feedback-'));
const keys = { card: 'yijing-review-cards', record: 'yijing-learning-record-v2', activity: 'yijing-activity-v1',
  achievement: 'yijing.achievements.v1', stats: 'yijing-quiz-stats', legacy: 'yijing-quiz-wrong',
  config: 'yijing-learning-review-config-v1', history: 'yijing-divination-history-v2' };
const storageKeys = [...Object.values(keys), 'yijing.study.v1', 'yijing-divination-history-v1'];
const observedFiles = ['web/index.html', 'web/js/main.js', 'web/js/learning-feedback.js', 'web/js/review-session.js',
  'web/js/review-engine.js', 'web/js/learning-progress.js', 'web/js/learning-review.js', 'web/js/learning-assessment.js',
  'web/js/learning-assessment-page.js', 'web/js/modes/learning-mode.js', 'web/js/modes/review-mode.js',
  'web/js/modes/quiz-mode.js', 'web/js/modes/divination-mode.js', 'web/js/quiz-session.js', 'web/js/quiz-engine.js',
  'web/js/achievement-engine.js', 'web/js/achievement-storage.js', 'web/js/divination-history.js',
  'web/js/meihua-engine.js', 'web/js/divination-interpretation.js',
  'web/js/learning-curriculum.js', 'web/styles/main.css', 'web/styles/immersive.css', 'web/data/hexagrams.json',
  'web/data/trigrams.json', 'web/data/wings.json', 'web/data/theorems.json', 'web/data/almanac-terms.json',
  'web/sw.js', 'scripts/serve.mjs', 'scripts/test-learning-feedback.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
let head;
try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { head = null; }
const report = { startedAt: new Date().toISOString(), command: ['node', 'scripts/test-learning-feedback.mjs', ...args],
  head, node: process.version, uv: process.versions.uv, browserPath, profile, output, scope: options['--scope'] || 'all',
  sourceHashes: hashes(), status: 'running', scenarios: [], limitations: [
    'Synthetic isolated profile and origin; no existing user data, private text or authenticated service is accessed.',
    'Desktop headless Chromium / CDP touch and CSS viewport checks only; no physical device, screen reader or native browser zoom proof.',
    'Storage fixtures/read/quota faults and Fetch replies are deliberate test injections. No DOM.click or browser application function is invoked.',
    'Evidence snapshots bypass injected reads through saved native getItem; application reads use the patched prototype and can throw.',
    'Input actions use actual hit coordinates or keyboard focus. Locator scrollIntoView is allowed only after automatic result visibility capture.',
    'AI replies are synthetic and intercepted before network dispatch. This does not validate a deployed backend or real model quality.',
    'Oral drafts and pending retries are page-memory only. Leaving a page does not promise persistence of an unsaved submission.',
    '1280x720 and 768x1024 cover five representative feedback/retry flows only. Meihua time has the same result renderer; its distinct time-button entry is covered at 1440/390, not additionally claimed at these two representative viewports.',
  ] };
const saveTrace = () => writeFileSync(join(output, 'trace.json'), `${JSON.stringify(report, null, 2)}\n`);
const log = message => { console.log(message); appendFileSync(join(output, 'run.log'), `${message}\n`); };
const pause = ms => new Promise(done => setTimeout(done, ms));
async function waitFor(check, message, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await check()) return; await pause(25); }
  throw new Error(message);
}
async function freePort() {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(done => socket.close(done)); return port;
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill(); await Promise.race([once(child, 'exit'), pause(3000)]);
}
class Client {
  constructor(url) {
    this.socket = new WebSocket(url); this.nextId = 0; this.pending = new Map(); this.events = [];
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) { this.events.push(message); this.onEvent?.(message); return; }
      const request = this.pending.get(message.id); if (!request) return;
      clearTimeout(request.timer); this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
    });
  }
  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((done, reject) => { this.socket.addEventListener('open', done, { once: true }); this.socket.addEventListener('error', reject, { once: true }); });
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolveRequest, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 25000);
      this.pending.set(id, { resolve: resolveRequest, reject, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
}
let client, server, browser, siteUrl, current, observerFailure;
let cleanupStarted = false;
let touchInput = false;
const probe = `(() => {
  const storage = localStorage, originalSet = Storage.prototype.setItem, originalRemove = Storage.prototype.removeItem, originalGet = Storage.prototype.getItem;
  const p = window.__feedbackProbe = { storage, originalSet, originalRemove, originalGet, blocked: [], readBlocked: [], reads: [], writes: [], inputs: [] };
  Storage.prototype.getItem = function(key) {
    if (this !== storage || !${JSON.stringify(storageKeys)}.includes(key)) return originalGet.call(this, key);
    const readable = !p.readBlocked.includes(key);
    p.reads.push({ key, readable, at: performance.now() });
    if (!readable) throw new DOMException('Explicit synthetic feedback read fault', 'SecurityError');
    return originalGet.call(this, key);
  };
  Storage.prototype.setItem = function(key, value) {
    if (this !== storage || !${JSON.stringify(storageKeys)}.includes(key)) return originalSet.call(this, key, value);
    const saved = !p.blocked.includes(key); let parsed; try { parsed = JSON.parse(value); } catch { parsed = String(value); }
    p.writes.push({ key, saved, at: performance.now(), value: parsed });
    if (!saved) throw new DOMException('Explicit synthetic feedback quota fault', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
  for (const type of ['click', 'keydown', 'input', 'change', 'submit', 'touchstart', 'touchend']) document.addEventListener(type, event => {
    p.inputs.push({ type, trusted: event.isTrusted, key: event.key, at: performance.now(), x: event.clientX, y: event.clientY,
      target: event.target.id || event.target.name || event.target.className || event.target.tagName,
      action: event.target.closest?.('[data-action]')?.dataset.action });
  }, true);
})();`;
async function snapshot() {
  return client.evaluate(`(() => { const p=window.__feedbackProbe; return {
    data:Object.fromEntries(Object.entries(${JSON.stringify(keys)}).map(([name,key])=>[name,JSON.parse(p.originalGet.call(p.storage,key)||'null')])),
    raw:Object.fromEntries(Object.entries(${JSON.stringify(keys)}).map(([name,key])=>[name,p.originalGet.call(p.storage,key)])),
    reads:p.reads,writes:p.writes,inputs:p.inputs,mode:document.body.dataset.activeMode,
    focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id,action:document.activeElement?.dataset.action},
    oralText:document.querySelector('.oral-review-output')?.innerText,oralLesson:document.querySelector('[data-field="oral-lesson"]')?.value,
    aiDisabled:document.querySelector('[data-action="ai-review"]')?.disabled,
    feedback:[...document.querySelectorAll('.learning-feedback')].map(node=>node.innerText)
  }; })()`);
}
async function checkpoint(label) { const state = await snapshot(); current.checks.push({ label, state }); saveTrace(); return state; }
const count = (state, key, saved = true) => state.writes.filter(item => item.key === key && item.saved === saved).length;
const oralEntries = state => state.data.record?.oralReviews || [];
async function settled() {
  await waitFor(() => client.evaluate(`(async()=>{
    if(document.body.classList.contains('mode-transitioning')||document.querySelector('#detail-panel')?.getAttribute('aria-busy')==='true')return false;
    if(document.getAnimations().some(a=>(a.pending||a.playState==='running')&&a.effect?.getTiming().iterations!==Infinity&&a.effect?.target?.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true})))return false;
    const panel=document.querySelector('#detail-panel'),top=panel?.scrollTop;
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));return top===panel?.scrollTop;
  })()`), 'Finite animations/scroll did not settle');
}
async function screenshot(label, stabilize = true) {
  if (stabilize) await settled();
  const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const name = `${current.name}-${label}.png`; writeFileSync(join(output, name), Buffer.from(result.data, 'base64'));
  current.screenshots.push(name); saveTrace();
}
async function geometry(selector) {
  return client.evaluate(`(() => {const element=document.querySelector(${JSON.stringify(selector)});if(!element)return null;
    const r=element.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
    for(let parent=element.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
      const s=getComputedStyle(parent),b=parent.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}
      if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}
    }
    const x=(Math.max(r.left,clip.left)+Math.min(r.right,clip.right))/2,y=(Math.max(r.top,clip.top)+Math.min(r.bottom,clip.bottom))/2;
    const hit=document.elementFromPoint(x,y),visible=element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!element.closest('[inert]');
    return {rect:r.toJSON(),clip,text:element.innerText,visible:visible&&Math.min(r.right,clip.right)>Math.max(r.left,clip.left)&&Math.min(r.bottom,clip.bottom)>Math.max(r.top,clip.top),
      full:visible&&r.width>0&&r.height>0&&r.left>=clip.left-1&&r.right<=clip.right+1&&r.top>=clip.top-1&&r.bottom<=clip.bottom+1,
      hit:!!hit&&(hit===element||element.contains(hit)),disabled:element.disabled};})()`);
}
async function pointFor(selector, allowDisabled = false) {
  let point;
  await waitFor(async () => {
    point = await client.evaluate(`(async()=>{const element=document.querySelector(${JSON.stringify(selector)});
      if(!element?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||element.closest('[inert]')||(${!allowDisabled}&&element.disabled))return null;
      const hit=()=>{const r=element.getBoundingClientRect(),p={x:r.left+r.width/2,y:r.top+r.height/2},target=document.elementFromPoint(p.x,p.y);
        return r.width>0&&r.height>0&&(target===element||element.contains(target))?p:null;};
      if(!hit()){element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});return null;}
      const before=element.getBoundingClientRect();await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const after=element.getBoundingClientRect();return ['x','y','width','height'].every(key=>Math.abs(before[key]-after[key])<.5)?hit():null;
    })()`); return point;
  }, `Cannot reach input ${selector}`); return point;
}
async function inputAt(point, label) {
  const hit = await client.evaluate(`(()=>{const e=document.elementFromPoint(${point.x},${point.y});return {tag:e?.tagName,id:e?.id,action:e?.closest('[data-action]')?.dataset.action};})()`);
  current.inputs.push({ kind: touchInput ? 'touch' : 'mouse', label, ...point, hit }); saveTrace();
  if (touchInput) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
  }
}
async function click(selector, allowDisabled = false) { await inputAt(await pointFor(selector, allowDisabled), selector); }
async function key(keyName, modifiers = 0) {
  const code = { ' ': 'Space', a: 'KeyA' }[keyName] || keyName;
  const windowsVirtualKeyCode = { Tab: 9, Enter: 13, Escape: 27, Backspace: 8, Home: 36, ArrowDown: 40, a: 65, ' ': 32 }[keyName];
  current.inputs.push({ kind: 'keyboard', key: keyName, modifiers });
  await client.send('Input.dispatchKeyEvent', { type: keyName === 'Enter' ? 'keyDown' : 'rawKeyDown', key: keyName, code, modifiers,
    windowsVirtualKeyCode, ...(keyName === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, modifiers, windowsVirtualKeyCode });
}
async function keyboardActivate(selector) {
  for (let i = 0; i < 120; i++) {
    if (await client.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`)) { await key('Enter'); return; }
    await key('Tab');
  }
  throw new Error(`Tab cannot reach ${selector}`);
}
async function fill(selector, text) {
  await click(selector);
  assert.equal(await client.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`), true, 'Input focus must be confirmed before Ctrl+A');
  await key('a', 2); await key('Backspace');
  current.inputs.push({ kind: 'text', selector, synthetic: true, characters: text.length });
  await client.send('Input.insertText', { text });
  assert.equal(await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`), text);
}
async function fresh() {
  const before = await client.evaluate('performance.timeOrigin');
  await client.send('Page.navigate', { url: `${siteUrl}?feedback-probe=${current.name}` });
  await waitFor(() => client.evaluate(`performance.timeOrigin!==${before}&&document.querySelector('#loading')?.hidden===true&&!!window.__feedbackProbe`), 'Application did not initialize', 30000);
}
async function dismissWelcome() {
  if (await client.evaluate('!document.querySelector("#daily-overlay")?.hidden&&!document.querySelector("#daily-overlay")?.classList.contains("hidden")')) await click('[data-entry="explore"]');
}
async function leave(keyboard = false) {
  if (!await client.evaluate('document.querySelector("#detail-panel")?.classList.contains("open")')) return;
  if (keyboard) await key('Escape'); else await click('#detail-close');
  await waitFor(() => client.evaluate('!document.querySelector("#detail-panel")?.classList.contains("open")'), 'Panel did not close');
}
async function goMode(mode) {
  if (await client.evaluate('document.querySelector("#detail-panel")?.getAttribute("aria-modal")==="true"&&document.querySelector("#detail-panel")?.classList.contains("open")')) await leave();
  await click(`.mode-btn[data-mode="${mode}"]`);
  const selector = mode === 'review' ? '.review-panel, .review-card-panel' : `.${mode === 'divination' ? 'divine' : mode}-panel`;
  await waitFor(() => client.evaluate(`!!document.querySelector(${JSON.stringify(selector)})&&!document.body.classList.contains('mode-transitioning')`), `${mode} did not open`);
}
async function fixture(values = {}) {
  await dismissWelcome(); await leave();
  await client.evaluate(`(()=>{const p=window.__feedbackProbe;for(const name of ${JSON.stringify(storageKeys)})p.originalRemove.call(p.storage,name);
    for(const [name,value]of Object.entries(${JSON.stringify(values)}))p.originalSet.call(p.storage,name,JSON.stringify(value));
    sessionStorage.setItem('yijing-daily-seen','1');})()`);
  current.fixtures.push({ at: new Date().toISOString(), values }); await fresh(); await dismissWelcome();
}
async function block(parts) {
  const blocked = parts.map(part => keys[part]);
  current.faults.push({ operation: 'setItem', storageKeys: blocked, at: new Date().toISOString(), synthetic: true });
  await client.evaluate(`window.__feedbackProbe.blocked=${JSON.stringify(blocked)}`); saveTrace();
}
async function blockReads(parts) {
  const blocked = parts.map(part => keys[part]);
  current.faults.push({ operation: 'getItem', storageKeys: blocked, at: new Date().toISOString(), synthetic: true });
  await client.evaluate(`window.__feedbackProbe.readBlocked=${JSON.stringify(blocked)}`); saveTrace();
}
// This check intentionally NEVER scrolls. It records the application's own reveal/focus result.
async function inspectFeedback(container, statusSelector, failed = false) {
  await waitFor(() => client.evaluate(`document.querySelector(${JSON.stringify(container)})?.querySelectorAll('[data-feedback-section]').length===4`), `Four feedback sections missing in ${container}`);
  await settled();
  const structure = await client.evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(container)}),actions=root.querySelector('[data-feedback-section="actions"]');
    const active=document.activeElement,r=active?.getBoundingClientRect(),hit=r&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {sections:[...root.querySelectorAll('[data-feedback-section]')].map(e=>e.dataset.feedbackSection),
      primary:actions.querySelectorAll('[data-feedback-action="primary"]').length,secondary:actions.querySelectorAll('[data-feedback-action="secondary"]').length,
      wholeLive:root.closest('[aria-live]:not([aria-live="off"])')?.getAttribute('aria-live')||null,
      focus:{tag:active?.tagName,action:active?.dataset.action,inside:root.contains(active),visible:active?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!active.closest('[inert]')&&!active.disabled,
        hit:!!hit&&(hit===active||active.contains(hit)),rect:r?.toJSON()},selection:String(getSelection())};})()`);
  const result = await geometry(`${container} [data-feedback-section="result"]`);
  const status = await geometry(statusSelector);
  const primary = await geometry(`${container} [data-feedback-action="primary"] button`);
  const retrySelector = container === '.quiz-feedback' ? '[data-action="quiz-retry"]'
    : container === '.review-feedback' ? '[data-action="review-retry"]'
      : container === '.assessment-result' ? '[data-action="retry-save"]'
        : container === '.divine-analysis-feedback' ? '.divine-analysis-retry' : '[data-action="oral-retry-save"]';
  const retry = failed ? await geometry(`${container} ${retrySelector}`) : null;
  current.checks.push({ label: 'automatic-feedback-before-locator-scroll', container, failed, structure, result, status, primary, retry });
  await screenshot(`automatic-${current.screenshots.length}`, false);
  assert.deepEqual(structure.sections, ['result', 'basis', 'changes', 'actions']);
  assert.equal(structure.primary, 1); assert.ok(structure.secondary <= 2); assert.equal(structure.wholeLive, null);
  assert.equal(structure.selection, '', 'Unexpected page text selection must not pollute screenshots');
  assert.ok(structure.focus.inside, 'Automatic focus must belong to the current feedback result');
  assert.ok(structure.focus.visible && structure.focus.hit && !['BODY', 'HTML'].includes(structure.focus.tag), 'Automatic focus is detached, hidden, disabled or outside the visible viewport');
  if (container === '.oral-review-output') {
    const provenance = await client.evaluate(`(()=>{const section=document.querySelector('.oral-review-output [data-feedback-section="basis"]'),notice=section?.querySelector('p:last-child');
      if(!notice)return null;return {text:notice.textContent,rect:notice.getBoundingClientRect().toJSON(),container:section.getBoundingClientRect().toJSON(),
        scrollWidth:notice.scrollWidth,clientWidth:notice.clientWidth,display:getComputedStyle(notice).display,whiteSpace:getComputedStyle(notice).whiteSpace};})()`);
    current.checks.push({ label: 'oral-source-notice-horizontal-fit', provenance }); saveTrace();
    assert.ok(provenance?.text.includes('待核对'), 'Result must retain its source verification notice');
    assert.ok(provenance.rect.left >= provenance.container.left - 1 && provenance.rect.right <= provenance.container.right + 1 && provenance.scrollWidth <= provenance.clientWidth + 1,
      'The oral source notice overflows its reading column');
  }
  if (failed) {
    assert.ok(status?.full && status.hit, 'Save failure status is not readable without probe scrolling');
    assert.ok(retry?.full && retry.hit, 'Save retry action is not visible without probe scrolling');
  }
  else assert.ok((result?.visible && result.hit) || (status?.full && status.hit), 'Result/save feedback is outside the viewport before probe scrolling');
}
async function openAssessment() {
  await goMode('learning'); await click('[data-section-target="assessment"]');
  await waitFor(() => client.evaluate('!!document.querySelector("[data-field=oral-response]")'), 'Assessment hub did not open');
}
const reviewCard = { code: '111111', stage: 2, due: 100, introducedAt: 1, lapses: 0, reps: 2, lastReview: 50 };
async function reviewRetry(part) {
  await fixture({ [keys.card]: { '111111': reviewCard } }); await goMode('review');
  await click('.flip-card'); await block([part]);
  await click('[data-rate="2"]'); await inspectFeedback('.review-feedback', '.review-storage-status', true);
  const failed = await checkpoint('failed');
  assert.equal(count(failed, keys[part], false), 1);
  if (part === 'card') {
    assert.deepEqual(failed.data.card['111111'], reviewCard);
    assert.equal(count(failed, keys.activity), 0); assert.equal(count(failed, keys.achievement), 0);
  } else assert.equal(failed.data.card['111111'].reps, reviewCard.reps + 1);
  await click('[data-rate="1"]', true);
  const duplicate = await checkpoint('disabled-rating-repeat'); assert.deepEqual(duplicate.writes, failed.writes);
  await block([]); await click('[data-action="review-retry"]');
  await inspectFeedback('.review-feedback', '.review-storage-status');
  const saved = await checkpoint('saved'); assert.equal(saved.data.card['111111'].reps, reviewCard.reps + 1);
  assert.equal(count(saved, keys.card), 1);
  for (const name of ['activity', 'achievement']) assert.equal(count(saved, keys[name]), 1);
  if (part !== 'card') assert.deepEqual(saved.data.card, failed.data.card, 'Retry must retain original due/stage/time');
  const beforeSource = JSON.stringify(saved.writes);
  await click('[data-action="review-source"]'); await waitFor(() => client.evaluate('document.activeElement?.id==="review-answer"'), 'Review source did not receive focus');
  await click('[data-action="review-feedback-return"]');
  assert.equal(JSON.stringify((await snapshot()).writes), beforeSource, 'Source/re-display cannot save again');
  await keyboardActivate('[data-action="review-queue"]');
  await waitFor(() => client.evaluate('!!document.querySelector(".review-empty")'), 'Completed last card must return to an empty due queue');
  await screenshot('queue-after-last');
}
async function reviewLeave() {
  await fixture({ [keys.card]: { '111111': reviewCard } }); await goMode('review'); await click('.flip-card');
  await block(['card']); await click('[data-rate="0"]'); await inspectFeedback('.review-feedback', '.review-storage-status', true);
  const before = await checkpoint('before-leave'); await leave(true); await block([]); await goMode('learning'); await settled();
  const after = await checkpoint('after-leave'); assert.deepEqual(after.data.card, before.data.card);
  assert.deepEqual(after.writes, before.writes, 'Leaving cannot save the abandoned rating');
  await goMode('review'); assert.equal(await client.evaluate('document.querySelector(".flip-card")?.getAttribute("aria-expanded")'), 'false');
  await screenshot('fresh-card-no-old-feedback');
}
async function oralSelf(part) {
  await fixture(); await openAssessment(); await click('[data-action="self-review"]'); await block([part]);
  await click('[data-score="80"]'); await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]', true);
  const failed = await checkpoint('oral-self-failed'); assert.equal(oralEntries(failed).length, part === 'record' ? 0 : 1);
  const successfulPart = part === 'record' ? 'activity' : 'record', successfulCount = count(failed, keys[successfulPart]);
  await block([]); await click('[data-action="oral-retry-save"]');
  await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]');
  const saved = await checkpoint('oral-self-saved'); assert.equal(oralEntries(saved).length, 1); assert.equal(oralEntries(saved)[0].mode, 'self');
  assert.equal(count(saved, keys[successfulPart]), successfulCount); assert.equal(current.requests.length, 0);
  assert.equal(saved.focus.action, 'oral-new');
  await oralSource(saved, 'oral-self-saved-source', !touchInput);
  await reopenAssessmentFromCourse(); await chooseSecondOralLesson();
  await click('[data-action="self-review"]'); await block([part]); await click('[data-score="60"]');
  await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]', true);
  const abandoned = await checkpoint('oral-self-before-source-with-save-failure');
  assert.equal(oralEntries(abandoned).length, part === 'record' ? 1 : 2);
  await oralSource(abandoned, 'oral-self-failed-source', touchInput);
  await block([]); await settled();
  assert.deepEqual(oralEntries(await checkpoint('oral-self-source-after-storage-recovery')), oralEntries(abandoned));
  await leave(true);
}
async function chooseSecondOralLesson() {
  await click('[data-field="oral-lesson"]'); await key('Home'); await key('ArrowDown'); await key('Enter');
  await waitFor(() => client.evaluate('document.querySelector("[data-field=oral-lesson]")?.selectedIndex===1'), 'Second oral course was not selected');
}
async function reopenAssessmentFromCourse() {
  await click('.lesson-back');
  await waitFor(() => client.evaluate('!document.querySelector(".lesson-workspace")&&!document.querySelector(".learning-panel.lesson-active")'), 'Course switch action did not return to the course list');
  await click('.learning-tab[data-section="profile"]'); await click('[data-section-target="assessment"]');
  await waitFor(() => client.evaluate('!!document.querySelector("[data-field=oral-response]")'), 'Profile assessment entry did not open');
}
async function oralSource(before, label, keyboard = false) {
  const lesson = getLesson(before.oralLesson), requestCount = current.requests.length;
  assert.ok(lesson, 'The result must refer to a real current course');
  const basis = await client.evaluate('document.querySelector(".oral-review-output [data-feedback-section=basis]")?.innerText');
  assert.ok(basis?.includes(lesson.title)); assert.match(basis, /项目课程要点/); assert.match(basis, /待核对/);
  const selector = '.oral-review-output [data-action="oral-source"]';
  if (keyboard) await keyboardActivate(selector); else await click(selector);
  await waitFor(() => client.evaluate('!!document.querySelector("#learning-content .lesson-workspace [data-page-heading]")&&!document.querySelector(".oral-review-output")'), 'Oral source did not enter a course');
  await settled();
  const course = await client.evaluate(`({
    title:document.querySelector('#learning-content .lesson-workspace [data-page-heading]')?.textContent.trim(),
    pathSelected:!!document.querySelector('.learning-tab[data-section="path"][aria-selected="true"]'),
    labelledBy:document.querySelector('#learning-content')?.getAttribute('aria-labelledby'),
    lessonActive:!!document.querySelector('.learning-panel.lesson-active'),
  })`);
  current.checks.push({ label, expectedLessonId: lesson.id, expectedTitle: lesson.title, course, keyboard });
  assert.ok(course.title?.includes(lesson.title), 'Source must open the submitted course, not another course');
  assert.equal(course.pathSelected, true); assert.equal(course.labelledBy, 'learning-tab-path'); assert.equal(course.lessonActive, true);
  const heading = await geometry('#learning-content .lesson-workspace [data-page-heading]');
  current.checks.push({ label: `${label}-heading`, heading });
  assert.ok(heading?.visible && heading.hit, 'The source course heading must be visible after navigation');
  const after = await checkpoint(label);
  assert.deepEqual(oralEntries(after), oralEntries(before), 'Course navigation cannot append or repair an oral review');
  assert.equal(current.requests.length, requestCount, 'Course navigation cannot repeat an AI request');
  const newWrites = after.writes.slice(before.writes.length).filter(item => item.key === keys.record);
  for (const write of newWrites) assert.deepEqual(write.value?.oralReviews || [], oralEntries(before), 'Even a failed course write must not include an abandoned oral result');
  await screenshot(label);
}
const oralText = '这是合成的公开课程复讲输入，仅用于隔离环境的交互与保存验证。';
const oralInput = '[data-field="oral-response"]';
async function startAi(text = oralText) {
  await fill(oralInput, text); const before = current.requests.length; await click('[data-action="ai-review"]');
  await waitFor(() => current.requests.length > before, 'Synthetic AI request was not intercepted');
  const request = current.requests.at(-1); assert.equal(request.method, 'POST'); assert.equal(request.payload.schemaVersion, 1);
  assert.equal(request.payload.response, text.trim()); return request;
}
async function fulfill(request, { score = 82, status = 200, summary = `合成评阅 ${request.number}` } = {}) {
  assert.equal(request.completed, undefined, 'Each paused request must be fulfilled once');
  const payload = { score, summary, strengths: ['概念清楚'], improvements: ['补充出处'] };
  request.reply = { status, payload }; saveTrace();
  await client.send('Fetch.fulfillRequest', { requestId: request.id, responseCode: status,
    responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') });
  await waitFor(() => client.events.some(event => event.method === 'Network.loadingFinished' && event.params.requestId === request.networkId), 'Fulfilled synthetic request did not finish');
  await client.evaluate('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))'); request.completed = true; saveTrace();
}
async function oralAiSave() {
  await fixture({ [keys.config]: { endpoint: '/api/learning-review' } }); await openAssessment();
  await fill(oralInput, '甲'.repeat(19)); await click('[data-action="ai-review"]');
  await waitFor(() => client.evaluate('document.querySelector(".oral-review-output")?.textContent.includes("20")'), '19-character boundary did not show validation');
  assert.equal(current.requests.length, 0); assert.equal(oralEntries(await snapshot()).length, 0);
  await block(['record', 'activity']); const request = await startAi('甲'.repeat(20)); await fulfill(request);
  await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]', true);
  const failed = await checkpoint('ai-save-failed'); assert.equal(oralEntries(failed).length, 0);
  await block([]); await click('[data-action="oral-retry-save"]');
  await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]');
  const saved = await checkpoint('ai-save-retry'); assert.equal(oralEntries(saved).length, 1); assert.equal(oralEntries(saved)[0].mode, 'ai');
  assert.equal(current.requests.length, 1, 'Save-only retry must not POST again'); assert.equal(count(saved, keys.record), 1); assert.equal(count(saved, keys.activity), 1);
  await oralSource(saved, 'oral-ai-saved-source');
  await reopenAssessmentFromCourse(); await chooseSecondOralLesson(); await block(['record', 'activity']);
  const abandonedRequest = await startAi(`${oralText}这轮保存失败后主动回原课。`); await fulfill(abandonedRequest);
  await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]', true);
  const abandoned = await checkpoint('oral-ai-before-source-with-save-failure');
  assert.equal(abandoned.oralLesson, abandonedRequest.payload.lesson.id); assert.equal(oralEntries(abandoned).length, 1);
  assert.equal(current.requests.length, 2, 'Only the explicitly started second review may add a POST');
  await oralSource(abandoned, 'oral-ai-failed-source', true); await block([]);
  await settled(); assert.deepEqual(oralEntries(await checkpoint('oral-ai-source-after-storage-recovery')), oralEntries(abandoned));
}
async function oralStale(kind) {
  await fixture({ [keys.config]: { endpoint: '/api/learning-review' } }); await openAssessment();
  const old = await startAi(), before = await checkpoint('old-request-pending');
  if (kind === 'leave') {
    await leave(true); await goMode('quiz'); await fulfill(old);
    const after = await checkpoint('late-after-leave'); assert.deepEqual(after.writes, before.writes); assert.equal(oralEntries(after).length, 0);
    assert.equal(await client.evaluate('!!document.querySelector(".quiz-panel")&&!document.querySelector(".oral-review-output")'), true);
    await screenshot('late-result-stayed-on-quiz'); return;
  }
  if (kind === 'course') {
    await click('[data-field="oral-lesson"]'); await key('Home'); await key('ArrowDown'); await key('Enter');
    assert.notEqual((await snapshot()).oralLesson, old.payload.lesson.id);
  } else await fill(oralInput, `${oralText}这是新一轮输入。`);
  const number = current.requests.length; await click('[data-action="ai-review"]');
  await waitFor(() => current.requests.length > number, 'New oral session did not start'); const freshRequest = current.requests.at(-1);
  await fulfill(old, kind === 'course' ? { status: 503 } : { summary: '不可出现的旧合成评阅' });
  const late = await checkpoint('old-finished-new-pending');
  assert.equal(late.aiDisabled, true, 'Old finally must not unlock the new pending request');
  assert.equal(oralEntries(late).length, 0); assert.deepEqual(late.writes, before.writes);
  assert.equal(late.oralText.includes('不可出现的旧合成评阅'), false); assert.equal(late.oralText.includes('已切换为本地'), false);
  await fulfill(freshRequest, { score: 91, summary: '当前会话合成评阅' });
  await inspectFeedback('.oral-review-output', '.oral-review-output [data-feedback-section="changes"] [role="status"]');
  const saved = await checkpoint('new-session-only'); assert.equal(oralEntries(saved).length, 1);
  assert.equal(oralEntries(saved)[0].lessonId, freshRequest.payload.lesson.id); assert.equal(oralEntries(saved)[0].score, 91);
}
async function assessmentResult() {
  await fixture(); await openAssessment(); await click('[data-action="lesson-quiz"]');
  await waitFor(() => client.evaluate('!!document.querySelector(".assessment-form")'), 'Course quiz did not start');
  const countQuestions = await client.evaluate('document.querySelectorAll(".assessment-question").length'); assert.ok(countQuestions > 0);
  for (let i = 0; i < countQuestions; i++) await click(`.assessment-question:nth-of-type(${i + 1}) .assessment-options label:first-child`);
  await click('.assessment-form [type="submit"]'); await inspectFeedback('.assessment-result', '.assessment-save-status');
  const before = await checkpoint('assessment-result'); await keyboardActivate('.assessment-result [data-action="back"]');
  await waitFor(() => client.evaluate('!!document.querySelector("[data-field=oral-response]")'), 'Keyboard return did not reach assessment hub');
  assert.deepEqual((await snapshot()).writes, before.writes, 'Returning cannot submit the assessment again');
}
async function assessmentSaveRetry() {
  await fixture(); await openAssessment(); await click('[data-action="exam"]');
  await waitFor(() => client.evaluate('document.querySelectorAll(".assessment-question").length===10'), 'Ten-question stage assessment did not start');
  const questions = await client.evaluate(`[...document.querySelectorAll('.assessment-question')].map(field=>({
    prompt:field.querySelector('legend').textContent.replace(/^\\s*\\d+\\s*/, '').trim(),
    labels:[...field.querySelectorAll('.assessment-options label span')].map(e=>e.textContent.trim())}))`);
  for (const [index, item] of questions.entries()) {
    const original = publicQuestions.find(question => question.prompt === item.prompt);
    assert.ok(original, 'Visible question must match current public question-bank data');
    const wrong = original.options.find(option => option.value !== original.answer);
    const optionIndex = item.labels.indexOf(wrong.label.trim()); assert.ok(optionIndex >= 0, 'Public wrong option must be visible');
    await click(`.assessment-question:nth-of-type(${index + 1}) .assessment-options label:nth-child(${optionIndex + 1})`);
  }
  await block(['record']); await click('.assessment-form [type="submit"]');
  await inspectFeedback('.assessment-result', '.assessment-save-status', true);
  assert.match(await client.evaluate('document.querySelector(".assessment-result [data-feedback-section=result]").innerText'), /0\/10/);
  const failed = await checkpoint('long-assessment-failed'); assert.equal(failed.data.record?.exams?.length || 0, 0);
  await block([]); await click('[data-action="retry-save"]'); await inspectFeedback('.assessment-result', '.assessment-save-status');
  const saved = await checkpoint('long-assessment-saved'); assert.equal(saved.data.record.exams.length, 1);
  assert.equal(saved.data.record.exams[0].correct, 0); assert.equal(saved.data.record.exams[0].total, 10);
  await keyboardActivate('.assessment-result [data-action="back"]');
  assert.deepEqual((await snapshot()).writes, saved.writes);
}
async function narrowFeedback(container) {
  await client.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true }); await settled();
  const widths = await client.evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(container)});return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
    root:root.getBoundingClientRect().toJSON(),scrollWidth:root.scrollWidth,clientWidth:root.clientWidth};})()`);
  current.checks.push({ label: '320-css-width-not-browser-zoom', widths }); saveTrace();
  assert.ok(widths.documentWidth <= 321 && widths.scrollWidth <= widths.clientWidth + 1);
  const selectors = await client.evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(container)});return [...root.querySelectorAll('[data-feedback-section="actions"] button')].filter(e=>!e.hidden&&!e.disabled).map(e=>e.dataset.action?'[data-action="'+e.dataset.action+'"]':'.quiz-next');})()`);
  for (const selector of selectors) {
    current.checks.push({ label: '320-action-before-keyboard-navigation', selector, geometry: await geometry(selector) }); saveTrace();
    const isFocused = () => client.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`);
    // A resized viewport can clip the already-focused control. Tab away and back
    // so native keyboard navigation, rather than a center-only hit probe, reveals it.
    if (await isFocused()) await key('Tab');
    let focused = false;
    for (let index = 0; index < 120; index++) {
      if (await isFocused()) { focused = true; break; }
      await key('Tab');
    }
    await settled();
    const item = await geometry(selector);
    current.checks.push({ label: '320-action-reachable', via: 'trusted-Tab-navigation', selector, focused, geometry: item }); saveTrace();
    assert.ok(focused && item?.full && item.hit, `320px keyboard navigation must fully reveal ${selector}`);
  }
  await screenshot('320-actions'); await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await settled();
}
async function quizResult(fail = false) {
  const reference = { sourceKind: 'quiz', questionId: 'quiz:opposite:111111', questionVersion: 'quiz-v1', questionType: 'opposite', targetCode: '111111', termId: null, lessonId: null };
  const at = '2026-10-24T08:00:00Z';
  const weak = { ...reference, status: 'due', firstWrongAt: at, lastWrongAt: at, lastSessionId: 'synthetic-feedback-wrong', wrongCount: 1, lastReviewedAt: null, resolvedAt: null };
  await fixture({ [keys.record]: { version: 2, lessons: {}, spotChecks: [], exams: [], oralReviews: [], weakQuestions: { [reference.questionId]: weak } } });
  await goMode('review'); await click('[data-action="quiz-practice-0"]');
  await waitFor(() => client.evaluate(`document.querySelectorAll('.quiz-panel .quiz-option:not(:disabled)').length === 4 && document.querySelector('#detail-panel')?.getAttribute('aria-busy') !== 'true' && !document.body.classList.contains('mode-transitioning')`), 'Exact quiz options did not finish loading');
  if (fail) await block(['stats', 'record', 'card', 'activity', 'achievement']);
  const picked = fail ? await client.evaluate(`[...document.querySelectorAll('.quiz-option')].find(option => option.dataset.code !== '000000')?.dataset.code`) : '000000';
  assert.match(picked || '', /^[01]{6}$/, 'Choose a rendered distractor rather than assuming a random candidate');
  await click(`.quiz-option[data-code="${picked}"]`);
  await inspectFeedback('.quiz-feedback', '.quiz-feedback-status', fail);
  if (current.viewport.width === 320) {
    const widths = await client.evaluate(`(()=>{const root=document.querySelector('.quiz-feedback');return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
      scrollWidth:root.scrollWidth,clientWidth:root.clientWidth};})()`);
    current.checks.push({ label: 'initial-320-failure-before-probe-scroll', widths }); saveTrace();
    assert.equal(widths.width, 320);
    assert.ok(widths.documentWidth <= 321 && widths.scrollWidth <= widths.clientWidth + 1);
  }
  if (fail) {
    await checkpoint('quiz-partial-failed'); await block([]); await click('[data-action="quiz-retry"]');
    await inspectFeedback('.quiz-feedback', '.quiz-feedback-status');
    const saved = await checkpoint('quiz-retry-saved'); assert.equal(saved.data.stats.total, 1);
    assert.equal(saved.data.record.weakQuestions[reference.questionId].wrongCount, 2);
  } else assert.match(await client.evaluate('document.querySelector(".quiz-feedback").innerText'), /单次答对.*不.*掌握/);
  if (current.viewport.width === 390) await narrowFeedback('.quiz-feedback');
  await keyboardActivate('[data-action="quiz-review"]'); await waitFor(() => client.evaluate('!!document.querySelector(".review-panel")'), 'Quiz did not return to the queue');
}
async function fillNumber(selector, digits) {
  assert.match(digits, /^[0-9]+$/);
  await click(selector);
  assert.equal(await client.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`), true);
  await key('a', 2); await key('Backspace');
  for (const digit of digits) {
    current.inputs.push({ kind: 'keyboard', key: digit, selector, synthetic: true });
    const input = { key: digit, code: `Digit${digit}`, windowsVirtualKeyCode: 48 + Number(digit) };
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...input, text: digit, unmodifiedText: digit });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...input });
  }
  assert.equal(await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`), digits);
}
async function castDivination(method) {
  assert.ok(['coin', 'number', 'time'].includes(method));
  await goMode('divination');
  if (method === 'coin') await click('.coin-cast');
  else {
    await click('#divine-tab-meihua');
    await waitFor(() => client.evaluate(`document.querySelector('#divine-tab-meihua')?.getAttribute('aria-selected')==='true'&&
      document.querySelector('#divine-body')?.getAttribute('aria-labelledby')==='divine-tab-meihua'&&!!document.querySelector('.mh-cast')`), 'Meihua tab did not activate');
    if (method === 'number') {
      await fillNumber('.mh-upper', '17'); await fillNumber('.mh-lower', '29');
      await click('.mh-cast');
    } else await click('.mh-time');
  }
  await waitFor(() => client.evaluate('!!document.querySelector(".divine-analysis-submit")'), `${method} result did not render`);
  if (method !== 'coin') {
    // Record the product's first cast reveal before the checkbox locator is allowed to scroll.
    await settled();
    const selector = '.mh-result .divine-interpretation-heading h3';
    const heading = await geometry(selector);
    const focusMatches = await client.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`);
    const first = await checkpoint(`meihua-${method}-initial-cast-before-probe-scroll`);
    current.checks.push({ label: 'automatic-meihua-cast-before-locator-scroll', method, heading, focusMatches });
    await screenshot('automatic-meihua-cast', false);
    assert.ok(heading?.full && heading.hit && focusMatches, 'Initial Meihua result heading/focus must be readable without probe scrolling');
    assert.equal(first.data.history?.length, 1);
    assert.equal(first.data.history[0].type, 'meihua'); assert.equal(first.data.history[0].method, method);
    assert.equal(first.data.history[0].cast.method, method);
    if (method === 'number') assert.equal(first.data.history[0].cast.source, '上数 17，下数 29');
    else assert.match(first.data.history[0].cast.source, /^\d+年\d+月\d+日 .* 时辰\d+$/);
    assert.equal(count(first, keys.history), 1, 'One real cast must create exactly one history record');
  }
}
async function divinationResult(method = 'coin') {
  await fixture(); await castDivination(method);
  const before = await checkpoint('divination-cast-before-self-assessment');
  await click('[data-analysis-dimension="identification"]'); await click('[data-analysis-dimension="citation"]');
  await click('.divine-analysis-submit'); await inspectFeedback('.divine-analysis-feedback', '.divine-analysis-status');
  const saved = await checkpoint('divination-result'); assert.ok(saved.feedback.some(text => /自评/.test(text)));
  assert.equal(count(saved, keys.achievement), 1);
  assert.equal(saved.data.achievement.processedKeys.length, 1);
  assert.equal(Object.values(saved.data.achievement.metrics.analyses)[0].totalScore, 40);
  assert.deepEqual(saved.data.history, before.data.history); assert.deepEqual(saved.data.activity, before.data.activity);
  await click('.divine-analysis-submit', true);
  assert.deepEqual((await snapshot()).writes, saved.writes, 'A repeated disabled submit cannot record the result again');
  await leave(true); assert.deepEqual((await snapshot()).writes, saved.writes, 'Leaving interpretation cannot repeat its saved evidence');
}
async function divinationSaveRetry(method = 'coin') {
  // Construct only synthetic prior evidence in Node; application submissions still use real Input.
  const occurredAt = '2026-10-24T01:00:00.000Z';
  let previous = createAchievementState();
  for (const event of [
    { type: 'hexagram.read', subjectId: '111111', outcome: 'completed', occurredAt,
      idempotencyKey: 'prior:reading:111111', metadata: { deep: true } },
    { type: 'divination.analysis.submitted', subjectId: 'synthetic-prior-analysis', outcome: 'completed', occurredAt,
      idempotencyKey: 'prior:analysis:synthetic', metadata: { totalScore: 60, cited: true,
        dimensions: { identification: 20, imagery: 20, citation: 20, reasoning: 0, boundary: 0 } } },
  ]) previous = applyProgressEvent(previous, createProgressEvent(event), { now: () => new Date(occurredAt) }).state;
  assert.ok(isAchievementState(previous), 'Prior synthetic achievement fixture must satisfy the real schema');
  await fixture({ [keys.achievement]: previous }); await castDivination(method);
  await click('[data-analysis-dimension="identification"]'); await click('[data-analysis-dimension="citation"]');
  const before = await checkpoint('divination-prior-record-before-submit');
  assert.deepEqual(before.data.achievement, previous);
  await block(['achievement']); await click('.divine-analysis-submit');
  const writeFailed = await checkpoint('divination-write-failed');
  await inspectFeedback('.divine-analysis-feedback', '.divine-analysis-status', true);
  assert.equal(count(writeFailed, keys.achievement), count(before, keys.achievement));
  assert.equal(count(writeFailed, keys.achievement, false), count(before, keys.achievement, false) + 1);
  assert.equal(writeFailed.raw.achievement, before.raw.achievement, 'Quota failure must retain the original achievement bytes');
  const attempted = writeFailed.writes.filter(item => item.key === keys.achievement && !item.saved).at(-1).value;
  const addedKeys = attempted.processedKeys.filter(value => !previous.processedKeys.includes(value));
  const addedSubjects = Object.keys(attempted.metrics.analyses).filter(value => !Object.hasOwn(previous.metrics.analyses, value));
  assert.equal(addedKeys.length, 1); assert.equal(addedSubjects.length, 1);
  const subject = addedSubjects[0], locked = attempted.metrics.analyses[subject];
  assert.equal(addedKeys[0], `divination-analysis:${subject}`); assert.equal(locked.totalScore, 40);
  current.checks.push({ label: 'original-divination-submission-locked', subject, processedKey: addedKeys[0], analysis: locked }); saveTrace();
  await block([]); await blockReads(['achievement']); await click('.divine-analysis-retry');
  const readFailed = await checkpoint('divination-read-denied-write-restored');
  await inspectFeedback('.divine-analysis-feedback', '.divine-analysis-status', true);
  assert.ok(readFailed.reads.some(item => item.key === keys.achievement && !item.readable), 'Application must actually encounter the injected read failure');
  assert.equal(readFailed.writes.length, writeFailed.writes.length, 'Unreadable old state must prevent every replacement write');
  assert.equal(count(readFailed, keys.achievement), 0, 'Restoring writes must not allow a fallback empty state to overwrite evidence');
  assert.equal(readFailed.raw.achievement, before.raw.achievement, 'Read failure must retain original bytes and processed keys');
  await blockReads([]); await click('.divine-analysis-retry');
  const saved = await checkpoint('divination-read-restored-original-submission-saved');
  await inspectFeedback('.divine-analysis-feedback', '.divine-analysis-status');
  assert.equal(count(saved, keys.achievement), 1, 'Only the original submission may be saved once');
  assert.deepEqual(saved.data.achievement.metrics.hexagramsRead, previous.metrics.hexagramsRead);
  for (const [id, analysis] of Object.entries(previous.metrics.analyses)) assert.deepEqual(saved.data.achievement.metrics.analyses[id], analysis);
  assert.deepEqual(saved.data.achievement.metrics.analyses[subject], locked, 'Retry must retain the original score, dimensions and timestamp');
  assert.deepEqual(saved.data.achievement.processedKeys, [...previous.processedKeys, addedKeys[0]]);
  assert.deepEqual(saved.data.history, before.data.history); assert.deepEqual(saved.data.activity, before.data.activity);
  assert.equal(await client.evaluate('!!document.querySelector(".divine-analysis-retry")'), false);
  await click('.divine-analysis-submit', true);
  assert.deepEqual((await snapshot()).writes, saved.writes, 'A repeated disabled submit cannot write again');
  await keyboardActivate('.divine-analysis-view-basis');
  await waitFor(() => client.evaluate('document.activeElement?.matches(".divine-reading-details summary")'), 'Basis action did not focus the existing reading source');
  await leave(true); assert.deepEqual((await snapshot()).writes, saved.writes, 'Source and leave must not resubmit the saved event');
}
const actions = { 'review-card-retry': () => reviewRetry('card'), 'review-activity-retry': () => reviewRetry('activity'),
  'review-achievement-retry': () => reviewRetry('achievement'), 'review-leave': reviewLeave,
  'oral-self-record-retry': () => oralSelf('record'), 'oral-self-activity-retry': () => oralSelf('activity'),
  'oral-ai-save-retry': oralAiSave, 'oral-ai-stale-course': () => oralStale('course'), 'oral-ai-stale-edit': () => oralStale('edit'),
  'oral-ai-stale-leave': () => oralStale('leave'), 'assessment-result': assessmentResult, 'assessment-save-retry': assessmentSaveRetry,
  'quiz-result': () => quizResult(), 'quiz-save-retry': () => quizResult(true), 'divination-result': divinationResult,
  'divination-save-retry': divinationSaveRetry,
  'meihua-number-result': () => divinationResult('number'), 'meihua-number-save-retry': () => divinationSaveRetry('number'),
  'meihua-time-result': () => divinationResult('time'), 'meihua-time-save-retry': () => divinationSaveRetry('time') };
async function runScenario(name) {
  const [widthText, ...parts] = name.split('-'); const width = Number(widthText), action = actions[parts.join('-')];
  const height = width === 1280 ? 720 : width <= 390 ? 844 : 1024;
  touchInput = width <= 768;
  current = { name, viewport: { width, height }, inputMode: touchInput ? 'touch' : 'mouse', emulatedMobile: touchInput,
    status: 'running', inputs: [], checks: [], requests: [], fixtures: [], faults: [], screenshots: [] };
  report.scenarios.push(current); log(`RUN ${name}`); saveTrace();
  try {
    await client.send('Emulation.setDeviceMetricsOverride', { ...current.viewport, deviceScaleFactor: 1, mobile: touchInput });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: touchInput }); await fresh(); await action();
    const final = await checkpoint('final'); assert.ok(final.inputs.length > 0 && final.inputs.every(item => item.trusted));
    assert.equal(observerFailure, undefined); assert.ok(current.requests.every(request => request.completed), 'An intercepted request was left pending');
    current.status = 'passed'; log(`PASS ${name}`);
  } catch (error) {
    current.status = 'failed'; current.failure = { message: error.message, stack: error.stack };
    try { current.failureState = await snapshot(); await screenshot('failure', false); } catch {}
    log(`FAIL ${name}: ${error.stack}`); throw error;
  } finally { saveTrace(); }
}

saveTrace(); log(`START ${stamp} ${process.version} ${profile}`);
try {
  const [port, debugPort] = await Promise.all([freePort(), freePort()]); siteUrl = `http://127.0.0.1:${port}/`;
  server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  report.server = { pid: server.pid, runtime: process.execPath, url: siteUrl, startedAt: new Date().toISOString(), stdout: '', stderr: '' };
  for (const stream of ['stdout', 'stderr']) server[stream].on('data', chunk => {
    const text = chunk.toString();
    appendFileSync(join(output, `server-${stream}.log`), text);
    report.server[stream] = (report.server[stream] + text).slice(-16384);
  });
  server.on('exit', (code, signal) => {
    report.server.exit = { code, signal, at: new Date().toISOString(), duringCleanup: cleanupStarted };
    if (!cleanupStarted) log(`SERVER EXIT ${JSON.stringify(report.server.exit)}\n${report.server.stderr}`);
    saveTrace();
  });
  server.on('close', (code, signal) => { report.server.close = { code, signal, at: new Date().toISOString() }; saveTrace(); });
  server.on('error', error => { report.serverError = error.message; });
  await waitFor(async () => { try { return (await fetch(siteUrl)).ok; } catch { return false; } }, 'Local server did not start');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-sandbox',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  browser.on('error', error => { report.browserError = error.message; });
  let target;
  await waitFor(async () => { try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); return target; } catch { return false; } }, 'Browser did not start', 30000);
  client = new Client(target.webSocketDebuggerUrl); await client.open();
  for (const domain of ['Runtime', 'Page', 'Log', 'Network']) await client.send(`${domain}.enable`);
  report.browser = await client.send('Browser.getVersion'); await client.send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
  await client.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/learning-review', requestStage: 'Request' }] });
  client.onEvent = event => {
    if (event.method !== 'Fetch.requestPaused') return;
    try {
      const p = event.params, payload = JSON.parse(p.request.postData || 'null');
      assert.ok(current && payload?.task === 'yijing-learning-recitation');
      current.requests.push({ number: current.requests.length + 1, id: p.requestId, networkId: p.networkId,
        method: p.request.method, url: p.request.url, payload, interceptedBeforeNetwork: true }); saveTrace();
    } catch (error) { observerFailure = error.message; }
  };
  for (const name of options['--scope'] ? [options['--scope']] : allScopes) await runScenario(name);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1; log(error.stack); }
finally {
  report.finishedAt = new Date().toISOString(); report.finalSourceHashes = hashes();
  report.sourceStableDuringRun = JSON.stringify(report.sourceHashes) === JSON.stringify(report.finalSourceHashes);
  report.pageErrors = client?.events.filter(event => event.method === 'Runtime.exceptionThrown') || [];
  report.browserLogs = client?.events.filter(event => event.method === 'Log.entryAdded').map(event => event.params.entry) || [];
  report.networkRequests = client?.events.filter(event => event.method === 'Network.requestWillBeSent').map(event => ({
    requestId: event.params.requestId, url: event.params.request.url, method: event.params.request.method,
    type: event.params.type, timestamp: event.params.timestamp, redirectStatus: event.params.redirectResponse?.status,
  })) || [];
  report.networkResponses = client?.events.filter(event => event.method === 'Network.responseReceived').map(event => ({
    requestId: event.params.requestId, type: event.params.type, timestamp: event.params.timestamp,
    url: event.params.response.url, status: event.params.response.status, mimeType: event.params.response.mimeType,
    fromServiceWorker: event.params.response.fromServiceWorker, fromDiskCache: event.params.response.fromDiskCache,
    contentType: event.params.response.headers['content-type'] || event.params.response.headers['Content-Type'],
  })) || [];
  report.networkFailures = client?.events.filter(event => event.method === 'Network.loadingFailed').map(event => event.params) || [];
  report.networkFinished = client?.events.filter(event => event.method === 'Network.loadingFinished').map(event => event.params) || [];
  try {
    report.serviceWorker = await client?.evaluate(`(async () => ({
      controller: navigator.serviceWorker?.controller ? { scriptURL: navigator.serviceWorker.controller.scriptURL, state: navigator.serviceWorker.controller.state } : null,
      registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(registration => ({
        scope: registration.scope, active: registration.active?.state, waiting: registration.waiting?.state, installing: registration.installing?.state,
      })) : [],
    }))()`);
  } catch (error) { report.serviceWorkerObservationError = error.message; }
  if (report.status === 'passed' && (!report.sourceStableDuringRun || report.pageErrors.length || observerFailure)) {
    report.status = 'failed'; report.failure = { message: observerFailure || (!report.sourceStableDuringRun ? 'Source changed during run' : 'Uncaught page error') }; process.exitCode = 1;
  }
  if (report.server?.exit && !report.server.exit.duringCleanup) {
    report.infrastructureFailure = { component: 'local-server', ...report.server.exit };
    if (report.status === 'passed') report.failure = { message: 'Local server exited before scenario cleanup' };
    report.status = 'failed'; process.exitCode = 1;
  }
  cleanupStarted = true; report.cleanupStartedAt = new Date().toISOString();
  client?.socket.close(); await stop(browser); await stop(server); report.exitCode = process.exitCode || 0;
  report.profileRemoved = false; report.profileRetainedReason = 'Synthetic profile retained for diagnosis. No user profile was touched or deleted.';
  saveTrace(); log(JSON.stringify({ status: report.status, exitCode: report.exitCode, passed: report.scenarios.filter(item => item.status === 'passed').length, total: report.scenarios.length, trace: join(output, 'trace.json') }));
}

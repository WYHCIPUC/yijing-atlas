import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/test-quiz-weak-questions.mjs\nRun only after source freeze. YIJING_QUIZ_WEAK_SCOPE selects matching scenario names; BROWSER_PATH selects Chromium; YIJING_QUIZ_WEAK_EVIDENCE_DIR overrides the timestamped evidence directory. Uses a new isolated synthetic profile and trusted CDP Input. Never uses DOM.click or invokes browser business functions.');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.BROWSER_PATH,
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = candidates.find(existsSync);
assert.ok(browserPath, 'Set BROWSER_PATH to an installed Chromium executable.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.YIJING_QUIZ_WEAK_EVIDENCE_DIR || join(root, 'docs/development/evidence/2026-10-25-quiz-weak-input', stamp));
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(join(realpathSync(tmpdir()), 'yijing-quiz-weak-'));
const keys = { stats: 'yijing-quiz-stats', weak: 'yijing-learning-record-v2', review: 'yijing-review-cards',
  activity: 'yijing-activity-v1', achievement: 'yijing.achievements.v1', legacy: 'yijing-quiz-wrong' };
const dataKeys = [...Object.values(keys), 'yijing.study.v1'];
const labels = { stats: '累计统计', weak: '具体错题记录', review: '卦象复习卡', activity: '学习活动', achievement: '成就记录', legacy: '旧卦码摘要' };
const observedFiles = ['web/index.html', 'web/js/main.js', 'web/js/quiz-engine.js', 'web/js/quiz-session.js',
  'web/js/learning-progress.js', 'web/js/learning-assessment.js', 'web/js/user-data.js', 'web/js/review-engine.js',
  'web/js/achievement-engine.js', 'web/js/achievement-storage.js', 'web/js/modes/quiz-mode.js',
  'web/js/modes/review-mode.js', 'web/js/modes/learning-mode.js', 'web/js/almanac-knowledge.js',
  'web/js/storage.js', 'web/js/data-loader.js', 'web/styles/main.css', 'web/styles/immersive.css',
  'web/data/hexagrams.json', 'web/data/trigrams.json', 'web/data/almanac-terms.json',
  'web/data/almanac-yiji.json', 'scripts/test-quiz-weak-questions.mjs'];
const hashes = () => Object.fromEntries(observedFiles.map(path => [path,
  createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
const terms = JSON.parse(readFileSync(join(root, 'web/data/almanac-terms.json'), 'utf8'));
const term = terms.find(item => item.id && item.name && item.meaning);
assert.ok(term, 'A real public term is needed for the explicit synthetic fixtures.');
const report = { startedAt: new Date().toISOString(), command: 'node scripts/test-quiz-weak-questions.mjs',
  node: process.version, uv: process.versions.uv, browserPath, profile, scope: process.env.YIJING_QUIZ_WEAK_SCOPE || null,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: hashes(), status: 'running', scenarios: [], limitations: [
    'Headless Chromium desktop and CDP emulated touch. This is not physical-mobile, screen-reader, or real browser 200% zoom evidence.',
    'A new random-port origin and isolated profile are used. No user profile, learning data, or private text is read.',
    'Fixtures and quota failures are explicitly recorded. Fixture wrong histories are synthetic, not earned learning or achievement evidence.',
    'Debugger only reads generated public question and attempt identity. No application function or DOM.click is called in the browser.',
    'DOM geometry and scrollIntoView locate controls. Navigation, answers, retries, source opening and return use trusted CDP Input.',
    'Offline covers already-visited modules in the same page, not first installation or a fresh offline reload.',
  ] };
const saveTrace = () => writeFileSync(join(output, 'trace.json'), `${JSON.stringify(report, null, 2)}\n`);
const log = message => { console.log(message); appendFileSync(join(output, 'run.log'), `${message}\n`); };
saveTrace();
log(`START ${stamp} ${process.version} profile=${profile}`);
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
async function waitFor(check, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) { if (await check()) return; await pause(25); }
  throw new Error(message);
}
async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  await new Promise(done => server.close(done)); return port;
}
async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill(); await Promise.race([once(child, 'exit'), pause(3000)]);
}
class Client {
  constructor(url) {
    this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map(); this.events = [];
    this.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) {
        this.events.push(message);
        if (message.method === 'Debugger.paused') void this.onPaused?.(message.params);
        return;
      }
      const pending = this.pending.get(message.id); this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
    });
  }
  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((done, reject) => {
      this.socket.addEventListener('open', done, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((done, reject) => {
      this.pending.set(id, { resolve: done, reject }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
}
let client, server, browser, siteUrl, current, observerFailure;
let mobile = false;
const probe = `(() => {
  const storage = localStorage, originalSet = Storage.prototype.setItem, originalRemove = Storage.prototype.removeItem;
  window.__quizWeakProbe = { storage, originalSet, originalRemove, blocked: [], writes: [], inputs: [] };
  Storage.prototype.setItem = function(key, value) {
    const p = window.__quizWeakProbe;
    if (this !== p.storage || !${JSON.stringify(dataKeys)}.includes(key)) return originalSet.call(this, key, value);
    const saved = !p.blocked.includes(key);
    p.writes.push({ key, saved, operation: 'set', at: performance.now(), value: JSON.parse(value) });
    if (!saved) throw new DOMException('Explicit quiz storage quota fixture', 'QuotaExceededError');
    return originalSet.call(this, key, value);
  };
  Storage.prototype.removeItem = function(key) {
    const p = window.__quizWeakProbe;
    if (this !== p.storage || !${JSON.stringify(dataKeys)}.includes(key)) return originalRemove.call(this, key);
    const saved = !p.blocked.includes(key);
    p.writes.push({ key, saved, operation: 'remove', at: performance.now() });
    if (!saved) throw new DOMException('Explicit quiz storage quota fixture', 'QuotaExceededError');
    return originalRemove.call(this, key);
  };
  for (const type of ['click', 'keydown']) document.addEventListener(type, event => {
    window.__quizWeakProbe.inputs.push({ type, trusted: event.isTrusted, key: event.key, pointerType: event.pointerType,
      x: event.clientX, y: event.clientY, action: event.target.closest?.('[data-action]')?.dataset.action,
      code: event.target.closest?.('.quiz-option')?.dataset.code, target: event.target.id || event.target.className || event.target.tagName });
  }, true);
})();`;
async function snapshot() {
  return client.evaluate(`(() => {
    const p = window.__quizWeakProbe, read = key => JSON.parse(p.storage.getItem(key) || 'null');
    return { data: Object.fromEntries(Object.entries(${JSON.stringify(keys)}).map(([name,key]) => [name,read(key)])),
      writes: p.writes, inputs: p.inputs, message: document.querySelector('.quiz-storage-status')?.textContent || '',
      feedback: document.querySelector('.quiz-feedback')?.innerText || '',
      retry: !!document.querySelector('[data-action="quiz-retry"]:not([hidden]):not(:disabled)'),
      mode: document.body.dataset.activeMode, options: document.querySelectorAll('.quiz-option').length,
      question: document.querySelector('.quiz-question p')?.textContent,
      focus: { id: document.activeElement?.id, action: document.activeElement?.dataset.action,
        tag: document.activeElement?.tagName, marker: document.activeElement?.dataset.learningFocus,
        termId: document.activeElement?.closest('[data-term-id]')?.dataset.termId } };
  })()`);
}
async function checkpoint(label) { const state = await snapshot(); current.checks.push({ label, state }); saveTrace(); return state; }
const pending = state => Object.values(state.data.weak?.weakQuestions || {}).filter(item => item.status !== 'resolved');
const recovered = state => state.data.achievement?.processedKeys?.filter(key => key.startsWith('quiz:recovered:')) || [];
const count = (state, key, saved = true) => state.writes.filter(item => item.key === key && item.saved === saved).length;
async function pointFor(selector) {
  let point;
  await waitFor(async () => {
    point = await client.evaluate(`(async () => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('[inert]') || element.disabled) return null;
      const hit = () => {
        const r = element.getBoundingClientRect(), p = { x:r.left+r.width/2,y:r.top+r.height/2 };
        const target = document.elementFromPoint(p.x,p.y);
        return r.width>0 && r.height>0 && (target===element || element.contains(target)) ? p : null;
      };
      if (!hit()) { element.scrollIntoView({ block:'center',inline:'nearest',behavior:'instant' }); return null; }
      const before=element.getBoundingClientRect();
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const after=element.getBoundingClientRect();
      return ['x','y','width','height'].every(key=>Math.abs(before[key]-after[key])<0.5) ? hit() : null;
    })()`); return point;
  }, `Cannot hit ${selector}`);
  return point;
}
async function inputAt(point, label) {
  current.inputs.push({ kind: mobile ? 'touch' : 'mouse', label, ...point });
  if (mobile) {
    await client.send('Input.dispatchTouchEvent', { type:'touchStart',touchPoints:[{ ...point,id:1 }] });
    await client.send('Input.dispatchTouchEvent', { type:'touchEnd',touchPoints:[] });
  } else {
    await client.send('Input.dispatchMouseEvent', { type:'mouseMoved',...point });
    await client.send('Input.dispatchMouseEvent', { type:'mousePressed',...point,button:'left',buttons:1,clickCount:1 });
    await client.send('Input.dispatchMouseEvent', { type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1 });
  }
}
async function click(selector) { await inputAt(await pointFor(selector), selector); }
async function pressKey(key) {
  const code=key===' '?'Space':key, windowsVirtualKeyCode={ Tab:9,Enter:13,Escape:27,' ':32 }[key];
  current.inputs.push({ kind:'keyboard',key });
  await client.send('Input.dispatchKeyEvent', { type:key==='Enter'?'keyDown':'rawKeyDown',key,code,windowsVirtualKeyCode,
    ...(key==='Enter'?{ text:'\r',unmodifiedText:'\r' }:{}) });
  await client.send('Input.dispatchKeyEvent', { type:'keyUp',key,code,windowsVirtualKeyCode });
}
async function tabTo(selector) {
  for (let index=0;index<100;index+=1) {
    if (await client.evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`)) return;
    await pressKey('Tab');
  }
  throw new Error(`Keyboard cannot reach ${selector}`);
}
async function geometry(selector) {
  return client.evaluate(`(() => {
    const element=document.querySelector(${JSON.stringify(selector)}); if(!element) return null;
    const rect=element.getBoundingClientRect(), clip={ left:0,top:0,right:innerWidth,bottom:innerHeight }, ancestors=[];
    for(let node=element.parentElement;node;node=node.parentElement){
      const style=getComputedStyle(node),box=node.getBoundingClientRect();
      const x=/auto|scroll|hidden|clip/.test(style.overflowX),y=/auto|scroll|hidden|clip/.test(style.overflowY);
      if(!x&&!y) continue;
      const viewport=node===document.body||node===document.documentElement;
      ancestors.push({tag:node.tagName,id:node.id,className:node.className,rect:box.toJSON(),overflowX:style.overflowX,overflowY:style.overflowY,viewport});
      if(viewport) continue;
      if(x){clip.left=Math.max(clip.left,box.left);clip.right=Math.min(clip.right,box.right);}
      if(y){clip.top=Math.max(clip.top,box.top);clip.bottom=Math.min(clip.bottom,box.bottom);}
    }
    const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    return {rect:rect.toJSON(),clip,ancestors,text:element.innerText,fullyVisible:element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&
      rect.width>0&&rect.height>0&&rect.left>=clip.left-1&&rect.top>=clip.top-1&&rect.right<=clip.right+1&&rect.bottom<=clip.bottom+1,
      centerUnobscured:!!hit&&(hit===element||element.contains(hit))};
  })()`);
}
async function assertVisible(selector, label) {
  let value;
  try {
    await waitFor(async()=>{ value=await geometry(selector); return value?.fullyVisible&&value.centerUnobscured; }, `${label} is not fully visible`);
  } catch (error) {
    current.checks.push({label,selector,status:'failed',geometry:value});saveTrace();throw error;
  }
  current.checks.push({label,geometry:value});saveTrace();return value;
}
async function questionReadability(selectors = ['.query-question', '.quiz-question', '.quiz-question p'], stateLabel = 'normal') {
  const styles = await client.evaluate(`(() => {
    const rgba = text => {
      if (text.startsWith('#')) {
        const value = text.slice(1);
        return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16)).concat(1);
      }
      const values = text.match(/[0-9.]+/g)?.map(Number) || [];
      return values.length === 3 ? [...values, 1] : values;
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return front.slice(0, 3).map((channel, index) =>
        alpha ? (channel * front[3] + back[index] * back[3] * (1 - front[3])) / alpha : 0).concat(alpha);
    };
    const luminance = color => color.slice(0, 3).map(channel => channel / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const expectedPaper = getComputedStyle(document.documentElement).getPropertyValue('--paper-warm').trim();
    return {
      expectedPaper, expectedPaperRgba: rgba(expectedPaper),
      targets: ${JSON.stringify(selectors)}.map(selector => {
        const element = document.querySelector(selector);
        if (!element) return { selector, found: false };
        const layers = [];
        for (let node = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          layers.unshift({ tag: node.tagName, id: node.id, className: node.className,
            color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
            opacity: style.opacity, filter: style.filter, backdropFilter: style.backdropFilter,
            mixBlendMode: style.mixBlendMode, rgba: rgba(style.backgroundColor) });
        }
        const solidComposite = layers.reduce((back, layer) => over(layer.rgba, back), [255, 255, 255, 1]);
        const style = getComputedStyle(element), foreground = over(rgba(style.color), solidComposite);
        const light = luminance(foreground), dark = luminance(solidComposite);
        const outline = luminance(over(rgba(style.outlineColor), solidComposite));
        const opacity = layers.reduce((value, layer) => value * Number(layer.opacity), 1);
        return { selector, found: true, text: element.textContent, color: style.color,
          backgroundColor: style.backgroundColor, backgroundRgba: rgba(style.backgroundColor),
          backgroundImage: style.backgroundImage, opacity: style.opacity, ancestorOpacity: opacity,
          hover: element.matches(':hover'), focusVisible: element.matches(':focus-visible'),
          outlineColor: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset, outlineContrastRatio: (Math.max(outline, dark) + 0.05) / (Math.min(outline, dark) + 0.05),
          fontSize: style.fontSize, fontWeight: style.fontWeight, rect: element.getBoundingClientRect().toJSON(),
          layers, solidComposite, solidContrastRatio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
          compositeLimit: 'Alpha composite of CSS solid background colors. Images, canvas siblings, filters and pseudo-elements are separately listed, not simulated.',
          imageLayers: layers.filter(layer => layer.backgroundImage !== 'none') };
      }),
    };
  })()`);
  const { root: documentNode } = await client.send('DOM.getDocument', { depth: 0 });
  const properties = new Set(['color', 'background', 'background-color', 'background-image', 'opacity', 'filter', 'backdrop-filter', 'outline', 'outline-color', 'outline-style', 'outline-width', 'outline-offset']);
  const sheetUrl = id => client.events.find(event => event.method === 'CSS.styleSheetAdded' && event.params.header.styleSheetId === id)?.params.header.sourceURL;
  const ruleEvidence = match => ({
    selector: match.rule.selectorList.text, matchingSelectors: match.matchingSelectors,
    sourceUrl: sheetUrl(match.rule.styleSheetId || match.rule.style.styleSheetId),
    range: match.rule.style.range, origin: match.rule.origin,
    declarations: match.rule.style.cssProperties.filter(property => properties.has(property.name)),
  });
  styles.matchedCss = [];
  for (const selector of selectors) {
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector });
    if (!nodeId) { styles.matchedCss.push({ selector, found: false }); continue; }
    const matched = await client.send('CSS.getMatchedStylesForNode', { nodeId });
    styles.matchedCss.push({ selector, found: true,
      inline: matched.inlineStyle?.cssProperties.filter(property => properties.has(property.name)),
      rules: matched.matchedCSSRules.map(ruleEvidence).filter(rule => rule.declarations.length),
      inherited: matched.inherited.map(entry => ({
        rules: entry.matchedCSSRules.map(ruleEvidence).filter(rule => rule.declarations.length),
      })).filter(entry => entry.rules.length),
    });
  }
  current.checks.push({ label: 'question-computed-readability-and-matched-css', stateLabel, styles });
  saveTrace();
  return styles;
}
async function screenshot(label, settle=true) {
  if(settle) await waitFor(()=>client.evaluate(`(async()=>{
    if(document.body.classList.contains('mode-transitioning')||document.querySelector('#detail-panel')?.getAttribute('aria-busy')==='true')return false;
    if(document.getAnimations().some(a=>(a.pending||a.playState==='running')&&a.effect?.getTiming().iterations!==Infinity&&a.effect?.target?.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true})))return false;
    const panel=document.querySelector('#detail-panel'),top=panel?.scrollTop;
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));return top===panel?.scrollTop;
  })()`),`Screenshot ${label} did not settle`);
  const result=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const file=`${current.name}-${label}.png`;writeFileSync(join(output,file),Buffer.from(result.data,'base64'));
  current.screenshots.push(file);saveTrace();
}
async function fresh() {
  const previous=await client.evaluate('performance.timeOrigin');
  await client.send('Page.navigate',{url:`${siteUrl}?quiz-weak-probe=${current.name}`});
  await waitFor(()=>client.evaluate(`performance.timeOrigin!==${previous}&&document.querySelector('#loading')?.hidden===true&&!!window.__quizWeakProbe`),'Application did not initialize',30000);
}
async function dismissWelcome() {
  if(await client.evaluate('!document.querySelector("#daily-overlay")?.hidden&&!document.querySelector("#daily-overlay")?.classList.contains("hidden")')) await click('[data-entry="explore"]');
}
async function leave() {
  if(!await client.evaluate('document.querySelector("#detail-panel")?.classList.contains("open")'))return;
  const modal=await client.evaluate('document.querySelector("#detail-panel")?.getAttribute("aria-modal")==="true"');
  await click(modal?'#detail-close':'.mode-btn[data-mode="explore"]');
  await waitFor(()=>client.evaluate('!document.querySelector("#detail-panel")?.classList.contains("open")'),'Panel did not close');
}
async function goMode(mode) {
  if(await client.evaluate('document.querySelector("#detail-panel")?.getAttribute("aria-modal")==="true"&&document.querySelector("#detail-panel")?.classList.contains("open")'))await leave();
  await click(`.mode-btn[data-mode="${mode}"]`);
  await waitFor(()=>client.evaluate(`!!document.querySelector('.${mode}-panel')&&!document.body.classList.contains('mode-transitioning')`),`${mode} did not open`);
}
async function fixture(values={}) {
  await dismissWelcome();await leave();
  await client.evaluate(`(()=>{const p=window.__quizWeakProbe;for(const key of ${JSON.stringify(dataKeys)})p.originalRemove.call(p.storage,key);
    for(const [key,value]of Object.entries(${JSON.stringify(values)}))p.originalSet.call(p.storage,key,JSON.stringify(value));
    sessionStorage.setItem('yijing-daily-seen','1');})()`);
  current.fixtures.push({at:new Date().toISOString(),values});await fresh();await dismissWelcome();
}
function reference(kind='quiz',type=kind==='quiz'?'opposite':'name-to-meaning') {
  return {sourceKind:kind,questionId:kind==='quiz'?`quiz:${type}:111111`:`almanac:${term.id}:${type}`,
    questionVersion:kind==='quiz'?'quiz-v1':'almanac-v1',questionType:type,
    targetCode:kind==='quiz'?'111111':null,termId:kind==='almanac'?term.id:null,lessonId:null};
}
function weak(ref,offset=0) {
  const at=new Date(Date.parse('2026-10-24T08:00:00Z')+offset).toISOString();
  return {...ref,firstWrongAt:at,lastWrongAt:at,lastSessionId:`synthetic-wrong-${offset}-${ref.questionId}`,wrongCount:1,status:'due',lastReviewedAt:null,resolvedAt:null};
}
function learningFixture(items) {
  return {[keys.weak]:{version:2,lessons:{},spotChecks:[],exams:[],oralReviews:[],weakQuestions:Object.fromEntries(items.map(item=>[item.questionId,item]))}};
}
async function questionReady(after=0) {
  await waitFor(async()=>current.rounds.length>after&&await client.evaluate('document.querySelectorAll(".quiz-option:not(:disabled)").length>=4'),'A real generated quiz question was not observed');
  assert.equal(observerFailure,undefined);return current.rounds.at(-1);
}
async function queueAction(ref,action='practice') {
  const selector=await client.evaluate(`(()=>{const item=[...document.querySelectorAll('[data-quiz-question-id]')].find(el=>el.dataset.quizQuestionId===${JSON.stringify(ref.questionId)});
    return item?.querySelector('[data-action^="quiz-${action}-"]')?.dataset.action;})()`);
  assert.ok(selector,`Queue ${action} missing for ${ref.questionId}`);return `[data-action="${selector}"]`;
}
async function practice(ref) {const before=current.rounds.length;await click(await queueAction(ref));return questionReady(before);}
async function answer(round,correct,{keyboard=false}={}) {
  const code=correct?round.question.answer:round.question.candidates.map(item=>typeof item==='string'?item:item.code).find(item=>item!==round.question.answer);
  const selector=`.quiz-option[data-code=${JSON.stringify(code)}]`;
  if(keyboard){await tabTo(selector);await pressKey('Enter');}else await click(selector);
  await waitFor(()=>client.evaluate('!!document.querySelector(".quiz-storage-status")?.textContent'),'Quiz feedback did not render');
  return checkpoint(correct?'correct-answer':'wrong-answer');
}
async function returnToQueue() {await click('[data-action="quiz-review"]');await waitFor(()=>client.evaluate('!!document.querySelector(".review-panel")'),'Review queue did not render');}
async function openSource(ref) {
  const before=await snapshot();await click(await queueAction(ref,'source'));
  if(ref.sourceKind==='almanac') {
    await waitFor(()=>client.evaluate(`document.activeElement?.dataset.learningFocus==='term'&&document.activeElement.closest('[data-term-id]')?.dataset.termId===${JSON.stringify(ref.termId)}`),'Original term did not receive final focus');
    await assertVisible('summary[data-learning-focus="term"]','term-source-visible');
    assert.equal(await client.evaluate('document.querySelector("summary[data-learning-focus=term]").tabIndex'),0);
    await screenshot('term-source');await click('[data-action="term-back"]');
  } else {
    await waitFor(()=>client.evaluate('!!document.querySelector(".flip-card")'),'Hexagram source did not open');
    await click('.flip-card');await waitFor(()=>client.evaluate('document.querySelector(".flip-card")?.getAttribute("aria-expanded")==="true"'),'Source answer did not open');
    await screenshot('hexagram-source');await click('.review-back');
  }
  await waitFor(()=>client.evaluate('!!document.querySelector(".review-panel")'),'Source did not return to queue');
  const after=await checkpoint('source-return-does-not-correct');
  assert.deepEqual(after.data.weak,before.data.weak);assert.deepEqual(recovered(after),recovered(before));
}
async function originalCycle() {
  await fixture();await goMode('quiz');const first=await questionReady();
  const wrong=await answer(first,false,{keyboard:!mobile});const ref=first.question.reference;
  assert.equal(wrong.data.weak.weakQuestions[ref.questionId].wrongCount,1);
  assert.equal(wrong.data.stats.total,1);assert.equal(pending(wrong).length,1);assert.equal(recovered(wrong).length,0);
  if(ref.sourceKind==='almanac')assert.equal(wrong.data.review,null);
  await assertVisible('.quiz-storage-status','wrong-save-feedback-visible');await screenshot('wrong');
  await returnToQueue();await screenshot('queue');await openSource(ref);
  const next=await practice(ref);assert.deepEqual(next.question.reference,ref);assert.notEqual(next.attemptId,first.attemptId);
  const corrected=await answer(next,true,{keyboard:!mobile});assert.equal(corrected.data.stats.total,2);
  assert.equal(corrected.data.weak.weakQuestions[ref.questionId].status,'resolved');assert.equal(recovered(corrected).length,1);
  assert.match(await client.evaluate('document.querySelector(".quiz-next")?.textContent||""'),/返回随机测验/);
  await assertVisible('.quiz-storage-status','correct-save-feedback-visible');await screenshot('corrected');
  const after=current.rounds.length;await click('.quiz-next');const random=await questionReady(after);assert.equal(random.mode,'random');
  assert.equal((await snapshot()).data.stats.total,2);await screenshot('last-item-random');
}
async function identityIsolation(kind) {
  const first=reference(kind),other=reference(kind,kind==='quiz'?'name':'meaning-to-name');
  await fixture(learningFixture([weak(first),weak(other,1)]));await goMode('review');
  const before=await snapshot();const round=await practice(other);const after=await answer(round,true);
  assert.deepEqual(after.data.weak.weakQuestions[first.questionId],before.data.weak.weakQuestions[first.questionId]);
  assert.equal(after.data.weak.weakQuestions[other.questionId].status,'resolved');assert.equal(pending(after).length,1);
  assert.equal(after.data.achievement.metrics.quizRecoveries.includes(other.questionId),true);
  assert.equal(after.data.achievement.metrics.quizRecoveries.includes(first.questionId),false);
  if(kind==='almanac')assert.equal(after.data.review,null);
  await screenshot('other-rule-kept');await returnToQueue();await openSource(first);
}
async function retryPart(part) {
  const ref=reference();const legacy=part==='legacy';
  await fixture(legacy?{[keys.legacy]:['111111']}:learningFixture([weak(ref)]));await goMode('review');
  const beforeRounds=current.rounds.length;
  if(legacy)await click('[data-action="legacy-practice-0"]');else await click(await queueAction(ref));
  const round=await questionReady(beforeRounds);const before=await snapshot();
  current.faults.push({key:keys[part],kind:'QuotaExceededError',phase:'answer-and-first-retry'});
  await client.evaluate(`window.__quizWeakProbe.blocked=[${JSON.stringify(keys[part])}]`);
  const failed=await answer(round,part==='achievement'||legacy);
  assert.equal(failed.retry,true);assert.match(failed.message,new RegExp(`${labels[part]}未能保存`));
  assert.equal(count(failed,keys[part],false)-count(before,keys[part],false),1);
  await assertVisible('.quiz-storage-status',`${part}-failed-status-visible`);await screenshot(`${part}-failed`);
  await click('[data-action="quiz-retry"]');const repeated=await checkpoint(`${part}-still-blocked`);
  assert.equal(repeated.retry,true);assert.equal(count(repeated,keys[part],false)-count(failed,keys[part],false),1);
  for(const key of Object.values(keys))assert.equal(count(repeated,key),count(failed,key),'Already saved parts must not be written again');
  await client.evaluate('window.__quizWeakProbe.blocked=[]');await click('[data-action="quiz-retry"]');
  await waitFor(async()=>!(await snapshot()).retry,'Retry did not finish');const saved=await checkpoint(`${part}-retry-recovered`);
  assert.equal(saved.data.stats.total,1);assert.equal(current.rounds.at(-1).attemptId,round.attemptId);
  assert.equal(count(saved,keys[part])-count(before,keys[part]),1);
  for(const key of Object.values(keys))if(key!==keys[part])assert.equal(count(saved,key),count(failed,key),'Recovery only retries its failed part');
  assert.equal(recovered(saved).length,part==='achievement'?1:0);
  if(legacy){assert.equal(saved.data.weak,null);assert.ok(!saved.data.legacy?.length);}
  else assert.equal(Object.keys(saved.data.weak.quizAttempts).length,1);
  await assertVisible('.quiz-storage-status',`${part}-recovered-status-visible`);await screenshot(`${part}-recovered`);
}
async function legacyAndUnavailable() {
  await fixture({[keys.legacy]:['111111']});await goMode('review');let before=current.rounds.length;
  await click('[data-action="legacy-practice-0"]');const round=await questionReady(before);
  assert.match(await client.evaluate('document.querySelector(".quiz-panel")?.innerText||""'),/原题型未保留/);
  const result=await answer(round,true);assert.equal(result.data.weak,null);assert.equal(recovered(result).length,0);
  assert.ok(!result.data.legacy?.length);await screenshot('legacy-no-fabricated-recovery');
  const retired={...reference('almanac'),termId:'retired-public-term',questionId:'almanac:retired-public-term:name-to-meaning'};
  await fixture(learningFixture([weak(retired)]));await goMode('review');const old=await snapshot();before=current.rounds.length;
  await click(await queueAction(retired));await waitFor(()=>client.evaluate('!!document.querySelector(".quiz-panel .mode-empty")'),'Missing term did not show safe empty state');
  assert.equal((await snapshot()).options,0);assert.equal(current.rounds.length,before);
  await screenshot('unavailable-question');await click('[data-action="quiz-review"]');
  await waitFor(()=>client.evaluate('!!document.querySelector(".review-panel")'),'Missing term did not return');
  await click(await queueAction(retired,'source'));await waitFor(()=>client.evaluate('!!document.querySelector("[data-action=term-back]")'),'Missing term source fallback did not open');
  assert.match(await client.evaluate('document.querySelector("#learning-content")?.innerText||""'),/已调整|暂不可用/);
  await screenshot('unavailable-source');await click('[data-action="term-back"]');
  const after=await checkpoint('unavailable-preserves-record');assert.deepEqual(after.data.weak,old.data.weak);assert.equal(recovered(after).length,0);
}
async function staleAndOffline() {
  const ref=reference('almanac');await fixture(learningFixture([weak(ref)]));await goMode('review');await openSource(ref);
  let round=await practice(ref);const oldPoint=await pointFor('.quiz-option');await leave();const left=await snapshot();
  const hit=await client.evaluate(`document.elementFromPoint(${oldPoint.x},${oldPoint.y})?.outerHTML.slice(0,400)`);
  current.checks.push({label:'old-option-coordinate-after-leave',point:oldPoint,hit});
  await inputAt(oldPoint,'old-option-coordinate-after-leave');await pressKey('Enter');
  await client.evaluate('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))');
  assert.deepEqual((await snapshot()).data,left.data,'Input after leaving must not submit the discarded quiz');
  await goMode('review');round=await practice(ref);
  const networkStart=client.events.length;
  await client.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  current.faults.push({kind:'CDP-network-offline',scope:'already-visited-quiz-review-term-modules'});
  try {
    const wrong=await answer(round,false);assert.equal(wrong.retry,false);await returnToQueue();await openSource(ref);
    const next=await practice(ref);const saved=await answer(next,true);assert.equal(saved.retry,false);assert.equal(pending(saved).length,0);
    assert.equal(saved.data.stats.total,2);assert.equal(recovered(saved).length,1);await screenshot('offline-corrected');
    const requests=client.events.slice(networkStart).filter(event=>event.method==='Network.requestWillBeSent').map(event=>event.params.request);
    current.checks.push({label:'offline-network-requests',requests});
    assert.equal(requests.some(request=>request.method!=='GET'||/\/api\//i.test(new URL(request.url).pathname)),false,'Local quiz must not invoke any evaluation service');
  } finally {await client.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}
}
async function narrowGeometry() {
  const refs=[reference(),reference('quiz','name'),reference('almanac'),reference('almanac','meaning-to-name')];
  await fixture(learningFixture(refs.map((ref,index)=>weak(ref,index))));await goMode('review');
  const geometryState=await client.evaluate(`(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,
    items:[...document.querySelectorAll('[data-quiz-question-id]')].map(el=>({id:el.dataset.quizQuestionId,rect:el.getBoundingClientRect().toJSON(),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}))}))()`);
  current.checks.push({label:'320-queue-geometry',geometry:geometryState});
  assert.ok(geometryState.documentWidth<=320+1);assert.equal(geometryState.items.length,4);
  for(const item of geometryState.items){assert.ok(item.rect.left>=-1&&item.rect.right<=321);assert.ok(item.scrollWidth<=item.clientWidth+1);}
  await screenshot('queue-320');await openSource(refs[2]);
  const checkNavigation = async label => {
    await client.evaluate(`document.querySelector('.quiz-toolbar').scrollIntoView({block:'start',inline:'nearest',behavior:'instant'})`);
    await pointFor('.quiz-mode-toggle');
    const navigation=await client.evaluate(`(() => {
      const close=document.querySelector('#detail-close').getBoundingClientRect();
      return {close:close.toJSON(),buttons:['.quiz-mode-toggle','[data-action="quiz-return"]'].map(selector=>{
        const element=document.querySelector(selector),rect=element.getBoundingClientRect(),hits=[];
        for(const xPart of [0.1,0.5,0.9])for(const yPart of [0.1,0.5,0.9]){
          const x=rect.left+rect.width*xPart,y=rect.top+rect.height*yPart,hit=document.elementFromPoint(x,y);
          hits.push({x,y,own:!!hit&&(hit===element||element.contains(hit)),hit:hit?.id||hit?.dataset.action||hit?.tagName});
        }
        return {selector,rect:rect.toJSON(),hits,overlapWidth:Math.max(0,Math.min(close.right,rect.right)-Math.max(close.left,rect.left)),
          overlapHeight:Math.max(0,Math.min(close.bottom,rect.bottom)-Math.max(close.top,rect.top))};
      })};
    })()`);
    current.checks.push({label,navigation});saveTrace();await screenshot(label);
    for(const button of navigation.buttons){
      assert.ok(button.overlapWidth===0||button.overlapHeight===0,'320px quiz navigation must not overlap the close control');
      assert.ok(button.hits.every(hit=>hit.own),'320px navigation center and edges must hit their own button');
      await assertVisible(button.selector,`${label}-fully-visible`);
    }
  };
  const beforeNavigation=await snapshot();await practice(refs[2]);await checkNavigation('320-random-return-control');
  const beforeRandom=current.rounds.length;await click('.quiz-mode-toggle');
  assert.equal((await questionReady(beforeRandom)).mode,'random');
  await goMode('review');await practice(refs[2]);await checkNavigation('320-queue-return-control');
  await click('[data-action="quiz-return"]');
  await waitFor(()=>client.evaluate('!!document.querySelector(".review-panel")'),'320px return action must open the original queue');
  const afterNavigation=await checkpoint('320-navigation-does-not-submit');assert.deepEqual(afterNavigation.data,beforeNavigation.data);
  const round=await practice(refs[2]);for(const code of round.question.candidates.map(item=>item.code)){
    const selector=`.quiz-option[data-code=${JSON.stringify(code)}]`;
    current.checks.push({label:'320-option-before-location',selector,geometry:await geometry(selector)});
    await client.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})`);
    await pointFor(selector);await assertVisible(selector,'320-option-visible');
  }
  await screenshot('options-320');await answer(round,true);await assertVisible('.quiz-storage-status','320-result-visible');await screenshot('result-320');
}
async function readabilityScenario() {
  await fixture();
  await goMode('quiz');
  await questionReady();
  await pointFor('.quiz-question');
  await screenshot('question-before-answer');
  const styles = await questionReadability();
  const card = styles.targets.find(item => item.selector === '.quiz-question');
  const paragraph = styles.targets.find(item => item.selector === '.quiz-question p');
  assert.ok(card?.found && paragraph?.found, 'The visible quiz question must exist.');
  assert.equal(card.ancestorOpacity, 1, 'The settled question must not remain faded.');
  assert.deepEqual(card.backgroundRgba, styles.expectedPaperRgba,
    'The question must use its approved opaque warm-paper background, not a competing translucent card background.');
  assert.ok(paragraph.solidContrastRatio >= 4.5,
    `Question text must meet 4.5:1 against its solid paper surface; observed ${paragraph.solidContrastRatio.toFixed(2)}:1.`);
  await assertVisible('.quiz-question p', 'question-text-visible');
}
async function termSourceReadability() {
  const ref = reference('almanac');
  await fixture(learningFixture([weak(ref)]));
  await goMode('review');
  await answer(await practice(ref), true);
  const selector = '[data-action="quiz-source"]';
  const point = await pointFor(selector);
  await assertVisible(selector, 'term-source-button-visible');
  await screenshot('source-button-before-open');
  const measurements = [await questionReadability(['.quiz-explanation', selector], 'normal')];
  if (!mobile) {
    current.inputs.push({ kind: 'mouse-hover', selector, ...point });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await waitFor(() => client.evaluate('document.querySelector("[data-action=quiz-source]")?.matches(":hover")'), 'Source action did not receive real hover');
    await screenshot('source-button-hover');
    measurements.push(await questionReadability(['.quiz-explanation', selector], 'hover'));
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 30, y: 80 });
    await tabTo(selector);
    await waitFor(() => client.evaluate('document.querySelector("[data-action=quiz-source]")?.matches(":focus-visible")'), 'Keyboard did not produce focus-visible');
    await screenshot('source-button-keyboard-focus');
    measurements.push(await questionReadability(['.quiz-explanation', selector], 'focus-visible'));
    await pressKey('Enter');
  } else await click(selector);
  await waitFor(() => client.evaluate(`document.activeElement?.dataset.learningFocus==='term'&&document.activeElement.closest('[data-term-id]')?.dataset.termId===${JSON.stringify(ref.termId)}`), 'Actual source activation did not focus the original term');
  await screenshot('source-opened-by-real-input');
  for (const styles of measurements) {
    const button = styles.targets.find(item => item.selector === selector);
    assert.ok(button?.found, 'The original-term source action must exist.');
    assert.equal(button.ancestorOpacity, 1, 'The settled source action must not remain faded.');
    assert.ok(button.solidContrastRatio >= 4.5,
      `Source action must meet 4.5:1 against the paper surface; observed ${button.solidContrastRatio.toFixed(2)}:1.`);
    if (button.focusVisible) {
      assert.notEqual(button.outlineStyle, 'none');
      assert.ok(parseFloat(button.outlineWidth) > 0 && button.outlineContrastRatio >= 3,
        'The keyboard focus indicator must remain visible against the paper surface.');
    }
  }
}
async function runScenario(name,viewport,action) {
  if(process.env.YIJING_QUIZ_WEAK_SCOPE&&!name.includes(process.env.YIJING_QUIZ_WEAK_SCOPE))return;
  current={name,viewport,status:'running',rounds:[],inputs:[],checks:[],fixtures:[],faults:[],screenshots:[]};
  report.scenarios.push(current);saveTrace();log(`RUN ${name}`);mobile=viewport.width<768;
  try {
    await client.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile});
    await client.send('Emulation.setTouchEmulationEnabled',{enabled:mobile});await fresh();await action();
    const final=await snapshot();assert.ok(final.inputs.length>0&&final.inputs.every(event=>event.trusted));
    assert.equal(observerFailure,undefined);current.trustedInputEvidence=final.inputs;current.status='passed';log(`PASS ${name}`);
  } catch(error) {
    current.status='failed';current.failure={message:error.message,stack:error.stack};
    try{current.failureState=await snapshot();await screenshot('failure',false);}catch{}
    log(`FAIL ${name}: ${error.stack}`);throw error;
  } finally {saveTrace();}
}

try {
  const [sitePort,debugPort]=await Promise.all([freePort(),freePort()]);siteUrl=`http://127.0.0.1:${sitePort}/`;
  server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(sitePort)},stdio:'ignore',windowsHide:true});
  await waitFor(async()=>{try{return(await fetch(siteUrl)).ok;}catch{return false;}},'Server did not start');
  browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--no-sandbox',
    `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let target;
  await waitFor(async()=>{try{target=(await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item=>item.type==='page');return target;}catch{return false;}},'Browser did not start',30000);
  client=new Client(target.webSocketDebuggerUrl);await client.open();
  for(const domain of ['Runtime','Page','Log','Debugger','Network','DOM','CSS'])await client.send(`${domain}.enable`);
  report.browser=await client.send('Browser.getVersion');await client.send('Page.addScriptToEvaluateOnNewDocument',{source:probe});
  const lines=readFileSync(join(root,'web/js/quiz-session.js'),'utf8').split(/\r?\n/);
  const line=lines.findIndex(value=>value.trim()==='return token;');assert.ok(line>=0,'Read-only generated-question observation point is required');
  await client.send('Debugger.setBreakpointByUrl',{urlRegex:'/js/quiz-session\\.js(?:\\?.*)?$',lineNumber:line});
  client.onPaused=async params=>{
    try {
      const value=await client.send('Debugger.evaluateOnCallFrame',{callFrameId:params.callFrames[0].callFrameId,
        expression:'({question,mode,attemptId:token.id})',returnByValue:true});
      if(value.exceptionDetails)throw new Error(value.exceptionDetails.text);current.rounds.push(value.result.value);saveTrace();
    }catch(error){observerFailure=error.message;}finally{await client.send('Debugger.resume');}
  };
  const desktop={width:1440,height:1024},phone={width:390,height:844};
  await runScenario('1440-question-readability',desktop,readabilityScenario);
  await runScenario('1440-term-source-readability',desktop,termSourceReadability);
  await runScenario('390-term-source-readability',phone,termSourceReadability);
  for(const viewport of [desktop,phone])await runScenario(`${viewport.width}-original-cycle`,viewport,originalCycle);
  await runScenario('1440-same-hex-other-rule',desktop,()=>identityIsolation('quiz'));
  await runScenario('390-same-term-other-direction',phone,()=>identityIsolation('almanac'));
  for(const part of Object.keys(keys))await runScenario(`1440-retry-${part}`,desktop,()=>retryPart(part));
  for(const part of ['weak','achievement'])await runScenario(`390-retry-${part}`,phone,()=>retryPart(part));
  await runScenario('1440-legacy-unavailable',desktop,legacyAndUnavailable);
  await runScenario('390-stale-offline',phone,staleAndOffline);
  await runScenario('320-queue-term-geometry',{width:320,height:844},narrowGeometry);
  assert.ok(report.scenarios.length>0,'No scenario matched YIJING_QUIZ_WEAK_SCOPE');report.status='passed';
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};process.exitCode=1;log(error.stack);}
finally {
  report.finishedAt=new Date().toISOString();report.finalSourceHashes=hashes();
  report.sourceStableDuringRun=JSON.stringify(report.sourceHashes)===JSON.stringify(report.finalSourceHashes);
  report.pageErrors=client?.events.filter(event=>event.method==='Runtime.exceptionThrown')||[];
  report.browserLogs=client?.events.filter(event=>event.method==='Log.entryAdded').map(event=>event.params.entry)||[];
  report.networkRequests=client?.events.filter(event=>event.method==='Network.requestWillBeSent').map(event=>event.params.request)||[];
  if(report.status==='passed'&&(!report.sourceStableDuringRun||report.pageErrors.length||observerFailure)){
    report.status='failed';report.failure={message:observerFailure||(!report.sourceStableDuringRun?'Source changed during run':'Uncaught page errors')};process.exitCode=1;
  }
  client?.socket.close();await stopProcess(browser);await stopProcess(server);
  report.profileRemoved=false;report.profileRetainedReason='Isolated synthetic profile retained for diagnosis; no deletion attempted and no user profile touched.';
  saveTrace();log(JSON.stringify({status:report.status,passed:report.scenarios.filter(item=>item.status==='passed').length,total:report.scenarios.length,trace:join(output,'trace.json'),profile}));
}

// 컨트롤러 정보 수집 창. 장치는 main이 node-hid로 열고, 신호는 'probe-report'로 받는다.
// 녹화: 신호 내용은 바뀐 것만, 도착 시각은 모두 모아 간격 통계로 남긴다. 저장은 main이 파일 대화상자로 한다.
const $ = id => document.getElementById(id);
const api = window.electronAPI;
const t = (key, values) => window.i18n.t(key, values);
const MAX_RECORD_MS = 20000;
const STEPS = ['idle', 'key1', 'key2', 'key3', 'key4', 'key5', 'key6', 'key7', 'extra', 'ttCwSlow', 'ttCcwSlow', 'ttCwFast', 'ttCcwFast', 'ttMixed', 'rapid', 'chord', 'playLike'];

let groups = [];
let openedInfo = [];          // 연 인터페이스 정보 (결과 파일에 넣는다)
let deviceStatus = '';
const recordings = [];
let current = null;
let activeStep = 0;
let lastByIndex = {};         // 실시간 표시용: 인터페이스별 마지막 신호
let liveText = null;          // { index, bytes, prev }
let rateCount = 0;

// 단계 문구: key1~key7은 공통 문구에 번호를 넣는다
function stepText(id) {
  const m = /^key(\d)$/.exec(id);
  const base = m ? 'probe.steps.key' : `probe.steps.${id}`;
  const values = m ? { n: m[1] } : undefined;
  return { title: t(`${base}.title`, values), hint: t(`${base}.hint`, values) };
}

// ─── 장치 ─────────────────────────────
async function refreshDevices() {
  groups = await api.probeList();
  const select = $('device');
  const previous = select.value;
  select.replaceChildren(...groups.map(g => {
    const option = document.createElement('option');
    option.value = g.id;
    // 같은 기판 두 대는 시리얼 끝 4자리로 구분한다
    option.textContent = `${g.name || g.manufacturer || '?'} [${g.vidPid}${g.serial ? ` S/N …${g.serial.slice(-4)}` : ''}]${g.gamepad ? ` · ${t('probe.gamepad')}` : ''}`;
    return option;
  }));
  if (!groups.length) {
    deviceStatus = t('probe.noDevices');
    openedInfo = [];
    await api.probeClose();
    render();
    return;
  }
  select.value = groups.some(g => g.id === previous) ? previous : groups[0].id;
  await openSelected();
}

async function openSelected() {
  lastByIndex = {};
  liveText = null;
  const result = await api.probeOpen($('device').value);
  openedInfo = result?.opened || [];
  deviceStatus = openedInfo.length ? t('probe.opened', { count: openedInfo.length }) : t('probe.openFailed');
  render();
}

api.onProbeReport(({ index, data, time }) => {
  rateCount++;
  if (lastByIndex[index] !== data) {
    liveText = { index, bytes: data.split(' '), prev: lastByIndex[index]?.split(' ') };
    lastByIndex[index] = data;
  }
  if (!current) return;
  if (current.start === null) current.start = time;
  current.times.push(time);
  current.total++;
  if (current.lastByIndex[index] !== data) {
    current.lastByIndex[index] = data;
    current.changes.push({ t: Math.round((time - current.start) * 1000) / 1000, dev: index, data });
  }
});

// 실시간 표시는 신호마다가 아니라 짧은 주기로만 그린다 (초당 1000개가 오는 장치도 있어서)
setInterval(() => {
  if (!liveText) return;
  const { index, bytes, prev } = liveText;
  $('live').innerHTML = `#${index} · ` + bytes.map((b, i) => prev && prev[i] !== b ? `<b>${b}</b>` : b).join(' ');
}, 50);
setInterval(() => {
  $('rate').textContent = openedInfo.length ? t('probe.rate', { count: rateCount }) : '';
  rateCount = 0;
}, 1000);

// ─── 녹화 ─────────────────────────────
function intervalStats(times) {
  if (times.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
  gaps.sort((a, b) => a - b);
  const q = p => Math.round(gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] * 1000) / 1000;
  return { count: gaps.length, minMs: q(0), medianMs: q(0.5), p95Ms: q(0.95), maxMs: q(1) };
}

// 시각은 main이 붙인 값(ms)이라 창의 시계와 기준이 다르다. 녹화의 0초는 녹화 중 첫 신호로 잡는다
function startRecording() {
  current = { start: null, times: [], total: 0, changes: [], lastByIndex: {} };
  current.timer = setTimeout(() => stopRecording(), MAX_RECORD_MS);
  render();
}

function stopRecording(skipped = false) {
  if (!current && !skipped) return;
  const id = STEPS[activeStep];
  recordings.push({
    step: id, title: stepText(id).title, mode: $('mode').value.trim(), skipped,
    durationMs: current && current.times.length ? Math.round(current.times[current.times.length - 1] - current.times[0]) : 0,
    totalReports: current ? current.total : 0,
    interval: current ? intervalStats(current.times) : null,
    changes: current ? current.changes : []
  });
  if (current) clearTimeout(current.timer);
  current = null;
  activeStep = Math.min(activeStep + 1, STEPS.length);
  render();
}

// ─── 화면 ─────────────────────────────
function render() {
  if (!window.i18n.ready) return;
  $('device-status').textContent = deviceStatus;
  if (!liveText) $('live').textContent = t('probe.liveEmpty');
  const mode = $('mode').value.trim();
  $('mode-label').textContent = t('probe.currentMode', { mode: mode || t('probe.unnamedMode') });

  const list = $('steps');
  list.replaceChildren();
  STEPS.forEach((id, i) => {
    const { title, hint } = stepText(id);
    const done = recordings.filter(r => r.step === id && r.mode === mode).pop();
    const li = document.createElement('li');
    if (done) li.classList.add(done.skipped ? 'skipped' : 'done');
    if (i === activeStep) li.classList.add('active');
    const mark = document.createElement('span');
    mark.className = 'mark';
    const body = document.createElement('div');
    body.innerHTML = '<div class="title"></div><div class="hint"></div><div class="result"></div>';
    body.querySelector('.title').textContent = `${i + 1}. ${title}`;
    body.querySelector('.hint').textContent = hint;
    body.querySelector('.result').textContent = done ? (done.skipped ? t('probe.skipped') : t('probe.result', { total: done.totalReports, changes: done.changes.length })) : '';
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (i === activeStep) {
      const rec = document.createElement('button');
      rec.type = 'button';
      rec.textContent = current ? t('probe.stop') : t('probe.record');
      rec.className = current ? 'rec' : 'primary';
      rec.disabled = !openedInfo.length;
      rec.onclick = () => current ? stopRecording() : startRecording();
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'secondary';
      skip.textContent = t('probe.skip');
      skip.disabled = !!current;
      skip.onclick = () => stopRecording(true);
      actions.append(rec, skip);
    }
    li.append(mark, body, actions);
    list.append(li);
  });
  if (activeStep >= STEPS.length) {
    const li = document.createElement('li');
    const text = document.createElement('div');
    text.className = 'title';
    text.textContent = t('probe.modeDone');
    li.append(document.createElement('span'), text, document.createElement('span'));
    list.append(li);
  }
  $('device').disabled = !!current;
  $('refresh').disabled = !!current;
  $('restart').disabled = !!current;

  const recorded = recordings.filter(r => !r.skipped).length;
  const modes = [...new Set(recordings.map(r => r.mode || '-'))].join(', ');
  $('summary').textContent = recordings.length ? t('probe.summary', { recorded, skipped: recordings.length - recorded, modes }) : t('probe.summaryEmpty');
  $('save').disabled = !recordings.length || !!current;
}

async function save() {
  const result = {
    tool: 'iidxwidget-controller-probe-app', version: 1,
    createdAt: new Date().toISOString(),
    product: $('product').value.trim(),
    notes: $('notes').value.trim(),
    devices: openedInfo,
    recordings
  };
  const saved = await api.probeSave(result);
  if (!saved) return;
  $('saved').textContent = t('probe.saved', { path: saved.path });
  $('saved').hidden = false;
  $('show-file').hidden = false;
}

$('device').onchange = openSelected;
$('refresh').onclick = refreshDevices;
$('mode').oninput = render;
$('restart').onclick = () => { if (!current) { activeStep = 0; render(); } };
$('save').onclick = save;
$('show-file').onclick = () => api.probeShowFile();
$('open-guide').onclick = () => api.openGuide('CONTROLLER');
document.addEventListener('i18n-changed', render);
refreshDevices();

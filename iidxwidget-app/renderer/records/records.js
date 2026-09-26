const { formatUptime } = window.widgetLogic;
const $ = id => document.getElementById(id);

let records = null;
let lastUploadResult = null;
let uploading = false;

const formatDuration = ms => formatUptime(Math.floor((ms || 0) / 1000));
const formatRelease = value => value === null || value === undefined ? '-' : `${value} ms`;
const formatTime = iso => new Date(iso).toLocaleTimeString();

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function fillTable(tableId, rows, emptyId) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.replaceChildren(...rows.map(values => {
    const tr = document.createElement('tr');
    tr.append(...values.map(cell));
    return tr;
  }));
  $(tableId).hidden = rows.length === 0;
  $(emptyId).hidden = rows.length > 0;
}

function renderToday(today) {
  $('today-date').textContent = today.date;
  $('today-presses').textContent = today.presses;
  $('today-uploaded').textContent = today.uploaded;
  $('today-pending').textContent = today.pending;
  $('today-active').textContent = formatDuration(today.activeMs);
  $('today-release').textContent = formatRelease(today.releaseAvg);
  $('today-chatter').textContent = today.chatter;
  renderUploadButton();
}

function renderUploadButton() {
  if (!records || !window.i18n.ready) return;
  const pending = records.today.pending;
  const button = $('upload-button');
  if (!uploading) button.textContent = window.i18n.t('records.uploadNow', { count: pending });
  button.disabled = uploading || !records.hasToken || pending <= 0;
  $('token-hint').hidden = records.hasToken;
}

function render() {
  if (!records || !window.i18n.ready) return;
  renderToday(records.today);
  $('auto-upload-state').textContent = window.i18n.t(records.autoUploadOnQuit ? 'records.autoUploadOn' : 'records.autoUploadOff');

  fillTable('uploads-table', records.today.uploads.slice().reverse().map(u => [
    formatTime(u.at), u.count, u.dailyTotal ?? '-'
  ]), 'no-uploads');

  fillTable('history-table', records.days.map(d => [
    d.date, d.presses, d.uploaded, d.pending, formatDuration(d.activeMs), formatRelease(d.releaseAvg), d.chatter
  ]), 'no-history');

  renderUploadStatus();
}

function renderUploadStatus() {
  const status = $('upload-status');
  if (!lastUploadResult) {
    status.textContent = '';
    return;
  }
  const result = lastUploadResult;
  status.classList.toggle('error', !result.ok);
  status.textContent = result.ok
    ? window.i18n.t('records.uploadedMessage', { count: result.count, total: result.dailyTotal ?? '-' })
    : window.i18n.t(`records.error.${result.reason}`);
}

async function load() {
  records = await window.electronAPI.getRecords();
  render();
}

// 입력이 들어오는 동안 오늘 숫자를 실시간으로 갱신한다 (날짜가 바뀌면 전체를 다시 불러옴)
window.electronAPI.onStats(stats => {
  if (!records) return;
  if (stats.date !== records.today.date) {
    load();
    return;
  }
  records.today.presses = stats.presses;
  records.today.pending = stats.pending;
  records.today.uploaded = stats.presses - stats.pending;
  records.today.activeMs = stats.activeMs;
  renderToday(records.today);
});

$('upload-button').addEventListener('click', async () => {
  uploading = true;
  $('upload-button').textContent = window.i18n.t('records.uploading');
  renderUploadButton();
  lastUploadResult = await window.electronAPI.uploadNow();
  uploading = false;
  await load();
});

// 활동 시간은 창을 열어 둔 동안 1초마다 늘린다
setInterval(() => {
  if (!records) return;
  records.today.activeMs += 1000;
  $('today-active').textContent = formatDuration(records.today.activeMs);
}, 1000);

document.addEventListener('i18n-changed', render);
load();

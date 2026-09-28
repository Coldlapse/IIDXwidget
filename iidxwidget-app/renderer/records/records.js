const { formatUptime } = window.widgetLogic;
const $ = id => document.getElementById(id);

let data = null;              // { session, hasToken, account, autoUploadOnQuit }
let lastUploadResult = null;
let uploading = false;

const formatDuration = ms => formatUptime(Math.floor((ms || 0) / 1000));
const formatRelease = value => value === null || value === undefined ? '-' : `${value} ms`;
// 날짜·시각은 Windows 언어가 아니라 앱 언어 형식으로 쓴다
const locale = () => (window.i18n.language === 'en' ? 'en-US' : 'ko-KR');
const formatTime = iso => new Date(iso).toLocaleTimeString(locale());

function renderNumbers() {
  const s = data.session;
  $('presses').textContent = s.presses;
  $('sent').textContent = s.sent;
  $('remaining').textContent = s.remaining;
  $('uptime').textContent = formatDuration(s.activeMs);
  $('release').textContent = formatRelease(s.releaseAvg);
  $('chatter').textContent = s.chatter;
  renderUploadButton();
}

function renderUploadButton() {
  if (!data || !window.i18n.ready) return;
  const button = $('upload-button');
  if (!uploading) button.textContent = window.i18n.t('records.uploadNow', { count: data.session.remaining });
  button.disabled = uploading || !data.hasToken || data.session.remaining <= 0;
  $('token-hint').hidden = data.hasToken;
}

// 연결된 계정 (설정에서 토큰을 넣으면 서버에 확인한 계정 이름)
function renderAccount() {
  const account = data.account;
  const line = $('account-line');
  line.hidden = !data.hasToken;
  line.classList.toggle('error', account.tokenInvalid);
  $('account-text').textContent = account.tokenInvalid ? window.i18n.t('records.accountInvalid')
    : account.username ? window.i18n.t('records.account', { username: account.username }) : '';
  $('profile-link').hidden = !account.username || account.tokenInvalid;
  if (account.username) $('profile-link').href = `https://beatmania.app/u/${encodeURIComponent(account.username)}/`;
}

function render() {
  if (!data || !window.i18n.ready) return;
  const s = data.session;
  $('started-at').textContent = window.i18n.t('records.startedAt', { time: new Date(s.startedAt).toLocaleString(locale()) });
  renderNumbers();
  renderAccount();
  $('auto-upload-state').textContent = window.i18n.t(data.autoUploadOnQuit ? 'records.autoUploadOn' : 'records.autoUploadOff');
  // 전송 전에도 줄을 남겨 두어 첫 전송 뒤에 아래 내용이 밀리지 않게 한다
  $('server-total').textContent = s.lastDailyTotal === null
    ? window.i18n.t('records.serverTotalNone')
    : window.i18n.t('records.serverTotal', { total: s.lastDailyTotal });

  const rows = s.uploads.slice().reverse().map(u => [formatTime(u.at), u.count, u.dailyTotal ?? '-']);
  $('uploads-table').querySelector('tbody').replaceChildren(...rows.map(values => {
    const tr = document.createElement('tr');
    tr.append(...values.map(text => {
      const td = document.createElement('td');
      td.textContent = text;
      return td;
    }));
    return tr;
  }));
  $('uploads-table').hidden = rows.length === 0;
  $('no-uploads').hidden = rows.length > 0;

  renderUploadStatus();
}

function renderUploadStatus() {
  const status = $('upload-status');
  const result = lastUploadResult;
  if (!result) {
    status.textContent = '';
    return;
  }
  status.classList.toggle('error', !result.ok);
  if (result.ok) {
    status.textContent = window.i18n.t('records.uploadedMessage', { count: result.count, total: result.dailyTotal ?? '-' });
  } else {
    const error = window.i18n.t(`records.error.${result.reason}`);
    // 나눠 보내다가 중간에 실패한 경우 보낸 양도 알려준다
    status.textContent = result.count ? `${error} ${window.i18n.t('records.partiallySent', { count: result.count })}` : error;
  }
}

async function load() {
  data = await window.electronAPI.getRecords();
  render();
}

// 입력이 들어오는 동안 숫자를 실시간으로 갱신한다
window.electronAPI.onStats(stats => {
  if (!data) return;
  data.session.presses = stats.presses;
  data.session.remaining = stats.remaining;
  data.session.sent = stats.presses - stats.remaining;
  data.session.activeMs = stats.activeMs;
  renderNumbers();
});

$('upload-button').addEventListener('click', async () => {
  uploading = true;
  $('upload-button').textContent = window.i18n.t('records.uploading');
  renderUploadButton();
  lastUploadResult = await window.electronAPI.uploadNow();
  uploading = false;
  await load();
});

// 업타임은 창을 열어 둔 동안 1초마다 늘린다
setInterval(() => {
  if (!data) return;
  data.session.activeMs += 1000;
  $('uptime').textContent = formatDuration(data.session.activeMs);
}, 1000);

document.addEventListener('i18n-changed', render);
window.electronAPI.onAccountChanged(load);
load();

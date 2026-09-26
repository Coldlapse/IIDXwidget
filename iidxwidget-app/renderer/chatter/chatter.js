// 채터링 집계는 앱 본체가 모든 입력에서 계속 하고 있다 (이 창이 닫혀 있어도).
// 이 창은 현재 숫자를 받아서 건반 위에 보여주기만 한다.
const slots = [...document.querySelectorAll('.key-slot')];

function render(counts) {
  let total = 0;
  for (const slot of slots) {
    const count = counts[slot.dataset.button] || 0;
    total += count;
    slot.querySelector('.count').textContent = count;
    slot.classList.toggle('has-chatter', count > 0);
  }
  document.getElementById('total').textContent = total;
  document.querySelector('.total').classList.toggle('has-chatter', total > 0);
}

async function refresh() {
  render(await window.electronAPI.requestChatterSummary());
}

// 입력이 들어올 때마다(묶어서 최대 초당 20번) 새 숫자를 받는다
window.electronAPI.onStats(refresh);
refresh();

document.querySelectorAll('[data-open-guide]').forEach(button =>
  button.addEventListener('click', () => window.electronAPI.openGuide('CHATTER')));


// ⚙ 채터링 감지 설정: 저장하면 앱 본체가 이번 세션 기록을 새 기준으로 바로 다시 센다
const $ = id => document.getElementById(id);
let chatterConfig = null; // { preset, upperMs, lowerMs }
let range = { min: 1, max: 100 };

const selectedPreset = () => document.querySelector('input[name="preset"]:checked')?.value || 'rag';

function describe(config) {
  const t = window.i18n.t;
  return config.preset === 'sadang'
    ? t('chatter.ruleSadang', { lower: config.lowerMs, upper: config.upperMs })
    : t('chatter.ruleRag', { upper: config.upperMs });
}

function renderDescription() {
  if (!chatterConfig || !window.i18n.ready) return;
  $('description').textContent = `${describe(chatterConfig)} ${window.i18n.t('chatter.sessionNote')}`;
}

// 설정 화면의 입력값으로 규칙 한 줄을 미리 보여준다
function renderRulePreview() {
  if (!window.i18n.ready) return;
  const preset = selectedPreset();
  $('lower-row').hidden = preset !== 'sadang';
  const upperMs = parseInt($('upperMs').value, 10);
  const lowerMs = parseInt($('lowerMs').value, 10);
  $('rule').textContent = Number.isInteger(upperMs) && (preset !== 'sadang' || Number.isInteger(lowerMs))
    ? describe({ preset, upperMs, lowerMs }) : '';
}

function fillSettingsForm() {
  document.querySelectorAll('input[name="preset"]').forEach(input => input.checked = input.value === chatterConfig.preset);
  $('upperMs').value = chatterConfig.upperMs;
  $('lowerMs').value = chatterConfig.lowerMs;
  for (const id of ['upperMs', 'lowerMs']) Object.assign($(id), { min: range.min, max: range.max });
  $('settings-status').textContent = '';
  renderRulePreview();
}

function showView(view) {
  const settings = view === 'settings';
  if (settings && chatterConfig) fillSettingsForm();
  $('main-view').hidden = settings;
  $('settings-view').hidden = !settings;
  window.fitWindow?.();
}

async function loadChatterSettings() {
  const result = await window.electronAPI.getChatterSettings();
  chatterConfig = result.config;
  range = result.range;
  renderDescription();
  if (!$('settings-view').hidden) fillSettingsForm();
}

$('open-settings').addEventListener('click', () => showView('settings'));
$('back-button').addEventListener('click', () => showView('main'));
document.querySelectorAll('input[name="preset"]').forEach(input => input.addEventListener('change', () => {
  renderRulePreview();
  window.fitWindow?.();
}));
for (const id of ['upperMs', 'lowerMs']) {
  $(id).addEventListener('input', renderRulePreview);
  $(id).addEventListener('change', renderRulePreview);
}

$('save-button').addEventListener('click', async () => {
  const status = $('settings-status');
  const result = await window.electronAPI.saveChatterSettings({
    preset: selectedPreset(),
    upperMs: parseInt($('upperMs').value, 10),
    lowerMs: parseInt($('lowerMs').value, 10)
  });
  status.classList.toggle('error', !result.ok);
  if (!result.ok) {
    status.textContent = result.error === 'invalid'
      ? window.i18n.t('chatter.invalid', range)
      : window.i18n.t('settings.saveFailed', { message: result.message });
    return;
  }
  chatterConfig = result.config;
  renderDescription();
  renderRulePreview();
  refresh();
  status.textContent = window.i18n.t('chatter.saved');
});

document.addEventListener('i18n-changed', () => {
  renderDescription();
  renderRulePreview();
});
// 설정 창의 '채터링 감지 설정' 링크로 이미 열린 창을 다시 부른 경우
window.electronAPI.onShowChatterView(showView);

loadChatterSettings().then(() => {
  if (new URLSearchParams(location.search).get('view') === 'settings') showView('settings');
});

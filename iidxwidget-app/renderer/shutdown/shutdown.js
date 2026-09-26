// 종료 진행 창. main이 보내 주는 단계 이름(이미 번역됨)과 진행 상황을 보여준다.
const ICONS = { pending: '·', running: '◐', done: '✓', failed: '✕', skipped: '' };
const items = {};

function setStatus(key, status, detail) {
  const item = items[key];
  if (!item) return;
  item.li.className = status;
  item.icon.textContent = ICONS[status] ?? '';
  item.detail.textContent = detail || '';
}

window.electronAPI.onShutdownStart(({ title, steps }) => {
  document.getElementById('title').textContent = title;
  const list = document.getElementById('steps');
  list.replaceChildren();
  for (const { key, label } of steps) {
    const li = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'icon';
    const text = document.createElement('span');
    text.textContent = label;
    const detail = document.createElement('span');
    detail.className = 'detail';
    li.append(icon, text, detail);
    list.append(li);
    items[key] = { li, icon, detail };
    setStatus(key, 'pending');
  }
});

window.electronAPI.onShutdownProgress(({ key, status, detail }) => setStatus(key, status, detail));

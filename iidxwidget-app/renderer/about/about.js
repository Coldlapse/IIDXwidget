// 개발자 정보/기여자 창. 기여자 목록은 번역 사전의 about.contributors('이름 : 한 일' 한 줄에 한 명)에서 만든다.
function renderContributors() {
  const list = document.getElementById('contributors');
  list.replaceChildren(...window.i18n.t('about.contributors').split('\n').filter(Boolean).map(line => {
    const [name, ...role] = line.split(' : ');
    const item = document.createElement('li');
    const nameEl = document.createElement('span');
    nameEl.className = 'name';
    nameEl.textContent = name.trim();
    const roleEl = document.createElement('span');
    roleEl.className = 'role';
    roleEl.textContent = role.join(' : ').trim();
    item.append(nameEl, roleEl);
    return item;
  }));
}

// 사전을 이미 받았으면 바로 그리고, 언어가 바뀌면 다시 그린다
document.addEventListener('i18n-changed', () => { renderContributors(); window.fitWindow(); });
if (window.i18n.ready) { renderContributors(); window.fitWindow(); }
window.iidxapi.getAppVersion().then(version => {
  document.getElementById('version').textContent = `v${version}`;
});

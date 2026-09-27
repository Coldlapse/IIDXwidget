// 가이드 뷰어: main이 받아 온 마크다운(GitHub 최신본 또는 앱에 들어 있는 사본)을 그린다.
const api = window.electronAPI;
const { anchorKey, resolveImage, classifyLink } = window.guideLogic;
const isGuideFile = name => /^[A-Z]+(\.en)?\.md$/.test(name);

const content = document.getElementById('content');
const sourceNote = document.getElementById('source-note');
const githubButton = document.getElementById('open-github');

let current = null; // 마지막으로 불러온 결과 { file, baseUrl, source, pageUrl }

function showStatus(key, isError = false) {
  content.innerHTML = '';
  const p = document.createElement('p');
  p.className = isError ? 'status error' : 'status';
  // 번역 사전을 받기 전이면 i18n.js가 받은 뒤에 채운다
  p.dataset.i18n = key;
  p.textContent = window.i18n.ready ? window.i18n.t(key) : '';
  content.appendChild(p);
}

function updateSourceNote() {
  sourceNote.hidden = current?.source !== 'local';
}

function scrollToAnchor(hash) {
  if (!hash) return window.scrollTo(0, 0);
  const key = anchorKey(hash);
  const target = [...content.querySelectorAll('h1, h2, h3, h4')].find(h => anchorKey(h.textContent) === key);
  if (!target) return;
  target.scrollIntoView({ block: 'start' });
  target.classList.remove('flash');
  void target.offsetWidth;
  target.classList.add('flash');
}

function render(result, hash) {
  const html = marked.parse(result.markdown, { gfm: true });
  content.innerHTML = DOMPurify.sanitize(html);

  content.querySelectorAll('img').forEach(img => {
    const src = resolveImage(img.getAttribute('src'), result.baseUrl);
    if (src) img.src = src;
    else img.remove();
  });

  const title = content.querySelector('h1');
  document.title = title ? title.textContent.trim() : window.i18n.t('guide.menu');
  requestAnimationFrame(() => scrollToAnchor(hash));
}

async function openGuide(file, hash = '') {
  showStatus('guide.loading');
  const result = await api.loadGuide(file);
  current = result;
  updateSourceNote();
  githubButton.hidden = !result.pageUrl;
  if (!result.ok) return showStatus('guide.failed', true);
  render(result, hash);
}

// 링크: 같은 문서 제목 → 스크롤, 다른 가이드 → 뷰어에서 열기, https → 기본 브라우저
content.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  if (!current) return;
  const action = classifyLink(link.getAttribute('href'), current.baseUrl, isGuideFile);
  if (action.kind === 'anchor') scrollToAnchor(action.hash);
  else if (action.kind === 'guide') openGuide(action.file, action.hash);
  else if (action.kind === 'external') api.openExternal(action.url);
});

githubButton.addEventListener('click', () => {
  if (current?.pageUrl) api.openExternal(current.pageUrl);
});

// 이미 열린 뷰어에서 다른 가이드를 열라는 요청 (메뉴, 설정 창 버튼 등)
api.onShowGuide(file => openGuide(file));

// 앱 언어를 바꾸면 같은 가이드의 그 언어 문서로 바꿔 연다
api.onLanguageChanged(language => {
  if (!current?.file) return;
  const id = current.file.replace(/(\.en)?\.md$/, '');
  const next = language === 'en' ? `${id}.en.md` : `${id}.md`;
  if (next !== current.file) openGuide(next);
});

document.getElementById('close-guide').addEventListener('click', () => window.close());

openGuide(new URLSearchParams(location.search).get('file') || 'USAGE.md');

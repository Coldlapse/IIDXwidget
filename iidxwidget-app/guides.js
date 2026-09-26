// 가이드 문서(저장소의 GUIDE/*.md)를 불러온다.
// GitHub 저장소 main 브랜치의 최신본을 먼저 받고, 인터넷이 안 되거나 받지 못하면 앱에 들어 있는 사본을 쓴다.
// Electron에 의존하지 않는 순수 모듈이라 node로 바로 테스트할 수 있다 (받기·읽기 함수는 main이 넘겨준다).

const REPO = 'Coldlapse/IIDXwidget';
const BRANCH = 'main';
const REMOTE_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/GUIDE/`;
const GITHUB_PAGE_BASE = `https://github.com/${REPO}/blob/${BRANCH}/GUIDE/`;
const FETCH_TIMEOUT_MS = 5000;

// 메뉴 순서대로. 파일 이름은 한국어 <ID>.md, 영어 <ID>.en.md
const GUIDE_IDS = ['USAGE', 'CONNECTION', 'RELEASE', 'CHATTER'];

function guideFile(id, language) {
  return language === 'en' ? `${id}.en.md` : `${id}.md`;
}

// 화면 쪽에서 넘어온 파일 이름은 이 목록에 있는 것만 받는다 (임의 경로·주소를 읽지 않도록)
function isGuideFile(name) {
  const match = /^([A-Z]+)(\.en)?\.md$/.exec(String(name));
  return !!match && GUIDE_IDS.includes(match[1]);
}

// 결과: { ok: true, file, markdown, baseUrl, source: 'remote' | 'local', pageUrl } 또는 { ok: false, file }
// fetchText(url, timeoutMs) → 본문 문자열 (실패하면 throw), readLocal(file) → { text, baseUrl } (없으면 throw)
async function loadGuide(file, { fetchText, readLocal }) {
  if (!isGuideFile(file)) return { ok: false, file };
  const pageUrl = GITHUB_PAGE_BASE + file;
  try {
    const markdown = await fetchText(REMOTE_BASE + file, FETCH_TIMEOUT_MS);
    return { ok: true, file, markdown, baseUrl: REMOTE_BASE, source: 'remote', pageUrl };
  } catch (e) {
    // 인터넷이 안 되거나, 아직 저장소에 올라가지 않은 문서(404)면 앱에 들어 있는 사본을 쓴다
  }
  try {
    const { text, baseUrl } = await readLocal(file);
    return { ok: true, file, markdown: text, baseUrl, source: 'local', pageUrl };
  } catch (e) {
    return { ok: false, file, pageUrl };
  }
}

module.exports = { GUIDE_IDS, REMOTE_BASE, GITHUB_PAGE_BASE, guideFile, isGuideFile, loadGuide };

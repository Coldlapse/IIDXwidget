const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { GUIDE_IDS, REMOTE_BASE, guideFile, isGuideFile, loadGuide } = require('../guides');
const { anchorKey, resolveImage, classifyLink } = require('../renderer/guide/guideLogic');

const GUIDE_DIR = path.join(__dirname, '..', '..', 'GUIDE');
const LOCAL_BASE = 'file:///C:/app/resources/GUIDE/';

test('가이드 파일 이름: 언어별, 목록에 있는 것만', () => {
  assert.equal(guideFile('USAGE', 'ko'), 'USAGE.md');
  assert.equal(guideFile('USAGE', 'en'), 'USAGE.en.md');
  assert.ok(isGuideFile('CHATTER.en.md'));
  for (const bad of ['README.md', '../USAGE.md', 'USAGE.md/..', 'usage.md', 'USAGE.ja.md', 'https://x/USAGE.md']) {
    assert.ok(!isGuideFile(bad), bad);
  }
});

test('저장소의 GUIDE 폴더에 모든 가이드가 한/영으로 있다', () => {
  for (const id of GUIDE_IDS) {
    for (const language of ['ko', 'en']) {
      assert.ok(fs.existsSync(path.join(GUIDE_DIR, guideFile(id, language))), guideFile(id, language));
    }
  }
});

test('GitHub 최신본을 먼저, 실패하면 앱에 들어 있는 사본', async () => {
  const readLocal = async file => ({ text: `local ${file}`, baseUrl: LOCAL_BASE });
  const remote = await loadGuide('USAGE.md', { fetchText: async url => `remote ${url}`, readLocal });
  assert.equal(remote.source, 'remote');
  assert.equal(remote.markdown, `remote ${REMOTE_BASE}USAGE.md`);
  assert.equal(remote.baseUrl, REMOTE_BASE);

  const offline = await loadGuide('USAGE.md', { fetchText: async () => { throw new Error('HTTP 404'); }, readLocal });
  assert.equal(offline.source, 'local');
  assert.equal(offline.markdown, 'local USAGE.md');

  const none = await loadGuide('USAGE.md', { fetchText: async () => { throw new Error('x'); }, readLocal: async () => { throw new Error('x'); } });
  assert.equal(none.ok, false);

  let fetched = false;
  const rejected = await loadGuide('../secret.md', { fetchText: async () => { fetched = true; return ''; }, readLocal });
  assert.equal(rejected.ok, false);
  assert.equal(fetched, false);
});

test('이미지 주소: 문서 위치 기준, GitHub 화면 주소는 원본 주소로', () => {
  assert.equal(resolveImage('../images/2.png', REMOTE_BASE), 'https://raw.githubusercontent.com/Coldlapse/IIDXwidget/main/images/2.png');
  assert.equal(resolveImage('../images/2.png', LOCAL_BASE), 'file:///C:/app/resources/images/2.png');
  assert.equal(resolveImage('https://github.com/Coldlapse/IIDXwidget/blob/main/images/3.gif', REMOTE_BASE),
    'https://raw.githubusercontent.com/Coldlapse/IIDXwidget/main/images/3.gif');
});

test('링크: 제목 이동, 다른 가이드, 외부 https', () => {
  const isFile = name => isGuideFile(name);
  assert.deepEqual(classifyLink('#-원컴-연결', REMOTE_BASE, isFile), { kind: 'anchor', hash: '-원컴-연결' });
  assert.deepEqual(classifyLink('CONNECTION.md', REMOTE_BASE, isFile), { kind: 'guide', file: 'CONNECTION.md', hash: '' });
  assert.deepEqual(classifyLink('USAGE.en.md#-settings', LOCAL_BASE, isFile), { kind: 'guide', file: 'USAGE.en.md', hash: '-settings' });
  assert.deepEqual(classifyLink('https://beatmania.app', REMOTE_BASE, isFile), { kind: 'external', url: 'https://beatmania.app/' });
  assert.equal(classifyLink('../README.md', LOCAL_BASE, isFile).kind, 'none');
  assert.equal(classifyLink('javascript:alert(1)', REMOTE_BASE, isFile).kind, 'none');
});

test('제목 키: 이모지·문장부호를 빼고 비교', () => {
  assert.equal(anchorKey('🖥 원컴 연결'), anchorKey('-원컴-연결'));
  assert.equal(anchorKey('❗ When it doesn\'t work'), anchorKey('-when-it-doesnt-work'));
  assert.equal(anchorKey('🔧 Settings'), anchorKey('-settings'));
});

test('가이드 안의 #링크와 다른 가이드 링크가 실제로 있는 곳을 가리킨다', () => {
  for (const file of fs.readdirSync(GUIDE_DIR).filter(isGuideFile)) {
    const text = fs.readFileSync(path.join(GUIDE_DIR, file), 'utf8');
    const headings = [...text.matchAll(/^#{1,4} (.+)$/gm)].map(m => anchorKey(m[1]));
    for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = classifyLink(href, LOCAL_BASE, isGuideFile);
      if (link.kind === 'anchor') assert.ok(headings.includes(anchorKey(link.hash)), `${file}: ${href}`);
      if (link.kind === 'guide') assert.ok(fs.existsSync(path.join(GUIDE_DIR, link.file)), `${file}: ${href}`);
    }
  }
});

// 굵은 글씨: 닫는 ** 앞이 문장부호이고 뒤가 글자이면 GitHub·뷰어 모두 굵게 표시되지 않는다 (예: "(게임 PC)**에서")
test('가이드와 README에 닫히지 않는 굵은 글씨가 없다', () => {
  const files = [...fs.readdirSync(GUIDE_DIR).filter(isGuideFile).map(f => path.join(GUIDE_DIR, f)), path.join(GUIDE_DIR, '..', 'README.md')];
  for (const file of files) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      assert.ok(!/[)\].?!]\*\*[\p{L}\p{N}]/u.test(line), `${path.basename(file)}:${i + 1}: ${line.trim()}`);
    });
  }
});

// 물결표: 한 줄에 ~가 둘 이상이면 GitHub·뷰어 모두 그 사이를 취소선으로 그린다 (예: "140~150대 … 40~50대"). 범위는 \~로 쓴다
test('가이드와 README에 취소선으로 바뀌는 물결표가 없다', () => {
  const files = [...fs.readdirSync(GUIDE_DIR).filter(isGuideFile).map(f => path.join(GUIDE_DIR, f)), path.join(GUIDE_DIR, '..', 'README.md')];
  for (const file of files) {
    let inCode = false;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('```')) inCode = !inCode;
      if (inCode) return;
      const tildes = line.replace(/`[^`]*`/g, '').replace(/\\~/g, '').split('~').length - 1;
      assert.ok(tildes < 2, `${path.basename(file)}:${i + 1}: ${line.trim()}`);
    });
  }
});

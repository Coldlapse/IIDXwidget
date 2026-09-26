// 가이드 뷰어의 주소 처리. 브라우저와 node 테스트에서 함께 쓴다.
(function (root) {
  // 제목과 #링크를 맞춰 볼 때 쓰는 키: 글자·숫자만 남긴다 (GitHub의 제목 주소는 이모지·문장부호를 빼고 띄어쓰기를 -로 바꾼다)
  function anchorKey(text) {
    let value = String(text);
    try { value = decodeURIComponent(value); } catch (e) {}
    return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }

  // GitHub 파일 화면 주소(github.com/<저장소>/blob/<브랜치>/<경로>)는 이미지 원본 주소로 바꾼다
  function toRawGithub(url) {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url);
    return match ? `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}` : url;
  }

  // 문서 안의 이미지 주소를 문서 위치 기준으로 풀어 쓴다
  function resolveImage(src, baseUrl) {
    try {
      return toRawGithub(new URL(src, baseUrl).href);
    } catch (e) {
      return null;
    }
  }

  // 문서 안의 링크를 어떻게 처리할지 정한다
  //   { kind: 'anchor', hash }             같은 문서 안의 제목으로 이동
  //   { kind: 'guide', file, hash }        다른 가이드를 뷰어에서 열기
  //   { kind: 'external', url }            기본 브라우저로 열기 (https만)
  //   { kind: 'none' }                     무시
  function classifyLink(href, baseUrl, isGuideFile) {
    if (!href) return { kind: 'none' };
    if (href.startsWith('#')) return { kind: 'anchor', hash: href.slice(1) };
    let url;
    try { url = new URL(href, baseUrl); } catch (e) { return { kind: 'none' }; }
    const base = new URL('.', baseUrl).href;
    if (url.href.split('#')[0].startsWith(base)) {
      const file = url.pathname.split('/').pop();
      if (isGuideFile(file)) return { kind: 'guide', file, hash: url.hash.slice(1) };
    }
    if (url.protocol === 'https:') return { kind: 'external', url: url.href };
    return { kind: 'none' };
  }

  const api = { anchorKey, toRawGithub, resolveImage, classifyLink };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.guideLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

// 사용자 이미지 주소('/userImages/<파일>')를 지금 페이지에서 쓸 수 있는 주소로 바꾼다.
// - OBS 브라우저 소스(http://<PC>:<포트>/widget/): 같은 서버이므로 그대로 쓴다
// - 앱 창·설정 창(file://): 앱의 HTTP 서버 주소를 붙인다
(function (root) {
  function resolveImageUrl(imagePath, { protocol, serverPort }) {
    if (!imagePath) return '';
    if (protocol === 'file:' && imagePath.startsWith('/')) return `http://127.0.0.1:${serverPort}${imagePath}`;
    return imagePath;
  }

  const api = { resolveImageUrl };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.imageUrl = api;
})(typeof window !== 'undefined' ? window : globalThis);

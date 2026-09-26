// 창 높이를 내용에 맞춘다 (채터링·세션 기록 창).
// 글꼴을 다 불러온 뒤, 번역이 바뀐 뒤, 전송 내역이 늘어난 뒤 등 내용 높이가 바뀔 때마다 다시 맞춘다.
(function () {
  const fit = () => window.electronAPI?.fitWindowHeight(Math.ceil(document.body.getBoundingClientRect().height));
  new ResizeObserver(fit).observe(document.body);
  document.fonts?.ready.then(fit);
  window.addEventListener('load', fit);
})();

// 창 높이를 이 언어의 내용 높이에 맞춘다 (채터링·세션 기록 창).
// 언어마다 문장 길이가 달라 줄 수가 바뀌므로, 글꼴을 불러온 뒤와 언어를 바꾼 뒤에만 맞춘다.
// 화면 자체가 바뀔 때(채터링 창의 설정 화면 등)는 window.fitWindow()를 부른다.
// 그 밖에 내용이 바뀌어도 창은 그대로이고, 넘치는 부분은 창 안에서 스크롤한다.
(function () {
  const fit = () => setTimeout(() => {
    if (!window.i18n?.ready) return;
    window.electronAPI?.fitWindowHeight(Math.ceil(document.body.getBoundingClientRect().height));
  }, 0);
  window.fitWindow = fit;
  document.addEventListener('i18n-changed', fit);
  document.fonts?.ready.then(fit);
})();

// 오버레이 스크롤바: 기본 스크롤바는 숨기고, 내용이 넘칠 때만 오른쪽 가장자리 위에 얇은 막대를 덧댄다.
// 기본 스크롤바처럼 자리를 차지하지 않으므로, 막대가 생기거나 없어져도 내용 위치가 바뀌지 않는다.
// 쓰는 곳:
//   <html data-overlay-scroll>          창 전체 스크롤
//   <div data-overlay-scroll>           그 영역만 스크롤 (영역에 overflow-y: auto 필요)
// 휠·키보드 스크롤은 기본 동작 그대로이고, 막대는 끌어서 움직일 수 있다.
(function () {
  const MIN_THUMB = 24;

  function attach(scroller, isPage) {
    const bar = document.createElement('div');
    bar.className = 'overlay-scrollbar';
    bar.hidden = true;
    const thumb = document.createElement('div');
    thumb.className = 'overlay-scrollbar-thumb';
    bar.appendChild(thumb);
    document.body.appendChild(bar);

    let thumbHeight = 0;

    function update() {
      const total = scroller.scrollHeight;
      const visible = scroller.clientHeight;
      if (total <= visible + 1) {
        bar.hidden = true;
        return;
      }
      bar.hidden = false;
      const rect = isPage ? { top: 0, right: window.innerWidth, height: window.innerHeight } : scroller.getBoundingClientRect();
      bar.style.top = `${rect.top}px`;
      bar.style.left = `${rect.right - bar.offsetWidth}px`;
      bar.style.height = `${rect.height}px`;
      thumbHeight = Math.max(MIN_THUMB, rect.height * visible / total);
      const ratio = scroller.scrollTop / (total - visible);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${ratio * (rect.height - thumbHeight)}px)`;
    }

    // 막대 끌기
    thumb.addEventListener('pointerdown', event => {
      event.preventDefault();
      thumb.setPointerCapture(event.pointerId);
      bar.classList.add('dragging');
      const startY = event.clientY;
      const startTop = scroller.scrollTop;
      const move = e => {
        const track = bar.clientHeight - thumbHeight;
        if (track > 0) scroller.scrollTop = startTop + (e.clientY - startY) * (scroller.scrollHeight - scroller.clientHeight) / track;
      };
      const end = () => {
        bar.classList.remove('dragging');
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', end);
        thumb.removeEventListener('pointercancel', end);
      };
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', end);
      thumb.addEventListener('pointercancel', end);
    });

    (isPage ? window : scroller).addEventListener('scroll', update, { passive: true });
    // 영역 스크롤은 창 전체가 스크롤될 때 위치도 따라가야 한다
    if (!isPage) window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // 내용이 늘거나 줄 때 (번역, 전송 내역, 로그 추가, 프로필 전환 등)
    const resize = new ResizeObserver(update);
    resize.observe(scroller);
    [...scroller.children].forEach(child => resize.observe(child));
    // 막대 자신의 변화(위치·표시)는 무시한다. 무시하지 않으면 update가 자기 변화로 다시 불려 끝없이 돈다
    new MutationObserver(mutations => {
      if (mutations.every(m => m.target.closest?.('.overlay-scrollbar') || m.target.parentElement?.closest('.overlay-scrollbar'))) return;
      [...scroller.children].forEach(child => resize.observe(child));
      update();
    }).observe(scroller, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class'] });
    document.fonts?.ready.then(update);
    update();
  }

  function init() {
    if (document.documentElement.hasAttribute('data-overlay-scroll')) attach(document.scrollingElement, true);
    document.querySelectorAll('body [data-overlay-scroll]').forEach(el => attach(el, false));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

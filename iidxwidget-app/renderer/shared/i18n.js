// 설정/로그/채터링 창의 번역.
// 번역 사전은 main 프로세스의 localization/translations.js 하나만 두고 IPC로 받아 쓴다.
// 사전을 받기 전에는 HTML에 적힌 한국어 문구를 그대로 두고, 받으면 'i18n-changed'를 알린다.
(function () {
  let dictionaries = null;
  let language = 'ko';

  const normalize = value => value === 'en' ? 'en' : 'ko';
  const getNested = (object, key) => key.split('.').reduce((value, part) => value && value[part], object);

  // 없는 키면 한국어 → 키 이름 순으로 대체
  function t(key, values = {}) {
    const value = getNested(dictionaries?.[language], key) ?? getNested(dictionaries?.ko, key) ?? key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  }

  function apply(next) {
    language = normalize(next);
    document.documentElement.lang = language;
    if (!dictionaries) return;
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
    document.querySelectorAll('[data-i18n-title]').forEach(el => el.title = t(el.dataset.i18nTitle));
    document.dispatchEvent(new CustomEvent('i18n-changed'));
  }

  window.i18n = {
    t,
    apply,
    get language() { return language; },
    // 사전을 받았는지. 받기 전에 동적으로 문구를 바꾸는 코드는 'i18n-changed'를 기다린다
    get ready() { return !!dictionaries; }
  };

  const api = window.electronAPI;
  if (!api?.getTranslations) return;
  Promise.all([api.getTranslations(), api.getLanguage()])
    .then(([loaded, current]) => {
      dictionaries = loaded;
      apply(current);
    })
    .catch(error => console.error('[i18n] 번역 사전을 불러오지 못했습니다.', error));
  api.onLanguageChanged?.(apply);
})();

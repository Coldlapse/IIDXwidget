// 설정/로그/채터링 창의 번역.
// 번역 사전은 main 프로세스의 localization/translations.js 하나만 두고 IPC로 받아 쓴다.
(function () {
  let dictionaries = null;
  let language = 'ko';

  const normalize = value => value === 'en' ? 'en' : 'ko';
  const getNested = (object, key) => key.split('.').reduce((value, part) => value && value[part], object);

  // 사전을 받기 전이거나 없는 키면 한국어 → 키 이름 순으로 대체
  function t(key, values = {}) {
    const value = getNested(dictionaries?.[language], key) ?? getNested(dictionaries?.ko, key) ?? key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  }

  function apply(next) {
    language = normalize(next);
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
    document.dispatchEvent(new CustomEvent('i18n-changed'));
  }

  window.i18n = { t, apply, get language() { return language; } };

  const api = window.electronAPI;
  if (!api?.getTranslations) return;
  Promise.all([api.getTranslations(), api.getLanguage()]).then(([loaded, current]) => {
    dictionaries = loaded;
    apply(current);
  });
  api.onLanguageChanged?.(apply);
})();

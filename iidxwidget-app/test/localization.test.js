const assert = require('assert');
const fs = require('fs');
const { translations, normalizeLanguage, translate } = require('../localization/translations');
assert.equal(normalizeLanguage(), 'ko');
assert.equal(normalizeLanguage('invalid'), 'ko');
assert.equal(translate('en', 'menu.settings'), 'Settings');
translations.en.__fallbackTest = undefined; translations.ko.__fallbackTest = '한국어';
assert.equal(translate('en', '__fallbackTest'), '한국어');
['menu.main','menu.language','menu.settings','menu.logs','menu.checkUpdates','menu.restart','menu.quit','common.ok','update.availableTitle','settings.title','settings.controllerProfile','settings.genericMapping','settings.turntableClockwise','settings.turntableCounterclockwise','settings.containerBackground','settings.transparentContainer','readme.title','readme.obsSetup','readme.obsInstructions'].forEach(key => {
  assert.notEqual(translate('ko', key), key); assert.notEqual(translate('en', key), key);
});
const main = fs.readFileSync(require.resolve('../main'), 'utf8');
const setLanguageBody = main.slice(main.indexOf('function setLanguage'), main.indexOf('function restartApp'));
assert.ok(!/startConfiguredController|restartApp|startServer|startWebSocketServer/.test(setLanguageBody));
assert.ok(main.includes("case 'AUTO'"));
for (const value of ['AUTO','PHOENIXWAN','FPS EMP Gen2','KB']) assert.ok(main.includes(value));
console.log('localization tests passed');

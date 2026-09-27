const test = require('node:test');
const assert = require('assert');
const { paletteFromPixels, isPalette, rgbToOklab, PALETTE_KEYS } = require('../renderer/shared/palette');
const { widgetColors } = require('../renderer/widget/logic');
const { DEFAULT_SETTINGS, withDefaults, applyUpdate } = require('../settingsStore');

// size×size 이미지: 가운데 원(반지름 비율 r) 안은 inner, 밖은 outer 색. 색이 null이면 투명
function image(size, outer, inner = outer, r = 0.35) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
    const color = Math.hypot(dx, dy) < r ? inner : outer;
    const i = (y * size + x) * 4;
    if (color) { data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255; }
  }
  return data;
}
const lab = hex => rgbToOklab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
const hueDeg = hex => { const [, a, b] = lab(hex); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
const chroma = hex => { const [, a, b] = lab(hex); return Math.hypot(a, b); };

test('추천 색상: 여섯 가지 색이 모두 나오고, 배경은 어둡고 글자·입력 중 색은 밝다', () => {
  const p = paletteFromPixels(image(32, [120, 60, 180]), 32, 32); // 보라
  assert.ok(isPalette(p));
  assert.deepEqual(Object.keys(p).sort(), [...PALETTE_KEYS].sort());
  assert.ok(lab(p.containerBackground)[0] < 0.25 && lab(p.background)[0] < 0.3);
  assert.ok(lab(p.fontColor)[0] > 0.9 && lab(p.activeColor)[0] > 0.75);
  assert.ok(lab(p.activeColor)[0] - lab(p.accent)[0] > 0.3); // 누른 건반과 안 누른 건반이 확실히 구분된다
});

test('추천 색상: 배경 색조는 이미지의 대표 색을 따른다', () => {
  const purple = paletteFromPixels(image(32, [120, 60, 180]), 32, 32);
  const green = paletteFromPixels(image(32, [40, 150, 70]), 32, 32);
  assert.ok(Math.abs(hueDeg(purple.background) - hueDeg('#7a3cb4')) < 20);
  assert.ok(Math.abs(hueDeg(green.background) - hueDeg('#289646')) < 20);
});

test('추천 색상: 가운데(주인공)의 눈에 띄는 색이 입력 중 색이 된다', () => {
  // 넓은 회청색 배경 + 가운데 주황
  const p = paletteFromPixels(image(48, [90, 100, 120], [255, 140, 30], 0.3), 48, 48);
  const h = hueDeg(p.activeColor);
  assert.ok(h > 30 && h < 90, `입력 중 색 색조 ${h}`);
});

test('추천 색상: 무채색 이미지는 무채색에 가까운 배경, 롱노트는 알아보기 쉬운 색', () => {
  const p = paletteFromPixels(image(32, [40, 40, 40], [200, 200, 200]), 32, 32);
  assert.ok(chroma(p.background) < 0.02 && chroma(p.accent) < 0.02);
  assert.ok(chroma(p.lnColor) > 0.07);
});

test('추천 색상: 투명한 부분은 무시하고, 전부 투명하면 null. 같은 이미지는 항상 같은 결과', () => {
  const p = paletteFromPixels(image(32, null, [40, 150, 70], 0.4), 32, 32);
  assert.ok(Math.abs(hueDeg(p.background) - hueDeg('#289646')) < 20);
  assert.equal(paletteFromPixels(image(16, null), 16, 16), null);
  const pixels = image(32, [120, 60, 180], [255, 200, 60]);
  assert.deepEqual(paletteFromPixels(pixels, 32, 32), paletteFromPixels(pixels, 32, 32));
});

// ─── 핵심: 직접 고른 색은 추천 색 때문에 바뀌지 않는다 ─────────────
const MY_COLORS = { containerBackground: '#101010', background: '#202020', accent: '#303030', fontColor: '#eeeeee', activeColor: '#ff00ff', lnColor: '#00ffff' };
const PALETTE = { containerBackground: '#18081b', background: '#2a122d', accent: '#5e3664', fontColor: '#f6e5f8', activeColor: '#dda8e5', lnColor: '#fba773' };

test('기존 사용자: 업데이트해도 추천 색상은 꺼져 있고, 직접 고른 색을 그대로 쓴다', () => {
  const settings = withDefaults({ widget: { colors: MY_COLORS, discImagePath: '/userImages/disc_1.png' } });
  assert.equal(DEFAULT_SETTINGS.widget.autoPalette, false);
  assert.equal(settings.widget.autoPalette, false);
  assert.deepEqual(settings.widget.colors, MY_COLORS);
  assert.deepEqual(widgetColors(settings.widget), MY_COLORS);
});

test('추천 색상을 켜도 저장된 직접 고른 색은 그대로이고, 끄면 그 색으로 돌아간다', () => {
  let settings = withDefaults({ widget: { colors: MY_COLORS, discImagePath: '/userImages/disc_1.png' } });
  // 설정 화면은 켠 상태로 저장할 때 colors에 불러온 직접 고른 색을 그대로 보낸다
  settings = applyUpdate(settings, { widget: { autoPalette: true, paletteColors: PALETTE, colors: { ...MY_COLORS } } });
  assert.deepEqual(settings.widget.colors, MY_COLORS);
  assert.deepEqual(widgetColors(settings.widget), PALETTE);
  settings = applyUpdate(settings, { widget: { autoPalette: false, paletteColors: null, colors: { ...MY_COLORS } } });
  assert.deepEqual(widgetColors(settings.widget), MY_COLORS);
});

test('위젯 색: 이미지를 지웠거나 추천 색이 올바르지 않으면 직접 고른 색', () => {
  assert.deepEqual(widgetColors({ autoPalette: true, paletteColors: PALETTE, discImagePath: null, colors: MY_COLORS }), MY_COLORS);
  assert.deepEqual(widgetColors({ autoPalette: true, paletteColors: { ...PALETTE, accent: 'red' }, discImagePath: '/userImages/a.png', colors: MY_COLORS }), MY_COLORS);
  assert.deepEqual(widgetColors({ autoPalette: false, paletteColors: PALETTE, discImagePath: '/userImages/a.png', colors: MY_COLORS }), MY_COLORS);
});

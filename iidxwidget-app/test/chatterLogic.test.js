const test = require('node:test');
const assert = require('assert');
const { findOutliers } = require('../renderer/chatter/chatterLogic');

test('그룹(1·3·5·7 / 2·4·6) 평균의 2배 이상인 건반만 강조', () => {
  // 흰 건반 평균 (20+20+20+70)/4 = 32.5 → 70만 2배 이상
  assert.deepEqual(findOutliers({ 1: 20, 3: 20, 5: 20, 7: 70, 2: 30, 4: 30, 6: 30 }), ['7']);
  // 검은 건반만 높아도, 검은 건반끼리 비슷하면 강조 없음
  assert.deepEqual(findOutliers({ 1: 10, 3: 10, 5: 10, 7: 10, 2: 60, 4: 55, 6: 65 }), []);
  // 검은 건반 평균 (15+15+60)/3 = 30 → 60 (정확히 2배)도 강조
  assert.deepEqual(findOutliers({ 1: 10, 3: 10, 5: 10, 7: 10, 2: 15, 4: 15, 6: 60 }), ['6']);
});

test('DP: 2P 건반은 2P끼리 비교', () => {
  const counts = { 1: 20, 3: 20, 5: 20, 7: 20, 2: 20, 4: 20, 6: 20, 'p2-1': 10, 'p2-3': 10, 'p2-5': 10, 'p2-7': 50 };
  assert.deepEqual(findOutliers(counts), ['p2-7']);
});

test('각 그룹은 그 그룹 평균이 10회 이상일 때만 강조', () => {
  assert.deepEqual(findOutliers({}), []);
  // 한 건반만 1회: 그룹 평균 미달이라 강조 없음
  assert.deepEqual(findOutliers({ 3: 1 }), []);
  // 흰 건반 평균 9.75: 7이 튀어도 아직 강조 없음
  assert.deepEqual(findOutliers({ 1: 3, 3: 3, 5: 3, 7: 30 }), []);
  // 흰 건반 평균 13.75 → 7 강조. 검은 건반은 평균 미달이라 따로 강조 없음 (다른 그룹과 상관없음)
  assert.deepEqual(findOutliers({ 1: 5, 3: 5, 5: 5, 7: 40, 2: 1, 4: 1, 6: 20 }), ['7']);
  // 검은 건반도 평균 10이 되면 그 그룹도 강조
  assert.deepEqual(findOutliers({ 1: 5, 3: 5, 5: 5, 7: 40, 2: 5, 4: 5, 6: 20 }), ['7', '6']);
});

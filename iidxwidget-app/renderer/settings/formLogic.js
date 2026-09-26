// 설정 화면의 입력 검증. 브라우저에서는 window.formLogic, node(테스트)에서는 module.exports로 쓴다.
(function (root) {
  const PORT_RANGE = { min: 1024, max: 65535 };
  const MA_LENGTH_RANGE = { min: 10, max: 5000 };
  const CN_THRESHOLD_RANGE = { min: 100, max: 500 };
  const MAX_PHYSICAL_BUTTON = 64;

  const inRange = (value, { min, max }) => Number.isInteger(value) && value >= min && value <= max;

  // 일반 컨트롤러 매핑 칸들 → 매핑. 빈 칸은 매핑 해제, 같은 물리 버튼을 여러 키에 넣으면 duplicates로 알린다.
  // entries: [{ key: '1' | ... | 'SCup' | 'SCdown', value: '<입력값>' }]
  function buildGenericMapping(entries) {
    const mapping = {};
    const invalid = [];
    const usedBy = {};
    for (const { key, value } of entries) {
      const text = String(value ?? '').trim();
      if (!text) continue;
      const button = Number(text);
      if (!Number.isInteger(button) || button < 1 || button > MAX_PHYSICAL_BUTTON) {
        invalid.push(key);
        continue;
      }
      mapping[key] = button;
      (usedBy[button] ||= []).push(key);
    }
    const duplicates = Object.values(usedBy).filter(keys => keys.length > 1);
    return { mapping, invalid, duplicates };
  }

  function validatePorts(serverPort, webSocketPort) {
    return inRange(serverPort, PORT_RANGE) && inRange(webSocketPort, PORT_RANGE) && serverPort !== webSocketPort;
  }

  function validateMALength(value) {
    return inRange(value, MA_LENGTH_RANGE);
  }

  function validateCnThreshold(value) {
    return inRange(value, CN_THRESHOLD_RANGE);
  }

  const api = { buildGenericMapping, validatePorts, validateMALength, validateCnThreshold, PORT_RANGE, MA_LENGTH_RANGE, CN_THRESHOLD_RANGE, MAX_PHYSICAL_BUTTON };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.formLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

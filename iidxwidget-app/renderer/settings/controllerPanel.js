// 설정 창의 사이드별 컨트롤러 구역 (SP는 1P 하나, DP는 1P·2P 두 개).
// 프로필·장치 선택, LR2 감지, 턴테이블 방향 반전(미니 원판 미리보기), 키보드 매핑,
// 기타 컨트롤러 매핑(버튼 학습, 턴테이블 축 학습)을 한 사이드씩 다룬다.
// 기타 컨트롤러 매핑 학습은 앱에서 한 번에 한 사이드만 할 수 있어서, 칸을 누른 사이드로 학습을 옮긴다.
(function () {
  const api = window.electronAPI;
  const t = (key, values) => window.i18n.t(key, values);
  let activeLearning = null; // 지금 버튼을 기다리는 { panel, input }
  let sessionSide = null;    // 매핑 학습 중인 사이드
  const TURNTABLE_KEYS = ['SCup', 'SCdown'];
  // 버튼 학습 중 아날로그 축 감지: 축 값이 바뀌면 한 바이트의 여러 비트가 짧은 시간에 잇달아 켜졌다 꺼진다.
  // AXIS_WINDOW_MS 안에 같은 바이트에서 서로 다른 비트 AXIS_MIN_BITS개 이상, 변화 AXIS_MIN_EVENTS번 이상이면 축으로 본다
  const AXIS_WINDOW_MS = 400;
  const AXIS_MIN_BITS = 3;
  const AXIS_MIN_EVENTS = 6;

  function mappingLabel(key) {
    if (key === 'SCup') return t('settings.turntableClockwise');
    if (key === 'SCdown') return t('settings.turntableCounterclockwise');
    return t('settings.logicalKey', { key });
  }

  // 위젯과 같은 계산 (renderer/widget/logic.js의 discDelta)
  function discDelta(previous, next) {
    let delta = (next - previous + 256) % 256;
    if (delta > 127) delta -= 256;
    return delta;
  }

  function createControllerPanel(side) {
    const root = document.querySelector(`.controller-side[data-side="${side}"]`);
    root.append(document.getElementById('controller-side-template').content.cloneNode(true));
    const q = role => root.querySelector(`[data-role="${role}"]`);
    let genericAxis = null;
    let savedDevice = null;
    let savedSerial = null;
    let mappingSession = null;
    let previewOn = false;
    let previewKey = null; // 지금 미리보기 중인 { 프로필, 장치, 축, LR2 } (같으면 다시 열지 않음)
    let recentBits = [];   // 최근 물리 버튼 변화 { byte, bit, time } (축 감지용)
    let lastLearned = null; // 방금 학습으로 채운 칸 { input, previous, byte, time } (축이면 되돌림)
    // 미니 원판: 위젯과 같은 방향으로 돈다 (값이 줄면 시계 방향)
    const disc = { last: null, rotation: 0, frame: null, idleTimer: null };

    const profile = () => q('profile').value;
    // 수동 매핑 턴테이블: 'button'(버튼 턴테이블) 또는 'analog'(학습한 축)
    const turntableInput = () => (q('tt-mode').checked ? 'analog' : 'button');

    function applyTurntableMode() {
      const analog = turntableInput() === 'analog';
      q('tt-button-section').hidden = analog;
      q('tt-analog-section').hidden = !analog;
      q('tt-mode-button').classList.toggle('active', !analog);
      q('tt-mode-analog').classList.toggle('active', analog);
      renderSessionStatus();
      refreshPreview();
    }
    const devicePath = () => q('device').value || null;
    const mappingEntries = () => [...root.querySelectorAll('.generic-mapping-table input')].map(input => ({ key: input.dataset.key, value: input.value }));

    function setStatus(message, { warning = false } = {}) {
      const status = q('mapping-status');
      status.textContent = message;
      status.classList.toggle('warning', warning);
    }

    function renderSessionStatus() {
      if (!mappingSession || !window.i18n.ready) return;
      if (mappingSession.status === 'none') setStatus(t('settings.mappingNoDevice'), { warning: true });
      else if (mappingSession.status === 'officialOnly') setStatus(t('settings.mappingOfficialOnly'), { warning: true });
      // '매핑할 컨트롤러' 표시는 아날로그 턴테이블(축 학습)에서만. 버튼 턴테이블에서는 비워 둔다 (장치 문제 경고는 그대로)
      else setStatus(turntableInput() === 'analog' ? t('settings.mappingReady', { device: mappingSession.device }) : '');
    }

    async function startSession() {
      sessionSide = side;
      mappingSession = await api.startMappingSession(side, devicePath());
      renderSessionStatus();
      refreshPreview({ force: true }); // 학습 리더를 새로 열면 거기에 붙은 미리보기도 다시 연다
    }

    function stopSession() {
      if (activeLearning?.panel === panel) activeLearning = null;
      if (sessionSide !== side) return;
      sessionSide = null;
      mappingSession = null;
      api.stopMappingSession();
    }

    function setAxis(byteIndex) {
      genericAxis = Number.isInteger(byteIndex) ? byteIndex : null;
      q('axis-value').textContent = genericAxis === null
        ? (window.i18n.ready ? t('settings.axisNone') : '')
        : t('settings.axisByte', { index: genericAxis });
      refreshPreview();
    }

    // 미니 원판: 설정 창에서 고른 프로필·장치를 따로 읽어 돌린다 (저장 전에도 바로 확인)
    // 기타 컨트롤러는 매핑 학습 중인 사이드에서 축을 학습했을 때만
    async function refreshPreview({ force = false } = {}) {
      const p = profile();
      let options = null;
      if (!root.hidden && p !== 'KB') {
        if (p !== 'AUTO') options = { profile: p, devicePath: devicePath(), lr2ModeEnabled: q('lr2').checked };
        else if (sessionSide === side && genericAxis !== null && turntableInput() === 'analog') options = { profile: p, byteIndex: genericAxis };
      }
      const key = options && JSON.stringify(options);
      if (!force && key === previewKey) return;
      previewKey = key;
      disc.last = null;
      if (!options) {
        if (previewOn) api.stopTurntablePreview(side);
        previewOn = false;
        return;
      }
      previewOn = await api.startTurntablePreview(side, options);
    }

    function spinDisc(value, reversed) {
      if (disc.last !== null) {
        const delta = discDelta(disc.last, value) * (reversed ? -1 : 1);
        disc.rotation -= delta * 2.5;
        if (!disc.frame) disc.frame = requestAnimationFrame(() => {
          disc.frame = null;
          q('tt-disc').style.transform = `rotate(${disc.rotation}deg)`;
        });
      }
      disc.last = value;
      // 입력이 들어오는 동안만 원판을 또렷하게
      q('tt-preview').classList.remove('idle');
      clearTimeout(disc.idleTimer);
      disc.idleTimer = setTimeout(() => q('tt-preview').classList.add('idle'), 1500);
    }

    function renderReverseHelp() {
      if (!window.i18n.ready) return;
      q('reverse-help').textContent = t(profile() === 'AUTO' ? 'settings.turntableReverseHelpGeneric' : 'settings.turntableReverseHelp');
    }

    // 장치 드롭다운: 연결된 장치만 보여준다 (1개면 1개만). 없으면 '연결된 장치 없음'
    async function refreshDevices() {
      const select = q('device');
      const current = select.value || savedDevice;
      const { devices } = await api.listControllerDevices(profile());
      select.replaceChildren(...(devices.length ? devices : [{ path: '', name: t('settings.noDevice') }]).map(d => {
        const option = document.createElement('option');
        option.value = d.path;
        option.dataset.serial = d.serial || '';
        option.textContent = d.name;
        return option;
      }));
      select.disabled = !devices.length;
      // 저장된 경로가 없으면(다른 USB 포트에 꽂은 경우) 같은 시리얼의 장치를 고른다
      const match = devices.find(d => d.path === current) || (savedSerial && devices.find(d => d.serial === savedSerial));
      if (match) select.value = match.path;
    }

    function applyProfileUI() {
      const p = profile();
      q('kb-container').hidden = p !== 'KB';
      q('generic-container').hidden = p !== 'AUTO';
      q('device-row').hidden = p === 'KB';
      q('lr2-row').hidden = !(p === 'PHOENIXWAN' || p === 'FPS EMP Gen2' || p === 'PHOENIXWAN LMT Classic');
      q('reverse-row').hidden = p === 'KB';
      q('kb-wayland').hidden = !(p === 'KB' && window.platformInfo?.wayland);
      q('reverse-help').hidden = p === 'KB';
      // 기타 컨트롤러는 반전이 축(아날로그 턴테이블)에만 적용되므로 아날로그 턴테이블 구역의 축 학습 줄 밑에 둔다
      (p === 'AUTO' ? q('axis-help') : q('lr2-row')).after(q('reverse-row'), q('reverse-help'));
      renderReverseHelp();
    }

    async function onProfileChanged() {
      applyProfileUI();
      if (profile() !== 'KB') await refreshDevices();
      if (profile() === 'AUTO') startSession();
      else stopSession();
      refreshPreview();
    }

    q('profile').addEventListener('change', onProfileChanged);
    q('device').addEventListener('change', () => { if (profile() === 'AUTO') startSession(); else refreshPreview(); });
    q('lr2').addEventListener('change', () => refreshPreview());
    q('refresh').addEventListener('click', async () => {
      await refreshDevices();
      if (profile() === 'AUTO') startSession();
      else refreshPreview({ force: true }); // 컨트롤러를 새로 꽂은 경우 다시 연다
    });

    // 기타 컨트롤러 매핑: 칸을 누르면 그 사이드로 학습을 옮기고 버튼을 기다린다
    root.querySelectorAll('.generic-mapping-table input').forEach(input => {
      input.addEventListener('focus', () => {
        if (profile() !== 'AUTO') return;
        if (sessionSide !== side) startSession();
        activeLearning = { panel, input };
        setStatus(t('settings.listening', { key: mappingLabel(input.dataset.key) }));
      });
      // 다른 곳으로 옮기면 학습을 멈춘다 (누른 버튼이 이전 칸에 들어가지 않도록)
      input.addEventListener('blur', () => {
        if (activeLearning?.input === input) activeLearning = null;
      });
    });

    q('learn-axis').addEventListener('click', async () => {
      const button = q('learn-axis');
      if (sessionSide !== side) await startSession();
      button.disabled = true;
      setStatus(t('settings.axisLearning'));
      const result = await api.learnTurntableAxis(side);
      button.disabled = false;
      if (result) {
        setAxis(result.byteIndex);
        setStatus(t('settings.axisLearned', { index: result.byteIndex }));
      } else {
        setStatus(t('settings.axisNotFound'), { warning: true });
      }
    });
    q('clear-axis').addEventListener('click', () => setAxis(null));
    q('tt-mode').addEventListener('change', applyTurntableMode);

    // 키보드 매핑: 칸에서 누른 키를 적는다
    root.querySelectorAll('.key-mapping-table input').forEach(input => {
      input.addEventListener('keydown', event => {
        event.preventDefault();
        input.value = (event.code === 'NumpadEnter' || event.code === 'Enter') ? 'Enter' : event.code;
      });
    });

    function localize() {
      // 이 구역은 번역을 적용한 뒤에 템플릿으로 만들어지므로, 구역 안의 data-i18n 문구는 여기서 직접 번역한다
      // (안 하면 영어에서도 HTML에 적힌 한국어 기본 문구가 그대로 남는다)
      root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
      root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
      root.querySelectorAll('.generic-mapping-table tr').forEach(row => {
        row.cells[0].textContent = mappingLabel(row.querySelector('input').dataset.key);
      });
      q('title').textContent = t(side === 2 ? 'settings.side2' : 'settings.side1');
      setAxis(genericAxis);
      renderSessionStatus();
      renderReverseHelp();
      q('legacy-row').title = t('settings.buttonTurntableLegacyHelp');
      q('lr2-row').title = t('settings.lr2Hint');
      if (profile() !== 'KB' && !q('device').options.length) refreshDevices();
    }
    document.addEventListener('i18n-changed', localize);
    document.addEventListener('platform-info', () => applyProfileUI());

    const panel = {
      side,
      // 사이드 설정: { controllerProfile, controllerDevice, lr2ModeEnabled, keyMapping: { KB, GENERIC, GENERIC_AXIS } }
      async load(config) {
        q('profile').value = config.controllerProfile;
        q('lr2').checked = !!config.lr2ModeEnabled;
        q('tt-reverse').checked = !!config.turntableReverse;
        q('tt-legacy').checked = !!config.buttonTurntableLegacy;
        // 저장된 값이 없으면(3.0.1 이하 설정) 축을 학습해 둔 사용자는 아날로그, 아니면 버튼 턴테이블
        q('tt-mode').checked = window.formLogic.resolveTurntableInput(config.turntableInput, config.keyMapping?.GENERIC_AXIS) === 'analog';
        savedDevice = config.controllerDevice || null;
        savedSerial = config.controllerDeviceSerial || null;
        previewKey = null; // 저장 뒤 다시 불러오면 미리보기를 새로 연다
        const kb = config.keyMapping?.KB || {};
        root.querySelectorAll('.key-mapping-table input').forEach(input => input.value = kb[input.dataset.key] || '');
        const generic = config.keyMapping?.GENERIC || {};
        root.querySelectorAll('.generic-mapping-table input').forEach(input => input.value = generic[input.dataset.key] ?? '');
        setAxis(config.keyMapping?.GENERIC_AXIS ?? null);
        applyTurntableMode();
        if (window.i18n.ready) localize();
        applyProfileUI();
        if (!root.hidden) await onProfileChanged();
      },
      // 사이드를 보이거나 숨긴다 (DP가 아니면 2P는 숨김). 숨기면 그 사이드의 학습도 멈춘다
      async setVisible(visible, showTitle) {
        root.hidden = !visible;
        q('title').hidden = !showTitle;
        if (visible) await onProfileChanged();
        else {
          stopSession();
          refreshPreview();
        }
      },
      collect() {
        const kb = {};
        root.querySelectorAll('.key-mapping-table input').forEach(input => {
          const value = input.value.trim();
          if (value) kb[input.dataset.key] = value;
        });
        const generic = window.formLogic.buildGenericMapping(mappingEntries());
        return {
          config: {
            controllerProfile: profile(),
            controllerDevice: profile() === 'KB' ? null : devicePath(),
            controllerDeviceSerial: profile() === 'KB' ? null : (q('device').selectedOptions[0]?.dataset.serial || null),
            lr2ModeEnabled: q('lr2').checked,
            turntableReverse: q('tt-reverse').checked,
            buttonTurntableLegacy: q('tt-legacy').checked,
            turntableInput: turntableInput(),
            keyMapping: { KB: kb, GENERIC: generic.mapping, GENERIC_AXIS: genericAxis }
          },
          generic
        };
      },
      // 기타 컨트롤러 매핑 오류 문구 (없으면 null)
      validate() {
        if (root.hidden || profile() !== 'AUTO') return null;
        // 아날로그 턴테이블이면 숨어 있는 버튼 턴테이블 칸(쓰지 않음, 값은 남겨 둠)은 검사하지 않는다
        const analog = turntableInput() === 'analog';
        const generic = window.formLogic.buildGenericMapping(mappingEntries().filter(e => !(analog && TURNTABLE_KEYS.includes(e.key))));
        if (!generic.invalid.length && !generic.duplicates.length) return null;
        const keys = generic.invalid.length ? generic.invalid : generic.duplicates[0];
        return t('settings.invalidGenericMapping', { keys: keys.map(mappingLabel).join(', ') });
      },
      // 미니 원판 미리보기: 방향 반전 전 원래 값이 오므로 체크 상태대로 뒤집어 돌린다
      handleTurntablePreview({ side: from, value }) {
        if (from !== side || !previewOn) return;
        spinDisc(value, q('tt-reverse').checked);
      },
      // 물리 버튼 변화 (이 사이드에서 온 것만). 학습 중이면 처음 누른 버튼을 칸에 적는다.
      // 적은 버튼이 아날로그 축의 비트로 보이면 칸을 되돌리고 아날로그 턴테이블을 쓰라고 알린다
      handlePhysical(events) {
        const mine = events.filter(e => (e.side || 1) === side);
        if (!mine.length) return;
        const now = Date.now();
        for (const e of mine) recentBits.push({ byte: Math.floor((e.physicalButton - 1) / 8), bit: (e.physicalButton - 1) % 8, time: e.timestamp || now });
        recentBits = recentBits.filter(r => now - r.time <= AXIS_WINDOW_MS);

        const pressed = mine.find(e => e.pressed);
        if (pressed && activeLearning?.panel === panel) {
          const input = activeLearning.input;
          lastLearned = { input, previous: input.value, byte: Math.floor((pressed.physicalButton - 1) / 8), time: now };
          input.value = pressed.physicalButton;
          setStatus(t('settings.mapped', { key: mappingLabel(input.dataset.key), button: pressed.physicalButton }));
          input.blur();
        }
        if (lastLearned && now - lastLearned.time <= AXIS_WINDOW_MS) {
          const sameByte = recentBits.filter(r => r.byte === lastLearned.byte);
          if (sameByte.length >= AXIS_MIN_EVENTS && new Set(sameByte.map(r => r.bit)).size >= AXIS_MIN_BITS) {
            lastLearned.input.value = lastLearned.previous;
            lastLearned = null;
            setStatus(t('settings.axisLikeButton'), { warning: true });
          }
        }
      },
      stopSession
    };
    return panel;
  }

  window.createControllerPanel = createControllerPanel;
})();

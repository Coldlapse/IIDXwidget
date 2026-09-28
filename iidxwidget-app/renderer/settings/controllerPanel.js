// 설정 창의 사이드별 컨트롤러 구역 (SP는 1P 하나, DP는 1P·2P 두 개).
// 프로필·장치 선택, LR2 감지, 턴테이블 방향 반전(미니 원판 미리보기), 키보드 매핑,
// 기타 컨트롤러 매핑(버튼 학습, 턴테이블 축 학습)을 한 사이드씩 다룬다.
// 기타 컨트롤러 매핑 학습은 앱에서 한 번에 한 사이드만 할 수 있어서, 칸을 누른 사이드로 학습을 옮긴다.
(function () {
  const api = window.electronAPI;
  const t = (key, values) => window.i18n.t(key, values);
  let activeLearning = null; // 지금 버튼을 기다리는 { panel, input }
  let sessionSide = null;    // 매핑 학습 중인 사이드

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
    let savedProfile = null;
    let savedReverse = false; // 지금 입력 리더에 적용된 반전 (저장된 값)
    let mappingSession = null;
    let axisPreviewOn = false;
    // 미니 원판: 위젯과 같은 방향으로 돈다 (값이 줄면 시계 방향)
    const disc = { last: null, rotation: 0, frame: null, idleTimer: null };

    const profile = () => q('profile').value;
    const devicePath = () => q('device').value || null;

    function setStatus(message, { warning = false } = {}) {
      const status = q('mapping-status');
      status.textContent = message;
      status.classList.toggle('warning', warning);
    }

    function renderSessionStatus() {
      if (!mappingSession || !window.i18n.ready) return;
      if (mappingSession.status === 'none') setStatus(t('settings.mappingNoDevice'), { warning: true });
      else if (mappingSession.status === 'officialOnly') setStatus(t('settings.mappingOfficialOnly'), { warning: true });
      else setStatus(t('settings.mappingReady', { device: mappingSession.device }));
    }

    async function startSession() {
      sessionSide = side;
      mappingSession = await api.startMappingSession(side, devicePath());
      renderSessionStatus();
      refreshAxisPreview();
    }

    function stopSession() {
      if (activeLearning?.panel === panel) activeLearning = null;
      if (sessionSide !== side) return;
      sessionSide = null;
      mappingSession = null;
      axisPreviewOn = false;
      api.stopMappingSession();
    }

    function setAxis(byteIndex) {
      genericAxis = Number.isInteger(byteIndex) ? byteIndex : null;
      q('axis-value').textContent = genericAxis === null
        ? (window.i18n.ready ? t('settings.axisNone') : '')
        : t('settings.axisByte', { index: genericAxis });
      refreshAxisPreview();
    }

    // 기타 컨트롤러: 학습한 축 바이트의 값을 받아 원판을 돌린다 (매핑 학습 중인 사이드만)
    async function refreshAxisPreview() {
      disc.last = null;
      if (profile() !== 'AUTO' || sessionSide !== side || genericAxis === null) {
        if (axisPreviewOn) api.stopAxisPreview();
        axisPreviewOn = false;
        return;
      }
      axisPreviewOn = await api.startAxisPreview(side, genericAxis);
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
      const p = profile();
      let key = p === 'AUTO' ? 'settings.turntableReverseHelpGeneric' : 'settings.turntableReverseHelp';
      if (p !== 'AUTO' && p !== savedProfile) key = 'settings.turntableReverseHelpUnsaved';
      q('reverse-help').textContent = t(key);
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
      q('reverse-help').hidden = p === 'KB';
      // 기타 컨트롤러는 반전이 축 학습에만 적용되므로 축 학습 줄 바로 밑에 둔다
      (p === 'AUTO' ? q('axis-help') : q('lr2-row')).after(q('reverse-row'), q('reverse-help'));
      renderReverseHelp();
    }

    async function onProfileChanged() {
      applyProfileUI();
      if (profile() !== 'KB') await refreshDevices();
      if (profile() === 'AUTO') startSession();
      else stopSession();
    }

    q('profile').addEventListener('change', onProfileChanged);
    q('device').addEventListener('change', () => { if (profile() === 'AUTO') startSession(); });
    q('refresh').addEventListener('click', async () => {
      await refreshDevices();
      if (profile() === 'AUTO') startSession();
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

    // 키보드 매핑: 칸에서 누른 키를 적는다
    root.querySelectorAll('.key-mapping-table input').forEach(input => {
      input.addEventListener('keydown', event => {
        event.preventDefault();
        input.value = (event.code === 'NumpadEnter' || event.code === 'Enter') ? 'Enter' : event.code;
      });
    });

    function localize() {
      root.querySelectorAll('.generic-mapping-table tr').forEach(row => {
        row.cells[0].textContent = mappingLabel(row.querySelector('input').dataset.key);
      });
      q('title').textContent = t(side === 2 ? 'settings.side2' : 'settings.side1');
      setAxis(genericAxis);
      renderSessionStatus();
      renderReverseHelp();
      if (profile() !== 'KB' && !q('device').options.length) refreshDevices();
    }
    document.addEventListener('i18n-changed', localize);

    const panel = {
      side,
      // 사이드 설정: { controllerProfile, controllerDevice, lr2ModeEnabled, keyMapping: { KB, GENERIC, GENERIC_AXIS } }
      async load(config) {
        q('profile').value = config.controllerProfile;
        q('lr2').checked = !!config.lr2ModeEnabled;
        q('tt-reverse').checked = !!config.turntableReverse;
        savedDevice = config.controllerDevice || null;
        savedSerial = config.controllerDeviceSerial || null;
        savedProfile = config.controllerProfile;
        savedReverse = !!config.turntableReverse;
        disc.last = null;
        const kb = config.keyMapping?.KB || {};
        root.querySelectorAll('.key-mapping-table input').forEach(input => input.value = kb[input.dataset.key] || '');
        const generic = config.keyMapping?.GENERIC || {};
        root.querySelectorAll('.generic-mapping-table input').forEach(input => input.value = generic[input.dataset.key] ?? '');
        setAxis(config.keyMapping?.GENERIC_AXIS ?? null);
        if (window.i18n.ready) localize();
        applyProfileUI();
        if (!root.hidden) await onProfileChanged();
      },
      // 사이드를 보이거나 숨긴다 (DP가 아니면 2P는 숨김). 숨기면 그 사이드의 학습도 멈춘다
      async setVisible(visible, showTitle) {
        root.hidden = !visible;
        q('title').hidden = !showTitle;
        if (visible) await onProfileChanged();
        else stopSession();
      },
      collect() {
        const kb = {};
        root.querySelectorAll('.key-mapping-table input').forEach(input => {
          const value = input.value.trim();
          if (value) kb[input.dataset.key] = value;
        });
        const generic = window.formLogic.buildGenericMapping(
          [...root.querySelectorAll('.generic-mapping-table input')].map(input => ({ key: input.dataset.key, value: input.value }))
        );
        return {
          config: {
            controllerProfile: profile(),
            controllerDevice: profile() === 'KB' ? null : devicePath(),
            controllerDeviceSerial: profile() === 'KB' ? null : (q('device').selectedOptions[0]?.dataset.serial || null),
            lr2ModeEnabled: q('lr2').checked,
            turntableReverse: q('tt-reverse').checked,
            keyMapping: { KB: kb, GENERIC: generic.mapping, GENERIC_AXIS: genericAxis }
          },
          generic
        };
      },
      // 기타 컨트롤러 매핑 오류 문구 (없으면 null)
      validate() {
        if (root.hidden || profile() !== 'AUTO') return null;
        const { generic } = panel.collect();
        if (!generic.invalid.length && !generic.duplicates.length) return null;
        const keys = generic.invalid.length ? generic.invalid : generic.duplicates[0];
        return t('settings.invalidGenericMapping', { keys: keys.map(mappingLabel).join(', ') });
      },
      // 전용 프로필 미리보기: 지금 읽고 있는 입력(저장된 프로필, 저장된 반전이 적용된 값)으로 원판을 돌린다.
      // 체크를 저장값과 다르게 바꾸면 반대로 돌려서 저장 후 모습을 미리 보여준다
      handleTurntable(events) {
        const p = profile();
        if (root.hidden || p === 'KB' || p === 'AUTO' || p !== savedProfile) return;
        for (const e of events) {
          if (e.type !== 'axis' || e.axis !== 'X' || (e.side || 1) !== side || !Number.isInteger(e.discRaw)) continue;
          spinDisc(e.discRaw, q('tt-reverse').checked !== savedReverse);
        }
      },
      // 기타 컨트롤러 미리보기: 학습한 축 바이트의 원래 값 (반전 전)
      handleAxisPreview({ side: from, value }) {
        if (from !== side || profile() !== 'AUTO' || !axisPreviewOn) return;
        spinDisc(value, q('tt-reverse').checked);
      },
      // 매핑 학습 중 누른 물리 버튼 (이 사이드에서 온 것만)
      handlePhysical(event) {
        if (activeLearning?.panel !== panel || (event.side || 1) !== side) return;
        const input = activeLearning.input;
        input.value = event.physicalButton;
        setStatus(t('settings.mapped', { key: mappingLabel(input.dataset.key), button: event.physicalButton }));
        input.blur();
      },
      stopSession
    };
    return panel;
  }

  window.createControllerPanel = createControllerPanel;
})();

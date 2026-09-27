// 설정 창의 사이드별 컨트롤러 구역 (SP는 1P 하나, DP는 1P·2P 두 개).
// 프로필·장치 선택, LR2 감지, 키보드 매핑, 기타 컨트롤러 매핑(버튼 학습, 턴테이블 축 학습)을 한 사이드씩 다룬다.
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

  function createControllerPanel(side) {
    const root = document.querySelector(`.controller-side[data-side="${side}"]`);
    root.append(document.getElementById('controller-side-template').content.cloneNode(true));
    const q = role => root.querySelector(`[data-role="${role}"]`);
    let genericAxis = null;
    let savedDevice = null;
    let mappingSession = null;

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
    }

    // 장치 드롭다운: 연결된 장치만 보여준다 (1개면 1개만). 없으면 '연결된 장치 없음'
    async function refreshDevices() {
      const select = q('device');
      const current = select.value || savedDevice;
      const { devices } = await api.listControllerDevices(profile());
      select.replaceChildren(...(devices.length ? devices : [{ path: '', name: t('settings.noDevice') }]).map(d => {
        const option = document.createElement('option');
        option.value = d.path;
        option.textContent = d.name;
        return option;
      }));
      select.disabled = !devices.length;
      if (devices.some(d => d.path === current)) select.value = current;
    }

    function applyProfileUI() {
      const p = profile();
      q('kb-container').hidden = p !== 'KB';
      q('generic-container').hidden = p !== 'AUTO';
      q('device-row').hidden = p === 'KB';
      q('lr2-row').hidden = !(p === 'PHOENIXWAN' || p === 'FPS EMP Gen2');
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
      if (profile() !== 'KB' && !q('device').options.length) refreshDevices();
    }
    document.addEventListener('i18n-changed', localize);

    const panel = {
      side,
      // 사이드 설정: { controllerProfile, controllerDevice, lr2ModeEnabled, keyMapping: { KB, GENERIC, GENERIC_AXIS } }
      async load(config) {
        q('profile').value = config.controllerProfile;
        q('lr2').checked = !!config.lr2ModeEnabled;
        savedDevice = config.controllerDevice || null;
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
            lr2ModeEnabled: q('lr2').checked,
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

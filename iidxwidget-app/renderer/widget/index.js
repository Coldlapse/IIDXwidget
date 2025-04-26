let lastDiscValue = null;
let discRotation = 0;
let lastDiscUpdateTime = 0;
const DISC_UPDATE_INTERVAL = 20; // ms 단위, 20ms마다 처리
const buttonStates = {}; // 버튼별 눌림 상태
const buttonPressTimes = {}; // 버튼별 누른 시간
const releaseDurations = []; // 전체 버튼 합쳐서 release 시간 리스트 (최대 200개)

const disc = document.getElementById("disc");
const upperIndicator = document.getElementById("upper-indicator");
const lowerIndicator = document.getElementById("lower-indicator");

function rotateDisc(delta) {
  discRotation -= delta * 2.5;
  disc.style.transform = `translate(-50%, -50%) rotate(${discRotation}deg)`;

  updateBorders(delta);
}

function updateBorders(delta) {
  if (delta > 0) {
    // 반시계 방향 → 아래쪽 점등
    lowerIndicator.classList.add("lit");
    upperIndicator.classList.remove("lit");
  } else if (delta < 0) {
    // 시계 방향 → 위쪽 점등
    upperIndicator.classList.add("lit");
    lowerIndicator.classList.remove("lit");
  } else {
    // 멈춤 → 둘 다 끔
    upperIndicator.classList.remove("lit");
    lowerIndicator.classList.remove("lit");
  }
}

function updateButton(id, pressed) {
  const el = document.getElementById(`button-${id}`);
  if (!el) return;

  const now = Date.now();

  if (pressed) {
    el.classList.add("active");

    if (!buttonStates[id]) {
      buttonPressTimes[id] = now;
    }

    buttonStates[id] = true;
  } else {
    el.classList.remove("active");

    if (buttonStates[id]) {
      const pressTime = buttonPressTimes[id];
      let releaseDuration = now - pressTime;

      releaseDuration = Math.min(releaseDuration, 99); // ✅ 99ms 초과는 99로 잘라서 기록

      releaseDurations.push(releaseDuration);

      if (releaseDurations.length > 200) {
        releaseDurations.shift();
      }

      updateReleaseDisplay();
    }

    buttonStates[id] = false;
  }
}


function updateReleaseDisplay() {
  if (releaseDurations.length === 0) return;

  const sum = releaseDurations.reduce((a, b) => a + b, 0);
  const avg = sum / releaseDurations.length;

  const display = document.getElementById('release-display');
  if (display) {
    display.textContent = `Release: ${avg.toFixed(0)} ms`; // ✅ 정수로 표시
  }
}


function handleData(data) {
  const now = Date.now();

  if (data.type === 'axis' && data.axis === 'X' && data.discRaw !== undefined) {
    if (now - lastDiscUpdateTime >= DISC_UPDATE_INTERVAL) {
      const newValue = data.discRaw;
      if (lastDiscValue !== null) {
        let delta = (newValue - lastDiscValue + 256) % 256;
        if (delta > 127) delta = delta - 256;

        rotateDisc(delta);
        updateBorders(delta);
      }
      lastDiscValue = newValue;
      lastDiscUpdateTime = now; // 시간 갱신
    }
  }

  if (data.type === 'button') {
    const buttonNumber = parseInt(data.button.split(" ")[1]);
    updateButton(buttonNumber, data.pressed);
  }
}



// WebSocket 또는 Electron
if (window.electronAPI) {
  window.electronAPI.onControllerData((list) => list.forEach(handleData));
} else {
  const ws = new WebSocket("ws://" + location.hostname + ':5678');
  ws.onmessage = (event) => {
    const dataList = JSON.parse(event.data);
    if (Array.isArray(dataList)) {
      dataList.forEach(handleData);
    }
  };
}

// 채터링 집계는 앱 본체가 모든 입력에서 계속 하고 있다 (이 창이 닫혀 있어도).
// 이 창은 현재 숫자를 받아서 건반 위에 보여주기만 한다.
const slots = [...document.querySelectorAll('.key-slot')];

function render(counts) {
  let total = 0;
  for (const slot of slots) {
    const count = counts[slot.dataset.button] || 0;
    total += count;
    slot.querySelector('.count').textContent = count;
    slot.classList.toggle('has-chatter', count > 0);
  }
  document.getElementById('total').textContent = total;
  document.querySelector('.total').classList.toggle('has-chatter', total > 0);
}

async function refresh() {
  render(await window.electronAPI.requestChatterSummary());
}

// 입력이 들어올 때마다(묶어서 최대 초당 20번) 새 숫자를 받는다
window.electronAPI.onStats(refresh);
refresh();

document.getElementById('open-guide').addEventListener('click', () => window.electronAPI.openGuide('CHATTER'));

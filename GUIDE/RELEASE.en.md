# ⏱ RELEASE value

[한국어](RELEASE.md)

Release is the time (ms) from pressing a key to letting go of it.
**Lower is not better, and higher is not worse.** It changes from chart to chart and from player to player.

---

## 📊 It depends on the player and the chart

For example, here is what the developer (Sadang) gets:

| Chart type | Examples | Release |
|---|---|---|
| Hard-press (gachi-oshi) charts | ★2 夜明けの少女たち [Another+], ★17 gazer [MANIAQ] | 40–50ms |
| Typical dense charts | ★20 Air -GOD-, ★23 ★LittlE HearTs★ (GOD) | 75–85ms |
| Slow charts (around 150 BPM) | ★12 Angelic layer -Heavenly7- | sometimes over 90ms |

Some players, like [Rag](https://rag-oji.com/dakendisplay/), land in the 50s on almost every chart. Even so, Rag has said publicly that a low number doesn't mean better play. Many other Overjoy-level BMS players get 70–80 on dense charts.

---

## 🎯 What it's good for

### 1. Seeing whether you hard-press or roll
- Hard-pressing (gachi-oshi) basically means **letting go quickly**. If you hard-press ★17 gazer [MANIAQ], your release should be under 60ms at the very most.
- If you get 70–80 on gazer, you are rolling it.
- Rolling is not bad at all. It's just a different way to play, and some players get great judgments while rolling. The number is here to help you **see your own technique objectively**.

### 2. Checking today's condition
- Say you usually get 40–50 on a 140–150 BPM hard-press chart (★22 Hay FEVER [G]), and one day you get 60–70. That day, you can't hard-press it like usual.
- Use it to compare against **your usual, or your best, condition**.

---

## 📌 In short

The release value isn't about being low or high. It's useful for seeing, objectively:
- **how far you are from your usual state**
- whether you are **hard-pressing or rolling** right now

> ⚠️ This section is not purely objective fact. It is the developer's own research, put together from the developer's experience, the experience of people around them, and opinions from some top players. Treat it as a reference only.

---

## 🧮 How it is calculated

Release uses the same rules as [Rag](https://rag-oji.com/dakendisplay/)'s widget.

- **Release** = the time (ms) from pressing a key to releasing it
- **Long notes (CN) are left out.** A press held at least as long as the long note threshold (default 200ms) counts as a long note.
  - While held as a long note, the key shows the long note color.
- Presses held **255ms or longer** are also left out, even if you set a longer long note threshold.
- The **overall average** (Release in the session info) uses the last **2000** presses, and **the number above each key** uses that key's last **300** presses.
- **Average release** on the Session page is the average of every press in this session.
- You can change the sample counts and the long note threshold in Settings. When you do, this session is recalculated right away.

For the settings, see [Usage and Settings](USAGE.en.md).

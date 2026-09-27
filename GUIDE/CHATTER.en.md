# 🔍 Chatter detection

[한국어](CHATTER.md)

What the numbers in Menu → **Chatter detector** mean, how they are counted, and how the two detection presets differ.

---

## What is chatter?

The switch inside each key makes its signal when metal contacts touch and separate.
When a switch gets worn or dirty, the contacts don't close cleanly. They **bounce several times in a very short moment.**
Then one press can reach the computer as **two or more presses**. That's **chatter (double input)**.

The upper line means released, the lower line means pressed.

**What you did** (one press)
```
━━━━━┓                    ┏━━━━━
     ┗━━━━━━━━━━━━━━━━━━━━┛
```

**Switch signal** (bounce adds a short extra press)
```
━━━━━┓ ┏┓                 ┏━━━━━
     ┗━┛┗━━━━━━━━━━━━━━━━━┛
```

---

## How does IIDXwidget count it?

It looks at **the time between releasing a key and pressing the same key again (the gap)**. This is the same approach as [Rag](https://rag-oji.com/dakendisplay/)'s widget.

- When a switch bounces like the picture above, you get a "release, then press again after a tiny gap".
- A person needs at least tens of ms to release and press the same key again, so a very short gap is treated as bounce.
- Counts are kept per key.
- The window groups the white keys (1-3-5-7, white glow) and the black keys (2-4-6, blue glow), and **highlights in red only keys at least twice their group average**. So that one or two counts early on don't stand out, **a group is highlighted only once its own average reaches 10**. Each group is judged on its own. See [How to read the numbers](#-how-to-read-the-numbers) below for why.
- Counts cover **this session** (since the app started) and keep going while the chatter window is closed.
- The **Chatter** number on the Session page uses the same rule.

> ms (millisecond) is 1/1000 of a second. 30ms is 0.03 seconds.

---

## ⚙ Detection settings (two presets)

Change them with **⚙ Settings** at the top right of the chatter window. You can also open them from Menu → **Settings** → "Open chatter detection settings".

| Preset | Counted as chatter | Defaults |
|---|---|---|
| **Rag** (default) | Every gap **below the threshold** | Threshold 30ms |
| **Sadang** | Only gaps **above the lower limit and below the threshold** | Lower limit 10ms, threshold 30ms |

### Rag: see every switch bounce
- Same rule as Rag's widget. Every gap shorter than the threshold (default 30ms) is counted.
- It tells you first when a switch starts to bounce.
- It also counts tiny bounces that games filter out by themselves, so the number can go up even when the game plays fine.

### Sadang: see only what can matter in-game
- Tiny bounces at or below the lower limit (default 10ms) are treated as **chatter the game throws away** and are not counted.
- Only gaps between the lower limit and the threshold (default over 10ms and under 30ms) are counted. That range can get past the game's filter and become an input you never made.
- Set the lower limit for the game you play most. For example, beatoraja and LR2 filter changes within 16ms (see [How games handle input](#-how-games-handle-input) below), so a lower limit of 16ms is closer to "bounce that still gets through in that game".

### When you change the settings
- **As soon as you save**, the whole session so far is recounted with the new rule. No restart needed.
- The threshold and lower limit are whole numbers from 1 to 100ms, and for Sadang the lower limit must be below the threshold.

---

## Does a high number mean trouble in-game?

**Not necessarily.** This number is not "wrong inputs in the game". It shows **how much your switches bounce**.

- IIDXwidget reads every controller report at 1ms resolution, so it can see short bounces that games filter out.
- Whether it causes trouble in-game depends on the game. See [How games handle input](#-how-games-handle-input) below.
- If your chatter count keeps climbing, take it as **a sign to check your switches** before you notice strange inputs in-game.

---

## 📈 How to read the numbers

Chatter being detected doesn't necessarily mean that key has a bad double-input problem. **Most switches show some chatter even when brand new.**
What matters is finding **double inputs that actually affect your play** (for example, late POORs after a note or long-note combo breaks).

### If one key is much higher than the rest
If one of the seven keys stands out, for example every key is around 20 but one shows about 70, that can be one sign that the key's switch is near the end of its life.

### Keys 2, 4 and 6 tend to be a bit higher
- On 1P with the common 엄중검 fingering, keys 2, 4 and 6 are played with the left middle finger, the right index finger and the right middle finger.
- These three fingers are all strong and easy to control, so they may hit the buttons harder, and in practice they tended to show higher chatter counts.
- (This is the developer's own observation from four years of play, not a proven finding.)
- So higher counts on only 2, 4 and 6 are hard to call abnormal. We suggest **grouping 1-3-5-7 and 2-4-6 separately** and comparing keys within each group. The chatter window highlights only keys at least twice their group average for this reason.

---

## The count keeps going up. What should I do?

1. **Find which key.** If a key is much higher than the other keys in its group (1-3-5-7 or 2-4-6), that key's switch is the likely cause.
2. **Check whether it actually affects your play.** If you don't see late POORs or long-note combo breaks, there's no rush.
3. **Check the switch.** Cleaning the contacts or replacing the switch fixes most cases.
4. **Check your controller settings.** Some controllers and DIY boards have a bounce filter (debounce) in their firmware.
5. Charts with very fast repeated notes on the same key (jacks) can make normal presses hit the threshold. Avoid those charts when checking your switches.

---

## 🎮 How games handle input

The same bounce is treated differently by each game. This looks at the open-source **beatoraja** and **LR2** (based on OpenLR2, a rewritten source).

### Two things to know first
- **Check interval** : how often the game reads the key state. An input shorter than this can be missed.
- **Ignore time** : how long the game ignores further changes after an input changes. This is the bounce filter. Both games default to **16ms** (a fixed time, not tied to frames).

| | LR2 | beatoraja |
|---|---|---|
| Check interval | Every frame (about 16.7ms at 60fps, depends on fps) | Every 1ms (separate from rendering) |
| Ignore time counted from | The last **press**, for 16ms | The last **change**, for 16ms (press or release) |
| In one line | "For 16ms after a press, the key counts as held" | "After any change, no further change for 16ms" |

### Case by case

| Situation | LR2 | beatoraja |
|---|---|---|
| **Bounce on press** (briefly opens right after pressing) | ✅ filtered | ✅ filtered |
| **Bounce on release** (briefly closes right after releasing) | ❌ can create an input you never made, more often at high fps | ✅ filtered |
| Very short but real tap | ✅ judged normally | ✅ judged normally |
| Pressing again within 16ms after release | ✅ registers right away | ⚠️ registers a bit late or is lost (almost never happens for a person) |
| Input shorter than the check interval | sometimes missed, depending on fps | seen if longer than 1ms |

### So
- **beatoraja** filters bounce within 16ms on both press and release. Only bounce with longer gaps causes trouble.
- **LR2** filters bounce on press but **not on release**. If a switch bounces on release, LR2 can register inputs you never made, such as empty POORs.
- That's why chatter detection has two presets. Use **Rag** to see the switch itself, or **Sadang** with a lower limit that fits your game to see only bounce that matters in-game.
- IIDX (INFINITAS and arcade) is not open source, so it couldn't be checked.

---

For what the release number means, see the [RELEASE guide](RELEASE.en.md). For everything else, see [Usage and Settings](USAGE.en.md).

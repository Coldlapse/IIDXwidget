# 🔍 Chatter detection

[한국어](CHATTER.md)

What the numbers in Menu → **Chatter detector** mean and how they are counted.

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

- **A press that is released within 15ms** counts as chatter.
- A normal human press is held for tens of ms or more. A press released within 15ms is almost always switch bounce.
- Counts are kept per key, plus a total.
- Counts cover **this session** (since the app started) and keep going while the chatter window is closed.
- The **Chatter** number on the Session page uses the same rule.

> ms (millisecond) is 1/1000 of a second. 15ms is 0.015 seconds.

---

## Does a high number mean trouble in-game?

**Not necessarily.** This number is not "wrong inputs in the game". It shows **how much your switches bounce**.

- IIDXwidget reads every controller report at 1ms resolution, so it also counts short bounces that games filter out.
- Games filter bounce too, each in its own way:
  - **beatoraja** : Ignores any change for 16ms after an input changes. It filters bounce on both press and release.
  - **LR2** : Only ignores releases within 16ms after a press. Bounce **on release** gets through and can create inputs you never made (empty POORs etc.).
- So if your chatter count keeps climbing, take it as **a sign to check your switches** before you notice strange inputs in-game.

---

## The count keeps going up. What should I do?

1. **Find which key.** If one key is much higher, that key's switch is the likely cause.
2. **Check the switch.** Cleaning the contacts or replacing the switch fixes most cases.
3. **Check your controller settings.** Some controllers and DIY boards have a bounce filter (debounce) in their firmware.
4. An occasional 1–2 is nothing to worry about.

---

For what the release number means, see the [RELEASE guide](RELEASE.en.md). For everything else, see [Usage and Settings](USAGE.en.md).

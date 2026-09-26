# ⏱ RELEASE value

[한국어](RELEASE.md)

> 🚧 The explanation in this guide is being written. Below is a summary of how the app calculates it now.

---

## How it is calculated

Release uses the same rules as [Rag](https://rag-oji.com/dakendisplay/)'s widget.

- **Release** = the time (ms) from pressing a key to releasing it
- **Long notes (CN) are left out.** A press held at least as long as the long note threshold (default 200ms) counts as a long note.
  - While held as a long note, the key shows the long note color.
- Presses held **255ms or longer** are also left out, even if you set a longer long note threshold.
- The **overall average** (Release in the session info) uses the last **2000** presses, and **the number above each key** uses that key's last **300** presses.
- **Average release** on the Session page is the average of every press in this session.
- You can change the sample counts and the long note threshold in Settings. When you do, this session is recalculated right away.

For the settings, see [Usage and Settings](USAGE.en.md).

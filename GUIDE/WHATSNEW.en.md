# 🎉 What's new in 3.0.0

[한국어](WHATSNEW.md)

For everyone updating from 2.x to 3.0.0: what changed and what's new.

---

## ⚠️ Do this first: refresh the widget in OBS

The widget page shown in OBS changed in 3.0.0. OBS remembers the old page, so you need to **refresh it once yourself** to see the new widget.

1. In OBS, double-click the IIDXwidget **browser source** to open its properties.
2. Press **Refresh cache of current page** near the bottom.
3. Click **OK**.

If you can't find the button, **restarting OBS** works too.
You only need to do this once. From now on the widget follows settings changes and app restarts by itself.

---

## 📊 Some numbers may look different

### Release is now calculated like Rag's widget
- **Long-note (CN) presses are left out of the average.** Before, long notes went into the average as 99ms, which pushed it up. So your average release may look **lower than before** in 3.0.0.
- The default sample counts are now **2000 overall and 300 per key**. If you were on the old default (200), it was switched to the new defaults automatically; values you changed yourself were kept.
- A key held as a long note shows **a different color**. You can change it in Settings.
- Details: [RELEASE guide](RELEASE.en.md)

### Chatter detection works differently
- Before: a press held for 15ms or less was chatter
- Now: judged by **the gap between releasing a key and pressing it again** (same approach as Rag's widget)
- Choose between two presets (Rag / Sadang) and set the thresholds with **⚙ Settings** in the chatter window.
- Details: [chatter guide](CHATTER.en.md)

### Every number is per "session"
- Presses, uptime, release and chatter all **start at 0 when the app starts** and count until you quit.
- The app window and the OBS widget now **always show the same numbers**.

---

## ✨ New features

- **Antivirus false positive fixed** : Windows Defender no longer blocks the app as it did with 2.1.0 and earlier. The component that reads keyboard input was replaced.
- **Korean / English** : Menu → Language
- **Other controller (manual mapping)** : Controllers that are not officially supported and DIY boards can be mapped by pressing their buttons. Boards whose turntable is an axis are found with "Learn".
- **Widget redesign** : The floating session info box is now a dashboard attached to the widget body. The turntable and keys keep their size and position, and the widget takes up no more space than before.
- **DP support** : Pick a controller for 1P and 2P separately; the widget shows both sides joined together. Use a 1320×600 OBS browser source. With several identical controllers, choose the device in Settings.
- **KPS speedometer** : KPS on the dashboard is shown as a speedometer gauge that heats up in the red zone. Turn it off or pick a preset (IIDX / BMS up to ★★ / BMS ★★ and up) in Settings.
- **Widget customization** : two-image turntable mode (a different image per spin direction), transparent widget background, show/hide release numbers on keys, long note color
- **Instant settings and auto reconnect** : Saved settings show up in the OBS widget right away, and the widget reconnects by itself when you restart the app. While the app is off, OBS shows "Lost connection to IIDXwidget".
- **Session** (Menu → Session) : See presses, sent and remaining counts for this session and upload them to beatmania.app right there.
- **Upload when quitting** : Turn it on in Settings to upload the remaining presses automatically when you quit. Off by default.
- **Guides** (top menu → Guides) : Usage, connection, release and chatter guides inside the app.

---

## 🔑 Connecting your beatmania.app account changed

- Paste your token and press **Connect**. It is checked with the server, saved, and the **connected account name** is shown.
- The token is stored **encrypted** with your Windows account.
- The token you entered in 2.x was moved over automatically. If you see your account name in Settings, you're all set.
- If you see "The server rejected the saved token", copy the token from your [beatmania.app](https://beatmania.app) My Page again and paste it.
- If you go back to 2.x after using 3.0.0, you'll need to enter the token again.

---

You can open this page again any time from the top menu → **Guides**. For all features and settings, see [Usage and Settings](USAGE.en.md).

# 📘 Usage and Settings

[한국어](USAGE.md)

What each part of IIDXwidget's screen, menu and settings means.
If you are connecting to OBS for the first time, start with the [connection guide](CONNECTION.en.md).

---

## 🖥 What you see

The app window and the OBS widget **always show the same screen and the same numbers**. What you see in the app window is what goes on stream.

- **Turntable** : The disc spins with your turntable. You can use your own image.
- **Keys** : Light up while pressed. When held long enough to be a long note (CN), the key switches to the long note color. The number above each key is that key's average release (ms).
- **Session info**
  - **Session** : Presses in this session
  - **Uptime** : Time since the app started
  - **Release** : Average release (ms) across all keys. Long-note presses are left out (same as [Rag](https://rag-oji.com/dakendisplay/)'s widget)
  - **KPS** : Presses in the last second

> 📌 A **session** runs from when you start the app until you quit it. Every number starts at 0 when the app starts and is gone when you quit.

For what release means, see the [RELEASE guide](RELEASE.en.md).

---

## 📋 Menu

- **Menu**
  - **Settings** : Change the [settings](#-settings) below.
  - **Logs** : Whether your controller was detected, and any errors. Look here first when something goes wrong.
  - **Session** : Presses, sent and remaining counts for this session, and uploading to [beatmania.app](https://beatmania.app).
  - **Chatter detector** : Chatter (double input) counts per key. Change the detection preset (Rag / Sadang) and thresholds with **⚙ Settings** at the top right of the window. See the [chatter guide](CHATTER.en.md).
  - **About / Contributors** : App version and the people who made it
  - **Check for updates** : Check for a new version now. The app also checks on startup.
  - **Restart** : Reopens the servers and controller connection. Session numbers carry on.
  - **Quit** : Quits the app.
- **Language** : 한국어 / English
- **Guides** : All guides, including this one and [What's new in 3.0.0](WHATSNEW.en.md), inside the app.

---

## 🔧 Settings

Press **Save** to apply changes. Saved changes show up in the OBS widget right away.

### Application settings

| Setting | Meaning |
|---|---|
| **Launch automatically with Windows** | Starts IIDXwidget when you turn on your PC. |
| **Show widget promotion box** | Shows the IIDXwidget repository address in small text below (or above) the widget. Thanks if you turn it on 🙏 |
| **Controller Profile** | The controller you use. See [Controller profiles](#controller-profiles) below. |
| **Detect LR2 mode (dedicated controller only)** | A PHOENIXWAN in LR2 sends turntable signals differently. With this on, the app detects LR2 mode and shows the turntable correctly. |

### Controller profiles

- **PHOENIXWAN+ / FPS EMP Gen2** : Works as soon as you select it.
- **Other controllers** : For other controllers and DIY boards such as Arduino. A PHOENIXWAN or FPS is recognized without mapping; other boards are mapped by hand.
  - Click a field in the mapping table, then press the controller button. Clear a field to unmap it.
  - If your board reports the turntable as **buttons**, map them to 'Turntable clockwise / counterclockwise'.
  - If your board reports the turntable as an **axis**, press **Learn** next to 'Turntable (axis)' and spin the turntable for 2 seconds.
- **Keyboard** : Click a field in the keyboard mapping table, then press the key you want.

### beatmania.app play count

| Setting | Meaning |
|---|---|
| **beatmania.app account** | Paste the token from [beatmania.app](https://beatmania.app) My Page → **Get an API token** and press **Connect**. It is checked with the server and saved right away, and the connected account name is shown. The token is stored encrypted with your Windows account. |
| **Upload remaining presses when quitting** | When you quit, uploads what this session has not sent yet. Off by default. When off, unsent presses are gone when you quit. |

- To upload by hand, go to Menu → **Session** → **Upload now**. Only what hasn't been sent is uploaded, so pressing it more than once never double-counts.
- Daily records are on your beatmania.app My Page. The server files each upload under the date it arrived (Korea time).

### Connection

| Setting | Meaning |
|---|---|
| **Server port** | The number in the OBS browser source address. Default 8080. If you change it, change the OBS address too. |
| **WebSocket port** | The number the widget uses for live input. Default 5678. The widget connects by itself, so you don't enter it in OBS. |

Only change these if another program already uses the port. The [connection guide](CONNECTION.en.md) explains what a port is.

### Widget display

| Setting | Meaning |
|---|---|
| **Session information position** | Put session info above or below the widget, or hide it. |
| **Button layout** | 1P (turntable on the left) / 2P (turntable on the right) |

### Release and chatter

Release is calculated with the same rules as [Rag](https://rag-oji.com/dakendisplay/)'s widget. See the [RELEASE guide](RELEASE.en.md) for details.

| Setting | Meaning |
|---|---|
| **Global release sample count** | How many recent presses the overall average release uses. Default 2000 (same as Rag's widget). Higher values change more slowly. |
| **Per-button release sample count** | How many recent presses each key's release number uses. Default 300 (same as Rag's widget). |
| **Long note (CN) threshold** | Presses held this long or longer count as long notes and are left out of the release average. The key shows the long note color while held. Default 200ms, 100–500ms. |
| **Open chatter detection settings** | Opens the settings view of the chatter window. For presets and thresholds, see the [chatter guide](CHATTER.en.md). |

When you save a new sample count or long note threshold, this session is recalculated with it right away.

### Widget appearance

| Setting | Meaning |
|---|---|
| **Transparent container background** | Makes the background behind the widget transparent so only the widget shows on stream. |
| **Show release value on each key** | Shows or hides the release number above each key. On by default. |
| **Turntable image mode** | **Single image** : one image spins with the turntable. **Two images** : a different image for each spin direction. |
| **Custom turntable image** | The image used for the disc. **Delete** goes back to the default disc. |
| **Colors** | Widget background, turntable background, idle/active colors, text color, and the color of a key held as a long note. |

---

## 💡 Good to know

- If you quit and restart the app, the OBS widget reconnects by itself. While the app is off, OBS shows "Lost connection to IIDXwidget".
- Right after updating the app, press **Refresh cache of current page** once in the OBS browser source properties.
- Questions and bugs go to [Issues](https://github.com/Coldlapse/IIDXwidget/issues).

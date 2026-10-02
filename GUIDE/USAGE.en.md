# 📘 Usage and Settings

[한국어](USAGE.md)

What each part of IIDXwidget's screen, menu and settings means.
If you are connecting to OBS for the first time, start with the [connection guide](CONNECTION.en.md).

---

## 🖥 What you see

The app window and the OBS widget **always show the same screen and the same numbers**. What you see in the app window is what goes on stream.

- **Turntable** : The disc spins with your turntable. You can use your own image.
- **Keys** : Light up while pressed. When held long enough to be a long note (CN), the key switches to the long note color. The number above each key is that key's average release (ms).
- **Session info (dashboard)** : The panel attached below (or above) the widget body. With the Keyboard profile, a small **INPUT · KB** tag appears above the keys.
  - **Session** : Presses in this session
  - **Uptime** : Time since the app started
  - **Release** : Average release (ms) across all keys. Long-note presses are left out (same as [Rag](https://rag-oji.com/dakendisplay/)'s widget)
  - **KPS** : Presses in the last second. Shown as a **speedometer gauge** by default. The first 70% of the gauge is the normal range and the last 30% is the red zone; in the red zone the fill heats up from orange to red and starts to glow. At the end of the gauge, the fill and the number tremble slightly (redline); past the end the gauge stays full, but the number keeps showing the real value.

> 📌 A **session** runs from when you start the app until you quit it. Every number starts at 0 when the app starts and is gone when you quit.

For what release means, see the [RELEASE guide](RELEASE.en.md).

---

## 📋 Menu

- **Menu**
  - **Settings** : Change the [settings](#-settings) below.
  - **Logs** : Whether your controller was detected, and any errors. Look here first when something goes wrong.
  - **Session** : Presses, sent and remaining counts for this session, and uploading to [beatmania.app](https://beatmania.app).
  - **Controller probe** : Records the signals of a controller that isn't officially supported, for requesting official support. See the [controller support request guide](CONTROLLER.en.md).
  - **Chatter detector** : Chatter (double input) counts per key, grouped as 1-3-5-7 and 2-4-6, with keys that stand out within their group highlighted in red. Change the detection preset (Rag / Coldlapse) and thresholds with **⚙ Settings** at the top right of the window. See the [chatter guide](CHATTER.en.md).
  - **Developer & Contributors** : App version, the developer and their links, support (Buy me a coffee) and the contributors, all in one window.
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

### Controllers: button layout and DP

| Setting | Meaning |
|---|---|
| **Button layout** | **1P** (turntable on the left) / **2P** (turntable on the right) / **DP** (1P + 2P) |

- Choosing **DP** adds a **2P controller** section so 1P and 2P each get their own controller. The two sides can use different profiles (e.g. PHOENIXWAN on 1P and FPS on 2P), and one side can be a keyboard.
- The widget shows the 1P and 2P bodies joined by a 40px gap in the widget background color, with the session dashboard as a trapezoid in the middle. If a side uses the keyboard, **1P · KB**, **2P · KB** (or **INPUT · KB** for both) appears at the top between the two bodies. Presses, KPS and average release combine both sides.
- The DP widget is 1000px wide, so set the OBS browser source to **1320×600**. The app window also gets wider, only while DP is selected.
- The chatter window shows a second keyboard for 2P below 1P and compares each side separately.

### Controller profiles

Choose a profile and a **device** for each side (one for SP, 1P and 2P for DP). The keyboard and other-controller mapping tables appear right below the profile.

- **Device** : Lists only connected controllers that match the profile; if there is just one, only one appears. Identical controllers (two boards for 1P and 2P, for example) get a tag in front of the name: the last 4 digits of the serial number such as `[S/N …1234]`, or `[#1]`, `[#2]` if they have no serial. Press **Rescan** to refresh the list. The serial lets the app find the same device even on a different USB port; if the saved device is missing, another connected one is used.
- In DP, 1P and 2P can't use the same device.
- If you unplug and replug a controller, or plug one in after starting the app, input comes back within about 2 seconds without saving or restarting.
- **Detect LR2 mode (dedicated controller only)** : Shown only for the PHOENIXWAN, FPS and LMT Classic profiles. A PHOENIXWAN in LR2 sends turntable signals differently; with this on, the app detects LR2 mode and shows the turntable correctly. If you never use LR2 mode, you can leave it off.
- **Reverse turntable direction** : Available for every profile except Keyboard. The small disc next to it follows your turntable input and spins the same way as the OBS widget. If it spins the opposite way when you turn the turntable clockwise, turn this on. Changing the checkbox, profile or device shows the result on the disc before you save, and once you save the widget spins the way you see here. (For Other controller, the disc moves once an axis is learned in Analog turntable.)

- **PHOENIXWAN+ / PHOENIXWAN+ LMT Classic / FPS EMP Gen2** : Works as soon as you select it. For the PHOENIXWAN LMT Classic board, pick the **PHOENIXWAN+ LMT Classic** profile. Both INFINITAS mode (EAC2dx/HID) and LR2 mode work with this profile; for LR2 mode, turn on **Detect LR2 mode** just like on a PHOENIXWAN.
- **RED-LMS** : a double controller whose 1P and 2P halves connect separately. In DP each side picks up its own half automatically, and SP 2P picks the 2P half. It's set up for the stock settings (turntable on the X axis, not reversed); if you reversed the turntable in the controller's own software, turn on **Reverse turntable direction** in the app too.
- **arcin-infinitas** : [arcin-infinitas](https://github.com/kinetic-flow/arcin-infinitas) — guaranteed to work only with arcin-infinitas, the INFINITAS firmware for arcin boards developed by kinetic-flow. Renaming the board (label) in the config tool is fine. Every turntable mode is followed automatically.
  - **Analog** (recommended for INFINITAS and beatoraja) : the turntable position is read as is.
  - **Digital** (recommended for LR2) : only the direction comes in, so the disc turns a little each time the direction changes, like PHOENIXWAN LR2 mode. There's no option to turn on.
  - **Digital + analog** : the analog position is read.
  - If you flipped the turntable direction in the arcin config tool (analog reversed, etc.), match the widget with **Reverse turntable direction** above.
  - If you use the arcin in **keyboard mode**, map it with the **Keyboard** profile.
- **Other controller (manual mapping)** : For controllers that are not officially supported and DIY boards such as Arduino. You map each button by hand. Officially supported controllers (PHOENIXWAN, FPS, arcin-infinitas, …) can be mapped here too, though their own profile is usually easier.
  - Click a field in the mapping table, then press the controller button. Clear a field to unmap it.
  - Pick one turntable input with the **Button turntable / Analog turntable** switch. The settings of the side you don't pick stay saved, so switching back brings them back as they were. If you learned an axis in 3.0.1 or earlier, it starts as Analog turntable; otherwise as Button turntable.
  - **Button turntable** : if your board reports the turntable as buttons (PHOENIXWAN LR2 mode, etc.), map them to 'Turntable clockwise (↓) / counterclockwise (↑)'. Like PHOENIXWAN LR2 mode, each press turns the disc 5 steps and the scratch light turns off on release. If it spins backwards, swap the two numbers. If the turntable worked fine up to 3.0.1 but not since 3.0.2, turn on **Legacy Button Turntable** (the old behavior: 2 steps per press, the light stays on after release). If the signal you map looks analog (an axis), a note suggests turning on analog turntable mode (the mapping is still made).
  - **Analog turntable** : if your board reports the turntable as an axis, press **Learn** and spin the turntable for 2 seconds. Once learned, the disc next to it follows the turntable. If it spins the opposite way when you turn clockwise, turn on **Reverse turntable direction**. **Unassign** removes the learned axis.
- **Keyboard** : Click a field in the keyboard mapping table, then press the key you want.

### Controller support

| Level | Controllers | Notes |
|---|---|---|
| ✅ **Officially supported** | PHOENIXWAN+, PHOENIXWAN+ LMT Classic board, RED-LMS, FPS EMP Gen2, arcin-infinitas | Dedicated profiles. Works as soon as you select it. |
| ✅ **Officially supported** | Keyboard | Map keys in the Keyboard profile. |
| 🔧 **Manual mapping** (may work) | Other IIDX controllers, DIY boards | Map buttons by hand in the **Other controller (manual mapping)** profile. **Not guaranteed to work.** |

Not every controller on the market is supported. The Other controller profile is built for arcade-style IIDX controllers and DIY boards, and no controller has been confirmed on real hardware yet.

**Likely to work**
- Arcade-style IIDX controllers that connect as a gamepad (HID)
- DIY boards built with Arduino and similar
- PS2 controllers connected through a USB adapter

**May not work, or not checked yet**
- Controllers in **Xbox (XInput) mode** : the app may not find the device. If your controller can switch modes, try gamepad (HID) mode.
- Controllers in **keyboard mode** : use the **Keyboard** profile instead of Other controller.
- **General gamepads** with many buttons or analog sticks : mapping may pick up the wrong numbers, or some buttons may not be read.
- **Several gamepads** connected : they all appear in the list, so pick the one you use under **Device**. Identical names are told apart by the last 4 digits of the serial number (or #1, #2); if that's confusing, unplug the ones you don't use.
- Konami's official INFINITAS controller : not checked yet.

**How to check your controller**
1. Set the controller profile to **Other controller (manual mapping)**.
2. Click a field in the mapping table and press a controller button to see if a number comes in.
3. Once all seven keys and the turntable are picked up, press **Save** and check that the widget reacts.

**Confirmed controllers** : none yet. If you tried one with Other controller, please tell us its name and the result (works / partly works / doesn't work) in [Issues](https://github.com/Coldlapse/IIDXwidget/issues) and we'll add it here.

### Requesting official support

If you'd like a dedicated profile for your controller, record its signals with Menu → **Controller probe** and request one through a GitHub issue. See the [controller support request guide](CONTROLLER.en.md).

### beatmania.app play count

| Setting | Meaning |
|---|---|
| **beatmania.app account** | Paste the token from [beatmania.app](https://beatmania.app) My Page → **Get an API token** and press **Connect**. It is checked with the server and saved right away, and the connected account name is shown. The token is stored encrypted with your Windows account. |
| **Upload remaining presses when quitting** | When you quit, uploads what this session has not sent yet. Off by default. When off, unsent presses are gone when you quit. |

- To upload by hand, go to Menu → **Session** → **Upload now**. Only what hasn't been sent is uploaded, so pressing it more than once never double-counts.
- Daily records are on your beatmania.app My Page. The server files each upload under the date it arrived (Korea time).

### Server ports

| Setting | Meaning |
|---|---|
| **Server port** | The number in the OBS browser source address. Default 8080. If you change it, change the OBS address too. |
| **WebSocket port** | The number the widget uses for live input. Default 5678. The widget connects by itself, so you don't enter it in OBS. |

Only change these if another program already uses the port. The [connection guide](CONNECTION.en.md) explains what a port is.

### Release sampling rules

Release is calculated with the same rules as [Rag](https://rag-oji.com/dakendisplay/)'s widget. See the [RELEASE guide](RELEASE.en.md) for details.

| Setting | Meaning |
|---|---|
| **Global release sample count** | How many recent presses the overall average release uses. Default 2000 (same as Rag's widget). Higher values change more slowly. |
| **Per-button release sample count** | How many recent presses each key's release number uses. Default 300 (same as Rag's widget). |
| **Long note (CN) threshold** | Presses held this long or longer count as long notes and are left out of the release average. The key shows the long note color while held. Default 200ms, 100–500ms. |
| **Open chatter detection settings** | Opens the settings view of the chatter window. For presets and thresholds, see the [chatter guide](CHATTER.en.md). |

When you save a new sample count or long note threshold, this session is recalculated with it right away.

### Widget appearance

KPS speedometer presets:

| Preset | Red zone from | Gauge end |
|---|---|---|
| IIDX players (default) | 20 KPS | 40 KPS |
| BMS players up to ★★ | 30 KPS | 50 KPS |
| BMS players ★★ and up | 40 KPS | 60 KPS |

| Setting | Meaning |
|---|---|
| **Transparent container background** | Makes the background behind the widget transparent so only the widget shows on stream. |
| **Show each button's release value above it** | Shows or hides the release number above each key. On by default. |
| **Session information position** | Attach the session dashboard below or above the widget body, or hide it. The promotion strip goes on the opposite side. |
| **Show widget promotion box** | Shows the IIDXwidget repository address as a small strip on the side opposite the session dashboard. Thanks if you turn it on 🙏 |
| **Show KPS speedometer gauge** | Shows KPS as a speedometer. On by default; turn it off to show just the number. The preset sets the red zone and the end of the gauge (table above). |
| **Turntable image mode** | **Single image** : one image spins with the turntable. **Two images** : a different image for each spin direction. |
| **Custom turntable image** | The image used for the disc (PNG, JPG, WEBP, BMP, and **animated images like GIFs**). **Delete** goes back to the default disc. |
| **Use recommended colors for this image** | Shown only when a turntable image is set. When on, colors are picked from the image (the default/upward image in two-image mode) and applied to the widget background, keys, text and long notes. While on, the color fields below just show the recommended colors. **Your own colors are kept, so turning it off brings them back.** GIFs use their first frame. Off by default. |
| **Colors** | Widget background, turntable background (also used for the dashboard and promotion strip), idle/active colors (the idle color also draws the dashboard dividers), text color, and the color of a key held as a long note. |

---

## 🐧 Linux (experimental)

An AppImage for Linux ships alongside the Windows installer. The app screens and the OBS widget are checked, but controller input hasn't been confirmed on real Linux hardware yet, so this is **experimental**. Please tell us how it went in [Issues](https://github.com/Coldlapse/IIDXwidget/issues).

1. From [Releases](https://github.com/Coldlapse/IIDXwidget/releases/latest), download `IIDXwidget-x.x.x-x86_64.AppImage` and `70-iidxwidget.rules`.
2. Make the AppImage executable: turn on "Allow executing" in the file properties, or run `chmod +x IIDXwidget-*.AppImage`.
3. Run it. If it complains about FUSE 2, install it:
   - Arch-based (CachyOS, etc.): `sudo pacman -S fuse2`
   - Ubuntu/Debian-based: `sudo apt install libfuse2`
4. **Controller permission (once):** on Linux a normal user can't read controller devices directly. Install the rule file, then unplug and replug the controller.
   ```
   sudo cp 70-iidxwidget.rules /etc/udev/rules.d/
   sudo udevadm control --reload && sudo udevadm trigger
   ```
   - Officially supported controllers work with this file as is. For Other controller (manual mapping), add one line with your device's VID:PID like the example in the file. You can find the VID:PID in Menu → **Controller probe** or with `lsusb`.
   - If the device shows up in the list but no input comes in, this step is usually missing. Menu → **Logs** shows a hint too.

Good to know
- **Keyboard mode** works in an X11 session. In a Wayland session (the default on KDE Plasma and GNOME) keyboard input is read only while an X11 window (such as LR2oraja running under XWayland) has focus.
- **Auto-update** is supported. The folder with the AppImage must be writable (your home folder is best).
- **Launch automatically when you log in** registers the AppImage in `~/.config/autostart`. If you move the AppImage, turn the setting off and on once.
- The beatmania.app token is encrypted with KWallet or GNOME Keyring. Without a keyring it is stored with weak protection.
- If the app doesn't start, run it from a terminal to see the error. Some distributions (Ubuntu 24.04 and later, etc.) need the `--no-sandbox` option.
- For two-PC streaming with a firewall (ufw), open the ports: `sudo ufw allow 8080,5678/tcp`
- Settings live in `~/.config/iidxwidget/`.

---

## 💡 Good to know

- If you quit and restart the app, the OBS widget reconnects by itself. While the app is off, OBS shows "Lost connection to IIDXwidget".
- Only one copy of the app runs. Launching it again brings the open window to the front.
- Right after updating the app, press **Refresh cache of current page** once in the OBS browser source properties.
- Questions and bugs go to [Issues](https://github.com/Coldlapse/IIDXwidget/issues).

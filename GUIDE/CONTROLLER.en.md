# 🎮 Controller support request

[한국어](CONTROLLER.md)

Controllers without official support can still be used with the **Other controller (manual mapping)** profile, but it isn't guaranteed, and the turntable or LR2 mode may not feel as smooth as with a dedicated profile.
If you'd like a pick-and-go **dedicated profile** like PHOENIXWAN+ and FPS have, request one with this guide.

For what's supported now, see [Usage and Settings → Controller support](USAGE.en.md#controller-support).

---

## 📋 What you need

- IIDXwidget 3.0.0 or later
- The controller, connected to the PC
- A GitHub account (to post the request)

---

## 1️⃣ Record the signals

1. Connect the controller and open Menu → **Controller probe** in the app.
2. Pick the controller under **Device**. If the **Live signal** changes when you press a button, you picked the right one.
   - If it doesn't, try another device. One controller can show up as several entries.
   - Two identical boards (1P and 2P) plugged in together are told apart by the serial number (S/N) next to the name. Record them one at a time.
   - If it isn't listed at all, press **Refresh**. Controllers connected in keyboard mode aren't listed — switch to gamepad mode.
3. Fill in the product name, current mode and notes. Leave anything you don't know empty.
4. For each step, press **Record** → do what it says → **Stop**. **Skip** buttons you don't have.

| Step | What to do |
|---|---|
| Hands off | Leave the controller alone for 3 seconds. |
| Keys 1–7 | Press and release each key slowly, 3 times. |
| Other buttons | Press E1–E4, START, SELECT and so on, one at a time. |
| Turntable | Turn it clockwise and counter-clockwise, slow and fast, then back and forth. |
| Rapid presses | Mash key 1 as fast as you can for 5 seconds. |
| Chords | Press several keys at once a few times. |
| Like real play | Play normally for about 10 seconds. |

> 💡 **Controllers with several modes** (LR2 mode, INFINITAS mode, …): switch modes, change the **mode name**, press **Start over for another mode**, and record once per mode. The signals often differ between modes.

---

## 2️⃣ Save the result file

Press **Save result file** to save a JSON file (the Downloads folder by default).

What's in the file
- The controller's product ID (VID:PID) and name, the signals recorded for each step, and their timing
- The app version, button layout, your current controller profile and manual mapping

What's not in the file
- Keyboard or mouse input (they aren't even listed)
- PC-specific details such as device paths, and your beatmania.app account

The recording is only saved as a file on this PC; the app doesn't upload it.

---

## 3️⃣ Post the request on GitHub

1. Press **Open a support request on GitHub** in the probe window, or open the [controller support request form](https://github.com/Coldlapse/IIDXwidget/issues/new?template=controller-support.yml).
2. Fill in the form: **Controller name**, **Profile you use now** and so on.
3. **Drag** the saved JSON file into the **Probe file** box to attach it. You can also click the box and paste the file.
   - Zip the file if it's over 25MB.
4. Submit the issue with the button below the form.

---

## 📬 What happens next

- We check whether a dedicated profile can be built from the recording, and may ask for more recordings or a hardware test.
- Once a dedicated profile is added, it ships in an update and the controller joins the official list.
- A request doesn't guarantee official support.

Even just telling us how manual mapping went (works / partly works / doesn't work) helps — we add it to the [confirmed controllers](USAGE.en.md#controller-support) list.

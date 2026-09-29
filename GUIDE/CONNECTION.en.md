# 🔌 First time? Connection guide

[한국어](CONNECTION.md)

How to put IIDXwidget on your OBS stream, **from the very beginning**.
You don't need to know what an IP or a port is. We'll explain just what you need.

---

## 1️⃣ One PC or two?

- **One-PC streaming** : The game and OBS run on the **same computer**. → go to [One-PC setup](#-one-pc-setup)
- **Two-PC streaming** : The computer you play on (**game PC**) and the computer running OBS (**stream PC**) are **separate**. → go to [Two-PC setup](#-two-pc-setup)

Always run IIDXwidget on **the computer your controller is plugged into (the game PC)**.

---

## 2️⃣ Three words to know

### IP address = your computer's home address
- Every computer connected to your router gets its own number. That's its **IP address**. It usually looks like `192.168.0.12`.
- To show a screen from another computer, you need that computer's IP address.
- **`127.0.0.1`** is a special address that means "**this computer itself**". It's what you use for one-PC streaming.

### Port = a door number inside the computer
- Each program on a computer uses its own door. That door number is a **port**.
- IIDXwidget shows the widget through door **8080**. That's why the address ends with `:8080`.
- It also uses door 5678, but the widget connects to it by itself, so you can ignore it.

### Same router = same house
- For two-PC streaming, both computers must be connected to **the same router** to find each other.
- Wired or Wi-Fi doesn't matter, as long as it's the same router.

---

## 🖥 One-PC setup

1. Start IIDXwidget.
2. In OBS, click **＋** under **Sources** → **Browser**.
3. Give it any name and click **OK**.
4. Enter the following:
   - **URL** : `http://127.0.0.1:8080/widget/`
   - **Width** : `800`, **Height** : `600` (for DP, **Width** `1320`)
   - Leave **Local file** unchecked.
5. Click **OK** and you're done. Press a key and check that the widget reacts in OBS.

![OBS browser source](../images/2.png)

---

## 🖥🖥 Two-PC setup

### ① Find the game PC's IP address
Do this on the **game PC**.

1. Press **Windows key + R**.
2. Type `cmd` and click **OK**. A black window opens.
3. Type `ipconfig` and press **Enter**.
4. Write down the number on the **IPv4 Address** line (e.g. `192.168.0.12`).
   - If you see more than one, pick the one starting with `192.168.` or `10.`.

### ② Allow it through the firewall
Do this on the **game PC**.

- When IIDXwidget starts for the first time and a **Windows Firewall** window appears, click **Allow**.
- If you missed it or clicked Cancel:
  1. Open **Windows Security** from the Start menu.
  2. Go to **Firewall & network protection** → **Allow an app through firewall**.
  3. Click **Change settings**, find **IIDXwidget** in the list and tick **Private**.
- If your network type is **Public**, the connection may be blocked. Change it to **Private** in **Settings → Network & internet → (your network) Properties**.
- If the game PC runs Linux, see [Usage and settings → Linux](USAGE.en.md#-linux-experimental).

### ③ Put the address in OBS
Do this on the **stream PC**.

1. In OBS, click **＋** under **Sources** → **Browser**.
2. In **URL**, use the IP from step ①:
   - `http://192.168.0.12:8080/widget/` ← replace the numbers with your IP.
3. Keep **Width** `800`, **Height** `600` (for DP, width `1320`) and click **OK**.

### ④ Check that it works
- Put the same address into a web browser (Chrome etc.) on the stream PC. If you see the widget, the connection works.
- If not, see [When it doesn't work](#-when-it-doesnt-work) below.

## 🛡 If a warning appears during install

- **A "Windows protected your PC" window appears**
  - This is the standard Windows warning for programs without a code signature. Click **More info → Run anyway** to install.
- **Smart App Control blocks the installer (Windows 11)**
  - Smart App Control is a Windows 11 feature that blocks programs without a code signature that few people use. There is no **Run** button then, so it can't be installed as is.
  - To turn it off: **Windows Security → App & browser control → Smart App Control settings → Off**
  - Turning it back **On** from the same place after installing is recommended. On the developer's PC the app and auto-update kept working after turning it back on, but that can't be guaranteed everywhere. If the app or updates get blocked after that, turn it off again and let us know in [Issues](https://github.com/Coldlapse/IIDXwidget/issues). (Older Windows 11 needed a reset to turn it back on once it was off; recent updates can turn it back on right away.)
  - Why there is no code signature: code signing certificates cost quite a bit, so this free, personally made program doesn't have one yet. Beyond saying it's safe, the developer has no other way to prove it. The source code is fully public, so please check and decide for yourself.
- **Windows Defender flags version 2.1.0 or earlier as a virus**
  - The installer may be flagged as `Trojan:Win32/Vigorf.A` and an installed file as `Trojan:Win32/KeyLogger!AMTB`. **These are false positives.**
  - A third-party component used to read keys in keyboard mode looked like a keylogger. It is no longer used since 3.0.0. **Please install the latest version.**
- **How is keyboard input used?**
  - Keys are read only in keyboard mode, and only the keys you mapped are used for the widget.
  - Key input is never sent over the internet. The only thing that goes online is your press count, when you press Upload on the **Session** page or when **Upload remaining presses when quitting**, which you turn on yourself, runs. The source code is fully public, so you can check.
- If it's still blocked on the latest version, let us know in [Issues](https://github.com/Coldlapse/IIDXwidget/issues).

---

## ❗ When it doesn't work

- **Nothing shows up at all**
  - Make sure IIDXwidget is running on the game PC.
  - Check the address letter by letter. You need `http://`, `:8080` and the `/widget/` at the end.
- **It says "Lost connection to IIDXwidget"**
  - The address is right, but IIDXwidget is off or restarting. It reconnects by itself once the app is running.
- **Two-PC worked yesterday but not today**
  - Your router may have given the game PC a new IP. Repeat step ① and, if the IP changed, fix the OBS address.
  - If that keeps happening, set a **static IP (DHCP reservation)** for the game PC in your router settings. It differs by router maker, so search for "your router name + static IP".
- **Two-PC: it doesn't open in a browser either**
  - Check that both computers are on the same router and that you did step ② (firewall).
- **It says the port is already in use**
  - Another program is using 8080. In Menu → **Settings**, change **Server port** to another number (e.g. 8081), and change `8080` in the OBS address to the same number.
- **After updating, the widget still looks old**
  - Press **Refresh cache of current page** once in the OBS browser source properties.
- **My controller isn't recognized**
  - Menu → **Logs** shows the cause (for example "Could not find the device").
  - If you unplug and replug the cable, it reconnects within about 2 seconds without a restart. A controller plugged in after starting the app is picked up too.
  - Check that the controller profile in Settings is right. For a controller that isn't listed, try the **Other controller (manual mapping)** profile. ([Controller support](USAGE.en.md#controller-support))
  - On Linux, check that the controller permission rule (udev) is installed. ([Linux notes](USAGE.en.md#-linux-experimental))

Still stuck? Take a screenshot of Menu → **Logs** and post it in [Issues](https://github.com/Coldlapse/IIDXwidget/issues).

---

For other features and settings, see [Usage and Settings](USAGE.en.md).

# FreeOS desktop (Wails v3 + green portable)

Windows end-user product: **download the NSIS `.exe` → install → open FreeOS**
(Octop host shell + bundled openXYOS organization console). This is **not**
`src/octop/infra/desktop` (remote desktop streaming).

| Path | Role |
|------|------|
| [`portable/`](portable/) | Green zip packaging (CPython + host wheel + Node/openXYOS sidecar) |
| [`src/`](src/) | Wails v3 shell: extract zip, start host + sidecar, tray/settings |
| [`package-release.sh`](package-release.sh) | Native end-to-end portable + Wails release build |

## Data directory

Same precedence as the FreeOS CLI/server:

1. `FREEOS_HOME`
2. `OCTOP_HOME` (legacy)
3. existing `~/.freeos`
4. existing `~/.octop`
5. new installs → `~/.freeos`

- Green runtime extract → `{home}/portable/`
- Organization sidecar data → `{home}/org-os/`
- Local openXYOS workdir (FE+BE) → `%LOCALAPPDATA%\FreeOS\openxyos` on Windows,
  else `{home}/openxyos`. During Setup the FreeOS installer `nsExec`s a
  shipped **provisioner subprocess** (`provision-openxyos.ps1`) that expands
  `openxyos-runtime.zip` with `tar.exe` into that live workdir (and keeps
  `$INSTDIR\openxyos` as a sealed copy; the `openxyos-runtime` zip and folder
  are deleted after a successful provision), starts FE/BE
  at medium integrity (Node inherits `CORS_ORIGIN` / `NODE_ENV`; stdout/stderr
  go to UTF-8 `start.log`), and writes `.install-ready` only after
  `http://127.0.0.1:3780/api/health/livez` is healthy. The Setup detail list
  shows localized step results only (`nsExec::Exec`, not `ExecToLog`); full
  PowerShell/Node console stays in `%LOCALAPPDATA%\FreeOS\openxyos\provision.log`
  and `start.log` so UTF-8 Chinese is not misread as GBK. Before extract it
  stops only FreeOS openXYOS Node (`start.pid` / live and `$INSTDIR\openxyos`
  paths) and waits until that owned process is gone. After extract+heal, Node
  starts with cwd at the live root when `backend-dist/server.js` and
  `dist/index.html` exist there (a leftover nested `openxyos\openxyos` tree
  must not win — that cwd exits immediately with an empty console). It unpacks into a LocalAppData
  temp dir, logs tar stderr to `provision.log`, and treats a non-zero tar as
  success when the layout heals. Transient `[Error] POST /api/auth` / `[seed]`
  lines in `start.log` are not a provision failure when livez is healthy. If
  Node dies before livez, the provisioner exits 10 with a `start.log` excerpt
  in `provision.log` instead of waiting out a livez timeout. A failed
  subprocess is a failed install step (retry the provisioner). There is no
  Windows logon autostart: when FreeOS starts later, it brings local
  openXYOS up with it. Organization embeds `http://127.0.0.1:3780` directly.
- Shell prefs → `{home}/desktop-settings.json`

## Windows install finish

The NSIS finish page offers **运行 FreeOS** / **Run FreeOS**, checked by
default. Leave it checked to start FreeOS from `$INSTDIR` when Setup
closes (working directory is the install folder). The launch uses the
unelevated explorer token so the first run does not stamp `%USERPROFILE%\.freeos`
as High integrity. Uncheck to skip. Chinese installer strings are compiled
with `makensis -INPUTCHARSET UTF8` from a UTF-8 BOM `project.nsi`.

The install log is no longer only `FreeOS.exe` + shortcuts. A healthy package
also copies `openxyos-runtime.zip` plus the provisioner (`provision-openxyos.ps1`
/ `.cmd`, `start-sidecar.ps1` / `.cmd`). Setup **nsExecs that provisioner as
a child process** (`nsExec::Exec`, stdout discarded) and waits for exit 0.
The child extracts with Windows
`tar.exe` (quoted paths, so `Program Files` works) into a LocalAppData
temp dir, then heals that tree into `%LOCALAPPDATA%\FreeOS\openxyos` after
stopping only the FreeOS openXYOS Node that would lock those files and
waiting until it is gone. tar
stdout/stderr go to UTF-8 `provision.log`, not the NSIS detail list. A non-zero tar is not exit 3 when the
layout is complete after heal. It then starts Node at medium integrity
(IShellDispatch2 — never High-IL Node from the elevated installer), waits
for livez, and writes `.install-ready` only when healthy. `$INSTDIR\openxyos`
is the sealed install copy. After success the provisioner removes
`$INSTDIR\openxyos-runtime.zip` (and similarly named archives) plus the
`$INSTDIR\openxyos-runtime` folder, and a sibling `openxyos-runtime` under
`%LOCALAPPDATA%\FreeOS` if one was staged there. A failed provision leaves
those artifacts for debugging. A README-only tree or a
failed health check is a provision failure, not a skipped success. Setup does
**not** register HKCU Run or a logon scheduled task.

Why LocalAppData, written by an elevated installer: `$INSTDIR` is typically
`C:\Program Files\FreeOS`, which a later unelevated `FreeOS.exe` cannot
mutate. The app’s live root is `%LOCALAPPDATA%\FreeOS\openxyos`. Setup
reads the installing user’s `LOCALAPPDATA` environment variable (not NSIS
`$LOCALAPPDATA` after `SetShellVarContext all`, which is ProgramData) and
writes the complete FE+BE there so first launch does not pay a copy/unpack
cost. Organization then embeds `http://127.0.0.1:3780` directly.
Downloading the latest openXYOS source uses the same
native folder picker as the project workdir (any drive), not a typed path only.

Override the workdir with `FREEOS_OPENXYOS_HOME`.

## Windows uninstall

The NSIS uninstaller (Settings → Apps, or `uninstall.exe` in the install
folder) removes program-owned files. If FreeOS (or its host / org-sidecar)
is still running, it **asks** before continuing (Chinese / English). Cancel
aborts uninstall and leaves processes running. Confirm closes them
(graceful, then force) and then wipes the install directory. Version stays
`0.0.1`; rebuilds replace the existing GitHub Release `v0.0.1` assets
rather than cutting a new tag.

**Removes**

- The install directory (`Program Files\FreeOS` by default, or the folder
  chosen at install time): `FreeOS.exe`, `uninstall.exe`, WebView2 folders
  created next to the exe, extracted portable / org-sidecar leftovers if they
  were written under `$INSTDIR`, and any other installer-owned tree there
- Start Menu, Desktop, and Startup shortcuts created by the installer
- Add/Remove Programs registry key and the autostart Run values
  (`FreeOS` / `FreeOS-openXYOS`) plus the `FreeOS-openXYOS` logon task
- Program-owned WebView2 / Wails cache under `%AppData%\FreeOS.exe`,
  `%LOCALAPPDATA%\FreeOS.exe.WebView2`, and `%LOCALAPPDATA%\FreeOS`
  (including `WebView2\`)

**Keeps**

- `%USERPROFILE%\.freeos` (or `FREEOS_HOME` / `OCTOP_HOME` / legacy `~/.octop`):
  workspaces, `octop.db`, memories, settings, logs, and the extracted portable
  runtime under `{home}/portable/`
- Documented exceptions **inside** the install directory, if you created them:
  `User Data` or `userdata`. The default app never writes user content there.

Do not point `FREEOS_HOME` at a path inside the install directory — uninstall
would treat that tree as program files (unless it is named `User Data` /
`userdata`).

## What the installer starts

On first open the shell:

1. Extracts the bundled portable **Python host** (the openXYOS FE+BE tree
   was already written to `%LOCALAPPDATA%\FreeOS\openxyos` during Setup).
2. If that live workdir is already complete, skips any copy/unpack. A
   copy from `$INSTDIR` / `portable/org-sidecar` is heal-only (other
   Windows users, or a tree that Setup never populated).
3. If `http://127.0.0.1:3780/api/health/livez` is already up from Setup,
   attaches to it. Otherwise FreeOS starts local openXYOS from the live
   workdir and waits until livez responds. There is no logon autostart.
4. Starts the FreeOS host with `FREEOS_HOME`, `FREEOS_ORG_ENABLE=1`, and
   `FREEOS_OPENXYOS_HOME`.
5. Opens the desktop window on the host UI with a local guest session (no
   login wall). Chat and **Organization** are both available — no separate
   Node install. Register or sign in later when a save needs an account.

## Build green zip

From repo root (needs Node 20+ so openXYOS can be built into the zip):

```bash
make -f desktop/portable/Makefile green
```

Skip the sidecar only when debugging the Python runtime: `SKIP_ORG_SIDECAR=1`.

CI: `.github/workflows/octop-desktop.yml` (**name:** FreeOS Desktop Package)
builds native platform/arch variants. `v*` tags and `workflow_dispatch`
(platforms=`all`) run all six; pull requests that touch `desktop/` or
`modules/openxyos/` build `darwin-*` and `windows-*` (amd64 + arm64). Each job
creates the green zip (including the sidecar) and packages the Wails app.

This cloud/Linux VM cannot emit a Windows `.exe`. The job that does is
**FreeOS Desktop Package** → matrix `windows-amd64` / `windows-arm64`
(`wails3 task package` + NSIS).

## Build a complete desktop release

Run the end-to-end script on the matching native host. It builds the Dashboard,
creates and verifies the portable runtime (with openXYOS), embeds it into Wails,
and produces the final native package:

```bash
desktop/package-release.sh
# Reuse an existing desktop/portable/release/FreeOS-portable-<plat>-<version>.zip:
desktop/package-release.sh darwin-arm64 --reuse-portable
```

Wails requires native packaging, so all six variants are produced by the CI
matrix on macOS, Linux, and Windows runners rather than cross-compiled locally.
Windows packaging also needs [NSIS](https://nsis.sourceforge.io/) (`makensis`)
so the `.exe` is an installer rather than a portable single-file binary.

## Build the Wails shell

Run these from **`desktop/src`** (that directory contains `Taskfile.yml` and
`build/config.yml`). Requires **Go 1.25+**, [Wails v3](https://v3.wails.io/)
`v3.0.0-beta.13`.

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.13
cd desktop/src
go mod tidy
wails3 build            # development binary under desktop/src/bin/
wails3 task package ARCH=arm64 VERSION=<version> \
  PORTABLE_ZIP=../portable/release/FreeOS-portable-darwin-arm64-<version>.zip
```

Dev against an already-running FreeOS host (skips the bundled green zip):

```bash
cd desktop/src
OCTOP_DESKTOP_URL=http://127.0.0.1:8088 wails3 dev
```

Without `OCTOP_DESKTOP_URL`, first launch uses `~/.freeos/portable/` if valid,
otherwise extracts the matching zip shipped with the desktop package (embedded
in the Windows and Linux binaries, under `Contents/Resources` on macOS). The
Wails shell never downloads the host over the network. For local runtime
debugging, set
`OCTOP_DESKTOP_PORTABLE_ZIP=/absolute/path/FreeOS-portable-<plat>-<version>.zip`.
On later launches, a newer bundled portable version replaces the extracted
runtime after creating a consistent SQLite backup under `{home}/backups/`.
The upgraded host then applies the normal database migrations during startup.
Newer extracted runtimes are never downgraded; PostgreSQL remains externally
managed and is not copied by the desktop shell.

GitHub Release names follow `FreeOS-<kind>-<os>-<arch>-<version>.<ext>`:

- Desktop GUI: `FreeOS-desktop-<plat>-<version>.dmg` (macOS; open and drag
  `FreeOS.app` into Applications), `.exe` (Windows NSIS installer — copies
  into `Program Files\FreeOS` and creates Start Menu + desktop shortcuts),
  `.tar.gz` (Linux)
- Green runtime zip: `FreeOS-portable-<plat>-<version>.zip`
- PyPI wheels stay `octop-<version>-py3-none-any.whl` (PEP 427)

Older `Octop-portable-*` / `Octop-<plat>.zip` files beside the binary are still
accepted when extracting a local/dev build. They are **not** published anymore.

The Linux tar.gz contains only the GUI binary; it has no separate portable zip or
server terminal process. Runtime upgrades remain owned by the host:
the shell sets `OCTOP_GREEN_PACKAGES`, so `octop update` / `freeos update`
upgrades the extracted `packages/` directory through the existing `--target`
logic.

Linux also needs GTK4 + WebKitGTK 6 to link. macOS 12+.

## Icons

FreeOS circular mark (gray ring, yellow / green / red teardrops, blue center).

| File | Used for | Rule |
|------|----------|------|
| `src/build/appicon.png` | Windows `.ico`, Linux | Full-bleed 512x512 artwork (mark ≥90% of canvas; regenerate with `python3 src/build/generate_appicons.py`) |

Windows installer icons (`.ico`) are produced on the **FreeOS Desktop Package** CI
job (`.github/workflows/octop-desktop.yml`) via `wails3 generate icons -input appicon.png`.
This Linux checkout cannot emit a signed `.exe`; after merging, that workflow
rebuilds `windows/icon.ico` and the NSIS shortcut from the updated `appicon.png`.
| `src/build/appicon-macos.png` | macOS `.icns` | 1024x1024 canvas, artwork 824x824 centred |
| `src/assets/tray-icon.png` | Tray + app icon on Windows/Linux | Full-bleed |
| `src/assets/tray-icon-template.png` | macOS menu bar | 88px canvas, 64px black-on-transparent glyph |
| `src/assets/freeos-logo.png` | Splash brand mark (fallback) | Transparent circular mark |
| `src/assets/xyai-mascot-*.webp` | Splash / loading poses | XYAI robot; tap to switch |

macOS sizes both surfaces to a fixed box, so the padding has to live in the
artwork: the Dock follows Apple's 824/1024 icon grid, and Wails scales the menu
bar image to the full `NSStatusBar` thickness (22pt) where the glyph should be
~16pt. Full-bleed sources on either surface render a size bigger than every
other app. On macOS the Dock icon comes from the bundle's `icons.icns` only —
see `applyAppIcon` in `src/icons_darwin.go`.

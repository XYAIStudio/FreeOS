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
  else `{home}/openxyos`. The NSIS installer copies a prebuilt
  `openxyos-runtime.zip` plus `openxyos-provision.ps1` into `$INSTDIR`, then
  launches that **independent provisioner** (unelevated / medium IL). The
  provisioner extracts with `tar.exe`, starts FE+BE, waits for
  `http://127.0.0.1:3780/api/health/livez`, and writes `.install-ready` only
  when healthy. A README-only tree or a livez miss is a **provision failure**
  (Setup aborts). Success leaves a user-level sidecar running (HKCU Run
  `FreeOS-openXYOS` + `start-sidecar.ps1`) so Organization embeds immediately
  — no first-open copy and no 「启动边车」 click.
- Shell prefs → `{home}/desktop-settings.json`

## Windows install finish

The NSIS finish page offers **运行 FreeOS** / **Run FreeOS**, checked by
default. Leave it checked to start FreeOS from `$INSTDIR` when Setup
closes (working directory is the install folder). The launch uses the
unelevated explorer token so the first run does not stamp `%USERPROFILE%\.freeos`
as High integrity. Uncheck to skip. Chinese installer strings are compiled
with `makensis -INPUTCHARSET UTF8` from a UTF-8 BOM `project.nsi`.

The install log is no longer only `FreeOS.exe` + shortcuts. A healthy package
copies `openxyos-runtime.zip` (prebuilt Node + openXYOS frontend/backend)
and the checked-in `openxyos-provision.ps1` / `start-sidecar.ps1`. NSIS does
**not** FileWrite `extract-openxyos.cmd` or `goto` labels. After the FreeOS
shell files and shortcuts are in place, Setup launches the provisioner as a
separate unelevated process (IShellDispatch2 / explorer token — no High-IL
Node) and waits for its exit code.

That process is the same shape as installing openXYOS alone: `tar.exe`
extract into `%LOCALAPPDATA%\FreeOS\openxyos`, start Node, wait until
`http://127.0.0.1:3780/api/health/livez` is healthy, then stamp
`.install-ready` and register HKCU Run `FreeOS-openXYOS`. Success requires
runtime on disk **and** services up **and** livez. A README-only tree or a
livez miss aborts Setup (error 67 = extract/layout, 68 = start/livez /
provisioner never returned). Read
`%LOCALAPPDATA%\FreeOS\openxyos\provision.log` for the failed stage
(`extract` / `start` / `livez`); do not treat a start failure as a generic
port-3780 check.

`$INSTDIR\openxyos-runtime.zip` is the sealed Program Files backup. The
elevated installer does not create the live tree itself (that would stamp
admin ACLs). First FreeOS launch attaches to the already-provisioned live
root. Organization embeds `http://127.0.0.1:3780` without a manual
「启动边车」 click. Downloading the latest openXYOS source uses the same
native folder picker as the project workdir (any drive), not a typed path only.

Override the workdir with `FREEOS_OPENXYOS_HOME`.

### Verify a Windows amd64 silent / elevated install

```bat
FreeOS-desktop-windows-amd64-<version>.exe /S
echo %ERRORLEVEL%
```

Exit `0` means the FreeOS shell copy **and** the independent openXYOS
provisioner both succeeded. Then:

```bat
dir "%LOCALAPPDATA%\FreeOS\openxyos\node\node.exe"
type "%LOCALAPPDATA%\FreeOS\openxyos\.install-ready"
curl http://127.0.0.1:3780/api/health/livez
reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v FreeOS-openXYOS
```

To retry only openXYOS (same process Setup launched):

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\FreeOS\openxyos-provision.ps1"
```

Elevated (default machine) install still launches that script at medium
integrity. Do not `Run as administrator` the provisioner itself.

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
3. If `http://127.0.0.1:3780/api/health/livez` is already up (install-time
   persist / HKCU Run), attaches to it. Otherwise starts the sidecar from
   the live workdir and waits until livez responds. Closing FreeOS does
   **not** kill that user-level sidecar.
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

FreeOS green portable package
=============================

Extract this zip anywhere. It includes a portable CPython runtime and the
FreeOS host (in-host Organization). No system Python is required. The
Node/openXYOS sidecar is optional and is not in the default v0.0.2 zip.

Start
-----
  macOS / Linux:  ./start.sh
  Windows:        start.bat

Defaults: http://127.0.0.1:8088   data dir = ./data (FREEOS_HOME)

  ./start.sh --home /path/to/data --host 127.0.0.1 --port 8088

First launch follows the normal FreeOS setup wizard (create admin password).
Organization uses the in-host /api/org-module surfaces. A Node process on
3780 is not required. Set FREEOS_ORG_SIDECAR=1 only for advanced export/sync
when a sidecar tree is present.

Layout
------
  runtime/      portable CPython
  packages/     FreeOS host + locked dependencies (site-packages)
  org-sidecar/  optional Node + openXYOS (SHIP_OPENXYOS_RUNTIME=1 builds only)
  launch.py     entry bootstrap (loads packages/ + Windows pywin32 DLLs)
  start.sh / start.bat
  README.txt
  VERSION.txt

Notes
-----
  Do not set PYTHONPATH=packages. Always start via start.sh / start.bat /
  launch.py so .pth files (pywin32) are processed.

  macOS: if Gatekeeper quarantines the unzipped folder:

    xattr -dr com.apple.quarantine .

Windows: if import pywintypes fails, rebuild from a current
  green package (launch.py + pywin32 DLL copy). Do not set PYTHONPATH manually.

Compatibility
-------------
  OCTOP_HOME is still honored as a legacy alias for FREEOS_HOME.
  The Python package and CLI remain `octop` alongside `freeos`.

FreeOS green portable package
=============================

Extract this zip anywhere. It includes a portable CPython runtime, FreeOS
(Octop-compatible host), and a bundled Node + openXYOS organization sidecar.
No system Python or Node install is required.

Start
-----
  macOS / Linux:  ./start.sh
  Windows:        start.bat

Defaults: http://127.0.0.1:8088   data dir = ./data (FREEOS_HOME)

  ./start.sh --home /path/to/data --host 127.0.0.1 --port 8088

First launch follows the normal FreeOS setup wizard (create admin password).
The organization module is enabled automatically; the sidecar listens on
http://127.0.0.1:3780 and the dashboard /organization page embeds it.

Layout
------
  runtime/      portable CPython
  packages/     FreeOS host + locked dependencies (site-packages)
  org-sidecar/  bundled Node + built openXYOS
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

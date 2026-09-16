"""Download the latest openXYOS source zip for other deployments."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

import httpx

from octop.infra.utils.host_dirs import assert_safe_host_path

OPENXYOS_SOURCE_ZIP = "https://github.com/XYAIStudio/openXYOS/archive/refs/heads/main.zip"


def download_openxyos_source(dest: str, *, url: str = OPENXYOS_SOURCE_ZIP) -> str:
    """Save the GitHub main-branch source zip into ``dest`` and extract it.

    Strategy: download ``XYAIStudio/openXYOS`` ``main`` zip (latest published
    tree on the default branch). The zip is extracted into a new
    ``openXYOS-main`` folder under the user-chosen destination. Existing
    files in that destination are not overwritten outside that folder.
    """
    target = Path(dest).expanduser()
    assert_safe_host_path(str(target))
    target.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.content
    archive = zipfile.ZipFile(io.BytesIO(payload))
    archive.extractall(target)
    zip_path = target / "openXYOS-main.zip"
    zip_path.write_bytes(payload)
    return str(target.resolve())

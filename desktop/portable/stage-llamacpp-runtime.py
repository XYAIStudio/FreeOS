"""Download and verify the pinned llama.cpp runtime for portable packages."""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath


def _safe_extract(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        for info in bundle.infolist():
            relative = PurePosixPath(info.filename)
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"unsafe archive member: {info.filename}")
            target = destination.joinpath(*relative.parts)
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(info) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stage(platform: str, staging: Path, *, manifest_path: Path) -> Path | None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entry = manifest.get("platforms", {}).get(platform)
    if not isinstance(entry, dict):
        return None
    expected = str(entry["sha256"]).lower()
    destination = staging / "llama.cpp"
    with tempfile.TemporaryDirectory(prefix="freeos-llamacpp-") as temp:
        archive = Path(temp) / str(entry["archive"])
        urllib.request.urlretrieve(str(entry["url"]), archive)  # noqa: S310
        actual = _sha256(archive)
        if actual != expected:
            raise ValueError(f"llama.cpp archive checksum mismatch: {actual}")
        if destination.exists():
            shutil.rmtree(destination)
        _safe_extract(archive, destination)
    server = destination / ("llama-server.exe" if platform.startswith("windows-") else "llama-server")
    if not server.is_file():
        raise FileNotFoundError(f"llama-server missing after extraction: {server}")
    license_path = Path(__file__).with_name("LLAMA_CPP_LICENSE")
    shutil.copy2(license_path, destination / "LICENSE-llama.cpp")
    metadata = {
        "version": manifest["version"],
        "license": manifest["license"],
        "source": manifest["source"],
        "archive": entry["archive"],
        "sha256": expected,
    }
    (destination / "FREEOS_RUNTIME.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return destination


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: stage-llamacpp-runtime.py <platform> <staging>", file=sys.stderr)
        return 2
    manifest = Path(__file__).with_name("llamacpp-runtime.json")
    result = stage(argv[1], Path(argv[2]), manifest_path=manifest)
    if result is None:
        print(f"[llama.cpp] no pinned runtime for {argv[1]}; skipping")
    else:
        print(f"[llama.cpp] staged {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

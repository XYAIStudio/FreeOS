"""Persist org-module enablement and probe the openXYOS sidecar."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from octop.modules.org_os.catalog import OPENXYOS_MODULES, catalog_keys

logger = logging.getLogger(__name__)

ORG_PLUGIN_ID = "org-os"
DEFAULT_SIDECAR_URL = "http://127.0.0.1:3780"
_CONFIG_SECTION = "org_os"


@dataclass(frozen=True)
class SidecarHealth:
    reachable: bool
    url: str
    status_code: int | None = None
    detail: str = ""
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class OrgModuleStatus:
    enabled: bool
    plugin_id: str
    sidecar: SidecarHealth
    home: str
    catalog_keys: list[str]
    embed_url: str
    proxy_prefix: str
    start_command: str
    tenant_id: str = ""
    governance_enabled: bool = False
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["sidecar"] = asdict(self.sidecar)
        data["catalog"] = list(OPENXYOS_MODULES)
        return data


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def normalize_sidecar_url(url: str) -> str:
    cleaned = (url or "").strip().rstrip("/")
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return DEFAULT_SIDECAR_URL
    return cleaned


class OrgModuleService:
    """Read/write ``config.json`` ``modules.org_os`` and probe the sidecar."""

    def __init__(self, *, config_path: Path, home: Path | None = None) -> None:
        self.config_path = config_path
        self.home = home or config_path.parent

    def _section(self) -> dict[str, Any]:
        modules = _read_json(self.config_path).get("modules")
        if not isinstance(modules, dict):
            return {}
        section = modules.get(_CONFIG_SECTION)
        return section if isinstance(section, dict) else {}

    def is_enabled(self) -> bool:
        section = self._section()
        if "enabled" in section:
            return bool(section.get("enabled"))
        plugins = _read_json(self.config_path).get("plugins")
        if isinstance(plugins, dict):
            entry = plugins.get(ORG_PLUGIN_ID)
            if isinstance(entry, dict) and "enabled" in entry:
                return bool(entry.get("enabled"))
        return False

    def sidecar_url(self) -> str:
        env = os.environ.get("FREEOS_ORG_SIDECAR_URL", "").strip()
        if env:
            return normalize_sidecar_url(env)
        section = self._section()
        raw = section.get("sidecar_url")
        if isinstance(raw, str) and raw.strip():
            return normalize_sidecar_url(raw)
        return DEFAULT_SIDECAR_URL

    def tenant_id(self) -> str:
        env = os.environ.get("FREEOS_ORG_TENANT_ID", "").strip()
        if env:
            return env
        section = self._section()
        raw = section.get("tenant_id")
        return str(raw).strip() if raw is not None and str(raw).strip() else ""

    def governance_enabled(self) -> bool:
        section = self._section()
        gov = section.get("governance")
        if isinstance(gov, dict) and "enabled" in gov:
            return bool(gov.get("enabled"))
        return False

    def set_governance_enabled(self, enabled: bool, *, tenant_id: str | None = None) -> None:
        data = _read_json(self.config_path)
        modules = data.get("modules")
        if not isinstance(modules, dict):
            modules = {}
            data["modules"] = modules
        section = modules.get(_CONFIG_SECTION)
        if not isinstance(section, dict):
            section = {}
        gov = section.get("governance")
        if not isinstance(gov, dict):
            gov = {}
        gov["enabled"] = bool(enabled)
        section["governance"] = gov
        if tenant_id is not None and tenant_id.strip():
            section["tenant_id"] = tenant_id.strip()
        modules[_CONFIG_SECTION] = section
        _write_json(self.config_path, data)

    def set_enabled(self, enabled: bool, *, sidecar_url: str | None = None) -> None:
        data = _read_json(self.config_path)
        modules = data.get("modules")
        if not isinstance(modules, dict):
            modules = {}
            data["modules"] = modules
        section = modules.get(_CONFIG_SECTION)
        if not isinstance(section, dict):
            section = {}
        section["enabled"] = bool(enabled)
        if sidecar_url:
            section["sidecar_url"] = normalize_sidecar_url(sidecar_url)
        modules[_CONFIG_SECTION] = section

        plugins = data.get("plugins")
        if not isinstance(plugins, dict):
            plugins = {}
            data["plugins"] = plugins
        entry = plugins.get(ORG_PLUGIN_ID)
        if not isinstance(entry, dict):
            entry = {}
        entry["enabled"] = bool(enabled)
        plugins[ORG_PLUGIN_ID] = entry
        _write_json(self.config_path, data)

    def probe_sidecar(self, timeout: float = 2.0) -> SidecarHealth:
        url = self.sidecar_url()
        livez = f"{url}/api/health/livez"
        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                response = client.get(livez)
        except httpx.HTTPError:
            return SidecarHealth(
                reachable=False,
                url=url,
                detail="sidecar unreachable",
            )
        payload: dict[str, Any] = {}
        try:
            body = response.json()
            if isinstance(body, dict):
                payload = body
        except ValueError:
            payload = {}
        ok = response.status_code < 500
        return SidecarHealth(
            reachable=ok,
            url=url,
            status_code=response.status_code,
            detail="ok" if ok else f"HTTP {response.status_code}",
            payload=payload,
        )

    def status(self) -> OrgModuleStatus:
        sidecar = self.probe_sidecar()
        enabled = self.is_enabled()
        notes = [
            "Host identity stays in FreeOS (JWT users under the platform home).",
            "openXYOS is the control plane; FreeOS/Octop is the data plane. "
            "Do not replace the Octop agent runtime with openXYOS chat.",
            "Proxy forwards X-FreeOS-User* and X-FreeOS-Tenant-Id; sign in to "
            "the sidecar separately for mutating org routes.",
            "Plugin id org-os is seeded disabled; enable it here or via "
            "Admin → Plugins / `freeos org enable`.",
            "Phase A: `freeos org governance enable` and `freeos org skills generate`.",
        ]
        if not sidecar.reachable and enabled:
            notes.append(
                f"Sidecar is off. Start it with: bash scripts/run-org-sidecar.sh "
                f"(listens on {sidecar.url})."
            )
        return OrgModuleStatus(
            enabled=enabled,
            plugin_id=ORG_PLUGIN_ID,
            sidecar=sidecar,
            home=str(self.home),
            catalog_keys=catalog_keys(),
            embed_url=sidecar.url if sidecar.reachable else "",
            proxy_prefix="/api/org-module/sidecar",
            start_command="bash scripts/run-org-sidecar.sh",
            tenant_id=self.tenant_id(),
            governance_enabled=self.governance_enabled(),
            notes=notes,
        )


def org_module_from_paths(paths: Any) -> OrgModuleService:
    """Build a service from a :class:`PathLayout`-like object."""
    return OrgModuleService(config_path=paths.config, home=paths.root)

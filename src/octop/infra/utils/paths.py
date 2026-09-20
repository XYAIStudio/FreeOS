"""Filesystem layout for ``~/.freeos/`` (legacy ``~/.octop/`` still honored)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PathLayout:
    root: Path

    @classmethod
    def from_env(cls) -> PathLayout:
        """Resolve install root from FreeOS/Octop home env vars or legacy paths.

        Precedence:

        1. ``FREEOS_HOME``
        2. ``OCTOP_HOME`` (legacy Octop identifier, still honored)
        3. ``~/.freeos`` if it already exists
        4. ``~/.octop`` if it already exists (existing Octop server installs;
           skipped when ``OCTOP_DESKTOP`` / ``FREEOS_DESKTOP`` is set)
        5. ``~/.freeos`` for new installs
        """
        for key in ("FREEOS_HOME", "OCTOP_HOME"):
            raw = os.environ.get(key, "").strip()
            if raw:
                return cls(Path(raw).expanduser())
        home = Path.home()
        freeos = home / ".freeos"
        octop = home / ".octop"
        if freeos.exists():
            return cls(freeos)
        desktop = False
        for key in ("OCTOP_DESKTOP", "FREEOS_DESKTOP"):
            if (os.environ.get(key) or "").strip().lower() in {"1", "true", "yes", "on"}:
                desktop = True
                break
        if octop.exists() and not desktop:
            return cls(octop)
        return cls(freeos)

    @property
    def db(self) -> Path:
        return self.root / "octop.db"

    @property
    def logs_dir(self) -> Path:
        """Structured runtime logs: ``~/.octop/logs/``."""
        return self.root / "logs"

    @property
    def log(self) -> Path:
        return self.logs_dir / "octop.log"

    def ensure_logs_dir(self) -> Path:
        """Create the logs directory and return it."""
        out = self.logs_dir
        out.mkdir(parents=True, exist_ok=True)
        return out

    def ensure_log(self) -> Path:
        """Create the logs directory and return ``octop.log``."""
        self.ensure_logs_dir()
        return self.log

    @property
    def config(self) -> Path:
        return self.root / "config.json"

    @property
    def users_dir(self) -> Path:
        return self.root / "users"

    def user_dir(self, username: str) -> Path:
        return self.users_dir / username

    @property
    def agents_dir(self) -> Path:
        """Global agents directory: ~/.octop/agents/"""
        return self.root / "agents"

    @property
    def expert_market_dir(self) -> Path:
        """Cached SkillHub expert templates: ``~/.octop/expert_market/``."""
        return self.root / "expert_market"

    @property
    def published_experts_dir(self) -> Path:
        """User-published expert snapshots: ``~/.octop/published_experts/``."""
        return self.root / "published_experts"

    @property
    def skill_packages_dir(self) -> Path:
        """Global skill package content: ``~/.octop/skill-packages/``."""
        return self.root / "skill-packages"

    @property
    def knowledge_dir(self) -> Path:
        """Global knowledge base files: ``~/.octop/knowledge/``."""
        return self.root / "knowledge"

    def agent_workspace(self, agent_id: str) -> Path:
        """Global agent workspace: ~/.octop/agents/<agent_id>/"""
        return self.agents_dir / agent_id

    def ensure_agent_workspace(self, agent_id: str) -> Path:
        """Global agent workspace, mkdir -p."""
        out = self.agent_workspace(agent_id)
        out.mkdir(parents=True, exist_ok=True)
        return out

    def ensure_root(self) -> Path:
        self.root.mkdir(parents=True, exist_ok=True)
        return self.root

    @property
    def plugins_dir(self) -> Path:
        return self.root / "plugins"

    @property
    def tool_guard_rules_dir(self) -> Path:
        """User-editable command guard rules: ``~/.octop/security/tool_guard/``."""
        return self.root / "security" / "tool_guard"

    @property
    def tool_guard_rules_file(self) -> Path:
        return self.tool_guard_rules_dir / "dangerous_shell_commands.yaml"

    @property
    def governance_dir(self) -> Path:
        """Durable governance pauses + audit: ``~/.freeos/governance/``."""
        return self.root / "governance"

    def ensure_governance_dir(self) -> Path:
        out = self.governance_dir
        out.mkdir(parents=True, exist_ok=True)
        return out

    @property
    def org_dir(self) -> Path:
        """Host organization SQLite stores: ``{home}/org/*.sqlite``."""
        return self.root / "org"

    @property
    def org_os_dir(self) -> Path:
        """Org-module prefs, toggles, optional sidecar data: ``{home}/org-os/``."""
        return self.root / "org-os"

    @property
    def openxyos_mirror_dir(self) -> Path:
        """Durable asset-loop mirror: ``{home}/openxyos-mirror/``."""
        return self.root / "openxyos-mirror"

    @property
    def org_skills_dir(self) -> Path:
        """Generated openXYOS module skills: ``~/.freeos/org-skills/``."""
        return self.root / "org-skills"

    def ensure_org_skills_dir(self) -> Path:
        out = self.org_skills_dir
        out.mkdir(parents=True, exist_ok=True)
        return out

    @staticmethod
    def _safe_id(value: str) -> str:
        cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in (value or "").strip())
        return cleaned.strip("-_")[:80] or "default"

    def tenant_dir(self, tenant_id: str) -> Path:
        """One tenant = one tree: ``~/.freeos/tenants/<id>/``."""
        return self.root / "tenants" / self._safe_id(tenant_id)

    def employee_dir(self, tenant_id: str, slug: str) -> Path:
        return self.tenant_dir(tenant_id) / "employees" / self._safe_id(slug)

    def ensure_employee_dir(self, tenant_id: str, slug: str) -> Path:
        out = self.employee_dir(tenant_id, slug)
        out.mkdir(parents=True, exist_ok=True)
        return out

    @property
    def asset_packs_dir(self) -> Path:
        return self.root / "asset-packs"

    def ensure_asset_packs_dir(self) -> Path:
        out = self.asset_packs_dir
        out.mkdir(parents=True, exist_ok=True)
        return out

    @property
    def backups_dir(self) -> Path:
        """Stored system backup archives: ``~/.octop/backups/``."""
        return self.root / "backups"

    def ensure_backups_dir(self) -> Path:
        out = self.backups_dir
        out.mkdir(parents=True, exist_ok=True)
        return out

    def backup_file(self, filename: str) -> Path:
        """Resolve a backup archive path under :attr:`backups_dir` (basename only)."""
        return self.backups_dir / Path(filename).name

    @property
    def ssl_dir(self) -> Path:
        """TLS certificates and ACME account keys: ``~/.octop/ssl/``."""
        return self.root / "ssl"

    def ensure_ssl_dir(self) -> Path:
        out = self.ssl_dir
        out.mkdir(parents=True, exist_ok=True)
        return out

    @property
    def connector_cli_dir(self) -> Path:
        """Per-instance CLI config roots: ``~/.octop/connector-cli/``."""
        return self.root / "connector-cli"

    def connector_cli_instance_dir(self, kind: str, instance_key: str) -> Path:
        """Isolated config dir for one connector CLI instance."""
        safe_kind = Path(kind).name
        safe_key = (
            "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in instance_key)[:80]
            or "default"
        )
        return self.connector_cli_dir / safe_kind / safe_key

    def ensure_connector_cli_instance_dir(self, kind: str, instance_key: str) -> Path:
        out = self.connector_cli_instance_dir(kind, instance_key)
        out.mkdir(parents=True, exist_ok=True)
        return out

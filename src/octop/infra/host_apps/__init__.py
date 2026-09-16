"""Read-only discovery of skills, plugins, and MCP configs from local AI apps."""

from octop.infra.host_apps.scan import HostAppReport, scan_host_apps

__all__ = ["HostAppReport", "scan_host_apps"]

"""Runtime hooks: spawn colleagues as FreeOS agents, route chat, sync org memory."""

from octop.modules.org_os.runtime.memory import sync_colleague_memory
from octop.modules.org_os.runtime.routing import ColleagueRouter, resolve_routed_agent
from octop.modules.org_os.runtime.spawn import (
    SpawnedAgent,
    list_spawned_agents,
    spawn_colleague_agent,
)

__all__ = [
    "ColleagueRouter",
    "SpawnedAgent",
    "list_spawned_agents",
    "resolve_routed_agent",
    "spawn_colleague_agent",
    "sync_colleague_memory",
]

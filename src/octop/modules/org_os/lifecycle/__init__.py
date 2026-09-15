"""Digital-colleague lifecycle (Direction 4)."""

from octop.modules.org_os.lifecycle.store import (
    LIFECYCLE_STATES,
    ColleagueRecord,
    LifecycleStore,
)
from octop.modules.org_os.lifecycle.transitions import register_compiled, transition

__all__ = [
    "LIFECYCLE_STATES",
    "ColleagueRecord",
    "LifecycleStore",
    "register_compiled",
    "transition",
]

"""User identity primitives."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    USER = "user"


@dataclass
class User:
    id: int
    username: str
    role: Role
    display_name: str | None
    locale: str = "zh"
    permissions: list[str] = field(default_factory=list)
    organization_id: int | None = None
    organization_user_id: int | None = None
    organization_role: str | None = None

    @property
    def label(self) -> str:
        return self.display_name or self.username

    @property
    def is_admin(self) -> bool:
        return self.role is Role.ADMIN

    @property
    def has_organization_identity(self) -> bool:
        """True when this host row is a mapping of an organization-room principal."""
        return self.organization_user_id is not None

"""Localize organization-loop / sidecar notes for the request locale."""

from __future__ import annotations

import re
from typing import Any

from octop.i18n import lookup, tr

_PATTERNS: tuple[tuple[re.Pattern[str], str, tuple[str, ...]], ...] = (
    (
        re.compile(r"^generated (\d+) module skills from the openXYOS catalog$"),
        "org.notes.generated_skills",
        ("count",),
    ),
    (
        re.compile(r"^compiled blueprint (.+) → (.+)$"),
        "org.notes.compiled_blueprint",
        ("name", "slug"),
    ),
    (
        re.compile(r"^compiled blueprint → (.+)$"),
        "org.notes.compiled_workspace",
        ("path",),
    ),
    (
        re.compile(r"^spawned FreeOS agent (.+)$"),
        "org.notes.spawned_agent",
        ("agent_id",),
    ),
    (
        re.compile(r"^imported openXYOS catalog/policies from the live sidecar$"),
        "org.notes.imported_live",
        (),
    ),
    (
        re.compile(r"^sidecar offline; compiling bundled openXYOS blueprint fixtures$"),
        "org.notes.sidecar_offline_compile",
        (),
    ),
    (
        re.compile(r"^wrote imported governance policies \(fail-closed; engine loads them\)$"),
        "org.notes.wrote_policies",
        (),
    ),
    (
        re.compile(r"^Local mirror is the durable record\. HTTP apply is best-effort\.$"),
        "org.notes.local_mirror",
        (),
    ),
    (
        re.compile(r"^Nothing is auto-enabled on the control plane\.$"),
        "org.notes.nothing_auto_enabled",
        (),
    ),
    (
        re.compile(r"^sidecar already reachable$"),
        "org.sidecar.already",
        (),
    ),
    (
        re.compile(r"^started but not reachable yet; check logs/org-sidecar\.log$"),
        "org.sidecar.started_pending",
        (),
    ),
    (
        re.compile(
            r"^started but frontend build \(dist/index\.html\) is missing; "
            r"sidecar may still come up — check logs/org-sidecar\.log$"
        ),
        "org.sidecar.missing_frontend",
        (),
    ),
    (
        re.compile(r"^ok$"),
        "org.sidecar.ok",
        (),
    ),
    (
        re.compile(r"^no bundled sidecar runtime$"),
        "org.sidecar.no_runtime",
        (),
    ),
    (
        re.compile(r"^FreeOS does the work\. openXYOS owns organization and governance\.$"),
        "org.notes.hero",
        (),
    ),
    (
        re.compile(
            r"^Data plane: employees / skills / MCP / tasks\. "
            r"Control plane: blueprints / modules / governance\.$"
        ),
        "org.notes.planes",
        (),
    ),
    (
        re.compile(r"^openXYOS sidecar is offline — start it to sync blueprints and approvals\.$"),
        "org.notes.sidecar_offline",
        (),
    ),
    (
        re.compile(r"^OPENXYOS_BASE_URL unset; applied to local mirror only$"),
        "org.notes.mirror_only",
        (),
    ),
)


def localize_note(note: str, locale: str) -> str:
    text = str(note or "").strip()
    if not text:
        return text
    for pattern, key, names in _PATTERNS:
        match = pattern.fullmatch(text)
        if match is None:
            continue
        if lookup(key, locale) is None:
            return text
        params = dict(zip(names, match.groups(), strict=False))
        return tr(key, locale, **params)
    return text


def localize_notes(notes: list[Any] | None, locale: str) -> list[str]:
    return [localize_note(str(item), locale) for item in (notes or [])]


def localize_mapping(payload: dict[str, Any], locale: str, *keys: str) -> dict[str, Any]:
    out = dict(payload)
    for key in keys:
        value = out.get(key)
        if isinstance(value, list):
            out[key] = localize_notes(value, locale)
        elif isinstance(value, str):
            out[key] = localize_note(value, locale)
    return out

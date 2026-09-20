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
        re.compile(r"^spawned FreeOS assistant (.+)$"),
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
        re.compile(r"^restarted openXYOS frontend and backend$"),
        "org.sidecar.restarted",
        (),
    ),
    (
        re.compile(r"^restarted but not reachable yet; check logs/org-sidecar\.log$"),
        "org.sidecar.restarted_pending",
        (),
    ),
    (
        re.compile(r"^FreeOS does the work\. openXYOS owns organization and governance\.$"),
        "org.notes.hero",
        (),
    ),
    (
        re.compile(
            r"^Data plane: colleagues / experts / skills / MCP / tasks\. "
            r"Control plane: department employees / blueprints / modules / governance\.$"
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
        re.compile(
            r"^openXYOS sidecar is offline — reconnecting the install-time local console\.$"
        ),
        "org.notes.sidecar_reconnecting",
        (),
    ),
    (
        re.compile(r"^OPENXYOS_BASE_URL / runtime.json unset; applied to local mirror only$"),
        "org.notes.mirror_only",
        (),
    ),
    (
        re.compile(r"^Local mirror is the durable record\.$"),
        "org.notes.local_mirror_short",
        (),
    ),
    (
        re.compile(r"^imported live control-plane export$"),
        "org.notes.imported_export",
        (),
    ),
    (
        re.compile(r"^sidecar export unreachable; using catalog/blueprint fallback$"),
        "org.notes.export_unreachable",
        (),
    ),
    (
        re.compile(r"^control plane accepted the FreeOS ingest$"),
        "org.notes.ingest_ok",
        (),
    ),
    (
        re.compile(
            r"^sidecar is up but FreeOS ingest API is missing; falling back to public routes$"
        ),
        "org.notes.ingest_missing",
        (),
    ),
    (
        re.compile(r"^sidecar rejected the ingest token; falling back to public routes$"),
        "org.notes.ingest_denied",
        (),
    ),
    (
        re.compile(r"^sidecar rejected the ingest token; mirror is complete$"),
        "org.notes.ingest_denied_mirror",
        (),
    ),
    (
        re.compile(r"^control plane accepted drafts on public routes$"),
        "org.notes.public_ok",
        (),
    ),
    (
        re.compile(r"^control plane at (.+) did not accept drafts; mirror is complete$"),
        "org.notes.control_rejected",
        ("url",),
    ),
    (
        re.compile(
            r"^Loop produced colleagues, published an asset pack, applied department employees, and imported back\.$"
        ),
        "org.notes.loop_done",
        (),
    ),
    (
        re.compile(r"^Not installed into the sidecar\. Review openxyos/ then enable per tenant\.$"),
        "org.notes.pack_review",
        (),
    ),
    (
        re.compile(
            r"^One tenant = one workspace; do not unpack this pack into a shared sandbox\.$"
        ),
        "org.notes.pack_tenant",
        (),
    ),
    (
        re.compile(r"^Agent \.env values are redacted except tenant/slug/schema keys\.$"),
        "org.notes.pack_redact",
        (),
    ),
    (
        re.compile(r"^attached cloud corpus pointer → (.+)$"),
        "org.notes.corpus_pointer",
        ("path",),
    ),
    (
        re.compile(r"^distilled (\d+) corpus files → (.+)$"),
        "org.notes.corpus_distilled",
        ("count", "path"),
    ),
    (
        re.compile(r"^no knowledge mount; producing a corpus-ready expert workspace$"),
        "org.notes.corpus_empty",
        (),
    ),
    (
        re.compile(r"^sidecar permissions unreachable; pass --policies or retry when signed in$"),
        "org.notes.permissions_unreachable",
        (),
    ),
    (
        re.compile(r"^skipped promotion for (.+): already (.+)$"),
        "org.notes.loop_skip_already",
        ("slug", "lifecycle"),
    ),
    (
        re.compile(r"^skipped illegal transition for (.+): cannot move (.+) → (.+)$"),
        "org.notes.loop_skip_illegal",
        ("slug", "current", "target"),
    ),
    (
        re.compile(r"^skipped promotion for (.+): unknown colleague$"),
        "org.notes.loop_skip_unknown",
        ("slug",),
    ),
    (
        re.compile(
            r"^Assets land on this organization's Employees, Talent, Skills, and Plugins lists\.$"
        ),
        "org.notes.visible_on_ui_tenant",
        (),
    ),
    (
        re.compile(r"^Host directory and talent market updated without Node\.$"),
        "org.notes.host_directory",
        (),
    ),
    (
        re.compile(
            r"^The organization room is arranged on its own; everyday studio login stays a separate space\.$"
        ),
        "org.notes.dual_identity",
        (),
    ),
    (
        re.compile(r"^imported openXYOS skill (.+)$"),
        "org.notes.imported_skill",
        ("slug",),
    ),
    (
        re.compile(r"^imported openXYOS plugin (.+)$"),
        "org.notes.imported_plugin",
        ("slug",),
    ),
    (
        re.compile(r"^imported openXYOS MCP (.+)$"),
        "org.notes.imported_mcp",
        ("slug",),
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

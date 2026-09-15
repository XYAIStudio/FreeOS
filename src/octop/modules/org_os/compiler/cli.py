"""``xyos2freeos`` console entry — compile a blueprint file to a workspace."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from octop.infra.utils.paths import PathLayout
from octop.modules.org_os.compiler.compile import compile_blueprint
from octop.modules.org_os.lifecycle.store import LifecycleStore
from octop.modules.org_os.lifecycle.transitions import register_compiled
from octop.modules.org_os.service import OrgModuleService


def main() -> None:
    parser = argparse.ArgumentParser(prog="xyos2freeos")
    parser.add_argument("blueprint", type=Path)
    parser.add_argument("--tenant-id", default="")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    paths = PathLayout.from_env()
    paths.ensure_root()
    service = OrgModuleService(config_path=paths.config, home=paths.root)
    tid = args.tenant_id or service.tenant_id() or "default"
    compiled = compile_blueprint(
        args.blueprint,
        home=service.home,
        tenant_id=tid,
        sidecar_url=service.sidecar_url(),
        out_dir=args.out,
    )
    register_compiled(
        LifecycleStore(service.home, tid),
        slug=compiled.slug,
        name=compiled.slug,
        workspace=compiled.workspace,
        lifecycle="draft",
    )
    print(json.dumps(compiled.to_dict(), indent=2))


if __name__ == "__main__":
    main()

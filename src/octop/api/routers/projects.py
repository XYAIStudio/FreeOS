"""User projects: conversations, tasks, and an optional work directory."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server
from octop.infra.projects.store import (
    add_link,
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)
from octop.infra.server import OctopServer
from octop.infra.utils.paths import PathLayout

router = APIRouter()


class ProjectCreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    work_dir: str = ""


class ProjectPatchBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    work_dir: str | None = None
    conversation_ids: list[str] | None = None
    task_ids: list[str] | None = None


class ProjectLinkBody(BaseModel):
    kind: str = Field(pattern="^(conversation|task)$")
    ref_id: str = Field(min_length=1, max_length=80)


def _home(server: OctopServer) -> Any:
    paths = getattr(server, "paths", None)
    if paths is not None:
        return paths.root
    return PathLayout.from_env().root


def _payload(row: Any, extras: dict[str, Any] | None = None) -> dict[str, Any]:
    data: dict[str, Any] = dict(row.to_dict())
    if extras:
        data.update(extras)
    return data


def _resolve_links(server: OctopServer, user_id: int, row: Any) -> dict[str, Any]:
    conversations: list[dict[str, str]] = []
    tasks: list[dict[str, str]] = []
    services = getattr(server, "services", None)
    if services is None:
        return {
            "conversations": [{"id": item, "title": item} for item in row.conversation_ids],
            "tasks": [{"id": item, "title": item} for item in row.task_ids],
        }
    wanted_threads = set(row.conversation_ids)
    wanted_tasks = set(row.task_ids)
    try:
        for agent in services.agent_repo.list_all():
            for thread in services.thread_repo.list_by_agent(
                agent_id=str(agent.agent_id), limit=80
            ):
                if thread.thread_id in wanted_threads:
                    conversations.append(
                        {
                            "id": thread.thread_id,
                            "title": thread.title or thread.thread_id,
                            "agent_id": thread.agent_id,
                        }
                    )
    except Exception:
        conversations = [{"id": item, "title": item} for item in row.conversation_ids]
    try:
        for job in services.cron_repo.list_all():
            if str(job.cron_id) in wanted_tasks:
                tasks.append({"id": str(job.cron_id), "title": job.name or str(job.cron_id)})
    except Exception:
        tasks = [{"id": item, "title": item} for item in row.task_ids]
    if len(conversations) < len(wanted_threads):
        have = {item["id"] for item in conversations}
        for item in row.conversation_ids:
            if item not in have:
                conversations.append({"id": item, "title": item})
    if len(tasks) < len(wanted_tasks):
        have = {item["id"] for item in tasks}
        for item in row.task_ids:
            if item not in have:
                tasks.append({"id": item, "title": item})
    return {"conversations": conversations, "tasks": tasks}


@router.get("", summary="List current user's projects")
async def list_user_projects(
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    rows = list_projects(int(user.id), _home(server))
    return {"projects": [_payload(row, _resolve_links(server, int(user.id), row)) for row in rows]}


@router.post("", summary="Create a project")
async def create_user_project(
    body: ProjectCreateBody,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    try:
        row = create_project(
            owner_user_id=int(user.id),
            name=body.name,
            work_dir=body.work_dir,
            home=_home(server),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _payload(row, {"conversations": [], "tasks": []})


@router.get("/{project_id}", summary="Get a project")
async def get_user_project(
    project_id: str,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    row = get_project(project_id, int(user.id), _home(server))
    if row is None:
        raise HTTPException(status_code=404, detail="project not found")
    return _payload(row, _resolve_links(server, int(user.id), row))


@router.patch("/{project_id}", summary="Update a project")
async def patch_user_project(
    project_id: str,
    body: ProjectPatchBody,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    try:
        row = update_project(
            project_id,
            int(user.id),
            name=body.name,
            work_dir=body.work_dir,
            conversation_ids=body.conversation_ids,
            task_ids=body.task_ids,
            home=_home(server),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="project not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _payload(row, _resolve_links(server, int(user.id), row))


@router.delete("/{project_id}", summary="Delete a project")
async def delete_user_project(
    project_id: str,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, bool]:
    try:
        delete_project(project_id, int(user.id), _home(server))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="project not found") from exc
    return {"ok": True}


@router.post("/{project_id}/links", summary="Attach a conversation or task")
async def link_user_project(
    project_id: str,
    body: ProjectLinkBody,
    server: OctopServer = Depends(get_server),
    user: Any = Depends(current_user),
) -> dict[str, Any]:
    try:
        row = add_link(
            project_id,
            int(user.id),
            kind=body.kind,
            ref_id=body.ref_id,
            home=_home(server),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="project not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _payload(row, _resolve_links(server, int(user.id), row))

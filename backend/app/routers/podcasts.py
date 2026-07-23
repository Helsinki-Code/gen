from __future__ import annotations

import uuid
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.podcast_episode import PodcastEpisode
from app.schemas.podcast import (
    PodcastAssistantRequest,
    PodcastAssistantResponse,
    PodcastCreate,
    PodcastEpisodeOut,
    PodcastIdeaRequest,
    PodcastIdeasResponse,
    PodcastPublicOut,
)
from app.services.admin_access import AdminUser
from app.services.podcast import (
    build_assistant_plan,
    build_episode_draft,
    build_episode_draft_from_article,
    build_fallback_podcast_ideas,
    build_podcast_ideas,
    build_podcast_seo_package,
    synthesize_with_gemini,
)
from app.services.podcast_sources import PodcastSourceNotFoundError, resolve_local_blog_source
from app.services.storage import download_bytes

router = APIRouter(prefix="/podcasts", tags=["podcasts"])


@router.post("", response_model=PodcastEpisodeOut, status_code=status.HTTP_201_CREATED)
async def create_podcast(
    body: PodcastCreate,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        source = resolve_local_blog_source(body.source_url)
    except PodcastSourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    topic = source.title if source else body.topic
    source_type = "seo_article" if source else body.source_type
    if source:
        try:
            draft = await build_episode_draft_from_article(
                source=source,
                title=body.title,
                notes=body.notes,
                audience=body.audience,
                tone=body.tone,
                duration_minutes=body.duration_minutes,
            )
        except Exception:
            draft = build_episode_draft(
                topic=source.title,
                title=body.title,
                source_type="seo_article",
                notes=(
                    body.notes
                    + "\n\nSource article: "
                    + source.title
                    + " ("
                    + source.route
                    + "). Ground the discussion in this source and avoid unsupported claims."
                ),
                audience=body.audience,
                tone=body.tone,
                duration_minutes=body.duration_minutes,
            )
    else:
        draft = build_episode_draft(
            topic=topic,
            title=body.title,
            source_type=source_type,
            notes=body.notes,
            audience=body.audience,
            tone=body.tone,
            duration_minutes=body.duration_minutes,
        )
    episode = PodcastEpisode(
        user_id=current_user.id,
        title=draft.title,
        topic=topic,
        source_type=source_type,
        source_url=source.route if source else body.source_url,
        audience=body.audience,
        tone=body.tone,
        duration_minutes=body.duration_minutes,
        status="script_ready",
        script=draft.script,
        summary=draft.summary,
        show_notes=draft.show_notes,
    )
    db.add(episode)
    try:
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Podcast could not be saved. Confirm the latest database migrations are applied.",
        ) from exc
    await db.refresh(episode)

    if body.generate_audio:
        await _generate_audio_for_episode(db, episode, current_user.id)

    return _episode_out(episode)


@router.get("", response_model=list[PodcastEpisodeOut])
async def list_podcasts(
    _current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 20,
):
    offset = (page - 1) * per_page
    result = await db.execute(
        select(PodcastEpisode)
        .order_by(PodcastEpisode.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    return [_episode_out(episode) for episode in result.scalars().all()]


@router.post("/assistant", response_model=PodcastAssistantResponse)
async def podcast_assistant(
    body: PodcastAssistantRequest,
    _current_user: AdminUser,
):
    try:
        source = resolve_local_blog_source(body.source_url)
    except PodcastSourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        plan = await build_assistant_plan(
            prompt=body.prompt,
            title=body.title,
            topic=body.topic,
            source_type=body.source_type,
            source_url=source.route if source else body.source_url,
            notes=body.notes,
            audience=body.audience,
            tone=body.tone,
            duration_minutes=body.duration_minutes,
            source_content=source.markdown if source else "",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Podcast assistant failed: {exc}") from exc

    return PodcastAssistantResponse(
        title=plan.title,
        topic=plan.topic,
        audience=plan.audience,
        tone=plan.tone,
        duration_minutes=plan.duration_minutes,
        notes=plan.notes,
        assistant_message=plan.assistant_message,
        checklist=plan.checklist,
    )


@router.post("/ideas", response_model=PodcastIdeasResponse)
async def podcast_ideas(
    body: PodcastIdeaRequest,
    _current_user: AdminUser,
):
    try:
        plan = await build_podcast_ideas(
            guidance=body.guidance,
            audience=body.audience,
            count=body.count,
            exclude_topics=body.exclude_topics,
        )
    except Exception:
        plan = build_fallback_podcast_ideas(
            guidance=body.guidance,
            audience=body.audience,
            count=body.count,
            exclude_topics=body.exclude_topics,
        )

    return PodcastIdeasResponse(
        ideas=[idea.__dict__ for idea in plan.ideas],
        research_summary=plan.research_summary,
    )


@router.get("/public", response_model=list[PodcastPublicOut])
async def list_public_podcasts(
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 12,
):
    offset = (page - 1) * per_page
    result = await db.execute(
        select(PodcastEpisode)
        .where(PodcastEpisode.status == "published")
        .order_by(PodcastEpisode.published_at.desc(), PodcastEpisode.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    return [_public_episode_out(episode) for episode in result.scalars().all()]


@router.get("/public/{episode_id}", response_model=PodcastPublicOut)
async def get_public_podcast(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    if episode.status != "published":
        raise HTTPException(status_code=404, detail="Podcast episode not found")
    return _public_episode_out(episode)


_PUBLIC_CORS = {"Access-Control-Allow-Origin": "*"}


@router.get("/public/{episode_id}/audio")
async def public_podcast_audio(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    if episode.status != "published" or not episode.audio_path:
        raise HTTPException(status_code=404, detail="Podcast audio not found")
    try:
        audio = await download_bytes(episode.audio_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Podcast audio file not found in storage")
    return Response(content=audio, media_type=episode.audio_mime_type or "audio/wav", headers=_PUBLIC_CORS)


@router.get("/public/{episode_id}/cover")
async def public_podcast_cover(
    episode_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    if episode.status != "published" or not episode.cover_image_path:
        raise HTTPException(status_code=404, detail="Podcast cover image not found")
    try:
        image = await download_bytes(episode.cover_image_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Podcast cover image not found in storage")
    return Response(content=image, media_type=episode.cover_image_mime_type or "image/png", headers=_PUBLIC_CORS)


@router.get("/{episode_id}", response_model=PodcastEpisodeOut)
async def get_podcast(
    episode_id: uuid.UUID,
    _current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    return _episode_out(episode)


@router.post("/{episode_id}/generate-audio", response_model=PodcastEpisodeOut)
async def generate_podcast_audio(
    episode_id: uuid.UUID,
    current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    await _generate_audio_for_episode(db, episode, current_user.id)
    return _episode_out(episode)


@router.post("/{episode_id}/publish", response_model=PodcastEpisodeOut)
async def publish_podcast(
    episode_id: uuid.UUID,
    _current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    if not episode.audio_path:
        raise HTTPException(status_code=400, detail="Generate audio before publishing this episode.")
    publish_url = f"/podcasts/{episode.id}"
    package = await _generate_seo_package_for_episode(db, episode)
    await _persist_episode_state(
        db,
        episode_id,
        status="published",
        published_at=datetime.now(timezone.utc),
        publish_url=publish_url,
        **_seo_package_values(package),
    )
    await db.refresh(episode)
    return _episode_out(episode)


@router.post("/{episode_id}/seo-package", response_model=PodcastEpisodeOut)
async def regenerate_podcast_seo_package(
    episode_id: uuid.UUID,
    _current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    was_published = episode.status == "published"
    publish_url = f"/podcasts/{episode.id}"
    package = await _generate_seo_package_for_episode(db, episode)
    values = _seo_package_values(package)
    if was_published:
        values["publish_url"] = publish_url
    await _persist_episode_state(db, episode_id, **values)
    await db.refresh(episode)
    return _episode_out(episode)


@router.get("/{episode_id}/audio")
async def podcast_audio(
    episode_id: uuid.UUID,
    _current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    if not episode.audio_path:
        raise HTTPException(status_code=404, detail="Audio has not been generated for this episode.")
    try:
        audio = await download_bytes(episode.audio_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Audio file not found in storage.")
    return Response(content=audio, media_type=episode.audio_mime_type or "audio/wav")


@router.get("/{episode_id}/cover")
async def podcast_cover(
    episode_id: uuid.UUID,
    _current_user: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    episode = await _get_episode_or_404(db, episode_id)
    if not episode.cover_image_path:
        raise HTTPException(status_code=404, detail="Cover image has not been generated for this episode.")
    try:
        image = await download_bytes(episode.cover_image_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Cover image not found in storage.")
    return Response(content=image, media_type=episode.cover_image_mime_type or "image/png")


async def _get_episode_or_404(db: AsyncSession, episode_id: uuid.UUID) -> PodcastEpisode:
    result = await db.execute(select(PodcastEpisode).where(PodcastEpisode.id == episode_id))
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="Podcast episode not found")
    return episode


async def _generate_audio_for_episode(db: AsyncSession, episode: PodcastEpisode, user_id: uuid.UUID) -> None:
    episode_id = episode.id
    script = episode.script
    # Release the connection opened by SELECT/refresh before the long external TTS call.
    await db.rollback()

    try:
        audio = await synthesize_with_gemini(user_id=user_id, episode_id=episode_id, script=script)
    except Exception as exc:
        await _persist_episode_state(
            db,
            episode_id,
            status="failed",
            error_message=str(exc) or exc.__class__.__name__,
        )
        await db.refresh(episode)
        return

    await _persist_episode_state(
        db,
        episode_id,
        status="audio_ready",
        audio_path=audio.path,
        audio_mime_type=audio.mime_type,
        duration_seconds=audio.duration_seconds,
        error_message=None,
    )
    await db.refresh(episode)


async def _generate_seo_package_for_episode(db: AsyncSession, episode: PodcastEpisode):
    episode_id = episode.id
    user_id = episode.user_id
    title = episode.title
    topic = episode.topic
    summary = episode.summary
    show_notes = episode.show_notes
    script = episode.script
    audience = episode.audience
    duration_minutes = episode.duration_minutes
    source_url = episode.source_url
    # Release the SELECT connection before Gemini copy/image generation.
    await db.rollback()
    return await build_podcast_seo_package(
        user_id=user_id,
        episode_id=episode_id,
        title=title,
        topic=topic,
        summary=summary,
        show_notes=show_notes,
        script=script,
        audience=audience,
        duration_minutes=duration_minutes,
        source_url=source_url,
    )


def _seo_package_values(package) -> dict[str, object]:
    values: dict[str, object] = {
        "seo_title": package.seo_title,
        "seo_description": package.seo_description,
        "seo_content": package.seo_content,
        "seo_keywords": json.dumps(package.seo_keywords),
        "seo_faq": json.dumps(package.seo_faq),
        "cover_image_alt": package.cover_alt,
        "cover_image_prompt": package.cover_prompt,
        "error_message": None,
    }
    if package.cover_image_path:
        values["cover_image_path"] = package.cover_image_path
        values["cover_image_mime_type"] = package.cover_image_mime_type
    return values


async def _persist_episode_state(db: AsyncSession, episode_id: uuid.UUID, **values: object) -> None:
    for attempt in range(2):
        try:
            await db.execute(
                update(PodcastEpisode)
                .where(PodcastEpisode.id == episode_id)
                .values(**values)
            )
            await db.commit()
            return
        except DBAPIError:
            await db.rollback()
            if attempt == 1:
                raise


def _episode_out(episode: PodcastEpisode) -> PodcastEpisodeOut:
    return PodcastEpisodeOut(
        id=episode.id,
        title=episode.title,
        topic=episode.topic,
        source_type=episode.source_type,
        source_url=episode.source_url,
        audience=episode.audience,
        tone=episode.tone,
        duration_minutes=episode.duration_minutes,
        status=episode.status,
        script=episode.script,
        summary=episode.summary,
        show_notes=episode.show_notes,
        audio_url=f"/podcasts/{episode.id}/audio" if episode.audio_path else None,
        audio_mime_type=episode.audio_mime_type,
        duration_seconds=episode.duration_seconds,
        cover_image_url=f"/podcasts/{episode.id}/cover" if episode.cover_image_path else None,
        cover_image_mime_type=episode.cover_image_mime_type,
        cover_image_alt=episode.cover_image_alt,
        cover_image_prompt=episode.cover_image_prompt,
        seo_title=episode.seo_title,
        seo_description=episode.seo_description,
        seo_content=episode.seo_content,
        seo_keywords=_json_list(episode.seo_keywords),
        seo_faq=_json_list(episode.seo_faq),
        publish_url=_publish_url(episode),
        error_message=episode.error_message,
        created_at=episode.created_at,
        updated_at=episode.updated_at,
        published_at=episode.published_at,
    )


def _public_episode_out(episode: PodcastEpisode) -> PodcastPublicOut:
    return PodcastPublicOut(
        id=episode.id,
        title=episode.title,
        topic=episode.topic,
        source_type=episode.source_type,
        source_url=episode.source_url,
        audience=episode.audience,
        tone=episode.tone,
        duration_minutes=episode.duration_minutes,
        summary=episode.summary,
        show_notes=episode.show_notes,
        audio_url=f"/podcasts/public/{episode.id}/audio" if episode.audio_path else None,
        audio_mime_type=episode.audio_mime_type,
        duration_seconds=episode.duration_seconds,
        cover_image_url=f"/podcasts/public/{episode.id}/cover" if episode.cover_image_path else None,
        cover_image_mime_type=episode.cover_image_mime_type,
        cover_image_alt=episode.cover_image_alt,
        cover_image_prompt=episode.cover_image_prompt,
        seo_title=episode.seo_title,
        seo_description=episode.seo_description,
        seo_content=episode.seo_content,
        seo_keywords=_json_list(episode.seo_keywords),
        seo_faq=_json_list(episode.seo_faq),
        publish_url=_publish_url(episode) or f"/podcasts#{episode.id}",
        created_at=episode.created_at,
        published_at=episode.published_at,
    )


def _publish_url(episode: PodcastEpisode) -> str | None:
    if episode.status != "published":
        return None
    if episode.publish_url and not episode.publish_url.endswith("/audio") and "#" not in episode.publish_url:
        return episode.publish_url
    return f"/podcasts/{episode.id}"


def _json_list(value: str | None) -> list:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []

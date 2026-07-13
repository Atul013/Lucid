"""Local Notes connector: markdown parsing (frontmatter/heading/tags) and
vault scanning. Pure functions except scan_vault, which needs real files on
disk — tmp_path gives it an isolated folder per test.
"""
from datetime import datetime, timezone

import pytest

from app.connectors.notes import parse_note_text, scan_vault, summarize


def test_parse_note_text_extracts_heading_as_title():
    record = parse_note_text("ideas.md", "# Project Lucid\n\nSome body text.", datetime.now(timezone.utc))
    assert record["title"] == "Project Lucid"
    assert "Project Lucid" in record["text"]
    assert "Some body text." in record["text"]


def test_parse_note_text_falls_back_to_filename_stem_without_heading():
    record = parse_note_text("random-thought.md", "just a note, no heading", datetime.now(timezone.utc))
    assert record["title"] == "random-thought"


def test_parse_note_text_extracts_inline_tags_not_headings():
    raw = "# Weekly Review\n\nWorked on #project/lucid and #deep-work today."
    record = parse_note_text("review.md", raw, datetime.now(timezone.utc))
    assert record["tags"] == "deep-work,project/lucid"


def test_parse_note_text_prefers_frontmatter_date_over_mtime():
    raw = "---\ndate: 2026-03-01\ntitle: ignored\n---\n# Note\n\nbody"
    mtime = datetime(2026, 7, 1, tzinfo=timezone.utc)
    record = parse_note_text("note.md", raw, mtime)
    assert record["date"] == "2026-03-01"
    # Frontmatter block itself must not leak into the indexed text.
    assert "date:" not in record["text"]


def test_parse_note_text_falls_back_to_mtime_without_frontmatter_date():
    mtime = datetime(2026, 7, 1, tzinfo=timezone.utc)
    record = parse_note_text("note.md", "# Note\n\nbody", mtime)
    assert record["date"] == "2026-07-01"


def test_parse_note_text_id_is_stable_for_the_same_path():
    a = parse_note_text("same/path.md", "v1", datetime.now(timezone.utc))
    b = parse_note_text("same/path.md", "v2 — edited", datetime.now(timezone.utc))
    assert a["id"] == b["id"]


def test_scan_vault_walks_nested_folders_and_skips_non_markdown(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "top.md").write_text("# Top\n\ntop body", encoding="utf-8")
    (tmp_path / "sub" / "nested.md").write_text("# Nested\n\nnested body", encoding="utf-8")
    (tmp_path / "ignore.txt").write_text("not markdown", encoding="utf-8")

    records = scan_vault(str(tmp_path))

    titles = {r["title"] for r in records}
    assert titles == {"Top", "Nested"}
    paths = {r["path"] for r in records}
    assert paths == {"top.md", "sub/nested.md"}


def test_scan_vault_raises_for_non_directory(tmp_path):
    missing = tmp_path / "does-not-exist"
    with pytest.raises(ValueError, match="Not a directory"):
        scan_vault(str(missing))


# ── summarize ────────────────────────────────────────────────────────────────

def test_summarize_empty_notes():
    assert summarize([]) == {"notes": 0}


def test_summarize_counts_tags_and_date_range():
    records = [
        {"date": "2026-01-01", "tags": "work,deep-work"},
        {"date": "2026-02-01", "tags": "work"},
        {"date": "2026-01-15", "tags": ""},
    ]
    result = summarize(records)
    assert result["notes"] == 3
    assert result["from"] == "2026-01-01"
    assert result["to"] == "2026-02-01"
    assert result["top_tags"][0] == ("work", 2)

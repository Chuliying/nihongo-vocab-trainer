#!/usr/bin/env python3
"""
enrich_examples.py
──────────────────
Traverses all 52 vocab chunk files and uses Gemini Flash Lite to:
  1. CHECK whether each example sentence is natural Japanese (N4/N5 level)
     and whether the Chinese translation is accurate.
  2. GENERATE a better example for any entry that fails the check.
  
All in a single batch call (50 entries per call) to minimize API usage.

Skipped quality scores : curated, verb_curated
Processed quality scores: needs_review, rule_completed, meaning_translated
"""

import argparse
import json
import os
import sys
import time
from copy import deepcopy
from pathlib import Path
from typing import Any

# ── Gemini (new SDK: google-genai) ───────────────────────────────────────────
try:
    from google import genai
    from google.genai import types as gentypes
except ImportError:
    sys.exit(
        "google-genai not installed.\n"
        "Run: pip install google-genai"
    )

# ── Paths ───────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
CHUNKS_DIR = ROOT / "public" / "data" / "chunks"
PROGRESS_FILE = Path(__file__).parent / "enrich_examples_progress.json"
REPORT_FILE = Path(__file__).parent / "enrich_examples_report.json"

# ── Constants ────────────────────────────────────────────────────────────────
NUM_CHUNKS = 52
SKIP_SCORES = {"curated", "verb_curated"}
BATCH_SIZE = 50
RATE_LIMIT_SLEEP = 2.5   # seconds between calls (~24 calls/min, safe under 30 RPM)
MAX_RETRIES = 6
RETRY_BASE = 2.0      # exponential-backoff base (seconds)

# ── Gemini setup ─────────────────────────────────────────────────────────────
API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    sys.exit("GEMINI_API_KEY environment variable is not set.")

client = genai.Client(api_key=API_KEY)
MODEL_NAME = "gemini-2.0-flash-lite"  # 30 RPM free tier (higher than flash's 15 RPM)

# ── Prompts ───────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """你是日語教學專家與繁體中文使用者。
你的任務是評估日語詞彙的例句品質，並為評估不通過的項目重新生成高品質例句。

評估與生成標準：
1. 【自然度】例句是日本人日常真實使用的語句，不是機械翻譯腔或教科書感。
2. 【難度適切】例句本身的語法和詞彙控制在 N4~N5 程度（即使目標詞彙本身是 N3 以上）。
3. 【翻譯準確】中文翻譯與日文語意一致，語句通順，使用繁體中文，非逐字直譯。
4. 【展示詞彙】例句清楚體現目標詞彙的主要意思。
5. 【假名拼音】檢查原 reading 欄位是否有拼寫錯誤。

請針對輸入的 JSON 陣列中的每一筆進行評估：
- 若完全符合以上 5 項標準，請忽略，【不要】包含在回傳結果中。
- 若有任何一項標準不通過，請針對該詞彙重新生成高品質的日文例句（japanese）、完整的平假名讀音（reading）、以及繁體中文翻譯（chinese）。

回傳格式必須是 JSON 陣列（僅包含需要修正的項目，若全部通過則回傳空陣列 []）：
[
  {
    "id": <int>,
    "japanese": "<修正後的新例句>",
    "reading": "<新例句完整平假名讀音>",
    "chinese": "<新例句繁體中文翻譯>",
    "reason": "<不通過的原因簡述（繁中）>"
  }
]
"""

USER_TMPL = """請評估並修正以下 {n} 筆詞彙的例句：

{entries_json}
"""

def log(msg: str) -> None:
    print(msg, flush=True)


def _parse_retry_delay(exc: Exception) -> float:
    """Extract retryDelay seconds from a 429 error if present."""
    import re
    msg = str(exc)
    m = re.search(r"retryDelay.*?'(\d+(?:\.\d+)?)s'", msg)
    if m:
        return float(m.group(1)) + 2.0   # add 2s buffer
    return 0.0


def call_gemini(system_prompt: str, user_prompt: str, temperature: float) -> Any:
    """Call Gemini with retry + exponential backoff respecting retryDelay. Returns parsed JSON."""
    full_prompt = system_prompt + "\n\n" + user_prompt
    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=full_prompt,
                config=gentypes.GenerateContentConfig(
                    temperature=temperature,
                    response_mime_type="application/json",
                ),
            )
            raw = response.text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            log(f"  [WARN] JSON parse error (attempt {attempt+1}): {exc}")
            sleep_time = RETRY_BASE ** attempt
        except Exception as exc:  # noqa: BLE001
            err_str = str(exc)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                retry_delay = _parse_retry_delay(exc)
                sleep_time = max(retry_delay, RETRY_BASE ** (attempt + 1))
                log(f"  [WARN] Rate limited (attempt {attempt+1}), waiting {sleep_time:.0f}s …")
            else:
                log(f"  [WARN] Gemini error (attempt {attempt+1}): {exc}")
                sleep_time = RETRY_BASE ** attempt

        if attempt < MAX_RETRIES - 1:
            time.sleep(sleep_time)

    log("  [ERROR] All retries failed, skipping batch.")
    return None


def batch_process(entries: list[dict]) -> list[dict] | None:
    """
    Send a batch of 50 entries to Gemini to check and regenerate failed ones.
    Returns a list of corrected entries, or None on error.
    """
    slim = [
        {
            "id": e["id"],
            "word": e["word"],
            "reading": e["reading"],
            "meaning": e["meaning"],
            "example": e["example"],
        }
        for e in entries
    ]
    user_prompt = USER_TMPL.format(
        n=len(slim),
        entries_json=json.dumps(slim, ensure_ascii=False, indent=2),
    )
    result = call_gemini(SYSTEM_PROMPT, user_prompt, temperature=0.3)
    time.sleep(RATE_LIMIT_SLEEP)
    return result


def chunked(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


# ── Progress / Report I/O ─────────────────────────────────────────────────────

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {
        "last_completed_chunk": -1,
        "processed_entries": 0,
        "skipped_entries": 0,
        "checked_entries": 0,
        "revised_entries": 0,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "last_updated": "",
    }


def save_progress(progress: dict) -> None:
    progress["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    PROGRESS_FILE.write_text(
        json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_report() -> dict:
    if REPORT_FILE.exists():
        return json.loads(REPORT_FILE.read_text(encoding="utf-8"))
    return {
        "summary": {
            "total": 0, "skipped": 0,
            "checked": 0, "passed": 0, "revised": 0, "api_errors": 0,
        },
        "changes": [],
    }


def save_report(report: dict) -> None:
    REPORT_FILE.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ── Core processing ───────────────────────────────────────────────────────────

def process_chunk(chunk_index: int, dry_run: bool,
                  progress: dict, report: dict) -> None:
    chunk_path = CHUNKS_DIR / f"vocab_chunk_{chunk_index}.json"
    entries: list[dict] = json.loads(chunk_path.read_text(encoding="utf-8"))

    to_process = [e for e in entries if e.get("quality_score") not in SKIP_SCORES]
    to_skip = [e for e in entries if e.get("quality_score") in SKIP_SCORES]

    log(f"\n{'='*60}")
    log(f"Chunk {chunk_index:02d}  |  {len(entries)} entries  "
        f"({len(to_process)} to review, {len(to_skip)} skipped)")
    log(f"{'='*60}")

    progress["skipped_entries"] += len(to_skip)
    report["summary"]["skipped"] += len(to_skip)

    entry_map: dict[int, dict] = {e["id"]: e for e in entries}
    changes_in_chunk = 0

    for batch in chunked(to_process, BATCH_SIZE):
        ids_in_batch = [e["id"] for e in batch]
        log(f"  [PROCESS] Batch ids {ids_in_batch[0]}–{ids_in_batch[-1]} "
            f"({len(batch)} entries) …")

        corrections = batch_process(batch)

        if corrections is None:
            log("    [ERROR] API failed for batch. Skipping updates for this batch.")
            report["summary"]["api_errors"] += len(batch)
            continue

        corrected_map = {item["id"]: item for item in corrections}

        for entry in batch:
            eid = entry["id"]
            progress["checked_entries"] += 1
            report["summary"]["checked"] += 1

            if eid in corrected_map:
                corr = corrected_map[eid]
                old_example = deepcopy(entry_map[eid]["example"])
                
                # Update example and metadata
                entry_map[eid]["example"] = {
                    "japanese": corr["japanese"],
                    "reading": corr["reading"],
                    "chinese": corr["chinese"],
                }
                entry_map[eid]["quality_score"] = "llm_enriched"
                
                report["summary"]["revised"] += 1
                progress["revised_entries"] += 1
                changes_in_chunk += 1
                
                report["changes"].append({
                    "id": eid,
                    "word": entry["word"],
                    "chunk": chunk_index,
                    "reason": corr.get("reason", "Failed quality check"),
                    "old_example": old_example,
                    "new_example": entry_map[eid]["example"],
                })
                log(f"    ✓ id={eid} ({entry['word']}) corrected: {corr.get('reason', '')}")
            else:
                report["summary"]["passed"] += 1

    # Write back if not dry run
    if not dry_run:
        updated = [entry_map[e["id"]] for e in entries]
        chunk_path.write_text(
            json.dumps(updated, ensure_ascii=False),
            encoding="utf-8",
        )
        log(f"  ✓ Chunk {chunk_index:02d} written back ({changes_in_chunk} entries updated).")
    else:
        log(f"  [DRY RUN] Chunk {chunk_index:02d} process complete. ({changes_in_chunk} entries would be updated).")

    progress["processed_entries"] += len(to_process)
    report["summary"]["total"] += len(entries)


# ── Entry point ───────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich vocab example sentences in batch")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Run process phase only; do not write any changes."
    )
    parser.add_argument(
        "--chunks", type=str, default=None,
        help="Chunk range to process, e.g. '0-5' or '12'. Default: all."
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="Ignore saved progress and start from scratch."
    )
    return parser.parse_args()


def parse_chunk_range(spec: str | None) -> range:
    if spec is None:
        return range(NUM_CHUNKS)
    if "-" in spec:
        start, end = spec.split("-", 1)
        return range(int(start), int(end) + 1)
    return range(int(spec), int(spec) + 1)


def main() -> None:
    args = parse_args()

    progress = load_progress() if not args.reset else {
        "last_completed_chunk": -1,
        "processed_entries": 0,
        "skipped_entries": 0,
        "checked_entries": 0,
        "revised_entries": 0,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "last_updated": "",
    }
    report = load_report() if not args.reset else {
        "summary": {"total": 0, "skipped": 0, "checked": 0,
                    "passed": 0, "revised": 0, "api_errors": 0},
        "changes": [],
    }

    chunk_range = parse_chunk_range(args.chunks)

    # Resume support: skip already-completed chunks
    last_done = progress.get("last_completed_chunk", -1)
    if not args.reset:
        chunk_range = range(max(chunk_range.start, last_done + 1), chunk_range.stop)

    if not chunk_range:
        log("Nothing to do — all chunks already completed.")
        log(f"Progress: {json.dumps(progress, indent=2)}")
        return

    mode = "DRY RUN" if args.dry_run else "LIVE"
    log(f"\n{'#'*60}")
    log(f"# enrich_examples.py (Batch Optimized)  [{mode}]")
    log(f"# Chunks : {chunk_range.start}–{chunk_range.stop - 1}")
    log(f"# Model  : {MODEL_NAME}")
    log(f"# Skip   : {', '.join(sorted(SKIP_SCORES))}")
    log(f"{'#'*60}")

    try:
        for chunk_idx in chunk_range:
            process_chunk(chunk_idx, args.dry_run, progress, report)
            if not args.dry_run:
                progress["last_completed_chunk"] = chunk_idx
                save_progress(progress)
                save_report(report)
    except KeyboardInterrupt:
        log("\n\nInterrupted by user. Progress saved.")

    # ── Final summary ────────────────────────────────────────────────────────
    s = report["summary"]
    log(f"\n{'='*60}")
    log("DONE")
    log(f"  Total entries  : {s['total']}")
    log(f"  Skipped        : {s['skipped']}  (curated / verb_curated)")
    log(f"  Checked        : {s['checked']}")
    log(f"  Passed         : {s['passed']}")
    log(f"  Revised        : {s['revised']}")
    log(f"  API errors     : {s['api_errors']}")
    log(f"  Report written : {REPORT_FILE}")
    log(f"{'='*60}")


if __name__ == "__main__":
    main()

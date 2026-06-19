#!/usr/bin/env python3
"""Validate an advisory review draft and emit only apply-ready accepted rows."""
import argparse
import json
from pathlib import Path


def read_jsonl(path):
    rows = []
    with Path(path).open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_no}: invalid JSON: {error}") from error
    return rows


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--packet", required=True)
    parser.add_argument("--draft", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--accept-limit", type=int)
    parser.add_argument("--exclude-ids", default="")
    return parser.parse_args()


def main():
    args = parse_args()
    packet = read_jsonl(args.packet)
    draft = read_jsonl(args.draft)
    excluded_ids = {
        int(value.strip())
        for value in args.exclude_ids.split(",")
        if value.strip()
    }
    errors = []
    accepted = []
    rejected = []
    contract_rejected = []

    if len(packet) != len(draft):
        errors.append(f"expected {len(packet)} rows, got {len(draft)}")

    for index, source in enumerate(packet):
        if index >= len(draft):
            break
        review = draft[index]
        prefix = f"row {index + 1} id {source['id']}"
        if review.get("id") != source["id"]:
            errors.append(f"{prefix}: id/order mismatch")
            continue
        decision = review.get("decision")
        if source["id"] in excluded_ids:
            rejected.append({"id": source["id"], "reason": "parent review exclusion"})
            continue
        if decision == "reject":
            reason = str(review.get("reason") or "").strip()
            if not reason:
                errors.append(f"{prefix}: rejected row requires reason")
            rejected.append({"id": source["id"], "reason": reason})
            continue
        if decision != "accept":
            errors.append(f"{prefix}: decision must be accept or reject")
            continue
        contract_errors = []
        if review.get("sentence_id") != source["sentence_id"]:
            contract_errors.append("sentence_id changed")
        if review.get("j") != source["j"]:
            contract_errors.append("Japanese sentence changed")
        if not str(review.get("r") or "").strip():
            contract_errors.append("missing reading")
        if not str(review.get("c") or "").strip():
            contract_errors.append("missing Traditional Chinese translation")
        for field in ("reading_reviewed", "translation_reviewed", "reviewed"):
            if review.get(field) is not True:
                contract_errors.append(f"{field} must be true")
        if contract_errors:
            contract_rejected.append(
                {"id": source["id"], "reason": "; ".join(contract_errors)}
            )
            continue
        if args.accept_limit is not None and len(accepted) >= args.accept_limit:
            rejected.append({"id": source["id"], "reason": "checkpoint limit"})
            continue
        accepted.append(
            {
                "id": source["id"],
                "sentence_id": source["sentence_id"],
                "j": source["j"],
                "r": review.get("r"),
                "c": review.get("c"),
                "reading_reviewed": True,
                "translation_reviewed": True,
                "reviewed": True,
            }
        )

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for row in accepted:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(
        json.dumps(
            {
                "out": str(out_path),
                "input_rows": len(packet),
                "accepted": len(accepted),
                "rejected": len(rejected),
                "contract_rejected": len(contract_rejected),
                "rejections": rejected,
                "contract_rejections": contract_rejected,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

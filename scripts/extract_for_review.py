import json
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
CHUNKS_DIR = ROOT / "public" / "data" / "chunks"
SCRATCH_DIR = ROOT / "scratch"
SCRATCH_DIR.mkdir(exist_ok=True)

SKIP_SCORES = {"curated", "verb_curated"}
BATCH_SIZE = 100  # 100 entries per part for easy context handling

def extract_chunk(idx: int):
    chunk_path = CHUNKS_DIR / f"vocab_chunk_{idx}.json"
    if not chunk_path.exists():
        return
    
    entries = json.loads(chunk_path.read_text(encoding="utf-8"))
    to_process = [e for e in entries if e.get("quality_score") not in SKIP_SCORES]
    
    if not to_process:
        return
    
    # Split into parts
    parts = [to_process[i:i + BATCH_SIZE] for i in range(0, len(to_process), BATCH_SIZE)]
    
    for part_idx, part in enumerate(parts, 1):
        lines = []
        for e in part:
            ex = e.get("example", {})
            ja = ex.get("japanese", "")
            rd = ex.get("reading", "")
            zh = ex.get("chinese", "")
            lines.append(f"{e['id']}|{e['word']}|{e['reading']}|{e['meaning']}|{ja}|{rd}|{zh}")
        
        out_path = SCRATCH_DIR / f"chunk_{idx}_part{part_idx}.txt"
        out_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"Wrote {len(lines)} entries to {out_path}")

def main():
    for idx in range(52):
        extract_chunk(idx)

if __name__ == "__main__":
    main()

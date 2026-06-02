import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
CHUNKS_DIR = ROOT / "public" / "data" / "chunks"
SCRATCH_DIR = ROOT / "scratch"

def merge_chunk(idx: int):
    chunk_path = CHUNKS_DIR / f"vocab_chunk_{idx}.json"
    if not chunk_path.exists():
        return
    
    # Load original chunk
    entries = json.loads(chunk_path.read_text(encoding="utf-8"))
    entry_map = {e["id"]: e for e in entries}
    
    # Find all corrected files for this chunk
    corrected_files = sorted(SCRATCH_DIR.glob(f"chunk_{idx}_corrected_part*.txt"))
    if not corrected_files:
        return
    
    updated_count = 0
    for fpath in corrected_files:
        content = fpath.read_text(encoding="utf-8").strip()
        if not content:
            continue
        
        for line in content.split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = line.split("|")
            if len(parts) < 4:
                print(f"Warning: Invalid line in {fpath.name}: {line}")
                continue
            
            try:
                eid = int(parts[0])
                japanese = parts[1].strip()
                reading = parts[2].strip()
                chinese = parts[3].strip()
                
                if eid in entry_map:
                    entry_map[eid]["example"] = {
                        "japanese": japanese,
                        "reading": reading,
                        "chinese": chinese,
                    }
                    entry_map[eid]["quality_score"] = "llm_enriched"
                    updated_count += 1
                else:
                    print(f"Warning: id {eid} not found in chunk {idx}")
            except Exception as e:
                print(f"Error parsing line {line} in {fpath.name}: {e}")
                
    if updated_count > 0:
        chunk_path.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
        print(f"Chunk {idx}: Updated {updated_count} entries.")
    else:
        print(f"Chunk {idx}: No entries were updated.")

def main():
    if len(sys.argv) > 1:
        # Run specific chunk or range
        spec = sys.argv[1]
        if "-" in spec:
            start, end = spec.split("-")
            for idx in range(int(start), int(end) + 1):
                merge_chunk(idx)
        else:
            merge_chunk(int(spec))
    else:
        # Run all chunks
        for idx in range(52):
            merge_chunk(idx)

if __name__ == "__main__":
    main()

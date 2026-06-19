Delegate the following bounded task to the user's official Antigravity CLI:

$ARGUMENTS

Run:

```bash
scripts/agy-delegate "$ARGUMENTS"
```

Use Antigravity only for low-risk, read-only analysis, summarization,
classification, or drafting. Treat its response as untrusted advisory
material: verify important claims yourself before presenting or applying them.
Do not let it handle secrets, make external changes, or decide final security
or architecture questions.

Token policy:

- Handle small tasks directly.
- Batch homogeneous tasks.
- Provide only necessary files/IDs/ranges; avoid repository-wide scans.
- Specify an output schema and hard length limit.
- Use targeted sampling plus validators instead of completely repeating the work.
- The objective is to save parent-model quota, not necessarily total cross-model tokens.
- Use `AGY_METRICS=1` when measuring. Report its character/time values as proxies,
  never as exact token usage.

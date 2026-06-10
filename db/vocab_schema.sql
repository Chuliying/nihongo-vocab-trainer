-- Vocabulary DB migration schema baseline.
-- Target provider: Neon Postgres first, Supabase Postgres compatible.
-- Vector columns are intentionally represented as JSONB in the baseline so the
-- first import/parity phase does not depend on pgvector availability.

CREATE TABLE IF NOT EXISTS tranches (
  id integer PRIMARY KEY,
  title text NOT NULL,
  rank_range text NOT NULL,
  label text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS corpus_import_runs (
  id uuid PRIMARY KEY,
  source_vocab_hash text NOT NULL,
  source_tranches_hash text NOT NULL,
  source_popular_verbs_hash text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('bootstrap-truncate', 'snapshot-upsert', 'archive-and-reset')),
  status text NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archive_artifact_path text
);

CREATE TABLE IF NOT EXISTS vocab_entries (
  id integer PRIMARY KEY,
  word text NOT NULL,
  reading text NOT NULL,
  part_of_speech text NOT NULL,
  jlpt_level text NOT NULL,
  tranche_id integer NOT NULL REFERENCES tranches(id),
  frequency_rank integer NOT NULL CHECK (frequency_rank > 0),
  meaning text NOT NULL,
  quality_score text NOT NULL,
  example_json jsonb NOT NULL,
  source_json jsonb NOT NULL,
  raw_quality_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (word, reading)
);

CREATE INDEX IF NOT EXISTS vocab_entries_tranche_frequency_idx
  ON vocab_entries (tranche_id, frequency_rank);
CREATE INDEX IF NOT EXISTS vocab_entries_jlpt_level_idx
  ON vocab_entries (jlpt_level);
CREATE INDEX IF NOT EXISTS vocab_entries_part_of_speech_idx
  ON vocab_entries (part_of_speech);

CREATE TABLE IF NOT EXISTS verb_info (
  vocab_id integer PRIMARY KEY REFERENCES vocab_entries(id) ON DELETE CASCADE,
  verb_type text NOT NULL,
  dictionary_form text NOT NULL,
  masu_form text NOT NULL,
  te_form text NOT NULL,
  ta_form text NOT NULL,
  nai_form text NOT NULL,
  potential_form text NOT NULL,
  passive_form text NOT NULL,
  causative_form text NOT NULL,
  imperative_form text NOT NULL,
  conditional_form text NOT NULL,
  volitional_form text NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS related_words (
  id bigserial PRIMARY KEY,
  vocab_id integer NOT NULL REFERENCES vocab_entries(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  word text NOT NULL,
  reading text NOT NULL,
  meaning text NOT NULL,
  target_id integer REFERENCES vocab_entries(id),
  UNIQUE (vocab_id, position)
);

CREATE INDEX IF NOT EXISTS related_words_vocab_idx ON related_words (vocab_id);
CREATE INDEX IF NOT EXISTS related_words_target_idx ON related_words (target_id);
CREATE INDEX IF NOT EXISTS related_words_vocab_position_idx ON related_words (vocab_id, position);

CREATE TABLE IF NOT EXISTS popular_verbs (
  rank integer PRIMARY KEY CHECK (rank BETWEEN 1 AND 300),
  vocab_id integer NOT NULL UNIQUE REFERENCES vocab_entries(id),
  rank_source text NOT NULL,
  snapshot_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS popular_verbs_rank_idx ON popular_verbs (rank);

CREATE TABLE IF NOT EXISTS vocab_embeddings (
  vocab_id integer NOT NULL REFERENCES vocab_entries(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions > 0),
  embedding jsonb NOT NULL,
  embedding_text_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vocab_id, provider, model, embedding_text_hash)
);

CREATE INDEX IF NOT EXISTS corpus_import_runs_status_created_idx
  ON corpus_import_runs (status, created_at);

CREATE TABLE IF NOT EXISTS candidate_runs (
  id uuid PRIMARY KEY,
  corpus_import_run_id uuid REFERENCES corpus_import_runs(id),
  method text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  embedding_text_version text NOT NULL,
  top_k integer NOT NULL CHECK (top_k > 0),
  filters_json jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('generated', 'reviewing', 'accepted', 'applied', 'rolled_back', 'discarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  rollback_artifact_path text
);

CREATE INDEX IF NOT EXISTS candidate_runs_status_created_idx
  ON candidate_runs (status, created_at);

CREATE TABLE IF NOT EXISTS related_word_candidates (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES candidate_runs(id) ON DELETE CASCADE,
  source_vocab_id integer NOT NULL REFERENCES vocab_entries(id),
  target_vocab_id integer NOT NULL REFERENCES vocab_entries(id),
  rank integer NOT NULL CHECK (rank > 0),
  similarity_score double precision NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  method text NOT NULL,
  reason_json jsonb NOT NULL,
  filters_matched_json jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('proposed', 'accepted', 'rejected', 'applied')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, source_vocab_id, rank),
  UNIQUE (run_id, source_vocab_id, target_vocab_id, method)
);

CREATE INDEX IF NOT EXISTS related_word_candidates_source_status_rank_idx
  ON related_word_candidates (source_vocab_id, status, rank);
CREATE INDEX IF NOT EXISTS related_word_candidates_run_source_rank_idx
  ON related_word_candidates (run_id, source_vocab_id, rank);

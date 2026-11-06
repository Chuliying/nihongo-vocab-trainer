# Data licenses and attribution

Application code and language data have separate terms. There is currently no general reuse license for this application's original code. Public visibility does not grant an MIT or Apache license. The following notices apply to the bundled vocabulary data and retained curation artifacts, including historical versions.

## Dictionary data: JMdict / EDRDG

The dictionary fields and English source glosses derive from the JMdict Japanese-English dictionary maintained by the **Electronic Dictionary Research and Development Group (EDRDG)**. The generator reads the Japanese forms, readings, parts of speech, and English glosses; it does not import separately licensed non-English JMdict translations.

- Dictionary project and attribution: https://www.edrdg.org/
- Source license terms: https://www.edrdg.org/edrdg/licence.html
- License: **Creative Commons Attribution-ShareAlike 4.0 International**, https://creativecommons.org/licenses/by-sa/4.0/

Changes include selection, learning order, Traditional Chinese meanings, related-word links, supported verb forms, and quality metadata. The project's contributions to this derivative dictionary dataset are distributed under CC BY-SA 4.0. The separate Tatoeba sentence credits below still apply. Neither the original dictionary provider nor its license certifies these changes as correct.

The original dictionary version and download date were not recorded. They are unknown, not the date of this release. For future refreshes, record the source URL, version/date, checksum, and changes before importing. `scripts/generate_frequency_vocab.py` documents the original transformation; do not use it to overwrite the reviewed chunks or a production database.

## Frequency ordering: wordfreq

Most entries were selected and ordered using **wordfreq by Robyn Speer and contributors**, with a small number of essential-verb insertions. Each entry retains `source.frequency`. A rank is an application learning order, not an official JLPT classification or a live frequency measurement.

wordfreq's software is Apache-licensed; its **data is CC BY-SA 4.0**, which is the relevant license for the derived ordering here. The package version used for the original generation was not recorded. Retain this notice and the following credits with any redistribution; do not distribute a stripped list without attribution and license information.

- wordfreq and full source credits: https://github.com/rspeer/wordfreq#license
- Data license: https://creativecommons.org/licenses/by-sa/4.0/
- Citation supplied by the project: Robyn Speer (2022), *rspeer/wordfreq: v3.0 (v3.0.2)*, Zenodo, https://doi.org/10.5281/zenodo.7199437. This is the upstream citation, not a claim that this app used that exact package version.

Upstream credits include Google Books Ngram Viewer (https://books.google.com/ngrams) and Google Books Syntactic Ngrams (https://commondatastorage.googleapis.com/books/syntactic-ngrams/index.html); the University of Leeds Centre for Translation Studies' Internet Corpus (http://corpus.leeds.ac.uk/list.html); Wikipedia (https://www.wikipedia.org/); ParaCrawl (https://paracrawl.eu/); OPUS OpenSubtitles 2018 (https://opus.nlpl.eu/OpenSubtitles.php), derived from OpenSubtitles (https://www.opensubtitles.org/); and the SUBTLEX-US, SUBTLEX-UK, SUBTLEX-CH, SUBTLEX-DE, and SUBTLEX-NL word lists by Marc Brysbaert and coauthors (http://crr.ugent.be/programs-data/subtitle-frequencies). SUBTLEX is freely available data. wordfreq also describes derived Twitter word statistics; this project does not redistribute tweets.

These are credits retained from wordfreq, not a claim that every listed source contributed to every Japanese entry. The upstream README contains the complete research citations and redistribution discussion.

## Sentences and readings: Tatoeba

Attributed examples are from **Tatoeba contributors** under **Creative Commons Attribution 2.0 France**: https://creativecommons.org/licenses/by/2.0/fr/.

- Terms: https://tatoeba.org/en/terms_of_use
- Corpus usage: https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus
- Downloads: https://tatoeba.org/en/downloads
- Individual source and contributor records: [Tatoeba credit manifest](public/data/attribution/tatoeba.json)

The manifest covers sentence IDs referenced by the current corpus and reachable vocabulary curation history. Source URLs are `https://tatoeba.org/en/sentences/show/<sentence_id>`. Sentence-owner metadata was retrieved from the official Japanese and Mandarin detailed exports on 2026-11-06 (export last modified 2026-10-31). `owner` is the account supplied by that export, not a verified claim of original authorship. Null means the export did not supply an owner; this project does not invent a name. Reading contributors are retained from the local human-transcription export used by the curation pipeline; that export's original download date was not recorded.

Japanese sentences, readings, and Traditional Chinese translations have been selected or edited for this project. The current attributed Japanese sentences matched the official export at the release review. Readings may be normalized or corrected, and translations may be generated and reviewed. These changes are not endorsed by Tatoeba. Some legacy translation records did not retain a separate source-translation ID; a sentence link must not be interpreted as proof that the displayed Chinese translation is the original contributor's wording.

Only textual data is bundled. These notices do not grant permission to use Tatoeba audio, images, or any other independently licensed material.

## Scope and limitations

Legacy `vocab_10000.json` and `vocab_13000.json` files and historical batch outputs are retained as development history, not as validated learning corpora. Runtime uses the chunk files. Source names, license notices, and contributor links must stay with redistributed data. Language quality, original source version gaps, and ownership metadata gaps are documented separately from software test results.

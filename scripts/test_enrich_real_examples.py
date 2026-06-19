#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("enrich_real_example_candidates.py")
SPEC = importlib.util.spec_from_file_location("enrich_real_examples", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EnrichmentTests(unittest.TestCase):
    def test_transcription_notation(self):
        self.assertEqual(
            MODULE.transcription_to_reading("[場所|ば|しょ]へ[行|い]く。"),
            "ばしょへいく。",
        )

    def test_script_hints(self):
        self.assertEqual(MODULE.script_hint("我們回來了。"), "traditional_likely")
        self.assertEqual(MODULE.script_hint("我们回来了。"), "simplified_likely")


if __name__ == "__main__":
    unittest.main()

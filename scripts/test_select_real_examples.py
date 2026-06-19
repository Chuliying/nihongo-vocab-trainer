#!/usr/bin/env python3
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("select_real_examples.py")
SPEC = importlib.util.spec_from_file_location("select_real_examples", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FakeFeature:
    def __init__(self, lemma="*", kana="*", orthBase="*", pos1="*"):
        self.lemma = lemma
        self.kana = kana
        self.orthBase = orthBase
        self.orth = "*"
        self.pos1 = pos1


class FakeToken:
    def __init__(self, surface, lemma="*", kana="*", orthBase="*", pos1="*"):
        self.surface = surface
        self.feature = FakeFeature(
            lemma=lemma, kana=kana, orthBase=orthBase, pos1=pos1
        )


class RealExampleSafetyTests(unittest.TestCase):
    def test_does_not_match_substring(self):
        token = FakeToken("パイロット", lemma="パイロット", kana="パイロット")
        target = {"word": "ロット", "reading": "ロット"}
        self.assertFalse(MODULE.token_matches_target(token, target))

    def test_matches_inflected_verb_by_lemma(self):
        token = FakeToken("食べた", lemma="食べる", kana="タベタ")
        target = {"word": "食べる", "reading": "たべる"}
        self.assertTrue(MODULE.token_matches_target(token, target))

    def test_does_not_match_prefix_of_different_lemma(self):
        token = FakeToken("わかり", lemma="分かる", kana="ワカリ")
        target = {"word": "わか", "reading": "わか"}
        self.assertFalse(MODULE.token_matches_target(token, target))

    def test_does_not_match_kana_homophone_by_reading(self):
        token = FakeToken("とうに", lemma="疾うに", kana="トウニ")
        target = {"word": "とう", "reading": "とう"}
        self.assertFalse(MODULE.token_matches_target(token, target))

    def test_rejects_surface_homophone_with_wrong_pos(self):
        token = FakeToken("とう", lemma="疾う", kana="トウ", pos1="副詞")
        target = {"word": "とう", "reading": "とう", "part_of_speech": "動詞"}
        self.assertFalse(MODULE.token_matches_target(token, target))

    def test_matches_katakana_hiragana_surface_variant(self):
        token = FakeToken("ワクワク", lemma="ワクワク", kana="ワクワク")
        target = {"word": "わくわく", "reading": "わくわく"}
        self.assertTrue(MODULE.token_matches_target(token, target))

    def test_parses_and_preserves_tatoeba_id(self):
        self.assertEqual(
            MODULE.parse_tatoeba_line("123\tjpn\t短い文です。\n"),
            {"sentence_id": 123, "sentence": "短い文です。"},
        )

    def test_rejects_advanced_grammar(self):
        target = {"word": "行く"}
        tokens = [FakeToken("行く", lemma="行く", kana="イク")]
        score = MODULE.candidate_score(
            "行かざるを得ない。", tokens, target, set("行"), set()
        )
        self.assertIsNone(score)


if __name__ == "__main__":
    unittest.main()

import { describe, expect, it } from "vitest";

const { isLowValueJapanese } = require("../scripts/vocab_quality.js");

describe("low-value vocabulary example detection", () => {
  it.each([
    "友達に「帰れ」の意味を聞きました。",
    "会話の中で「月曜日」を使いました。",
    "会話で「すっきり」を使うことがあります。",
    "作文で「金曜日」を自然に使いたいです。",
    "作文で「金曜日」を正しく使いたいです。",
    "作文に「しかし」を入れると表現が自然です。",
    "作文で「そして」を使って文を続けました。",
    "会話の中で「愛情」という言葉が出ました。",
    "毎日カラフル練習をしています。",
    "あかについて、クラスでみんなで話し合いました。",
  ])("rejects meta/template sentence: %s", (sentence) => {
    expect(isLowValueJapanese(sentence)).toBe(true);
  });

  it.each([
    "父は私に「早く帰れ」と言った。",
    "月曜日に学校へ行きます。",
    "カラフルな服を着ています。",
  ])("keeps a concrete usage example: %s", (sentence) => {
    expect(isLowValueJapanese(sentence)).toBe(false);
  });
});

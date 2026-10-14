# 评审规则 · 软指标（critic）

硬指标（字数、首个可操作时间、反馈延迟、帧率、报错、删字、复现）由 `pnpm bench` 判，不在这里。
这里只管看得出来的「口味」，由 critic 判。依据：`docs/presentation-pipeline-brief (2).md` 第 3.2–3.6 节。

**状态**：这是规格。critic 的运行器还没接模型；参考集（`critic/golden/`）要由人提供，见那里的 README。

## 铁则

1. critic 用的模型与生成的模型不同。critic 不看生成提示词、不看 plan.json 里的 predict 与 rehearsal。
2. 不打绝对分，只做配对比较。配对比较比打分稳定得多。
3. 只按维度提问，从不问「哪个更像某某游戏」。
4. `golden/holdout/` 只在评测时给 critic，不给生成方，不用来调参。
5. 作品的作者不给自己的产物打分。

## 输入

每一幕 3–5 张截图（`runs/<意图>/<seed>/<档位>/shots/`，电影每镜抽 3 帧）、该件的意图（`intents/*.json`）、时代的 `eras/<era>/style-bible.md`。
看动效时，用同一镜头连续三帧（约 t、t+0.3 秒、t+1 秒）。

## 六个维度

| id | 向 critic 提的问题 | 看什么 | 常见失分 |
|---|---|---|---|
| focus | A 和 B，哪个的焦点更清楚？ | 第一眼落在哪；焦点与背景的明暗反差；是否只有一处在明显地动；文字有没有抢焦点 | 几处同样亮；一堵字；一排按钮 |
| era-material | A 和 B，哪个的材质更符合战国（漆、帛、青铜、金银错）？ | 底色与质感；纹样；人物剪影；字形 | 渐变科技感；现代无衬线字；纯黑纯白；水墨、皮影、扁平插画 |
| composition | A 和 B，哪个的构图更稳、更像有意为之？ | 地标位置是否固定；留白；边饰是否退后；横幅式取景 | 元素散落；边框抢戏；焦点贴边 |
| colour-unity | A 和 B，哪个更统一在同一份色板里？ | 是否都在 `palette.json` 的色里；光色是否都是暖光；后处理（颗粒、暗角、光晕）是否一致 | 色板外的大块颜色；冷白光；有的元素没过后处理 |
| motion-intent | A 和 B，哪个的动更像有意图？ | 连续三帧里，动的是不是焦点；背景是否只有缓慢的呼吸 | 到处在动；焦点不动；抖动 |
| style | 这三件里，哪一件不是同一位导演做的？ | 构图、颜色、节奏、措辞是否可辨认 | 换了导演也看不出差别 |

## 配对比较协议

对每个维度、每一幕：

1. 取候选的该幕截图组，与参考集里一件 golden 配对。
2. 每对问两次，交换 A/B 的位置。两次选的是同一件才算胜负，不一致记平局。
3. 回答只允许 `A` / `B` / `平`，附一句理由（≤ 30 字）并指出画面里的证据位置。
4. 胜率 = (胜 + 0.5 × 平) / n，按维度和总体分别算，n 一并打印。
5. 先验证 critic 自己：对 golden 的配对里，golden 对 `golden/bad/` 必须稳定获胜；做不到，先修 critic，不评作品。

**风格可辨**（style 维度）：同一导演的三件作品，混进别人的作品里，critic 要把它挑出来。准确率 ≥ 80% 为合格（G6）。

## 输出

写进 `bench/report.json` 的 `critic` 字段，并在汇总行里带上：

```json
{
  "critic": {
    "model": "<与生成不同的模型>",
    "n": 12,
    "winrate": 0.42,
    "byDimension": { "focus": 0.5, "era-material": 0.38, "composition": 0.4, "colour-unity": 0.45, "motion-intent": 0.4 },
    "style": { "accuracy": null },
    "pairs": [{ "dim": "focus", "act": "threshold", "ref": "golden/<件>", "a": "cand", "b": "ref", "answer": "A", "swapAnswer": "A", "result": "win", "why": "…" }]
  }
}
```

汇总行：`PASS hard 8/8 · critic winrate 0.42 (n=12) · repro 0.88`。

## 防刷分

- 每周人工排 5 对作品，写一句为什么，放进 `critic/human/`。人与 critic 的一致率低于 70%，先修 critic，再继续优化作品。
- 分数在涨、人看不出差别时，停下来，记进 notes。

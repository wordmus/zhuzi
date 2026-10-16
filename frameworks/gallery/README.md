# 作品架

导演入口 `galleryActs(budget)`，框架导出 `gallery`；只读每件 `PlanElement.asset`。
8 张现有图片原样复制，准确来源、SHA-256 与许可限制记在
`assets/library/shelf-gallery/recipe.json`；`assets.ts` 逐一 `?url` 导入，不使用 glob。

打开 `/dev/gallery.html`：宽屏左右拖、滚轮展卷；窄屏一列上下拖。
点画面显示对应追问，点底部卷轴或方向箭头继续一张。
键盘方向键、空格、PageUp/PageDown 翻阅，Home/End 到首尾。
前 3 秒只有同一展卷 aff；3.1 秒后右上出现「收起」。
到末张停留 650ms 或收起即完成，清理事件和 aff。
位置用 `ctx.store` 的 `gallery:shelf-gallery:position` 保存为小数张数，
例如停在第二张附近后刷新、或转成手机竖屏，都保持同一处。

浏览器复验（支持省略 URL，默认读取 dist-gallery/dev/gallery.html）：

```sh
node frameworks/gallery/verify.mjs http://127.0.0.1:5173/dev/gallery.html
```

脚本检查初入仅一个 aff、宽屏拖动、滚轮、刷新恢复、窄屏拖动与恢复、
追问字数、到底与收起两种完成路径，无页面异常；成功后打印 JSON，
截图写入 `frameworks/gallery/evidence/{01-desktop,02-narrow,03-question}.png`。

限制：停处只保存在当前浏览器；存储被禁时使用 `ctx.store` 内存回退，
刷新后无法保证记忆。图集不自动播放，不接模型。
图片为本项目生成/截图，未声明开放许可，外部分发仍需确认。

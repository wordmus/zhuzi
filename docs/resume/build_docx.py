#!/usr/bin/env python3
"""把简历的 Markdown 源文件渲染成 docx，沿用 v1 的版式。

为什么是「打开 v1 再换正文」而不是「从零新建」：v1 的观感有一半不在正文里 ——
  页眉 header1 是一个满页纸纹形状（底色 FAF9F5，behindDoc 沉在文字下）
  页眉 header2 在那层纸纹上加了一条 D8D4CA 发丝线 + 姓名行
  styles.xml 有 341KB 自定义样式，theme/fontTable 也是配好的
从零建的仿制品长得像、气质不对。所以这里只做一件事：保留一切，替换 <w:body> 里的段落。

下面的规格全部是从 v1 的 word/document.xml 逐段量出来的（sb/sa/line 单位为 twips 与半磅），
不是我凭观感调的。要改版式，改这里的常量，不要改 Markdown。

用法：
    python3 build_docx.py resume_v2.md 简永杰_机器心智与实验世界_v2.docx
"""

import re
import sys
import shutil
from pathlib import Path

import docx
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_TAB_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "简永杰_机器心智与实验世界.docx"   # v1，版式由它继承

# ── 字体：v1 用了四套，不是两套 ────────────────────────────────────────────
SERIF = ("Georgia", "Songti SC")                     # 正文与标题：有分量的衬线
SANS = ("Avenir Next", "Hiragino Sans GB")           # 标签、眉题、联系行
SANS_MED = ("Avenir Next Medium", "Hiragino Sans GB")     # 章节的英文副标
SANS_DEMI = ("Avenir Next Demi Bold", "Hiragino Sans GB")  # 条目副行、日期、作品描述

# ── 四色调色板，全文只此四色 ──────────────────────────────────────────────
INK = "141413"      # 近黑：姓名、条目标题、段内小标题
BODY = "3D3D3A"     # 正文灰
MUTE = "6E6C64"     # 弱灰：章节名、标签、日期
ACCENT = "A54F2E"   # 陶土橘：全文唯一的彩色
RULE = "D8D4CA"     # 发丝线：与页眉那条同色

# 制表位（twips，与 v1 的 w:pos 一致）
TAB_SECTION = 9808   # 章节标题行：英文副标右对齐到版心右缘（版心宽 11906-2098=9808）
TAB_LABEL = 1160     # 条目：标签列右对齐
TAB_BODY = 1380      # 条目：正文起点，同时是悬挂缩进量

# ── 每种块的规格：(段前, 段后, 行距) 单位 pt，行距为绝对值 ──────────────────
# 行距用绝对值而非倍数 —— v1 的留白是杂志式的（约为字号的 1.65–1.75 倍），改乘数就散了。
SPEC = {
    "eyebrow":   (0.0,  2.0, 13.0),
    "name":      (0.0,  2.0, None),      # 倍数 1.0583，单独处理
    "subtitle":  (0.0,  7.5, 13.8),
    "contact":   (6.0,  5.5, 13.0),      # 下方带规则 space=6
    "hook":      (5.0,  3.0, 16.4),
    "section":   (16.0, 6.0, 13.8),      # 下方带规则 space=5
    "lead":      (0.0,  5.0, 17.5),
    "body":      (0.0,  6.5, 16.4),
    "entry":     (11.0, 3.0, 15.8),
    "entrysub":  (0.0,  5.0, 13.8),
    "entrynote": (8.0,  4.5, 13.8),
    "bullet":    (0.0,  4.4, 15.2),
    "rule":      (0.0,  0.0, None),      # 空段落 + 规则 space=0，独立分隔线
}

# pBdr 之后允许出现的元素，用于把边框插到 schema 正确的位置
AFTER_PBDR = (
    "w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap",
    "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN",
    "w:bidi", "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind",
    "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc",
    "w:textDirection", "w:textAlignment", "w:textboxTightWrap", "w:outlineLvl",
    "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange",
)


def add_run(p, text, *, fonts=SERIF, size=9.5, bold=False, color=BODY, italic=False):
    """加一个 run，并同时设好 ascii/hAnsi（拉丁）与 eastAsia（中文）两套字体。

    只设 font.name 会漏掉 eastAsia —— 中文会掉回 Word 默认字体，整段气质就变了。
    """
    r = p.add_run(text)
    latin, ea = fonts
    rPr = r._element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:ascii"), latin)
    rFonts.set(qn("w:hAnsi"), latin)
    rFonts.set(qn("w:eastAsia"), ea)
    rFonts.set(qn("w:hint"), "eastAsia")
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = RGBColor.from_string(color)
    return r


def new_para(doc, kind, *, tabs=(), keep_with_next=False, rule_space=None,
             indent=None):
    p = doc.add_paragraph()
    pPr = p._element.get_or_add_pPr()
    # v1 的内容段都关掉网格对齐（docGrid linePitch=360 时它会影响行距）
    snap = OxmlElement("w:snapToGrid")
    snap.set(qn("w:val"), "0")
    pPr.insert_element_before(snap, *[t for t in AFTER_PBDR if t != "w:snapToGrid"])

    pf = p.paragraph_format
    before, after, line = SPEC[kind]
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    if line:
        pf.line_spacing = Pt(line)          # Length → w:lineRule="exact"
    for pos, align in tabs:
        pf.tab_stops.add_tab_stop(Pt(pos / 20), align)   # twips → pt
    if indent:
        pf.left_indent = Pt(indent / 20)
        pf.first_line_indent = Pt(-indent / 20)
    if keep_with_next:
        pf.keep_with_next = True
    if rule_space is not None:
        pBdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), str(rule_space))
        bottom.set(qn("w:color"), RULE)
        pBdr.append(bottom)
        pPr.insert_element_before(pBdr, *AFTER_PBDR)
    return p


INLINE = re.compile(r"\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*")


def inline(p, text, *, fonts=SERIF, size=9.5, color=BODY, bold_color=INK,
           bold_fonts=None, bold_size=None):
    """把 **粗体** / `等宽` / *斜体* 落成 run。粗体用更深的颜色，制造压强。"""
    i = 0
    for m in INLINE.finditer(text):
        if m.start() > i:
            add_run(p, text[i:m.start()], fonts=fonts, size=size, color=color)
        if m.group(1) is not None:
            add_run(p, m.group(1), fonts=bold_fonts or fonts,
                    size=bold_size or size, bold=True, color=bold_color)
        elif m.group(2) is not None:
            add_run(p, m.group(2), fonts=SANS, size=size - 0.5, color=bold_color)
        else:
            add_run(p, m.group(3), fonts=fonts, size=size, color=color, italic=True)
        i = m.end()
    if i < len(text):
        add_run(p, text[i:], fonts=fonts, size=size, color=color)
    return p


def parse(md_text):
    """把 Markdown 折成块列表。块类型见下面的方言说明。"""
    blocks, buf, fence = [], [], None
    for raw in md_text.splitlines():
        line = raw.rstrip()
        if line.startswith(":::"):
            tag = line[3:].strip()
            if fence is None:
                fence, buf = tag, []
                continue
            blocks.append((fence, "\n".join(buf).strip()))
            fence, buf = None, []
            continue
        if fence is not None:
            buf.append(line)
            continue
        if not line.strip():
            continue
        if line.startswith("### "):
            blocks.append(("entry", line[4:].strip()))
        elif line.startswith("## "):
            blocks.append(("section", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("name", line[2:].strip()))
        elif line.startswith("- "):
            blocks.append(("bullet", line[2:].strip()))
        elif line.startswith("> "):
            blocks.append(("lead", line[2:].strip()))
        elif line.strip() == "---":
            blocks.append(("rule", ""))
        else:
            blocks.append(("body", line.strip()))
    if fence is not None:
        raise SystemExit(f"Markdown 里有没闭合的 :::{fence} 块")
    return blocks


def split_once(text, sep="|"):
    if sep in text:
        a, b = text.split(sep, 1)
        return a.strip(), b.strip()
    return text.strip(), ""


def harvest_contact_bits(template):
    """从 v1 里把联系行的邮箱取出来。

    为什么不写进 Markdown：这个环境会把工具输出里的邮箱地址脱敏成 {{EMAIL_xxxx}}
    之类的占位符。照抄读到的内容，就等于把一个坏占位符复制进新简历 —— 我还看不出来。
    索性不让这个字符串经过我手里：运行时直接从 v1 的 <w:t> 里取。
    """
    d = docx.Document(template)
    for p in d.paragraphs:
        segs = [s.strip() for s in p.text.split("·")]
        if any("@" in s for s in segs):
            return {"{{EMAIL}}": next(s for s in segs if "@" in s)}
    raise SystemExit("v1 里找不到联系行，无法取到邮箱")


def build(md_path, out_path, template=TEMPLATE):
    md_text = Path(md_path).read_text(encoding="utf-8")
    for k, v in harvest_contact_bits(template).items():
        md_text = md_text.replace(k, v)
    blocks = parse(md_text)

    shutil.copyfile(template, out_path)
    doc = docx.Document(out_path)

    # 清空正文，只留 sectPr（页边距、页眉引用都挂在它身上）
    body = doc.element.body
    for child in list(body):
        if child.tag != qn("w:sectPr"):
            body.remove(child)

    for kind, text in blocks:
        if kind == "name":
            p = new_para(doc, "name")
            p.paragraph_format.line_spacing = 1.0583     # v1 这里是倍数，不是绝对值
            add_run(p, text, fonts=SERIF, size=25, bold=True, color=INK)

        elif kind == "eyebrow":
            p = new_para(doc, "eyebrow")
            add_run(p, text, fonts=SANS_MED, size=7, color=MUTE)

        elif kind == "subtitle":
            p = new_para(doc, "subtitle")
            add_run(p, text, fonts=SANS_DEMI, size=9.5, color=ACCENT)

        elif kind == "contact":
            # 联系行下方有一条规则，把页首身份块与正文切开（v1 段 3）
            p = new_para(doc, "contact", rule_space=6)
            inline(p, text, fonts=SANS, size=7.5, color=MUTE)

        elif kind == "hook":
            p = new_para(doc, "hook")
            inline(p, text, fonts=SERIF, size=9.5, color=BODY)

        elif kind == "section":
            cn, en = split_once(text)
            p = new_para(doc, "section",
                         tabs=[(TAB_SECTION, WD_TAB_ALIGNMENT.RIGHT)],
                         keep_with_next=True, rule_space=5)
            add_run(p, cn, fonts=SANS, size=8, bold=True, color=MUTE)
            add_run(p, "\t" + en, fonts=SANS_MED, size=7.5, color=ACCENT)

        elif kind == "entry":
            # 两种收尾，语义不同、样式也不同（v1 段 13 与段 21）：
            #   主标题 · 描述         → 陶土橘 8pt Demi Bold，如「《东周实验室》 · 多智能体历史世界实验」
            #   主标题 | 右对齐元信息  → 弱灰 7.5pt Demi Bold，靠版心右缘，如起止日期
            left, meta = split_once(text)
            head, _, tail = left.partition(" · ")
            p = new_para(doc, "entry",
                         tabs=[(TAB_SECTION, WD_TAB_ALIGNMENT.RIGHT)] if meta else (),
                         keep_with_next=True)
            add_run(p, head, fonts=SERIF, size=10, bold=True, color=INK)
            if tail:
                add_run(p, "   ·   " + tail, fonts=SANS_DEMI, size=8, color=ACCENT)
            if meta:
                add_run(p, "\t" + meta, fonts=SANS_DEMI, size=7.5, color=MUTE)

        elif kind in ("entrysub", "entrynote"):
            p = new_para(doc, kind, keep_with_next=True)
            color = ACCENT if kind == "entrysub" else INK
            inline(p, text, fonts=SANS_DEMI, size=8.5, color=color)

        elif kind == "bullet":
            p = new_para(doc, "bullet",
                         tabs=[(TAB_LABEL, WD_TAB_ALIGNMENT.RIGHT),
                               (TAB_BODY, WD_TAB_ALIGNMENT.LEFT)],
                         indent=TAB_BODY)
            m = re.match(r"\*\*(.+?)\*\*\s*(.*)$", text, re.S)
            add_run(p, "\t", fonts=SANS, size=9, color=BODY)
            if m:
                add_run(p, m.group(1), fonts=SANS, size=8, color=MUTE)
                add_run(p, "\t", fonts=SANS, size=9, color=BODY)
                inline(p, m.group(2), fonts=SERIF, size=9, color=BODY)
            else:
                add_run(p, "\t", fonts=SANS, size=9, color=BODY)
                inline(p, text, fonts=SERIF, size=9, color=BODY)

        elif kind in ("lead", "body"):
            p = new_para(doc, kind)
            inline(p, text, fonts=SERIF,
                   size=10.5 if kind == "lead" else 9.5, color=BODY)

        elif kind == "rule":
            new_para(doc, "rule", rule_space=0)

        else:
            raise SystemExit(f"不认识的块类型：{kind}")

    doc.save(out_path)
    return out_path


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    print(f"OK → {build(sys.argv[1], sys.argv[2])}")

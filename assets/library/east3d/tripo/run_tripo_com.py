#!/usr/bin/env python3
"""Tripo 资产生成包装器：把官方 skill 脚本的 API 主机从 .ai 换成 .com。

原因：本机这把 key 在 api.tripo3d.com 上认证（.ai 返回 401）。
用法与原脚本一致：
    export TRIPO_API_KEY="$(cat ~/.config/tripo/api-key)"
    python3 run_tripo_com.py text --prompt "..." --out-dir out --wait --download
不改动 ~/.pi 下的 skill 原文件；仅运行时替换 base URL。
"""
import os, sys, runpy

SKILL = os.path.expanduser('~/.pi/agent/skills/threejs-3d-generator/scripts/threejs_3d_asset.py')
SRC_AI = 'https://api.tripo3d.ai/v2/openapi'
SRC_COM = 'https://api.tripo3d.com/v2/openapi'

src = open(SKILL, encoding='utf-8').read()
if SRC_AI not in src:
    sys.exit(f'找不到 base URL：{SKILL} 已变更，检查后再试')
patched = src.replace(SRC_AI, SRC_COM)
ns = {'__name__': '__main__', '__file__': SKILL}
sys.argv[0] = SKILL
exec(compile(patched, SKILL + ' [host→.com]', 'exec'), ns)

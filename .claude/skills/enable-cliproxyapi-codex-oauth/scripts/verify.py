#!/usr/bin/env python3
"""Verify local CLIProxyAPI models and one inference call without leaking keys."""

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional


PROVIDER_ALIASES = {
    "openai": "openai",
    "codex": "openai",
    "xai": "xai",
    "grok": "xai",
    "any": "any",
}


def redact(text: str) -> str:
    patterns = [
        (r"(?i)(authorization\s*:\s*bearer\s+)[^\s\"']+", r"\1[REDACTED]"),
        (r'(?i)("(?:access_token|refresh_token|id_token|api[_-]?key)"\s*:\s*")[^"]+', r"\1[REDACTED]"),
        (r"\b(?:sk|cpa|xai-)[A-Za-z0-9._~-]{16,}\b", "[REDACTED]"),
    ]
    for pattern, replacement in patterns:
        text = re.sub(pattern, replacement, text)
    return text


def load_key(path: Optional[Path]) -> str:
    if path:
        expanded = path.expanduser()
        if not expanded.is_file():
            raise ValueError(f"API key 文件不存在: {expanded}")
        mode = stat.S_IMODE(expanded.stat().st_mode)
        if mode & 0o077:
            raise ValueError(f"API key 文件权限过宽（当前 {mode:04o}，要求 0600）")
        value = expanded.read_text(encoding="utf-8").strip()
    else:
        value = os.environ.get("CLIPROXYAPI_API_KEY", "").strip()
    if len(value.encode("utf-8")) < 16:
        raise ValueError("未提供有效本地 API key；使用 --api-key-file 或 CLIPROXYAPI_API_KEY")
    return value


def request_json(url: str, key: str, payload: Optional[dict[str, Any]], timeout: int) -> tuple[int, Any]:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    method = "GET" if payload is None else "POST"
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {key}")
    request.add_header("Accept", "application/json")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(2_000_000).decode("utf-8", errors="replace")
            try:
                return response.status, json.loads(raw)
            except json.JSONDecodeError:
                return response.status, {"raw": redact(raw[:1000])}
    except urllib.error.HTTPError as exc:
        raw = exc.read(200_000).decode("utf-8", errors="replace")
        try:
            body: Any = json.loads(raw)
        except json.JSONDecodeError:
            body = {"raw": redact(raw[:1000])}
        return exc.code, body


def safe_error(body: Any) -> str:
    if isinstance(body, dict):
        error = body.get("error", body)
        if isinstance(error, dict):
            selected = {key: error.get(key) for key in ("type", "code", "message") if error.get(key) is not None}
            return redact(json.dumps(selected, ensure_ascii=False))[:1000]
    return redact(json.dumps(body, ensure_ascii=False))[:1000]


def model_id(item: dict[str, Any]) -> str:
    return str(item.get("id") or "")


def owned_by(item: dict[str, Any]) -> str:
    return str(item.get("owned_by") or "").lower()


def is_openai_model(item: dict[str, Any]) -> bool:
    mid = model_id(item).lower()
    owner = owned_by(item)
    if owner in {"openai", "codex"}:
        return True
    if mid.startswith(("gpt-", "o1", "o3", "o4", "codex")):
        return True
    if "codex" in mid:
        return True
    return False


def is_xai_model(item: dict[str, Any]) -> bool:
    mid = model_id(item).lower()
    owner = owned_by(item)
    if owner in {"xai", "x-ai", "grok", "x.ai"}:
        return True
    if mid.startswith(("grok", "xai/", "x-ai/", "grok/")):
        return True
    if "/grok" in mid or mid.startswith("xai-") or "grok-" in mid:
        return True
    return False


def select_model(models: list[dict[str, Any]], requested: Optional[str], provider: str) -> str:
    ids = {model_id(item) for item in models if model_id(item)}
    if requested:
        if requested not in ids:
            raise ValueError("指定模型不在 /v1/models 中")
        return requested

    provider = PROVIDER_ALIASES.get(provider, provider)

    if provider == "openai":
        preferred = [
            item
            for item in models
            if is_openai_model(item) and "codex" in model_id(item).lower()
        ]
        if not preferred:
            preferred = [item for item in models if is_openai_model(item)]
        if not preferred:
            raise ValueError("模型列表中没有可识别的 OpenAI/Codex 模型")
        return model_id(preferred[0])

    if provider == "xai":
        preferred = [
            item
            for item in models
            if is_xai_model(item) and "grok" in model_id(item).lower()
        ]
        if not preferred:
            preferred = [item for item in models if is_xai_model(item)]
        if not preferred:
            raise ValueError("模型列表中没有可识别的 xAI/Grok 模型")
        return model_id(preferred[0])

    # any: prefer codex-ish openai, then any openai, then xai, then first id
    for predicate, label in (
        (lambda i: is_openai_model(i) and "codex" in model_id(i).lower(), "openai-codex"),
        (is_openai_model, "openai"),
        (is_xai_model, "xai"),
    ):
        preferred = [item for item in models if predicate(item)]
        if preferred:
            return model_id(preferred[0])
    if models and model_id(models[0]):
        return model_id(models[0])
    raise ValueError("模型列表为空或无可识别模型")


def summarize_providers(models: list[dict[str, Any]]) -> str:
    openai_n = sum(1 for item in models if is_openai_model(item))
    xai_n = sum(1 for item in models if is_xai_model(item))
    return f"openai/codex={openai_n}, xai/grok={xai_n}"


def response_text(body: Any, mode: str) -> str:
    if not isinstance(body, dict):
        return ""
    if mode == "chat":
        try:
            content = body["choices"][0]["message"]["content"]
            return content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
        except (KeyError, IndexError, TypeError):
            return ""
    if isinstance(body.get("output_text"), str):
        return body["output_text"]
    parts: list[str] = []
    for item in body.get("output", []) if isinstance(body.get("output"), list) else []:
        for content in item.get("content", []) if isinstance(item, dict) else []:
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                parts.append(content["text"])
    return " ".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description="脱敏验证本机 CLIProxyAPI")
    parser.add_argument("--base-url", default="http://127.0.0.1:8317/v1")
    parser.add_argument("--api-key-file", type=Path, default=os.environ.get("CLIPROXYAPI_API_KEY_FILE"))
    parser.add_argument(
        "--provider",
        choices=sorted(PROVIDER_ALIASES),
        default="openai",
        help="自动选模时的提供商偏好：openai/codex、xai/grok，或 any",
    )
    parser.add_argument("--model", help="必须存在于 /v1/models；默认按 --provider 自动选择")
    parser.add_argument("--mode", choices=("models", "responses", "chat", "both"), default="responses")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    parsed = urllib.parse.urlparse(args.base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        print("错误: 仅允许验证本机 HTTP 回环地址", file=sys.stderr)
        return 2
    base = args.base_url.rstrip("/")
    try:
        key = load_key(args.api_key_file)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 3

    status, body = request_json(f"{base}/models", key, None, args.timeout)
    if status < 200 or status >= 300:
        print(f"GET /v1/models: HTTP {status} 失败")
        print(f"错误摘要（已脱敏）: {safe_error(body)}")
        return 4
    models = body.get("data", []) if isinstance(body, dict) else []
    if not isinstance(models, list):
        print("GET /v1/models: 响应缺少 data 数组", file=sys.stderr)
        return 5
    print(f"GET /v1/models: HTTP {status}；模型 {len(models)} 个；{summarize_providers(models)}")
    if args.mode == "models":
        return 0

    try:
        model = select_model(models, args.model, args.provider)
    except ValueError as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 6
    print(f"选择模型: {model}（provider 偏好={args.provider}）")

    modes = ("responses", "chat") if args.mode == "both" else (args.mode,)
    for mode in modes:
        if mode == "responses":
            endpoint = "responses"
            payload = {"model": model, "input": "只回复 OK", "stream": False, "max_output_tokens": 32}
        else:
            endpoint = "chat/completions"
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": "只回复 OK"}],
                "stream": False,
            }
        status, result = request_json(f"{base}/{endpoint}", key, payload, args.timeout)
        if status < 200 or status >= 300:
            print(f"POST /v1/{endpoint}: HTTP {status} 失败")
            print(f"错误摘要（已脱敏）: {safe_error(result)}")
            return 7
        answer = redact(response_text(result, mode)).strip().replace("\n", " ")[:200]
        print(f"POST /v1/{endpoint}: HTTP {status}；响应文本: {answer or '[响应成功但未提取到文本]'}")

    key = ""
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Read the built page, preload a real-shaped visit.last, and compare two visits.

Usage: python3 frameworks/vignette/second-visit-browser.py runs/first-visit/13/L1
Also accepts a running server URL whose HTML response declares UTF-8.
"""
import json
import os
import sys
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
out = root / "docs/design"
out.mkdir(parents=True, exist_ok=True)
url = sys.argv[1]
server = None
if not url.startswith("http"):
    class Utf8Handler(SimpleHTTPRequestHandler):
        # Match bench/serveDir: Vite's inlined script precedes the meta charset.
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".html": "text/html; charset=utf-8"}
        def log_message(self, format, *args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Utf8Handler, directory=str(Path(url).resolve())))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/index.html"
previous = {
    "n": 1, "at": 1792080000000, "seed": 13,
    "dwell": {"mentor": 40000, "ticket": 0}, "skipped": ["ticket"],
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get("W1_CHROMIUM") or None)
    context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
    context.route("**/fonts.googleapis.com/**", lambda route: route.fulfill(body=""))
    context.route("**/fonts.gstatic.com/**", lambda route: route.fulfill(body=""))
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url, wait_until="networkidle")
    try:
        page.wait_for_function("!!window.__zhuzi", timeout=10000)
    except Exception:
        print("BOOT FAILURE:", page.url, page.title(), page.locator("body").inner_text()[:1000], errors, flush=True)
        raise
    print("Observed buttons:", page.locator("[data-aff]").evaluate_all("xs => xs.map(x => ({id:x.dataset.aff,label:x.getAttribute('aria-label')}))"))

    def enter():
        page.locator('[data-aff="door"]').click()
        page.wait_for_function("!!document.querySelector('[data-aff=ticket]:not([disabled])')")
        page.wait_for_timeout(1200)

    enter()
    first = page.evaluate("({n:__zhuzi.ctx.visit.n, changes:__zhuzi.ctx.record.changes, lines:__trace.filter(x=>x.kind==='line.say').map(x=>x.text)})")
    assert first["n"] == 1 and first["changes"] == []
    page.screenshot(path=str(out / "second-visit-before.png"))
    # The init script runs after pagehide's save and before the next boot reads memory.
    page.add_init_script("localStorage.setItem('zhuzi.v1.visit.last', " + json.dumps(json.dumps(previous)) + ");")
    page.reload(wait_until="networkidle")
    enter()
    second = page.evaluate("({n:__zhuzi.ctx.visit.n,changes:__zhuzi.ctx.record.changes,saved:__zhuzi.ctx.store.get('visit.changes',[]),lines:__trace.filter(x=>x.kind==='line.say').map(x=>x.text)})")
    assert second["n"] == 2
    assert second["changes"][0]["lampX"] == 0.29
    assert 'visit.last.dwell["mentor"]=40000' in second["changes"][0]["why"]
    assert second["saved"] == second["changes"]
    assert second["changes"][0]["attribution"] in second["lines"]
    page.screenshot(path=str(out / "second-visit-after.png"))
    page.locator('[data-aff="visit-chronicle"]').click()
    assert page.get_by_role("dialog").is_visible()
    assert 'visit.last.dwell["mentor"]=40000' in page.get_by_role("dialog").inner_text()
    assert "revision-trace" in page.get_by_role("dialog").inner_text() or "response" in page.get_by_role("dialog").inner_text()
    page.screenshot(path=str(out / "second-visit-why.png"))
    page.get_by_role("button", name="收起", exact=True).click()
    assert not page.get_by_role("dialog").is_visible()
    assert not errors, errors
    result = {"first": first, "second": second, "preloaded": previous, "pageErrors": errors,
              "screenshots": ["second-visit-before.png", "second-visit-after.png", "second-visit-why.png"]}
    (out / "second-visit-browser.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print("PASS browser second-visit: n=1 → n=2; lamp x=0.48w → 0.29w; mentor dwell=40000; why dialog verified; pageErrors=0")
    for name in result["screenshots"]:
        print(out / name)
    context.close()
    browser.close()
if server:
    server.shutdown()
    server.server_close()

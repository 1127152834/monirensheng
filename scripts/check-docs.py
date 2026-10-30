#!/usr/bin/env python3
"""检查本项目文档的本地链接、源码行号和意外凭据；不联网。"""

from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"\[[^\]\n]+\]\(([^)\n]+)\)")
SECRET_PATTERNS = {
    "JWT": re.compile(r"\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "credential header": re.compile(r"Authorization\s*[:=]\s*[\"']?Bearer\s+[A-Za-z0-9_.-]{30,}"),
}


def heading_ids(markdown):
    seen = {}
    result = set()
    for line in markdown.splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*#*$", line)
        if not match:
            continue
        slug = re.sub(r"[^\w\-\s]", "", match.group(1).strip().lower()).replace(" ", "-")
        n = seen.get(slug, 0)
        seen[slug] = n + 1
        result.add(slug if n == 0 else f"{slug}-{n}")
    return result


errors = []
checked_links = 0
documents = sorted(ROOT.rglob("*.md"))
for doc in documents:
    if any(part in {"node_modules", ".git", "dist", ".local", ".runtime"} for part in doc.relative_to(ROOT).parts):
        continue
    content = doc.read_text(encoding="utf-8")
    for name, pattern in SECRET_PATTERNS.items():
        for match in pattern.finditer(content):
            line = content.count("\n", 0, match.start()) + 1
            errors.append(f"{doc.relative_to(ROOT)}:{line}: possible {name}; value suppressed")
    visible = re.sub(r"^```[^\n]*\n.*?^```\s*$", "", content, flags=re.M | re.S)
    for match in LINK.finditer(visible):
        target = match.group(1).strip().strip("<>")
        if re.match(r"^[A-Za-z][A-Za-z0-9+.-]*://", target) or target.startswith("mailto:"):
            continue
        pathname, _, fragment = unquote(target).partition("#")
        line_match = re.search(r":(\d+)$", pathname)
        source_line = int(line_match.group(1)) if line_match else None
        if line_match:
            pathname = pathname[:line_match.start()]
        path = (doc.parent / pathname).resolve() if pathname else doc
        checked_links += 1
        if not path.exists():
            errors.append(f"{doc.relative_to(ROOT)}: missing local target {target}")
            continue
        if not path.is_file():
            continue
        if source_line is not None or (fragment and path.suffix == ".md"):
            linked = path.read_text(encoding="utf-8")
            if source_line is not None and not 1 <= source_line <= len(linked.splitlines()):
                errors.append(f"{doc.relative_to(ROOT)}: invalid source line {target}")
            if fragment and path.suffix == ".md" and fragment not in heading_ids(linked):
                errors.append(f"{doc.relative_to(ROOT)}: missing heading {target}")

if errors:
    print("Documentation checks failed:")
    print("\n".join(errors))
    sys.exit(1)
print(f"Documentation checks passed: {len(documents)} Markdown files, {checked_links} local links; no credential pattern found.")

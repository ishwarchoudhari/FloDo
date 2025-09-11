#!/usr/bin/env python3
"""
Cleanup Inventory & Dependency Mapping Tool (Zero-Impact)
- Builds a static Python import graph (AST-based)
- Maps template extends/include usage
- Extracts URL -> View mapping statically from urls.py
- Produces a machine-verified cleanup report with risk categories

This tool is read-only. It does not delete or move any files.
"""
import ast
import os
import re
import sys
import json
from collections import defaultdict
from pathlib import Path
import hashlib

# Project root is the directory that contains this script's parent
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent

# Directories to scan
PYTHON_DIRS = [PROJECT_ROOT]
TEMPLATE_DIRS = [PROJECT_ROOT / "templates", PROJECT_ROOT / "apps"]
STATIC_DIRS = [PROJECT_ROOT / "static"]

# Exclusions to avoid noise (virtualenvs, node modules, vcs metadata)
EXCLUDED_DIR_NAMES = {".venv", "venv", "node_modules", ".git", ".hg", ".svn"}

REPORT_MD = PROJECT_ROOT / "cleanup_report.md"
REPORT_JSON = PROJECT_ROOT / "cleanup_report.json"
INVENTORY_JSON = PROJECT_ROOT / "floDO_inventory.json"
DEPMAP_JSON = PROJECT_ROOT / "dependency_map.json"

PY_FILE_RE = re.compile(r"^.*\.py$")
TEMPLATE_EXTS = {".html", ".htm", ".txt"}


def iter_files(root: Path, predicate=lambda p: True):
    for base, dirs, files in os.walk(root):
        # prune excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIR_NAMES]
        for f in files:
            p = Path(base) / f
            if predicate(p):
                yield p


def is_python_file(p: Path) -> bool:
    return p.suffix == ".py" and "__pycache__" not in str(p)


def is_template_file(p: Path) -> bool:
    return p.suffix.lower() in TEMPLATE_EXTS and "__pycache__" not in str(p)


class ModuleInfo(ast.NodeVisitor):
    def __init__(self):
        self.imports = set()
        self.from_imports = set()

    def visit_Import(self, node: ast.Import):
        for n in node.names:
            self.imports.add(n.name)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            self.from_imports.add(node.module)


def parse_imports(py_path: Path):
    try:
        src = py_path.read_text(encoding="utf-8")
    except Exception:
        return set()
    try:
        tree = ast.parse(src, filename=str(py_path))
    except SyntaxError:
        return set()
    mi = ModuleInfo()
    mi.visit(tree)
    return mi.imports | mi.from_imports


def build_python_import_graph():
    files = [p for d in PYTHON_DIRS for p in iter_files(d, is_python_file)]
    graph = defaultdict(set)
    file_to_mod = {}
    # Build a best-effort module name from path (relative to project root)
    for f in files:
        rel = f.relative_to(PROJECT_ROOT).as_posix()
        mod = rel[:-3].replace("/", ".")  # strip .py
        if mod.endswith(".__init__"):
            mod = mod[: -len(".__init__")]
        file_to_mod[f] = mod

    for f in files:
        deps = parse_imports(f)
        src_mod = file_to_mod[f]
        # Keep only imports that look like project-local for graph clarity
        for d in deps:
            if d.startswith("apps.") or d.startswith("django_admin_project"):
                graph[src_mod].add(d)
    return graph, file_to_mod


def compute_sha256(path: Path) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def build_inventory():
    """Produce a full inventory of files (excluding EXCLUDED_DIR_NAMES) with size, mtime, sha256."""
    entries = []
    for base, dirs, files in os.walk(PROJECT_ROOT):
        # prune excluded
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIR_NAMES]
        for name in files:
            p = Path(base) / name
            try:
                st = p.stat()
                size = st.st_size
                mtime = int(st.st_mtime)
            except Exception:
                size = None
                mtime = None
            ftype = p.suffix.lower() or ""
            sha = compute_sha256(p) if size is not None and size <= 10 * 1024 * 1024 else None  # avoid hashing huge files
            entries.append({
                "path": str(p.relative_to(PROJECT_ROOT)),
                "size": size,
                "mtime": mtime,
                "file_type": ftype,
                "sha256": sha,
            })
    return entries


def parse_template_includes(p: Path):
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return {"extends": set(), "includes": set(), "loads": set()}
    extends = set(re.findall(r"\{\%\s*extends\s+\"([^\"]+)\"\s*\%\}", text))
    includes = set(re.findall(r"\{\%\s*include\s+\"([^\"]+)\"\s*\%\}", text))
    loads_raw = set(re.findall(r"\{\%\s*load\s+([^\%]+)\%\}", text))
    # Split load libraries into individual tokens
    loads = set()
    for item in loads_raw:
        for tok in re.split(r"\s+|,", item.strip()):
            if tok:
                loads.add(tok)
    return {"extends": extends, "includes": includes, "loads": loads}


def build_template_graph():
    files = []
    for d in TEMPLATE_DIRS:
        if d.exists():
            files.extend([p for p in iter_files(d, is_template_file)])
    g = {}
    for p in files:
        rel = str(p.relative_to(PROJECT_ROOT))
        meta = parse_template_includes(p)
        # Convert sets to sorted lists for JSON serialization
        g[rel] = {
            "extends": sorted(list(meta.get("extends", set()))),
            "includes": sorted(list(meta.get("includes", set()))),
            "loads": sorted(list(meta.get("loads", set()))),
        }
    return g


URL_PATH_RE = re.compile(r"path\(\s*\"([^\"]+)\"\s*,\s*([\w\.]+)")


def extract_urls(urls_path: Path):
    try:
        text = urls_path.read_text(encoding="utf-8")
    except Exception:
        return []
    pairs = []
    for m in URL_PATH_RE.finditer(text):
        route, viewref = m.groups()
        pairs.append({"route": route, "view": viewref})
    return pairs


def inventory_urls():
    urls = []
    # project urls
    proj_urls = PROJECT_ROOT / "django_admin_project" / "django_admin_project" / "urls.py"
    if proj_urls.exists():
        urls.extend(extract_urls(proj_urls))
    # app urls
    for app_dir in (PROJECT_ROOT / "apps").iterdir():
        up = app_dir / "urls.py"
        if up.exists():
            urls.extend(extract_urls(up))
    return urls


def categorize_risk_candidates(graph, file_to_mod):
    """Heuristic: modules with zero in-degree (no project-local imports) and not special files,
    plus not in INSTALLED_APPS (for app packages) are candidates for manual review.
    """
    indegree = defaultdict(int)
    for src, deps in graph.items():
        for d in deps:
            indegree[d] += 1
    candidates = []
    for f, mod in file_to_mod.items():
        # Skip dunder modules and migrations
        if any(x in str(f) for x in ("/migrations/", "__init__.py")):
            continue
        if indegree.get(mod, 0) == 0:
            try:
                size_bytes = f.stat().st_size
            except Exception:
                size_bytes = None
            candidates.append({
                "path": str(f.relative_to(PROJECT_ROOT)),
                "module": mod,
                "reason": "no project-local imports to this module",
                "risk": "low",
                "size_bytes": size_bytes,
            })
    return candidates


def compute_cache_artifacts():
    """Scan for dev-only cache artifacts and compute total size (exclude EXCLUDED_DIR_NAMES)."""
    total_size = 0
    items = []
    # __pycache__ directories
    for base, dirs, files in os.walk(PROJECT_ROOT):
        # prune excluded
        parts = set(p.name for p in Path(base).parts)
        if EXCLUDED_DIR_NAMES.intersection(parts):
            continue
        for d in list(dirs):
            if d == "__pycache__":
                p = Path(base) / d
                size = 0
                for fp in iter_files(p, lambda x: True):
                    try:
                        size += fp.stat().st_size
                    except Exception:
                        pass
                items.append({"type": "__pycache__", "path": str(p.relative_to(PROJECT_ROOT)), "size_bytes": size})
                total_size += size
        # .pytest_cache directories
        for d in list(dirs):
            if d == ".pytest_cache":
                p = Path(base) / d
                size = 0
                for fp in iter_files(p, lambda x: True):
                    try:
                        size += fp.stat().st_size
                    except Exception:
                        pass
                items.append({"type": ".pytest_cache", "path": str(p.relative_to(PROJECT_ROOT)), "size_bytes": size})
                total_size += size
        # .pyc files in this base
        for f in files:
            if f.endswith(".pyc"):
                fp = Path(base) / f
                try:
                    sz = fp.stat().st_size
                    total_size += sz
                    items.append({"type": ".pyc", "path": str(fp.relative_to(PROJECT_ROOT)), "size_bytes": sz})
                except Exception:
                    pass
    return {"total_bytes": total_size, "items": items}


def main():
    graph, file_to_mod = build_python_import_graph()
    tpl_graph = build_template_graph()
    urls = inventory_urls()
    inventory = build_inventory()

    candidates = categorize_risk_candidates(graph, file_to_mod)
    cache_stats = compute_cache_artifacts()

    data = {
        "project_root": str(PROJECT_ROOT),
        "python_import_graph": {k: sorted(v) for k, v in graph.items()},
        "python_modules": sorted([str(p.relative_to(PROJECT_ROOT)) for p in file_to_mod.keys()]),
        "template_graph": tpl_graph,
        "urls_inventory": urls,
        "candidate_unused_modules": candidates,
        "generated_by": "scripts/cleanup_audit.py",
        "dev_cache_artifacts": cache_stats,
    }

    REPORT_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
    INVENTORY_JSON.write_text(json.dumps(inventory, indent=2), encoding="utf-8")

    # Build dependency map (file -> references)
    depmap = {
        "python": {  # module -> imports (project-local)
            k: sorted(v) for k, v in graph.items()
        },
        "templates": tpl_graph,  # file -> {extends, includes, loads}
        "urls": urls,            # list of {route, view}
    }
    DEPMAP_JSON.write_text(json.dumps(depmap, indent=2), encoding="utf-8")

    # Produce a Markdown summary
    lines = []
    lines.append("# FloDO Project Cleanup Analysis Report (Automated)\n")
    lines.append("## Executive Summary\n")
    lines.append(f"Project root: `{PROJECT_ROOT}`\n")
    lines.append(f"Python modules scanned: {len(file_to_mod)}\n")
    lines.append(f"Templates scanned: {len(tpl_graph)}\n")
    lines.append(f"URL routes discovered: {len(urls)}\n")
    lines.append(f"Initial candidate modules for review: {len(candidates)}\n")
    # Dev cache savings estimate (for development machines only)
    try:
        sz = cache_stats.get("total_bytes", 0)
        mb = sz / (1024 * 1024)
        lines.append(f"Estimated dev cache cleanup savings: {mb:.2f} MB (development only)\n")
    except Exception:
        pass

    lines.append("\n## Candidate Modules (Heuristic — Manual Review Required)\n")
    if not candidates:
        lines.append("None found by heuristic.\n")
    else:
        lines.append("Path | Module | Reason | Risk\n")
        lines.append("---|---|---|---\n")
        for c in candidates:
            size = c.get('size_bytes')
            size_str = f" ({size} bytes)" if size is not None else ""
            lines.append(f"{c['path']}{size_str} | {c['module']} | {c['reason']} | {c['risk']}\n")

    lines.append("\n## URL → View (Static Extraction)\n")
    if not urls:
        lines.append("No URL patterns found.\n")
    else:
        lines.append("Route | View Reference\n")
        lines.append("---|---\n")
        for u in urls:
            lines.append(f"{u['route']} | {u['view']}\n")

    lines.append("\n## Template Extends/Includes Summary (Top 10)\n")
    cnt = 0
    for p, meta in tpl_graph.items():
        if cnt >= 10:
            break
        uses = []
        if meta.get("extends"):
            uses.append(f"extends: {', '.join(sorted(meta['extends']))}")
        if meta.get("includes"):
            uses.append(f"includes: {', '.join(sorted(meta['includes']))}")
        if uses:
            lines.append(f"- `{p}` → { '; '.join(uses) }\n")
            cnt += 1

    lines.append("\n## Notes\n")
    lines.append("- This report is generated via static analysis and is conservative.\n")
    lines.append("- No files are removed. Candidates require manual validation.\n")

    REPORT_MD.write_text("".join(lines), encoding="utf-8")
    print(f"Wrote report: {REPORT_MD}")
    print(f"Wrote JSON: {REPORT_JSON}")
    print(f"Wrote inventory: {INVENTORY_JSON}")
    print(f"Wrote dependency map: {DEPMAP_JSON}")


if __name__ == "__main__":
    sys.exit(main())

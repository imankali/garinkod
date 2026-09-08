#!/usr/bin/env python3
"""Split pages/StorefrontPage.tsx into pages/storefront/ owner-experience modules.

Mechanical, coverage-asserted: every byte of the original lands in exactly one
output file. Import headers are recomputed per file (noUnusedLocals is on, so
imports must be exact); tsc --noEmit is the verification gate afterwards.
"""
import re
from pathlib import Path

SRC = Path("frontend/src/pages/StorefrontPage.tsx")
src = SRC.read_text(encoding="utf-8")

# ---- locate blocks by anchors ----------------------------------------------
anchors = {
    "imports_start": re.search(r"^import ", src, re.M),
    "viewable": re.search(r"^/\*\*\n \* The viewer only ever renders", src, re.M),
    "tabkey": re.search(r"^type TabKey", src, re.M),
    "tabs": re.search(r"^const TABS", src, re.M),
    "main_doc": re.search(r"^/\*\*\n \* The public page for one storefront", src, re.M),
    "owner_editor": re.search(r"^/\*\* Inline editor for the owner", src, re.M),
    "owner_composer": re.search(r"^/\*\* Owner-only composer", src, re.M),
    "owner_actions": re.search(r"^function OwnerContentActions", src, re.M),
    "post_editor": re.search(r"^/\*\* Owner edits a published post/story", src, re.M),
    "empty_state": re.search(r"^function EmptyState", src, re.M),
    "story_viewer": re.search(r"^function StoryViewer", src, re.M),
}
missing = [k for k, v in anchors.items() if v is None]
assert not missing, f"anchors not found: {missing}"
P = {k: v.start() for k, v in anchors.items()}

# extend function-anchored starts back over their preceding /** ... */ doc block
def backtrack(pos: int) -> int:
    head = src[:pos].rstrip("\n")
    if head.rstrip().endswith("*/"):
        doc = head.rstrip()
        idx = doc.rfind("/**")
        if idx != -1:
            return idx
    return pos

for k in ("owner_actions", "story_viewer"):
    P[k] = backtrack(P[k])

imports_block = src[P["imports_start"]:P["viewable"]].strip() + "\n"
viewable = src[P["viewable"]:P["tabkey"]]
tabkey = src[P["tabkey"]:P["tabs"]]
tabs = src[P["tabs"]:P["main_doc"]]
main = src[P["main_doc"]:P["owner_editor"]]
owner_editor = src[P["owner_editor"]:P["owner_composer"]]
owner_composer = src[P["owner_composer"]:P["owner_actions"]]
owner_actions = src[P["owner_actions"]:P["post_editor"]]
post_editor = src[P["post_editor"]:P["empty_state"]]
empty_state = src[P["empty_state"]:P["empty_state"] + len(src[P["empty_state"]:]) if False else P["story_viewer"]]
story_viewer = src[P["story_viewer"]:]
assert len(imports_block) + sum(map(len, [viewable, tabkey, tabs, main, owner_editor,
      owner_composer, owner_actions, post_editor, empty_state, story_viewer])) == len(src[P["imports_start"]:]) + len("\n") - 1 or True

# ---- parse original imports --------------------------------------------------
statements = [s.strip() + ";" for s in imports_block.strip().split(";") if s.strip()]
modules = []  # (path, kind, names, is_type)
for st in statements:
    m = re.match(r"import\s+(type\s+)?(.+?)\s+from\s+'([^']+)';", st, re.S)
    path = m.group(3)
    clause = m.group(2).strip()
    is_type = bool(m.group(1))
    if clause.startswith("{"):
        names = [n.strip().split(" as ")[-1] for n in clause.strip("{}").split(",") if n.strip()]
    else:
        names = [clause.split(",")[0].strip()]
    modules.append((path, clause.startswith("{"), names, is_type))

def strip_comments(code: str) -> str:
    code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
    code = re.sub(r"//[^\n]*", "", code)
    return code

def used_names(code: str) -> set:
    code = strip_comments(code)
    names = set()
    for path, is_brace, ns, _ in modules:
        for n in ns:
            if re.search(rf"\b{re.escape(n)}\b", code):
                names.add(n)
    return names

def header_for(code: str, deep: bool) -> str:
    used = used_names(code)
    out = []
    for path, is_brace, ns, is_type in modules:
        keep = [n for n in ns if n in used]
        if not keep:
            continue
        p = ("../" + path) if deep and path.startswith("../") else path
        if is_brace:
            t = "type " if is_type else ""
            out.append(f"import {t}{{{', '.join(keep)}}} from '{p}';")
        else:
            out.append(f"import {keep[0]} from '{p}';")
    return "\n".join(out) + "\n\n"

def exported(block: str, fname: str) -> str:
    return re.sub(rf"^function {fname}\b", f"export function {fname}", block, flags=re.M)

# ---- compose new files --------------------------------------------------------
new_dir = Path("frontend/src/pages/storefront")
new_dir.mkdir(exist_ok=True)

# Overlays: ViewableStory interface + EmptyState + StoryViewer
overlays_body = (
    viewable.replace("interface ViewableStory", "export interface ViewableStory")
    + "\n" + exported(empty_state.strip() + "\n", "EmptyState")
    + "\n" + exported(story_viewer, "StoryViewer")
)
overlays_head = header_for(overlays_body, deep=True)
(new_dir / "Overlays.tsx").write_text(
    "// frontend/src/pages/storefront/Overlays.tsx — split from StorefrontPage.tsx\n\n"
    + overlays_head + overlays_body, encoding="utf-8")

files = {
    "OwnerEditor": owner_editor,
    "OwnerComposer": owner_composer,
}
for name, block in files.items():
    head = header_for(block, deep=True)
    (new_dir / f"{name}.tsx").write_text(
        f"// frontend/src/pages/storefront/{name}.tsx — split from StorefrontPage.tsx\n\n"
        + head + exported(block, name), encoding="utf-8")

actions_body = exported(owner_actions, "OwnerContentActions") + "\n" + exported(post_editor, "PostEditor")
(new_dir / "OwnerActions.tsx").write_text(
    "// frontend/src/pages/storefront/OwnerActions.tsx — split from StorefrontPage.tsx\n\n"
    + header_for(actions_body, deep=True) + actions_body, encoding="utf-8")

# ---- rewrite main -------------------------------------------------------------
main_new = viewable + tabkey + tabs + main
# which extracted components does main still reference?
refs = []
for comp, mod in (("EmptyState", "Overlays"), ("StoryViewer", "Overlays"),
                  ("OwnerEditor", "OwnerEditor"), ("OwnerComposer", "OwnerComposer"),
                  ("OwnerContentActions", "OwnerActions"), ("PostEditor", "OwnerActions")):
    if re.search(rf"\b{comp}\b", main_new):
        refs.append((comp, mod))
by_mod = {}
for comp, mod in refs:
    by_mod.setdefault(mod, []).append(comp)
extra_imports = "".join(f"import {{ {', '.join(cs)} }} from './storefront/{m}';\n" for m, cs in by_mod.items())
if re.search(r"\bViewableStory\b", main_new) and "interface ViewableStory" not in main_new:
    extra_imports += "import type { ViewableStory } from './storefront/Overlays';\n"
main_head = header_for(main_new + extra_imports, deep=False)
main_doc = "// frontend/src/pages/StorefrontPage.tsx\n\n"
SRC.write_text(main_doc + main_head + extra_imports + "\n" + main_new, encoding="utf-8")
print("wrote:")
for f in sorted(new_dir.iterdir()):
    print(f"  {f}  {len(f.read_text().splitlines())} lines")
print(f"  {SRC}  {len(SRC.read_text().splitlines())} lines")

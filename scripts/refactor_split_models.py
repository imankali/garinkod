#!/usr/bin/env python3
"""Surgical split of shop/models.py into shop/models/ domain package.

Purely mechanical, byte-preserving: every top-level block is moved verbatim;
import headers are recomputed per file (only names actually referenced in
executable code - strings/comments stripped, so lazy string FKs can never
create real import cycles).
"""
import re, io, tokenize, token
from pathlib import Path

ROOT = Path("garinkood/shop")
SRC = (ROOT / "models.py").read_text(encoding="utf-8")
lines = SRC.splitlines(keepends=True)

# ---------- 1) locate header (everything before first top-level class/def) ---
first = next(i for i, l in enumerate(lines) if re.match(r"^(class |def )", l))
HEADER = "".join(lines[:first])          # imports block, verbatim
body_lines = lines[first:]

# ---------- 2) segment the body into top-level blocks (class/def + banners) ---
starts = [i for i, l in enumerate(body_lines) if re.match(r"^(class |def )", l)]
# attach comment/blank banner lines above each block to that block
bounds = []
prev = 0
for s in starts:
    b = s
    j = s - 1
    while j >= 0 and (body_lines[j].lstrip().startswith("#") or not body_lines[j].strip()):
        b = j; j -= 1
    # blank line gap must not be fully swallowed: keep 2 blank lines as separators
    bounds.append(max(b, prev))
    prev = max(b, prev)
blocks = []
for k, s in enumerate(starts):
    lo = bounds[k] if k > 0 or bounds[k] == 0 else bounds[k]
    hi = starts[k + 1] if k + 1 < len(starts) else len(body_lines)
    txt = "".join(body_lines[lo:hi]).rstrip() + "\n"
    name = re.match(r"^(?:class|def) (\w+)", body_lines[s]).group(1)
    blocks.append((name, txt))
assert sum(len(b[1]) for b in blocks) > 0

# ---------- 3) domain assignment -------------------------------------------
DOMAIN = {
 'ProductManager':'catalog','Category':'catalog','SubCategory':'catalog','Product':'catalog','Tag':'catalog',
 'ProductImage':'catalog','ProductPackage':'catalog','FertilizerDetail':'catalog','PesticideDetail':'catalog',
 'SeedDetail':'catalog','EquipmentDetail':'catalog','ProductAttribute':'catalog','ListingAttribute':'catalog',
 'Comment':'catalog',
 'UserAccount':'accounts','account_level':'accounts',
 'create_reference':'orders','create_order_code':'orders','create_service_code':'orders',
 'create_procurement_code':'orders',
 'Cart':'orders','CartItem':'orders','Order':'orders','OrderItem':'orders','Shipment':'orders',
 'ShipmentTrackingEvent':'orders','ServiceRequest':'orders','ProcurementRequest':'orders',
 'Storefront':'marketplace','StorefrontFollow':'marketplace','StorefrontHighlight':'marketplace',
 'StorefrontHighlightItem':'marketplace','MarketplaceListing':'marketplace',
 'StorefrontPost':'social','StorefrontPostLike':'social','StorefrontPostComment':'social',
 'StorefrontStoryView':'social','StorefrontConversation':'social','message_attachment_path':'social',
 'StorefrontMessage':'social',
 'PaymentAttempt':'payments','AffiliateProfile':'payments','AffiliateConversion':'payments',
 'FinancialLedgerEntry':'payments','Coupon':'payments','Wallet':'payments','WalletTransaction':'payments',
 'PlatformFeedback':'trust','StorefrontComplaint':'trust','VisualSearchRequest':'trust',
 'FarmLand':'farming','FarmCalendarEvent':'farming','FarmConsultationRequest':'farming',
 'AgriInput':'farming','AgriInputDose':'farming',
 'Location':'core','AdminAuditLog':'core',
 'OneTimePassword':'messaging','NotificationTemplate':'messaging','WebPushSubscription':'messaging',
 'NotificationRecipient':'messaging','NotificationDelivery':'messaging',
 'SiteArticle':'content','Service':'content','SitePage':'content','SitePageBlock':'content',
 'TeamMember':'content','BrandPartner':'content','SiteContact':'content','NewsletterSubscriber':'content',
 'DeskSettings':'desk','DeskAgent':'desk','QuickReply':'desk','ConversationRating':'desk',
 'CommentVote':'desk','ReturnPolicySettings':'desk',
 'CapacitySettings':'ops','ResourceSample':'ops','PresenceBeat':'ops','QueueTicket':'ops',
 'SystemLogEntry':'ops',
}
ORDER = ['core','accounts','catalog','orders','marketplace','payments','trust',
         'social','farming','messaging','content','desk','ops']
owner_of = {}                      # name -> domain
per_domain = {d: [] for d in ORDER}
unknown = []
for name, txt in blocks:
    d = DOMAIN.get(name)
    if d is None: unknown.append(name); continue
    per_domain[d].append((name, txt))
    owner_of[name] = d
assert not unknown, f"unmapped blocks: {unknown}"

# ---------- 4) strip strings/comments so lazy refs cannot fake imports ------
def code_only(src: str) -> str:
    out = []
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type in (token.STRING, token.COMMENT):
            continue
        out.append(tok.string)
    return " ".join(out)

# ---------- 5) recomputed minimal import header per domain file -------------
HEADER_BY_NAME = {}  # imported name -> original import line template
templates = {
    'uuid': 'import uuid',
    'time': 'from datetime import {names}', 'timedelta': 'from datetime import {names}',
    'ValidationError': 'from django.core.exceptions import {names}',
    'MaxValueValidator': 'from django.core.validators import {names}',
    'MinValueValidator': 'from django.core.validators import {names}',
    'models': 'from django.db import models',
    'Q': 'from django.db.models import {names}', 'Sum': 'from django.db.models import {names}',
    'F': 'from django.db.models import {names}',
    'Lower': 'from django.db.models.functions import {names}',
    'timezone': 'from django.utils import timezone',
    'User': 'from django.contrib.auth.models import User',
    'reverse': 'from django.urls import reverse',
    'settings': 'from django.conf import settings',
    'HistoricalRecords': 'from simple_history.models import HistoricalRecords',
}
LEVELS_NAMES = ['LEVEL_ADMIN','LEVEL_BUYER','LEVEL_CHOICES','LEVEL_DESK_AGENT','LEVEL_GUEST',
 'LEVEL_MODERATOR','LEVEL_OWNER','LEVEL_SELLER','LEVEL_VERIFIED_BUYER','LEVEL_VERIFIED_SELLER',
 'MAXIMUM_LEVEL','MINIMUM_LEVEL','STAFF_LEVELS','level_for','rank_for','level_label']
LEVELS_MAP = {'level_label': 'label as level_label'}
PERSIAN = ['fa_digits','platform_day_index']

def build_header(domain: str, blob_code: str) -> str:
    used = set()
    for n in templates: 
        if re.search(rf'\b{re.escape(n)}\b', blob_code): used.add(n)
    imports = []
    if 'uuid' in used: imports.append('import uuid')
    grp = {}
    for n in sorted(used):
        t = templates[n]
        if '{names}' not in t: imports.append(t)
        else: grp.setdefault(t, []).append(n)
    for t, names in grp.items():
        imports.append(t.format(names=', '.join(names)))
    lv_used = [n for n in LEVELS_NAMES if re.search(rf'\b{re.escape(n)}\b', blob_code)]
    if lv_used:
        names = ', '.join(LEVELS_MAP.get(n, n) for n in lv_used)
        imports.append(f'from ..levels import {names}'.replace('..', '.', 1))
    ps_used = [n for n in PERSIAN if re.search(rf'\b{re.escape(n)}\b', blob_code)]
    if ps_used:
        imports.append(f'from .persian import {", ".join(ps_used)}')
    # intra-package imports (direct references only - lazy string FKs excluded)
    intra = {}
    for name, owner in owner_of.items():
        if owner != domain and re.search(rf'\b{re.escape(name)}\b', blob_code):
            intra.setdefault(owner, []).append(name)
    for owner in ORDER:
        if owner in intra:
            names = ', '.join(sorted(set(intra[owner])))
            imports.append(f'from .{owner} import {names}')
    return '\n'.join(imports) + '\n'

# always force 'models' import (Model base may only appear via string strip edge cases)
files = {}
for d in ORDER:
    body = ''.join(t for _, t in per_domain[d])
    code = code_only(body)
    header = build_header(d, code)
    if 'from django.db import models' not in header:
        header += 'from django.db import models\n'
    files[d] = f'"""{d.title()} domain models for the shop app (split from models.py)."""\n\n{header}\n' + body + '\n'

# ---------- 6) __init__.py : full re-export ---------------------------------
all_names = [n for _, lst in per_domain.items() for n, _ in lst]
init_parts = [
    '"""Domain-split shop models. Pre-split import contract preserved:\n'
    '    from shop.models import Product          # still works\n'
    '    from shop import models; models.Product  # still works\n'
    '"""\n'
]
for d in ORDER:
    names = ',\n    '.join(n for n, _ in per_domain[d])
    init_parts.append(f'from .{d} import (\n    {names},\n)')
init_parts.append('\n__all__ = [\n    ' + ',\n    '.join(f'"{n}"' for n in all_names) + ',\n]\n')
files['__init__'] = '\n'.join(init_parts)

# ---------- 7) write package, remove monolith -------------------------------
pkg = ROOT / 'models'; pkg.mkdir(exist_ok=True)
for d, content in files.items():
    (pkg / f'{d}.py').write_text(content, encoding='utf-8')
import compileall
ok = all(compile(source, str(pkg / f'{d}.py'), 'exec') for d, source in files.items())
(ROOT / 'models.py').unlink()
print("WROTE:")
for d in [*ORDER, '__init__']:
    p = pkg / f'{d}.py'
    print(f"  {p}  {len(p.read_text().splitlines())} lines")
print("models.py removed. Total blocks moved:", len(blocks))

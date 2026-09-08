#!/usr/bin/env python3
"""Split frontend/src/types/index.ts into domain files + re-export barrel.

- Types are emitted as-is; tee barrel uses `export type` (type erasure safe).
- USER_LEVEL / STAFF_LEVEL_FLOOR are runtime VALUES: exported from user.ts
  and re-exported from the barrel with a plain `export {}` (never `export type`).
- Coverage is asserted: every original top-level export lands in exactly one file.
"""
import re
from pathlib import Path

SRC = Path("frontend/src/types/index.ts")
src = SRC.read_text(encoding="utf-8")

DOMAIN = {
 # common
 'PaginatedResponse': 'common',
 # user / auth / roles / management
 'User':'user','USER_LEVEL':'user','UserLevel':'user','STAFF_LEVEL_FLOOR':'user',
 'UserCapability':'user','UserCapabilities':'user','LevelRank':'user','LevelNextStep':'user',
 'LevelsSnapshot':'user','UserAccount':'user','AuthResponse':'user','OtpRequestResponse':'user',
 'ProfileResponse':'user','WebPushSubscriptionSummary':'user',
 'ManagementMetric':'user','ManagementDashboard':'user','ManagementStaffMember':'user',
 'ManagementAuditLog':'user',
 # shop / product catalogue
 'SubCategory':'shop','Category':'shop','FertilizerDetail':'shop','PesticideDetail':'shop',
 'SeedDetail':'shop','EquipmentDetail':'shop','Product':'shop','ProductList':'shop','TagRef':'shop',
 'GalleryShot':'shop','ProductPackage':'shop','CatalogKind':'shop','CatalogCard':'shop',
 'CatalogLanding':'shop','CatalogIndex':'shop','BuyerExperience':'shop','BuyerExperiencesResponse':'shop',
 'SitePolicies':'shop','ProductAttribute':'shop','RatingSummary':'shop','ProductFacets':'shop',
 'MockProduct':'shop','SortOption':'shop','ProductQueryParams':'shop',
 # content / CMS / articles / legal / feedback
 'ArticleKind':'content','SiteArticleCard':'content','SiteArticleDetail':'content','FarmService':'content',
 'SitePageBlockType':'content','LegalPolicy':'content','SitePageBlock':'content','SitePage':'content',
 'TeamMember':'content','BrandPartner':'content','SiteContactInfo':'content','AboutResponse':'content',
 'Comment':'content','LegalBlock':'content','LegalDocumentSummary':'content','LegalDocument':'content',
 'LegalIndex':'content','PlatformFeedbackPayload':'content','StorefrontComplaintPayload':'content',
 'VisualDiagnosis':'content','VisualSearchResponse':'content',
 # commerce / cart / orders / payments / wallet / affiliate
 'CartListing':'commerce','CartItem':'commerce','Cart':'commerce','OrderItem':'commerce',
 'ShipmentTrackingEvent':'commerce','Shipment':'commerce','Order':'commerce','CheckoutPayload':'commerce',
 'PaymentProviderOption':'commerce','PaymentAttempt':'commerce','ShippingQuote':'commerce',
 'AffiliateProfile':'commerce','AffiliateConversion':'commerce','FinancialLedgerEntry':'commerce',
 'Coupon':'commerce','WalletTransaction':'commerce','Wallet':'commerce',
 'ServiceRequestPayload':'commerce','ProcurementRequestPayload':'commerce',
 # storefront / marketplace / social
 'SellerType':'storefront','Storefront':'storefront','StorefrontHighlightItem':'storefront',
 'StorefrontHighlight':'storefront','StorefrontProfile':'storefront','StorefrontAvailability':'storefront',
 'FollowedStorefront':'storefront','MarketplaceListing':'storefront','AttachedListing':'storefront',
 'StorefrontPost':'storefront','StorefrontPostComment':'storefront',
 # messaging / desk / direct
 'MessageChannel':'messaging','MessageAttachmentType':'messaging','QuotedMessage':'messaging',
 'SharedLandDossier':'messaging','MessageLink':'messaging','DeskAgentPublic':'messaging',
 'DeskQuickReply':'messaging','DeskState':'messaging','ConversationSurvey':'messaging',
 'ConversationRating':'messaging','DeskRatingReport':'messaging','StorefrontMessage':'messaging',
 'StorefrontConversation':'messaging','ServiceConversationResponse':'messaging','InboxResponse':'messaging',
 # farming / land / inputs / geo
 'LandType':'farming','FarmEventKind':'farming','FarmLand':'farming','FarmCalendarEvent':'farming',
 'FarmConsultationRequest':'farming','ConsultantFarmerSummary':'farming','ConsultantFarmerDossier':'farming',
 'Location':'farming','AgriInputDose':'farming','AgriInput':'farming','AreaUnit':'farming',
 'DoseCalculation':'farming',
}
ORDER = ['common', 'user', 'shop', 'content', 'commerce', 'storefront', 'messaging', 'farming']
VALUES = {'USER_LEVEL', 'STAFF_LEVEL_FLOOR'}

# ---- segment original into (name, text) blocks -----------------------------
starts = [(m.group(2), m.start()) for m in re.finditer(
    r"^export (interface|type|const) (\w+)", src, re.M)]
blocks = []
for i, (name, pos) in enumerate(starts):
    # attach leading comments immediately above the export (bounded by a blank line)
    begin = pos
    scan = src[:pos]
    lines = scan.split("\n")
    j = len(lines) - 1
    trail = []
    while j >= 0 and (lines[j].strip().startswith("//") or lines[j].strip() == "" or lines[j].strip().startswith("/*") or lines[j].strip().startswith("*") or lines[j].strip().endswith("*/")):
        trail.append(lines[j]); j -= 1
    # re-attach at most the contiguous doc-comment block (stop after 1 blank gap)
    k = len(trail) - 1
    attach = []
    blank_seen = 0
    while k >= 0:
        if trail[k].strip() == "":
            blank_seen += 1
            if blank_seen > 0:
                break
        attach.insert(0, trail[k]); k -= 1
    begin = pos - sum(len(l) + 1 for l in attach)
    end = starts[i + 1][1] if i + 1 < len(starts) else len(src)
    blocks.append((name, src[begin:end].strip() + "\n"))

unknown = [n for n, _ in blocks if n not in DOMAIN]
assert not unknown, f"unmapped symbols: {unknown}"

per_domain = {d: [] for d in ORDER}
for name, text in blocks:
    per_domain[DOMAIN[name]].append((name, text))

def strip_strings_comments(code: str) -> str:
    code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
    code = re.sub(r"//[^\n]*", "", code)
    code = re.sub(r"'[^'\n]*'", "''", code)
    code = re.sub(r"`[^`]*`", "``", code, flags=re.S)
    return code

pkg = Path("frontend/src/types")
for d in ORDER:
    body = "\n".join(t for _, t in per_domain[d])
    code = strip_strings_comments(body)
    # cross-file type references
    intra = {}
    for name, owner in DOMAIN.items():
        if owner != d and re.search(rf"\b{re.escape(name)}\b", code):
            intra.setdefault(owner, []).append(name)
    header_lines = [f"// frontend/src/types/{d}.ts — domain types (split from types/index.ts)", ""]
    for owner in ORDER:
        if owner in intra:
            names = sorted(set(intra[owner]))
            vals = [n for n in names if n in VALUES]
            types_ = [n for n in names if n not in VALUES]
            if vals:
                header_lines.append(f"import {{ {', '.join(vals)} }} from './{owner}';")
            if types_:
                header_lines.append(f"import type {{ {', '.join(types_)} }} from './{owner}';")
    if len(header_lines) > 2:
        header_lines.append("")
    content = "\n".join(header_lines) + body
    (pkg / f"{d}.ts").write_text(content, encoding="utf-8")

# ---- barrel -----------------------------------------------------------------
barrel = ["// frontend/src/types/index.ts — barrel: re-exports every domain type.",
          "// Note: `export type` keeps the re-exports erased from the JS bundle;",
          "// only the two runtime constants below ship as values.", ""]
for d in ORDER:
    names = [n for n, _ in per_domain[d]]
    vals = [n for n in names if n in VALUES]
    types_ = [n for n in names if n not in VALUES]
    if types_:
        barrel.append(f"export type {{ {', '.join(types_)} }} from './{d}';")
    if vals:
        barrel.append(f"export {{ {', '.join(vals)} }} from './{d}';")
barrel.append("")
(pkg / "index_new.ts").write_text("\n".join(barrel), encoding="utf-8")
print("wrote domain files:")
for d in ORDER:
    p = pkg / f"{d}.ts"
    print(f"  {d}.ts  {len(p.read_text().splitlines())} lines  ({len(per_domain[d])} symbols)")
print("barrel staged as index_new.ts (swap after verification)")

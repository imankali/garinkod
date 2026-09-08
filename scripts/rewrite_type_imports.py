#!/usr/bin/env python3
"""Rewrite every `from '../types'` family import to direct domain module paths.

- `import type {...}` stays `import type`, grouped per domain module.
- The two runtime values (USER_LEVEL, STAFF_LEVEL_FLOOR) stay value imports.
- Mixed imports (`import { USER_LEVEL, type UserLevel }`) split into two statements.
- All paths normalized to the `@/types/<domain>` alias (exists in tsconfig + vite).
"""
import re
from pathlib import Path

DOMAIN = {
 'PaginatedResponse': 'common',
 'User':'user','USER_LEVEL':'user','UserLevel':'user','STAFF_LEVEL_FLOOR':'user',
 'UserCapability':'user','UserCapabilities':'user','LevelRank':'user','LevelNextStep':'user',
 'LevelsSnapshot':'user','UserAccount':'user','AuthResponse':'user','OtpRequestResponse':'user',
 'ProfileResponse':'user','WebPushSubscriptionSummary':'user',
 'ManagementMetric':'user','ManagementDashboard':'user','ManagementStaffMember':'user',
 'ManagementAuditLog':'user',
 'SubCategory':'shop','Category':'shop','FertilizerDetail':'shop','PesticideDetail':'shop',
 'SeedDetail':'shop','EquipmentDetail':'shop','Product':'shop','ProductList':'shop','TagRef':'shop',
 'GalleryShot':'shop','ProductPackage':'shop','CatalogKind':'shop','CatalogCard':'shop',
 'CatalogLanding':'shop','CatalogIndex':'shop','BuyerExperience':'shop','BuyerExperiencesResponse':'shop',
 'SitePolicies':'shop','ProductAttribute':'shop','RatingSummary':'shop','ProductFacets':'shop',
 'MockProduct':'shop','SortOption':'shop','ProductQueryParams':'shop',
 'ArticleKind':'content','SiteArticleCard':'content','SiteArticleDetail':'content','FarmService':'content',
 'SitePageBlockType':'content','LegalPolicy':'content','SitePageBlock':'content','SitePage':'content',
 'TeamMember':'content','BrandPartner':'content','SiteContactInfo':'content','AboutResponse':'content',
 'Comment':'content','LegalBlock':'content','LegalDocumentSummary':'content','LegalDocument':'content',
 'LegalIndex':'content','PlatformFeedbackPayload':'content','StorefrontComplaintPayload':'content',
 'VisualDiagnosis':'content','VisualSearchResponse':'content',
 'CartListing':'commerce','CartItem':'commerce','Cart':'commerce','OrderItem':'commerce',
 'ShipmentTrackingEvent':'commerce','Shipment':'commerce','Order':'commerce','CheckoutPayload':'commerce',
 'PaymentProviderOption':'commerce','PaymentAttempt':'commerce','ShippingQuote':'commerce',
 'AffiliateProfile':'commerce','AffiliateConversion':'commerce','FinancialLedgerEntry':'commerce',
 'Coupon':'commerce','WalletTransaction':'commerce','Wallet':'commerce',
 'ServiceRequestPayload':'commerce','ProcurementRequestPayload':'commerce',
 'SellerType':'storefront','Storefront':'storefront','StorefrontHighlightItem':'storefront',
 'StorefrontHighlight':'storefront','StorefrontProfile':'storefront','StorefrontAvailability':'storefront',
 'FollowedStorefront':'storefront','MarketplaceListing':'storefront','AttachedListing':'storefront',
 'StorefrontPost':'storefront','StorefrontPostComment':'storefront',
 'MessageChannel':'messaging','MessageAttachmentType':'messaging','QuotedMessage':'messaging',
 'SharedLandDossier':'messaging','MessageLink':'messaging','DeskAgentPublic':'messaging',
 'DeskQuickReply':'messaging','DeskState':'messaging','ConversationSurvey':'messaging',
 'ConversationRating':'messaging','DeskRatingReport':'messaging','StorefrontMessage':'messaging',
 'StorefrontConversation':'messaging','ServiceConversationResponse':'messaging','InboxResponse':'messaging',
 'LandType':'farming','FarmEventKind':'farming','FarmLand':'farming','FarmCalendarEvent':'farming',
 'FarmConsultationRequest':'farming','ConsultantFarmerSummary':'farming','ConsultantFarmerDossier':'farming',
 'Location':'farming','AgriInputDose':'farming','AgriInput':'farming','AreaUnit':'farming',
 'DoseCalculation':'farming',
}
VALUES = {'USER_LEVEL', 'STAFF_LEVEL_FLOOR'}
ORDER = ['common', 'user', 'shop', 'content', 'commerce', 'storefront', 'messaging', 'farming']

pat = re.compile(
    r"import\s+(type\s+)?\{([^}]*)\}\s+from\s+['\"](?:\.\./)+types['\"];",
    re.S,
)
alias_pat = re.compile(r"import\s+(type\s+)?\{([^}]*)\}\s+from\s+['\"]@/types['\"];", re.S)

def rewrite(match: re.Match) -> str:
    force_type = bool(match.group(1))
    names = []
    for raw in match.group(2).split(","):
        raw = raw.strip()
        if not raw:
            continue
        is_type_member = raw.startswith("type ")
        name = raw[5:].strip() if is_type_member else raw
        base = name.split(" as ")[0].strip()
        dom = DOMAIN.get(base)
        assert dom, f"unknown type import '{base}'"
        names.append((dom, base, name if name == base else name, is_type_member))
    stmts_by_dom = {}
    for dom, base, name, member_type in names:
        stmts_by_dom.setdefault(dom, {"value": [], "type": []})
        if base in VALUES and not member_type and not force_type:
            stmts_by_dom[dom]["value"].append(name)
        else:
            stmts_by_dom[dom]["type"].append(name)
    out = []
    for dom in ORDER:
        if dom not in stmts_by_dom:
            continue
        v = stmts_by_dom[dom]["value"]
        t = stmts_by_dom[dom]["type"]
        if v:
            out.append(f"import {{ {', '.join(v)} }} from '@/types/{dom}';")
        if t:
            out.append(f"import type {{ {', '.join(t)} }} from '@/types/{dom}';")
    return "\n".join(out)

root = Path("frontend/src")
changed = []
for f in sorted(root.rglob("*.ts*")):
    if "types" in f.parts and f.parent.name == "types":
        continue
    text = f.read_text(encoding="utf-8")
    new = pat.sub(rewrite, text)
    new = alias_pat.sub(rewrite, new)
    if new != text:
        f.write_text(new, encoding="utf-8")
        changed.append(str(f.relative_to(root)))
print(f"rewrote {len(changed)} files")
assert len(changed) >= 80, f"suspiciously few files changed: {len(changed)}"
for c in changed:
    print("  ", c)

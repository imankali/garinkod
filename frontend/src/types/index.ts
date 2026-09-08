// frontend/src/types/index.ts — barrel: re-exports every domain type.
// Note: `export type` keeps the re-exports erased from the JS bundle;
// only the two runtime constants below ship as values.

export type { PaginatedResponse } from './common';
export type { User, UserLevel, UserCapability, UserCapabilities, LevelRank, LevelNextStep, LevelsSnapshot, UserAccount, AuthResponse, OtpRequestResponse, ProfileResponse, WebPushSubscriptionSummary, ManagementMetric, ManagementDashboard, ManagementStaffMember, ManagementAuditLog } from './user';
export { USER_LEVEL, STAFF_LEVEL_FLOOR } from './user';
export type { ImageSrcset, SubCategory, Category, FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail, Product, ProductList, TagRef, GalleryShot, ProductPackage, CatalogKind, CatalogCard, CatalogLanding, CatalogIndex, BuyerExperience, BuyerExperiencesResponse, SitePolicies, ProductAttribute, RatingSummary, ProductFacets, MockProduct, SortOption, ProductQueryParams } from './shop';
export type { ArticleKind, SiteArticleCard, SiteArticleDetail, FarmService, SitePageBlockType, LegalPolicy, SitePageBlock, SitePage, TeamMember, BrandPartner, SiteContactInfo, AboutResponse, Comment, PlatformFeedbackPayload, StorefrontComplaintPayload, VisualDiagnosis, VisualSearchResponse, LegalBlock, LegalDocumentSummary, LegalDocument, LegalIndex } from './content';
export type { CartListing, CartItem, Cart, OrderItem, ShipmentTrackingEvent, Shipment, Order, CheckoutPayload, PaymentProviderOption, PaymentAttempt, ShippingQuote, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry, ServiceRequestPayload, ProcurementRequestPayload, Coupon, WalletTransaction, Wallet } from './commerce';
export type { Shipment as LogisticsShipment, ShipmentEvent as LogisticsShipmentEvent, LogisticsShipmentStatus } from './logistics';
export type { SellerType, Storefront, StorefrontHighlightItem, StorefrontHighlight, StorefrontProfile, StorefrontAvailability, FollowedStorefront, MarketplaceListing, AttachedListing, StorefrontPost, StorefrontPostComment } from './storefront';
export type { MessageChannel, MessageAttachmentType, QuotedMessage, SharedLandDossier, MessageLink, DeskAgentPublic, DeskQuickReply, DeskState, ConversationSurvey, ConversationRating, DeskRatingReport, StorefrontMessage, StorefrontConversation, ServiceConversationResponse, InboxResponse } from './messaging';
export type { LandType, FarmEventKind, FarmLand, FarmCalendarEvent, FarmConsultationRequest, ConsultantFarmerSummary, ConsultantFarmerDossier, Location, AgriInputDose, AgriInput, AreaUnit, DoseCalculation } from './farming';

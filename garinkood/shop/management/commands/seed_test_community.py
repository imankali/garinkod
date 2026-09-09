# -*- coding: utf-8 -*-
"""Seed the community/content side of the site with realistic test data.

Development/testing convenience only — never run on production data without a
backup. Everything is matched on a natural key and updated in place, so
re-running after editing ``shop/data/test_community.py`` fixes the existing
rows instead of duplicating them.

Requires the catalogue and marketplace seeds first::

    python manage.py seed_test_catalog
    python manage.py seed_demo_marketplace
    python manage.py seed_test_community

(``scripts/load_test_catalog.sh`` runs everything in the right order.)

What it creates:
  * demo users: demo-buyer, demo-farmer, poshtiban (password: demo-12345)
  * 6 articles + growing guides with covers, linked products/listings
  * about page: team, brands (slugs match the catalogue) and contact info
  * support desk: agent roster, 10 quick replies, 4 demo threads with messages
  * 3 storefront complaints + 4 platform feedback rows in various statuses
  * farm demo: 2 lands, calendar events, 2 consultation requests
  * social extras: follows, likes, comments, story views, highlights,
    1 pending listing + 1 pending post for the moderation queue
  * 2 service requests + 2 procurement requests
  * 2 orders (paid+shipped with tracking, awaiting-review) + ledger rows
  * newsletter subscribers, buyer loyalty points, 7-day return policy
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import Permission, User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from shop.data.test_community import (
    DEMO_PASSWORD,
    TEST_ARTICLES,
    TEST_BRANDS,
    TEST_COMPLAINTS,
    TEST_CONTACT,
    TEST_CONSULTATIONS,
    TEST_CONVERSATIONS,
    TEST_FARM_EVENTS,
    TEST_FARM_LANDS,
    TEST_FEEDBACK,
    TEST_FOLLOWS,
    TEST_HIGHLIGHTS,
    TEST_LISTING_ATTRIBUTES,
    TEST_NEWSLETTER,
    TEST_ORDERS,
    TEST_PENDING_LISTING,
    TEST_PENDING_POST,
    TEST_POST_COMMENTS,
    TEST_POST_LIKES,
    TEST_PROCUREMENT_REQUESTS,
    TEST_QUICK_REPLIES,
    TEST_RETURN_POLICY,
    TEST_SERVICE_REQUESTS,
    TEST_STORY_VIEWS,
    TEST_TEAM,
    TEST_USERS,
    TEST_WALLET,
)
from shop.data.test_images import TEST_COLOURS, make_placeholder_image
from shop.models import (
    BrandPartner,
    Comment,
    ConversationRating,
    Coupon,
    DeskAgent,
    DeskSettings,
    FarmCalendarEvent,
    FarmConsultationRequest,
    FarmLand,
    FinancialLedgerEntry,
    MarketplaceListing,
    NewsletterSubscriber,
    Order,
    OrderItem,
    PlatformFeedback,
    ProcurementRequest,
    Product,
    QuickReply,
    ReturnPolicySettings,
    ServiceRequest,
    Shipment,
    ShipmentTrackingEvent,
    SiteArticle,
    SiteContact,
    Storefront,
    StorefrontComplaint,
    StorefrontConversation,
    StorefrontFollow,
    StorefrontHighlight,
    StorefrontHighlightItem,
    StorefrontMessage,
    StorefrontPost,
    StorefrontPostComment,
    StorefrontPostLike,
    StorefrontStoryView,
    ListingAttribute,
    TeamMember,
    UserAccount,
    Wallet,
)
from shop.slugs import slugify_fa


class Command(BaseCommand):
    help = "Seed articles, desk threads, complaints, farm demo and other community test data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-images",
            action="store_true",
            help="بدون ساخت تصویر تستی (کاورها با تصویر پیش‌فرض سایت نمایش داده می‌شوند)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not Product.objects.filter(status="published").exists() or not Storefront.objects.exists():
            raise CommandError(
                "اول کاتالوگ و بازار را سید کنید:\n"
                "  python manage.py seed_test_catalog\n"
                "  python manage.py seed_demo_marketplace\n"
                "یا یک‌مرحله‌ای: ./scripts/load_test_catalog.sh"
            )
        self.with_images = not options["skip_images"]
        self.now = timezone.now()
        self.today = timezone.localdate()

        users = self._seed_users()
        self._seed_desk(users)
        articles = self._seed_articles(users)
        self._seed_about()
        self._seed_farm(users)
        self._seed_social(users)
        self._seed_requests(users)
        self._seed_orders(users)
        self._seed_trust(users)  # after orders: one complaint links an order
        self._seed_extras(users)
        self._print_summary(users, articles)

    # -- users -----------------------------------------------------------
    def _seed_users(self) -> dict[str, User]:
        users: dict[str, User] = {}
        for entry in TEST_USERS:
            user, _ = User.objects.get_or_create(
                username=entry["username"],
                defaults={
                    "email": entry.get("email", ""),
                    "first_name": entry.get("first_name", ""),
                    "last_name": entry.get("last_name", ""),
                },
            )
            user.first_name = entry.get("first_name", user.first_name)
            user.last_name = entry.get("last_name", user.last_name)
            if entry.get("is_staff") and not user.is_staff:
                user.is_staff = True
            user.save(update_fields=["first_name", "last_name", "is_staff"])
            if not user.check_password(DEMO_PASSWORD):
                user.set_password(DEMO_PASSWORD)
                user.save(update_fields=["password"])
            if entry.get("permissions"):
                user.user_permissions.add(*Permission.objects.filter(
                    content_type__app_label="shop", codename__in=entry["permissions"]
                ))
            account, _ = UserAccount.objects.get_or_create(user=user)
            if account.phone != entry.get("phone", "") or account.level != entry["level"]:
                account.phone = entry.get("phone", "")
                account.level = entry["level"]
                account.save(update_fields=["phone", "level"])
            users[entry["username"]] = user
        # Reused accounts owned by the marketplace seed.
        for username in ("moshaver", "bagh-sabz", "taavoni-gorgan", "pesteh-rafsanjan",
                         "golkhane-esfahan", "zaferan-torbat"):
            try:
                users[username] = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"کاربر «{username}» نیست؛ seed_demo_marketplace را اجرا کنید."))
        return users

    # -- desk ------------------------------------------------------------
    def _seed_desk(self, users: dict[str, User]) -> None:
        DeskSettings.load()
        poshtiban = users.get("poshtiban")
        if poshtiban:
            spec = next(u for u in TEST_USERS if u["username"] == "poshtiban")["desk_agent"]
            agent, _ = DeskAgent.objects.update_or_create(
                user=poshtiban, role=spec["role"],
                defaults={
                    "display_name": spec["display_name"], "title": spec["title"],
                    "bio": spec["bio"], "specialties": spec["specialties"], "is_active": True,
                },
            )
            self._ensure_photo(agent, "photo", f"desk-support-{poshtiban.username}", "desk")
        moshaver = users.get("moshaver")
        if moshaver:
            agent, _ = DeskAgent.objects.get_or_create(
                user=moshaver, role=DeskAgent.ROLE_CONSULTING,
                defaults={"display_name": "مهندس مشاور گرین کود", "title": "مشاور ارشد کشاورزی", "is_active": True},
            )
            self._ensure_photo(agent, "photo", f"desk-consulting-{moshaver.username}", "desk")
        # Both desks look staffed: presence = touched the desk recently.
        DeskAgent.objects.filter(user__username__in=["poshtiban", "moshaver"]).update(last_seen_at=self.now)

        for entry in TEST_QUICK_REPLIES:
            QuickReply.objects.update_or_create(
                audience=entry["audience"], channel=entry["channel"], text=entry["text"],
                defaults={
                    "label": entry.get("label", ""),
                    "is_first_message_only": entry.get("is_first_message_only", False),
                    "order": entry.get("order", 0), "is_active": True,
                },
            )

        for thread in TEST_CONVERSATIONS:
            self._seed_conversation(thread, users)

    def _seed_conversation(self, thread: dict, users: dict[str, User]) -> None:
        customer = users.get(thread["customer"])
        if not customer:
            self.stdout.write(self.style.WARNING(f"مشتری «{thread['customer']}» نیست؛ گفتگو رد شد."))
            return
        lookup: dict = {"customer": customer, "channel": thread["channel"]}
        if thread["channel"] == StorefrontConversation.CHANNEL_STOREFRONT:
            storefront = Storefront.objects.filter(user__username=thread.get("storefront")).first()
            if not storefront:
                self.stdout.write(self.style.WARNING(f"غرفه «{thread.get('storefront')}» نیست؛ گفتگو رد شد."))
                return
            lookup["storefront"] = storefront
        agent_user = users.get(thread["agent"]) if thread.get("agent") else None
        conversation, _ = StorefrontConversation.objects.get_or_create(
            **lookup,
            defaults={"subject": thread.get("subject", ""), "agent": agent_user},
        )
        conversation.subject = thread.get("subject", "")
        conversation.agent = agent_user
        conversation.save(update_fields=["subject", "agent", "updated_at"])
        if thread.get("status") == "closed":
            conversation.close(by=agent_user)
        elif conversation.status == "closed":
            conversation.reopen(by=agent_user)

        for msg in thread.get("messages", []):
            sender = users.get(msg["sender"]) if msg.get("sender") else None
            if msg.get("sender") and not sender:
                self.stdout.write(self.style.WARNING(f"فرستنده «{msg['sender']}» نیست؛ پیام رد شد."))
                continue
            listing = None
            if msg.get("listing"):
                seller_username, title = msg["listing"]
                listing = MarketplaceListing.objects.filter(
                    storefront__user__username=seller_username, title=title
                ).first()
            land = None
            if msg.get("land"):
                land = FarmLand.objects.filter(owner=customer, name=msg["land"]).first()
            message, _ = StorefrontMessage.objects.update_or_create(
                conversation=conversation, sender=sender, body=msg["body"],
                defaults={
                    "is_read": msg.get("is_read", False),
                    "is_notice": msg.get("is_notice", False),
                    "listing": listing, "land": land,
                },
            )
            if msg.get("edited") and not message.edited_at:
                message.edited_at = self.now
                message.save(update_fields=["edited_at"])

        rating = thread.get("rating")
        if rating and agent_user:
            agent_profile = DeskAgent.objects.filter(user=agent_user, is_active=True).first()
            ConversationRating.objects.update_or_create(
                conversation=conversation, rater=customer,
                defaults={
                    "agent": agent_profile, "score": rating["score"],
                    "solved": rating.get("solved"), "comment": rating.get("comment", ""),
                },
            )

    # -- articles --------------------------------------------------------
    def _seed_articles(self, users: dict[str, User]) -> dict[str, SiteArticle]:
        author = users.get("moshaver")
        articles: dict[str, SiteArticle] = {}
        for entry in TEST_ARTICLES:
            article, _ = SiteArticle.objects.update_or_create(
                slug=entry["slug"],
                defaults={
                    "title": entry["title"], "kind": entry["kind"],
                    "excerpt": entry.get("excerpt", ""), "body": entry["body"],
                    "crop": entry.get("crop", ""), "author": author,
                    "views": entry.get("views", 0),
                    "is_featured": entry.get("is_featured", False),
                    "is_published": True,
                    "published_at": self.now - timedelta(days=entry.get("published_days_ago", 0)),
                    "seo_title": entry["title"][:70],
                    "seo_description": entry.get("excerpt", "")[:170],
                },
            )
            products = Product.objects.filter(slug__in=entry.get("products", []), status="published")
            if products.count() != len(entry.get("products", [])):
                missing = set(entry.get("products", [])) - set(products.values_list("slug", flat=True))
                self.stdout.write(self.style.WARNING(f"مقاله «{entry['slug']}»: محصول نیست: {sorted(missing)}"))
            article.products.set(products)
            listing_rows = []
            for seller_username, title in entry.get("listings", []):
                listing = MarketplaceListing.objects.filter(
                    storefront__user__username=seller_username, title=title
                ).first()
                if listing:
                    listing_rows.append(listing)
                else:
                    self.stdout.write(self.style.WARNING(f"مقاله «{entry['slug']}»: آگهی «{title}» نیست."))
            article.listings.set(listing_rows)
            colour = TEST_COLOURS["guide"] if entry["kind"] == "guide" else TEST_COLOURS["article"]
            self._ensure_image(article, "cover", f"article-{entry['slug']}", colour)
            articles[entry["slug"]] = article
        for entry in TEST_ARTICLES:
            related = [articles[slug] for slug in entry.get("related", []) if slug in articles]
            articles[entry["slug"]].related_articles.set(related)
        return articles

    # -- about -----------------------------------------------------------
    def _seed_about(self) -> None:
        for entry in TEST_TEAM:
            member, _ = TeamMember.objects.update_or_create(
                name=entry["name"],
                defaults={"role": entry["role"], "bio": entry.get("bio", ""),
                          "order": entry.get("order", 0), "is_active": True},
            )
            self._ensure_image(member, "photo", f"team-{member.id}", TEST_COLOURS["team"])
        for order, entry in enumerate(TEST_BRANDS):
            slug = slugify_fa(entry["name"])
            brand, _ = BrandPartner.objects.update_or_create(
                slug=slug,
                defaults={"name": entry["name"], "website": entry.get("website", ""),
                          "description": entry.get("description", ""),
                          "since_year": entry.get("since_year"), "order": order, "is_active": True},
            )
            self._ensure_image(brand, "logo", f"brand-{slug}", TEST_COLOURS["brand"])
        contact = SiteContact.load()
        for field in ("address", "provinces_note", "phones", "emails", "working_hours",
                      "whatsapp_number", "telegram_url", "instagram_url", "eitaa_url",
                      "map_lat", "map_lng", "map_note", "expert_name", "expert_role", "expert_note"):
            setattr(contact, field, TEST_CONTACT[field])
        contact.save()
        self._ensure_image(contact, "expert_photo", "contact-expert", TEST_COLOURS["team"], shade=1)

    # -- trust -----------------------------------------------------------
    def _seed_trust(self, users: dict[str, User]) -> None:
        for entry in TEST_COMPLAINTS:
            storefront = Storefront.objects.filter(user__username=entry["storefront"]).first()
            if not storefront:
                self.stdout.write(self.style.WARNING(f"غرفه «{entry['storefront']}» نیست؛ شکایت رد شد."))
                continue
            listing = None
            if entry.get("listing"):
                listing = MarketplaceListing.objects.filter(storefront=storefront, title=entry["listing"]).first()
            order = None
            if entry.get("order"):
                order = Order.objects.filter(code=entry["order"]).first()
            StorefrontComplaint.objects.update_or_create(
                storefront=storefront, subject=entry["subject"],
                defaults={
                    "complainant": users.get(entry.get("complainant")),
                    "listing": listing, "order": order,
                    "description": entry["description"], "status": entry["status"],
                    "resolution_note": entry.get("resolution_note", ""),
                },
            )
        for entry in TEST_FEEDBACK:
            PlatformFeedback.objects.update_or_create(
                subject=entry["subject"], kind=entry["kind"],
                defaults={
                    "user": users.get(entry["user"]) if entry.get("user") else None,
                    "name": entry.get("name", ""), "email": entry.get("email", ""),
                    "message": entry["message"], "status": entry["status"],
                },
            )

    # -- farm ------------------------------------------------------------
    def _seed_farm(self, users: dict[str, User]) -> None:
        farmer = users.get("demo-farmer")
        if not farmer:
            self.stdout.write(self.style.WARNING("کاربر demo-farmer نیست؛ بخش مزرعه رد شد."))
            return
        lands: dict[str, FarmLand] = {}
        for entry in TEST_FARM_LANDS:
            land, _ = FarmLand.objects.update_or_create(
                owner=farmer, name=entry["name"],
                defaults={
                    "land_type": entry["land_type"], "area": Decimal(entry["area"]),
                    "area_unit": entry["area_unit"], "crop_type": entry["crop_type"],
                    "crop_variety": entry.get("crop_variety", ""),
                    "province": entry.get("province", ""), "city": entry.get("city", ""),
                    "soil_type": entry.get("soil_type", "loam"),
                    "irrigation_type": entry.get("irrigation_type", "drip"),
                    "planting_date": self.today - timedelta(days=entry.get("planting_days_ago", 0)),
                    "notes": entry.get("notes", ""), "is_active": True,
                },
            )
            lands[entry["name"]] = land
        for entry in TEST_FARM_EVENTS:
            land = lands.get(entry["land"])
            creator = users.get(entry["created_by"])
            if not land or not creator:
                continue
            FarmCalendarEvent.objects.update_or_create(
                land=land, title=entry["title"],
                defaults={
                    "kind": entry["kind"],
                    "date": self.today + timedelta(days=entry.get("date_in_days", 0)),
                    "notes": entry.get("notes", ""), "status": entry.get("status", "planned"),
                    "created_by": creator,
                },
            )
        for entry in TEST_CONSULTATIONS:
            land = lands.get(entry["land"])
            if not land:
                continue
            FarmConsultationRequest.objects.update_or_create(
                farmer=farmer, land=land, subject=entry["subject"], message=entry["message"],
                defaults={
                    "status": entry.get("status", "pending"),
                    "reply": entry.get("reply", ""),
                    "replied_by": users.get(entry["replied_by"]) if entry.get("replied_by") else None,
                },
            )

    # -- social extras ---------------------------------------------------
    def _seed_social(self, users: dict[str, User]) -> None:
        for storefront in Storefront.objects.all():
            self._ensure_image(storefront, "avatar", f"storefront-{storefront.slug}-avatar", TEST_COLOURS["storefront"])
            self._ensure_image(storefront, "cover", f"storefront-{storefront.slug}-cover", TEST_COLOURS["storefront"], shade=1)

        for username, seller in TEST_FOLLOWS:
            storefront = Storefront.objects.filter(user__username=seller).first()
            if users.get(username) and storefront:
                StorefrontFollow.objects.get_or_create(storefront=storefront, user=users[username])

        for username, seller, caption in TEST_POST_LIKES:
            post = StorefrontPost.objects.filter(
                storefront__user__username=seller, post_type="post", caption=caption
            ).first()
            if post and users.get(username):
                StorefrontPostLike.objects.get_or_create(post=post, user=users[username])

        for entry in TEST_POST_COMMENTS:
            post = StorefrontPost.objects.filter(
                storefront__user__username=entry["storefront"], caption=entry["caption"]
            ).first()
            user = users.get(entry["user"])
            if not post or not user:
                continue
            comment, _ = StorefrontPostComment.objects.get_or_create(
                post=post, user=user, parent=None, body=entry["body"]
            )
            if entry.get("seller_reply"):
                StorefrontPostComment.objects.get_or_create(
                    post=post, user=post.storefront.user, parent=comment, body=entry["seller_reply"]
                )

        for username, seller in TEST_STORY_VIEWS:
            story = StorefrontPost.objects.filter(
                storefront__user__username=seller, post_type="story", status="published"
            ).order_by("-created_at").first()
            if story and users.get(username):
                # Keep the demo story alive: re-seeds refresh its 24h lifetime.
                if not story.expires_at or story.expires_at <= self.now:
                    story.expires_at = self.now + timedelta(hours=24)
                    story.save(update_fields=["expires_at"])
                StorefrontStoryView.objects.get_or_create(post=story, user=users[username])

        for entry in TEST_HIGHLIGHTS:
            storefront = Storefront.objects.filter(user__username=entry["storefront"]).first()
            if not storefront:
                continue
            highlight, _ = StorefrontHighlight.objects.get_or_create(
                storefront=storefront, title=entry["title"],
                defaults={"position": entry.get("position", 0)},
            )
            stories = storefront.posts.filter(post_type="story").order_by("created_at")
            for position, story in enumerate(stories):
                StorefrontHighlightItem.objects.get_or_create(
                    highlight=highlight, post=story, defaults={"position": position}
                )

        # Moderation queue demos: created once, never forced back to pending.
        pending = TEST_PENDING_LISTING
        storefront = Storefront.objects.filter(user__username=pending["storefront"]).first()
        if storefront:
            MarketplaceListing.objects.get_or_create(
                storefront=storefront, title=pending["title"],
                defaults={
                    "slug": pending["slug"], "crop_name": pending["crop_name"],
                    "description": pending["description"], "price": pending["price"],
                    "unit": pending["unit"],
                    "quantity_available": Decimal(pending["quantity_available"]),
                    "min_order_quantity": Decimal(pending["min_order_quantity"]),
                    "status": "pending_review",
                },
            )
            post_spec = TEST_PENDING_POST
            StorefrontPost.objects.get_or_create(
                storefront=storefront, post_type=post_spec["post_type"], caption=post_spec["caption"],
                defaults={"status": "pending_review"},
            )

        for (seller, title), rows in TEST_LISTING_ATTRIBUTES.items():
            listing = MarketplaceListing.objects.filter(
                storefront__user__username=seller, title=title
            ).first()
            if not listing:
                continue
            for order, (label, value) in enumerate(rows):
                ListingAttribute.objects.get_or_create(
                    listing=listing, label=label, order=order, defaults={"value": value}
                )

    # -- service / procurement requests ----------------------------------
    def _seed_requests(self, users: dict[str, User]) -> None:
        for entry in TEST_SERVICE_REQUESTS:
            ServiceRequest.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "user": users.get(entry["user"]) if entry.get("user") else None,
                    "service_type": entry["service_type"], "customer_name": entry["customer_name"],
                    "phone": entry["phone"], "province": entry["province"], "city": entry["city"],
                    "crop": entry.get("crop", ""),
                    "farm_area_hectare": Decimal(entry["farm_area_hectare"]) if entry.get("farm_area_hectare") else None,
                    "description": entry["description"], "status": entry["status"],
                },
            )
        for entry in TEST_PROCUREMENT_REQUESTS:
            ProcurementRequest.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "user": users.get(entry["user"]) if entry.get("user") else None,
                    "farmer_name": entry["farmer_name"], "phone": entry["phone"],
                    "crop_name": entry["crop_name"], "variety": entry.get("variety", ""),
                    "quantity": Decimal(entry["quantity"]), "unit": entry.get("unit", "کیلوگرم"),
                    "requested_price": entry.get("requested_price"),
                    "province": entry["province"], "city": entry["city"],
                    "description": entry.get("description", ""), "status": entry["status"],
                },
            )

    # -- orders ----------------------------------------------------------
    def _seed_orders(self, users: dict[str, User]) -> None:
        for entry in TEST_ORDERS:
            user = users.get(entry["user"])
            lines: list[dict] = []
            subtotal = 0
            for item in entry["items"]:
                if item["kind"] == "product":
                    product = Product.objects.filter(slug=item["ref"], status="published").first()
                    if not product:
                        self.stdout.write(self.style.WARNING(f"سفارش «{entry['code']}»: محصول «{item['ref']}» نیست."))
                        continue
                    unit_price, line = product.discounted_price, product.discounted_price * item["quantity"]
                    subtotal += line
                    lines.append({"kind": "product", "product": product, "unit_price": unit_price,
                                  "quantity": item["quantity"], "line": line})
                else:
                    listing = MarketplaceListing.objects.filter(
                        storefront__user__username=item["storefront"], title=item["ref"]
                    ).first()
                    if not listing:
                        self.stdout.write(self.style.WARNING(f"سفارش «{entry['code']}»: آگهی «{item['ref']}» نیست."))
                        continue
                    unit_price = listing.discounted_price
                    line = unit_price * item["quantity"]
                    subtotal += line
                    rate = listing.storefront.commission_rate or 0
                    lines.append({"kind": "listing", "listing": listing, "unit_price": unit_price,
                                  "quantity": item["quantity"], "line": line,
                                  "commission": int(line * float(rate) / 100)})
            if not lines:
                continue
            discount = 0
            if entry.get("coupon_code"):
                try:
                    coupon = Coupon.objects.get(code=entry["coupon_code"])
                    discount = coupon.calculate_discount(subtotal)
                except (Coupon.DoesNotExist, ValueError) as exc:
                    self.stdout.write(self.style.WARNING(f"سفارش «{entry['code']}»: کوپن معتبر نیست ({exc})."))
            total = subtotal - discount + entry.get("shipping_price", 0)
            order, _ = Order.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "user": user, "customer_name": entry["customer_name"], "phone": entry["phone"],
                    "province": entry["province"], "city": entry["city"], "address": entry["address"],
                    "notes": entry.get("notes", ""), "subtotal": subtotal, "discount_amount": discount,
                    "coupon_code": entry.get("coupon_code", ""),
                    "shipping_price": entry.get("shipping_price", 0),
                    "shipping_provider": "flat", "shipping_service": "standard",
                    "total_price": total, "status": entry["status"],
                    "payment_status": entry["payment_status"], "payment_method": entry["payment_method"],
                    "terms_accepted_at": self.now, "legal_version": "test-v1",
                },
            )
            order.items.all().delete()
            for line in lines:
                if line["kind"] == "product":
                    product = line["product"]
                    OrderItem.objects.create(
                        order=order, kind="product", product=product,
                        product_title=product.title, product_slug=product.slug,
                        unit_price=line["unit_price"], quantity=line["quantity"],
                    )
                else:
                    listing = line["listing"]
                    storefront = listing.storefront
                    OrderItem.objects.create(
                        order=order, kind="listing", listing=listing, storefront=storefront,
                        seller=storefront.user, product_title=listing.title, product_slug=listing.slug,
                        storefront_name=storefront.name, storefront_slug=storefront.slug,
                        unit=listing.unit, unit_price=line["unit_price"], quantity=line["quantity"],
                        commission_rate=storefront.commission_rate or 0,
                        commission_amount=line["commission"],
                    )
            self._seed_shipment(order, entry.get("shipment"))
            self._seed_ledger(order, entry.get("ledger", []), lines)

    def _seed_shipment(self, order: Order, spec: dict | None) -> None:
        if not spec:
            return
        shipment, _ = Shipment.objects.get_or_create(
            order=order,
            defaults={
                "provider": spec.get("provider", "manual"),
                "service_name": spec.get("service_name", ""),
                "status": spec.get("status", "pending"),
                "tracking_code": spec.get("tracking_code", ""),
                "shipping_cost": order.shipping_price,
                "shipped_at": self.now - timedelta(days=spec.get("shipped_days_ago", 0)),
            },
        )
        shipment.provider = spec.get("provider", "manual")
        shipment.service_name = spec.get("service_name", "")
        shipment.status = spec.get("status", "pending")
        shipment.tracking_code = spec.get("tracking_code", "")
        shipment.shipping_cost = order.shipping_price
        shipment.shipped_at = self.now - timedelta(days=spec.get("shipped_days_ago", 0))
        shipment.save()
        shipment.events.all().delete()
        latest = None
        for event in spec.get("events", []):
            occurred = self.now - timedelta(days=event.get("days_ago", 0))
            ShipmentTrackingEvent.objects.create(
                shipment=shipment, status=event["status"], description=event["description"],
                location=event.get("location", ""), occurred_at=occurred,
            )
            latest = occurred if latest is None or occurred > latest else latest
        shipment.last_event_at = latest
        shipment.save(update_fields=["last_event_at"])

    def _seed_ledger(self, order: Order, specs: list[dict], lines: list[dict]) -> None:
        for spec in specs:
            storefront = Storefront.objects.filter(user__username=spec["storefront"]).first()
            if not storefront:
                continue
            net = sum(
                line["line"] - line.get("commission", 0) for line in lines
                if line["kind"] == "listing" and line["listing"].storefront_id == storefront.id
            )
            FinancialLedgerEntry.objects.update_or_create(
                storefront=storefront, order=order, entry_type=spec["entry_type"],
                defaults={
                    "owner_type": spec.get("owner_type", "seller"), "user": storefront.user,
                    "status": spec.get("status", "pending"), "amount": net,
                    "description": spec.get("description", ""),
                    "available_at": self.now if spec.get("status") == "available" else None,
                },
            )

    # -- newsletter / wallet / return policy -----------------------------
    def _seed_extras(self, users: dict[str, User]) -> None:
        for entry in TEST_NEWSLETTER:
            if entry.get("email"):
                NewsletterSubscriber.objects.update_or_create(
                    email=entry["email"],
                    defaults={"mobile": entry.get("mobile", ""), "topics": entry.get("topics", ""),
                              "source": entry.get("source", "test-seed"), "is_active": True},
                )
            else:
                NewsletterSubscriber.objects.update_or_create(
                    mobile=entry["mobile"],
                    defaults={"email": "", "topics": entry.get("topics", ""),
                              "source": entry.get("source", "test-seed"), "is_active": True},
                )
        wallet_user = users.get(TEST_WALLET["user"])
        if wallet_user:
            wallet, _ = Wallet.objects.get_or_create(user=wallet_user)
            wallet.loyalty_points = TEST_WALLET["loyalty_points"]
            wallet.save(update_fields=["loyalty_points"])
        policy = ReturnPolicySettings.load()
        policy.window_days = TEST_RETURN_POLICY["window_days"]
        policy.conditions = TEST_RETURN_POLICY["conditions"]
        policy.save(update_fields=["window_days", "conditions", "updated_at"])

    # -- images ----------------------------------------------------------
    def _ensure_image(self, instance, field: str, slug: str, colour, shade: int = 0) -> None:
        if not self.with_images or getattr(instance, field):
            return
        blob = make_placeholder_image(slug, colour, shade=shade)
        getattr(instance, field).save(f"test/{slug}.jpg", ContentFile(blob), save=True)

    def _ensure_photo(self, instance, field: str, slug: str, palette: str) -> None:
        self._ensure_image(instance, field, slug, TEST_COLOURS[palette])

    # -- report ----------------------------------------------------------
    def _print_summary(self, users: dict[str, User], articles: dict[str, SiteArticle]) -> None:
        self.stdout.write(self.style.SUCCESS(
            "دیتای تستی بخش‌های اجتماعی آماده شد:\n"
            f"  • مقالات: {SiteArticle.objects.filter(is_published=True).count()} منتشرشده "
            f"({SiteArticle.objects.filter(is_published=True, kind='guide').count()} راهنما)\n"
            f"  • درباره: {TeamMember.objects.filter(is_active=True).count()} عضو تیم، "
            f"{BrandPartner.objects.filter(is_active=True).count()} برند\n"
            f"  • میز خدمت: {DeskAgent.objects.filter(is_active=True).count()} کارشناس، "
            f"{QuickReply.objects.filter(is_active=True).count()} پاسخ آماده، "
            f"{StorefrontConversation.objects.count()} گفتگو، "
            f"{StorefrontMessage.objects.count()} پیام\n"
            f"  • شکایت/بازخورد: {StorefrontComplaint.objects.count()} شکایت، "
            f"{PlatformFeedback.objects.count()} بازخورد\n"
            f"  • مزرعه: {FarmLand.objects.count()} زمین، "
            f"{FarmCalendarEvent.objects.count()} رویداد، "
            f"{FarmConsultationRequest.objects.count()} مشاوره\n"
            f"  • سفارش: {Order.objects.count()} سفارش، {Shipment.objects.count()} مرسوله\n"
            f"  • حساب‌های تستی (رمز همه {DEMO_PASSWORD}): "
            + ", ".join(sorted(u for u in users if users[u] is not None))
            + "\n  • پنل مشاور/مدیریت نیازمند سطح ۶+ است؛ روی لپ‌تاپ: "
            "python manage.py createsuperuser"
        ))

"""Security regression tests for cookie auth and fail-closed API permissions."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.middleware.csrf import _get_new_csrf_string
from django.test import TestCase, override_settings
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class CookieTokenCsrfTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="csrf-owner", password="safe-pass-1")
        self.token = Token.objects.create(user=self.user)

    def cookie_client(self):
        client = APIClient(enforce_csrf_checks=True)
        client.cookies[settings.AUTH_COOKIE_NAME] = self.token.key
        return client

    def test_cookie_authenticated_unsafe_request_without_csrf_is_forbidden(self):
        response = self.cookie_client().patch(
            "/api/profile/", {"first_name": "بدون توکن"}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.first_name, "بدون توکن")

    def test_cookie_authenticated_request_with_valid_csrf_is_accepted(self):
        client = self.cookie_client()
        csrf_token = _get_new_csrf_string()
        client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
        response = client.patch(
            "/api/profile/",
            {"first_name": "ایمن"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "ایمن")

    def test_authorization_header_does_not_require_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.patch(
            "/api/profile/",
            {"first_name": "یکپارچه‌سازی"},
            format="json",
            HTTP_AUTHORIZATION=f"Token {self.token.key}",
        )
        self.assertEqual(response.status_code, 200, response.content)


@override_settings(SECURE_SSL_REDIRECT=False)
class CsrfCookieIssuedTests(TestCase):
    """The server must hand out the cookie it then demands.

    These two tests are the reason a broken write path can no longer hide.

    `CookieTokenCsrfTests` above proves the check fires; it seeds the cookie by
    hand, so it passed for years while no endpoint in the API ever issued one. A
    browser that cannot obtain the cookie cannot echo it, and every unsafe request
    it made came back 403 `permission_denied` — cart, checkout, messaging, opening
    a stall. Django's test client hides this (CSRF checks off by default) and
    `APIRequestFactory` never reaches the cookie layer, which is how it stayed green.

    So the cookie is asserted where it is produced, and the write path is walked
    with nothing but what the server itself returned.
    """

    def test_a_plain_get_issues_the_csrf_cookie(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.get("/api/auth/session/")
        # 401 is the honest answer for a visitor who has no session; what matters
        # is that the response still carries the token the page has to echo back.
        self.assertIn(settings.CSRF_COOKIE_NAME, response.cookies, response.content)

    def test_a_signed_in_browser_can_write_using_only_cookies_the_server_gave_it(self):
        client = APIClient(enforce_csrf_checks=True)
        register = client.post(
            "/api/auth/register/",
            {
                "username": "browser-seller",
                "email": "browser-seller@example.test",
                "password": "SafePassword!234",
                "password2": "SafePassword!234",
            },
            format="json",
        )
        self.assertEqual(register.status_code, 201, register.content)

        # The cookie jar is the only state carried forward — exactly the browser's.
        csrf_token = client.cookies[settings.CSRF_COOKIE_NAME].value
        self.assertTrue(csrf_token, "registration issued no CSRF cookie to echo back")

        created = client.post(
            "/api/marketplace/storefront/",
            {
                "name": "غرفه مرورگر",
                "seller_type": "farmer",
                "province": "فارس",
                "city": "شیراز",
                "owner_first_name": "زهرا",
                "owner_last_name": "بهاران",
                "national_id": "3971857299",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(created.status_code, 201, created.content)


class ApiPermissionPolicyTests(TestCase):
    """Pin the registry policy: public routes are explicit, all others fail closed."""

    PUBLIC_VIEW_NAMES = {
        "whatsapp_webhook",
        "cancel_order",
        "site_contact",
        "site_about",
        "catalog_index",
        "buyer_experiences",
        "site_policies",
        "legal_index",
        "legal_document",
        "growing_index",
        "newsletter_unsubscribe",
        "feature_flags_view",
        "payment_options_view",
        "restart_zarinpal_payment",
        "submit_feedback",
        "FertilizerViewSet",
        "PesticideViewSet",
        "SeedViewSet",
        "SeedlingViewSet",
        "TractorViewSet",
        "ImplementViewSet",
        "CategoryViewSet",
        "ProductViewSet",
        "CommentViewSet",
        "CartViewSet",
        "MarketplaceListingViewSet",
        "StorefrontPostViewSet",
        "StorefrontDirectoryViewSet",
        "StorefrontHighlightViewSet",
        "SiteArticleViewSet",
        "SitePageViewSet",
        "ServiceViewSet",
        "login_view",
        "register",
        "request_login_otp",
        "verify_login_otp_view",
        "locations",
        "agri_inputs",
        "agri_crops",
        "calculate_dose",
        "shipping_quote_view",
        "checkout",
        "order_lookup",
        "create_service_request",
        "create_procurement_request",
        "storefront_name_available",
        "access_levels",
        "zarinpal_callback",
        "newsletter_subscribe",
        "visual_search",
        "catalog_landing",
        "desk_state",
        "log_list",
        "log_resolve",
        "client_report",
    }

    @staticmethod
    def api_callbacks():
        def walk(patterns, prefix=""):
            for pattern in patterns:
                route = f"{prefix}{pattern.pattern}"
                if isinstance(pattern, URLResolver):
                    yield from walk(pattern.url_patterns, route)
                elif isinstance(pattern, URLPattern) and route.startswith("api/"):
                    yield route, pattern.callback

        yield from walk(get_resolver().url_patterns)

    def test_default_permission_is_fail_closed(self):
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"],
            ["rest_framework.permissions.IsAuthenticated"],
        )
        self.assertFalse(settings.CSRF_COOKIE_HTTPONLY)

    def test_registered_public_views_are_explicitly_allow_any(self):
        seen = set()
        violations = []
        for route, callback in self.api_callbacks():
            view_class = getattr(callback, "cls", None) or getattr(callback, "view_class", None)
            if view_class is None:
                continue
            name = view_class.__name__
            permissions = tuple(getattr(view_class, "permission_classes", ()))
            if name in self.PUBLIC_VIEW_NAMES:
                seen.add(name)
                has_public_policy = (
                    AllowAny in permissions
                    or any(permission.__name__ == "IsAuthenticatedOrReadOnly" for permission in permissions)
                    or "get_permissions" in view_class.__dict__
                )
                if not has_public_policy:
                    violations.append(f"{route}: {name} lacks an explicit public policy")
            elif not permissions:
                violations.append(f"{route}: {name} declares no permission policy")
            elif permissions == (AllowAny,):
                violations.append(f"{route}: unreviewed public view {name}")
        self.assertFalse(violations, "\n".join(violations))
        self.assertFalse(self.PUBLIC_VIEW_NAMES - seen, self.PUBLIC_VIEW_NAMES - seen)

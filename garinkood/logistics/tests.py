"""Tests for the logistics bounded context.

Contracts pinned here:

* a shipment persists with its timeline ordered newest-first, exactly one
  primary parcel per order (OneToOne), and a globally unique tracking code;
* deleting the order cascades through the shipment AND its events;
* the read API enforces row-level ownership: an intruder gets 404 on a
  foreign shipment (existence is not leaked), the owner gets 200 with the
  ordered timeline, anonymous callers are refused at the door, and staff
  sees everything plus the tracking/order-code filters.
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from shop.models import Order

from .models import Shipment, ShipmentEvent

User = get_user_model()


def make_order(user, *, code):
    """Minimal but realistic kernel order for a shipment to hang off."""
    return Order.objects.create(
        code=code,
        user=user,
        customer_name="خریدار آزمون",
        phone="09120000000",
        province="تهران",
        city="تهران",
        address="خیابان آزمایش، پلاک ۱",
    )


class LogisticsModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="logi-model", password="safe-pass-1")
        self.order = make_order(self.user, code="LOG-M-1")

    def test_shipment_persists_and_events_ordered_newest_first(self):
        shipment = Shipment.objects.create(
            order=self.order,
            tracking_code="TRK-1001",
            carrier_name="تیپاکس",
        )
        first = ShipmentEvent.objects.create(
            shipment=shipment,
            status="picked_up",
            description="مرسوله از انبار تحویل حامل شد",
            location="کرج",
        )
        second = ShipmentEvent.objects.create(
            shipment=shipment,
            status="in_transit",
            description="مرسوله به انبار تهران رسید",
            location="تهران",
        )
        timeline = list(shipment.events.values_list("pk", flat=True))
        self.assertEqual(timeline, [second.pk, first.pk])
        # Staff-managed state starts at pending; events never silently move it.
        self.assertEqual(shipment.status, "pending")
        self.assertIn("تیپاکس", str(shipment))
        self.assertEqual(first.get_status_display(), "تحویل به حامل شد")

    def test_one_order_one_shipment_and_unique_tracking_code(self):
        Shipment.objects.create(
            order=self.order, tracking_code="TRK-UNIQ", carrier_name="پست"
        )
        # Second parcel on the SAME order must die at the database fence;
        # the savepoint keeps the outer test transaction usable afterwards.
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Shipment.objects.create(
                    order=self.order, tracking_code="TRK-OTHER", carrier_name="پست"
                )
        # The same tracking code on a DIFFERENT order is just as illegal.
        other_order = make_order(self.user, code="LOG-M-2")
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Shipment.objects.create(
                    order=other_order, tracking_code="TRK-UNIQ", carrier_name="پست"
                )

    def test_order_delete_cascades_shipment_and_events(self):
        shipment = Shipment.objects.create(
            order=self.order, tracking_code="TRK-CASC", carrier_name="چاپار"
        )
        ShipmentEvent.objects.create(
            shipment=shipment, status="in_transit", description="در مسیر"
        )
        ShipmentEvent.objects.create(
            shipment=shipment, status="delivered", description="تحویل شد"
        )
        self.order.delete()
        self.assertEqual(Shipment.objects.count(), 0)
        self.assertEqual(ShipmentEvent.objects.count(), 0)


@override_settings(SECURE_SSL_REDIRECT=False)
class LogisticsApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="logi-owner", password="safe-pass-1")
        self.intruder = User.objects.create_user(username="logi-intruder", password="safe-pass-1")
        self.staff = User.objects.create_user(
            username="logi-staff", password="safe-pass-1", is_staff=True
        )
        self.owner_order = make_order(self.owner, code="LOG-A-1")
        self.intruder_order = make_order(self.intruder, code="LOG-B-1")
        self.owner_shipment = Shipment.objects.create(
            order=self.owner_order,
            tracking_code="TRK-OWNER",
            carrier_name="تیپاکس",
            status="in_transit",
        )
        ShipmentEvent.objects.create(
            shipment=self.owner_shipment,
            status="picked_up",
            description="تحویل به حامل شد",
            location="کرج",
        )
        ShipmentEvent.objects.create(
            shipment=self.owner_shipment,
            status="in_transit",
            description="به انبار تهران رسید",
            location="تهران",
        )
        self.foreign_shipment = Shipment.objects.create(
            order=self.intruder_order,
            tracking_code="TRK-FOREIGN",
            carrier_name="پست",
        )
        self.client = APIClient()

    def test_owner_gets_200_with_ordered_timeline(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/logistics/shipments/{self.owner_shipment.pk}/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["tracking_code"], "TRK-OWNER")
        self.assertEqual(payload["order_code"], "LOG-A-1")
        self.assertEqual(payload["status_label"], "در مسیر")
        events = payload["events"]
        # Contract: newest first - the in_transit hop leads the timeline.
        self.assertEqual([event["status"] for event in events], ["in_transit", "picked_up"])
        self.assertEqual(events[0]["location"], "تهران")
        self.assertEqual(events[0]["status_label"], "در مسیر")

    def test_intruder_gets_404_and_never_sees_foreign_rows(self):
        self.client.force_authenticate(self.intruder)
        detail = self.client.get(f"/api/logistics/shipments/{self.owner_shipment.pk}/")
        self.assertEqual(detail.status_code, 404)
        listing = self.client.get("/api/logistics/shipments/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()["count"], 1)
        self.assertEqual(
            listing.json()["results"][0]["tracking_code"], "TRK-FOREIGN"
        )

    def test_staff_sees_all_and_filters_by_tracking_and_order_code(self):
        self.client.force_authenticate(self.staff)
        listing = self.client.get("/api/logistics/shipments/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()["count"], 2)
        by_tracking = self.client.get("/api/logistics/shipments/?tracking_code=TRK-OWNER")
        self.assertEqual(by_tracking.json()["count"], 1)
        by_order = self.client.get("/api/logistics/shipments/?order__code=LOG-B-1")
        self.assertEqual(by_order.json()["count"], 1)
        self.assertEqual(by_order.json()["results"][0]["carrier_name"], "پست")

    def test_anonymous_is_refused(self):
        response = self.client.get("/api/logistics/shipments/")
        self.assertEqual(response.status_code, 401)
        detail = self.client.get(f"/api/logistics/shipments/{self.owner_shipment.pk}/")
        self.assertEqual(detail.status_code, 401)

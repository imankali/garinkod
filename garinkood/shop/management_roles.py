"""Declarative management roles based on Django's built-in permissions."""

ROLE_PERMISSIONS = {
    "عملیات": [
        "view_order", "change_order", "view_orderitem", "view_cart", "view_cartitem",
        "view_product", "change_product", "view_coupon", "change_coupon",
        "view_notificationdelivery", "change_notificationdelivery",
        "view_notificationrecipient", "add_notificationrecipient", "change_notificationrecipient",
        "view_notificationtemplate", "add_notificationtemplate", "change_notificationtemplate",
        "view_onetimepassword", "view_shipment", "add_shipment", "change_shipment",
        "view_shipmenttrackingevent", "add_shipmenttrackingevent", "change_shipmenttrackingevent",
    ],
    "مالی": [
        "view_order", "change_order", "view_paymentattempt", "change_paymentattempt",
        "view_financialledgerentry", "change_financialledgerentry", "view_wallet",
        "view_wallettransaction", "view_coupon", "change_coupon", "view_affiliateconversion",
    ],
    "بازار و غرفه": [
        "view_storefront", "change_storefront", "view_marketplacelisting", "change_marketplacelisting",
        "view_storefrontpost", "change_storefrontpost", "view_storefrontcomplaint", "change_storefrontcomplaint",
    ],
    "پشتیبانی": [
        "view_servicerequest", "change_servicerequest", "view_procurementrequest", "change_procurementrequest",
        "view_platformfeedback", "change_platformfeedback", "view_storefrontcomplaint", "change_storefrontcomplaint",
        "view_comment", "change_comment",
    ],
    "محتوا": [
        "view_comment", "change_comment", "view_storefrontpost", "change_storefrontpost",
        "view_marketplacelisting", "change_marketplacelisting", "view_product", "change_product",
    ],
    "انبار": [
        "view_product", "change_product", "view_order", "view_orderitem",
        "view_shipment", "add_shipment", "change_shipment",
        "view_shipmenttrackingevent", "add_shipmenttrackingevent",
    ],
}

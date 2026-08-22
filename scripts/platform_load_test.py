#!/usr/bin/env python3
"""Controlled end-to-end API test with concurrent virtual agricultural users.

This script is for environments you own or explicitly administer. It exercises
public catalogue, cart, checkout, service, procurement and feedback flows with
isolated cookie jars. It does not call third-party payment gateways.

Example:
    python scripts/platform_load_test.py --base-url http://127.0.0.1:8000 --users 100 --product-id 1
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


@dataclass(frozen=True)
class Result:
    endpoint: str
    status: int | None
    duration_ms: float
    error: str = ""


def call(opener, method: str, url: str, payload: dict | None = None) -> Result:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data:
        headers["Content-Type"] = "application/json"
    started = time.perf_counter()
    try:
        response = opener.open(Request(url, data=data, method=method, headers=headers), timeout=30)
        response.read()
        return Result(url, response.status, (time.perf_counter() - started) * 1000)
    except HTTPError as exc:
        exc.read()
        return Result(url, exc.code, (time.perf_counter() - started) * 1000, f"HTTP {exc.code}")
    except (URLError, TimeoutError, OSError) as exc:
        return Result(url, None, (time.perf_counter() - started) * 1000, str(getattr(exc, "reason", exc)))


def stage(executor: ThreadPoolExecutor, jobs):
    gate = threading.Event()

    def execute(job):
        gate.wait()
        return job()

    futures = [executor.submit(execute, job) for job in jobs]
    gate.set()
    return [future.result() for future in as_completed(futures)]


def run(base_url: str, users: int, product_id: int) -> list[Result]:
    clients = [build_opener(HTTPCookieProcessor(CookieJar())) for _ in range(users)]
    results: list[Result] = []
    with ThreadPoolExecutor(max_workers=users) as executor:
        # Read-only discovery: catalogue, SEO facts and payment readiness.
        discovery = stage(executor, [
            lambda client=client: [
                call(client, "GET", f"{base_url}/api/products/?page=1"),
                call(client, "GET", f"{base_url}/api/categories/"),
                call(client, "GET", f"{base_url}/api/payments/options/"),
                call(client, "GET", f"{base_url}/ai-facts.json"),
                call(client, "GET", f"{base_url}/api/cart/"),
            ]
            for client in clients
        ])
        results.extend(item for visitor in discovery for item in visitor)

        cart_results = stage(executor, [
            lambda client=client: call(client, "POST", f"{base_url}/api/cart/add/", {"product_id": product_id, "quantity": 1})
            for client in clients
        ])
        results.extend(cart_results)

        # Lead flows do not mutate stock and emulate service, procurement and feedback testers.
        leads = stage(executor, [
            lambda index=index, client=client: [
                call(client, "POST", f"{base_url}/api/services/requests/", {
                    "service_type": "agronomy", "customer_name": f"tester-{index}",
                    "phone": f"09{index:09d}", "province": "فارس", "city": "شیراز",
                    "crop": "گندم", "description": "درخواست آزمایشی هم‌زمان برای بررسی مسیر خدمات."
                }),
                call(client, "POST", f"{base_url}/api/procurement/requests/", {
                    "farmer_name": f"tester-{index}", "phone": f"09{index:09d}",
                    "crop_name": "گندم", "quantity": "100", "unit": "کیلوگرم",
                    "province": "فارس", "city": "شیراز"
                }),
                call(client, "POST", f"{base_url}/api/feedback/", {
                    "kind": "suggestion", "subject": "بارسنجی کنترل‌شده",
                    "message": f"بازخورد آزمایشی هم‌زمان شماره {index}."
                }),
            ]
            for index, client in enumerate(clients, start=1)
        ])
        results.extend(item for visitor in leads for item in visitor)

        checkouts = stage(executor, [
            lambda index=index, client=client: call(client, "POST", f"{base_url}/api/orders/checkout/", {
                "customer_name": f"tester-{index}", "phone": f"09{index:09d}",
                "province": "فارس", "city": "شیراز", "address": "نشانی آزمایشی کنترل‌شده",
                "payment_method": "coordination", "terms_accepted": True,
            })
            for index, client in enumerate(clients, start=1)
        ])
        results.extend(checkouts)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Run an authorised platform flow load test.")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--users", type=int, default=100)
    parser.add_argument("--product-id", required=True, type=int)
    args = parser.parse_args()
    if not 1 <= args.users <= 200:
        parser.error("--users must be between 1 and 200")

    started = time.perf_counter()
    results = run(args.base_url.rstrip("/"), args.users, args.product_id)
    elapsed = time.perf_counter() - started
    successful = [result for result in results if result.status and 200 <= result.status < 400]
    failed = [result for result in results if result not in successful]
    latencies = [result.duration_ms for result in results]
    percentile = lambda q: sorted(latencies)[min(len(latencies) - 1, round((len(latencies) - 1) * q))]
    statuses = Counter(str(result.status) if result.status else "network-error" for result in results)
    endpoints = Counter(result.endpoint.split("/api/")[-1].split("?")[0] for result in results)

    print("\n=== GarinKood all-public-flow load test ===")
    print(f"Virtual testers: {args.users}")
    print(f"Requests: {len(results)} | successful: {len(successful)} | failed: {len(failed)}")
    print(f"Wall time: {elapsed:.2f}s | throughput: {len(results) / elapsed:.1f} req/s")
    print(f"Latency: avg {statistics.mean(latencies):.1f}ms | p50 {percentile(.50):.1f}ms | p95 {percentile(.95):.1f}ms | max {max(latencies):.1f}ms")
    print(f"Status distribution: {dict(sorted(statuses.items()))}")
    print(f"Endpoint requests: {dict(sorted(endpoints.items()))}")
    if failed:
        print("First failures:")
        for failure in failed[:15]:
            print(f"  {failure.endpoint}: {failure.error or failure.status} ({failure.duration_ms:.1f}ms)")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())

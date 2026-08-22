#!/usr/bin/env python3
"""Concurrent seller/affiliate dashboard test for authorised local/staging use.

The token file must be a JSON array containing 1..100 token strings generated
for disposable test users. Never use production customer tokens in this tool.
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
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener


@dataclass(frozen=True)
class Result:
    endpoint: str
    status: int | None
    duration_ms: float
    body: dict | None = None
    error: str = ""


def call(token: str, method: str, url: str, payload: dict | None = None) -> Result:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json", "Authorization": f"Token {token}"}
    if data:
        headers["Content-Type"] = "application/json"
    started = time.perf_counter()
    try:
        response = build_opener().open(Request(url, data=data, headers=headers, method=method), timeout=30)
        raw = response.read()
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            body = None
        return Result(url, response.status, (time.perf_counter() - started) * 1000, body)
    except HTTPError as exc:
        raw = exc.read()
        try:
            body = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            body = None
        return Result(url, exc.code, (time.perf_counter() - started) * 1000, body, f"HTTP {exc.code}")
    except (URLError, TimeoutError, OSError) as exc:
        return Result(url, None, (time.perf_counter() - started) * 1000, None, str(getattr(exc, "reason", exc)))


def stage(executor: ThreadPoolExecutor, jobs):
    gate = threading.Event()

    def execute(job):
        gate.wait()
        return job()

    futures = [executor.submit(execute, job) for job in jobs]
    gate.set()
    return [future.result() for future in as_completed(futures)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run authorised authenticated platform load flows.")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--tokens-file", required=True)
    parser.add_argument("--run-id", default="run", help="Unique lowercase slug prefix for disposable test data")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    tokens = json.loads(open(args.tokens_file, encoding="utf-8").read())
    if not isinstance(tokens, list) or not 1 <= len(tokens) <= 100:
        parser.error("tokens file must contain between 1 and 100 disposable test tokens")

    results: list[Result] = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=len(tokens)) as executor:
        affiliate = stage(executor, [lambda token=token: call(token, "POST", f"{base}/api/affiliate/me/", {}) for token in tokens])
        results.extend(affiliate)

        storefronts = stage(executor, [
            lambda index=index, token=token: call(token, "POST", f"{base}/api/marketplace/storefront/", {
                "name": f"غرفه تست {args.run_id} {index}", "slug": f"{args.run_id}-stall-{index}",
                "seller_type": "farmer", "province": "فارس", "city": "شیراز",
            })
            for index, token in enumerate(tokens, start=1)
        ])
        results.extend(storefronts)

        listings = stage(executor, [
            lambda index=index, token=token: call(token, "POST", f"{base}/api/marketplace/listings/", {
                "title": f"محصول تست {args.run_id} {index}", "slug": f"{args.run_id}-listing-{index}",
                "crop_name": "گندم", "description": "آگهی کنترل‌شده برای تست همزمان.",
                "price": 10000 + index, "unit": "کیلوگرم", "quantity_available": "1000", "min_order_quantity": "10",
            })
            for index, token in enumerate(tokens, start=1)
        ])
        results.extend(listings)

        dashboard = stage(executor, [
            lambda token=token: [
                call(token, "GET", f"{base}/api/affiliate/me/"),
                call(token, "GET", f"{base}/api/marketplace/finance/"),
                call(token, "GET", f"{base}/api/marketplace/listings/mine/"),
            ]
            for token in tokens
        ])
        results.extend(item for user_results in dashboard for item in user_results)

    elapsed = time.perf_counter() - started
    success = [result for result in results if result.status and 200 <= result.status < 400]
    failed = [result for result in results if result not in success]
    latencies = [result.duration_ms for result in results]
    sorted_latencies = sorted(latencies)
    p95 = sorted_latencies[min(len(sorted_latencies) - 1, round((len(sorted_latencies) - 1) * .95))]
    statuses = Counter(str(result.status) if result.status else "network-error" for result in results)
    endpoints = Counter(result.endpoint.split("/api/")[-1] for result in results)
    print("\n=== GarinKood authenticated platform load test ===")
    print(f"Virtual testers: {len(tokens)}")
    print(f"Requests: {len(results)} | successful: {len(success)} | failed: {len(failed)}")
    print(f"Wall time: {elapsed:.2f}s | throughput: {len(results) / elapsed:.1f} req/s")
    print(f"Latency: avg {statistics.mean(latencies):.1f}ms | p95 {p95:.1f}ms | max {max(latencies):.1f}ms")
    print(f"Status distribution: {dict(sorted(statuses.items()))}")
    print(f"Endpoint requests: {dict(sorted(endpoints.items()))}")
    if failed:
        print("First failures:")
        for failure in failed[:20]:
            print(f"  {failure.endpoint}: {failure.error or failure.status} {failure.body or ''}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())

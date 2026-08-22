#!/usr/bin/env python3
"""A dependency-free, controlled load test for the public GarinKood API.

Run only against an environment you own or are authorised to test.  It models
independent visitors: each worker opens the catalogue, categories and a guest
cart, then optionally adds one known in-stock product.

Example:
    python scripts/load_test.py --base-url http://127.0.0.1:8000 --users 100 --product-id 1
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
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener


@dataclass(frozen=True)
class RequestResult:
    endpoint: str
    status: int | None
    elapsed_ms: float
    error: str | None = None


def percentile(samples: list[float], value: float) -> float:
    if not samples:
        return 0.0
    ordered = sorted(samples)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * value))
    return ordered[index]


def request(opener, method: str, url: str, payload: dict | None = None) -> RequestResult:
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    started = time.perf_counter()
    try:
        response = opener.open(Request(url, data=data, headers=headers, method=method), timeout=20)
        status = response.status
        response.read()
        return RequestResult(url, status, (time.perf_counter() - started) * 1000)
    except HTTPError as error:
        error.read()
        return RequestResult(url, error.code, (time.perf_counter() - started) * 1000, f"HTTP {error.code}")
    except (URLError, TimeoutError, OSError) as error:
        return RequestResult(url, None, (time.perf_counter() - started) * 1000, str(error.reason if isinstance(error, URLError) else error))


def create_visitor():
    """Each visitor retains an isolated cookie jar across test stages."""
    return build_opener(HTTPCookieProcessor(CookieJar()))


def browse_catalogue(opener, base_url: str) -> list[RequestResult]:
    return [
        request(opener, "GET", f"{base_url}/api/products/?page=1"),
        request(opener, "GET", f"{base_url}/api/categories/"),
        request(opener, "GET", f"{base_url}/api/cart/"),
    ]


def add_product(opener, base_url: str, product_id: int) -> RequestResult:
    return request(
        opener,
        "POST",
        f"{base_url}/api/cart/add/",
        {"product_id": product_id, "quantity": 1},
    )


def run_stage(executor: ThreadPoolExecutor, jobs):
    """Release a stage together so its requests are genuinely concurrent."""
    start_at = threading.Event()

    def run(job):
        start_at.wait()
        return job()

    futures = [executor.submit(run, job) for job in jobs]
    start_at.set()
    return [future.result() for future in as_completed(futures)]


def render_summary(results: Iterable[RequestResult], users: int, elapsed: float) -> int:
    flattened = list(results)
    success = [item for item in flattened if item.status is not None and 200 <= item.status < 400]
    failures = [item for item in flattened if item not in success]
    timings = [item.elapsed_ms for item in flattened]
    by_endpoint = Counter(item.endpoint.split("/api/")[-1].split("?")[0] for item in flattened)
    statuses = Counter(str(item.status) if item.status is not None else "network-error" for item in flattened)

    print("\n=== GarinKood controlled load-test report ===")
    print(f"Virtual visitors: {users}")
    print(f"Requests: {len(flattened)} | successful: {len(success)} | failed: {len(failures)}")
    print(f"Wall time: {elapsed:.2f}s | throughput: {len(flattened) / elapsed:.1f} requests/s")
    if timings:
        print(
            "Latency: "
            f"avg {statistics.mean(timings):.1f}ms | "
            f"p50 {percentile(timings, 0.50):.1f}ms | "
            f"p95 {percentile(timings, 0.95):.1f}ms | "
            f"max {max(timings):.1f}ms"
        )
    print(f"Status distribution: {dict(sorted(statuses.items()))}")
    print(f"Endpoint requests: {dict(sorted(by_endpoint.items()))}")
    if failures:
        print("First failures:")
        for failure in failures[:10]:
            print(f"  {failure.endpoint}: {failure.error or failure.status} ({failure.elapsed_ms:.1f}ms)")
    return 0 if not failures else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Run an authorised GarinKood API load test.")
    parser.add_argument("--base-url", required=True, help="Owned target, e.g. http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=100, help="Concurrent virtual visitors (default: 100)")
    parser.add_argument("--product-id", type=int, help="Optional in-stock product ID to add to each guest cart")
    args = parser.parse_args()

    if not 1 <= args.users <= 500:
        parser.error("--users must be between 1 and 500 for this controlled test.")

    base_url = args.base_url.rstrip("/")
    visitors = [create_visitor() for _ in range(args.users)]
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.users) as executor:
        # Staging prevents a visitor's first session write from overlapping a
        # later cart action while still applying full concurrency to each user
        # journey step. This reflects an actual browse-then-buy flow.
        browse_results = run_stage(
            executor,
            [lambda opener=opener: browse_catalogue(opener, base_url) for opener in visitors],
        )
        results = [item for visitor_results in browse_results for item in visitor_results]
        if args.product_id is not None:
            results.extend(
                run_stage(
                    executor,
                    [
                        lambda opener=opener: add_product(opener, base_url, args.product_id)
                        for opener in visitors
                    ],
                )
            )
    elapsed = time.perf_counter() - started
    return render_summary(results, args.users, elapsed)


if __name__ == "__main__":
    sys.exit(main())

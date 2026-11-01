---
title: VoucherBot
abstract: Automated certification deal discovery platform that continuously monitors online sources, uses AI to filter genuine voucher opportunities, stores discovered offers and delivers timely notifications.
categories:
  - automation
  - backend engineering
  - ai
publishDate: 2026-01-05T12:00-00:00
workOrder: 2
projectStyle: dashboard
isFeatured: true
prominence: secondary
titleSplitIndex: 5
theme:
  fill: "url('/img/projects/voucherbot/voucherbot.png')"
  accent: '#5b3a12'
  contrast: '#fff'
cover: /img/projects/voucherbot/voucherbot.png
coverAlt: VoucherBot
repo: https://github.com/Devathmaj/VoucherBot
highlights:
  - value: 6 stages
    label: Collect to notify
  - value: Groq + Gemini
    label: AI extraction fallback
  - value: PostgreSQL
    label: Sources, posts, events
---

![VoucherBot](/img/projects/voucherbot/voucherbot.png)

## Overview

VoucherBot is a service for discovering certification-related promotions, vouchers and discount announcements. It monitors a curated catalog of public sources, filters posts for likely voucher content, uses AI to extract structured promotion details and surfaces the results through a small API and timely notifications.

The problem is not a lack of information but the noise around it. Certification vouchers appear across vendor blogs, community forums, event pages and RSS feeds, often with inconsistent wording and short lifespans. VoucherBot turns that stream into a structured, deduplicated feed.

## The ingestion pipeline

Every source passes through the same pipeline.

1. **Collect.** Reddit sources use the Reddit collector, feed-based sources use the RSS collector and page-based sources use the website collector.
2. **Filter.** Posts are scored against an enabled keyword catalog. Anything below the threshold is dropped, while curated pages with a note selector can bypass the filter.
3. **Deduplicate.** Identity is derived from a normalised URL and content hashes detect changes. Unchanged posts are skipped; new or edited posts are upserted.
4. **Extract.** New and updated posts go to the AI analyzer, which returns structured promotion data and a flag indicating whether the post is a genuine voucher.
5. **Match events.** Extracted data is matched to a canonical event or used to create a new one, with confidence classified as auto-merged, possible match or new.
6. **Notify.** Voucher candidates are queued through a transactional outbox and emailed once the send succeeds.

The source catalog and keyword inventory are seeded from a bootstrap module rather than hard-coded into the schema, so new sources can be added by extending the catalog and configuration.

## Sources, scheduling and AI

The scheduler runs inside the same process as the API and uses the `sources` table as its scheduling state. A source becomes eligible when it is enabled, not in backoff and due. A row-level lease in the `pipeline_lock` table lets the dispatcher claim one source at a time, update the schedule after success or failure, apply exponential backoff for recoverable failures and disable a source immediately on unrecoverable client errors such as 401, 403, 404 or 410.

HTTP requests share a policy layer that respects robots rules, crawl delay and a consistent user agent. The AI layer tries Groq first and falls back to Gemini, with concurrent provider attempts, rate limiting, token budgets, retries and a structured JSON schema for the extracted event data.

## Alerts and delivery

Voucher details include the vendor, promotion name, certification list, discount, voucher code, registration URL and date information. The same payload can be emailed through Resend and posted to a remote bot server webhook for Discord and Telegram delivery.

![Voucher notifications](/img/projects/voucherbot/voucherbot-notifications.png)

![Voucher detail view](/img/projects/voucherbot/voucherbot-voucher-detail.png)

![AWS certification listings](/img/projects/voucherbot/voucherbot-aws-listings.png)

![VoucherBot in Telegram](/img/projects/voucherbot/voucherbot-telegram.png)

![VoucherBot in Discord](/img/projects/voucherbot/voucherbot-discord.png)

![VoucherBot support](/img/projects/voucherbot/voucherbot-support.png)

![VoucherBot disclaimer](/img/projects/voucherbot/voucherbot-disclaimer.png)

## Data model

The core model is intentionally simple. Sources store polling state, priority and scheduling metadata. Posts store ingested content, the AI analysis and deduplication fields. Events store canonical promotions and merge history. Keywords drive scoring, vendor mappings resolve names to canonical vendors, the notification outbox makes email delivery transactional and a read-only view exposes AI-confirmed vouchers. Many posts can reference the same event while remaining distinct records.

![VoucherBot on GitHub](/img/projects/voucherbot/voucherbot-github.png)

## Stack

Python, FastAPI, SQLAlchemy async, asyncpg, PostgreSQL, Alembic, Groq, Google Gemini, Reddit API, Resend, Docker, Render.

## Codebase

[View VoucherBot on GitHub](https://github.com/Devathmaj/VoucherBot)

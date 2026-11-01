---
title: ConfessIt
abstract: Full-stack social platform that provides a safe, anonymous space for users to share confessions, discover connections, exchange love notes and interact through lightweight social games.
categories:
  - full-stack
  - social platform
  - backend engineering
publishDate: 2026-01-06T12:00-00:00
workOrder: 1
projectStyle: dashboard
isFeatured: true
prominence: primary
titleSplitIndex: 4
theme:
  fill: "url('/img/projects/confessit/confessit.png')"
  accent: '#5c1f2b'
  contrast: '#fff'
cover: /img/projects/confessit/confessit.png
coverAlt: The ConfessIt landing page
repo: https://github.com/Devathmaj/ConfessIt-V2
highlights:
  - value: 3 roles
    label: Participant, moderator, admin
  - value: AES-256-GCM
    label: Chat encryption at rest
  - value: 9 games
    label: Social game platform
---

![The ConfessIt landing page](/img/projects/confessit/confessit.png)

## Overview

ConfessIt is a full-stack social platform built around anonymous sharing. Participants can post confessions, react and comment, discover compatible people through matchmaking, send anonymous love notes and play lightweight social games together.

The platform has to be welcoming without being careless. Anonymous social products attract spam, abuse and privacy problems, so ConfessIt treats safety as an architectural concern rather than a moderation afterthought. Authentication, content moderation, private images, chat encryption and staff review are all designed into the system.

## What it does

- Anonymous confession sharing with reactions, comments, likes and dislikes
- A matchmaking system for discovering and connecting with potential matches
- Anonymous love notes for private, lightweight social interactions
- A suite of mini-games designed to help people break the ice
- Customisable profiles with bios, interests and profile pictures
- Passwordless magic-link authentication
- Separate participant, moderator and administrator experiences
- In-app notifications with optional email delivery

The public landing page introduces the product and its tone before a participant ever reaches the more personal parts of the app.

![The ConfessIt landing page](/img/projects/confessit/confessit-landing.png)

## A safer social platform

ConfessIt uses a deliberately split credential model. Access tokens are short-lived and held only in memory, refresh tokens are stored in HttpOnly cookies and rotated on every use and WebSocket connections use short-lived, single-use tickets. Route guards in the frontend are only a convenience; every protected operation is re-checked by the backend.

Content passes through Azure AI Content Safety before it is stored. Flagged confessions and comments are hidden and an automated report is created for staff. Love-note images are stored as private Cloudinary objects and served through entitlement-checked signed URLs. PII detection produces a redacted preview before a moderator reviews a note.

Chat bodies are encrypted at rest with versioned AES-256-GCM keys, while Redis pub/sub provides live message fan-out and PostgreSQL remains the durable transcript.

## Matchmaking, chat and love notes

Matchmaking is mutual selection within configurable slots. A match expires four hours after creation and a conversation must be accepted before either person can send a message. Reported messages are captured as encrypted evidence with their own retention window and access audit trail.

Love notes follow a review-first flow. The body is scanned for personal information, the image is stored privately and a moderator sees a redacted preview before approving or rejecting delivery. Recipients can report notes that reach their inbox.

![Matchmaking in ConfessIt](/img/projects/confessit/confessit-matchmaking.png)

## Games and leaderboards

ConfessIt includes a games platform with Wordle, Anagram, Connections, Trivia Drop, Couple Questionnaire, Two-Key Escape, Reaction Time, Plot Twist and Case Closed. Period-based games share a session lifecycle, while AI-generated Plot Twist and Case Closed packages are produced ahead of play so gameplay never waits on a language model.

Every opened game session is snapshotted as a league opportunity. When it closes, results are ranked, normalised to a 0-100 base, weighted for featured games and written as awards. Those awards power the individual, couple, per-game, category and all-time leaderboards.

![The ConfessIt games hub](/img/projects/confessit/confessit-games.png)

![A Wordle game in ConfessIt](/img/projects/confessit/confessit-games-wordle.png)

![The ConfessIt leaderboard](/img/projects/confessit/confessit-games-leaderboard.png)

## More than confessions

Seasonal features and small social moments keep the product feeling alive. The Valentine's experience, for example, gives the platform a themed way to surface notes and interactions.

![The ConfessIt Valentine's experience](/img/projects/confessit/confessit-valentine.png)

## Operating the platform

ConfessIt ships with an observability stack built on OpenTelemetry, Prometheus, Grafana, Loki and Tempo. Backend traces, database spans, Redis spans and HTTP metrics flow through an OpenTelemetry collector and a daily game-reset heartbeat makes a stalled scheduler visible.

![The ConfessIt Grafana dashboard](/img/projects/confessit/confessit-grafana.png)

## Architecture

- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS and Radix/shadcn-style components.
- **Backend:** FastAPI, SQLAlchemy 2, Pydantic 2, PostgreSQL, Redis and Alembic migrations.
- **External services:** Azure AI Content Safety, Azure AI Language PII detection, Azure Functions and ACS Email, Cloudinary and Groq or Microsoft Foundry for game generation.
- **Delivery:** Docker Compose for the full stack, Nginx at the edge and a separate scheduler process for daily resets.

## Stack

React, TypeScript, Vite, Tailwind CSS, FastAPI, Python, PostgreSQL, Redis, Cloudinary, Azure, Docker, Prometheus, Grafana, Loki, Tempo.

## Codebase

[View ConfessIt on GitHub](https://github.com/Devathmaj/ConfessIt-V2)

---
title: Football Market Intelligence
abstract: Production-grade football analytics platform combining machine learning, live football data, Elo ratings, squad and injury data, Monte Carlo tournament simulations and prediction market odds to estimate fair probabilities and identify potentially mispriced markets.
categories:
  - machine learning
  - data engineering
  - backend engineering
publishDate: 2026-01-04T12:00-00:00
workOrder: 3
projectStyle: dashboard
isFeatured: false
prominence: tertiary
titleSplitIndex: 8
theme:
  fill: "url('/img/projects/football-market-intelligence/football-market.png')"
  accent: '#14532d'
  contrast: '#fff'
cover: /img/projects/football-market-intelligence/football-market.png
coverAlt: Football Market Intelligence
repo: https://github.com/Devathmaj/Football-Market-Intelligence
highlights:
  - value: 6 stages
    label: Ingestion to evaluation
  - value: XGBoost
    label: Match outcome probabilities
  - value: Monte Carlo
    label: Tournament simulation
---

![Football Market Intelligence](/img/projects/football-market-intelligence/football-market.png)

## Overview

Football Market Intelligence is a prediction and market analysis platform for international football. It compares bookmaker and prediction-market odds against proprietary probability models to surface markets that look mispriced.

The system behaves like an automated quantitative analyst. It ingests historical results and live football data, engineers features such as Elo ratings, rest days, travel distance, squad value and head-to-head history, trains models to estimate match outcomes, simulates entire tournaments and evaluates the resulting probabilities against market prices.

## How the engine works

The pipeline runs in stages, with each stage writing to its own PostgreSQL schema.

1. **Ingestion.** Historical datasets and live API-Football responses are stored first in a raw schema so parsing can be re-run without spending API credits again.
2. **Normalisation.** Teams, players, matches and match events are resolved into a clean relational core, including name mapping across data providers.
3. **Feature engineering.** Elo ratings, rest days, travel, squad market value and head-to-head records are computed into a wide match-features table using only information available before kickoff.
4. **Prediction.** XGBoost estimates home, draw and away probabilities, while logistic regression provides an interpretable baseline and anomaly check.
5. **Simulation.** Monte Carlo runs of the full tournament structure update the probability of every team reaching every stage, including extra time and penalty shootouts.
6. **Evaluation.** Model probabilities are compared with current market odds. When the model's implied probability exceeds the bookmaker's by a configurable margin, the opportunity is recorded.

Risk filters exclude illiquid bookmakers, volatile markets and excessive exposure so the output is not just a list of mathematically positive bets.

## Product tour

The frontend is a Next.js dashboard for analysts, with views for upcoming matches, model probabilities, live opportunities, tournament simulation and historical performance.

![Active markets](/img/projects/football-market-intelligence/football-market-active-markets.png)

![Custom matchup analysis](/img/projects/football-market-intelligence/football-market-custom-matchup.png)

![Model outputs](/img/projects/football-market-intelligence/football-market-models.png)

![Tournament simulator](/img/projects/football-market-intelligence/football-market-tournament-simulator.png)

![World Cup statistics](/img/projects/football-market-intelligence/football-market-world-cup-stats.png)

![System status](/img/projects/football-market-intelligence/football-market-system-status.png)

## Data and modelling notes

The platform maintains a clear separation between raw provider payloads, normalised domain data, computed features, model outputs, market odds and actionable opportunities. Alembic migrations version the database schema and a cold-start path bootstraps an empty database by ingesting history, building features and training the first model before the API begins serving requests.

Background pollers keep fixtures, lineups, injuries and odds current. A completed match can trigger a fresh tournament simulation, which quickly updates futures probabilities before bookmakers fully adjust.

![Football Market Intelligence on GitHub](/img/projects/football-market-intelligence/football-market-github.png)

## Stack

Next.js, TypeScript, Tailwind CSS, FastAPI, Python, XGBoost, Logistic Regression, PostgreSQL, Alembic, Docker, Docker Compose, API-Football, Monte Carlo simulation.

## Codebase

[View Football Market Intelligence on GitHub](https://github.com/Devathmaj/Football-Market-Intelligence)

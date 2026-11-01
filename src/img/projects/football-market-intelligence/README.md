# Football Market Intelligence Engine - Comprehensive Project Overview

This document serves as the canonical, highly detailed reference guide and architectural overview for the **Football Market Intelligence Engine** (also known as Football Market Intelligence). It spans all aspects of the system, including domain logic, software architecture, data pipelines, machine learning models, simulation engines and deployment strategies.

---

## Table of Contents

1. [Executive Summary & Vision](#1-executive-summary--vision)
2. [Domain Background: Football Betting Markets](#2-domain-background-football-betting-markets)
3. [System Architecture](#3-system-architecture)
4. [Data Ingestion and Pipelines](#4-data-ingestion-and-pipelines)
5. [Database Design and Schemas](#5-database-design-and-schemas)
6. [Machine Learning and Predictive Modeling](#6-machine-learning-and-predictive-modeling)
7. [Simulation Engine](#7-simulation-engine)
8. [Market Evaluation and Value Betting](#8-market-evaluation-and-value-betting)
9. [Backend Implementation Details](#9-backend-implementation-details)
10. [Frontend Implementation Details](#10-frontend-implementation-details)
11. [DevOps, Docker and Deployment](#11-devops-docker-and-deployment)
12. [System Workflows](#12-system-workflows)
13. [Future Enhancements and Roadmap](#13-future-enhancements-and-roadmap)

---

## 1. Executive Summary & Vision

The **Football Market Intelligence Engine** is a prediction and market analysis platform. Its primary goal is to identify mispriced betting markets for the World Cup by comparing real-time bookmaker odds against proprietary, data-driven probability models.

At its core, the system acts as an automated quantitative analyst for sports markets. Rather than relying on intuition or simple heuristic rules, the engine leverages:
- **Historical Data:** Decades of international match results (e.g., Fjelstul World Cup Database).
- **Advanced Machine Learning:** Models like XGBoost and Logistic Regression to predict match outcomes (1X2, Over/Under, Both Teams to Score).
- **Monte Carlo Simulations:** Simulating entire tournaments thousands of times to determine the probability of specific teams reaching certain stages (e.g., "Team A to reach Semi-Finals").
- **Live Data Feeds:** Ingesting real-time odds, lineups and injury reports via the API-Football integration.

By continuously polling the market and recalculating probabilities, the system highlights "Value Bets" — instances where the bookmakers' implied probability is lower than our model's predicted probability, thereby yielding a positive Expected Value (EV).

---

## 2. Domain Background: Football Betting Markets

To understand the system, one must understand the financial mechanics of sports betting.

### 2.1 The Mechanics of Odds
Bookmakers offer odds in various formats, but the underlying concept is always an "Implied Probability".
- **Decimal Odds (European):** E.g., `2.50`. Implied Probability = `1 / 2.50 = 0.40` (or 40%).
- **Fractional Odds (UK):** E.g., `6/4`. Implied Probability = `4 / (6 + 4) = 0.40`.
- **American Odds (Moneyline):** E.g., `+150`. Implied Probability = `100 / (150 + 100) = 0.40`.

Our system standardizes all ingested market data into Decimal odds for internal mathematical operations.

### 2.2 The Vigorish (Overround)
Bookmakers do not offer fair odds. If Team A and Team B are perfectly matched (50% chance each), fair decimal odds would be `2.00` and `2.00`. However, a bookmaker will typically offer `1.90` and `1.90`.
- Implied Prob A: `1 / 1.90 = 0.526`
- Implied Prob B: `1 / 1.90 = 0.526`
- Total Market Percentage = `0.526 + 0.526 = 1.052` (105.2%)

That extra 5.2% is the **Vigorish** (vig), overround or bookmaker's margin. It ensures the bookmaker makes a profit over the long run regardless of the outcome, assuming perfectly balanced action. Our system's goal is to find odds that are so poorly priced by the bookmaker that they overcome this vig.

### 2.3 Value Betting
A "Value Bet" occurs when:
`True Probability > Implied Probability`
Or, mathematically:
`True Probability * Decimal Odds > 1.0`

For example, if our XGBoost model determines Team A has a `50%` (`0.50`) chance of winning, but the bookmaker offers decimal odds of `2.20` (implied probability `45.4%`), the Expected Value (EV) for a $1 bet is:
`EV = (Probability of Win * Profit) - (Probability of Loss * Stake)`
`EV = (0.50 * $1.20) - (0.50 * $1.00) = $0.60 - $0.50 = +$0.10` (a 10% edge).

The Market Intelligence Engine systematically searches for these edges.

### 2.4 Arbitrage (Surebets)
Arbitrage occurs when different bookmakers offer differing odds on the same event, such that backing all outcomes guarantees a profit. While rare and quickly corrected by the market, our `market_evaluator` continuously cross-references odds across providers (e.g., Bet365, Pinnacle, DraftKings) to flag arbitrage opportunities.

### 2.5 The Kelly Criterion
Once a value bet is identified, the system must decide *how much* of a bankroll should theoretically be allocated. The Kelly Criterion is a formula used for this:
`f* = (bp - q) / b`
Where:
- `f*` = fraction of the bankroll to wager
- `b` = decimal odds - 1
- `p` = probability of winning (from our ML model)
- `q` = probability of losing (1 - p)

Our analytics dashboard visualizes Kelly recommendations alongside the identified value bets.

---

## 3. System Architecture

The application follows a modern, decoupled, microservices-oriented architecture running within Docker containers.

### 3.1 Container Topology
The `docker-compose.yml` defines the following primary services:
1. **`db` (PostgreSQL):** The central relational datastore containing all historical data, market data and model predictions.
2. **`backend` (FastAPI/Python):** The core intelligence engine. It handles API requests, background data polling and triggering ML pipelines.
3. **`frontend` (Next.js/React):** The user interface providing dashboards for analysts to review predictions and market opportunities.
4. **`prometheus` (Optional Analytics):** For system monitoring and metrics.

### 3.2 High-Level Data Flow
1. **Ingestion:** Background scripts (`scripts/poll_api_football.py`) hit external REST APIs (API-Football) and store raw JSON in the database.
2. **Transformation:** Data is moved from the `raw` schema into normalized relational tables in the `core` schema.
3. **Feature Engineering:** `ml/feature_pipeline.py` extracts features (Elo, resting days, squad value) and writes to the `features` schema.
4. **Prediction:** Models (`ml/train_xgboost.py`, etc.) read features, generate probabilities and write to the `predictions` schema.
5. **Evaluation:** `app/evaluation/market_evaluator.py` compares `predictions` vs `market` odds, generating rows in the `opportunities` schema.
6. **Presentation:** The Next.js frontend queries the FastAPI backend to display these `opportunities` to the user in real-time.

---

## 4. Data Ingestion and Pipelines

Accurate predictions require high-quality data. The system uses a dual-source approach: historical static datasets for training and live dynamic APIs for inference.

### 4.1 Static Historical Data (Fjelstul Database and Others)
For training models on World Cup data, the engine relies heavily on comprehensive datasets covering international football history.
Various ingestion scripts (such as `scripts/ingest_data.py`, `scripts/ingest_market_values.py`, `scripts/populate_elo_fifa.py` and `scripts/ingest_transfermarkt_players.py`) handle:
- Parsing `matches.csv`, `players.csv`, `teams.csv`.
- Normalizing team names (crucial for international football where naming conventions vary, e.g., "USA" vs "United States", "Korea Republic" vs "South Korea").
- Resolving historical anomalies (e.g., West Germany vs Germany).

### 4.2 Dynamic Live Data (API-Football)
For real-time operational capability, the system integrates with **API-Football**.
- **Fixtures & Results:** Polled every 6 hours to update the core database.
- **Lineups & Injuries:** Polled at the same time as fixtures. If a star player (e.g., Mbappe, Messi) is unexpectedly benched, the system must detect this and immediately trigger a model recalculation.
- **Market Odds:** Polled continuously (e.g., every 5-15 minutes) for upcoming matches to track line movement and identify fleeting value bets.

### 4.3 Data Normalization Strategy
A major challenge in sports analytics is identity resolution across different data providers. The system implements a robust mapping layer in the `core.teams` and `core.players` tables to ensure that the "Brazil" from our CSV dataset exactly matches the "Brazil" provided by the live API.

---

## 5. Database Design and Schemas

To maintain a clean separation of concerns, the PostgreSQL database is divided into distinct operational schemas, initialized via `init-schemas.sql`.

### 5.1 The `raw` Schema
Stores raw, unprocessed data exactly as received from external sources.
- Tables: `raw_api_responses`, `raw_csv_dumps`.
- Purpose: Acts as a data lake. If parsing logic changes, we can re-process historical data without needing to re-fetch from the API (saving API credits).

### 5.2 The `core` Schema
The normalized, relational truth of the football domain.
- **`core.teams`:** Team ID, Name, FIFA Code, Confederation.
- **`core.players`:** Player ID, Name, Position, Date of Birth.
- **`core.matches`:** Match ID, Home Team, Away Team, Date, Competition, Status.
- **`core.match_events`:** Goals, Cards, Substitutions linked to specific minutes and players.

### 5.3 The `features` Schema
Stores computed metrics used specifically for machine learning.
- **`features.team_elo`:** Historical and current Elo ratings.
- **`features.match_features`:** A flattened, wide table where each row represents a match and columns represent the features available *exactly* prior to kickoff (e.g., `home_elo_diff`, `away_rest_days`, `home_squad_value`). Crucially, this prevents data leakage.

### 5.4 The `market` Schema
Stores bookmaker data.
- **`market.odds`:** Match ID, Bookmaker ID, Market Type (1X2, Over/Under 2.5), Selection (Home, Draw, Away), Decimal Price, Timestamp. This table is highly volatile and grows rapidly.

### 5.5 The `predictions` and `opportunities` Schemas
- **`predictions.model_outputs`:** The probabilistic output of our ML models.
- **`opportunities.value_bets`:** The actionable outputs, joining predictions against market odds to log identified EV+ bets.

### 5.6 Alembic Migrations
The `backend/alembic/` directory contains the version control for the database schema. All changes to the database structure (adding a column, creating an index) are handled via Alembic revision scripts, ensuring deterministic deployments.

---

## 6. Machine Learning and Predictive Modeling

The ML pipeline is executed via `run_ml_pipeline.py`, which orchestrates feature generation and model training.

### 6.1 Feature Engineering Pipeline
The success of the predictive models relies entirely on the quality of the features. `ml/feature_pipeline.py` calculates:
1. **Elo Ratings:** A zero-sum rating system originally developed for chess. When Team A beats Team B, points are transferred from B to A based on the expected outcome. We maintain historical Elo ratings for all national teams, heavily weighted by recent tournament performance.
2. **Rest Days:** The number of days a team has rested since their last competitive match. Crucial in tightly packed tournaments like the World Cup.
3. **Travel Distance:** Approximate geographic distance traveled between venues.
4. **Squad Market Value:** Aggregated financial valuations of the starting XI (often derived from sources like Transfermarkt), acting as a proxy for raw talent.
5. **Head-to-Head History:** Historical dominance between two specific nations.

### 6.2 The XGBoost Model (`ml/train_xgboost.py`)
XGBoost (eXtreme Gradient Boosting) is the primary engine for prediction.
- **Why XGBoost?** It excels at tabular data, handles non-linear relationships gracefully and provides built-in mechanisms for dealing with missing data (e.g., missing squad value for a minor team).
- **Target Variables:** The model is trained on a multi-class objective (`objective='multi:softprob'`) predicting 0 (Away Win), 1 (Draw) and 2 (Home Win).
- **Hyperparameter Tuning:** Grid search or random search over `max_depth`, `learning_rate`, `n_estimators` and `subsample` to prevent overfitting.
- **Output:** An array of probabilities: `[P(Away), P(Draw), P(Home)]`.

### 6.3 The Logistic Regression Baseline (`ml/train_logistic_regression.py`)
A simpler, highly interpretable model used as a baseline and sanity check. If the complex XGBoost model drastically diverges from the Logistic Regression output, it triggers an anomaly flag. Logistic regression is particularly useful for extracting clear feature coefficients (e.g., "Every 100 points of Elo difference adds X% to win probability").

### 6.4 Backtesting Framework (`ml/backtest_model.py` and `ml/historical_validation.py`)
To prove the model's profitability, it is run against historical market odds in a simulated betting environment.
- The backtester iterates through historical matches chronologically.
- It "places" simulated bets whenever the model identifies a Value Bet.
- It calculates Return on Investment (ROI) and Yield over time.
- It includes realistic parameters like simulating a 5% bookmaker margin and applying Kelly Criterion sizing.

---

## 7. Simulation Engine

While ML models predict individual match outcomes, the `app/simulation/` directory handles full-tournament dynamics.

### 7.1 Monte Carlo Tournament Simulation
To price complex "Futures" markets (e.g., "Will France win the World Cup?", "Will England reach the Semi-Finals?"), the system uses Monte Carlo methods.
- The entire tournament structure (Group Stage -> Round of 16 -> Quarters -> Semis -> Final) is programmed into the engine.
- The engine simulates the tournament 10,000 to 100,000 times.
- For each simulated match, a random number is drawn against the model's predicted probabilities to determine the winner.
- If it's a knockout match, draws are resolved via simulated extra time or penalty shootouts (using historical conversion rates).
- The output is a probability distribution for every team reaching every stage.

### 7.2 Dynamic Re-simulation
The power of the simulation engine is its dynamic nature. As soon as a real-world match concludes (e.g., Argentina unexpectedly loses their first group game), the entire simulation is re-run. This instantly updates the probability of Argentina advancing, allowing the system to rapidly identify mispriced odds in the live futures market before bookmakers fully adjust.

---

## 8. Market Evaluation and Value Betting

The core business logic resides in `app/evaluation/market_evaluator.py` and `app/simulation/market_parser.py`.

### 8.1 Market Parsing
Bookmaker APIs often provide data in messy, highly nested JSON structures. `market_parser.py` is responsible for extracting the relevant decimal odds for specific selections and normalizing the data structure. It standardizes market identifiers (e.g., mapping "Full Time Result" to "1X2", mapping "Total Goals Over 2.5" to "O/U 2.5").

### 8.2 The Evaluation Loop
The `market_evaluator.py` service runs continuously:
1. Fetch latest predictions from the `predictions` schema.
2. Fetch the most recent odds snapshot from the `market` schema.
3. Iterate through all available markets for a match.
4. Compare `Model Implied Probability` against `Bookmaker Implied Probability`.
5. If `Model Prob > Bookmaker Prob + Threshold` (where Threshold is a configurable margin of safety, e.g., 2% to account for model variance), register an Opportunity.

### 8.3 Risk Management and Filtering
Not all mathematically positive EV bets should be taken. The evaluator includes filtering logic:
- **Liquidity Filters:** Ignoring odds from obscure bookmakers with low betting limits.
- **Volatility Filters:** Flagging markets where odds are swinging wildly, which might indicate asymmetric information (e.g., a leaked injury) that the model hasn't ingested yet.
- **Maximum Exposure:** Tracking simulated bankroll to ensure the system doesn't recommend over-exposure on a single match or team.

---

## 9. Backend Implementation Details

The backend is built with FastAPI, providing a high-performance, asynchronous REST API.

### 9.1 Entry Point (`main.py`)
The `main.py` script serves as the master orchestrator. Upon startup, it:
- Triggers Alembic migrations to ensure the DB is up to date.
- Checks if the database is empty (`check_db_empty()`).
- If empty, it automatically triggers the ingestion scripts, market value population and the initial ML feature pipeline to bootstrap the system.
- Spawns background processes (like `poll_api_football.py`).
- Boots the Uvicorn ASGI server to serve the FastAPI application.

### 9.2 API Routing (`app/api/`)
Defines the HTTP endpoints consumed by the Next.js frontend.
- `GET /api/matches` - Returns scheduled matches and their predictions.
- `GET /api/opportunities` - Returns live value bets.
- `POST /api/simulate` - Triggers a manual Monte Carlo simulation.
- `GET /api/analytics/performance` - Returns historical ROI data.

### 9.3 Services and Repositories (`app/services/`, `app/repositories/`)
Following domain-driven design principles:
- **Repositories:** Handle direct database interaction (SQLAlchemy queries). E.g., `MatchRepository.get_upcoming()`.
- **Services:** Contain the business logic. They call repositories, process the data and return standard DTOs (Data Transfer Objects) to the API layer. E.g., `MarketService.evaluate_match(match_id)`.

### 9.4 Asynchronous Operations
By utilizing `AsyncSessionLocal` from SQLAlchemy, the backend handles thousands of concurrent requests efficiently, crucial for a system that must constantly poll data and serve real-time web dashboards.

---

## 10. Frontend Implementation Details

The frontend (`frontend/` directory) is a modern web application built for data analysts.

### 10.1 Technology Stack
- **Framework:** Next.js (App Router paradigm).
- **Language:** TypeScript for type safety across the full stack.
- **Styling:** Tailwind CSS for rapid, utility-first UI development.
- **Components:** React components (`frontend/components/cards.tsx`) often utilizing headless UI libraries like shadcn/ui for accessible, beautiful interactive elements.

### 10.2 Core Dashboards
1. **The 'Command Center' (Home):** Displays upcoming high-profile matches, live system status (polling health, model freshness) and a ticker of the most recent highly profitable opportunities found.
2. **Match Analysis View:** A deep dive into a specific fixture. Shows the XGBoost probabilities, Historical Elo charts, recent team form and a comparison matrix of all bookmaker odds currently available.
3. **Simulation Hub:** A visual representation of the Monte Carlo tournament output. Displays an interactive bracket where users can click a team to see their simulated probability of reaching various stages.
4. **Performance Analytics:** Charts and graphs displaying the theoretical historical ROI of the model if all recommended bets were placed.

### 10.3 Services Integration (`frontend/lib/services.ts`)
This file handles communication with the FastAPI backend. It utilizes native `fetch` or libraries like `axios` or `SWR`/`React Query` to poll for live updates. It defines TypeScript interfaces that strictly map to the JSON responses from the backend, ensuring frontend reliability.

---

## 11. DevOps, Docker and Deployment

The entire system is containerized to ensure "works on my machine" translates to "works in production."

### 11.1 Docker Compose
The `docker-compose.yml` orchestrates the multi-container environment.
- Maps internal ports to host ports (e.g., PostgreSQL on 5432, FastAPI on 8080, Next.js on 3000).
- Manages volumes to ensure database persistence between container restarts.
- Sets up internal networking so the backend can communicate directly with the database using internal service names (e.g., `postgres://user:pass@db:5432/wc_database`).

### 11.2 Environment Configuration
Sensitive data and environment-specific settings are managed via `.env` files.
- `DATABASE_URL`: Connection string.
- `API_FOOTBALL_KEY`: Secret key for data ingestion.
- `ENVIRONMENT`: Distinguishes between `development`, `staging` and `production`.

### 11.3 CI/CD and Updating
Updating the application involves pulling the latest Git changes and rebuilding the containers (`docker compose up --build`). In a production scenario, this would be handled by a CI/CD pipeline (e.g., GitHub Actions) that runs tests, builds images and pushes them to a registry before rolling deployment.

---

## 12. System Workflows

Understanding the chronological flow of operations is critical.

### 12.1 The "Cold Start" Boot Sequence
When spinning up a fresh instance:
1. Docker initializes PostgreSQL.
2. FastAPI backend boots. `main.py` detects an empty DB.
3. Alembic creates all tables.
4. `scripts/ingest_data.py` loads CSV history.
5. `ml/feature_pipeline.py` calculates historical Elos and features.
6. `ml/train_xgboost.py` trains the initial model.
7. Backend begins serving requests and starts the polling loop.

### 12.2 Continuous Polling Loops
Instead of strict cron-based schedules or dynamic match-day loops, the system currently relies on continuous background polling processes and standalone scripts.
1. **API Football Poller (`poll_api_football.py`):** This script runs continuously in the background (launched by `main.py`). After an initial 10-minute startup delay to ensure database readiness, it enters a loop where it:
   - Executes `fetch_wc_data.py` to retrieve the latest 2026 World Cup data.
   - Executes `scripts/ingest_api_football.py` to process and store this data in the database.
   - Sleeps for 6 hours before repeating the cycle.

2. **Betting Markets Poller (`poll_betting_markets.py`):** A script that fetches current prediction market data from Polymarket and Kalshi. It parses the odds, attempts fuzzy matching to map markets to internal team IDs and records snapshots of implied probabilities, volume and liquidity.

---

## 13. Future Enhancements and Roadmap

The architecture is built to be extensible. Future development phases include:

1. **Player-Level Analytics:** Transitioning from team-level metrics (Elo) to player-level expected goals (xG) and expected assists (xA) models. This would allow the system to price "Player Prop" markets (e.g., "Mbappe to score over 1.5 goals").
2. **Live In-Play Modeling:** Ingesting live match state (possession, dangerous attacks, clock time) to predict outcomes while the match is being played, capitalizing on market overreactions to early goals.
3. **Automated Bet Placement:** Integrating directly with bookmaker or exchange APIs (like Betfair) to automatically execute trades when value is found, completing the transition from an analytical tool to a fully automated algorithmic trading bot.
4. **Expansion Beyond World Cup:** Adapting the pipelines to ingest club data (Premier League, Champions League), which requires handling domestic cup fatigue, transfer windows and varying league qualities.

---
*End of Document. Maintained by the Advanced Agentic Coding Team.*

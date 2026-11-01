---
title: Winning Tracker
abstract: A Discord bot that tracks OwO mini-game sessions, parses coinflip, blackjack and slots results and stores wins, losses and net profit in MongoDB.
categories:
  - discord bot
  - analytics
  - mongodb
  - python
publishDate: 2026-01-05T12:00-00:00
workOrder: 12
projectStyle: tool
heroLayout: portrait
coverAspect: "4 / 5"
coverFit: contain
isFeatured: false
theme:
  fill: "url('/img/projects/winning-tracker/winning-tracker.png')"
  accent: '#1f4d3a'
  contrast: '#fff'
cover: /img/projects/winning-tracker/winning-tracker.png
coverAlt: Winning Tracker
repo: https://github.com/Devathmaj/Winning-tracker
highlights:
  - value: 3 games
    label: Coinflip, blackjack, slots
  - value: 2 commands
    label: Initialize and result
  - value: MongoDB
    label: Session storage
---

![Winning Tracker](/img/projects/winning-tracker/winning-tracker.png)

## Overview

Winning Tracker is a Discord bot that follows OwO bot mini-game results and turns them into session statistics. It watches channels for coinflip, blackjack and slots messages, parses both message text and embeds and calculates bets, wins, losses and net profit.

The appeal of the OwO bot is the loop of quick games, but the built-in history is not designed for analysis. Winning Tracker adds the missing ledger: start a session, play, end the session and get a summary that is saved for later.

## How tracking works

The bot listens for OwO bot messages in channels where it has permission. It recognises coinflip, blackjack and slots outcomes, extracts the bet and result and updates the current session. Ties, busts, ignored rounds and other edge cases are handled explicitly so the totals stay accurate.

Sessions are started and ended by the user. When a session ends, the bot displays a summary and writes it to MongoDB for long-term analysis. Because the bot only reacts to game messages, it stays out of the way during normal conversation.

![Winning Tracker in Discord](/img/projects/winning-tracker/winning-tracker-discord.png)

## Commands

- `/initialize` - starts a new tracking session in the channel.
- `/result` - ends the session, displays a summary and saves it to the database.

## Setup

The recommended setup is Docker Compose. Create a `.env` file with your Discord token, then run:

```bash
docker-compose up --build -d
```

For local development, start MongoDB, set `DISCORD_TOKEN` and `MONGO_URI` in `.env`, install the dependencies from `requirements.txt` and run `python bot_track.py`.

The bot needs `Send Messages`, `Read Message History` and `View Channels` permissions, plus the `applications.commands` scope so slash commands register.

![Winning Tracker on GitHub](/img/projects/winning-tracker/winning-tracker-github.png)

## Stack

Python, discord.py, MongoDB, PyMongo, Docker, Docker Compose.

## Codebase

[View Winning Tracker on GitHub](https://github.com/Devathmaj/Winning-tracker)

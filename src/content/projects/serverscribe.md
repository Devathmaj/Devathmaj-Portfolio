---
title: ServerScribe
abstract: A modular Discord bot built with Python and discord.py, featuring moderation, member information, utilities and Docker-based deployment.
categories:
  - discord bot
  - automation
  - python
  - docker
publishDate: 2026-01-07T12:00-00:00
workOrder: 11
projectStyle: tool
heroLayout: portrait
coverAspect: "4 / 5"
coverFit: contain
isFeatured: false
theme:
  fill: "url('/img/projects/serverscribe/serverscribe.png')"
  accent: '#5a3220'
  contrast: '#fff'
cover: /img/projects/serverscribe/serverscribe.png
coverAlt: ServerScribe
repo: https://github.com/Devathmaj/Server-Scribe
highlights:
  - value: 4 cogs
    label: Greeter, fun, info, moderation
  - value: 6 commands
    label: Everyday server utilities
  - value: Docker
    label: Compose deployment
---

![ServerScribe](/img/projects/serverscribe/serverscribe.png)

## Overview

ServerScribe is a feature-rich Discord bot built with Python and discord.py. It is organised into cogs, so each area of functionality stays small, readable and easy to extend. The bot covers the everyday needs of a community server: welcoming new members, looking up information, running lightweight utilities and moderating members.

The whole project is containerised, which keeps deployment consistent across machines and makes the bot easy to run on a small server.

## Commands

### Greeter

Automatically welcomes new members when they join the server.

### Fun

- `/ping` - checks the bot's latency.
- `/joke` - fetches a random programming joke from a public API.

### Information

- `/userinfo [member]` - displays detailed information about a server member.
- `/serverinfo` - displays detailed information about the server.

### Moderation

- `/kick <member> [reason]` - kicks a member. Requires the Kick Members permission.
- `/ban <member> [reason]` - bans a member. Requires the Ban Members permission.

![ServerScribe commands in Discord](/img/projects/serverscribe/serverscribe-discord-commands.png)

## Project structure

The bot is split into a small entry point and a collection of cogs.

- `bot.py` loads the cogs and runs the bot.
- `cogs/` contains the greeter, fun, information and moderation modules.
- `Dockerfile` and `docker-compose.yml` build and run the container.
- `.env` stores the Discord token.
- `requirements.txt` pins the Python dependencies.

This structure makes new features additive: a new cog can be dropped into the folder and loaded without growing a single monolithic command file.

## Running it

The recommended path is Docker Compose:

```bash
docker-compose up --build -d
```

Create a `.env` file in the project directory with `DISCORD_TOKEN=your_bot_token_here`, then stop the bot with `docker-compose down`.

For local development, the same project runs with Python 3.10 or newer in a virtual environment, with dependencies installed from `requirements.txt`.

![ServerScribe on GitHub](/img/projects/serverscribe/serverscribe-github.png)

## Stack

Python, discord.py, Docker, Docker Compose.

## Codebase

[View ServerScribe on GitHub](https://github.com/Devathmaj/Server-Scribe)

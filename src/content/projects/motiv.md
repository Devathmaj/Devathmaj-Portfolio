---
title: Motiv
abstract: A supportive Discord bot that uses AI to detect sad or down messages and respond with personalized encouragement.
categories:
  - discord bot
  - ai
  - mental health
  - python
publishDate: 2026-01-06T12:00-00:00
workOrder: 13
projectStyle: tool
coverFit: contain
isFeatured: false
theme:
  fill: '#3d1f3a'
  accent: '#3d1f3a'
  contrast: '#fff'
cover: /img/projects/motiv/motiv-discord-chat.png
coverAlt: Motiv responding in Discord
repo: https://github.com/Devathmaj/Motiv-Discord-bot
highlights:
  - value: 3 steps
    label: Detect, generate, deliver
  - value: DeepSeek
    label: Mood detection model
  - value: Docker
    label: Compose deployment
---

![Motiv responding in Discord](/img/projects/motiv/motiv-discord-chat.png)

## Overview

Motiv is a supportive Discord bot that listens for messages expressing sadness and responds with uplifting, AI-generated encouragement. There are no commands to remember: if the bot has permission to read a channel, it can notice a difficult message and offer a kind response.

The project was created as a small experiment and later updated. It is intentionally small, focused on one interaction: detect a low mood, respond warmly and otherwise stay quiet.

## How it works

Each message in a channel the bot can access goes through three steps.

1. **Mood detection.** The message is sent to the DeepSeek model through OpenRouter to determine whether the sentiment is sad or down.
2. **Response generation.** If sadness is detected, a second call generates a unique, comforting message.
3. **Delivery.** The bot sends the response and mentions the original author so the encouragement feels personal.

If the message is not detected as sad, the bot does nothing. That restraint matters: the goal is to be supportive, not to comment on every conversation.

## Running the bot

Motiv is containerised with Docker Compose. You need a Discord bot token and an OpenRouter API key.

```ini
DISCORD_TOKEN=your_discord_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

The bot needs `Send Messages`, `Read Message History` and `View Channels` permissions and the Message Content intent must be enabled in the Discord Developer Portal.

```bash
docker-compose up --build
```

![Motiv's Discord profile](/img/projects/motiv/motiv-discord-profile.png)

![Motiv on GitHub](/img/projects/motiv/motiv-github.png)

## A note on care

Motiv is intended for supportive purposes only and is not a substitute for professional mental health care. Server owners should monitor and moderate AI-powered bots as they would any other member-facing automation.

<details class="care-secret">
<summary class="care-secret__trigger">
<span class="care-secret__mark" aria-hidden="true">✳</span>
<span class="care-secret__label">One more thing</span>
</summary>
<p class="care-secret__message">The secret is <strong>now</strong></p>
</details>

## Stack

Python, discord.py, OpenRouter, DeepSeek, Docker, Docker Compose.

## Codebase

[View Motiv on GitHub](https://github.com/Devathmaj/Motiv-Discord-bot)

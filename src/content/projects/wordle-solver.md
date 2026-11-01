---
title: Wordle Solver
abstract: A Wordle game and solver platform with a high-performance C backend, entropy-based recommendations, multi-length words and a responsive web frontend.
categories:
  - games
  - algorithms
  - c
  - full-stack
publishDate: 2026-01-09T12:00-00:00
workOrder: 9
projectStyle: tool
isFeatured: false
theme:
  fill: "url('/img/projects/wordle-solver/wordle-solver-game.png')"
  accent: '#365314'
  contrast: '#fff'
cover: /img/projects/wordle-solver/wordle-solver-game.png
coverAlt: Wordle Solver game in progress
repo: https://github.com/Devathmaj/Wordle-Solver
highlights:
  - value: 3 to 25
    label: Word lengths
  - value: 2 solvers
    label: Fast and efficient
  - value: C
    label: Backend language
---

## Overview

Wordle Solver is a playable Wordle game with built-in AI assistance. It pairs a C backend with a vanilla JavaScript frontend, supports words from 3 to 25 letters and offers two different approaches to solving.

Most Wordle helpers focus on the standard five-letter game. Wordle Solver treats word length and attempt count as variables, so it can support custom games and variants without changing the core.

## Two solvers

### Fast solver

The fast solver uses precomputed word lists and starter recommendations. It returns a strong suggestion immediately, which is useful during a live game when you want an answer rather than an explanation.

![Wordle Solver solved game](/img/projects/wordle-solver/wordle-solver-solved.png)

### Efficient solver

The efficient solver calculates information entropy to choose the optimal guess. It evaluates how much a candidate word is expected to narrow the remaining possibilities, which takes longer but produces better recommendations.

![Wordle Solver victory](/img/projects/wordle-solver/wordle-solver-victory.png)

The backend is written in C, with a core game module and separate solver modules. Precomputed word lists and entropy data live in the data directory.

## Playing and sharing

Start a game by creating one or joining an existing game with a share code.

![Wordle Solver home](/img/projects/wordle-solver/wordle-solver-home.png)

Choose a word length from 3 to 25 letters and set the number of attempts.

![Wordle Solver setup](/img/projects/wordle-solver/wordle-solver-setup.png)

Optionally enter a prefix and pick a starting word from the suggestions.

![Wordle Solver starting word](/img/projects/wordle-solver/wordle.png)

To join a game someone else created, enter their share code.

![Wordle Solver join screen](/img/projects/wordle-solver/wordle-solver-join.png)

Submit guesses in the input field, ask for a fast or efficient solve when you are stuck and share the game code so someone else can join. The REST API exposes endpoints for creating games, reading game state, submitting guesses and requesting solver suggestions.

## Deployment

The frontend is served by Nginx, which also proxies API requests to the C backend on port 8080. Docker Compose builds both services and the public deployment runs at [mycustom-wordle.netlify.app](https://mycustom-wordle.netlify.app/).

![Wordle Solver on GitHub](/img/projects/wordle-solver/wordle-solver-github.png)

## Stack

C, HTML5, CSS3, JavaScript, Nginx, Docker, Docker Compose.

## Links

[Play Wordle Solver](https://mycustom-wordle.netlify.app/)

This might be broken due to Supabase access issues and some code dependencies, so apologies if it doesn't work exactly as expected.

[View Wordle Solver on GitHub](https://github.com/Devathmaj/Wordle-Solver)

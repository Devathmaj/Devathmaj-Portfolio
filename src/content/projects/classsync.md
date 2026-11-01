---
title: ClassSync
abstract: ClassSync makes scheduling easy by creating clash-free timetables for schools and universities in seconds.
categories:
  - scheduling
  - education
  - full-stack
publishDate: 2026-01-02T12:00-00:00
workOrder: 5
projectStyle: dashboard
isFeatured: false
prominence: low
theme:
  fill: '#1e3a8a'
  accent: '#1e3a8a'
  contrast: '#fff'
cover: /img/projects/classsync/classsync-dashboard.png
coverAlt: The ClassSync dashboard
repo: https://github.com/Devathmaj/ClassSync
highlights:
  - value: Zero conflicts
    label: Full timetable placement
  - value: Celery
    label: Async generation workers
  - value: O(1)
    label: Constraint lookups
---

![The ClassSync dashboard](/img/projects/classsync/classsync-dashboard.png)

## Overview

ClassSync is a web application that generates conflict-free timetables for schools and universities. Instead of building a schedule by hand and untangling clashes after the fact, ClassSync takes the institutional constraints - teachers, subjects, classrooms and availability - and produces a complete timetable in seconds.

The product pairs a Python scheduling engine with a web frontend and API backend. Generation is computationally heavy, so the solver runs asynchronously in Celery workers while the interface stays responsive.

## How the generation engine works

The core solver is a greedy algorithm with a local-search repair pass.

1. **Prioritise the hardest lessons.** Unscheduled lessons are ordered by a heuristic score. Teachers with heavy loads and other rigid constraints are placed first on an empty grid.
2. **Place greedily.** Each lesson takes the first slot that satisfies every hard constraint: no double-booked teacher, room or class and no more than the allowed number of occurrences per day.
3. **Check constraints in constant time.** In-memory matrices track occupancy across every dimension, so conflict detection is an O(1) lookup rather than repeated database work.
4. **Repair with min-conflicts search.** If a few lessons cannot be placed, the engine force-places one into an occupied slot, evicts the lesson already there and cascades the swap until every lesson has a home.

The result is full placement with zero conflicts, including the awkward edge cases that a purely greedy pass tends to leave behind.

## Validation before generation

Timetable generation is only as good as the data behind it. Before the solver runs, ClassSync validates the dataset and catches impossible constraints early - for example, a teacher assigned 40 periods but available for only 20. The master catalogs for faculties, subjects, classrooms and their associative constraints live in PostgreSQL, with foreign keys and cascading deletes protecting data integrity before the engine reads the state.

## Setting up an institution

Access starts with a focused sign-in screen and the setup flow captures the structure of the school or university: faculties, subjects, teachers, classrooms and the rules that connect them.

![ClassSync login](/img/projects/classsync/classsync-login.png)

![ClassSync setup flow](/img/projects/classsync/classsync-setup.png)

## Building and inspecting timetables

Generated timetables can be reviewed as a list or explored in a detailed grid. The grid makes clashes, free periods and room usage easy to scan at a glance.

![A generated timetable](/img/projects/classsync/classsync-timetables.png)

![The timetable grid](/img/projects/classsync/classsync-timetable-grid.png)

## Calendar and reports

A calendar view turns the timetable into a familiar weekly schedule, while the reports screen surfaces utilisation and load information for staff.

![The ClassSync calendar view](/img/projects/classsync/classsync-calendar.png)

![ClassSync reports](/img/projects/classsync/classsync-reports.png)

## Architecture

- **Asynchronous generation.** The scheduling engine is decoupled from the API and runs in isolated Celery workers, with Redis as the message broker.
- **Progress streaming.** Jobs are queued and their progress is streamed back to the client so long runs never feel like a black box.
- **PostgreSQL catalogs.** Faculties, subjects, classrooms and constraints are modelled relationally with strict integrity rules.
- **Docker Compose development.** The full stack can be started with a single `docker compose up --build`.

## Stack

Python, Celery, Redis, PostgreSQL, Docker, Docker Compose.

## Codebase

[View ClassSync on GitHub](https://github.com/Devathmaj/ClassSync)

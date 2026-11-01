---
title: Tracient
abstract: Blockchain-powered welfare intelligence platform using Hyperledger Fabric and AI/ML for income traceability, BPL/APL classification, anomaly detection and transparent welfare verification.
categories:
  - blockchain
  - ai/ml
  - governance
publishDate: 2026-01-01T12:00-00:00
workOrder: 4
projectStyle: system
isFeatured: true
prominence: tertiary
theme:
  fill: "url('/img/projects/tracient/tracient.png')"
  accent: '#7c2d12'
  contrast: '#fff'
cover: /img/projects/tracient/tracient.png
coverAlt: Tracient
repo: https://github.com/Devathmaj/tracient
highlights:
  - value: UPI
    label: QR payment flow
  - value: Hyperledger Fabric
    label: Permissioned ledger
  - value: AI/ML
    label: BPL/APL classification
---

![Tracient](/img/projects/tracient/tracient.png)

## Overview

TRACIENT is a blockchain-based income traceability system for equitable welfare distribution. It combines a permissioned ledger with AI and machine learning to classify households, detect anomalies and make welfare verification transparent.

I contributed across the platform: payments, family records, authentication, blockchain integration, frontend cleanup, account roles, validation and the architecture documentation that ties the system together.

## What I built

### UPI payment module

A complete UPI payment flow with QR code scanning, a mock payment implementation for development and testing, transaction recording and a clear payment interface. Every payment is recorded on the blockchain, giving the system an immutable audit trail.

### Family module

Ration-card-based family tracking with automatic profile updates, real-time synchronisation with user-defined parameters and data management designed for household-level welfare monitoring.

### Authentication

User authentication and authorisation, secure credential handling, session management and integration across the frontend and backend.

### Blockchain and backend integration

I completed the connection between the backend and the blockchain network and removed its dependence on environment-specific system variables. The integration now uses standardised configuration, which makes the system portable across environments.

### Worker and employer accounts

Users can switch between worker and employer roles based on their needs. The transition is verified, role-based and tracked over time, so the system preserves account history and integrity while supporting different workflows.

### Input validation and frontend cleanup

Validation covers required fields, data types, formats, cross-field dependencies, business rules and malicious input. On the frontend I repaired broken navigation and resources, removed unused components and dependencies and improved consistency and performance.

## Platform views

![Tracient login](/img/projects/tracient/tracient-login.png)

![UPI payment QR](/img/projects/tracient/tracient-payment-qr.png)

![Model evaluation](/img/projects/tracient/tracient-ml-evaluation.png)

## Architecture

The system is documented with an architecture diagram and an entity-relationship diagram covering entities, relationships, dependencies and data structure. That documentation provides a reference for future development and maintenance.

![Tracient architecture](/img/projects/tracient/tracient-architecture.png)

## Stack

Hyperledger Fabric, blockchain, AI/ML, web frontend, backend services, QR-based UPI payments.

## Codebase

[View Tracient on GitHub](https://github.com/Devathmaj/tracient)

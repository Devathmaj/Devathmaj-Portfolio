---
title: StorageOS
abstract: A custom distributed storage operating system with a Go controller, React file manager, Buildroot Linux storage nodes, encryption, quotas and failure recovery.
categories:
  - distributed systems
  - storage
  - operating systems
  - full-stack
publishDate: 2026-01-11T12:00-00:00
workOrder: 7
projectStyle: system
isFeatured: false
theme:
  fill: "url('/img/projects/storageos/storageos-drive.png')"
  accent: '#1e3a5f'
  contrast: '#fff'
cover: /img/projects/storageos/storageos-drive.png
coverAlt: The StorageOS file manager
repo: https://github.com/Devathmaj/Storage-OS
highlights:
  - value: 3 layers
    label: Controller, frontend, nodes
  - value: 4 packages
    label: Custom Buildroot storage
  - value: AES-256-GCM
    label: Encryption at rest
---

![The StorageOS file manager](/img/projects/storageos/storageos-drive.png)

## Overview

StorageOS is a distributed cloud storage system built around a custom Linux operating system. It combines a Go control plane, a React file manager and lightweight storage nodes that run a Buildroot-based OS image under QEMU.

Most storage products stop at an API and a web UI. StorageOS goes further down the stack: it includes a custom filesystem core, a storage server daemon, a management CLI and a quota system, all built into the node image.

## Architecture

The system has three layers.

- **Controller:** a Go REST API with SQLite metadata, JWT authentication, role-based access control, a built-in certificate authority, node health monitoring and trash cleanup.
- **Browser frontend:** a React and TypeScript file manager with drag-and-drop uploads, previews, favourites, recent files, search and an admin dashboard.
- **Storage nodes:** a minimal Buildroot Linux image that runs the storage server, enrolls with the controller over OTP and authenticates with mTLS.

The controller owns users, quotas, file metadata and distribution. Storage nodes own the actual encrypted file data. Health checks run every 30 seconds and the trash is cleaned up after 30 days.

## Custom storage packages

The OS node is not a generic Linux install with a file server dropped on top. It includes four custom Buildroot packages.

- **oscore** - a storage core with B-tree indexing, ZSTD/LZ4 compression, AES-256-GCM encryption, metadata caching and a write-ahead log.
- **os-storage-server** - the storage daemon and OTP enrollment tooling, with mTLS certificate management.
- **storagemgr** - a CLI for storage statistics, health checks, file listing, integrity verification and compaction.
- **storagequota** - per-user quota enforcement with a daemon and control CLI.

This is the code that differentiates the node from a standard distribution and it is maintained in the same repository as the controller and frontend.

## File manager tour

The browser experience is designed to feel like a familiar drive rather than a raw object store.

![Recent files](/img/projects/storageos/storageos-recent.png)

![Trash and restore](/img/projects/storageos/storageos-trash.png)

Users can preview images, videos and PDFs in the browser, mark files as favourites, restore deleted items from the trash and search across their storage. Admins get a separate view of users, node health, storage distribution and provisioning.

![Profile and quota](/img/projects/storageos/storageos-profile.png)

![StorageOS settings](/img/projects/storageos/storageos-settings.png)

## Security and operations

StorageOS uses JWT authentication with 24-hour tokens, bcrypt password hashing, mTLS between the controller and nodes, OTP-based node enrollment, AES-256 encryption at rest and configurable CORS. The first user to sign up becomes the administrator automatically and admins can create users with custom quotas while keeping unlimited storage for themselves.

Node enrollment is deliberately short-lived: an admin generates an OTP, the node submits a certificate request and the admin approves it within five minutes. Once enrolled, the node starts automatically and reports its health back to the controller.

![StorageOS on GitHub](/img/projects/storageos/storageos-github.png)

## Stack

Go, React, TypeScript, Vite, SQLite, Buildroot Linux, QEMU, mTLS, AES-256, ZSTD/LZ4, Docker.

## Codebase

[View StorageOS on GitHub](https://github.com/Devathmaj/Storage-OS)

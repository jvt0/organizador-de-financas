CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
The focus is a local-first application based on privacy and clean architecture.
STRICT BOUNDARIES (READ CAREFULLY)

You have limited write permissions to ensure the integrity of the data engine.

    READ-ONLY DIRECTORIES: src/domain/, src/db/, src/normalization/, src/pipeline/, src/importers/.

    Rule: NEVER alter calculation logic, DB schemas, or the import pipeline unless explicitly ordered by the user.

    WRITE-PERMITTED DIRECTORIES: src/components/, src/pages/, src/hooks/, src/analytics/.

    Rule: Your primary role is to build the UI, the React hooks to consume data, and pure functions for analytics.

Commands

pnpm dev          # start dev server
pnpm build        # tsc + vite build
pnpm test         # run all tests once (vitest run)
pnpm test:watch   # run tests in watch mode
Architecture

React + TypeScript SPA. All persistence is local via IndexedDB (Dexie). No backend.
Data flow

CSV file
-> csv.utils.ts          (raw parse via PapaParse)
-> parser (inter/nubank/generic)   (bank-specific -> StructuredImportTransaction[])
-> import.pipeline.ts    (normalize + deduplicate + persist)
-> IndexedDB (Dexie)
-> hooks (useTransactions, useFiles, ...)
-> React UI
Key layers

    Domain types: src/domain/types.ts (All shared types)

    Domain constants: src/domain/constants.ts (Stop terms, own-transfer detection terms)

    Fingerprinting: src/domain/fingerprint.ts (Deterministic dedup keys)

    Normalization: src/normalization/ (amount.ts, date.ts, counterparty.ts)

    CSV utilities: src/importers/csv.utils.ts (Raw CSV parsing)

    Parsers: src/importers/ (One file per bank. Output: StructuredImportTransaction[])

    Import pipeline: src/pipeline/import.pipeline.ts (Orchestrates normalization, dedup, DB write)

    DB / Repos: src/db/ (Dexie class, schemas, and Typed DB access)

    Hooks: src/hooks/ (React data hooks - your main job)

    Analytics: src/analytics/ (summary.ts, counterparties.ts, insights.ts)

Domain invariants (DO NOT BREAK)

    Transaction.amount is ALWAYS positive. Direction ('in' | 'out') carries the financial meaning.

    fingerprint is an FNV-1a hash of (utcDayTimestamp | amount | direction | normalizedDescription).

    Dates are stored as UTC-midnight timestamps (dateTs) and ISO strings (date: yyyy-MM-dd).

    ownTransfer follows a conservative heuristic: prefer undefined over false when confidence is low.

UI/UX & Code Style Guidelines

    Use Tailwind CSS for styling.

    Prioritize "Data Quality over Interface" (Rule P-04).

    Always implement loading states and clear empty states for data components.

    For transaction lists, prepare for pagination or virtualization if volume is high (RNF-008).

    Strict TypeScript (avoid any).

    Use functional components with hooks.

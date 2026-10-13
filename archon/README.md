# Archon

Archon is a control layer for onchain financial activity — a safety net that sits between apps, AI agents, and the blockchain.

## What is Archon?

Modern financial apps and autonomous AI agents are starting to move money on their own — sending stablecoin payments, transferring funds between wallets, and managing treasury operations. But letting software act freely with real money is scary. Today, the controls that keep this activity safe — spending limits, approved recipients, human sign-off — are usually scattered deep inside each app's code, where they're hard to review, hard to change, and easy to get wrong.

Archon is the missing layer. Instead of every app reinventing its own safety rules, an application (or an AI agent) simply tells Archon what it *wants* to do — "pay Sarah $150" — and Archon decides whether that action is allowed. Every request is checked against a set of published rules, and there are only three possible outcomes:

- **Allow** — the action is permitted, simulated safely, executed on the blockchain, and recorded with its full receipt.
- **Review** — the action is paused and a human is asked to approve or reject it. Nothing happens until they decide.
- **Block** — the action is refused outright, with a clear, auditable explanation of exactly which rule it broke.

## What is it trying to achieve?

One simple idea: **software can be autonomous with money, as long as it never has unrestricted authority over it.**

Concretely, Archon aims to:

- **Let teams define the rules, not write the code for them.** Spending limits, allowed recipients, risk tiers — all are easy-to-edit policies that get versioned, tested, and published like living documents.
- **Keep humans in the loop.** Anything risky can require a real person's approval before it can proceed.
- **Make AI agents trustworthy.** Archon's built-in judgment can *suggest* how to act, but hard rules always win — no AI can talk its way past a spending limit, touch a private key, or invent its own transaction.
- **Never hide anything.** Every step — the request, the rules applied, the decision, the execution, the blockchain receipt — is recorded and browsable in a dashboard.
- **Work everywhere.** The same rulebook and the same request format work across blockchains. Today it supports the Tempo network out of the box; other chains plug in as adapters.

## Features

- **Policy studio** — author, version, simulate, and publish financial policies that decide who can spend, where, and how much.
- **Intent evaluation** — submit any payment or transfer request and get a deterministic **Allow / Review / Block** answer with the reasons included.
- **Human approvals** — flagged actions turn into an approval queue; nothing executes until a person signs off, and every denial is recorded.
- **Safe automated execution** — allowed payments are simulated first, executed on Tempo, and stored with their receipt and transaction link.
- **Replay** — run past actions against new, candidate policies to see how they would have fared — without ever broadcasting a real transaction.
- **Live dashboard** — watch activities, decisions, executions, events, and operational insights stream in real time.
- **Audit trail & analytics** — an immutable record of everything that happened, plus charts for the overview.
- **Playground** — try the whole flow end-to-end: write an intent, pick a policy, see the decision, broadcast a testnet payment on Tempo.
- **API keys & organizations** — multi-organization support with scoped API keys for apps and agents to integrate cleanly.

## The people and tech behind it

- Backend: NestJS, PostgreSQL, Socket.IO, NATS
- Frontend: Next.js dashboard and app
- Network: Tempo testnet (stablecoin chain)

Archon is non-custodial today: private keys stay in the browser, are never stored on the server, and are cleared right after signing.

## Status

Archon is a work in progress — currently demonstrating the full flow on the Tempo testnet. It is not yet aimed at regulated, real-money production use.

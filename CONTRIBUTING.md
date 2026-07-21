# Contributing to ChatXtream

First off, thank you for considering contributing to ChatXtream! It's people like you that make open-source anonymity tools robust and reliable.

## Code of Conduct
By participating in this project, you are expected to uphold a welcoming and respectful environment. 

## How Can I Contribute?

### 1. Reporting Bugs
If you find a security vulnerability, **do not open a public issue**. Please reach out to the maintainers directly.
For standard bugs (UI glitches, connection issues), please check the existing issues before opening a new one. When reporting a bug, include:
*   Your operating system and browser version.
*   Steps to reproduce the behavior.
*   Any relevant logs from the browser console or backend terminal.

### 2. Suggesting Enhancements
We welcome ideas for improving ChatXtream's privacy guarantees or user experience. Open an issue with the tag `enhancement` and describe your idea, why it's necessary, and how it aligns with our anonymity-first vision.

### 3. Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes (`npm run build` in both frontend and backend).
4. Make sure your code follows the existing style guidelines (TypeScript strict mode).
5. Issue that pull request!

## High Priority Tasks
If you're looking for something to work on, check out the roadmap in the README:
*   Double Ratchet (Signal protocol) implementation.
*   Tor Hidden Service integration.
*   Traffic padding/batching.

## Development Setup
See the `Hosting & Deployment` section in the `README.md` for instructions on how to spin up the local development environment using Docker or Node.js.

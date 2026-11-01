# Notes for AI agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
first; they apply to you as well.

- Run `npm run check` before committing; run `npm run format` if the format check fails.
- Use Conventional Commits, one logical change per commit.
- Keep `src/domain/` pure and tested. Keep the app small - no new dependencies or
  abstractions without a concrete need.
- Placeholder code is marked `MOCK:`. When replacing a mock, update the docs that mention it.
- For UI changes, check the result in a phone-sized viewport (e.g. Playwright with
  `devices['iPhone 13']`).

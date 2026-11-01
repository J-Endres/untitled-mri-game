# Untitled MRI Game

A browser game for phones: build an MRI sequence from building blocks (RF pulses, ADCs,
gradients, spoilers, loops), scan a hidden phantom in a virtual scanner and figure out what is
lying in it - while staying within SAR, SNR and scan-time limits.

Simulation and reconstruction are going to run on the [MRX](docs/ARCHITECTURE.md#simulation-pipeline-mrx)
tools (Pulseq export -> `rapisim` simulation -> `trajex` trajectory -> NUFFT reconstruction).

> **Status: mockup.** The UI is playable, but simulation, leaderboard and challenges are mocks.
> See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md#roadmap) for what comes next.

<p>
  <img src="docs/img/game-screen.png" width="260" alt="Game screen with reconstruction and sequence editor" />
  <img src="docs/img/event-sheet.png" width="260" alt="Bottom sheet for editing an ADC" />
</p>

## Quick start

Requires Node.js 22 (see `.nvmrc`).

```sh
npm install
npm run dev        # http://localhost:5173, use your browser's device mode
npm run check      # format check, lint, typecheck, tests - run before pushing
npm run build      # static build in dist/
```

To try it on a phone in your network: `npm run dev -- --host`.

## Documentation

- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) - how the game works, open questions, roadmap
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - code structure, data model, MRX pipeline
- [CONTRIBUTING.md](CONTRIBUTING.md) - workflow, commits, code style

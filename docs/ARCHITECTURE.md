# Architecture

A static single-page app (Vite + React + TypeScript) that talks to a small backend for
simulation and the leaderboard. Today the backend is mocked inside the client.

```
┌─────────────────────────── browser ───────────────────────────┐      ┌──────── backend (planned) ───────┐
│ ui/  ──▶ state/ ──▶ domain/ (model, operations, metrics)       │      │ picks hidden phantom per challenge│
│              └────▶ services/ SimulationService ───────────────┼─────▶│ runs MRX tools, checks answers,   │
│                               LeaderboardService               │ HTTP │ stores leaderboard                │
└────────────────────────────────────────────────────────────────┘      └───────────────────────────────────┘
```

## Layers

- **`src/domain/`** - framework-free TypeScript.
  - `sequence/` - the sequence model (`types.ts`), factories, immutable tree operations
    (insert, move, link/unlink, wrap/unwrap), metrics (duration, heuristic SAR) and
    validation (which events may play together).
  - `challenge/` - challenge definitions, constraints and scoring.
- **`src/services/`** - interfaces for everything that crosses the network, plus `mock*`
  implementations. `App.tsx` decides which implementation is used.
- **`src/state/`** - `sequenceReducer` (UI actions -> domain operations) and `useSimulation`
  (async scan state, discards stale results).
- **`src/ui/`** - React components. `sequence/` is the drag-and-drop editor, `sheets/` holds
  the bottom-sheet popups. `EditorContext` provides the sequence and edit callbacks so the
  recursive lists and the sheets do not need prop drilling.

State is plain `useReducer` + context. There is no global store library, no router and no UI
kit - the app is one screen with popups. Revisit if that stops being true.

## Sequence model

The model mirrors Pulseq so that export is a straightforward walk over the tree:

```ts
Sequence = { nodes: SeqNode[] }
SeqNode  = Block | Loop
Block    = { events: SeqEvent[] }          // all events play simultaneously (= Pulseq block)
Loop     = { count, label, body: SeqNode[] }
SeqEvent = RfEvent | AdcEvent | GradientEvent | SpoilerEvent | DelayEvent
```

- A block with one event is shown as a single card; with several events it is shown as a
  "simultaneous" group. _Linking_ merges two adjacent blocks, _unlinking_ splits an event out.
  A block may hold at most one RF, one ADC, one delay and one gradient per axis
  (`validation.ts`).
- Loops are an editor convenience and are unrolled on export. A gradient's `areaStep` changes
  its area per iteration of the innermost enclosing loop (centred), which expresses phase
  encoding without per-line editing.
- Units: durations in µs, angles in degrees, gradient areas in 1/m (k-space units, as in Pulseq).

## Simulation pipeline (MRX)

Planned flow for one scan; all steps after the export run in the backend, because the MCP
credentials and the choice of phantom must not be visible to the player:

1. **Export** (client or backend): unroll loops, convert areas/durations to gradient shapes on
   the scanner raster, write a Pulseq `.seq` file.
2. `upload_file` - store the `.seq`, get its hash.
3. `trajex_extract_trajectory` - k-space trajectory of the sequence (per ADC sample).
4. `rapisim_simulate` - simulate the sequence on the hidden bifti phantom (e.g. a BrainWeb
   slice from `endres-brainweb-001`, a breast phantom from `duarte-breast-001`, or geometric
   shapes from `endres-bifti_demo-001`). `sampler: "fft"` keeps it fast.
5. `reco_reconstruct` with `method: "nufft"` - reconstruct the image from signal + trajectory.
6. Return a downsampled magnitude image (`ReconImage`) and the metrics to the client.

Metrics:

- **Duration** is exact from the sequence (`domain/sequence/metrics.ts`).
- **SAR** is currently a heuristic based on B1² of hard pulses. Rapisim does not report SAR,
  so a better estimate has to be computed from the RF shapes (backend, same code as client).
- **SNR**: the simulation is noise-free, so noise must be added in the backend (scaled with
  bandwidth / number of samples) and SNR measured on the image. Open question, see
  [GAME_DESIGN.md](GAME_DESIGN.md#open-questions).

Values that count for the leaderboard are always recomputed by the backend.

## Testing

- Vitest unit tests for everything in `domain/` (and later the Pulseq writer - compare against
  reference `.seq` files).
- UI is checked manually in a phone viewport for now; add Playwright tests once the UI
  settles.

## Decisions

Short log of choices that are not obvious from the code. Add an entry when you make one.

- **2026-11 - Vite + React + TypeScript.** Widely known, fast tooling, good touch DnD support
  (`@dnd-kit`). Canvas is enough for the image; no game engine needed for a list-based UI.
- **2026-11 - Model = Pulseq blocks + loops.** Keeps export trivial and makes "linking" a
  direct operation on blocks.
- **2026-11 - Backend proxy for MRX.** Hides the phantom (otherwise the game is trivially
  cheatable) and the MCP credentials.
- **2026-11 - No state library, no router.** One screen; `useReducer` + context suffice.

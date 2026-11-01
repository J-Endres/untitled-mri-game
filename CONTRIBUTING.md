# Contributing

Thanks for helping! This is a small project - keep changes small, readable and tested.

## Workflow

1. Branch off `main` (`feat/loop-editor`, `fix/sar-estimate`, ...).
2. Make focused commits (see below).
3. Run `npm run check` (format, lint, typecheck, tests). `npm run format` fixes formatting.
4. Open a pull request. CI runs the same checks plus a build; it must be green before merging.
   Describe _what_ and _why_, and add a screenshot for UI changes (phone-sized viewport).

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <summary in imperative mood, lower case, no period>

<optional body: why the change is needed, anything non-obvious>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style` (formatting only), `build` (tooling,
dependencies), `ci`, `chore`. Scopes are the top-level areas: `domain`, `services`, `ui`,
`state`. One logical change per commit; the tree should build and pass tests at every commit.

## Where code goes

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture. In short:

| Folder          | Contains                                                    | May import           |
| --------------- | ----------------------------------------------------------- | -------------------- |
| `src/domain/`   | Pure TypeScript: sequence model, operations, metrics, rules | nothing app-related  |
| `src/services/` | Boundaries to the outside world (simulation, leaderboard)   | `domain`             |
| `src/state/`    | React state glue (reducer, hooks)                           | `domain`, `services` |
| `src/ui/`       | React components and their CSS modules                      | everything above     |

## Code style

- TypeScript strict mode, no `any`. Prettier and oxlint decide formatting and lint questions.
- Domain logic is pure and immutable and has unit tests (`*.test.ts` next to the file).
  UI components stay thin: if a component computes something non-trivial, move it to `domain/`.
- Physical units go into names or doc comments (`durationUs`, `flipAngleDeg`, area in 1/m).
- Styles: one CSS module per component (or component group), shared tokens as CSS variables
  in `src/styles/global.css`. Design for a ~390px wide portrait screen first.
- Comments explain _why_, not _what_. Every module starts with a short doc comment if its
  purpose is not obvious from the name.
- Mark placeholder code with `MOCK:` so it is easy to find (`grep -r MOCK: src`).
- Prefer no new dependency over a small one. Discuss bigger ones (state, routing, UI kits) in
  an issue first.

## Documentation

Update the docs in the same PR as the code. Game rules go to `docs/GAME_DESIGN.md`,
structural decisions to `docs/ARCHITECTURE.md` (add a short entry under _Decisions_).

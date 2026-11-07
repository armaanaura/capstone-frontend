# CodeCapstone

A focused Capstone Tree workspace built with Next.js App Router, TypeScript, React Flow, ELK.js, Tailwind, and Radix Dialog.

## Run locally

Use a working Node.js installation and npm:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On this Mac, the preferred Node 24 installation has a missing Homebrew library. Use the verified working installation for the current shell:

```sh
export PATH="/opt/homebrew/opt/node/bin:$PATH"
```

## Verify

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Playwright starts the local development server if needed. It checks desktop, tablet, mobile, and short-height layouts and saves screenshots under the ignored `test-results/` directory. Run `npm start` after a production build to serve the built application.

## Page behavior

- Graphs → Delivery Network opens by default. Five other topics each have a working sample capstone.
- Drag empty space to pan; scroll or pinch to zoom. Use Fit map or Jump to current to find your place.
- Select a list entry to center its node. Activate a node to read its story preview, or see unmet prerequisites.
- Resize the topic sidebar with its divider, or focus the divider and use the left/right arrow keys.
- Keyboard shortcuts: **F** fits the map, **J** jumps to the current question, and **/** focuses topic search. Shortcuts are suspended in inputs and dialogs.
- Navigation and the question list become accessible overlays on smaller screens.

## Data and integration

Typed fixtures live in `src/lib/capstone/data.ts`. Prerequisite records are the source of truth for edges and unlock rules; progress is separate from selection. ELK computes and caches node positions and obstacle-avoiding connection routes. Equal source depths share a horizontal level.

The reusable client component exposes a question launch callback:

```tsx
<CapstoneTree
  data={sampleData}
  onOpenQuestion={({ topicId, capstoneId, questionId }) => {
    // Connect the question-solving workspace here.
  }}
/>
```

The included host acknowledges the selection and stays on the map. Sample progress is never changed or persisted. No backend integration, question solver, other application pages, or deployment is included.

The original `reference/` captures are retained as visual references and are not shipped as application content.

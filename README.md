# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

# Tier List Maker

Build tier lists for anything — games with rarity systems, or anything else.

**Live demo:** [tier-list-maker-theta.vercel.app](https://tier-list-maker-theta.vercel.app)

## Features

- Create tier lists and place items into ranked tiers
- Export your finished tier list as an image (via `html-to-image`)
- Toast notifications for quick feedback (via Sonner)
- Responsive, accessible UI built on shadcn/ui and Radix primitives
- Unit and end-to-end test coverage

## Tech Stack

| Area | Tools |
| --- | --- |
| Framework | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build tool | [Vite](https://vite.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com), `tw-animate-css`, `class-variance-authority` |
| UI components | [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com), [Lucide icons](https://lucide.dev) |
| Font | [Geist Variable](https://fontsource.org/fonts/geist) |
| Image export | [html-to-image](https://github.com/bubkoo/html-to-image) |
| Notifications | [Sonner](https://sonner.emilkowal.ski) |
| Linting | [Oxlint](https://oxc.rs) |
| Testing | [Playwright](https://playwright.dev), [tsx](https://tsx.is) |
| Hosting | [Vercel](https://vercel.com) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (a current LTS version is recommended)
- npm

### Installation

```bash
git clone https://github.com/HenjiAKO/Tier-List-Maker.git
cd Tier-List-Maker
npm install
```

### Run the dev server

```bash
npm run dev
```

Then open the local URL printed in your terminal (usually `http://localhost:5173`).

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot module replacement |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint the codebase with Oxlint |
| `npm run typecheck` | Run the TypeScript compiler in build mode |
| `npm test` | Run unit tests, then end-to-end tests |
| `npm run test:unit` | Run unit tests (`tests/place-item.test.ts`) |
| `npm run test:e2e` | Build the app and run Playwright end-to-end tests |
| `npm run test:shots` | Build the app and capture screenshots |

> Playwright may need browsers installed on first use: `npx playwright install`

## Project Structure

```
Tier-List-Maker/
├── public/            # Static assets
├── src/               # Application source code
├── tests/             # Unit, e2e, and screenshot tests
├── components.json    # shadcn/ui configuration
├── index.html         # App entry HTML
├── vite.config.ts     # Vite configuration
├── vercel.json        # Vercel deployment config
└── .oxlintrc.json     # Oxlint configuration
```

## Deployment

The app is deployed on Vercel. To deploy your own copy, import the repository into [Vercel](https://vercel.com/new); the included `vercel.json` handles the configuration, and the default Vite build settings (`npm run build`, output directory `dist`) apply.

## Contributing

Issues and pull requests are welcome. Before opening a PR, please make sure these pass:

```bash
npm run lint
npm run typecheck
npm test
```

## License

"This project is licensed under the MIT License. See the file for details."

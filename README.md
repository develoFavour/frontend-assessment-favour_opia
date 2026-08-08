# Senior Front-End Engineering Assessment — Favour Opia

> **Executive Summary:** A high-performance, zero-dependency, zero-`useEffect` order management application handling 5,000 rows with full printability and sub-16ms input responsiveness, paired with a comprehensive technical write-up covering frontend architecture, state management mechanics, incident management, and production engineering practices.

---

## 📁 Repository Structure

| File / Path | Description |
| :--- | :--- |
| [`PART-A.md`](./PART-A.md) | In-depth answers to 13 written questions across 4 sections (Code, Design & Judgement, Review under pressure, and Experience). |
| [`/app`](./app) | Complete implementation of the Part B practical order management application. |
| [`/app/NOTES.md`](./app/NOTES.md) | Architectural rationale detailing trade-offs, performance choices, and constraint compliance. |
| [`/app/evidence/`](./app/evidence) | Raw React DevTools Profiler JSON trace (`.json`) and flamegraph screenshot (`.jpg`). |

---

## 🚀 Part B: Engineering Highlights & Constraint Compliance

The practical task required building a single-screen order management application rendering **5,000 rows** under strict engineering constraints:

1. **Printability without Virtualization (`content-visibility: auto`)**
   - *Challenge:* Traditional virtualization (`react-window`, `@tanstack/react-virtual`) removes off-screen rows from the DOM, breaking `Ctrl-P` printing and `Ctrl-F` browser search.
   - *Solution:* Render all 5,000 items to the DOM, but leverage CSS `content-visibility: auto` and `contain-intrinsic-size` to instruct the browser rendering engine to skip layout and paint calculations for off-screen rows. Native print styles (`@media print`) restore full document visibility.

2. **Reactive URL State Without `useEffect`**
   - *Challenge:* Filter state must persist in URL search parameters (`?search=...&status=...`) and respond to browser Back/Forward navigation without using `useEffect`.
   - *Solution:* Built a custom event-driven store utilizing React 18's **`useSyncExternalStore`**. It subscribes directly to native `popstate` and custom `urlchange` events, updating `window.history.pushState` imperatively without hooks side-effects.

3. **Zero Wasted Re-renders & Sub-16ms Input Latency**
   - *Challenge:* Typing in the search input must not trigger unnecessary re-renders across the 5,000 DOM nodes.
   - *Solution:* Encapsulated row items in `React.memo` with primitive props and stable `useCallback` handlers. Paired with `useDeferredValue` and primitive state key serialization (`statusKey = string`), input updates execute in single-digit milliseconds (**1.1ms – 12ms**) while list reconciliation occurs in the background.

4. **Strict Code & Dependency Budget**
   - Zero external runtime dependencies beyond React and Vite (with `lucide-react` for icons).
   - Zero CSS frameworks (pure CSS Modules with standard CSS custom properties).
   - Under 250 lines of custom logic (excluding generated scaffolding and data mock generator).

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher

### Running the Application

```bash
# 1. Clone the repository
git clone https://github.com/develoFavour/frontend-assessment-favour_opia.git
cd frontend-assessment-favour_opia/app

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Production Build & Local Preview

```bash
# Build production bundle and run type checking
npm run build

# Preview production build locally
npm run preview
```

---

## 📊 Verification & Profiler Evidence

Profiler recordings validating zero wasted re-renders are located in [`/app/evidence`](./app/evidence):
- `profiling-data.08-08-2026.12-27-07.json`: Importable Chrome React DevTools Profiler trace.
- `profile_recording.jpg`: Visual proof showing sub-16ms immediate renders and `React.memo` element bailouts.

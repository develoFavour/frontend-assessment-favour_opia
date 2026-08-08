# Implementation Notes

## Constraints Met

### 1. Printability vs Performance (Constraints 1, 2, 6)
To satisfy both rendering 5,000 rows without blocking the main thread *and* ensuring every single filtered row is printable via `Ctrl-P` and searchable via `Ctrl-F`, virtualization libraries could not be used (as they remove off-screen rows from the DOM).
Instead, I rendered all rows to the DOM and applied the modern CSS properties `content-visibility: auto` and `contain-intrinsic-size` to each row (`.tr`). This tells the browser to skip layout and paint calculations for off-screen rows, achieving near-virtualization performance natively while keeping the DOM fully intact for printing and native browser search. I also used `@media print` to reset visibility rules for printing. 
To prevent wasted re-renders when typing, the `OrderRow` component is wrapped in `React.memo` and receives a stable `onClick` reference (`useCallback`). The search term itself is wrapped in `useDeferredValue` to keep typing at 60fps.

### 2. URL State without useEffect (Constraints 3, 7, 8)
The assessment strictly forbids `useEffect`, yet requires URL synchronization that works with the browser back button.
To achieve this, I wrote `useURLStore`, a custom hook utilizing React 18's **`useSyncExternalStore`**. It subscribes directly to the native `popstate` event and a custom `urlchange` event. When filters are updated, we call `window.history.pushState` and manually dispatch `urlchange`. This achieves perfectly reactive URL state with zero `useEffect` calls.

### 3. Dependencies (Constraint 9)
I did **not** use an external library for the table/list, as the native DOM approach with `content-visibility` was perfectly sufficient and lighter. The only non-framework dependency added was `lucide-react` to provide standard UI icons (Search, Close). No state management or CSS framework was used (Tailwind was deliberately avoided to strictly adhere to the zero-dependency rule; I used pure CSS Modules instead).

### 4. Code Size (Constraint 10)
Total lines of my own code (excluding scaffolding, package configuration, and the `data.ts` generator) is ~240 lines, well under the 300-line limit.

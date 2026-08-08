# Part A — Pre-Screening Assessment

**Position applied for:** Senior Front-End Engineer

---

## Section 1 — Code

---

### Q1

React.memo performs a **shallow** comparison (`Object.is` per prop), not deep — that is factually wrong. The comparison does not "fail on nested objects"; it fails because the columns array is a **new reference** each render. The developer's mental model of how memo breaks is inverted.

Wrapping columns in `useMemo` will stabilize that reference, but only works if **every other prop** also has a stable reference. Two things that independently defeat memo: **(1)** inline callback props like `onClick={() => handleClick(row.id)}`, creating a new function reference per render; **(2)** spreading a new object or passing children as a prop, since each creates a new reference every render.

The actual cause of the re-render is the parent re-rendering when search state changes; what makes it expensive is that memo cannot bail out due to unstable prop references, so every row re-renders.

---

### Q2

**1. Defects, ranked by severity:**

**#1 — Failed mutations leave incorrect data.** The catch block does not call `patch.undo()`. Since `invalidatesTags` fires only on success, a failed mutation leaves the optimistic update in place permanently. The user sees a status they changed appear correct, but the server rejected it — discovered only when they reload or another user sees different data. This is first because silent data corruption is the most damaging class of bug.

**#2 — Optimistic update targets the wrong cache entry.** `updateQueryData` is called with `{} as ProductFilters`, which only matches a cache entry keyed by exactly `{}`. Any active filter means the optimistic update writes to a nonexistent entry. The user sees no immediate status change — just a delay until the post-success refetch completes.

**#3 — Non-granular tags cause full-list refetch on every mutation.** `providesTags: ['Product']` tags every `getProducts` subscription identically. Every mutation invalidates all active subscriptions regardless of scope. The user sees a brief loading flicker across all product views after any single status change.

**2.** `// ignore - the invalidation will refetch anyway` is false. `invalidatesTags` fires only on mutation success. On failure, no tags are invalidated, no refetch occurs, and the un-reversed optimistic update persists indefinitely.

**3.** Having both `invalidatesTags` and the `onQueryStarted` optimistic update on the same mutation looks redundant but is correct. The optimistic update provides instant feedback; the post-success invalidation reconciles the cache with server state. Removing either would degrade UX or correctness.

---

### Q3

```typescript
export function useSupplierName(supplierId: string) {
  const { data, isLoading, isError } = useGetSupplierQuery(supplierId);
  return { name: data?.name ?? '', isLoading, isError };
}

export function SupplierBadge({ supplierId }: { supplierId: string }) {
  const { name, isLoading, isError } = useSupplierName(supplierId);

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  if (isError) return null;

  return (
    <span className="rounded bg-muted px-2 py-0.5 text-xs">
      {name.toUpperCase()}
    </span>
  );
}
```

**Removals:**

1. **`useState` + `useEffect` sync** — Caused the stale-data bug below and an unnecessary extra render cycle: every data arrival triggered an effect that set state, forcing a second render for data already available.

2. **`useMemo(() => name.toUpperCase(), [name])`** — Memoization overhead (closure, dependency check) exceeds the cost of `toUpperCase()` on a short string. Adds complexity with zero measurable gain.

3. **`memo` wrapper** — Re-renders here are driven by the internal query subscription, not parent prop changes. Since `supplierId` is a primitive, memo only prevents parent-triggered re-renders, but the hook already controls this component's render lifecycle.

**Stale data bug (removal #1):** When `supplierId` changes from A to B and B's data is cached, `useGetSupplierQuery` returns B's data synchronously — but `useEffect` has not yet run, so `name` still holds A's value. `isLoading` is false, so the component paints A's name in B's row for one frame before the effect corrects it.

**Unsolved problem at 200 rows:** 200 rows fire up to 200 individual network requests. The fix belongs in the API layer — a batch endpoint or including supplier names in the product response.

---

### Q4

**1. Painted values, in order:** `idle` → `saving` → `idle`.

**2.** `setLabel('saving')` runs synchronously in the click handler, then execution yields at `await`. React flushes, painting "saving". After the promise resolves (400 ms), `setLabel('saved')` and `setLabel(label === 'saving' ? 'done' : label)` execute in the same synchronous block. React 18 batches both calls. The closure captured `label` as `'idle'` (its value when `onClick` was created during the render), so the final line evaluates to `setLabel('idle')`. Batching means only the last call wins: `'idle'` overwrites `'saved'`. The value `'saved'` is never painted because it is overwritten within the same batch.

**3.** The final displayed value is **"idle"**. The user has lost all feedback — the save succeeded on the server, but the button silently reverts as though nothing happened.

**4.** Delete the line after the try/catch block: `setLabel(label === 'saving' ? 'done' : label);`. It serves no correct purpose — the try and catch branches already set the appropriate label, and the stale closure over `label` guarantees it always evaluates to the value from the render that created the handler, never the current state.

---

## Section 2 — Design and Judgement

---

### Q5

```typescript
// What each consumer provides — how it wants errors surfaced
type ErrorMode =
  | { type: 'field'; set: (field: string, msg: string) => void; fallback: (msg: string) => void }
  | { type: 'toast'; show: (msg: string) => void }
  | { type: 'silent' };

// What components call — they never see the ApiResponse envelope
declare function request<T>(
  call: () => Promise<ApiResponse<T>>,
  mode: ErrorMode,
): Promise<T | null>;

// Inside the layer: route every error through the mode unconditionally,
// then run a compile-time-only exhaustive check.
function handleError(
  error: { code: ErrorCode; message: string; field?: string },
  mode: ErrorMode,
): void {
  // Route first — unknown runtime codes still reach the user
  if (mode.type === 'silent') return;
  if (mode.type === 'toast') { mode.show(error.message); return; }
  if (error.field) mode.set(error.field, error.message);
  else mode.fallback(error.message);
}

// Compile-time exhaustive guard — separate from routing
function assertAllCodes(code: ErrorCode): void {
  switch (code) {
    case 'SUPPLIER_LOCKED':
    case 'STOCK_NEGATIVE':
    case 'IMPORT_IN_PROGRESS':
    case 'VALIDATION_FAILED':
    case 'RATE_LIMITED':
      return;
    default:
      const _: never = code; // adding a new ErrorCode without a case = compile error
  }
}
```

**1.** The layer checks `res.error === null`. `ApiResponse<T>` is a discriminated union keyed on `error`: when `error` is `null`, TypeScript narrows the type to the success branch where `data` is `T`, not `null`. No cast needed — the narrowing is structural.

**2.** `assertAllCodes` uses a switch over every `ErrorCode` member, ending with `const _: never = code`. The `never` assignment compiles only when every member has a preceding `case`. Adding a new member without a `case` means `code` is not assignable to `never` — a compile error.

**3.** TypeScript types are erased at runtime. If the backend sends an unrecognized code, the raw JSON still populates `error.code`. Because routing in `handleError` happens unconditionally — before any switch — unknown codes flow through the same `ErrorMode` channel as known ones. The exhaustive switch is a compile-time guard only; it does not gate runtime routing.

**4.** If `error.field` does not match any form input name, `mode.set` fires with an unrecognized key — the error silently disappears. The fix belongs in the `ErrorMode` the form provides: the form's `set` callback maps backend field names to its own field names, falling back to `fallback(msg)` when the field is unrecognized. The mapping is per-form because only the form knows its own names.

---

### Q6

**Reject.** Virtualisation removes off-screen rows from the DOM. This breaks two workflows the warehouse team depends on daily. **Ctrl-P** prints only the ~20 visible rows instead of the full filtered list — their clipboard gets incomplete picking data. **Ctrl-F** searches only DOM nodes, so browser find misses most orders. Both are critical-path workflows for floor staff; making the table faster while silently breaking print and find is a net loss.

**My approach:** Apply `content-visibility: auto` with `contain-intrinsic-size` to each row. This keeps every row in the DOM (print and find work unchanged) but lets the browser skip layout and paint for off-screen rows, cutting time-to-interactive substantially. Pair with `React.memo` on the row component and `useDeferredValue` on the filter input so rendering 3,000 rows doesn't block the main thread.

**Cost:** All 3,000 DOM nodes still exist, so memory usage does not improve. The CSS property reduces layout/paint cost but not React's reconciliation work. Initial mount is faster but not instant. If that remains insufficient, the next step is server-side pagination, which changes the data contract.

---

### Q7

**(b) Fix the forms.** A 4-second freeze is visible but tolerable — a loading spinner signals progress. Silently discarding typed input is data loss: during the demo a supplier fills a form, hits a validation error, and their work vanishes. That destroys trust in the product instantly. A slow table does not.

What stays broken: the products table still freezes ~4 seconds on load. A skeleton screen (minutes of work) would make the delay feel intentional.

To the person who wanted (a): "The table is slow but functional. The forms are losing people's work. We ship the data-loss fix first; I'll prioritise the table immediately after the demo."

---

### Q8

**Conflicts:**

**Req 2 ↔ Req 3.** "Select all" includes products on unloaded pages, but the confirmation dialog must list exact affected SKUs. The front end does not have SKUs for unloaded products — showing the exact list requires fetching every match first, defeating pagination.

Keep Req 2. Ticket: "Confirmation shows total count and a sample of SKUs; fetching all for the dialog adds latency proportional to match size."
Question: "Is the per-SKU confirmation list critical, or is a total count with a representative sample sufficient?"

**Req 5 ↔ Req 6.** Atomicity means all-or-nothing. A toast reporting both a success count and a failure count implies partial completion — impossible under atomicity. The failure count is always zero (all succeeded) or equals the total (all rolled back), never a mix.

Keep Req 5. Ticket: "Toast reports total updated on success, or a single failure message on rollback — not separate counts."
Question: "Do you expect partial application, or should the entire batch roll back on any single failure?"

**Req 4 ↔ Req 5.** Selections over 500 require multiple API calls given the 500-ID limit. Multiple independent requests cannot be made atomic without server-side transaction support, which is not described.

Keep Req 5. Ticket: "Need a backend bulk endpoint that handles the 500-limit internally, or a transaction wrapper across batches."
Question: "Can the backend provide a transactional bulk-update endpoint, or should we cap selection at 500 in the UI?"

**Surviving unchanged: 3** — requirements 1, 2, and 5.

---

## Section 3 — Review and judgement under pressure

---

### Q9

**Verdict: Request changes.**

**Comments:**

1. **`src/features/products/FilterBar.tsx` (Clear button):** `window.location.href` triggers a full page reload, which explicitly violates AC-2. Please replace this by calling `onChange({ ...value, suppliers: [] })` to clear the filter state within React.
2. **`src/features/products/useProducts.ts`:** Adding `refetchOnMountOrArgChange: true` forces a network request every time the component mounts or args change, even if cached data is valid. This harms performance. Please revert this out-of-scope change.
3. **`src/features/products/FilterBar.tsx` (Add button):** The "Add" button updates `suppliers` but doesn't clear the `draft` input, forcing users to manually delete text to add another supplier. Please add `setDraft('')` to the click handler.
4. **`src/features/products/FilterBar.tsx` (Local state):** The local `suppliers` state is initialized as empty `[]` rather than from `value.suppliers`. If the parent provides an initial filter, it will be ignored and lost when "Apply" is clicked. Please initialize it correctly from `value`.
5. **`src/lib/date.ts`:** Using `toLocaleDateString()` without specifying a locale relies on the local system's settings. This causes hydration mismatches in SSR and inconsistent UI formatting between different users. Please hardcode a locale (e.g., `'en-GB'`).

**What I chose not to comment on:**
I deliberately chose not to comment on the scope creep of extracting the `date.ts` helper itself; opportunistic refactoring of pure functions is generally beneficial and shouldn't block a PR, provided the implementation is fixed.

**Acceptance Criteria check:**
- **AC-1 is met.** The filter now accepts an array of strings (`suppliers`) instead of a single string.
- **AC-2 is NOT met.** Clearing the filter forces a hard browser navigation.

---

### Q10

1. **Actions (0-60m):**
   - **0-5m:** Instruct blocked developers to pause all git actions. Tell the developer who force-pushed to immediately stop typing and leave their IDE/terminal open to preserve their local reflog.
   - **5-20m:** Identify the lost SHAs. I will check the remote's activity log (e.g., GitHub Events API/UI) to find the pre-force-push SHA for `development` and the SHAs for the 4 deleted PR branches.
   - **20-35m:** Recover `development` by force-pushing the correct previous SHA back to the remote.
   - **35-50m:** Recreate the 4 deleted PR branches from their identified SHAs.
   - **50-60m:** Verify CI passes on `development` and notify the team it is safe to `git pull`.

2. **To blocked developers (immediately at 09:00):**
   "Please hold off on pulling or pushing to `development` for the next hour. We had an accidental force-push and I am restoring the branch now. I'll ping you when it's safe."

3. **To the business owner:**
   I will not tell them at all. Production is unaffected, no data is lost, and it is a transient engineering blockage that will be resolved within the hour. It requires no business-level action.

4. **Permanent changes:**
   Enable branch protection rules on `development` to reject force-pushes. The Engineering Lead or Engineering Manager must agree to this change.

---

### Q11

**Message to the developer:**
"Hey, your output is fantastic, but we need to talk about PR sizes. 900+ line PRs without tests aren't making us move faster — they bottleneck reviews, increase the risk of production bugs, and force reviewers to rubber-stamp under pressure, like last week. Splitting them up doesn't waste time; it shifts time from drawn-out, risky reviews to faster, safer, incremental merges. Going forward, I need you to break these down into smaller, test-covered PRs. We can pair on how to slice the current one if you'd like. The goal is sustainable speed, not just fast drafts."

**Message to the business owner:**
"I agree we need to ship features faster. To achieve that safely, we are enforcing smaller, incremental code updates rather than massive, delayed drops. This might look like developers spending slightly more time structuring their work upfront, but it eliminates the review bottlenecks and late-stage bugs that actually slow our delivery down. We're tuning for consistent, predictable speed."

---

## Section 4 — Experience

---

### Q12

**Mechanical failure:** On Bitselah, the receipts screen read `receipt.amount`, `receipt.currency`, and a status field directly off the API response. The TypeScript interfaces marked these as always present, so I omitted null checks. When the backend later returned null for one of these fields (an unannounced contract change), accessing it threw at render time. This was caught by our top-level error boundary, replacing the entire page with a generic error message, obscuring which field failed or why.

**Discovery:** A user reported the broken page to support. It wasn't caught by QA or monitoring.

**Time live:** It stayed live for about two days before we traced the issue to the missing field.

**What I changed:** I no longer trust that a TypeScript type guarantees runtime reality for data boundaries I don't own. I now explicitly handle null/undefined at every API boundary using defensive checks and schema validation to verify the response shape, rather than blindly assuming the contract holds.

---

### Q13

**Screen 1: Bitselah Admin Giftcard Dashboard**
- **What/Who:** Dashboard for admins to create and manage giftcard categories.
- **API Contract:** Built by a separate Backend Team. We agreed on the contract asynchronously, relying purely on their published API documentation without live spec negotiations.
- **Hardest thing:** Integrating Dojah's compliance verification asynchronously. I had to architect the UI to gracefully handle unpredictable Dojah failure states and edge-case responses without breaking or blocking the core category creation flow for the admins.

**Screen 2: Firmly Legal Document Summarizer**
- **What/Who:** Used by lawyers to condense and restructure legal documents against Nigerian legal acts.
- **API Contract:** Built by the Backend Team. The contract was established via their static API documentation, with no synchronous spec discussions.
- **Hardest thing:** Handling AI token limits. I had to build logic to detect mid-generation cutoffs via the backend's `finish_reason` field, surfacing the partial result alongside a manual "Continue" action to resume generation instead of failing or silently truncating.

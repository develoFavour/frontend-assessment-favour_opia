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

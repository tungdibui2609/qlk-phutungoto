# Warehouse Lots Search Fix - TODO

Context:
- Issue: On /warehouses/lots, searching does not return some products that exist in the product catalog. Root causes identified:
  - Supabase 1000-row limit causing incomplete matching datasets when searching via related tables.
  - Accent-sensitive search with ilike means typing without Vietnamese diacritics (e.g., "xoai") fails to match "Xoài".
  - Minor bugs in bulk-search functions using an extra space in the search pattern.

Plan (Approved):
1) Update fetch logic in src/app/(dashboard)/warehouses/lots/_hooks/useLotManagement.ts:
   - Use local (accent-insensitive) filtering against preloaded products/suppliers/qc lists from fetchCommonData for search.
   - Use fetchAllPaginated for lot_tags search to avoid 1000-row limit when collecting lot_ids matched by tags.
   - Chunk queries to lot_items when mapping product_ids → lot_ids to avoid URL length/parameter-size issues.
   - Keep final top-level lots filtering server-side with safe OR conditions and pagination.
2) Update bulk functions to fix search:
   - fetchUnassignedLotsForBulkAssign: replace buggy " % searchTerm% " with "%searchTerm%" and use local accent-insensitive filtering and paginated tag fetch.
   - fetchUntaggedLotsForBulkAssign: same fixes and keep the existing all-lots pagination pass for untagged detection.
3) No UI changes.

Status:
- [x] Implemented useLotManagement.ts search improvements (accent-insensitive local matching, paginated lot_tags, chunked lot_items).
- [x] Fixed search logic in fetchUnassignedLotsForBulkAssign (pattern cleanup + local matching + paginated tags).
- [x] Fixed search logic in fetchUntaggedLotsForBulkAssign (pattern cleanup + local matching).
- [ ] Manual test on http://localhost:3000/warehouses/lots (or active dev port) to confirm:
  - [ ] Searching by product name with diacritics finds results (e.g., "Xoài").
  - [ ] Searching by product name without diacritics finds results (e.g., "xoai").
  - [ ] Searching by SKU/internal_code/internal_name works.
  - [ ] Searching by supplier name works.
  - [ ] Searching by QC name works.
  - [ ] Searching by tag works (with and without accents).
  - [ ] Products beyond 1000th row are discoverable via search.
  - [ ] Unassigned bulk and Untagged bulk modals return expected results with the same search behavior.
- [ ] Validate pagination (next/prev) with search active.
- [ ] Quick regression: FIFO toggle order, date range filtering, and zone filtering remain functional.

Notes:
- A Next dev server instance appears to be already running and holding the .next/dev/lock. If you want to run a new one, terminate the other dev process or delete the lock after closing the process.
- If your main instance is already serving at http://localhost:3000, simply reload the page and re-test search behaviors.

How to test quickly:
1. Open the Lots page: http://localhost:3000/warehouses/lots (or your active port if different).
2. Try search terms with/without diacritics for known-catalog products, SKUs, supplier names, QC names, and tags.
3. Confirm results appear even for items that were previously missing due to 1000-row limits.
4. Open the Unassigned and Untagged bulk modals and search similarly.

/**
 * Truly dynamic "Search Anything" utility.
 * Stringifies any object/data and checks if it contains the search term (case-insensitive).
 */
export function matchSearch(data: any, term: string): boolean {
    if (!term) return true;
    if (!data) return false;

    const s = term.toLowerCase();

    // We stringify the entire object to catch all fields (present and future)
    const dynamicSearchString = JSON.stringify(data).toLowerCase();

    return dynamicSearchString.includes(s);
}

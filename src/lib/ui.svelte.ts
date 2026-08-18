// Shared reactive UI state (Svelte 5 runes store, shared across layouts).
export const ui = $state({
  /** Mobile sidebar drawer open/closed. Ignored on desktop. */
  sidebarOpen: false,
  /** Desktop: sidebar column visible vs collapsed (content expands). */
  sidebarCollapsed: false,
});

const DESKTOP_BP = '(max-width: 860px)';

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_BP).matches;
}

/** Toggle the sidebar according to the current viewport: mobile drawer vs
 * desktop collapse. */
export function toggleSidebar() {
  if (isMobile()) {
    ui.sidebarOpen = !ui.sidebarOpen;
  } else {
    ui.sidebarCollapsed = !ui.sidebarCollapsed;
  }
}

export function closeSidebar() {
  ui.sidebarOpen = false;
  ui.sidebarCollapsed = false;
}

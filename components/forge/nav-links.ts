// The three places a visitor can go from any page. Search and Practice both
// live on the dashboard, so the labels describe the task, not the route.
export const NAV_LINKS = [
  { href: "/dashboard#search", label: "Search" },
  { href: "/dashboard", label: "Practice" },
  { href: "/#how-it-works", label: "How it works" },
] as const;

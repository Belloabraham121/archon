export const siteConfig = {
  name: "Archon",
  description: "The programmable decision layer for onchain execution.",
  navigation: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Possibilities", href: "/#possibilities" },
    { label: "Architecture", href: "/#architecture" },
    { label: "Roadmap", href: "/#roadmap" },
  ],
  footer: {
    product: [
      { label: "Decision engine", href: "/#product" },
      { label: "Execution routing", href: "/#architecture" },
      { label: "Replay", href: "/#roadmap" },
    ],
    resources: [
      { label: "Documentation", href: "/#developers" },
      { label: "Architecture", href: "/#architecture" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
} as const;

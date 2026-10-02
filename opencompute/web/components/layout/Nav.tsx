import Link from "next/link";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/jobs", label: "Jobs" },
  { href: "/workers", label: "Workers" },
  { href: "/validators", label: "Validators" },
  { href: "/payments", label: "Payments" },
];

export function Nav() {
  return (
    <nav className="border-b border-neutral-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-bold">OpenCompute</Link>
        <div className="flex gap-4 text-sm text-neutral-300">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { navLinks, oroLogo } from "@/lib/content";

const closeMenuScript = `
document.addEventListener('click', function (event) {
  var link = event.target.closest && event.target.closest('#mobile-menu a');
  if (!link) return;
  var menu = link.closest('details');
  if (menu) menu.open = false;
});
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  var menu = document.querySelector('details.mobile-nav[open]');
  if (menu) menu.open = false;
});
`;

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/50 bg-brand-navy/95 text-white backdrop-blur-md">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <LogoImage
            src={oroLogo.src}
            alt={oroLogo.alt}
            width={oroLogo.width}
            height={oroLogo.height}
            sizes="128px"
            preload
            className="h-14 w-auto sm:h-16"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium tracking-wide text-slate-300 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <details className="group mobile-nav lg:hidden">
        <summary className="absolute right-6 top-0 flex h-24 cursor-pointer list-none items-center text-slate-300 marker:hidden hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
          <span className="sr-only">Menu</span>
          <Menu className="h-6 w-6 group-open:hidden" aria-hidden="true" />
          <X className="hidden h-6 w-6 group-open:block" aria-hidden="true" />
        </summary>
        <div id="mobile-menu" className="space-y-4 border-b border-slate-800 bg-brand-navy px-6 py-6">
          {navLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block py-2 font-medium text-slate-300 hover:text-white ${
                index < navLinks.length - 1 ? "border-b border-slate-800" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </details>
      <script dangerouslySetInnerHTML={{ __html: closeMenuScript }} />
    </header>
  );
}

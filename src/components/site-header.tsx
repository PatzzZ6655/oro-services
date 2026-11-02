import { Menu, X } from "lucide-react";
import { oroLogo } from "@/lib/content";
import { LogoImage } from "@/components/logo-image";

const links = [
  { href: "#brands", label: "Our Brands" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact" },
];

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
        <a
          href="#top"
          className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <LogoImage
            src={oroLogo.src}
            alt="ORO Services"
            width={oroLogo.width}
            height={oroLogo.height}
            priority
            className="h-14 w-auto sm:h-16"
          />
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium tracking-wide text-slate-300 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-sm transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <a
            href="#contact"
            className="inline-flex h-10 items-center rounded-lg border border-white/20 bg-white/10 px-5 text-sm font-semibold transition-all hover:bg-white hover:text-brand-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Contact Us
          </a>
        </div>
      </div>

      <details className="group mobile-nav md:hidden">
        <summary className="absolute right-6 top-0 flex h-24 cursor-pointer list-none items-center text-slate-300 marker:hidden hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
          <span className="sr-only">Menu</span>
          <Menu className="h-6 w-6 group-open:hidden" aria-hidden="true" />
          <X className="hidden h-6 w-6 group-open:block" aria-hidden="true" />
        </summary>
        <div id="mobile-menu" className="space-y-4 border-b border-slate-800 bg-brand-navy px-6 py-6">
          {links.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              className={`block py-2 font-medium text-slate-300 hover:text-white ${
                index < links.length - 1 ? "border-b border-slate-800" : ""
              }`}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="mt-4 block rounded-lg bg-brand-orange py-3 text-center font-semibold text-white"
          >
            Contact Us
          </a>
        </div>
      </details>
      <script dangerouslySetInnerHTML={{ __html: closeMenuScript }} />
    </header>
  );
}

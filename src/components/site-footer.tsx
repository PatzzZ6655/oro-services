import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { internalLoginHref, oroLogo } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-brand-navy py-12 text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left">
        <Link href="/" className="inline-flex rounded-lg bg-white px-2.5 py-1.5">
          <LogoImage
            src={oroLogo.src}
            alt={oroLogo.alt}
            width={oroLogo.width}
            height={oroLogo.height}
            sizes="96px"
            className="h-12 w-auto"
          />
        </Link>

        <div className="flex max-w-xl flex-col items-center gap-3 text-xs md:items-end">
          <p>© 2026 ORO Services. Emoro Building® and Emporo Plumbing® are registered trademarks of ORO Services.</p>
          <p className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-white hover:underline">
              Privacy
            </Link>
            <Link href="/contact" className="hover:text-white hover:underline">
              Contact
            </Link>
          </p>
          <a
            href={internalLoginHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[11px] font-normal text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Internal Login
          </a>
        </div>
      </div>
    </footer>
  );
}

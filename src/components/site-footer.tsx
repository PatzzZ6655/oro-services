import { Lock } from "lucide-react";
import { LogoImage } from "@/components/logo-image";
import { internalLoginHref, oroLogo } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-brand-navy py-12 text-slate-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left">
        <a href="#top" className="inline-flex rounded-lg bg-white px-2.5 py-1.5">
          <LogoImage
            src={oroLogo.src}
            alt="ORO Services"
            width={oroLogo.width}
            height={oroLogo.height}
            className="h-12 w-auto"
          />
        </a>

        <div className="flex flex-col items-center gap-4 text-xs text-slate-400 md:flex-row">
          <p>© 2026 ORO Services. Emoro Building® and Emporo Plumbing® are registered trademarks.</p>
          <span className="hidden text-slate-700 md:inline" aria-hidden="true">
            |
          </span>
          <a
            href={internalLoginHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-700 transition-colors hover:text-slate-500 hover:underline"
          >
            Internal Login
            <Lock className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}

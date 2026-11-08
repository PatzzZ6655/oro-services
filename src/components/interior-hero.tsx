import type { ReactNode } from "react";
import Link from "next/link";

type Crumb = { href?: string; label: string };

export function InteriorHero({
  eyebrow,
  title,
  crumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  crumbs?: Crumb[];
  children: ReactNode;
}) {
  return (
    <section className="bg-brand-dark px-6 pb-16 pt-36 text-white md:pt-44">
      <div className="mx-auto max-w-3xl">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-300">
            <ol className="flex flex-wrap items-center gap-2">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-white hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-widest text-orange-200">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
        <div className="mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-200">{children}</div>
      </div>
    </section>
  );
}

import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-brand-dark pb-20 pt-40 text-white md:pb-32 md:pt-52"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(30, 58, 138, 0.28), #0F172A 45%, #0B0F19 78%)",
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-brand-orange/5 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <h1 className="mx-auto max-w-4xl bg-gradient-to-b from-white to-slate-300 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent md:text-6xl md:leading-none">
          One Group. Two Specialized Services.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-relaxed text-slate-400 md:text-xl">
          ORO Services is the parent company of premium construction and
          specialized plumbing services. Explore our brands for your next
          project.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href="#brands"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-brand-navy shadow-lg shadow-white/5 transition-all hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            View Our Brands
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}

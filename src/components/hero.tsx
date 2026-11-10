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
        <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl md:leading-none">
          Building and plumbing, from one group.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-relaxed text-slate-200 md:text-xl">
          ORO Services is the parent of Emoro Building and Emporo Plumbing.
          Emoro does construction, renovations, fit-outs, and project management.
          Emporo does plumbing, water and gas, taps and toilets, pipe relining, and drainage.
        </p>
        <div className="mt-10 flex justify-center">
          <a
            href="#brands"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-brand-navy shadow-lg shadow-white/5 transition-all hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            View the brands
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}

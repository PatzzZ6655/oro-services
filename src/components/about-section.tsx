import { aboutPoints } from "@/lib/content";

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-32 bg-brand-navy py-20 text-white md:py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="mb-6 text-3xl font-bold tracking-tight">About ORO Services</h2>
        <p className="mx-auto max-w-2xl text-base font-light leading-relaxed text-slate-300 md:text-lg">
          We provide a unified management platform for construction and plumbing
          trades, allowing each distinct brand to focus entirely on its
          specialized service area.
        </p>
        <div className="mt-12 grid gap-8 text-sm text-slate-400 md:grid-cols-3">
          {aboutPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-white/5 bg-white/5 p-6"
            >
              <h3 className="mb-2 font-semibold text-white">{point.title}</h3>
              <p className="font-light">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

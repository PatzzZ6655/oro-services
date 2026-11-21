import { aboutPoints } from "@/lib/content";

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-32 bg-brand-navy py-20 text-white md:py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight">About ORO Services</h2>
        <div className="mt-10 grid gap-8 text-sm text-slate-300 md:grid-cols-3">
          {aboutPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
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

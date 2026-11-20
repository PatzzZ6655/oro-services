import type { ButtonHTMLAttributes, ReactNode } from "react";

const solid =
  "flex min-h-14 w-full items-center justify-center rounded-2xl bg-black px-4 text-center text-lg font-semibold text-white active:opacity-80 disabled:opacity-40";
const outline =
  "flex min-h-14 w-full items-center justify-center rounded-2xl border border-black bg-white px-4 text-center text-lg font-semibold text-black active:bg-black active:text-white disabled:opacity-40";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

export function JobsButton({
  variant = "solid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" | "text" }) {
  const look =
    variant === "text"
      ? `min-h-11 text-base font-semibold underline ${focus}`
      : `${variant === "outline" ? outline : solid} ${focus}`;
  return <button className={`${look} ${className}`} {...props} />;
}

export function JobsLink({
  href,
  variant = "solid",
  className = "",
  children,
}: {
  href: string;
  variant?: "solid" | "outline" | "text";
  className?: string;
  children: ReactNode;
}) {
  const look = variant === "text" ? "min-h-11 text-base font-semibold underline" : variant === "outline" ? outline : solid;
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className={`${look} ${focus} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export function Screen({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center">
        <div className="flex items-center">{back}</div>
        <h1 className="truncate text-center text-xl font-semibold">{title}</h1>
        <div className="flex justify-end">{action}</div>
      </header>
      <div className="mt-6 flex flex-1 flex-col gap-4">{children}</div>
    </main>
  );
}

export function BackLink({ href }: { href: string }) {
  return (
    <a href={href} className={`min-h-11 text-base font-semibold underline ${focus}`}>
      返回
    </a>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl border border-black px-4 py-3 text-base">
      {children}
    </p>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-300 border-t-black motion-reduce:animate-none" />
      <p className="text-lg">{label}</p>
    </div>
  );
}

export const fieldClass =
  "min-h-14 w-full rounded-2xl border border-black bg-white px-4 text-lg text-black outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

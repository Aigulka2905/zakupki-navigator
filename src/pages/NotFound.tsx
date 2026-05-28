import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Home, ArrowLeft, FileSearch } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(`404 — страница не найдена: ${location.pathname}`);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">

      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-80 w-80 translate-x-1/2 translate-y-1/2 rounded-full bg-violet-500/[0.05] blur-3xl" />

      <div className="relative z-10 mx-auto max-w-md px-6 text-center">

        {/* Icon */}
        <Reveal direction="scale" delay={0}>
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-border/60 bg-card/60 shadow-xl backdrop-blur-sm">
            <FileSearch className="h-10 w-10 text-muted-foreground/40" />
          </div>
        </Reveal>

        {/* 404 */}
        <Reveal direction="up" delay={0.1}>
          <div className="mb-2 font-mono text-[88px] font-black leading-none tracking-tighter text-foreground/[0.06] select-none">
            404
          </div>
        </Reveal>

        {/* Title + description */}
        <Reveal direction="up" delay={0.18}>
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground">
            Страница не найдена
          </h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground/70">
            Страница{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground/60">
              {location.pathname}
            </code>{" "}
            не существует или была удалена.
          </p>
        </Reveal>

        {/* Actions */}
        <Reveal direction="up" delay={0.26}>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-95"
            >
              <Home className="h-4 w-4" />
              На главную
            </Link>
            <button
              onClick={() => history.back()}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-5 py-2.5 text-sm font-semibold text-foreground/70 backdrop-blur-sm transition hover:border-border hover:text-foreground active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
          </div>
        </Reveal>

      </div>
    </div>
  );
};

export default NotFound;

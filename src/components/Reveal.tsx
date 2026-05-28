import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type Direction = "up" | "down" | "left" | "right" | "scale" | "none";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: Direction;
  className?: string;
  once?: boolean;
  duration?: number;
}

const hiddenTransform: Record<Direction, string> = {
  up:    "translateY(32px)",
  down:  "translateY(-32px)",
  left:  "translateX(-32px)",
  right: "translateX(32px)",
  scale: "scale(0.93)",
  none:  "none",
};

export function Reveal({
  children,
  delay = 0,
  direction = "up",
  className,
  once = true,
  duration = 650,
}: RevealProps) {
  const { ref, isInView } = useInView({ once });

  const style: CSSProperties = {
    transition: `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1), transform ${duration}ms cubic-bezier(0.16,1,0.3,1)`,
    transitionDelay: isInView ? `${delay * 1000}ms` : "0ms",
    opacity:   isInView ? 1 : 0,
    transform: isInView ? "none" : hiddenTransform[direction],
    willChange: "opacity, transform",
  };

  return (
    <div ref={ref} className={cn("", className)} style={style}>
      {children}
    </div>
  );
}

/** Staggered container — wraps a list and applies auto-incremented delays */
interface StaggerProps {
  children: React.ReactNode;
  base?: number;       // base delay in seconds (default 0.05)
  className?: string;
  direction?: Direction;
}

export function Stagger({ children, base = 0.07, className, direction = "up" }: StaggerProps) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} delay={i * base} direction={direction}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

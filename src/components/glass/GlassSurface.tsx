import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type GlassSurfaceOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  variant?: "default" | "strong" | "subtle";
};

type GlassSurfaceProps<T extends ElementType> = GlassSurfaceOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof GlassSurfaceOwnProps<T>>;

export function GlassSurface<T extends ElementType = "div">({
  as,
  children,
  className,
  variant = "default",
  ...props
}: GlassSurfaceProps<T>) {
  const Component = as ?? "div";

  return (
    <Component className={["glass-surface", `glass-surface--${variant}`, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Component>
  );
}

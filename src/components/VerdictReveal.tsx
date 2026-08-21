"use client";

import { useState } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

/**
 * Holds the band chip and its description back until the needle has all but landed.
 *
 * The delay cannot live in a class on the server-rendered markup: a CSS animation starts
 * its clock at first paint, while the gauge starts its sweep at hydration, so the verdict
 * would arrive before the number it describes on exactly the slow connections where the
 * gap matters most. Arming the class in a layout effect puts both on the same clock.
 */
export function VerdictReveal({
  animate,
  className,
  children,
}: {
  animate: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (animate) setArmed(true);
  }, [animate]);

  return (
    <div
      className={`${className ?? ""} ${armed ? "verdict-late" : ""}`}
      data-prestart={animate && !armed ? "" : undefined}
    >
      {children}
    </div>
  );
}

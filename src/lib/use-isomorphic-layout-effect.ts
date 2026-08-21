import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect on the client, useEffect on the server.
 *
 * Both of this app's entrances render their finished state on the server and then wind
 * themselves back before the browser paints, so a failed or absent script leaves the
 * real value on screen. That only works in a layout effect, and React warns about
 * useLayoutEffect during SSR, hence the swap.
 */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

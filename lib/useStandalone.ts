"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia(QUERY).matches || ios === true;
}

// True als de site als app vanaf het beginscherm geopend is (dus zonder adresbalk).
export function useStandalone() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

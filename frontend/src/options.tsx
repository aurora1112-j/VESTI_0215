import Dashboard from "./dashboard"

import "./offscreen"

const isOffscreenRuntime =
  typeof window !== "undefined" &&
  new URL(window.location.href).searchParams.get("offscreen") === "1"

function OffscreenOptionsRuntime() {
  return null
}

export default isOffscreenRuntime ? OffscreenOptionsRuntime : Dashboard

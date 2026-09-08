// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

export type GraphPanel = "graph" | "repl"

const key = "coln-lab-graph:active-panel"

export function loadGraphPanel(): GraphPanel {
  try {
    return localStorage.getItem(key) === "repl" ? "repl" : "graph"
  } catch {
    return "graph"
  }
}

export function saveGraphPanel(panel: GraphPanel): void {
  try {
    localStorage.setItem(key, panel)
  } catch {
    // Panel selection remains usable for the current session when storage is unavailable.
  }
}

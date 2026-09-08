// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getContext, setContext } from "svelte"

const contextKey = Symbol("editor-preferences")
const storageKey = "coln-lab:vim-enabled"

export class EditorPreferences {
  vimEnabled = $state(readVimEnabled())

  setVimEnabled(enabled: boolean): void {
    this.vimEnabled = enabled
    try {
      localStorage.setItem(storageKey, String(enabled))
    } catch {
      // Vim remains available for the current session when storage is unavailable.
    }
  }
}

function readVimEnabled(): boolean {
  try {
    return localStorage.getItem(storageKey) === "true"
  } catch {
    return false
  }
}

export function provideEditorPreferences(): EditorPreferences {
  const preferences = new EditorPreferences()
  setContext(contextKey, preferences)
  return preferences
}

export function useEditorPreferences(): EditorPreferences {
  return getContext<EditorPreferences>(contextKey)
}

// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { getContext, setContext } from "svelte"

const contextKey = Symbol("editor-preferences")
const storageKey = "coln-lab:vim-enabled"

export class EditorPreferences {
  vimEnabled = $state(false)

  load(): void {
    try {
      this.vimEnabled = localStorage.getItem(storageKey) === "true"
    } catch {
      this.vimEnabled = false
    }
  }

  setVimEnabled(enabled: boolean): void {
    this.vimEnabled = enabled
    try {
      localStorage.setItem(storageKey, String(enabled))
    } catch {
      // Vim remains available for the current session when storage is unavailable.
    }
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

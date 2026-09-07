<!-- SPDX-FileCopyrightText: 2026 Coln contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 OR MIT -->

<script lang="ts">
  import type { Router } from "../lib/router.svelte.ts"
  let { router }: { router: Router } = $props()
</script>

<section class="lab-grid-field h-full min-h-0 overflow-auto px-4 py-10 min-[761px]:px-8 min-[761px]:py-16">
  <div class="mx-auto max-w-4xl">
    <a class="font-['DM_Mono'] text-xs tracking-[.16em] text-[#a7ba69] uppercase no-underline hover:text-[#d8ff57]" data-small-detail href={router.href("home")} onclick={(event) => router.follow(event, "home")}>← Coln Lab</a>

    <header class="mt-8 border-b border-[var(--lab-border)] pb-10">
      <p class="m-0 font-['DM_Mono'] text-xs tracking-[.2em] text-[#a7ba69] uppercase" data-small-detail>Project Log</p>
      <h1 class="mt-4 mb-3 text-4xl leading-[1.05] font-semibold tracking-[-.04em] text-[#f0f1e8] min-[761px]:text-6xl">Changelog</h1>
      <p class="m-0 max-w-2xl text-sm leading-7 text-[#9ba6a0] min-[761px]:text-base">Notable changes to Coln Lab, recorded as they happen.</p>
    </header>

    <ol class="m-0 list-none p-0">
      <li class="grid gap-5 border-b border-[var(--lab-border)] py-10 min-[761px]:grid-cols-[12rem_1fr]">
        <time class="font-['DM_Mono'] text-xs tracking-[.12em] text-[#a7ba69] uppercase" data-small-detail datetime="2026-09-07">September 7, 2026</time>
        <div>
          <h2 class="m-0 text-2xl font-semibold tracking-[-.03em] text-[#edf0e7]">TypeScript support</h2>
          <p class="mt-3 mb-0 text-sm leading-7 text-[#929e98]">Added TypeScript support and autocomplete to the embedded REPL.</p>
        </div>
      </li>
      <li class="grid gap-5 border-b border-[var(--lab-border)] py-10 min-[761px]:grid-cols-[12rem_1fr]">
        <time class="font-['DM_Mono'] text-xs tracking-[.12em] text-[#a7ba69] uppercase" data-small-detail datetime="2026-09-07">September 7, 2026</time>
        <div>
          <h2 class="m-0 text-2xl font-semibold tracking-[-.03em] text-[#edf0e7]">Initial demo</h2>
          <p class="mt-3 mb-0 text-sm leading-7 text-[#929e98]">Coln Lab’s initial demo launched.</p>
        </div>
      </li>
    </ol>
  </div>
</section>

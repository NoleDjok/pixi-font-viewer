<script setup lang="ts">
import { applyCharMap, charMap, viewer } from '../store';

async function onChange(event: Event): Promise<void> {
    if (event.target instanceof HTMLTextAreaElement) {
        await applyCharMap(event.target.value);
    }
}
</script>

<template>
    <section class="section">
        <h2 class="section__title">File name mapping</h2>
        <label class="field__label" for="char-map">Extra fontCharMap entries of the game</label>
        <textarea
            id="char-map"
            class="field__input field__input--text"
            rows="2"
            spellcheck="false"
            placeholder="x_small: 'x', m_small: 'm'"
            :value="viewer.charMapText"
            :aria-invalid="charMap.errors.length > 0"
            aria-describedby="char-map-hint"
            data-test="char-map"
            @change="onChange"
        ></textarea>
        <ul v-if="charMap.errors.length > 0" class="field__error-list">
            <li v-for="error in charMap.errors" :key="error" class="field__error">{{ error }}</li>
        </ul>
        <p id="char-map-hint" class="field__hint">
            Only if the game renames glyph files in <code>tools/assets-builder.config.ts</code>. Applied to glyph PNG
            folders when the field loses focus.
        </p>
    </section>
</template>

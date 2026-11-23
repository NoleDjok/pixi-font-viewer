<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    id: string;
    label: string;
    modelValue: number;
    min: number;
    max: number;
    step: number;
    hint?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const draft = ref(String(props.modelValue));
const invalid = ref(false);

watch(
    () => props.modelValue,
    (value) => {
        if (Number(draft.value) !== value) {
            draft.value = String(value);
            invalid.value = false;
        }
    },
);

function onInput(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
        return;
    }

    draft.value = event.target.value;
    const value = Number(draft.value);
    invalid.value = draft.value.trim() === '' || !Number.isFinite(value) || value < props.min || value > props.max;

    if (!invalid.value) {
        emit('update:modelValue', value);
    }
}

function onBlur(): void {
    if (invalid.value) {
        draft.value = String(props.modelValue);
        invalid.value = false;
    }
}
</script>

<template>
    <div class="field">
        <label class="field__label" :for="id">{{ label }}</label>
        <input
            :id="id"
            class="field__input"
            :class="{ 'field__input--invalid': invalid }"
            type="number"
            :min="min"
            :max="max"
            :step="step"
            :value="draft"
            :aria-invalid="invalid"
            :aria-describedby="hint ? `${id}-hint` : undefined"
            @input="onInput"
            @blur="onBlur"
        />
        <p v-if="invalid" class="field__error">Enter a number from {{ min }} to {{ max }}.</p>
        <p v-else-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
    </div>
</template>

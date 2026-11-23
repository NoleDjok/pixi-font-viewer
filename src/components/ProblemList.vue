<script setup lang="ts">
import { clearProblems, dismissProblem, viewer } from '../store';
import { LEVEL_LABELS } from './components.config';
</script>

<template>
    <section v-if="viewer.problems.length > 0" class="section" aria-live="polite">
        <h2 class="section__title">
            Load messages
            <button type="button" class="link-button" @click="clearProblems">Clear</button>
        </h2>
        <ul class="problem-list">
            <li
                v-for="problem in viewer.problems"
                :key="problem.id"
                class="problem"
                :class="`problem--${problem.level}`"
            >
                <span class="problem__level">{{ LEVEL_LABELS[problem.level] }}</span>
                <span class="problem__body">
                    <span v-if="problem.path" class="problem__path">{{ problem.path }}</span>
                    {{ problem.message }}
                </span>
                <button
                    type="button"
                    class="icon-button icon-button--small"
                    aria-label="Dismiss message"
                    @click="dismissProblem(problem.id)"
                >
                    ×
                </button>
            </li>
        </ul>
    </section>
</template>

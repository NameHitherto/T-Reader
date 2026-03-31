<template>
  <button
    type="button"
    class="bubble-toggle"
    :class="{ 'is-second': activeIndex === 1 }"
    :aria-label="ariaLabel || activeOption.label"
    :title="activeOption.label"
    @click="toggleValue"
  >
    <span class="bubble-toggle__stage">
      <span class="bubble-toggle__option bubble-toggle__option--first">
        {{ firstOption.label }}
      </span>
      <span class="bubble-toggle__option bubble-toggle__option--second">
        {{ secondOption.label }}
      </span>
    </span>
  </button>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'

interface BubbleToggleOption {
  label: string
  value: string
}

export default defineComponent({
  name: 'BubbleToggle',
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    options: {
      type: Array as PropType<BubbleToggleOption[]>,
      required: true,
      validator: (options: BubbleToggleOption[]) => Array.isArray(options) && options.length === 2,
    },
    ariaLabel: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const fallbackOption: BubbleToggleOption = {
      label: '',
      value: '',
    }
    const firstOption = computed(() => props.options[0] || fallbackOption)
    const secondOption = computed(() => props.options[1] || fallbackOption)
    const activeIndex = computed(() => {
      return props.options[1]?.value === props.modelValue ? 1 : 0
    })
    const activeOption = computed(() => {
      return activeIndex.value === 1 ? secondOption.value : firstOption.value
    })

    const toggleValue = () => {
      const nextValue = activeIndex.value === 1 ? firstOption.value.value : secondOption.value.value
      emit('update:modelValue', nextValue)
      emit('change', nextValue)
    }

    return {
      activeIndex,
      activeOption,
      firstOption,
      secondOption,
      toggleValue,
    }
  },
})
</script>

<style lang="scss" scoped>
.bubble-toggle {
  --bubble-toggle-shell-padding: 6px 10px;
  --bubble-toggle-radius: var(--radius-sm);
  --bubble-toggle-shell-bg: var(--surface-brand-gradient);
  --bubble-toggle-shell-border: var(--border-brand);
  --bubble-toggle-shell-shadow: var(--shadow-sm);
  --bubble-toggle-focus-ring: var(--ring-brand-soft);
  --bubble-toggle-font-size: 14px;
  --bubble-toggle-font-weight: 700;
  --bubble-toggle-font-style: normal;
  --bubble-toggle-letter-spacing: 0;
  --bubble-toggle-text: var(--text-secondary);
  --bubble-toggle-active-text: var(--text-primary);
  --bubble-toggle-stage-offset-inline-end: 0;

  width: fit-content;
  max-width: 100%;
  padding: var(--bubble-toggle-shell-padding);
  border: 1px solid var(--bubble-toggle-shell-border);
  border-radius: var(--bubble-toggle-radius);
  background: var(--bubble-toggle-shell-bg);
  box-shadow: var(--bubble-toggle-shell-shadow);
  color: var(--bubble-toggle-active-text);
  cursor: var(--t-mouse-cursor-link), pointer;
  transition:
    transform var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:focus-visible {
    outline: none;
    box-shadow:
      var(--bubble-toggle-shell-shadow),
      0 0 0 3px var(--bubble-toggle-focus-ring);
  }
}

.bubble-toggle__stage {
  position: relative;
  display: grid;
  margin-inline-end: var(--bubble-toggle-stage-offset-inline-end);
}

.bubble-toggle__option {
  grid-column: 1;
  grid-row: 1;
  color: var(--bubble-toggle-text);
  font-size: var(--bubble-toggle-font-size);
  font-weight: var(--bubble-toggle-font-weight);
  font-style: var(--bubble-toggle-font-style);
  letter-spacing: var(--bubble-toggle-letter-spacing);
  line-height: 1.2;
  transition:
    transform var(--duration-slow) var(--easing-standard),
    opacity var(--duration-base) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard);
}

.bubble-toggle__option--first {
  transform: translateY(-100%);
  opacity: 0;
}

.bubble-toggle__option--second {
  transform: translateY(100%);
  opacity: 0;
}

.bubble-toggle:not(.is-second) .bubble-toggle__option--first,
.bubble-toggle.is-second .bubble-toggle__option--second {
  transform: translateY(0);
  opacity: 1;
  color: var(--bubble-toggle-active-text);
}

@media (prefers-reduced-motion: reduce) {
  .bubble-toggle,
  .bubble-toggle__option {
    transition: none;
  }
}
</style>

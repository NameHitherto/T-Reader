<template>
  <span class="app-icon" :style="wrapperStyle" :aria-label="ariaLabel">
    <span v-if="icon.mode === 'mask'" class="app-icon-mask" :style="maskStyle" />
    <img v-else class="app-icon-img" :src="icon.src" :alt="ariaLabel || 'icon'" />
  </span>
</template>

<script lang="ts">
import { computed, PropType } from 'vue'
import { getIconDefinition, IconName } from '@/icons/registry'

export default {
  name: 'AppIcon',
  props: {
    name: {
      type: String as PropType<IconName>,
      required: true,
    },
    size: {
      type: [Number, String],
      default: 20,
    },
    color: {
      type: String,
      default: 'currentColor',
    },
    ariaLabel: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const icon = computed(() => getIconDefinition(props.name))

    const normalizedSize = computed(() => {
      if (typeof props.size === 'number') {
        return `${props.size}px`
      }
      return props.size
    })

    const wrapperStyle = computed(() => ({
      width: normalizedSize.value,
      height: normalizedSize.value,
      color: props.color,
    }))

    const maskStyle = computed(() => ({
      WebkitMaskImage: `url(${icon.value.src})`,
      maskImage: `url(${icon.value.src})`,
    }))

    return {
      icon,
      wrapperStyle,
      maskStyle,
    }
  },
}
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

.app-icon-mask {
  width: 100%;
  height: 100%;
  display: block;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.app-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>

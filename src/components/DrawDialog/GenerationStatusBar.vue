<template>
  <Transition name="gen-status">
    <div
      v-if="imageGenerationTask.status !== 'idle'"
      class="generation-status"
      :class="`generation-status--${imageGenerationTask.status}`"
      :title="statusTitle"
      @click="dismissImageGenerationStatus"
    >
      <span class="generation-status-dot" />
      <span class="generation-status-text">{{ statusText }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  dismissImageGenerationStatus,
  imageGenerationTask,
} from '@/services/gallery/imageGenerationTaskService'

defineOptions({ name: 'GenerationStatusBar' })

const statusText = computed(() => {
  switch (imageGenerationTask.status) {
    case 'generating':
      return 'AI绘画生成中…'
    case 'success':
      return '插画已保存到画廊'
    case 'error':
      return `生成失败：${imageGenerationTask.errorMessage}`
    default:
      return ''
  }
})

const statusTitle = computed(() => {
  if (imageGenerationTask.status === 'error') {
    return imageGenerationTask.errorMessage
  }

  return imageGenerationTask.prompt
})
</script>

<style lang="scss" scoped>
.generation-status {
  position: fixed;
  right: 50px;
  bottom: 15px;
  z-index: 4600;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: min(40vw, 360px);
  color: var(--reader-text-muted);
  font-size: 13px;
  font-weight: bold;
  line-height: 1.45;
  text-shadow: var(--text-shadow-soft);
  cursor: var(--t-mouse-cursor-link), pointer;
  user-select: none;
}

.generation-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.generation-status-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.generation-status--generating .generation-status-dot {
  background: var(--brand-primary);
  animation: generation-status-pulse 1.2s ease-in-out infinite;
}

.generation-status--success .generation-status-dot {
  background: var(--el-color-success, #67c23a);
}

.generation-status--error .generation-status-dot {
  background: var(--el-color-danger, #f56c6c);
}

.gen-status-enter-active,
.gen-status-leave-active {
  transition: opacity var(--duration-fast) var(--easing-standard);
}

.gen-status-enter-from,
.gen-status-leave-to {
  opacity: 0;
}

@keyframes generation-status-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.35;
  }
}
</style>

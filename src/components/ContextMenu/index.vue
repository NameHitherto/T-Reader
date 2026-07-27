<template>
  <Teleport to="body">
    <Transition name="menu">
      <div
        v-if="show && menuActive"
        ref="menu"
        class="context-menu"
        :class="menuData.theme"
        :style="{ top: `${menuData.y}px`, left: `${menuData.x}px`, width: `${menuData.width}px` }"
        @contextmenu="($event) => $event.preventDefault()"
      >
        <div class="menu-body">
          <div v-for="(item, idx) in menuData.items" :key="idx" class="menu-list">
            <div v-if="item.type === 'delete'" class="separator"></div>
            <div
              class="menu-item"
              :class="{ 'menu-item--danger': item.type === 'delete' }"
              @click="(event) => handleClick(item, event)"
            >
              <AppIcon class="menu-icon" :name="resolveIconName(item.type)" :size="18" />
              <span class="label">{{ item.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script lang="ts">
import { PropType } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { IconName } from '@/icons/registry'
import { ContextMenuData, ContextMenuItem } from '@/types/contextMenu'
export default {
  name: 'ContextMenu',
  components: {
    AppIcon,
  },
  props: {
    show: Boolean,
    menuData: {
      type: Object as PropType<ContextMenuData>,
      required: true,
    },
  },
  emits: ['update:show'],
  data() {
    return {
      menuActive: true,
    }
  },
  watch: {
    menuData: {
      handler() {
        this.menuActive = false
        this.$nextTick(() => {
          this.menuActive = true
        })
      },
      deep: true,
    },
  },
  mounted() {
    document.addEventListener('click', this.handleBackDropClick)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleBackDropClick)
  },
  methods: {
    resolveIconName(type?: ContextMenuItem['type']): IconName {
      return type ? type : 'default'
    },
    handleBackDropClick(event: MouseEvent) {
      const target = event.target as Node
      const menu = this.$refs.menu as HTMLElement
      if (menu && !menu.contains(target)) {
        this.$emit('update:show', false)
      }
    },
    handleClick(item: ContextMenuItem, event: MouseEvent | KeyboardEvent) {
      if (item.onClick) {
        item.onClick(event)
      }
      this.$emit('update:show', false)
    },
  },
}
</script>
<style scoped lang="scss">
.context-menu {
  position: absolute;
  border-radius: var(--radius-md);
  padding: 6px;
  border: 1px solid var(--border-default);
  background: var(--surface-strong);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);

  .menu-body {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .menu-list {
      display: flex;
      flex-direction: column;

      .separator {
        width: 100%;
        border-radius: var(--radius-pill);
        margin: 4px 0 6px 0;
        border: 1px dashed var(--border-soft);
      }

      .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        transition:
          background-color 0.2s ease,
          transform 0.2s ease,
          box-shadow 0.2s ease;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        cursor: var(--t-mouse-cursor-link), pointer;
        position: relative;
        overflow: hidden;
        user-select: none;
        color: var(--text-secondary);

        .label {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .menu-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        &:hover {
          background: var(--surface-brand-soft);
          box-shadow: inset 0 0 0 1px var(--ring-brand-subtle);
          transform: translateY(-1px);
        }

        &.menu-item--danger {
          color: var(--text-danger);

          &:hover {
            background: var(--surface-danger-soft);
            box-shadow: inset 0 0 0 1px var(--ring-danger-subtle);
          }
        }
      }
    }
  }
}

.dark {
  background: var(--surface-strong);
}

.light {
  background: var(--surface-strong);
}

.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>

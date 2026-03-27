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
          <div class="menu-list" v-for="(item, idx) in menuData.items" :key="idx">
            <div class="separator" v-if="item.type === 'delete'"></div>
            <div
              class="menu-item"
              :class="{ 'menu-item--danger': item.type === 'delete' }"
              @click="(event) => handleClick(item, event)"
            >
              <AppIcon
                class="menu-icon"
                :name="resolveIconName(item.type)"
                :size="18"
                :color="item.type === 'delete' ? '#dc2626' : '#475569'"
              />
              <span class="label">{{ item.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script lang="ts">
import { ContextMenuData, ContextMenuItem } from '../../js/map'
import { PropType } from 'vue'
import AppIcon from '@/components/common/AppIcon/index.vue'
import { IconName } from '@/icons/registry'
export default {
  name: 'ContextMenu',
  components: {
    AppIcon,
  },
  props: {
    show: Boolean,
    menuData: {
      type: Object as PropType<ContextMenuData>,
      required: true
    },
  },
  data() {
    return {
      menuActive: true
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
      deep: true
    }
  },
  methods: {
    resolveIconName(type?: ContextMenuItem['type']): IconName {
      return type ? type : 'default'
    },
    handleBackDropClick(event: MouseEvent) {
      const target = event.target as Node
      const menu = this.$refs.menu as HTMLElement;
      if(menu && !menu.contains(target)){
        this.$emit('update:show', false)
      }
    },
    handleClick(item: ContextMenuItem, event: MouseEvent | KeyboardEvent) {
      if (item.onClick) {
        item.onClick(event)
      }
      this.$emit('update:show', false)
    }
  },
  mounted() {
    document.addEventListener('click', this.handleBackDropClick)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleBackDropClick)
  }
}
</script>
<style scoped lang="scss">
.context-menu {
  position: absolute;
  border-radius: 16px;
  padding: 6px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  box-shadow:
    0 16px 40px rgba(15, 23, 42, 0.12),
    0 4px 14px rgba(15, 23, 42, 0.08);
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
        border-radius: 999px;
        margin: 4px 0 6px 0;
        border: 1px dashed rgba(203, 213, 225, 0.9);
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
        border-radius: 12px;
        cursor: var(--t-mouse-cursor-link), pointer;
        position: relative;
        overflow: hidden;
        user-select: none;
        color: #334155;

        .label {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: color 0.2s ease;
        }

        .menu-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        &:hover {
          background: rgba(59, 130, 246, 0.1);
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08);
          transform: translateY(-1px);
        }

        &.menu-item--danger {
          color: #991b1b;

          &:hover {
            background: rgba(239, 68, 68, 0.1);
            box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.08);
          }
        }
      }
    }
  }
}

.dark {
  background:
    linear-gradient(180deg, rgba(45, 55, 72, 0.96), rgba(30, 41, 59, 0.96));
  border-color: rgba(71, 85, 105, 0.9);
}

.light {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
}

.menu-enter-active, .menu-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.menu-enter-from, .menu-leave-to{
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>

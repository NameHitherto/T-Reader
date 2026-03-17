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
            <div class="menu-item" @click="(event) => handleClick(item, event)">
              <span class="label">{{ item.label }}</span>
              <AppIcon
                class="menu-icon"
                :name="resolveIconName(item.type)"
                :size="22"
                :color="menuData.theme === 'dark' ? '#e9e9e9' : '#333333'"
              />
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
<style scoped>
.context-menu {
  position: absolute;
  border-radius: 10px;
  padding: 3px 4px;

  .menu-body {
    display: flex;
    flex-direction: column;
    gap: 3px;

    .menu-list {
      display: flex;
      flex-direction: column;

      .separator {
        width: 100%;
        border-radius: 10px;
        margin: 2px 0 5px 0;
      }

      .menu-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.3s ease;
        padding: 6px 8px;
        border-radius: 5px;
        cursor: var(--t-mouse-cursor-link), pointer;
        position: relative;
        overflow: hidden;
        user-select: none;

        .label {
          font-weight: 400;
          transition: all 0.2s ease;
        }

        .menu-icon {
          width: 22px;
          height: 22px;
        }
      }
    }
  }
}

.dark {
  background: #363636;
  border: 2px solid #313131;

  .menu-list {
    color: #e9e9e9;

    .separator {
      border: 1px solid #444444;
    }

    .menu-item {
      &:hover {
        background: #6a6c6d;
      }
    }
  }
}

.light {
  background: #f9f9f9;
  border: 2px solid #e9e9e9;

  .menu-list {
    color: #333;

    .separator {
      border: 1px solid #e9e9e9;
    }

    .menu-item {
      &:hover {
        background: #e9e9e9;
      }
    }
  }
}

.menu-enter-active, .menu-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.menu-enter-from, .menu-leave-to{
  opacity: 0;
  transform: scale(0.95);
}
</style>

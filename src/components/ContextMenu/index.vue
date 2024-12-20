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
            <div class="menu-item" @click="(event) => handleClick(item, event)">
              <span class="label">{{ item.label }}</span>
              <img :src="svgIcons[item.type === undefined ? 'default' : item.type]" />
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
import bookOpenIcon from './assets/book-open.svg'
import deleteIcon from './assets/delete.svg'
import goBackIcon from './assets/go-back.svg'
import infoIcon from './assets/info.svg'
import defaultIcon from './assets/default.svg'
export default {
  name: 'ContextMenu',
  props: {
    show: Boolean,
    menuData: {
      type: Object as PropType<ContextMenuData>,
      required: true
    },
  },
  data() {
    return {
      svgIcons: {
        bookOpen: bookOpenIcon,
        delete: deleteIcon,
        goBack: goBackIcon,
        info: infoIcon,
        default: defaultIcon
      },
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
    .menu-list {
      display: flex;
      flex-direction: column;
      gap: 3px;

      .menu-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.3s ease;
        padding: 6px 8px;
        border-radius: 5px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        user-select: none;

        .label {
          font-weight: 400;
          transition: all 0.2s ease;
        }

        img {
          width: 22px;
          height: 22px;
        }
      }
    }
  }
}

.dark {
  background: #222222;
  border: 2px solid #313131;

  .menu-list {
    color: #e9e9e9;

    .menu-item {
      &:hover {
        background: #333333;
      }

      img {
        filter: invert(100%);
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

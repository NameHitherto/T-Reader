<template>
  <div class="exp">
    <div class="placeholder">
      实验页面建设中
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'Experiment',
  components: {
  },
  data() {
    return {
    }
  },
  computed: {
  },
  watch: {
  },
  methods: {
  }
})
</script>

<style scoped>
.exp {
  width: 100%;
  padding: 120px 48px;
  background: var(--app-bg-accent);

  .placeholder {
    width: 100%;
    min-height: 260px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-xl);
    background: var(--surface-card);
    color: var(--text-tertiary);
    box-shadow: var(--shadow-sm);
  }
}
</style>

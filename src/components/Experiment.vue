<template>
  <div class="exp">
    <div class="skeleton">
      <el-skeleton :rows="8" animated />
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
  padding: 200px;

  .skeleton {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
</style>

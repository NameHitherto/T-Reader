<template>
  <el-dialog
    align-center
    destroy-on-close
    title="设置中心"
    class="dialog-wrapper"
    :append-to-body="true"
    :show-close="false"
    :close-on-press-escape="false"
    @open="onOpen"
  >
    <div class="section">
      <el-divider class="divider" content-position="left">云同步</el-divider>
      <div class="input-container">
        <label class="input-label">webDAV服务器</label>
        <el-input class="input-button" v-model="webdavUrl" placeholer="请输入云同步的目录">
          <template #prepend>(https://)</template>
        </el-input>
      </div>
      <div class="input-container">
        <label class="input-label">用户名</label>
        <el-input class="input-button" v-model="webdavUsername" placeholer="请输入用户名"></el-input>
      </div>
      <div class="input-container">
        <label class="input-label">密码</label>
        <el-input class="input-button" v-model="webdavPassword" type="password" placeholer="请输入密码" show-password></el-input>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="saveSetting">保存</el-button>
        <el-button type="info" @click="() => this.$emit('close-dialog')">取消</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { invoke } from '@tauri-apps/api/core';

export default {
  name: 'SettingDialog',
  props: {
    
  },  
  data() {
    return {
      settings: {},
      webdavUrl: '',
      webdavUsername: '',
      webdavPassword: ''
    };
  },
  methods: {
    async onOpen() {
      this.settings = await invoke('load_settings');
      if (this.settings) {
        this.webdavUrl = this.settings.webdavUrl;
        this.webdavUsername = this.settings.webdavUser;
        this.webdavPassword = this.settings.webdavPass;
      }
    },
    async saveSetting() {
      this.settings = {
        webdavUrl: this.webdavUrl,
        webdavUser: this.webdavUsername,
        webdavPass: this.webdavPassword
      }
      await invoke('save_settings', {jsonStr: JSON.stringify(this.settings)});
      this.$emit('close-dialog');
    }
  },
  computed: {
    // Your computed properties here
  },
  watch: {
    // Your watchers here
  },
  created() {
    // Lifecycle hook
  },
  mounted() {
    // Lifecycle hook
  },
};
</script>

<style scoped>
.dialog-wrapper {
  .section {
    border-left: var(--t-border-thin);
    border-right: var(--t-border-thin);
    border-bottom: var(--t-border-thin);
    margin-bottom: 6px;

    .divider {
      & :deep(.el-divider__text) {
        font-size: 17px;
        font-weight: bold;
      }
    }
    .input-container {
      margin: 0 10px 10px 10px;

      .input-label {
        font-size: 14px;
        color: var(--t-color-dark-grey);
        font-weight: 600;
      }
    }
  }
}
</style>
<style>
.dialog-wrapper {
  max-width: 550px;
}
</style>
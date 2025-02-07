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
    <div class="section">
      <el-divider class="divider" content-position="left">AI大模型</el-divider>
      <div class="switch-container">
        <label class="switch-label">是否开启</label>
        <el-switch v-model="isAiAssistantEnabled"/>
      </div>
      <div class="select-container">
        <label class="select-label">模型编码</label>
        <el-select v-model="modelValue" placeholder="请选择" :disabled="!isAiAssistantEnabled">
          <el-option 
            v-for="item in modelList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="input-container">
        <label class="input-label">模型路径</label>
        <el-input class="input-button" v-model="modelUrl" :readonly="true" :disabled="!isAiAssistantEnabled"></el-input>
      </div>
      <div class="input-container">
        <label class="input-label">API key</label>
        <el-input class="input-button" v-model="modelAPIKey" type="password" show-password :disabled="!isAiAssistantEnabled"></el-input>
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
      webdavPassword: '',
      isAiAssistantEnabled: false,
      modelValue: '',
      modelList: [
        { value: 'glm-4-flash', label: '智谱清言' }
      ],
      modelAPIKey: ''
    };
  },
  computed: {
    modelUrl() {
      if (this.modelValue === '') {
        return ''
      } else if (this.modelValue === 'glm-4-flash') {
        return 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
      }
    }
  },
  methods: {
    async onOpen() {
      const loadedSettings = await invoke('load_settings');
      const defaults = {
        webdavUrl: '',
        webdavUser: '',
        webdavPass: '',
        isAiEnabled: 'false',
        modelName: '',
        modelUrl: '',
        modelApiKey: ''
      };
      this.settings = { ...defaults, ...loadedSettings };
      this.webdavUrl = this.settings.webdavUrl;
      this.webdavUsername = this.settings.webdavUser;
      this.webdavPassword = this.settings.webdavPass;
      this.isAiAssistantEnabled = this.settings.isAiEnabled === 'true';
      this.modelValue = this.settings.modelName;
      this.modelAPIKey = this.settings.modelApiKey;
    },
    async saveSetting() {
      this.settings = {
        webdavUrl: this.webdavUrl,
        webdavUser: this.webdavUsername,
        webdavPass: this.webdavPassword,
        isAiEnabled: this.isAiAssistantEnabled.toString(),
        modelName: this.modelValue,
        modelUrl: this.modelUrl,
        modelApiKey: this.modelAPIKey
      }
      await invoke('save_settings', {jsonStr: JSON.stringify(this.settings)});
      this.$emit('close-dialog');
    }
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
    .switch-container {
      margin: 0 10px 10px 10px;
      display: inline-flex;
      gap: 10px;
      justify-content: center;
      align-items: center;

      .switch-label {
        font-size: 14px;
        color: var(--t-color-dark-grey);
        font-weight: 600;
      }
    }
    .select-container {
      margin: 0 10px 10px 10px;

      .select-label {
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
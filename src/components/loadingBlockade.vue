<template>
  <div class="loading-wrapper">
    <div class="blockade-box">
      <div class="blockade-line">
        <span>{{ warnText }}</span>
        <span>{{ warnText }}</span>
      </div>
      <div class="blockade-line">
        <span>{{ warnText }}</span>
        <span>{{ warnText }}</span>
      </div>
      <div class="blockade-line">
        <span>{{ warnText }}</span>
        <span>{{ warnText }}</span>
      </div>
      <div class="blockade-line">
        <span>{{ warnText }}</span>
        <span>{{ warnText }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
export default {
  name: 'loadingBlockade',
  props: {
    warnText: {
      type: String,
      default: 'Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross - Police line do not cross'
    }
  }
}
</script>
<style scoped>
@keyframes HorseRacelamp_move_1 {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}

@keyframes HorseRacelamp_move_2 {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-200%);
  }
}

.loading-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px) brightness(0.6);
  z-index: 99;

  .blockade-box {
    background-color: transparent;
    height: 100%;
    width: 100%;
    padding-top: 20%;
    overflow: hidden;
    position: relative;

    .blockade-line {
      position: relative;
      box-shadow: 0 15px 12px #00000080;
      display: flex;
      left: -150px;
      width: calc(100% + 650px);

      span{
        animation: HorseRacelamp_move_1 60s linear infinite;
        animation-delay: -60s;
        background-color: #e9c804;
        color: #1d1104;
        font-family: SourceHanSansCN-Bold !important;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: .2em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      span:nth-child(2){
        animation: HorseRacelamp_move_2 60s linear infinite;
        animation-delay: -30s;
      }
    }

    .blockade-line:first-of-type {
      transform: rotate(25deg) translateY(180px);
    }
    .blockade-line:nth-of-type(2) {
      transform: rotate(-20deg) translateY(160px);
    }
    .blockade-line:nth-of-type(3) {
      transform: rotate(-15deg) translateY(-60px);
    }
    .blockade-line:nth-of-type(4) {
      transform: rotate(30deg) translateY(250px);
    }
  }
}
</style>
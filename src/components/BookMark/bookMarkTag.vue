<template>
    <div class="tag-item">
        <div v-if="!isFirst" class="tag-tail-left"></div>
        <div v-if="!isLast" class="tag-tail-right"></div>
        <div class="tag-node"></div>
        <div class="tag-link"></div>
        <div class="tag-body" @click="handleOptions">
            <span class="tag-content">{{ bookMark.content }}</span>
            <span class="tag-comment" :class="bookMark.comments ? 'primary' : 'info'">{{ bookMark.comments ? bookMark.comments : '你还未对此作出评价' }}</span>
            <div class="tag-options">
                <el-tooltip
                    class="tag-tooltip"
                    content="跳转到笔记处"
                    effect="light"
                    placement="right-start"
                >
                    <span class="tag-option first">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16"><g fill="#999999" fill-rule="evenodd"><path d="M1.711 15.919a1.707 1.707 0 0 1-.529-3.332l.32-.107l-.096-.321c-.281-.949-.081-1.882.534-2.494l.63-.627l.912.906l-.425.422c-.714.711-.655 1.583.159 2.396q.653.646 1.31.648c.389 0 .743-.165 1.086-.504l3.889-3.872l.914.909l-4.098 4.076c-.422.42-.989.642-1.645.642q-.443 0-.894-.138l-.324-.099l-.11.319q-.136.396-.408.669a1.72 1.72 0 0 1-1.225.507m10.836-9.892l.195-.195c.24-.237.429-.66.481-1.078c.071-.562-.099-1.078-.479-1.457c-.333-.334-.777-.51-1.279-.51s-1.043.189-1.315.463L6.485 6.895l-.93-.925l4.076-4.055c.428-.424 1.004-.648 1.665-.648q.454 0 .915.142l.328.101l.107-.323q.133-.4.412-.678a1.73 1.73 0 0 1 2.438-.008a1.71 1.71 0 0 1-.008 2.426a1.7 1.7 0 0 1-.674.407l-.324.108l.102.327c.315.991.125 1.956-.502 2.582l-.609.605z"/><path d="M1.93 6.23c-.607-.605-.815-1.521-.554-2.452l.087-.313l-.308-.108A1.696 1.696 0 0 1 .529.537A1.727 1.727 0 0 1 2.967.529q.261.26.393.626l.111.31l.316-.091q.426-.125.85-.126c.655 0 1.227.224 1.652.646l.689.688l-.903.9l-.381-.381c-.161-.159-.6-.53-1.222-.53c-.467 0-.911.208-1.322.618c-.605.602-.652 1.169-.584 1.538c.08.431.334.758.533.956l3.803 3.783l-.86.854zm12.318 9.683c-.459 0-.889-.178-1.213-.498a1.7 1.7 0 0 1-.414-.698l-.102-.325l-.328.094a3 3 0 0 1-.801.113c-.66 0-1.266-.241-1.705-.678l-.58-.579l.857-.852l.216.216c.249.247.76.412 1.269.412c.494 0 .928-.158 1.217-.447c.305-.303.473-.765.473-1.302c0-.509-.152-.988-.389-1.221l-3.667-3.65l.901-.897l4.035 4.013c.617.615.816 1.56.53 2.523l-.097.33l.33.103a1.68 1.68 0 0 1 1.203 1.617c0 .461-.184.894-.511 1.221a1.73 1.73 0 0 1-1.224.505"/></g></svg>
                    </span> 
                </el-tooltip>
                <el-tooltip
                    class="tag-tooltip"
                    content="删除此笔记"
                    effect="light"
                    placement="right-start"
                >
                    <span class="tag-option second">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="#999999" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5v14m-6-8h6m-6 4h6m4.506-1.494L15.012 12m0 0l1.506-1.506M15.012 12l1.506 1.506M15.012 12l-1.506-1.506M20 19H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1"/></svg>
                    </span>
                </el-tooltip>
                <el-tooltip
                    class="tag-tooltip"
                    content="标为重要"
                    effect="light"
                    placement="right-start"
                >
                    <span class="tag-option third">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="#999999" stroke-dasharray="36" stroke-dashoffset="36" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l-2.35 5.76l-6.21 0.46l4.76 4.02l-1.49 6.04l5.29 -3.28M12 3l2.35 5.76l6.21 0.46l-4.76 4.02l1.49 6.04l-5.29 -3.28"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.5s" values="36;0"/></path></svg>
                    </span>
                </el-tooltip>
            </div>
        </div>
        <div class="tag-footer">
            <span class="tag-time">{{ bookMark.createTime }}</span>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { BookMark } from '@/store/bookMark';
export default defineComponent({
  name: 'BookMarkTag',
  props: {
    isFirst: {
        type: Boolean,
        default: false
    },
    isLast: {
        type: Boolean,
        default: false
    },
    bookMark: {
        type: Object as () => BookMark,
        required: true
    }
  },
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
    handleOptions(event: MouseEvent) {
        // 只处理点击的元素的子元素
        const target = event.currentTarget as HTMLElement
        const children = target.children
        Array.from(children).forEach((child) => {
            if (child.classList.contains('tag-options')) {
                const options = child.children
                if (options.length !== 0 && options[0].classList.contains('show')) {
                    document.querySelectorAll('.tag-option').forEach((option) => {
                        option.classList.remove('show')
                    })
                }else {
                    document.querySelectorAll('.tag-option').forEach((option) => {
                        option.classList.remove('show')
                    })
                    Array.from(options).forEach((option) => {
                        if (option.classList.contains('show')){
                            option.classList.remove('show')
                        }else {
                            option.classList.add('show')
                        }
                    })
                }
                return
            }
        })
        
    }
  },
  mounted() {
    // 添加过渡动画
    this.$el.classList.add('tag-fade-in')
    // 定时删除过渡动画
    setTimeout(() => {
        this.$el.classList.remove('tag-fade-in')
    }, 500)
  }
})
</script>
<style lang="scss" scoped>
.tag {
    &-item {
        position: relative;
        width: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    &-tail-left {
        position: absolute;
        width: 50%;
        top: 8px;
        left: 0;
        border-top: 2px dashed #ccc;
    }
    &-tail-right {
        position: absolute;
        width: 50%;
        top: 8px;
        left: 50%;
        border-top: 2px dashed #ccc;
    }
    &-node {
        width: 16px;
        height: 16px;
        background-color: var(--t-color-light-grey);
        border-radius: 50%;
        border-color: var(--t-color-light-grey);
        z-index: 1;
    }
    &-link {
        width: 3px;
        height: 20px;
        background-color: var(--t-color-light-grey);
    }
    &-body {
        position: relative;
        width: 100px;
        height: 400px;
        display: inline-flex;
        justify-content: center;
        font-size: 18px;
        padding: 10px 0;
        border: var(--t-border-medium-grey);
        border-radius: 10px;
        backdrop-filter: blur(2px);
        cursor: var(--t-mouse-cursor-link), default;

        .tag-content {
            writing-mode: vertical-lr;
            width: 3.6em;
            line-height: 1.2em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            user-select: none;
        }

        .tag-comment {
            writing-mode: vertical-lr;
            opacity: 0;
            position: absolute;
            top: 10px;
            max-width: 150px;
            height: 90%;
            line-height: 1.1em;
            min-width: 3.3em;
            border-radius: 6px;
            padding: 0.5em 0;
            transition: all .3s ease-in-out;
            box-shadow: #b3b3b3 0px 0px 5px 3px;
            text-align: center;
            align-content: center;
            user-select: none;

            &:hover{
                opacity: 1;
                background-color: #000;
            }

            &.primary {
                color: #fff;
            }

            &.info {
                color: var(--t-color-dark-grey);
            }
        }

        .tag-options {
            position: absolute;
            display: inline-flex;
            flex-direction: column;
            left: 112px;
            top: 50px;
            pointer-events: none;

            .tag-option {
                display: inline-flex;
                position: relative;
                width: 36px;
                height: 36px;
                align-items: center;
                justify-content: center;;
                border-radius: 50%;
                background: #ececec;
                transition: all .3s ease-in-out;
                opacity: 0;

                &:hover {
                    background: var(--t-color-light-yellow);

                    &::before {
                        border-color: var(--t-color-light-yellow);
                    }
                }

                &::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 42px; 
                    height: 42px; 
                    border-radius: 50%; 
                    border: 3px solid #ececec;
                    background: transparent;
                    transform: translate(-50%, -50%); 
                }

                &.first {
                    top: 10px;

                    &.show {
                        opacity: 1;
                        pointer-events: all;
                    }

                    &:hover {
                        svg g{
                            fill: #fff;
                        }
                    }
                }
                &.second {
                    top: 120px;
                    scale: 0.8;

                    &.show {
                        opacity: 1;
                        top: 30px;
                        scale: 1;
                        pointer-events: all;
                    }

                    &:hover {
                        svg path {
                            stroke: #fff;
                        }
                    }
                }
                &.third {
                    top: 230px;
                    scale: 0.6;

                    &.show {
                        opacity: 1;
                        top: 50px;
                        scale: 1;
                        pointer-events: all;
                    }

                    &:hover {
                        svg path {
                            stroke: #fff;
                        }
                    }
                }
            }
        }
    }

    &-footer {
        margin-top: 0.5em;

        .tag-time {
            font-size: 14px;
            color: #909399;
            line-height: 1em;
        }
    }
}
// 组件进场动画
.tag-fade-in {
    animation: tagFadeIn 0.5s;
}
@keyframes tagFadeIn {
    0% {
        opacity: 0;
        scale: 0.85;
    }
    100% {
        opacity: 1;
        scale: 1;
    }
}
</style>
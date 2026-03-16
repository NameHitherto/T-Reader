<template>
    <el-dialog
        align-center
        destroy-on-close
        title="笔记"
        class="bookmark-dialog-wrapper"
        width="400px"
        :append-to-body="true"
        :show-close="false"
        :close-on-press-escape="false"
        :modal="false"
        @open="onOpen"
        @close="onClose"
    >
        <el-button 
            class="bookmark-delete"
            type="danger"
            circle
            @click="deleteBookMark"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <path fill="#fff" fill-rule="evenodd" d="M5.442 3.5H12.5A1.5 1.5 0 0 1 14 5v6a1.5 1.5 0 0 1-1.5 1.5H5.442a1.5 1.5 0 0 1-1.171-.563L1.796 8.844a1.35 1.35 0 0 1 0-1.688l2.475-3.093A1.5 1.5 0 0 1 5.44 3.5m-2.343-.374A3 3 0 0 1 5.442 2H12.5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5.442a3 3 0 0 1-2.343-1.126L.625 9.781a2.85 2.85 0 0 1 0-3.562zM7.28 5.47a.75.75 0 0 0-1.06 1.06L7.69 8L6.22 9.47a.75.75 0 1 0 1.06 1.06l1.47-1.47l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.81 8l1.47-1.47a.75.75 0 0 0-1.06-1.06L8.75 6.94z"/>
            </svg>
        </el-button>
        <div class="comment-edition">
            <el-input
                v-model="comments"
                maxlength="100"
                :autosize="{minRows: 2, maxRows: 6}"
                resize="none"
                type="textarea"
                placeholder="在此编辑个人感想"
                show-word-limit
                @change="bookMarkJSON.comments = comments"
            />
        </div>
        <div class="color-picker">
            <template v-for="color in colorChoices">
                <span 
                    class="color-choice" 
                    :style="{backgroundColor: color, borderColor: color === bookMarkJSON.color ? 'rgb(0 0 0 / 70%)' : '#fff'}" 
                    @click="updateColor(color)"
                />
            </template>
        </div>
        <div class="option-box">
            <span class="text-border" @click="updateHasBorder">
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="32px" 
                    height="32px" 
                    viewBox="0 0 24 24"
                >
                    <path :fill="bookMarkJSON.hasBorder ? '#0284c7' : '#999999'" d="M3 16c0 2.8 2.2 5 5 5h2v-2H8c-1.7 0-3-1.3-3-3v-2H3zm18-8c0-2.8-2.2-5-5-5h-2v2h2c1.7 0 3 1.3 3 3v2h2zm-5 13c2.8 0 5-2.2 5-5v-2h-2v2c0 1.7-1.3 3-3 3h-2v2zM8 3C5.2 3 3 5.2 3 8v2h2V8c0-1.7 1.3-3 3-3h2V3z"/>
                </svg>
            </span>
        </div>
    </el-dialog>
</template>
<script lang="ts">
import { ref, defineComponent } from 'vue';
export default defineComponent({
    name: 'BookMarkDialog',
    props: {
        bookMarkList: {
            type: String
        }
    },
    data() {
        return {
            comments: ref(''),
            bookMarkJSON: ref<any>({}),
            colorChoices: [
                '#00c4b6', // Cyan
                '#f44336', // Red
                '#e91e63', // Pink
                '#9c27b0', // Purple
                '#3f51b5', // Indigo
                '#2196f3', // Blue
                '#4caf50', // Green
                '#ffeb3b', // Yellow
                '#6b7280', // Gray
            ]
        };
    },
    methods: {
        async onOpen() {
            // 将string转为json
            if (this.bookMarkList) {
                this.bookMarkJSON = JSON.parse(this.bookMarkList)
                this.comments = this.bookMarkJSON.comments
            }else {
                console.log('打开了一个空的笔记')
            }
        },
        async onClose() {
            this.$emit('update:bookMarkList', JSON.stringify(this.bookMarkJSON))
        },
        async deleteBookMark() {
            this.$emit('delete', this.bookMarkJSON.id)
        },
        async updateColor(color: string) {
            this.bookMarkJSON.color = color
            this.$emit('update:bookMarkList', JSON.stringify(this.bookMarkJSON))
        },
        async updateHasBorder() {
            this.bookMarkJSON.hasBorder = !this.bookMarkJSON.hasBorder
            this.$emit('update:bookMarkList', JSON.stringify(this.bookMarkJSON))
        }
    },
})
</script>
<style lang="scss" scoped>
.bookmark-delete {
    position: absolute;
    top: 10px;
    right: 10px;
}
.color-picker {
    display: inline-flex;
    margin-top: 10px;
    gap: 8px;

    .color-choice{
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border-width: 2px;
        border-style: solid;
        cursor: var(--t-mouse-cursor-link), pointer;
    }
}
.option-box {
    display: flex;

    .text-border {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: var(--t-mouse-cursor-link), pointer;
    }
}
</style>
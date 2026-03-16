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
            bookMarkJSON: ref<any>({})
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
</style>
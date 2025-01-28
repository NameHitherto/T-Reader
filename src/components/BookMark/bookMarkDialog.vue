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
        }
    },
})
</script>
<style lang="scss" scoped>
/* Your styles here */
</style>
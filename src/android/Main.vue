<template>
    <div>
        <header class="header">
            <span style="font-size: large; font-weight: 600;">全部书籍</span>
            <button class="button" @click="addBook">
                <div class="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                        <path
                            d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z" />
                    </svg>
                </div>
            </button>
            <button class="button" @click="syncFiles">
                <div class="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"><path d="M42 8V24"/><path d="M6 24L6 40"/><path d="M42 24C42 14.0589 33.9411 6 24 6C18.9145 6 14.3216 8.10896 11.0481 11.5M6 24C6 33.9411 14.0589 42 24 42C28.8556 42 33.2622 40.0774 36.5 36.9519"/></g></svg>
                </div>
            </button>
        </header>
        <div class="book-list">
            <div class="book-item" v-for="book in books" :key="book.id" @click="openBook(book.id)">
                <img :src="book.cover" alt="封面" class="book-cover" />
                <span class="book-title">{{ book.title }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { readFile, writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import ePub from 'epubjs';
import {documentDir, join} from '@tauri-apps/api/path';
import router from '../router/android';

interface Book {
    id: number;
    cover: string;
    title: string;
    path: string;
}

export default {
    name: 'MainPage',
    setup() {
        const books = ref < Book[] > ([]);
        const DOCUMENT = async (): Promise<string> => {
            return (await join(await documentDir(), 'T-Reader')).toString();
        }

        const loadBooks = async () => {
            try {
                books.value = [];
                const loadedBooks: Book[] = await invoke('load_books', {directory: await DOCUMENT()});
                for (const book of loadedBooks) {
                    try {
                        const solidBook = await readFile(`T-Reader/${book.id}.epub`, { baseDir: BaseDirectory.Document });
                        const arrayBuffer = solidBook.buffer;
                        const epub = ePub(arrayBuffer);
                        const cover = await epub.coverUrl();
                        book.cover = cover ?? 'unknown';
                        books.value.push(book);
                    } catch (error) {
                        console.error('Error loading cover for book:', book.title, error);
                    }
                }
            } catch (error) {
                console.error('Error loading books:', error);
            }
        };

        const syncFiles = async () =>{
            try{
                await invoke('webdav_sync_files', {directory: await DOCUMENT()});
                console.log('文件同步成功');
                await loadBooks();
            }catch(error){
                console.error('文件同步失败:', error);
            }
        }

        const addBook = async () => {
            const selectedFilePath = await open({
                multiple: false,
                directory: false,
                filters: [
                    {
                        name: 'ePub files',
                        extensions: ['epub']
                    }
                ]
            });

            if (Array.isArray(selectedFilePath) || selectedFilePath === null) {
                return;
            }

            if (books.value.find(book => book.path === selectedFilePath)) {
                console.log("该文件已经添加过了");
                return;
            }

            const u8File: Uint8Array = await invoke('read_file_by_path', { filepath: selectedFilePath });
            const bufferFile = new Uint8Array(u8File).buffer;
            const file = new Blob([bufferFile], { type: 'application/epub+zip' });

            const newBookId = Date.now();
            const newBookPath = `T-Reader/${newBookId}.epub`;
            const contents = new Uint8Array(bufferFile);

            await writeFile(newBookPath, contents, { baseDir: BaseDirectory.Document });

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const book = ePub(e.target?.result as ArrayBuffer);
                    const metadata = await book.loaded.metadata;
                    const cover = await book.coverUrl();

                    const newBook: Book = {
                        id: newBookId,
                        cover: cover ?? 'unknown',
                        title: metadata.title,
                        path: selectedFilePath,
                    };

                    await invoke('save_file', {
                        filename: `${newBook.id}.json`,
                        contents: JSON.stringify(newBook),
                        directory: BaseDirectory.Document
                    });

                    books.value.push(newBook);
                } catch (error) {
                    console.error('Error reading or saving the file:', error);
                }
            };
            reader.readAsArrayBuffer(file);
        };

        const openBook = (id: number) => {
            console.log('Opening book:', id);
            // 在安卓端打开书籍的逻辑
            router.push({name: 'AndroidReader', params: {bookId: id}});
        };

        onMounted(() => {
            loadBooks();
        });

        return {
            books,
            addBook,
            openBook,
            syncFiles
        };
    }
};
</script>

<style scoped>
.header {
    display: flex;
    align-items: center;
    margin: 10px 0 10px 10px;
    gap: 10px;
}

.book-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.book-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100px;
    margin: 10px;
}

.book-cover {
    width: 100px;
    height: 150px;
    object-fit: cover;
}

.book-title {
    margin-top: 5px;
    text-align: center;
    font-size: 14px;
}
</style>
<template>
  <div id="app">
    <div class="sidebar">
      <div class="logo">
        <font-awesome-icon icon="fa-solid fa-book-open" style="height: 1.5em" />
        <span style="text-align: center">T-Reader</span>
      </div>
      <nav>
        <ul class="menu">
          <li>
            <font-awesome-icon icon="fa-solid fa-book" />
            <router-link to="/">全部图书</router-link>
          </li>
          <li>
            <font-awesome-icon icon="fa-solid fa-book-bookmark" />
            <router-link to="/bookmark">笔记</router-link>
          </li>
        </ul>
      </nav>
    </div>
    <router-view></router-view>
  </div>
</template>

<style scoped>
#app {
  display: flex;
  height: 100vh;
  overflow: hidden; /* 隐藏全局滚动条 */

  .sidebar {
    flex: 0 0 160px;
    user-select: none;
    width: 200px;
    background-color: #f4f4f4;
    padding: 20px;
    overflow: hidden;

    .logo {
      display: flex;
      flex-direction: column;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
    }

    .menu {
      display: flex;
      flex-direction: column;
      list-style: none;
      padding: 0;

      li {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 18px;
        align-items: center;

        a {
          text-decoration: none;
          color: inherit;
          flex: 1;
        }
      }
    }
  }
}
</style>

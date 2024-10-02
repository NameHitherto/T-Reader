<template>
    <div class="sidebar">
      <div class="logo">T-Reader</div>
      <ul class="menu">
        <li>书库</li>
        <ul>
          <li>全部图书</li>
        </ul>
      </ul>
    </div>
  </template>
  
  <script>
  export default {
    name: 'Sidebar'
  };
  </script>
  
  <style scoped>
  .sidebar {
    width: 200px;
    background-color: #f4f4f4;
    padding: 20px;
    overflow: hidden; /* 隐藏滚动条 */
  }
  
  .logo {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 20px;
  }
  
  .menu {
    list-style: none;
    padding: 0;
  }
  
  .menu > li {
    margin-bottom: 10px;
    font-size: 18px;
  }
  
  .menu ul {
    list-style: none;
    padding-left: 20px;
  }
  
  .menu ul li {
    font-size: 16px;
  }
  </style>
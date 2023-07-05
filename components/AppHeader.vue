<template>
  <div class="app-header">
    <div class="content-container">
      <div class="logo">文章体</div>
      <div class="nav">
        <NuxtLink to="/">首页</NuxtLink>
        <NuxtLink to="/about">关于</NuxtLink>
      </div>
      <div class="search">
        <input type="text" />
      </div>
      <div class="user-op">
        <NuxtLink to="/login">登录</NuxtLink>
        <NuxtLink to="/login">注册</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineOptions({
  name: 'AppHeader',
})
</script>

<style lang="less">
.app-header {
  box-shadow: 0px 1px 5px rgba(0, 0, 0, 0.1);

  .content-container {
    display: flex;
    height: 50px;
    line-height: 50px;
  }

  a {
    text-decoration: none;
    color: #333;
  }

  .logo {
    font-size: 20px;
    font-weight: bold;
    margin-right: 20px;
  }

  .nav {
    flex: 1;
    display: flex;

    a {
      padding: 0 10px;
      &:hover {
        background: #f1f1f1;
      }
    }
  }

  .user-op {
    // align-items: flex-end;
    a {
      padding: 0 10px;
    }
  }
}
</style>

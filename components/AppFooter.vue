<template>
  <div class="app-footer">
    <div class="content-container">
      <div class="brand">文章体</div>
      <div class="icp">湘ICP备2021013149号</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineOptions({
  name: 'AppFooter',
})
</script>

<style lang="less">
.app-footer {
  box-shadow: 0px -1px 5px rgba(0, 0, 0, 0.1);
  .content-container {
    padding: 20px 0;
  }
  .brand {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 5px;
  }
}
</style>

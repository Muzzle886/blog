<template>
  <div class="index">indexPage</div>
</template>

<script lang="ts" setup>
defineOptions({
  name: 'index',
})
useHead({
  title: '文章体',
  meta: [
    {
      name: 'description',
      content:
        '文章体是一个为程序员打造的分享平台，你可以在法律允许范围内畅所欲言，我们的宗旨是：分享一切！',
    },
  ],
})
</script>

<style lang="less">
.index {
}
</style>

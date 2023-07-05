<template>
  <div class="about-page">about</div>
</template>

<script lang="ts" setup>
defineOptions({
  name: 'AboutPage',
})
useHead({
  title: '关于我们',
  meta: [{ name: 'description', content: '关于我们' }],
})
onMounted(() => {
  fetch('https://www.muzzle.top/article/getArticle', {
    method: 'POST',
  })
})
</script>

<style lang="less">
.about-page {
}
</style>

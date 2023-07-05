<template>
  <div class="default-layout">
    <AppHeader />
    <slot />
    <AppFooter />
  </div>
</template>

<script lang="ts" setup>
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'

defineOptions({
  name: 'default',
})
</script>

<style lang="less">
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
}
#__nuxt {
  height: 100%;
}
.default-layout {
  width: 100%;
  height: 100%;

  .content-container {
    width: 1200px;
    margin: auto;
  }
}
</style>

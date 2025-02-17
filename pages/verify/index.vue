<template>
  <view></view>
</template>

<script>
export default {
  onLoad() {
    // 直接读取并返回文件内容
    const fileContent = 'I1dKULIeyWTC7qE1'  // 这里填写实际的文件内容
    
    // 设置响应头
    // #ifdef H5
    document.title = 'MP_verify_I1dKULIeyWTC7qE1.txt'
    const pre = document.createElement('pre')
    pre.textContent = fileContent
    document.body.innerHTML = ''
    document.body.appendChild(pre)
    // #endif
  }
}
</script>

<style>
</style> 
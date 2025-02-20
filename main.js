// #ifndef VUE3
import Vue from 'vue'
import App from './App'

Vue.config.productionTip = false

// 添加请求延迟预警系统
const REQUEST_TIMEOUT_THRESHOLD = 2000; // 2秒阈值

// 重写uni.request方法
const originalRequest = uni.request;
uni.request = (options = {}) => {
  const startTime = Date.now();
  
  // 保存原始的success回调
  const originalSuccess = options.success;
  const originalComplete = options.complete;
  
  options.success = (res) => {
    const duration = Date.now() - startTime;
    if (duration > REQUEST_TIMEOUT_THRESHOLD) {
      console.log("接口慢")
      uni.showToast({
        title: `接口响应较慢 (${(duration/1000).toFixed(1)}秒)\n${options.url}`,
        icon: 'none',
        duration: 3000
      });
    }
    // 调用原始的success回调
    originalSuccess && originalSuccess(res);
  };
  
  options.complete = (res) => {
    // 调用原始的complete回调
    originalComplete && originalComplete(res);
  };
  
  return originalRequest.call(uni, options);
};

App.mpType = 'app'

const app = new Vue({
    ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import App from './App.vue'
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
// #endif
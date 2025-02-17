/**
 * 文件下载工具函数
 * @param {String} url 文件URL
 * @param {String} filename 文件名称（可选）
 */

// 文件路径配置
export const FILE_PATHS = {
  MP_VERIFY: '/static/verify/MP_verify_I1dKULIeyWTC7qE1.txt'  // 使用static目录
}

export const downloadFile = (url, filename) => {
  // 处理相对路径
  const baseUrl = process.env.VUE_APP_BASE_URL || window.location.origin
  const fullUrl = url.startsWith('http') ? url : baseUrl + url

  // #ifdef H5
  fetch(fullUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.text()  // 对于txt文件，使用text()更合适
    })
    .then(text => {
      const blob = new Blob([text], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'download'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    })
    .catch(error => {
      console.error('Download failed:', error)
      uni.showToast({
        title: '下载失败',
        icon: 'none'
      })
    })
  // #endif
  
  // #ifdef APP-PLUS
  uni.downloadFile({
    url: fullUrl,
    success: (res) => {
      if (res.statusCode === 200) {
        uni.saveFile({
          tempFilePath: res.tempFilePath,
          success: function (res) {
            uni.showToast({
              title: '文件已保存: ' + res.savedFilePath,
              icon: 'success'
            })
          },
          fail: function() {
            uni.showToast({
              title: '保存失败',
              icon: 'none'
            })
          }
        })
      }
    },
    fail: () => {
      uni.showToast({
        title: '下载失败',
        icon: 'none'
      })
    }
  })
  // #endif
  
  // #ifdef MP-WEIXIN
  uni.downloadFile({
    url: fullUrl,
    success: function (res) {
      if (res.statusCode === 200) {
        uni.openDocument({
          filePath: res.tempFilePath,
          success: function () {
            console.log('打开文档成功')
          },
          fail: function() {
            uni.showToast({
              title: '打开文件失败',
              icon: 'none'
            })
          }
        })
      }
    },
    fail: function() {
      uni.showToast({
        title: '下载失败',
        icon: 'none'
      })
    }
  })
  // #endif
} 
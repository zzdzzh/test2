export default {
  data() {
    return {
      openid: ''
    }
  },
  methods: {
    getOpenid() {
      // #ifdef H5
      const ua = navigator.userAgent.toLowerCase()
      const isWeixinBrowser = ua.indexOf('micromessenger') !== -1

      if (isWeixinBrowser) {
        // 获取当前页面URL中的code参数
        const code = this.getUrlParam('code')
        if (code) {
          this.getOpenidFromServer(code)
        } else {
          // 如果没有code，重定向到微信授权页面
          const baseUrl = 'http://cs.s7.tunnelfrp.com'  // 替换为实际的域名
          const currentPath = this.getCurrentPath()
          const redirectUri = encodeURIComponent(baseUrl + currentPath)
          const appId = 'wx96b6b0bcc14b76fb'
          const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=STATE#wechat_redirect`
          window.location.href = authUrl
        }
      } else {
        uni.showToast({
          title: '请在微信中打开',
          icon: 'none'
        })
      }
      // #endif
    },

    // 从URL中获取参数
    getUrlParam(name) {
      const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)")
      const r = window.location.search.substr(1).match(reg)
      if (r != null) return decodeURIComponent(r[2])
      return null
    },

    // 统一的获取openid的服务端请求
    getOpenidFromServer(code) {
      uni.request({
        url: '/dev-api/device/wx/token/openid',
        method: 'GET',
        data: {
          code: code
        },
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + uni.getStorageSync('token')
        },
        success: (response) => {
          if (response.data.code === 200) {
            this.openid = response.data.data
            uni.setStorageSync('openid', response.data.data)
            console.log('获取openid成功：', this.openid)
            this.onOpenidSuccess && this.onOpenidSuccess()
          } else {
            console.error('获取openid失败：', response.data)
            uni.showToast({
              title: response.data.msg || '获取用户信息失败',
              icon: 'none'
            })
          }
        },
        fail: (err) => {
          console.error('请求失败：', err)
          uni.showToast({
            title: '网络请求失败',
            icon: 'none'
          })
        }
      })
    },

    // 获取当前页面路径
    getCurrentPath() {
      return this.$mp?.page?.route ? '/' + this.$mp.page.route : ''
    }
  }
} 
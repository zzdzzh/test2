<template>

    <view class="chat-container">

      <!-- 聊天记录区域 -->

      <scroll-view class="chat-list" scroll-y="true" :scroll-top="scrollTop">

        <view class="chat-item" v-for="(item, index) in chatList" :key="index" :class="item.type">

          <view class="avatar">

            <image :src="item.type === 'user' ? userAvatar : serviceAvatar"></image>

          </view>

          <view class="message">

            <text>{{ item.content }}</text>

          </view>

          <view class="time">{{ item.time }}</view>

        </view>

      </scroll-view>

  

      <!-- 输入区域 -->

      <view class="input-area">

        <textarea v-model="inputMessage" 

                  class="input-box" 

                  placeholder="请输入您的问题"

                  :adjust-position="false"

                  :cursor-spacing="20"

                  @confirm="sendMessage"

                  @keydown.enter.prevent="handleEnterPress" />

        <button class="send-btn" @tap="sendMessage">发送</button>

      </view>

    </view>

  </template>

  

  <script>

  export default {

    data() {

      return {

        chatList: [],

        inputMessage: '',

        scrollTop: 0,

        userAvatar: '/static/images/user-avatar.png',

        serviceAvatar: '/static/images/service-avatar.png',

        formData: {

          type: '', // 意图类型：产品咨询、投诉、服务请求

          name: '', // 联系人姓名

          phone: '', // 联系电话

          details: '', // 具体事由

        },

        isFormComplete: false,

        isConfirmed: false,

        apiConfig: {

          url: '/dev-api/device/knowledge/analyze', // Updated to use the new knowledge endpoint

          headers: {

            'Content-Type': 'application/json'

          },

          timeout: 30000, // 设置30秒超时

          maxRetries: 2 // 最大重试次数

        },

        systemPrompt: `你是一个智能客服助手，负责分析用户的咨询内容并提取关键信息。

请分析用户的输入，判断以下信息：

1. 用户意图类型（必须是以下之一）：产品咨询、投诉、服务请求

2. 联系人姓名

3. 联系电话（手机号码格式）

4. 具体事由



请以JSON格式返回，格式如下：

{

  "type": "意图类型",

  "name": "联系人姓名",

  "phone": "联系电话",

  "details": "具体事由",

  "isComplete": true/false,  

  "isConfirmed": false,     

  "reply": "需要回复给用户的话"

}



如果信息不完整，请设置isComplete为false，在reply中礼貌地询问缺失的信息。

如果信息完整但用户未确认，请设置isComplete为true，isConfirmed为false，在reply中总结信息并询问是否正确。

如果用户确认信息正确，请设置isConfirmed为true。`,

        chatHistoryKey: 'recent_chat_history' // 用于存储聊天记录的key

      }

    },

    onLoad() {

      this.loginWithoutCode();
      // 登录成功后再恢复聊天记录
      setTimeout(() => {
        this.restoreRecentChats();
      }, 1000);
    },

    onUnload() {

      // 退出前保存聊天记录
      if (this.chatList.length > 0) {
        this.saveRecentChats();
      }
    },

    methods: {

      initChat() {

        this.chatList.push({

          type: 'service',

          content: '您好！我是客服助手，请问有什么可以帮您？',

          time: this.formatTime(new Date())

        })

      },

      handleEnterPress(e) {

        // 如果是单独的回车键（非shift+enter）

        if (!e.shiftKey) {

          e.preventDefault() // 阻止默认换行

          this.sendMessage()

        }

      },

      formatTime(date) {

        const hours = date.getHours().toString().padStart(2, '0')

        const minutes = date.getMinutes().toString().padStart(2, '0')

        return `${hours}:${minutes}`

      },

      async processResponse(responseText) {
        try {
          if (!responseText) {
            return '抱歉，服务器返回为空';
          }

          // 尝试直接解析JSON
          try {
            const responseData = JSON.parse(responseText);
            // 更新表单数据
            if (responseData.type) this.formData.type = responseData.type;
            if (responseData.name) this.formData.name = responseData.name;
            if (responseData.phone) this.formData.phone = responseData.phone;
            if (responseData.details) this.formData.details = responseData.details;
            
            // 更新表单状态
            this.isFormComplete = responseData.isComplete;
            this.isConfirmed = responseData.isConfirmed;
            
            // 如果已确认，提交表单
            if (this.isConfirmed) {
              this.submitForm();
            }
            
            // 返回回复消息
            return responseData.reply || '抱歉，我没有理解您的意思。';
          } catch (e) {
            // 如果直接解析失败，尝试清理markdown格式
            let cleanJson = responseText.replace(/```json\n|\n```/g, '').trim();
            // 替换cleanJson中的"json"
            cleanJson = cleanJson.replace("json", "");

            console.log('清理后的JSON:--', cleanJson);
            const responseData = JSON.parse(cleanJson);
            
            // 更新表单数据
            if (responseData.type) this.formData.type = responseData.type;
            if (responseData.name) this.formData.name = responseData.name;
            if (responseData.phone) this.formData.phone = responseData.phone;
            if (responseData.details) this.formData.details = responseData.details;
            
            // 更新表单状态
            this.isFormComplete = responseData.isComplete;
            this.isConfirmed = responseData.isConfirmed;
            
            // 如果已确认，提交表单
            if (this.isConfirmed) {
              this.submitForm();
            }
            
            // 返回回复消息
            return responseData.reply || '抱歉，我没有理解您的意思。';
          }
        } catch (error) {
          console.error('处理响应失败:', error);
          return responseText || '抱歉，处理响应时出错'; // 如果解析失败，返回原始文本或错误信息
        }
      },

      async callLLMApi(message, chatHistory) {
        let retryCount = 0;

        //return("test,mock");
        while (retryCount <= this.apiConfig.maxRetries) {
          try {
            const token = uni.getStorageSync('token');
            if (!token) {
              throw new Error('未登录，请先登录');
            }

            // 构建对话内容字符串
            let contentString = this.systemPrompt + '\n\n对话历史：\n';
            
            // 添加历史对话
            chatHistory.forEach(chat => {
              contentString += `${chat.type === 'user' ? '用户' : '助手'}: ${chat.content}\n`;
            });
            
            // 添加当前消息
            contentString += `用户: ${message}`;

            const [err, res] = await uni.request({
              url: this.apiConfig.url,
              method: 'POST',
              header: {
                ...this.apiConfig.headers,
                'Authorization': 'Bearer ' + token
              },
              data: {
                content: contentString
              },
              timeout: this.apiConfig.timeout // 设置请求超时时间
            });

            if (err) {
              if (err.errMsg && err.errMsg.includes('timeout')) {
                if (retryCount < this.apiConfig.maxRetries) {
                  console.log(`请求超时，第 ${retryCount + 1} 次重试...`);
                  retryCount++;
                  continue; // 继续下一次重试
                }
              }
              throw new Error(err.errMsg || '请求失败');
            }

            if (res.statusCode === 200 && res.data.code === 200) {
              return this.processResponse(res.data.msg);
            } else {
              throw new Error(res.data.msg || '请求失败');
            }
          } catch (error) {
            if (retryCount < this.apiConfig.maxRetries) {
              console.log(`请求失败，第 ${retryCount + 1} 次重试...`);
              retryCount++;
              // 添加重试延迟，避免立即重试
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount)));
              continue;
            }
            this.saveRecentChats();
            console.error('API调用失败:', error);
            throw error;
          }
        }
      },

      async sendMessage() {
        if (!this.inputMessage.trim()) return;
        
        const userMessage = this.inputMessage.trim();
        this.inputMessage = '';

        // 添加用户消息到聊天列表
        this.chatList.push({
          type: 'user',
          content: userMessage,
          time: this.formatTime(new Date())
        });

        try {
          // 显示加载状态
          uni.showLoading({
            title: '正在处理'
          });

          // 调用API获取响应，传入当前聊天历史
          const response = await this.callLLMApi(userMessage, this.chatList);

          // 添加系统回复到聊天列表
          this.chatList.push({
            type: 'service',
            content: response,
            time: this.formatTime(new Date())
          });

          // 保存最新的对话记录
          this.saveRecentChats();

          // 滚动到底部
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        } catch (error) {
          this.saveRecentChats();
          uni.showToast({
            title: '发送失败',
            icon: 'error'
          });
          console.error('发送消息失败：', error);
        } finally {
          uni.hideLoading();
        }
      },

      scrollToBottom() {

        setTimeout(() => {

          const query = uni.createSelectorQuery().in(this)

          query.select('.chat-list').boundingClientRect(data => {

            this.scrollTop = data.height

          }).exec()

        }, 100)

      },

      checkFormComplete() {
        return this.formData.type && 
               this.formData.name && 
               this.formData.phone && 
               this.formData.details;
      },

      async submitForm() {
        try {
          // 检查表单是否完整
          if (!this.checkFormComplete()) {
            uni.showToast({
              title: '表单信息不完整',
              icon: 'error'
            });
            return;
          }

          uni.showLoading({
            title: '提交中...'
          });

          // 构造请求数据
          const requestData = {
            name: this.formData.name,
            phone: this.formData.phone,
            content: this.formData.details,
            consultType: parseInt(this.formData.type),
            status: 0,  // 初始状态：待处理
            openid: uni.getStorageSync('openid')
          };

          // 调用后端API
          uni.request({
            url: '/dev-api/device/customer/service/ticket',
            method: 'POST',
            data: requestData,
            header: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + uni.getStorageSync('token')
            },
            success: (response) => {
              uni.hideLoading();
              if (response.data.code === 200) {
                uni.showToast({
                  title: '提交成功',
                  icon: 'success'
                });
                // 重置表单
                this.formData = {
                  type: '',
                  name: '',
                  phone: '',
                  details: ''
                };
                this.isFormComplete = false;
                this.isConfirmed = false;
              } else {
                uni.showToast({
                  title: response.data.msg || '提交失败',
                  icon: 'error'
                });
              }
            },
            fail: (error) => {
              this.saveRecentChats(); // 发生异常时保存对话
              uni.hideLoading();
              uni.showToast({
                title: '网络错误，请稍后重试',
                icon: 'error'
              });
              console.error('提交失败：', error);
            }
          });
        } catch (error) {
          this.saveRecentChats(); // 发生异常时保存对话
          uni.hideLoading();
          uni.showToast({
            title: '网络错误，请稍后重试',
            icon: 'error'
          });
          console.error('提交失败：', error);
        }
      },

      // 保存最近5轮对话记录
      saveRecentChats() {
        try {
          // 确保所有消息都有正确的类型和时间
          const chatsToSave = this.chatList.slice(-10).map(chat => ({
            type: chat.type || 'user',
            content: chat.content,
            time: chat.time || this.formatTime(new Date())
          }));
          
          uni.setStorageSync(this.chatHistoryKey, JSON.stringify(chatsToSave));
          console.log('成功保存对话记录，共', chatsToSave.length, '条消息');
        } catch (error) {
          console.error('保存对话记录失败：', error);
        }
      },

      // 恢复最近的对话记录
      async restoreRecentChats() {
        try {
          const savedChats = uni.getStorageSync(this.chatHistoryKey);
          if (savedChats) {
            const chats = JSON.parse(savedChats);
            if (Array.isArray(chats) && chats.length > 0) {
              // 确保消息有正确的格式
              for (const chat of chats) {
                if (chat.type && chat.content) {
                  this.chatList.push({
                    type: chat.type,
                    content: chat.content,
                    time: chat.time || this.formatTime(new Date())
                  });
                }
              }
              
              console.log('成功恢复对话记录，共', chats.length, '条消息');
              
              // 恢复后滚动到底部
              this.$nextTick(() => {
                this.scrollToBottom();
              });
            }
          }
        } catch (error) {
          console.error('恢复对话记录失败：', error);
        }
      },

      autoLogin() {
        console.log('开始执行自动登录')
        
        // 构造登录请求数据
        const loginData = {
          username: 'admin',
          password: 'admin123'
        }
        
        console.log('准备发送登录请求')
        
        // 发送登录请求
        uni.request({
          url: '/dev-api/auth/login',
          method: 'POST',
          data: loginData,
          header: {
            'Content-Type': 'application/json'
          },
          success: (response) => {
            console.log('登录响应：', response)
            if (response.data.code === 200) {
              // 存储token
              const token = response.data.data.access_token
              const expiresIn = response.data.data.expires_in
              
              uni.setStorageSync('token', token)
              uni.setStorageSync('tokenExpireTime', Date.now() + expiresIn * 60 * 1000)
              
              console.log('自动登录成功')
            } else {
              console.error('自动登录失败：', response.data.msg)
            }
          },
          fail: (error) => {
            console.error('自动登录请求失败：', error)
          }
        })
      },
      
      loginWithoutCode() {
        console.log('开始执行新登录')
        
        const loginData = {
          phoneNumber: "13805019831",
          password: "zj123456",
          appKey: "org",
          matchKey: "merchant"
        }
        
        uni.request({
          url: 'https://nc.chzncloud.com/prod-api/auth/loginWithoutCode',
          method: 'POST',
          data: loginData,
          header: {
            'Content-Type': 'application/json'
          },
          success: (response) => {
            console.log('登录响应：', response)
            if (response.data.code === 200) {
              // 存储token
              const token = response.data.data.accessToken
              
              // 存储token到cookie
              document.cookie = `nc_token=${token}; path=/`
              
              // 同时也存储到storage以备用
              uni.setStorageSync('nc_token', token)
              uni.setStorageSync('organizationList', response.data.data.organizationList)
              
              console.log('新登录成功')
              
              // 登录成功后选择组织
              this.chooseOrganization()
            } else {
              console.error('新登录失败：', response.data.msg)
            }
          },
          fail: (error) => {
            console.error('新登录请求失败：', error)
          }
        })
      },
      
      chooseOrganization() {
        const organizationData = {
          targetOrganizationUuid: "77f9b4cdcb6b4a2b979d09da504b97a9"
        }
        
        uni.request({
          url: 'https://nc.chzncloud.com/prod-api/auth/chooseOrganization',
          method: 'PUT',
          data: organizationData,
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + uni.getStorageSync('nc_token')
          },
          success: (response) => {
            console.log('选择组织响应：', response)
            if (response.data.code === 200) {
              // 更新token
              const newToken = response.data.data.accessToken
              document.cookie = `nc_token=${newToken}; path=/`
              uni.setStorageSync('nc_token', newToken)
              
              // 存储用户和组织信息
              uni.setStorageSync('userInfo', response.data.data.userInfo)
              uni.setStorageSync('organizationInfo', response.data.data.organizationInfo)
              uni.setStorageSync('organizationMemberInfo', response.data.data.organizationMemberInfo)
              
              console.log('选择组织成功')
            } else {
              console.error('选择组织失败：', response.data.msg)
            }
          },
          fail: (error) => {
            console.error('选择组织请求失败：', error)
          }
        })
      },
    }

  }

  </script>

  

  <style>

  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #f5f5f5;
    position: relative;
    box-sizing: border-box;
    padding-bottom: 80px; /* 对应input-area的高度 */
  }

  .chat-list {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* 增加iOS滚动惯性 */
    height: calc(100vh - 80px); /* 减去输入框的高度 */
    position: relative;
    z-index: 1; /* 确保滚动区域在输入框之下 */
  }

  .chat-item {
    display: flex;
    margin-bottom: 20px;
    align-items: flex-start;
    max-width: 80%;
  }

  .chat-item.user {
    flex-direction: row-reverse;
    margin-left: auto;
  }

  .avatar {
    width: 40px;
    height: 40px;
    margin: 0 10px;
    flex-shrink: 0;
  }

  .avatar image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  .message {
    background: #fff;
    padding: 10px 15px;
    border-radius: 12px;
    position: relative;
    word-break: break-word;
  }

  .chat-item.user .message {
    background: #007AFF;
    color: #fff;
  }

  .time {
    font-size: 12px;
    color: #999;
    margin: 5px 10px;
  }

  .input-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80px;
    padding: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    z-index: 2; /* 确保输入区域在滚动区域之上 */
    box-shadow: 0 -13px 7px rgb(255, 255, 255);
    /* 增加安全区域适配 */
    padding-bottom: calc(8px + constant(safe-area-inset-bottom));
    padding-bottom: calc(1px + env(safe-area-inset-bottom));
  }

  .input-box {
    flex: 1;
    min-height: 35px;
    max-height: 55px;
    padding: 8px;
    margin-right: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    line-height: 30px;
    box-sizing: border-box;
    resize: none;
    position: relative; /* 确保输入框正确定位 */
  }

  .send-btn {
    width: 60px;
    min-width: 56px; /* 确保按钮不会被压缩 */
    height: 45px;
    background: #007AFF;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0; /* 移除内边距 */
    margin: 0; /* 移除外边距 */
  }

  /* 响应式布局适配 */
  @media screen and (max-width: 768px) {
    .chat-container {
      padding-bottom: 60px;
    }
    
    .chat-list {
      height: calc(100vh - 60px);
    }
  }

  @media screen and (max-width: 480px) {
    .chat-container {
      padding-bottom: 55px;
    }
    
    .chat-list {
      height: calc(100vh - 55px);
    }
  }
  </style>
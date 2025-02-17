<template>
  <view class="chat-container">
    <!-- 聊天记录区域 -->
    <scroll-view class="chat-list" scroll-y="true" :scroll-top="scrollTop" @scrolltoupper="loadMore">
      <view class="chat-item" v-for="(item, index) in chatList" :key="index" :class="item.type">
        <view class="avatar">
          <image :src="item.type === 'user' ? userAvatar : botAvatar"></image>
        </view>
        <view class="message">
          <text>{{ item.content }}</text>
        </view>
        <view class="time">{{ item.time }}</view>
      </view>
    </scroll-view>

    <!-- 工单预览区域 -->
    <view class="service-ticket" v-if="showTicket">
      <view class="ticket-header">
        <text class="title">客服工单</text>
        <text class="close" @tap="closeTicket">×</text>
      </view>
      <view class="ticket-content">
        <view class="ticket-item">
          <text class="label">问题类型：</text>
          <text>{{ ticket.type }}</text>
        </view>
        <view class="ticket-item">
          <text class="label">问题描述：</text>
          <text>{{ ticket.description }}</text>
        </view>
        <view class="ticket-item">
          <text class="label">解决方案：</text>
          <text>{{ ticket.solution }}</text>
        </view>
      </view>
      <view class="ticket-actions">
        <button class="confirm-btn" @tap="confirmTicket">确认工单</button>
        <button class="modify-btn" @tap="modifyTicket">修改内容</button>
      </view>
    </view>

    <!-- 输入区域 -->
    <view class="input-area">
      <textarea v-model="inputMessage" 
                class="input-box" 
                placeholder="请输入您的问题"
                :adjust-position="false"
                :cursor-spacing="20"
                confirm-type="send"
                :confirm-hold="true"
                @keydown.enter.prevent="handleEnterPress"
                @confirm="sendMessage" />
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
      botAvatar: '/static/images/bot-avatar.png',
      showTicket: false,
      ticket: {
        type: '',
        description: '',
        solution: ''
      }
    }
  },
  onLoad() {
    // 初始化欢迎消息
    this.chatList.push({
      type: 'bot',
      content: '您好！我是智能客服助手，请问有什么可以帮您？',
      time: this.formatTime(new Date())
    })
  },
  methods: {
    // 处理回车按键
    handleEnterPress(e) {
      // 如果是单独的回车键（非shift+enter）
      if (e.keyCode === 13 && !e.shiftKey) {
        e.preventDefault() // 阻止默认换行
        this.sendMessage()
      }
    },
    
    // 发送消息
    sendMessage() {
      if (!this.inputMessage.trim()) return
      
      // 添加用户消息
      this.chatList.push({
        type: 'user',
        content: this.inputMessage,
        time: this.formatTime(new Date())
      })
      
      // 调用智能客服API处理回复
      this.processAIResponse(this.inputMessage)
      
      this.inputMessage = ''
      this.scrollToBottom()
    },
    
    // 处理AI回复
    async processAIResponse(userMessage) {
      try {
        let currentIntent = '';
        // 如果是第一条消息，先进行意图识别
        if (this.chatList.length === 2) { // 包含欢迎消息和用户第一条消息
          currentIntent = await this.detectIntent(userMessage);
          this.ticket.type = currentIntent;
          this.chatList.push({
            type: 'bot',
            content: `我理解您的问题属于${currentIntent}，我会针对性地为您解答。`,
            time: this.formatTime(new Date())
          });
        } else {
          currentIntent = this.ticket.type; // 使用已存储的意图类型
        }

        // 如果是投诉处理且不是第一条消息，先检查信息完整性
        let promptPrefix = '';
        if (currentIntent === '投诉处理' && this.chatList.length > 2) {
          // 收集用户之前的所有对话
          const userMessages = this.chatList
            .filter(item => item.type === 'user')
            .map(item => item.content)
            .join('\n');

          // 检查信息完整性
          const checkResponse = await uni.request({
            url: '/dev-api/device/glm/chat',
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + uni.getStorageSync('token')
            },
            data: {
              messages: [{
                role: 'user',
                content: `请分析以下用户对话内容，检查是否包含了完整的投诉信息。需要检查的信息项：订单号、问题描述、联系方式、联系人姓名。注意提取两个信息黏在一起的情况，还有电话号码是大数字
                只返回缺失的信息项，用逗号分隔。如果信息完整则返回"完整"。
                用户对话内容：${userMessages}`
              }]
            }
          });

          if (checkResponse[1]?.statusCode === 200 && checkResponse[1].data.code === 200) {
            const missingInfo = checkResponse[1].data.data.content;
            
            if (missingInfo !== '完整') {
              promptPrefix = `作为一名专业的客服人员，我注意到还缺少一些重要信息。请以礼貌专业的口吻，询问用户提供以下信息：${missingInfo}。
              在回复中要解释为什么需要这些信息，并感谢用户的配合。注意一定要突出用户缺失的信息，用户的问题是：`;
            } else {
              // 如果信息完整，生成客服工单
              const allMessages = this.chatList
                .map(item => `${item.type === 'user' ? '客户' : '客服'}：${item.content}`)
                .join('\n');
              
              const ticketPrompt = `请根据以下对话内容，生成一个规范的客服工单。格式要求：
              1. 工单编号：自动生成一个唯一的工单号（格式：CS+年月日+4位随机数）
              2. 客户信息：提取对话中的联系人、联系方式
              3. 问题类型：${this.ticket.type}
              4. 问题描述：简要概括客户的主要问题
              5. 问题详情：完整记录客户描述的具体问题
              6. 处理建议：根据对话内容提供的解决方案
              7. 工单状态：待确认

              对话内容：
              ${allMessages}`;

              // 使用异步接口生成工单
              const ticketResponse = await uni.request({
                url: '/dev-api/device/glm/async/chat',
                method: 'POST',
                header: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + uni.getStorageSync('token')
                },
                data: {
                  messages: [{
                    role: 'user',
                    content: ticketPrompt
                  }]
                }
              });

              if (ticketResponse[1]?.statusCode === 200 && ticketResponse[1].data.code === 200) {
                const taskId = ticketResponse[1].data.data;
                
                // 添加等待提示
                this.chatList.push({
                  type: 'bot',
                  content: '正在生成工单，请稍候...',
                  time: this.formatTime(new Date()),
                  isLoading: true
                });
                
                // 轮询获取工单生成结果
                await this.pollAsyncResult(taskId, true);
                return;
              }
            }
          }
        }

        // 如果promptPrefix为空，使用默认的提示语
        if (!promptPrefix) {
          switch(currentIntent) {
            case '投诉处理':
              promptPrefix = `作为一名专业的客服人员，我正在处理一个投诉案例。请以同理心和专业的态度回应以下投诉，首先表达歉意，然后请客户提供更详细的信息，包括订单号，问题描述，联系方式，联系人姓名等。确保回答里面要求用户提供这些信息。用户的问题是：`;
              break;
            case '服务请求':
              promptPrefix = `作为一名专业的客服人员，我正在处理一个服务请求。请以积极主动和专业的态度回应，提供清晰的操作指导和解决方案，确保回答准确、实用且易于理解。用户的问题是：`;
              break;
            case '产品咨询':
              promptPrefix = `作为一名专业的产品顾问，我正在回答用户的产品咨询。请以专业和耐心的态度提供详细的产品信息，突出产品优势，并解答用户疑虑。确保回答专业、准确且有帮助。用户的问题是：`;
              break;
            default:
              promptPrefix = `作为一名专业的客服人员，请以专业、友善的态度回答以下问题：`;
          }
        }

        // 根据对话长度选择同步或异步接口
        const isLongConversation = this.chatList.length > 5;
        const requestData = {
          messages: [{
            role: 'user',
            content: promptPrefix + userMessage
          }]
        };

        if (isLongConversation) {
          // 使用异步接口
          const response = await uni.request({
            url: '/dev-api/device/glm/async/chat',
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + uni.getStorageSync('token')
            },
            data: requestData
          });

          if (response[1]?.statusCode === 200 && response[1].data.code === 200) {
            const taskId = response[1].data.data;
            
            // 添加等待提示
            this.chatList.push({
              type: 'bot',
              content: '正在思考中...',
              time: this.formatTime(new Date()),
              isLoading: true
            });

            // 开始轮询结果
            await this.pollAsyncResult(taskId);
          }
        } else {
          // 使用同步接口
          const response = await uni.request({
            url: '/dev-api/device/glm/chat',
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + uni.getStorageSync('token')
            },
            data: requestData
          });

          if (response[1]?.statusCode === 200 && response[1].data.code === 200) {
            const aiMessage = response[1].data.data.content;
            
            this.chatList.push({
              type: 'bot',
              content: aiMessage,
              time: this.formatTime(new Date())
            });
          }
        }

        this.scrollToBottom();
      } catch (error) {
        console.error('AI处理错误：', error);
        uni.showToast({
          title: '系统繁忙，请稍后再试',
          icon: 'none'
        });
      }
    },
    
    // 轮询异步结果
    async pollAsyncResult(taskId, isTicket = false) {
      try {
        const response = await uni.request({
          url: `/dev-api/device/glm/async/result/${taskId}`,
          method: 'GET',
          header: {
            'Authorization': 'Bearer ' + uni.getStorageSync('token')
          }
        });

        if (response[1]?.statusCode === 200 && response[1].data.code === 200) {
          const result = response[1].data.data;
          
          // 移除loading消息
          this.chatList = this.chatList.filter(item => !item.isLoading);
          
          if (isTicket) {
            // 保存工单内容
            this.ticket.content = result.content;
            
            // 将生成的工单发送给用户确认
            this.chatList.push({
              type: 'bot',
              content: `根据我们的对话，我已经生成了一个客服工单，请您确认以下内容：\n\n${result.content}\n\n如果信息无误，我将为您提交工单。如需修改，请告诉我需要调整的部分。`,
              time: this.formatTime(new Date())
            });
          } else {
            // 添加AI回复
            this.chatList.push({
              type: 'bot',
              content: result.content,
              time: this.formatTime(new Date())
            });
          }
          
          this.scrollToBottom();
        } else {
          // 如果还没有结果，继续轮询
          setTimeout(() => this.pollAsyncResult(taskId, isTicket), 2000);
        }
      } catch (error) {
        console.error('轮询结果错误:', error);
        // 移除loading消息
        this.chatList = this.chatList.filter(item => !item.isLoading);
        
        uni.showToast({
          title: '获取响应失败，请重试',
          icon: 'none'
        });
      }
    },
    
    // 生成服务工单
    generateServiceTicket() {
      this.ticket = {
        type: '产品咨询',
        description: this.extractDescription(),
        solution: this.extractSolution()
      }
      this.showTicket = true
    },
    
    // 确认工单
    async confirmTicket() {
      try {
        // TODO: 调用保存工单API
        uni.showToast({
          title: '工单已生成',
          icon: 'success'
        })
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } catch (error) {
        console.error('保存工单错误：', error)
      }
    },
    
    // 修改工单
    modifyTicket() {
      this.showTicket = false
    },
    
    // 关闭工单
    closeTicket() {
      this.showTicket = false
    },
    
    // 格式化时间
    formatTime(date) {
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    },
    
    // 滚动到底部
    scrollToBottom() {
      setTimeout(() => {
        const query = uni.createSelectorQuery().in(this)
        query.select('.chat-list').boundingClientRect(data => {
          this.scrollTop = data.height
        }).exec()
      }, 100)
    },
    
    // 提取对话中的问题描述
    extractDescription() {
      return this.chatList
        .filter(item => item.type === 'user')
        .map(item => item.content)
        .join('\n')
    },
    
    // 提取AI的解决方案
    extractSolution() {
      return this.chatList
        .filter(item => item.type === 'bot')
        .map(item => item.content)
        .join('\n')
    },

    // 使用大模型判断用户意图
    async detectIntent(message) {
      try {
        const response = await uni.request({
          url: '/dev-api/device/ollama/generate',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + uni.getStorageSync('token')
          },
          data: {
            prompt: `请分析以下用户消息的意图类型，只返回"投诉处理"、"服务请求"或"产品咨询"其中之一，不要返回其他内容。只要有任何的抱怨就是投诉处理：\n${message}`
          }
        });

        if (response[1] && response[1].statusCode === 200 && response[1].data.code === 200) {
          // 先移除<think>标签内容
          let intent = response[1].data.data.replace(/<think>.*?<\/think>/gs, '').trim();
          // 确保返回值是三种类型之一
          if (!['投诉处理', '服务请求', '产品咨询'].includes(intent)) {
            intent = '产品咨询'; // 默认为咨询类型
          }
          return intent;
        } else {
          console.error('意图识别失败');
          return '产品咨询'; // 默认为咨询类型
        }
      } catch (error) {
        console.error('意图识别错误：', error);
        return '产品咨询'; // 出错时默认为咨询类型
      }
    },

    // 添加新方法：检查是否是确认消息
    isConfirmationMessage(message) {
      const confirmKeywords = ['确认', '同意', '可以', '正确', '没问题', '提交', 'ok', 'OK', '对', '是的'];
      const lowerMessage = message.toLowerCase();
      return confirmKeywords.some(keyword => lowerMessage.includes(keyword));
    },

    // 添加新方法：从工单内容中提取客户姓名
    extractCustomerName(content) {
      // 尝试从工单内容中匹配客户信息部分
      const customerInfoMatch = content.match(/客户信息：(.*?)(?=\n|$)/);
      if (customerInfoMatch) {
        // 尝试从客户信息中提取姓名
        const nameMatch = customerInfoMatch[1].match(/([^,，、\s]*?)[:：]?\s*?([^,，、\s]+)/);
        if (nameMatch) {
          return nameMatch[2];
        }
      }
      return null;
    },

    // 添加新方法：从工单内容中提取电话号码
    extractPhoneNumber(content) {
      // 尝试从工单内容中匹配电话号码
      // 匹配手机号码（11位数字）或座机号码（包含区号的格式）
      const phoneMatches = content.match(/(?:电话|联系方式|手机|联系电话|座机|tel|phone|[：:]\s*)([0-9-]{7,15})/i);
      if (phoneMatches) {
        // 提取匹配到的号码并清理空格和特殊字符
        return phoneMatches[1].replace(/[^\d-]/g, '');
      }
      return null;
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
  
  .chat-list {
    flex: 1;
    padding: 20rpx;
    overflow-y: auto;
    
    .chat-item {
      display: flex;
      margin-bottom: 30rpx;
      
      &.user {
        flex-direction: row-reverse;
        
        .message {
          background-color: #007AFF;
          color: #fff;
          margin-right: 20rpx;
          margin-left: 100rpx;
          
          &:after {
            right: -16rpx;
            border-left-color: #007AFF;
          }
        }
      }
      
      &.bot {
        .message {
          background-color: #fff;
          margin-left: 20rpx;
          margin-right: 100rpx;
          
          &:after {
            left: -16rpx;
            border-right-color: #fff;
          }
        }
      }
      
      .avatar {
        width: 80rpx;
        height: 80rpx;
        
        image {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
      }
      
      .message {
        padding: 20rpx;
        border-radius: 10rpx;
        position: relative;
        max-width: 70%;
        word-break: break-all;
        
        &:after {
          content: '';
          position: absolute;
          top: 20rpx;
          border: 8rpx solid transparent;
        }
      }
      
      .time {
        font-size: 24rpx;
        color: #999;
        margin: 0 20rpx;
        align-self: flex-end;
      }
    }
  }
  
  .service-ticket {
    position: fixed;
    bottom: 120rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    background: #fff;
    border-radius: 20rpx;
    padding: 30rpx;
    box-shadow: 0 0 20rpx rgba(0,0,0,0.1);
    
    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20rpx;
      
      .title {
        font-size: 32rpx;
        font-weight: bold;
      }
      
      .close {
        font-size: 40rpx;
        color: #999;
      }
    }
    
    .ticket-content {
      .ticket-item {
        margin-bottom: 20rpx;
        
        .label {
          color: #666;
          margin-right: 10rpx;
        }
      }
    }
    
    .ticket-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 30rpx;
      
      button {
        width: 45%;
        height: 80rpx;
        line-height: 80rpx;
        border-radius: 40rpx;
        font-size: 28rpx;
        
        &.confirm-btn {
          background: #007AFF;
          color: #fff;
        }
        
        &.modify-btn {
          background: #f5f5f5;
          color: #333;
        }
      }
    }
  }
  
  .input-area {
    padding: 20rpx;
    background: #fff;
    border-top: 1rpx solid #eee;
    display: flex;
    align-items: center;
    
    .input-box {
      flex: 1;
      height: 80rpx;
      background: #f5f5f5;
      border-radius: 40rpx;
      padding: 20rpx;
      margin-right: 20rpx;
      font-size: 28rpx;
    }
    
    .send-btn {
      width: 120rpx;
      height: 80rpx;
      line-height: 80rpx;
      background: #007AFF;
      color: #fff;
      border-radius: 40rpx;
      font-size: 28rpx;
      text-align: center;
    }
  }
}
</style> 
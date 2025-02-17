<template>
  <view class="agent-container">
    <!-- 左侧功能面板 -->
    <view class="left-panel">
      <view class="header">
        <text class="title">客服工作台</text>
      </view>
      
      <view class="controls">
        <!-- 状态切换 -->
        <view class="status-switch">
          <view :class="['status-btn', onlineStatus ? 'online' : '']" @click="toggleStatus">
            {{ onlineStatus ? '在线' : '离线' }}
          </view>
        </view>
        
        <!-- 通话控制按钮 -->
        <view class="call-controls">
          <button class="control-btn accept" @click="handleAcceptCall" 
                  :disabled="!hasIncomingCall || !onlineStatus">
            <text class="iconfont icon-phone"></text>
            <text>接听</text>
          </button>
          
          <button class="control-btn end" @click="handleEndCall" 
                  :disabled="!isInCall">
            <text class="iconfont icon-phone-off"></text>
            <text>结束</text>
          </button>
        </view>
        
        <!-- 当前会话信息 -->
        <view class="current-session" v-if="currentCustomer">
          <view class="customer-info">
            <image class="avatar" :src="currentCustomer.avatar" mode="aspectFill"></image>
            <view class="info">
              <text class="name">{{ currentCustomer.name }}</text>
              <text class="session-time">通话时长: {{ callDuration }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 右侧对话界面 -->
    <view class="right-panel">
      <view class="chat-container">
        <scroll-view class="message-list" scroll-y="true" :scroll-top="scrollTop">
          <view v-for="(msg, index) in messages" :key="index" 
                :class="['message-item', msg.type === 'customer' ? 'customer' : 'agent']">
            <view class="message-content">
              <text>{{ msg.content }}</text>
            </view>
            <text class="message-time">{{ msg.time }}</text>
          </view>
        </scroll-view>
        
        <!-- 输入区域 -->
        <view class="input-area">
          <textarea class="message-input" 
                    v-model="messageInput"
                    placeholder="请输入消息..."
                    :disabled="!isInCall"
                    @confirm="sendMessage"></textarea>
          <button class="send-btn" @click="sendMessage" :disabled="!isInCall">发送</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      onlineStatus: false,
      hasIncomingCall: false,
      isInCall: false,
      callDuration: '00:00',
      currentCustomer: null,
      messages: [],
      messageInput: '',
      scrollTop: 0,
      durationTimer: null
    }
  },
  methods: {
    toggleStatus() {
      this.onlineStatus = !this.onlineStatus
    },
    handleAcceptCall() {
      if (!this.hasIncomingCall || !this.onlineStatus) return
      this.isInCall = true
      this.hasIncomingCall = false
      this.startCallTimer()
    },
    handleEndCall() {
      if (!this.isInCall) return
      this.isInCall = false
      this.currentCustomer = null
      this.stopCallTimer()
      this.messages = []
    },
    startCallTimer() {
      let seconds = 0
      this.durationTimer = setInterval(() => {
        seconds++
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        this.callDuration = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      }, 1000)
    },
    stopCallTimer() {
      if (this.durationTimer) {
        clearInterval(this.durationTimer)
        this.durationTimer = null
      }
      this.callDuration = '00:00'
    },
    sendMessage() {
      if (!this.messageInput.trim() || !this.isInCall) return
      
      this.messages.push({
        type: 'agent',
        content: this.messageInput,
        time: new Date().toLocaleTimeString()
      })
      
      this.messageInput = ''
      this.scrollToBottom()
    },
    scrollToBottom() {
      // 延迟执行以确保消息列表已更新
      setTimeout(() => {
        const query = uni.createSelectorQuery().in(this)
        query.select('.message-list').boundingClientRect(data => {
          this.scrollTop = data.height
        }).exec()
      }, 100)
    }
  }
}
</script>

<style lang="scss" scoped>
.agent-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  background-color: #f5f6fa;
  
  .left-panel {
    width: 300px;
    background-color: #fff;
    border-right: 1px solid #eaeaea;
    display: flex;
    flex-direction: column;
    
    .header {
      padding: 20px;
      border-bottom: 1px solid #eaeaea;
      
      .title {
        font-size: 18px;
        font-weight: bold;
        color: #333;
      }
    }
    
    .controls {
      padding: 20px;
      
      .status-switch {
        margin-bottom: 20px;
        
        .status-btn {
          padding: 8px 16px;
          border-radius: 20px;
          text-align: center;
          background-color: #f5f5f5;
          color: #999;
          cursor: pointer;
          
          &.online {
            background-color: #4CAF50;
            color: #fff;
          }
        }
      }
      
      .call-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        
        .control-btn {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          
          &.accept {
            background-color: #4CAF50;
            color: #fff;
            
            &:disabled {
              background-color: #ccc;
            }
          }
          
          &.end {
            background-color: #f44336;
            color: #fff;
            
            &:disabled {
              background-color: #ccc;
            }
          }
          
          .iconfont {
            font-size: 24px;
          }
        }
      }
      
      .current-session {
        padding: 15px;
        background-color: #f9f9f9;
        border-radius: 8px;
        
        .customer-info {
          display: flex;
          align-items: center;
          gap: 10px;
          
          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 20px;
          }
          
          .info {
            .name {
              font-size: 16px;
              font-weight: 500;
              color: #333;
            }
            
            .session-time {
              font-size: 12px;
              color: #666;
            }
          }
        }
      }
    }
  }
  
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: #fff;
      
      .message-list {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        
        .message-item {
          margin-bottom: 15px;
          display: flex;
          flex-direction: column;
          
          &.customer {
            align-items: flex-start;
            
            .message-content {
              background-color: #f5f5f5;
            }
          }
          
          &.agent {
            align-items: flex-end;
            
            .message-content {
              background-color: #007AFF;
              color: #fff;
            }
          }
          
          .message-content {
            padding: 10px 15px;
            border-radius: 8px;
            max-width: 70%;
            word-break: break-word;
          }
          
          .message-time {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
          }
        }
      }
      
      .input-area {
        padding: 20px;
        border-top: 1px solid #eaeaea;
        display: flex;
        gap: 10px;
        
        .message-input {
          flex: 1;
          height: 80px;
          padding: 10px;
          border: 1px solid #eaeaea;
          border-radius: 8px;
          resize: none;
          
          &:disabled {
            background-color: #f5f5f5;
          }
        }
        
        .send-btn {
          width: 80px;
          background-color: #007AFF;
          color: #fff;
          border: none;
          border-radius: 8px;
          
          &:disabled {
            background-color: #ccc;
          }
        }
      }
    }
  }
}
</style>

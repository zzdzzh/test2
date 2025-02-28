<template>

    <view class="chat-container">
        <!-- 购买记录列表 -->
        <view class="purchase-history" :class="{ 'expanded': isPurchaseHistoryExpanded }">
            <view class="purchase-header" @tap="togglePurchaseHistory">
                <text>订单记录</text>
                <text class="toggle-icon">{{ isPurchaseHistoryExpanded ? '↑' : '↓' }}</text>
            </view>
            <view class="purchase-list" v-if="isPurchaseHistoryExpanded">
                <view v-for="(order, index) in orders" :key="index" class="purchase-item">
                    <view class="purchase-info">
                        <text class="order-number">订单号：{{ order.orderNo }}</text>
                        <view class="product-info" v-for="(item, itemIndex) in order.contractOrderItemList" :key="itemIndex">
                            <text class="product-name">产品：{{ item.itemInfo.itemName }} {{ item.itemInfo.specification || '' }}</text>
                            <text class="product-detail">数量：{{ item.quantity }} {{ item.itemInfo.unitOfMeasure }} | 单价：¥{{ item.price || '暂无'}}</text>
                        </view>
                        <text class="order-amount">总金额：¥{{ order.totalAmount }}</text>
                        <text class="order-status">状态：{{ order.status }}</text>
                    </view>
                </view>
                <view v-if="orders.length === 0" class="no-order">
                    暂无相关订单
                </view>
            </view>
        </view>

        <!-- 客服工单历史记录 -->
        <view class="service-history" :class="{ 'expanded': isServiceHistoryExpanded }">
            <view class="service-header" @tap="toggleServiceHistory">
                <text>客服工单历史</text>
                <text class="toggle-icon">{{ isServiceHistoryExpanded ? '↑' : '↓' }}</text>
            </view>
            <view class="service-list" v-if="isServiceHistoryExpanded">
                <view v-for="(ticket, index) in serviceHistory" :key="index" class="service-item">
                    <view class="service-info">
                        <text class="ticket-number">工单号：{{ ticket.ticketNo }}</text>
                        <text class="ticket-status">状态：{{ getStatusText(ticket.status) }}</text>
                        <text class="ticket-content">内容：{{ ticket.content }}</text>
                        <text class="ticket-date">{{ formatDate(ticket.createTime) }}</text>
                        <text class="ticket-type">类型：{{ getConsultTypeText(ticket.consultType) }}</text>
                    </view>
                </view>
                <view v-if="serviceHistory.length === 0" class="no-ticket">
                    暂无相关工单
                </view>
                <view v-if="hasMoreHistory" class="load-more" @tap="loadMoreHistory">
                    <text v-if="loadMoreStatus === 'more'">加载更多</text>
                    <text v-if="loadMoreStatus === 'loading'">加载中...</text>
                    <text v-if="loadMoreStatus === 'noMore'">没有更多了</text>
                </view>
            </view>
        </view>

      <!-- 聊天记录区域 -->

      <scroll-view 
        class="chat-list" 
        scroll-y="true" 
        :scroll-top="scrollTop"
        @scroll="onScroll"
      >
        <view class="chat-content">
          <view class="chat-item" v-for="(item, index) in chatList" :key="index" :class="item.type">

            <view class="avatar">

              <image :src="item.type === 'user' ? userAvatar : serviceAvatar"></image>

            </view>

            <view class="message">

              <text>{{ item.content }}</text>

            </view>

            <view class="time">{{ item.time }}</view>

          </view>
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
        <button class="clear-btn" @tap="clearChat">清空</button>

      </view>

    </view>

  </template>

  

  <script>

  export default {

    data() {
        return {
            isPanelExpanded: false,
            isServiceHistoryExpanded: false,
            serviceHistory: [],
            serviceHistoryPage: 1,
            serviceHistoryPageSize: 10,
            hasMoreHistory: true,
            loadMoreStatus: 'more',
            chatList: [],
            inputMessage: '',
            scrollTop: 0,
            oldScrollTop: 0,
            userAvatar: '/static/images/user-avatar.png',
            serviceAvatar: '/static/images/service-avatar.png',
            formData: {
              type: '', // 意图类型：产品咨询、投诉、服务请求
              name: '', // 联系人姓名
              phone: '', // 联系电话
              details: '', // 具体事由
            },
            contactInfoKey: 'user_contact_info', // 用于存储联系信息的key
            isFormComplete: false,
            isConfirmed: false,
            apiConfig: {
              url: '/dev-api/device/knowledge/analyze', // Updated to use the new knowledge endpoint
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 300000, // 设置30秒超时
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

如果信息完整但用户未确认，请设置isComplete为true，isConfirmed为false，在reply中总结信息并询问是否正确，同时reply中要以结构化的方式展示客服单的信息。

如果用户确认信息正确，请设置isConfirmed为true。`,
            chatHistoryKey: 'recent_chat_history', // 用于存储聊天记录的key
            isHistoryCollapsed: false,
            orders: [],
            isPurchaseHistoryExpanded: false
        }
    },

    onLoad() {
        this.loginWithoutCode();
        this.autoLogin();
        // 登录成功后获取订单列表和恢复聊天记录
        setTimeout(() => {
            this.getOrderList();
            this.restoreRecentChats();
            this.restoreContactInfo(); // 恢复用户联系信息
        }, 1000);
    },

    onUnload() {

      // 退出前保存聊天记录
      if (this.chatList.length > 0) {
        this.saveRecentChats();
      }
    },

    methods: {

      togglePanel() {
        this.isPanelExpanded = !this.isPanelExpanded;
        // 展开时滚动到顶部
        if (this.isPanelExpanded) {
          uni.pageScrollTo({
            scrollTop: 0,
            duration: 300
          });
        }
      },

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
            return '抱歉，服务器返回为空。';
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
        try {
            const token = uni.getStorageSync('token');
            if (!token) {
                throw new Error('未登录，请先登录');
            }

            // 获取localStorage中的联系人信息
            const contactInfo = uni.getStorageSync(this.contactInfoKey);
            let contactContext = '';
            if (contactInfo) {
                const parsedInfo = JSON.parse(contactInfo);
                contactContext = `用户的联系方式是：姓名 ${parsedInfo.name}，电话 ${parsedInfo.phone}。`;
            }

            const messages = [
                {
                    role: "system",
                    content: this.systemPrompt
                },
                ...chatHistory,
                {
                    role: "user",
                    content: contactContext + message // 如果有联系人信息就加上，没有就只发送原消息
                }
            ];

            const contentString = messages.map((msg, index) => `${msg.role === 'system' ? '系统' : '用户'}: ${msg.content}`).join('\n');

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
                timeout: this.apiConfig.timeout
            });

            if (err) {
                throw new Error(err.errMsg || '请求失败');
            }

            if (res.statusCode === 200 && res.data.code === 200) {
                return this.processResponse(res.data.msg);
            } else {
                throw new Error(res.data.msg || '请求失败');
            }
        } catch (error) {
            this.saveRecentChats();
            console.error('API调用失败:', error);
            throw error;
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
        
        // 立即滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
        });

        try {
          // 显示加载状态
          uni.showLoading({
            title: '正在处理'
          });

          // 调用API获取响应，传入当前聊天历史
          const response = await this.callLLMApi(userMessage, this.chatList);
          console.log('API响应：', response);

          // 添加系统回复到聊天列表
          this.chatList.push({
            type: 'service',
            content: response,
            time: this.formatTime(new Date())
          });

          // 保存最新的对话记录
          this.saveRecentChats();

          // 再次滚动到底部
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        } catch (error) {
          this.saveRecentChats(); // 发生异常时保存对话
          uni.hideLoading();
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
          const query = uni.createSelectorQuery().in(this);
          query.select('.chat-content').boundingClientRect(data => {
            if (data) {
              this.scrollTop = data.height * 2; // 设置一个足够大的值确保滚动到底部
            }
          }).exec();
        }, 100);
      },
      
      onScroll(e) {
        // 记录旧的滚动位置
        this.oldScrollTop = e.detail.scrollTop;
      },

      checkFormComplete() {
        return this.formData.type && 
               this.formData.name && 
               this.formData.phone && 
               this.formData.details;
      },

      async submitForm() {
        if (!this.formData.type || !this.formData.name || !this.formData.phone || !this.formData.details) {
            uni.showToast({
                title: '请填写完整信息',
                icon: 'none'
            });
            return;
        }
        
        // 在提交表单时保存联系信息
        this.saveContactInfo();
        
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

      // 保存用户联系信息到localStorage
      saveContactInfo() {
        try {
            const contactInfo = {
                name: this.formData.name,
                phone: this.formData.phone
            };
            uni.setStorageSync(this.contactInfoKey, JSON.stringify(contactInfo));
        } catch (e) {
            console.error('保存联系信息失败:', e);
        }
      },

      // 从localStorage恢复用户联系信息
      restoreContactInfo() {
        try {
            const contactInfo = uni.getStorageSync(this.contactInfoKey);
            if (contactInfo) {
                const parsedInfo = JSON.parse(contactInfo);
                this.formData.name = parsedInfo.name || '';
                this.formData.phone = parsedInfo.phone || '';
            }
        } catch (e) {
            console.error('恢复联系信息失败:', e);
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
      getServiceHistory(reset = false) {
        if (reset) {
          this.serviceHistoryPage = 1;
          this.hasMoreHistory = true;
          this.serviceHistory = [];
        }
        
        if (!this.hasMoreHistory) return;
        
        this.loadMoreStatus = 'loading';
        uni.request({
          url: '/dev-api/device/customer/service/ticket/list',
          method: 'GET',
          data: {
            pageNum: this.serviceHistoryPage,
            pageSize: this.serviceHistoryPageSize
          },
          header: {
            'Authorization': 'Bearer ' + uni.getStorageSync('token')
          },
          success: (res) => {
            if (res.data.code === 200) {
              const newTickets = res.data.rows || [];
              this.serviceHistory = reset ? newTickets : [...this.serviceHistory, ...newTickets];
              this.hasMoreHistory = newTickets.length === this.serviceHistoryPageSize;
              this.loadMoreStatus = this.hasMoreHistory ? 'more' : 'noMore';
            } else {
              uni.showToast({
                title: res.data.msg || '加载失败',
                icon: 'none'
              });
              this.loadMoreStatus = 'more';
            }
          },
          fail: () => {
            uni.showToast({
              title: '网络请求失败',
              icon: 'none'
            });
            this.loadMoreStatus = 'more';
          }
        });
      },
      loadMoreHistory() {
        if (this.hasMoreHistory) {
          this.serviceHistoryPage++;
          this.getServiceHistory();
        }
      },
      getStatusText(status) {
        const statusMap = {
          0: '待处理',
          1: '处理中',
          2: '已完成'
        };
        return statusMap[status] || '未知状态';
      },
      getConsultTypeText(type) {
        const typeMap = {
          0: '产品咨询',
          2: '投诉建议',
          3: '其他问题'
        };
        return typeMap[type] || '未知类型';
      },
      formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        
        // 如果是今天的日期，只显示时间
        if (date.toDateString() === now.toDateString()) {
          return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        
        // 如果是昨天的日期
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
          return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        
        // 其他日期显示完整日期时间
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      },
      toggleServiceHistory() {
        this.isServiceHistoryExpanded = !this.isServiceHistoryExpanded;
        if (this.isServiceHistoryExpanded) {
          this.getServiceHistory();
        }
      },
      getOrderList() {
        uni.showLoading({
          title: '加载中...'
        })
        uni.request({
          url: '/prod-api/system/mes/cm/contractOrder/list',
          method: 'GET',
          data: {
            pageNum: 1,
            pageSize: 10,
            orderByColumn: 'orderId',
            isAsc: 'desc'
          },
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + uni.getStorageSync('nc_token')
          },
          success: (response) => {
            uni.hideLoading()
            if (response.data.code === 200) {
              this.orders = response.data.rows || []
            } else {
              uni.showToast({
                title: response.data.msg || '获取订单失败',
                icon: 'error'
              })
            }
          },
          fail: (error) => {
            uni.hideLoading()
            uni.showToast({
              title: '网络错误，请稍后重试',
              icon: 'error'
            })
            console.error('获取订单失败：', error)
          }
        })
      },
      togglePurchaseHistory() {
        this.isPurchaseHistoryExpanded = !this.isPurchaseHistoryExpanded;
        // 展开时重新获取订单列表
        if (this.isPurchaseHistoryExpanded) {
            this.getOrderList();
        }
      },
      clearChat() {
        this.chatList = [];
        this.saveRecentChats(); // 清空后更新存储
        uni.showToast({
          title: '聊天记录已清空',
          icon: 'success'
        });
      }
    }

  }

  </script>

  

  <style scoped>
  .purchase-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    z-index: 999;
    height: 50px;
    transition: all 0.3s ease;
  }

  .panel-expanded {
    height: 450px;
  }

  .panel-header {
    padding: 16rpx 32rpx;
    background: #f8f8f8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 50px;
    box-sizing: border-box;
  }

  .toggle-icon {
    font-size: 20px;
    color: #666;
  }

  .purchase-list {
    height: calc(100% - 50px);
    padding: 20rpx;
    box-sizing: border-box;
  }

  .purchase-item {
    display: flex;
    justify-content: space-between;
    padding: 24rpx 0;
    border-bottom: 1px solid #eee;
  }

  .item-name {
    flex: 1;
    padding-right: 20rpx;
  }

  .item-date {
    color: #666;
    margin: 0 20rpx;
  }

  .item-price {
    color: #ff6b6b;
    font-weight: bold;
  }

  /* 调整聊天容器的上边距以适应面板 */
  .chat-container {
    padding-top: 50px;
  }
  </style>

  <style lang="scss">
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
    padding-bottom: 30px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch; /* 增加iOS滚动惯性 */
    height: calc(100vh - 180px); /* 减去输入框的高度 */
    position: relative;
    z-index: 1; /* 确保滚动区域在输入框之下 */
  }

  .chat-content {
    padding-bottom: 20px;
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
    box-shadow: 0 -12px 6px rgba(0, 0, 0, 0.05);
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

  .clear-btn {
    padding: 0 30rpx;
    height: 70rpx;
    line-height: 70rpx;
    background-color: #f5f5f5;
    color: #666;
    border-radius: 8rpx;
    margin-left: 20rpx;
    font-size: 28rpx;
  }

  .clear-btn:active {
    background-color: #e0e0e0;
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

  .purchase-history {
    background-color: #ffffff;
    border-radius: 8px;
    margin: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: all 0.3s ease;
    max-height: 48px;

    &.expanded {
        max-height: 80vh; 
    }

    .purchase-list {
        padding: 0 16px;
        max-height: calc(80vh - 48px); 
        overflow-y: auto; 
        -webkit-overflow-scrolling: touch; 
    }

  }

  .purchase-header {
    padding: 16rpx 32rpx;
    background: #f8f8f8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 50px;
    box-sizing: border-box;
  }

  .purchase-header .toggle-icon {
    font-size: 20px;
    color: #666;
  }

  .purchase-item {
    display: flex;
    justify-content: space-between;
    padding: 24rpx 0;
    border-bottom: 1px solid #eee;
  }

  .purchase-info {
    flex: 1;
    padding-right: 20rpx;
  }

  .product-name {
    font-size: 16px;
    font-weight: bold;
  }

  .purchase-date {
    color: #666;
    margin: 0 20rpx;
  }

  .purchase-amount {
    color: #ff6b6b;
    font-weight: bold;
  }

  .order-number {
    font-size: 16px;
    font-weight: bold;
  }

  .product-info {
    margin-bottom: 10px;
  }

  .product-detail {
    color: #666;
  }

  .order-amount {
    color: #ff6b6b;
    font-weight: bold;
  }

  .order-status {
    color: #666;
  }

  .no-order {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  .service-history {
    background-color: #ffffff;
    border-radius: 8px;
    margin: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: all 0.3s ease;
    max-height: 48px;

    &.expanded {
        max-height: calc(100vh - 300px); 
    }

    .service-list {
        padding: 0 16px;
        max-height: calc(100vh - 350px); 
        overflow-y: auto; 
        -webkit-overflow-scrolling: touch; 
        display: flex;
        flex-direction: column;
        padding-bottom: 60rpx; 
    }

  }

  .service-header {
    padding: 16rpx 32rpx;
    background: #f8f8f8;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 50px;
    box-sizing: border-box;
  }

  .service-header .toggle-icon {
    font-size: 20px;
    color: #666;
  }

  .service-item {
    padding: 16rpx 0;
    border-bottom: 1px solid #eee;

    &:last-child {
        border-bottom: none;
        margin-bottom: 20rpx; 
    }
  }

  .service-info {
    flex: 1;
    padding-right: 20rpx;
  }

  .ticket-number {
    font-size: 16px;
    font-weight: bold;
  }

  .ticket-status {
    color: #666;
    margin: 0 20rpx;
  }

  .ticket-content {
    color: #666;
  }

  .ticket-date {
    color: #666;
    margin: 0 20rpx;
  }

  .ticket-type {
    color: #666;
    margin: 0 20rpx;
  }

  .no-ticket {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40rpx 0;
    color: #999;
    font-size: 28rpx;
  }

  .load-more {
    padding: 20rpx 0;
    text-align: center;
    color: #666;
    font-size: 28rpx;
    background: #f8f8f8;
    margin: 20rpx 0 40rpx; 
    border-radius: 4px;
    position: relative;
    top: -20rpx; 
    
    &:active {
        opacity: 0.8;
    }
  }

  /* 调整聊天区域的位置，避免被列表遮挡 */
  .chat-list {
    margin-top: 20rpx;
  }
  </style>
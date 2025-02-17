<template>
  <view class="ticket-list">
    <view class="header">
      <text class="title">客服工单列表</text>
    </view>

    <view class="filter-section">
      <uni-segmented-control :current="statusIndex" :values="statusOptions" @clickItem="onStatusChange"></uni-segmented-control>
    </view>

    <view class="list-container">
      <view class="ticket-item" v-for="(ticket, index) in tickets" :key="index">
        <view class="ticket-header">
          <text class="ticket-id">工单号：{{ ticket.id }}</text>
          <text :class="['ticket-status', `status-${ticket.status}`]">{{ getStatusText(ticket.status) }}</text>
        </view>
        <view class="ticket-content">
          <view class="info-row">
            <text class="label">提交时间：</text>
            <text class="value">{{ formatDate(ticket.createTime) }}</text>
          </view>
          <view class="info-row">
            <text class="label">客户姓名：</text>
            <text class="value">{{ ticket.name }}</text>
          </view>
          <view class="info-row">
            <text class="label">联系电话：</text>
            <text class="value">{{ ticket.phone }}</text>
          </view>
          <view class="info-row">
            <text class="label">咨询类型：</text>
            <text class="value">{{ getConsultTypeText(ticket.consultType) }}</text>
          </view>
          <view class="info-row content">
            <text class="label">问题描述：</text>
            <text class="value">{{ ticket.content }}</text>
          </view>
          <view class="info-row" v-if="ticket.relatedOrders">
            <text class="label">关联订单：</text>
            <view class="value order-list">
              <text v-for="(order, orderIndex) in ticket.relatedOrders.split(',')" :key="orderIndex" class="order-number">
                {{ order }}
              </text>
            </view>
          </view>
        </view>
      </view>
      
      <uni-load-more :status="loadMoreStatus"></uni-load-more>
    </view>
  </view>
</template>

<script>
import wxAuth from '@/mixins/wxAuth.js'

export default {
  mixins: [wxAuth],
  data() {
    return {
      statusIndex: 0,
      statusOptions: ['全部', '待处理', '处理中', '已完成'],
      tickets: [],
      page: 1,
      pageSize: 10,
      loadMoreStatus: 'more',
      hasMore: true
    }
  },
  onLoad() {
    this.getOpenid()
    this.loadTickets()
  },
  onReachBottom() {
    if (this.hasMore) {
      this.page++
      this.loadTickets()
    }
  },
  methods: {
    loadTickets() {
      if (!this.hasMore) return
      
      this.loadMoreStatus = 'loading'
      const status = this.statusIndex === 0 ? '' : this.statusIndex - 1
      
      uni.request({
        url: '/dev-api/device/customer/service/ticket/list',
        method: 'GET',
        data: {
          pageNum: this.page,
          pageSize: this.pageSize,
          status: status
        },
        header: {
          'Authorization': 'Bearer ' + uni.getStorageSync('token')
        },
        success: (res) => {
          if (res.data.code === 200) {
            const newTickets = res.data.rows
            this.tickets = this.page === 1 ? newTickets : [...this.tickets, ...newTickets]
            this.hasMore = newTickets.length === this.pageSize
            this.loadMoreStatus = this.hasMore ? 'more' : 'noMore'
          } else {
            uni.showToast({
              title: res.data.msg || '加载失败',
              icon: 'none'
            })
            this.loadMoreStatus = 'more'
          }
        },
        fail: () => {
          uni.showToast({
            title: '网络请求失败',
            icon: 'none'
          })
          this.loadMoreStatus = 'more'
        }
      })
    },
    onStatusChange(e) {
      this.statusIndex = e.currentIndex
      this.page = 1
      this.hasMore = true
      this.loadTickets()
    },
    getStatusText(status) {
      const statusMap = {
        0: '待处理',
        1: '处理中',
        2: '已完成'
      }
      return statusMap[status] || '未知状态'
    },
    getConsultTypeText(type) {
      const typeMap = {
        0: '产品咨询',
        2: '投诉建议',
        3: '其他问题'
      }
      return typeMap[type] || '未知类型'
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now - date
      
      // 如果是今天的日期，只显示时间
      if (date.toDateString() === now.toDateString()) {
        return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      }
      
      // 如果是昨天的日期
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      }
      
      // 其他日期显示完整日期时间
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
}
</script>

<style lang="scss" scoped>
.ticket-list {
  padding: 20rpx;
  
  .header {
    padding: 20rpx 0;
    .title {
      font-size: 36rpx;
      font-weight: bold;
    }
  }
  
  .filter-section {
    margin: 20rpx 0;
  }
  
  .ticket-item {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
    
    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20rpx;
      padding-bottom: 20rpx;
      border-bottom: 1px solid #eee;
      
      .ticket-id {
        font-size: 28rpx;
        color: #666;
      }
      
      .ticket-status {
        padding: 4rpx 16rpx;
        border-radius: 20rpx;
        font-size: 24rpx;
        
        &.status-0 {
          background-color: #fff7e6;
          color: #fa8c16;
        }
        
        &.status-1 {
          background-color: #e6f7ff;
          color: #1890ff;
        }
        
        &.status-2 {
          background-color: #f6ffed;
          color: #52c41a;
        }
      }
    }
    
    .info-row {
      display: flex;
      margin-bottom: 16rpx;
      
      .label {
        width: 160rpx;
        color: #666;
        font-size: 28rpx;
      }
      
      .value {
        flex: 1;
        font-size: 28rpx;
      }
      
      &.content {
        align-items: flex-start;
        
        .value {
          color: #333;
        }
      }
    }
  }
  
  .order-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
    
    .order-number {
      background-color: #f5f5f5;
      padding: 4rpx 16rpx;
      border-radius: 8rpx;
      font-size: 24rpx;
      color: #666;
    }
  }
}
</style> 
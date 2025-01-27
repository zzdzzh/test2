<template>
  <view class="customer-service">
    <view class="header">
      <text class="title">客户服务中心</text>
      <text class="subtitle">我们将在24小时内回复您的问题</text>
    </view>
    
    <view class="form-container">
      <uni-forms ref="form" :modelValue="formData" :rules="rules">
        <uni-forms-item label="姓名" required>
          <uni-easyinput
            v-model="formData.name"
            placeholder="请输入您的姓名"
          />
        </uni-forms-item>
        
        <uni-forms-item label="手机号码" required>
          <uni-easyinput
            v-model="formData.phone"
            placeholder="请输入您的手机号码"
          />
        </uni-forms-item>
        
        <uni-forms-item label="咨询类型" required>
          <uni-data-select
            v-model="formData.type"
            :localdata="typeOptions"
            placeholder="投诉建议"
          />
        </uni-forms-item>
        
        <uni-forms-item label="问题描述" required>
          <uni-easyinput
            v-model="formData.content"
            type="textarea"
            placeholder="请详细描述您的问题，以便我们更好地为您服务"
            :maxlength="200"
            :autoHeight="true"
          />
          <text class="word-count">{{formData.content.length}}/200</text>
        </uni-forms-item>
        
        <uni-forms-item label="关联订单" required>
          <view class="order-list">
            <view class="order-item" v-for="(order, index) in orders" :key="index">
              <view class="order-select">
                <checkbox :checked="selectedOrders.includes(order.orderNo)" @tap="toggleOrderSelection(order.orderNo)" />
              </view>
              <view class="order-info">
                <text class="order-number">订单号：{{order.orderNo}}</text>
                <view class="product-info" v-for="(item, itemIndex) in order.contractOrderItemList" :key="itemIndex">
                  <text class="product-name">产品：{{item.itemInfo.itemName}} {{item.itemInfo.specification || ''}}</text>
                  <text class="product-detail">数量：{{item.quantity}} {{item.itemInfo.unitOfMeasure}} | 单价：¥{{item.price || '暂无'}}</text>
                </view>
                <text class="order-amount">总金额：¥{{order.totalAmount}}</text>
                <text class="order-status">状态：{{order.status}}</text>
              </view>
            </view>
            <view v-if="orders.length === 0" class="no-order">
              暂无相关订单
            </view>
          </view>
        </uni-forms-item>
      </uni-forms>
      
      <button class="submit-btn" @click="submitForm">提 交</button>
      
      <view class="tips">
        <text class="tips-text">温馨提示：带*号的为必填项，请认真填写</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      formData: {
        name: '',
        phone: '',
        type: '',
        content: ''
      },
      selectedOrders: [],
      typeOptions: [{
        value: '2',
        text: '投诉建议'
      }, {
        value: '0',
        text: '产品咨询'
      }, {
        value: '3',
        text: '其他问题'
      }],
      rules: {
        name: {
          rules: [{
            required: true,
            errorMessage: '请输入姓名'
          }]
        },
        phone: {
          rules: [{
            required: true,
            errorMessage: '请输入手机号码'
          }, {
            pattern: /^1[3-9]\d{9}$/,
            errorMessage: '手机号码格式不正确'
          }]
        },
        type: {
          rules: [{
            required: true,
            errorMessage: '请选择咨询类型'
          }]
        },
        content: {
          rules: [{
            required: true,
            errorMessage: '请输入问题描述'
          }]
        }
      },
      orders: []
    }
  },
  onLoad() {
    this.getOrderList()
  },
  methods: {
    submitForm() {
      this.$refs.form.validate().then(res => {
        // 表单验证通过
        uni.showLoading({
          title: '提交中...'
        })
        
        // 构造请求数据
        const requestData = {
          name: this.formData.name,
          phone: this.formData.phone,
          content: this.formData.content,
          consultType: parseInt(this.formData.type),
          status: 0,  // 初始状态：待处理
          relatedOrders: this.selectedOrders.join(',') // 将数组转换为逗号分隔的字符串
        }
        
        // 调用后端API
        uni.request({
          url: '/dev-api/device/customer/service/ticket',  // 根据实际部署环境配置基础URL
          method: 'POST',
          data: requestData,
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + uni.getStorageSync('nc_token')
          },
          success: (response) => {
            uni.hideLoading()
            if (response.data.code === 200) {
              uni.showToast({
                title: '提交成功',
                icon: 'success'
              })
              // 重置表单
              this.formData = {
                name: '',
                phone: '',
                type: '',
                content: ''
              }
              this.selectedOrders = []
            } else {
              uni.showToast({
                title: response.data.msg || '提交失败',
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
            console.error('提交失败：', error)
          }
        })
      }).catch(err => {
        console.log('表单错误：', err)
      })
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
    toggleOrderSelection(orderNo) {
      const index = this.selectedOrders.indexOf(orderNo)
      if (index === -1) {
        this.selectedOrders.push(orderNo)
      } else {
        this.selectedOrders.splice(index, 1)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.customer-service {
  min-height: 100vh;
  background-color: #f5f5f5;
  
  .header {
    background-color: #4e6ef2;
    padding: 30rpx;
    color: #fff;
    
    .title {
      font-size: 36rpx;
      font-weight: bold;
      display: block;
      margin-bottom: 10rpx;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .subtitle {
      font-size: 24rpx;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  .form-container {
    padding: 30rpx;
    background-color: #fff;
    margin-top: 20rpx;
    
    :deep(.uni-forms-item__label) {
      white-space: nowrap;
    }
    
    .word-count {
      text-align: right;
      font-size: 24rpx;
      color: #999;
      margin-top: 10rpx;
    }
    
    .submit-btn {
      margin-top: 40rpx;
      background-color: #4e6ef2;
      color: #fff;
      border-radius: 8rpx;
    }
    
    .tips {
      margin-top: 30rpx;
      text-align: center;
      
      .tips-text {
        font-size: 24rpx;
        color: #999;
        white-space: nowrap;
      }
    }
    
    .order-list {
      width: 100%;
      
      .order-item {
        background: #f8f8f8;
        border-radius: 8rpx;
        padding: 20rpx;
        margin-bottom: 20rpx;
        display: flex;
        align-items: flex-start;
        
        .order-select {
          margin-right: 20rpx;
          padding-top: 10rpx;
          flex-shrink: 0;
        }
        
        .order-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10rpx;
          
          .order-number {
            font-size: 28rpx;
            color: #333;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .product-info {
            background: #fff;
            padding: 15rpx;
            border-radius: 6rpx;
            margin: 10rpx 0;
            
            .product-name {
              font-size: 26rpx;
              color: #333;
              display: block;
              margin-bottom: 6rpx;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            .product-detail {
              font-size: 24rpx;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
          
          .order-amount {
            font-size: 28rpx;
            color: #ff6b6b;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .order-status {
            font-size: 24rpx;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
      
      .no-order {
        text-align: center;
        padding: 30rpx;
        color: #999;
        font-size: 28rpx;
        white-space: nowrap;
      }
    }
  }
}
</style> 
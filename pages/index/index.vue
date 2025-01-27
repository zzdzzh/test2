<template>
	<view class="container">
		
		<view class="intro">本项目已包含uni ui组件，无需import和注册，可直接使用。在代码区键入字母u，即可通过代码助手列出所有可用组件。光标置于组件名称处按F1，即可查看组件文档。</view>
		<text class="intro">详见：</text>
		<uni-link :href="href" :text="href"></uni-link>
		
		<navigator url="/pages/customer-service/index" class="customer-service-link">
			<uni-icons type="headphones" size="20"></uni-icons>
			<text>联系客服</text>
		</navigator>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				href: 'https://uniapp.dcloud.io/component/README?id=uniui'
			}
		},
		onLoad() {
			console.log('页面加载 onLoad')
			this.autoLogin()
			this.loginWithoutCode()
		},
		methods: {
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
			
			// 新增登录函数
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
			
			// 新增选择组织函数
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
			}
		}
	}
</script>

<style>
	.container {
		padding: 20px;
		font-size: 14px;
		line-height: 24px;
	}
	
	.customer-service-link {
		margin-top: 30rpx;
		padding: 20rpx 40rpx;
		background-color: #4e6ef2;
		color: #fff;
		border-radius: 8rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		
		text {
			margin-left: 10rpx;
		}
	}
</style>

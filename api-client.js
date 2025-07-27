/**
 * API客户端 - 与MySQL后端服务器通信
 * 替换原有的本地存储逻辑
 */

class VoteAPIClient {
    constructor(baseURL = '') {
        // 使用相对路径，因为前端和API都在同一个3000端口
        this.baseURL = baseURL || '';
        this.isServerMode = true; // 标识当前使用服务器模式
    }
    
    // 测试服务器连接
    async testConnection() {
        try {
            const response = await fetch(`${this.baseURL}/api/test`);
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('✅ 服务器连接正常:', result.message);
                return true;
            } else {
                console.error('❌ 服务器连接失败:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ 无法连接到服务器:', error.message);
            return false;
        }
    }
    
    // 提交投票
    async submitVote(username, selectedOptions) {
        try {
            const response = await fetch(`${this.baseURL}/api/votes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username.trim(),
                    selectedOptions: selectedOptions
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '提交失败');
            }
            
            console.log('✅ 投票提交成功:', result.message);
            return result;
        } catch (error) {
            console.error('❌ 提交投票失败:', error.message);
            throw error;
        }
    }
    
    // 检查用户是否已投票
    async checkUserVoted(username) {
        try {
            const response = await fetch(`${this.baseURL}/api/votes/check/${encodeURIComponent(username)}`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '检查失败');
            }
            
            return result;
        } catch (error) {
            console.error('❌ 检查用户投票状态失败:', error.message);
            throw error;
        }
    }
    
    // 获取投票选项
    async getOptions() {
        try {
            const response = await fetch(`${this.baseURL}/api/options`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '获取投票选项失败');
            }
            
            return result.options || [];
        } catch (error) {
            console.error('❌ 获取投票选项失败:', error.message);
            throw error;
        }
    }
    
    // 获取统计数据
    async getStatistics() {
        try {
            const response = await fetch(`${this.baseURL}/api/statistics`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '获取统计失败');
            }
            
            return result;
        } catch (error) {
            console.error('❌ 获取统计失败:', error.message);
            throw error;
        }
    }
    
    // 获取所有投票记录（管理员）
    async getAllVotes() {
        try {
            const response = await fetch(`${this.baseURL}/api/votes`);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '获取投票记录失败');
            }
            
            return result.votes || [];
        } catch (error) {
            console.error('❌ 获取投票记录失败:', error.message);
            throw error;
        }
    }
    
    // 删除投票记录（管理员）
    async deleteVote(voteId) {
        try {
            const response = await fetch(`${this.baseURL}/api/votes/${voteId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '删除失败');
            }
            
            console.log('✅ 投票记录删除成功');
            return result;
        } catch (error) {
            console.error('❌ 删除投票记录失败:', error.message);
            throw error;
        }
    }
    
    // 更新投票记录（管理员）
    async updateVote(updateData) {
        try {
            const response = await fetch(`${this.baseURL}/api/votes/${updateData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '更新失败');
            }
            
            console.log('✅ 投票记录更新成功');
            return result;
        } catch (error) {
            console.error('❌ 更新投票记录失败:', error.message);
            throw error;
        }
    }
    
    // 数据备份
    async downloadBackup() {
        try {
            const response = await fetch(`${this.baseURL}/api/backup`);
            
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || '备份失败');
            }
            
            // 获取文件名
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'backup.json';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            // 下载文件
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('✅ 数据备份下载成功');
            return true;
        } catch (error) {
            console.error('❌ 数据备份失败:', error.message);
            throw error;
        }
    }
    
    // 兼容性方法 - 模拟原有的数据管理器接口
    async hasUserSubmitted(username) {
        try {
            const result = await this.checkUserVoted(username);
            return result.hasVoted;
        } catch (error) {
            console.warn('检查用户提交状态时出错，假设未提交:', error.message);
            return false;
        }
    }
    
    async getUserByUsername(username) {
        try {
            const result = await this.checkUserVoted(username);
            if (result.hasVoted) {
                return {
                    id: result.vote.id,
                    username: result.vote.username,
                    submissionData: result.vote.selectedOptions,
                    submissionTime: result.vote.submitTime
                };
            }
            return null;
        } catch (error) {
            console.warn('获取用户信息时出错:', error.message);
            return null;
        }
    }
    
    async addUser(username, selectedOptions) {
        return await this.submitVote(username, selectedOptions);
    }
    
    async deleteUser(userId) {
        return await this.deleteVote(userId);
    }
    
    async getAllUsers() {
        try {
            const result = await this.getAllVotes();
            return result.votes.map(vote => ({
                id: vote.id,
                username: vote.username,
                submissionData: vote.selectedOptions,
                submissionTime: vote.submitTime
            }));
        } catch (error) {
            console.warn('获取所有用户时出错:', error.message);
            return [];
        }
    }
    
    // 初始化方法（兼容性）
    async init() {
        console.log('🔄 初始化API客户端...');
        const isConnected = await this.testConnection();
        if (isConnected) {
            console.log('✅ API客户端初始化成功');
        } else {
            console.warn('⚠️ API客户端初始化失败，可能需要启动后端服务器');
        }
        return isConnected;
    }
    
    // 显示连接状态
    showConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="connection-info">
                    <span class="status-indicator ${this.isServerMode ? 'server' : 'local'}"></span>
                    <span class="status-text">
                        ${this.isServerMode ? '🌐 服务器模式 (MySQL数据库)' : '💾 本地模式 (浏览器存储)'}
                    </span>
                </div>
            `;
        }
    }
}

// 创建全局API客户端实例
const voteAPI = new VoteAPIClient();

// 兼容性：创建数据管理器别名（如果不存在的话）
if (typeof dataManager === 'undefined') {
    window.dataManager = voteAPI;
}

// 导出API客户端
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoteAPIClient;
}

// 在页面加载时显示连接状态
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        voteAPI.showConnectionStatus();
    });
}

console.log('📡 API客户端已加载');
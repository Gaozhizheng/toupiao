document.addEventListener('DOMContentLoaded', async function() {
    // 获取DOM元素
    const totalCountElement = document.getElementById('total-count');
    const tableBodyElement = document.getElementById('table-body');
    const historyListElement = document.getElementById('history-list');
    const refreshBtn = document.getElementById('refresh-btn');
    
    // 调试信息
    console.log('DOM元素检查:', {
        totalCountElement: !!totalCountElement,
        tableBodyElement: !!tableBodyElement,
        historyListElement: !!historyListElement,
        refreshBtn: !!refreshBtn
    });
    
    // 图表相关变量
    let voteChart = null;
    
    // 等待API客户端初始化
    let apiReady = false;
    if (typeof voteAPI !== 'undefined') {
        console.log('🔄 初始化API客户端...');
        apiReady = await voteAPI.init();
        if (apiReady) {
            console.log('✅ API客户端初始化成功，使用MySQL数据库');
        } else {
            console.error('❌ API客户端初始化失败');
        }
    } else {
        console.error('❌ API客户端未加载');
    }
    
    // 初始加载数据
    if (apiReady) {
        loadAndDisplayData().catch(error => {
            console.error('初始化数据失败:', error);
            showNotification('数据加载失败: ' + error.message, 'error');
        });
    } else {
        showNotification('无法连接到数据库，请检查服务器状态', 'error');
    }
    
    // 刷新按钮事件
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            if (apiReady) {
                await loadAndDisplayData();
                showNotification('数据已刷新');
            } else {
                showNotification('无法刷新数据，请检查服务器连接', 'error');
            }
        });
    }
    
    // 加载并显示数据的主函数
    async function loadAndDisplayData() {
        try {
            // 获取统计数据
            const statisticsData = await voteAPI.getStatistics();
            
            // 获取所有投票记录
            const votesData = await voteAPI.getAllVotes();
            
            // 更新总投票数
            updateTotalCount(statisticsData.totalVotes);
            
            // 更新数据表格
            updateDataTable(statisticsData.optionCounts);
            
            // 更新图表
            updateChart(statisticsData.optionCounts);
            
            // 更新提交历史
            updateSubmissionHistory(votesData);
            
        } catch (error) {
            console.error('加载数据失败:', error);
            throw error;
        }
    }
    
    // 更新总投票数函数
    function updateTotalCount(totalVotes) {
        if (totalCountElement) {
            totalCountElement.textContent = totalVotes || 0;
        }
    }
    
    // 更新数据表格函数
    function updateDataTable(optionCounts) {
        if (!tableBodyElement) return;
        
        // 清空表格
        tableBodyElement.innerHTML = '';
        
        // 计算总票数
        const totalVotes = Object.values(optionCounts).reduce((sum, count) => sum + count, 0);
        
        // 按票数从高到低排序
        const sortedData = Object.entries(optionCounts).sort((a, b) => b[1] - a[1]);
        
        // 填充表格
        sortedData.forEach(([option, count]) => {
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${option}</td>
                <td>${count}</td>
                <td>${percentage}%</td>
            `;
            
            tableBodyElement.appendChild(row);
        });
    }
    
    // 更新图表函数
    function updateChart(optionCounts) {
        // 准备图表数据
        const labels = Object.keys(optionCounts);
        const data = Object.values(optionCounts);
        const backgroundColors = [
            'rgba(255, 0, 80, 0.7)',
            'rgba(255, 51, 112, 0.7)',
            'rgba(255, 102, 145, 0.7)',
            'rgba(255, 153, 178, 0.7)',
            'rgba(255, 204, 211, 0.7)',
            'rgba(255, 102, 102, 0.7)',
            'rgba(255, 51, 51, 0.7)'
        ];
        
        // 获取图表容器
        const ctx = document.getElementById('vote-chart').getContext('2d');
        
        // 如果图表已存在，销毁它
        if (voteChart) {
            voteChart.destroy();
        }
        
        // 创建新图表
        voteChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '票数',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `票数: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 更新提交历史函数
    function updateSubmissionHistory(votes) {
        if (!historyListElement) return;
        
        // 清空历史列表
        historyListElement.innerHTML = '';
        
        // 如果没有历史记录
        if (!votes || votes.length === 0) {
            historyListElement.innerHTML = '<div class="no-data">暂无提交记录</div>';
            return;
        }
        
        // 显示最近的投票记录（已按时间倒序排序）
        const recentVotes = votes.slice(0, 10); // 只显示最近10条
        
        // 填充历史列表
        recentVotes.forEach(vote => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // 创建时间和用户信息元素
            const infoElement = document.createElement('div');
            infoElement.className = 'history-info';
            
            // 用户名元素
            const usernameElement = document.createElement('span');
            usernameElement.className = 'history-username';
            usernameElement.textContent = vote.username || '匿名用户';
            
            // 时间元素
            const timeElement = document.createElement('span');
            timeElement.className = 'history-time';
            
            // 格式化时间
            const formatTime = (timeStr) => {
                try {
                    const date = new Date(timeStr);
                    if (isNaN(date.getTime())) {
                        return timeStr;
                    }
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                } catch (error) {
                    return timeStr;
                }
            };
            timeElement.textContent = formatTime(vote.submitTime);
            
            // 添加用户名和时间到信息元素
            infoElement.appendChild(usernameElement);
            infoElement.appendChild(document.createTextNode(' · '));
            infoElement.appendChild(timeElement);
            
            // 创建选项元素
            const optionsElement = document.createElement('div');
            optionsElement.className = 'history-options';
            
            if (vote.selectedOptions && Array.isArray(vote.selectedOptions)) {
                vote.selectedOptions.forEach(option => {
                    const optionTag = document.createElement('span');
                    optionTag.className = 'history-option';
                    optionTag.textContent = option;
                    optionsElement.appendChild(optionTag);
                });
            }
            
            // 添加到历史项
            historyItem.appendChild(infoElement);
            historyItem.appendChild(optionsElement);
            
            // 添加到历史列表
            historyListElement.appendChild(historyItem);
        });
    }
    
    // 显示通知函数
    function showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 自动隐藏通知
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
});
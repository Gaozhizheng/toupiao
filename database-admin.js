// 数据库管理页面JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    let voteAPI = null;
    
    // 初始化页面
    await initializePage();
    
    // 初始化页面函数
    async function initializePage() {
        try {
            // 初始化API客户端
            voteAPI = {
                async getAllVotes() {
                    const response = await fetch('/api/votes');
                    if (!response.ok) {
                        throw new Error('获取投票数据失败');
                    }
                    const data = await response.json();
                    return data.votes || [];
                },
                
                async deleteVote(id) {
                    const response = await fetch(`/api/votes/${id}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) {
                        throw new Error('删除投票失败');
                    }
                    return await response.json();
                },
                
                async updateVote(updateData) {
                    const response = await fetch(`/api/votes/${updateData.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateData)
                    });
                    if (!response.ok) {
                        throw new Error('更新投票失败');
                    }
                    return await response.json();
                },
                
                async getOptions() {
                    const response = await fetch('/api/options');
                    if (!response.ok) {
                        throw new Error('获取投票选项失败');
                    }
                    const data = await response.json();
                    return data.options || [];
                },
                
                async testConnection() {
                    try {
                        const response = await fetch('/api/test');
                        return response.ok;
                    } catch (error) {
                        return false;
                    }
                }
            };
            
            // 测试连接
            const isConnected = await voteAPI.testConnection();
            if (!isConnected) {
                throw new Error('无法连接到数据库服务器');
            }
            
            // 绑定事件监听器
            bindEventListeners();
            
            // 自动加载数据
            loadAllData();
            
            showNotification('数据库连接成功', 'success');
            
        } catch (error) {
            console.error('页面初始化失败:', error);
            showNotification('页面初始化失败: ' + error.message, 'error');
        }
    }
    
    // 更新统计信息
    function updateStatistics(votes) {
        const totalUsersElement = document.getElementById('total-users');
        const totalRecordsElement = document.getElementById('total-records');
        
        if (totalUsersElement) {
            // 按用户名去重计算总用户数
            const uniqueUsers = votes ? [...new Set(votes.map(vote => vote.username))].length : 0;
            totalUsersElement.textContent = uniqueUsers;
        }
        
        if (totalRecordsElement) {
            // 总记录数保持原有逻辑（不去重）
            totalRecordsElement.textContent = votes ? votes.length : 0;
        }
    }
    
    // 删除所有数据
    async function clearAllData() {
        if (!confirm('警告：此操作将删除所有用户数据，且无法恢复！\n\n确定要继续吗？')) {
            return;
        }
        
        if (!confirm('请再次确认：您确定要删除所有数据吗？')) {
            return;
        }
        
        try {
            if (!voteAPI) {
                throw new Error('API客户端未初始化');
            }
            
            // 获取所有投票记录并删除
            const votes = await voteAPI.getAllVotes();
            for (const vote of votes) {
                await voteAPI.deleteVote(vote.id);
            }
            
            showNotification('所有数据已成功删除', 'success');
            
            // 重新加载数据
            loadAllData();
        } catch (error) {
            console.error('删除所有数据失败:', error);
            showNotification('删除所有数据失败: ' + error.message, 'error');
        }
    }
    
    // 绑定事件监听器
    function bindEventListeners() {
        // 备份数据按钮
        const backupBtn = document.getElementById('backup-data-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', backupData);
        }
        
        // 恢复数据文件选择事件
        const restoreFile = document.getElementById('restore-file-input');
        if (restoreFile) {
            restoreFile.addEventListener('change', restoreData);
        }
        
        // 迁移数据按钮
        const migrateBtn = document.getElementById('migrate-legacy-btn');
        if (migrateBtn) {
            migrateBtn.addEventListener('click', migrateData);
        }
        
        // 加载数据按钮
        const loadDataBtn = document.getElementById('load-data-btn');
        if (loadDataBtn) {
            loadDataBtn.addEventListener('click', loadAllData);
        }
        
        // 搜索数据按钮
        const searchBtn = document.getElementById('search-data-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', toggleSearchSection);
        }
        
        // 执行搜索按钮
        const searchExecuteBtn = document.getElementById('search-execute-btn');
        if (searchExecuteBtn) {
            searchExecuteBtn.addEventListener('click', executeSearch);
        }
        
        // 搜索输入框回车事件
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    executeSearch();
                }
            });
        }
        
        // 删除所有数据按钮
        const clearAllDataBtn = document.getElementById('clear-all-data-btn');
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', clearAllData);
        }
    }
    
    // 备份数据
    async function backupData() {
        try {
            if (!voteAPI) {
                throw new Error('API客户端未初始化');
            }
            
            const votes = await voteAPI.getAllVotes();
            
            // 转换为CSV格式 - 包含所有数据库字段
            const csvHeader = 'ID,用户名,投票选项,提交时间,IP地址,用户代理,是否删除,创建时间,更新时间\n';
            const csvData = votes.map(vote => {
                const options = Array.isArray(vote.selectedOptions) ? vote.selectedOptions.join(';') : vote.selectedOptions;
                return `${vote.id},"${vote.username}","${options}","${vote.submitTime}","${vote.ipAddress || ''}","${vote.userAgent || ''}",${vote.isDeleted || 0},"${vote.createTime || vote.submitTime}","${vote.updateTime || vote.submitTime}"`;
            }).join('\n');
            
            const csvContent = csvHeader + csvData;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.href = URL.createObjectURL(blob);
            link.download = `database_backup_${timestamp}.csv`;
            link.click();
            
            showNotification('数据备份成功', 'success');
        } catch (error) {
            console.error('备份数据失败:', error);
            showNotification('备份数据失败: ' + error.message, 'error');
        }
    }
    
    // 恢复数据
    async function restoreData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // 检查文件类型
            if (!file.name.endsWith('.json') && !file.name.endsWith('.csv')) {
                showNotification('请选择JSON或CSV格式的备份文件', 'error');
                event.target.value = '';
                return;
            }
            
            // 确认操作
            if (!confirm('警告：此操作将清空现有数据并恢复备份数据，且无法撤销！\n\n确定要继续吗？')) {
                event.target.value = '';
                return;
            }
            
            showNotification('正在读取备份文件...', 'info');
            
            const fileContent = await readFileContent(file);
            let backupData;
            
            if (file.name.endsWith('.json')) {
                // 处理JSON格式
                try {
                    backupData = JSON.parse(fileContent);
                } catch (e) {
                    throw new Error('JSON文件格式错误');
                }
                
                // 验证备份数据格式
                if (!backupData.votes || !Array.isArray(backupData.votes)) {
                    throw new Error('备份文件格式不正确，缺少votes数据');
                }
                
            } else if (file.name.endsWith('.csv')) {
                // 处理CSV格式
                backupData = parseCSVData(fileContent);
            }
            
            showNotification('正在恢复数据...', 'info');
            
            // 调用恢复API
            const response = await fetch('/api/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ votes: backupData.votes })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || '恢复失败');
            }
            
            showNotification(result.message || '数据恢复成功', 'success');
            
            // 重新加载数据
            loadAllData();
            
        } catch (error) {
            console.error('恢复数据失败:', error);
            showNotification('恢复数据失败: ' + error.message, 'error');
        }
        
        // 清除文件选择
        event.target.value = '';
    }
    
    // 读取文件内容
    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'utf-8');
        });
    }
    
    // 解析CSV数据
    function parseCSVData(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV文件格式错误');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const votes = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length >= 4) {
                // 处理投票选项字段，将分号或逗号分隔的选项转换为JSON数组格式
                let selectedOptions = values[2] || '';
                if (selectedOptions && !selectedOptions.startsWith('[')) {
                    // 如果不是JSON格式，智能判断是否需要分割
                    let optionsArray;
                    
                    // 优先按分号分割，因为分号通常用作选项分隔符
                    if (selectedOptions.includes(';')) {
                        optionsArray = selectedOptions.split(';').map(opt => opt.trim()).filter(opt => opt);
                    } 
                    // 如果包含英文逗号且不在引号或括号内，则按英文逗号分割
                    else if (selectedOptions.includes(',') && !selectedOptions.match(/[【】「」『』\[\]\(\)]/)) {
                        optionsArray = selectedOptions.split(',').map(opt => opt.trim()).filter(opt => opt);
                    }
                    // 否则作为单个选项处理
                    else {
                        optionsArray = [selectedOptions.trim()];
                    }
                    
                    selectedOptions = JSON.stringify(optionsArray);
                }
                
                votes.push({
                    id: parseInt(values[0]) || i,
                    username: values[1] || '',
                    selected_options: selectedOptions,
                    submit_time: values[3] || new Date().toISOString(),
                    ip_address: values[4] || '',
                    user_agent: values[5] || null,
                    is_deleted: parseInt(values[6]) || 0,
                    create_time: values[7] || values[3] || new Date().toISOString(),
                    update_time: values[8] || values[3] || new Date().toISOString()
                });
            }
        }
        
        return { votes };
    }
    
    // 解析CSV行（处理引号内的逗号和特殊字符）
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim().replace(/^"|"$/g, ''));
        
        // 如果解析结果少于预期列数，尝试用制表符分割
        if (result.length < 4 && line.includes('\t')) {
            return line.split('\t').map(cell => cell.trim().replace(/^"|"$/g, ''));
        }
        
        return result;
    }
    
    // 迁移数据
    async function migrateData() {
        try {
            showNotification('数据迁移功能暂不支持', 'warning');
        } catch (error) {
            console.error('迁移数据失败:', error);
            showNotification('迁移数据失败: ' + error.message, 'error');
        }
    }
    
    // 测试连接
    async function testConnection() {
        try {
            if (!voteAPI) {
                throw new Error('API客户端未初始化');
            }
            
            const isConnected = await voteAPI.testConnection();
            if (isConnected) {
                showNotification('数据库连接正常', 'success');
            } else {
                showNotification('数据库连接失败', 'error');
            }
        } catch (error) {
            console.error('测试连接失败:', error);
            showNotification('数据库连接失败: ' + error.message, 'error');
        }
    }
    
    // 加载所有数据
    async function loadAllData() {
        try {
            if (!voteAPI) {
                throw new Error('API客户端未初始化');
            }
            
            // 显示加载状态
            const dataLoading = document.getElementById('data-loading');
            if (dataLoading) dataLoading.style.display = 'block';
            
            const votes = await voteAPI.getAllVotes();
            displayDataTable(votes);
            
            showNotification(`已加载 ${votes.length} 条数据`, 'success');
        } catch (error) {
            console.error('加载数据失败:', error);
            showNotification('加载数据失败: ' + error.message, 'error');
            
            // 隐藏加载状态
            const dataLoading = document.getElementById('data-loading');
            if (dataLoading) dataLoading.style.display = 'none';
        }
    }
    
    // 切换搜索区域显示
    function toggleSearchSection() {
        const searchSection = document.getElementById('search-section');
        if (searchSection) {
            searchSection.style.display = searchSection.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // 执行搜索
    async function executeSearch() {
        try {
            const searchInput = document.getElementById('search-input');
            const searchTerm = searchInput ? searchInput.value.trim() : '';
            
            if (!searchTerm) {
                showNotification('请输入搜索关键词', 'warning');
                return;
            }
            
            // 显示加载状态
            const dataLoading = document.getElementById('data-loading');
            if (dataLoading) dataLoading.style.display = 'block';
            
            const allVotes = await voteAPI.getAllVotes();
            const filteredVotes = allVotes.filter(vote => {
                return vote.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (vote.selectedOptions && vote.selectedOptions.toString().toLowerCase().includes(searchTerm.toLowerCase()));
            });
            
            displayDataTable(filteredVotes);
            showNotification(`找到 ${filteredVotes.length} 条匹配数据`, 'info');
        } catch (error) {
            console.error('搜索数据失败:', error);
            showNotification('搜索数据失败: ' + error.message, 'error');
        }
    }
    
    // 显示数据表格
    function displayDataTable(votes) {
        // 隐藏加载指示器
        const dataLoading = document.getElementById('data-loading');
        if (dataLoading) dataLoading.style.display = 'none';
        
        const tableContainer = document.getElementById('data-table-container');
        const dataTable = document.getElementById('data-table');
        const noData = document.getElementById('no-data');
        const tableBody = document.getElementById('data-table-body');
        
        // 更新统计信息
        updateStatistics(votes);
        
        // 显示表格容器
        if (tableContainer) tableContainer.style.display = 'block';
        
        if (!votes || votes.length === 0) {
            if (dataTable) dataTable.style.display = 'none';
            if (noData) noData.style.display = 'block';
            return;
        }
        
        // 显示表格，隐藏无数据提示
        if (dataTable) dataTable.style.display = 'block';
        if (noData) noData.style.display = 'none';
        
        if (!tableBody) return;
        
        // 清空表格内容
        tableBody.innerHTML = '';
        
        // 按提交时间倒序排序
        votes.sort((a, b) => {
            const timeA = new Date(a.submitTime || 0);
            const timeB = new Date(b.submitTime || 0);
            return timeB - timeA;
        });
        
        votes.forEach(vote => {
            const row = document.createElement('tr');
            row.dataset.voteId = vote.id; // 添加data属性存储voteId
            

            
            // 用户名
            const usernameCell = document.createElement('td');
            usernameCell.className = 'username-cell';
            usernameCell.textContent = vote.username || '-';
            row.appendChild(usernameCell);
            
            // 投票选项
            const optionsCell = document.createElement('td');
            let voteContent = '<div class="vote-data-empty">无投票数据</div>';
            
            if (vote.selectedOptions) {
                let options = [];
                
                if (Array.isArray(vote.selectedOptions)) {
                    options = vote.selectedOptions;
                } else if (typeof vote.selectedOptions === 'string') {
                    try {
                        const parsed = JSON.parse(vote.selectedOptions);
                        options = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        options = [vote.selectedOptions];
                    }
                } else {
                    options = [vote.selectedOptions];
                }
                
                if (options.length > 0) {
                    const optionsList = options.map((option, index) => {
                        return `<div class="vote-option-item">
                            <span class="option-number">${index + 1}.</span>
                            <span class="option-text">${option}</span>
                        </div>`;
                    }).join('');
                    
                    voteContent = `
                        <div class="vote-data-container">
                            <div class="vote-summary">共选择 ${options.length} 项</div>
                            <div class="vote-options-list">${optionsList}</div>
                        </div>
                    `;
                }
            }
            
            optionsCell.innerHTML = voteContent;
            row.appendChild(optionsCell);
            
            // 状态
            const statusCell = document.createElement('td');
            statusCell.className = 'status-cell';
            statusCell.innerHTML = '<span style="color: #27ae60; font-weight: bold;">正常</span>';
            row.appendChild(statusCell);
            
            // 提交时间
            const timeCell = document.createElement('td');
            timeCell.className = 'timestamp-cell';
            const timeValue = vote.submitTime ? new Date(vote.submitTime).toLocaleString() : '-';
            timeCell.textContent = timeValue;
            row.appendChild(timeCell);
            
            // 操作
            const actionCell = document.createElement('td');
            const actionButtons = document.createElement('div');
            actionButtons.className = 'action-buttons';
            
            // 编辑按钮
            const editBtn = document.createElement('button');
            editBtn.textContent = '编辑';
            editBtn.className = 'action-btn btn-edit';
            editBtn.onclick = () => editVote(editBtn, vote.id);
            
            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.className = 'action-btn btn-delete';
            deleteBtn.onclick = () => deleteVote(vote.id);
            
            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);
            actionCell.appendChild(actionButtons);
            row.appendChild(actionCell);
            
            tableBody.appendChild(row);
        });
    }
    
    // 创建选项编辑项
    function createOptionEditItem(optionText, optionsList) {
        const optionItem = document.createElement('div');
        optionItem.className = 'option-edit-item';
        
        const optionInput = document.createElement('input');
        optionInput.type = 'text';
        optionInput.className = 'option-input';
        optionInput.value = optionText;
        optionInput.placeholder = '请输入选项内容';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'option-delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = () => {
            if (optionsList.children.length > 1) {
                optionItem.remove();
            } else {
                showNotification('至少需要保留一个选项', 'warning');
            }
        };
        
        optionItem.appendChild(optionInput);
        optionItem.appendChild(deleteBtn);
        
        return optionItem;
    }
    
    // 编辑投票记录
    async function editVote(button, voteId) {
        const row = button.closest('tr');
        // 检查是否已经在编辑模式
        if (row.classList.contains('editing')) {
            return;
        }
        
        // 添加编辑模式类
        row.classList.add('editing');
        
        // 获取当前数据
        const cells = row.cells;
        const usernameCell = cells[0];
        const optionsCell = cells[1];
        const statusCell = cells[2];
        const timeCell = cells[3];
        const actionCell = cells[4];
        
        // 保存原始内容
        const originalUsername = usernameCell.textContent;
        const originalOptions = optionsCell.innerHTML;
        const originalStatus = statusCell.innerHTML;
        const originalTime = timeCell.textContent;
        
        // 创建编辑输入框
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.value = originalUsername;
        usernameInput.className = 'edit-input';
        
        // 创建投票选项编辑器
        const optionsEditor = document.createElement('div');
        optionsEditor.className = 'vote-options-editor';
        
        // 从当前选项中提取文本
        const optionElements = optionsCell.querySelectorAll('.option-text');
        const currentOptions = Array.from(optionElements).map(el => el.textContent);
        
        // 获取系统中所有可用的投票选项
        try {
            const availableOptions = await voteAPI.getOptions();
            
            if (availableOptions && availableOptions.length > 0) {
                // 创建选项选择器
                const optionsList = document.createElement('div');
                optionsList.className = 'options-selection-list';
                
                availableOptions.forEach((option, index) => {
                    const optionItem = document.createElement('div');
                    optionItem.className = 'option-selection-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `edit-option-${index}`;
                    checkbox.value = option.text;
                    checkbox.className = 'option-checkbox';
                    
                    // 检查当前选项是否已被选中
                    if (currentOptions.includes(option.text)) {
                        checkbox.checked = true;
                    }
                    
                    const label = document.createElement('label');
                    label.setAttribute('for', `edit-option-${index}`);
                    label.textContent = option.text;
                    label.className = 'option-label';
                    
                    optionItem.appendChild(checkbox);
                    optionItem.appendChild(label);
                    optionsList.appendChild(optionItem);
                });
                
                optionsEditor.appendChild(optionsList);
            } else {
                // 如果没有可用选项，显示提示信息
                const noOptionsMsg = document.createElement('div');
                noOptionsMsg.className = 'no-options-message';
                noOptionsMsg.textContent = '暂无可用的投票选项';
                noOptionsMsg.style.cssText = 'padding: 10px; color: #6c757d; text-align: center; border: 1px dashed #dee2e6; border-radius: 4px;';
                optionsEditor.appendChild(noOptionsMsg);
            }
        } catch (error) {
            console.error('获取投票选项失败:', error);
            // 如果获取选项失败，显示错误信息
            const errorMsg = document.createElement('div');
            errorMsg.className = 'options-error-message';
            errorMsg.textContent = '获取投票选项失败，请刷新页面重试';
            errorMsg.style.cssText = 'padding: 10px; color: #dc3545; text-align: center; border: 1px solid #dc3545; border-radius: 4px; background: #f8d7da;';
            optionsEditor.appendChild(errorMsg);
        }
        
        // 创建状态显示框（只读）
        const statusDisplay = document.createElement('div');
        statusDisplay.className = 'readonly-field';
        statusDisplay.innerHTML = originalStatus;
        statusDisplay.style.cssText = 'padding: 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; color: #6c757d;';
        
        // 创建时间显示框（只读）
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'readonly-field';
        timeDisplay.textContent = originalTime;
        timeDisplay.style.cssText = 'padding: 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; color: #6c757d;';
        
        // 替换内容
        usernameCell.innerHTML = '';
        usernameCell.appendChild(usernameInput);
        optionsCell.innerHTML = '';
        optionsCell.appendChild(optionsEditor);
        statusCell.innerHTML = '';
        statusCell.appendChild(statusDisplay);
        timeCell.innerHTML = '';
        timeCell.appendChild(timeDisplay);
        
        // 创建保存和取消按钮
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.className = 'action-btn btn-save';
        saveBtn.style.background = 'linear-gradient(135deg, #00b894 0%, #00a085 100%)';
        saveBtn.style.color = 'white';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'action-btn btn-cancel';
        cancelBtn.style.background = 'linear-gradient(135deg, #636e72 0%, #2d3436 100%)';
        cancelBtn.style.color = 'white';
        
        // 保存功能
          saveBtn.onclick = async () => {
              try {
                  const newUsername = usernameInput.value.trim();
                  
                  if (!newUsername) {
                      showNotification('用户名不能为空', 'error');
                      return;
                  }
                  
                  // 获取所有选中的选项
                  const selectedCheckboxes = optionsEditor.querySelectorAll('.option-checkbox:checked');
                  const newOptions = Array.from(selectedCheckboxes)
                      .map(checkbox => checkbox.value)
                      .filter(option => option && option.length > 0);
                  
                  if (newOptions.length === 0) {
                      showNotification('至少需要一个投票选项', 'error');
                      return;
                  }
                  
                  // 验证选项数据是否可以正确序列化
                  try {
                      JSON.stringify(newOptions);
                  } catch (e) {
                      showNotification('投票选项包含无效字符', 'error');
                      return;
                  }
                  
                  // 调用更新API（不更新状态和提交时间）
                  const updateData = {
                      id: voteId,
                      username: newUsername,
                      selectedOptions: JSON.stringify(newOptions)
                      // 注意：状态和提交时间字段不允许编辑
                  };
                  
                  await voteAPI.updateVote(updateData);
                  showNotification('数据更新成功', 'success');
                  
                  // 重新加载数据
                  loadAllData();
                  
              } catch (error) {
                  console.error('保存失败:', error);
                  showNotification('保存失败: ' + error.message, 'error');
              }
          };
        
        // 取消功能
        cancelBtn.onclick = () => {
            exitEditMode(row, originalUsername, originalOptions, originalStatus, originalTime);
        };
        
        // 替换操作按钮
        const actionButtons = actionCell.querySelector('.action-buttons');
        actionButtons.innerHTML = '';
        actionButtons.appendChild(saveBtn);
        actionButtons.appendChild(cancelBtn);
        
        // 聚焦到用户名输入框
        usernameInput.focus();
    }
    
    // 退出编辑模式
    function exitEditMode(row, originalUsername, originalOptions, originalStatus, originalTime) {
        row.classList.remove('editing');
        
        const cells = row.querySelectorAll('td');
        const usernameCell = cells[0];
        const optionsCell = cells[1];
        const statusCell = cells[2];
        const timeCell = cells[3];
        const actionCell = cells[4];
        
        // 恢复原始内容
        usernameCell.textContent = originalUsername;
        optionsCell.innerHTML = originalOptions;
        statusCell.innerHTML = originalStatus;
        timeCell.textContent = originalTime;
        
        // 恢复操作按钮
        const actionButtons = actionCell.querySelector('.action-buttons');
        actionButtons.innerHTML = '';
        
        // 重新创建编辑和删除按钮
        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.className = 'action-btn btn-edit';
        editBtn.onclick = () => editVote(editBtn, row.dataset.voteId);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.onclick = () => deleteVote(row.dataset.voteId);
        
        actionButtons.appendChild(editBtn);
        actionButtons.appendChild(deleteBtn);
    }
    
    // 删除投票记录
    async function deleteVote(voteId) {
        if (!confirm('确定要删除这条数据吗？')) {
            return;
        }
        
        try {
            if (!voteAPI) {
                throw new Error('API客户端未初始化');
            }
            
            await voteAPI.deleteVote(voteId);
            showNotification('数据删除成功', 'success');
            
            // 重新加载数据
            loadAllData();
        } catch (error) {
            console.error('删除数据失败:', error);
            showNotification('删除数据失败: ' + error.message, 'error');
        }
    }
    
    // 显示通知
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 根据类型设置背景色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#27ae60';
                break;
            case 'error':
                notification.style.backgroundColor = '#e74c3c';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f39c12';
                break;
            default:
                notification.style.backgroundColor = '#3498db';
        }
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
});
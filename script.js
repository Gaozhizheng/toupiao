// 全局变量
let dataManager;
let isUsingAPI = false;

// 加载投票选项函数
async function loadVoteOptions() {
    try {
        // 获取投票选项
        const options = await dataManager.getOptions();
        
        if (!options || options.length === 0) {
            console.warn('未获取到投票选项，使用默认选项');
            return;
        }
        
        // 获取选项容器
        const form = document.getElementById('survey-form');
        const buttonGroup = document.querySelector('.button-group');
        
        // 移除现有的选项
        const existingOptions = form.querySelectorAll('.option');
        existingOptions.forEach(option => option.remove());
        
        // 动态创建选项
        options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `option${index + 1}`;
            checkbox.name = 'difficulty';
            checkbox.value = option.text;
            
            const label = document.createElement('label');
            label.setAttribute('for', `option${index + 1}`);
            label.textContent = option.text;
            
            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            
            // 在按钮组之前插入选项
            form.insertBefore(optionDiv, buttonGroup);
        });
        
        console.log(`✅ 成功加载 ${options.length} 个投票选项`);
        
    } catch (error) {
        console.error('❌ 加载投票选项失败:', error);
        console.warn('将使用HTML中的默认选项');
    }
}

// 生成随机用户名函数
async function generateRandomUsername() {
    // 生成随机字母数字组合
    function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // 生成6-10位的随机字符串
    const randomLength = Math.floor(Math.random() * 5) + 6; // 6到10之间的随机数
    const randomString = generateRandomString(randomLength);
    
    // 组合成完整用户名：用户+随机字符串
    let randomUsername = '用户' + randomString;
    
    // 检查dataManager是否已初始化并且有hasUserSubmitted方法
    if (dataManager && typeof dataManager.hasUserSubmitted === 'function') {
        try {
            const isUsernameExists = await dataManager.hasUserSubmitted(randomUsername);
            
            if (isUsernameExists) {
                // 如果用户名已存在，递归调用自己重新生成
                return await generateRandomUsername();
            }
        } catch (error) {
            console.warn('检查用户名时网络异常，使用当前生成的用户名:', error);
        }
    }
    
    // 设置随机用户名到输入框
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.value = randomUsername;
    }
    return randomUsername;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 使用API客户端（服务器模式）
        if (typeof voteAPI !== 'undefined') {
            console.log('🔄 尝试连接MySQL服务器...');
            const isServerConnected = await voteAPI.init();
            
            if (isServerConnected) {
                dataManager = voteAPI;
                isUsingAPI = true;
                console.log('✅ 使用服务器模式 (MySQL数据库)');
            } else {
                console.error('❌ 服务器连接失败，无法使用本地存储模式');
                alert('系统错误：无法连接到数据库，请刷新页面重试');
                throw new Error('服务器连接失败');
            }
        } else {
            console.error('❌ API客户端未加载，无法连接到数据库');
            alert('系统错误：无法连接到数据库，请刷新页面重试');
            throw new Error('API客户端未定义');
        }
    } catch (error) {
        console.error('❌ 初始化出错:', error);
        alert('系统初始化失败，请刷新页面重试');
        return;
    }
    
    // 修改用户名按钮功能相关变量声明（需要在函数调用前声明）
    let isEditing = false;
    let originalUsername = '';
    
    const surveyForm = document.getElementById('survey-form');
    const resultsDiv = document.getElementById('results');
    const resultBars = document.querySelector('.result-bars');
    const submitBtn = document.getElementById('submit-btn');
    const backBtn = document.getElementById('back-btn');
    const usernameInput = document.getElementById('username');
    
    // 加载投票选项
    await loadVoteOptions();
    
    // 生成随机用户名（对于新用户）
    await generateRandomUsername();
    
    // 检查用户是否已经提交过
    if (await checkIfUserSubmitted()) {
        return; // 如果已提交，直接返回，不执行后续代码
    }
    
    // 检查用户是否已提交函数
    async function checkIfUserSubmitted() {
        // API模式不需要迁移旧数据
        
        // 获取当前用户名（如果有的话）
        const currentUsername = usernameInput.value.trim();
        
        // 如果没有用户名，说明是新用户，不需要检查
        if (!currentUsername) {
            return false;
        }
        
        // 检查dataManager是否已初始化并且有getUserByUsername方法
        if (!dataManager || typeof dataManager.getUserByUsername !== 'function') {
            console.warn('数据管理器未初始化或缺少getUserByUsername方法');
            return false;
        }
        
        try {
            // 检查当前用户是否已经提交过
            const existingUser = await dataManager.getUserByUsername(currentUsername);
        
            if (existingUser) {
                // 当前用户已提交过，显示已提交页面
                const submissionData = {
                    timestamp: existingUser.submissionTime,
                    username: existingUser.username,
                    submissionData: existingUser.submissionData,
                    submissionTime: existingUser.submissionTime
                };
                showAlreadySubmittedPage(submissionData);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('检查用户提交状态时出错:', error);
            return false;
        }
    }
    
    // 显示已提交页面函数
    function showAlreadySubmittedPage(submissionData) {
        // 隐藏表单，显示结果
        surveyForm.classList.add('hidden');
        resultsDiv.classList.remove('hidden');
        
        // 设置用户名输入框为提交时的用户名
        if (usernameInput && submissionData.username) {
            usernameInput.value = submissionData.username;
        }
        
        // 清空结果区域
        resultBars.innerHTML = '';
        
        // 确保返回按钮的事件监听器正常工作
        if (backBtn) {
            // 移除之前的事件监听器（如果有的话）
            backBtn.removeEventListener('click', handleBackButtonClick);
            // 添加新的事件监听器
            backBtn.addEventListener('click', handleBackButtonClick);
        }
        
        // 添加已提交提示信息
        const alreadySubmittedInfo = document.createElement('div');
        alreadySubmittedInfo.className = 'success-info';
        alreadySubmittedInfo.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
        alreadySubmittedInfo.innerHTML = `
            <h3>⚠️ 您已经提交过问卷了</h3>
            <p>感谢您之前的参与，每位用户只能提交一次问卷。</p>
        `;
        resultBars.appendChild(alreadySubmittedInfo);
        
        // 显示之前的提交信息
        const userVoteInfo = document.createElement('div');
        userVoteInfo.className = 'user-vote-info';
        userVoteInfo.innerHTML = `<span>投票用户: <strong>${submissionData.username}</strong></span>`;
        resultBars.appendChild(userVoteInfo);
        
        // 显示提交时间
        const submitTime = document.createElement('div');
        submitTime.className = 'submit-time-info';
        submitTime.innerHTML = `<span>提交时间: <strong>${submissionData.submissionTime}</strong></span>`;
        resultBars.appendChild(submitTime);
        
        // 添加分隔线
        const divider = document.createElement('div');
        divider.className = 'result-divider';
        resultBars.appendChild(divider);
        
        // 显示之前选择的选项
        const userChoicesTitle = document.createElement('h4');
        userChoicesTitle.className = 'user-choices-title';
        userChoicesTitle.textContent = '您之前的选择：';
        resultBars.appendChild(userChoicesTitle);
        
        const userChoicesList = document.createElement('div');
        userChoicesList.className = 'user-choices-list';
        
        if (submissionData.submissionData && Array.isArray(submissionData.submissionData)) {
            submissionData.submissionData.forEach((option, index) => {
                const choiceItem = document.createElement('div');
                choiceItem.className = 'user-choice-item';
                choiceItem.innerHTML = `
                    <span class="choice-number">${index + 1}.</span>
                    <span class="choice-text">${option}</span>
                `;
                userChoicesList.appendChild(choiceItem);
            });
        }
        
        resultBars.appendChild(userChoicesList);
        
        // 添加操作按钮区域
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = `
            display: flex;
            gap: 20px;
            margin: 20px 0;
            justify-content: center;
            flex-wrap: wrap;
            align-items: center;
        `;
        
        // 清除数据重新提交按钮
        const clearDataBtn = document.createElement('button');
        clearDataBtn.style.cssText = `
            background: linear-gradient(45deg, #ff0050, #ff6b8b);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 0, 80, 0.3);
        `;
        clearDataBtn.textContent = '🗑️ 清除数据';
        
        function handleClearDataClick() {
            // 显示警告信息并改变按钮状态
            showClearDataWarning(clearDataBtn, actionButtons, async function() {
                try {
                    // 确认清除的回调函数
                    // 保存当前用户名
                    const currentUsername = usernameInput.value;
                    
                    // 只清除当前用户的数据，而不是所有数据
                    if (currentUsername) {
                        const existingUser = await dataManager.getUserByUsername(currentUsername);
                        if (existingUser) {
                            console.log('找到用户记录，正在删除:', existingUser);
                            await dataManager.deleteUser(existingUser.id);
                            console.log('数据库中的用户记录已删除');
                        } else {
                            console.log('未找到用户记录，可能已被删除或不存在');
                        }
                    } else {
                        throw new Error('用户名为空，无法清除数据');
                    }
                    
                    console.log('当前用户数据永久清除成功');
                    
                    // 不重新加载页面，而是手动重置界面
                    // 隐藏结果页面，显示投票表单
                    resultsDiv.style.opacity = '0';
                    resultsDiv.style.transform = 'translateY(-20px)';
                    
                    setTimeout(() => {
                         resultsDiv.classList.add('hidden');
                         surveyForm.classList.remove('hidden');
                         
                         // 恢复用户名
                         usernameInput.value = currentUsername;
                         
                         // 清除所有选中状态
                         document.querySelectorAll('input[name="difficulty"]:checked').forEach(checkbox => {
                             checkbox.checked = false;
                         });
                         
                         // 重新绑定选项点击事件，解决复选框点击问题
                         bindOptionClickEvents();
                         
                         // 重新绑定修改用户名按钮事件
                         rebindUsernameButtonEvents();
                         
                         // 添加淡入效果
                         setTimeout(() => {
                             surveyForm.style.opacity = '1';
                             surveyForm.style.transform = 'translateY(0)';
                         }, 50);
                     }, 300);
                } catch (error) {
                    console.error('清除数据失败:', error);
                    console.error('错误详情:', {
                        message: error.message,
                        stack: error.stack,
                        currentUsername: currentUsername,
                        dataManagerInitialized: !!dataManager,
                        dataManagerType: 'API'
                    });
                    alert(`清除数据失败：${error.message || '未知错误'}\n请查看控制台获取详细信息`);
                }
            });
        }
        
        clearDataBtn.addEventListener('click', handleClearDataClick);
        
        actionButtons.appendChild(clearDataBtn);
        
        // 返回按钮
        const backButton = document.createElement('button');
        backButton.style.cssText = `
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        `;
        backButton.textContent = '🔙 返回投票页面';
        backButton.addEventListener('click', handleBackButtonClick);
        
        actionButtons.appendChild(backButton);
        resultBars.appendChild(actionButtons);
        
        // 添加提示信息
        const infoMsg = document.createElement('div');
        infoMsg.className = 'thank-you-msg';
        infoMsg.innerHTML = `
            <p>📝 您的问卷已在上述时间提交</p>
            <p>如需重新提交，请点击上方的清除数据按钮。</p>
        `;
        resultBars.appendChild(infoMsg);
        
        // 显示结果页面
        resultsDiv.style.opacity = '1';
        resultsDiv.style.transform = 'translateY(0)';
    }

    
    // 修改用户名按钮功能
    const changeUsernameBtn = document.getElementById('change-username-btn');
    
    if (changeUsernameBtn) {
        // 显示修改用户名功能
        changeUsernameBtn.style.display = 'inline-block';
        changeUsernameBtn.addEventListener('click', async function() {
            if (!isEditing) {
                // 进入编辑模式
                originalUsername = usernameInput.value;
                usernameInput.removeAttribute('readonly');
                usernameInput.readOnly = false; // 确保readonly属性被移除
                usernameInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                usernameInput.style.color = '#333';
                usernameInput.style.cursor = 'text';
                usernameInput.focus();
                usernameInput.select();
                this.textContent = '确认';
                this.style.background = 'linear-gradient(45deg, #ff0050, #ff6b8b)';
                isEditing = true;
            } else {
                // 确认修改
                const newUsername = usernameInput.value.trim();
                
                if (!newUsername) {
                    showValidationError('用户名不能为空', true);
                    usernameInput.value = originalUsername;
                    return;
                }
                
                // 如果用户名没有变化，直接退出编辑模式
                if (newUsername === originalUsername) {
                    exitEditMode();
                    return;
                }
                
                // 检查用户是否已存在
                try {// 检查用户是否已存在
                    const isUsernameExists = await dataManager.hasUserSubmitted(newUsername);
                    
                    if (isUsernameExists) {
                        showValidationError('该用户名已存在，请选择其他用户名', true);
                        usernameInput.value = originalUsername;
                        return;
                    }
                    
                    // 用户名可用，退出编辑模式
                    exitEditMode();
                } catch (error) {
                    console.error('检查用户名失败:', error);
                    showValidationError('网络连接异常，请检查网络后重试', true);
                    usernameInput.value = originalUsername;
                    return;
                }

            }
            
            // 添加点击反馈效果
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // 监听Enter键确认修改
        usernameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && isEditing) {
                changeUsernameBtn.click();
            }
        });
        
        // 监听Escape键取消修改
        usernameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isEditing) {
                usernameInput.value = originalUsername;
                exitEditMode();
            }
        });
    }
    
    // 退出编辑模式的函数
    function exitEditMode() {
        const currentUsernameInput = document.getElementById('username');
        const currentChangeUsernameBtn = document.getElementById('change-username-btn');
        
        if (currentUsernameInput) {
            currentUsernameInput.setAttribute('readonly', true);
            currentUsernameInput.readOnly = true; // 确保readonly属性被设置
            currentUsernameInput.style.backgroundColor = 'rgba(240, 240, 240, 0.9)';
            currentUsernameInput.style.color = '#666';
            currentUsernameInput.style.cursor = 'default';
        }
        
        if (currentChangeUsernameBtn) {
            currentChangeUsernameBtn.textContent = '修改';
            currentChangeUsernameBtn.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
        }
        
        isEditing = false;
    }
    
    // 重新绑定修改用户名按钮事件的函数
    function rebindUsernameButtonEvents() {
        const changeUsernameBtn = document.getElementById('change-username-btn');
        const usernameInput = document.getElementById('username');
        
        if (changeUsernameBtn && usernameInput) {
            // 重置编辑状态
            isEditing = false;
            
            // 移除现有的事件监听器（通过克隆节点）
            const newChangeUsernameBtn = changeUsernameBtn.cloneNode(true);
            changeUsernameBtn.parentNode.replaceChild(newChangeUsernameBtn, changeUsernameBtn);
            
            // 移除输入框的事件监听器（通过克隆节点）
            const newUsernameInput = usernameInput.cloneNode(true);
            usernameInput.parentNode.replaceChild(newUsernameInput, usernameInput);
            
            // 重新获取元素引用
            const refreshedChangeUsernameBtn = document.getElementById('change-username-btn');
            const refreshedUsernameInput = document.getElementById('username');
            
            // 重新绑定点击事件
            refreshedChangeUsernameBtn.addEventListener('click', async function() {
                if (!isEditing) {
                    // 进入编辑模式
                    originalUsername = refreshedUsernameInput.value;
                    refreshedUsernameInput.removeAttribute('readonly');
                    refreshedUsernameInput.readOnly = false;
                    refreshedUsernameInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                    refreshedUsernameInput.style.color = '#333';
                    refreshedUsernameInput.style.cursor = 'text';
                    refreshedUsernameInput.focus();
                    refreshedUsernameInput.select();
                    this.textContent = '确认';
                    this.style.background = 'linear-gradient(45deg, #ff0050, #ff6b8b)';
                    isEditing = true;
                } else {
                    // 确认修改
                    const newUsername = refreshedUsernameInput.value.trim();
                    
                    if (!newUsername) {
                        showValidationError('用户名不能为空', true);
                        refreshedUsernameInput.value = originalUsername;
                        return;
                    }
                    
                    // 如果用户名没有变化，直接退出编辑模式
                    if (newUsername === originalUsername) {
                        exitEditMode();
                        return;
                    }
                    
                    // 检查用户名是否已存在
                    try {
                        const isUsernameExists = await dataManager.hasUserSubmitted(newUsername);
                        
                        if (isUsernameExists) {
                            showValidationError('该用户名已存在，请选择其他用户名', true);
                            refreshedUsernameInput.value = originalUsername;
                            return;
                        }
                        
                        // 用户名可用，退出编辑模式
                        exitEditMode();
                    } catch (error) {
                        console.error('检查用户名失败:', error);
                        showValidationError('网络连接异常，请检查网络后重试', true);
                        refreshedUsernameInput.value = originalUsername;
                        return;
                    }
                }
                
                // 添加点击反馈效果
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
            
            // 重新绑定键盘事件
            refreshedUsernameInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && isEditing) {
                    refreshedChangeUsernameBtn.click();
                } else if (e.key === 'Escape' && isEditing) {
                    refreshedUsernameInput.value = originalUsername;
                    exitEditMode();
                }
            });
        }
    }
    
    // 显示清除数据警告提示
    function showClearDataWarning(clearDataBtn, actionButtons, confirmCallback) {
        // 移除之前的警告提示
        const existingWarning = document.querySelector('.clear-data-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        // 保存原始的actionButtons内容和样式
        const originalContent = actionButtons.innerHTML;
        const originalStyle = actionButtons.style.cssText;
        
        // 创建警告提示元素
        const warningDiv = document.createElement('div');
        warningDiv.className = 'clear-data-warning';
        warningDiv.style.cssText = `
            background: linear-gradient(45deg, #ff9800, #f57c00);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
            animation: shake 0.2s ease-in-out;
            border-left: 4px solid #ff5722;
        `;
        warningDiv.innerHTML = `
            <div style="margin-bottom: 8px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 18px; margin-right: 8px;"></i>
                <strong>警告：此操作不可撤销</strong>
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                将清除您当前用户的提交数据，其他用户数据不受影响，请点击下方确认按钮继续
            </div>
        `;
        
        // 添加到操作按钮区域前面
        actionButtons.parentNode.insertBefore(warningDiv, actionButtons);
        
        // 清空actionButtons内容，只显示确认和取消按钮
        actionButtons.innerHTML = '';
        
        // 创建确认按钮
        const confirmBtn = document.createElement('button');
        confirmBtn.style.cssText = `
            background: linear-gradient(45deg, #ff4444, #cc0000);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
            margin: 0 7.5px;
        `;
        confirmBtn.textContent = '✅ 确认清除';
        confirmBtn.addEventListener('click', async function() {
            try {
                // 禁用按钮防止重复点击
                confirmBtn.disabled = true;
                confirmBtn.textContent = '正在清除...';
                confirmBtn.style.opacity = '0.6';
                
                // 执行清除操作
                await confirmCallback();
                
                // 清除操作成功后移除警告提示
                warningDiv.remove();
            } catch (error) {
                console.error('确认清除时出错:', error);
                // 重新启用按钮
                confirmBtn.disabled = false;
                confirmBtn.textContent = '✅ 确认清除';
                confirmBtn.style.opacity = '1';
            }
        });
        
        // 创建取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.style.cssText = `
            background: linear-gradient(45deg, #6c757d, #5a6268);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
            margin: 0 7.5px;
        `;
        cancelBtn.textContent = '❌ 取消清除';
        cancelBtn.addEventListener('click', function() {
            // 移除警告提示
            warningDiv.remove();
            
            // 恢复原始的actionButtons内容和样式
            actionButtons.innerHTML = originalContent;
            actionButtons.style.cssText = originalStyle;
            
            // 重新绑定清除数据按钮的事件
            const restoredClearBtn = actionButtons.querySelector('button');
            if (restoredClearBtn) {
                restoredClearBtn.addEventListener('click', function() {
                    showClearDataWarning(restoredClearBtn, actionButtons, confirmCallback);
                });
            }
            
            // 重新绑定返回按钮的事件
            const restoredBackBtn = actionButtons.querySelector('button:last-child');
            if (restoredBackBtn) {
                restoredBackBtn.addEventListener('click', handleBackButtonClick);
            }
        });
        
        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 15px;
            justify-content: center;
            align-items: center;
        `;
        
        // 添加按钮到容器
        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);
        
        // 添加按钮容器到actionButtons
        actionButtons.appendChild(buttonContainer);
        
        // 修改actionButtons的样式
        actionButtons.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin: 20px 0;
            justify-content: center;
            align-items: center;
        `;
    }
    
    // 显示验证错误提示
    function showValidationError(message, isUsernameError = false) {
        // 移除之前的错误提示
        const existingError = document.querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }
        
        // 创建错误提示元素
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.style.cssText = `
            background: linear-gradient(45deg, #ff4444, #cc0000);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin: 10px 0 20px 0;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
            animation: shake 0.5s ease-in-out;
            position: relative;
            z-index: 1000;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
        
        // 根据错误类型选择插入位置
        if (isUsernameError) {
            // 用户名错误：插入到昵称容器下方
            const usernameContainer = document.querySelector('.username-container');
            if (usernameContainer && usernameContainer.parentNode) {
                usernameContainer.parentNode.insertBefore(errorDiv, usernameContainer.nextSibling);
            }
        } else {
            // 其他错误：插入到按钮组前面
            const buttonGroup = document.querySelector('.button-group');
            const surveyForm = document.getElementById('survey-form');
            if (buttonGroup && surveyForm) {
                surveyForm.insertBefore(errorDiv, buttonGroup);
            } else {
                // 备用方案：插入到表单末尾
                if (surveyForm) {
                    surveyForm.appendChild(errorDiv);
                }
            }
        }
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.style.opacity = '0';
                errorDiv.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    errorDiv.remove();
                }, 300);
            }
        }, 3000);
    }
    
    // 绑定选项点击功能
    function bindOptionClickEvents() {
        const options = document.querySelectorAll('.option');
        
        // 先移除所有现有的事件监听器
        options.forEach(option => {
            // 克隆节点来移除所有事件监听器
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);
        });
        
        // 重新获取选项并绑定事件
        const newOptions = document.querySelectorAll('.option');
        newOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                // 防止事件冒泡
                e.stopPropagation();
                
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
            });
        });
    }
    
    // 初始化绑定选项点击功能
    bindOptionClickEvents();
    
    // 所有投票数据现在通过MySQL数据库API管理
    
    // 提交表单
    surveyForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // 获取用户名
        const usernameInput = document.getElementById('username');
        const username = usernameInput.value.trim() || '匿名用户';
        
        // 首先检查用户是否已经提交过
        try {
            const existingUser = await dataManager.getUserByUsername(username);
            
            if (existingUser) {
                // 用户已提交过，直接显示已提交页面
                const submissionData = {
                    timestamp: existingUser.submissionTime,
                    username: existingUser.username,
                    submissionData: existingUser.submissionData,
                    submissionTime: existingUser.submissionTime
                };
                showAlreadySubmittedPage(submissionData);
                return;
            }
        } catch (error) {
            console.error('检查用户提交状态时出错:', error);
            // 如果检查出错，继续正常流程
        }
        
        // 获取选中的选项
        const checkboxes = document.querySelectorAll('input[name="difficulty"]:checked');
        
        if (checkboxes.length === 0) {
            showValidationError('请至少选择一个选项');
            return;
        }
        
        // 收集选中的选项值
        const selectedOptions = [];
        checkboxes.forEach(checkbox => {
            selectedOptions.push(checkbox.value);
        });
        
        // 记录提交历史到Excel数据库（addUser方法会自动处理新用户和已存在用户的情况）
        await saveSubmissionHistory(selectedOptions);
        
        // 显示结果
        showResults();
    });
    
    // 保存提交历史函数
    async function saveSubmissionHistory(selectedOptions) {
        // 获取用户名
        const usernameInput = document.getElementById('username');
        const username = usernameInput.value.trim() || '匿名用户';
        
        // 使用MySQL数据库API添加用户
        await dataManager.addUser(username, selectedOptions);
    }
    
    // 返回按钮处理函数
    function handleBackButtonClick() {
        // 添加淡出效果
        resultsDiv.style.opacity = '0';
        resultsDiv.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            resultsDiv.classList.add('hidden');
            surveyForm.classList.remove('hidden');
            
            // 添加淡入效果
            setTimeout(() => {
                surveyForm.style.opacity = '1';
                surveyForm.style.transform = 'translateY(0)';
            }, 50);
            
            // 清除选中状态，但保留用户名
            document.querySelectorAll('input[name="difficulty"]:checked').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // 重新绑定选项点击事件，解决复选框点击问题
            bindOptionClickEvents();
            
            // 重新绑定修改用户名按钮事件
            rebindUsernameButtonEvents();
            
            // 注意：不清除用户名输入框的内容，保持当前用户信息
        }, 300);
    }
    
    // 返回按钮
    if (backBtn) {
        backBtn.addEventListener('click', handleBackButtonClick);
    }
    
    // 显示结果函数
    function showResults() {
        // 添加淡出效果
        surveyForm.style.opacity = '0';
        surveyForm.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
            // 隐藏表单，显示结果
            surveyForm.classList.add('hidden');
            resultsDiv.classList.remove('hidden');
            
            // 添加淡入效果
            setTimeout(() => {
                resultsDiv.style.opacity = '1';
                resultsDiv.style.transform = 'translateY(0)';
            }, 50);
        }, 300);
        
        // 清空结果区域
        resultBars.innerHTML = '';
        
        // 获取用户名和选中的选项
        const usernameInput = document.getElementById('username');
        const username = usernameInput.value.trim() || '匿名用户';
        const checkboxes = document.querySelectorAll('input[name="difficulty"]:checked');
        const selectedOptions = [];
        checkboxes.forEach(checkbox => {
            selectedOptions.push(checkbox.value);
        });
        
        // 添加提交成功信息
        const successInfo = document.createElement('div');
        successInfo.className = 'success-info';
        successInfo.innerHTML = `
            <h3>✅ 提交成功！</h3>
            <p>感谢您的参与，您的意见对我们很重要。</p>
        `;
        resultBars.appendChild(successInfo);
        
        // 添加用户投票信息
        const userVoteInfo = document.createElement('div');
        userVoteInfo.className = 'user-vote-info';
        userVoteInfo.innerHTML = `<span>投票用户: <strong>${username}</strong></span>`;
        resultBars.appendChild(userVoteInfo);
        
        // 添加提交时间
        const submitTime = document.createElement('div');
        submitTime.className = 'submit-time-info';
        const now = new Date();
        submitTime.innerHTML = `<span>提交时间: <strong>${now.toLocaleString()}</strong></span>`;
        resultBars.appendChild(submitTime);
        
        // 添加分隔线
        const divider = document.createElement('div');
        divider.className = 'result-divider';
        resultBars.appendChild(divider);
        
        // 显示用户选择的选项
        const userChoicesTitle = document.createElement('h4');
        userChoicesTitle.className = 'user-choices-title';
        userChoicesTitle.textContent = '您的选择：';
        resultBars.appendChild(userChoicesTitle);
        
        const userChoicesList = document.createElement('div');
        userChoicesList.className = 'user-choices-list';
        
        selectedOptions.forEach((option, index) => {
            const choiceItem = document.createElement('div');
            choiceItem.className = 'user-choice-item';
            choiceItem.innerHTML = `
                <span class="choice-number">${index + 1}.</span>
                <span class="choice-text">${option}</span>
            `;
            userChoicesList.appendChild(choiceItem);
        });
        
        resultBars.appendChild(userChoicesList);
        
        // 添加操作按钮区域
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = `
            display: flex;
            gap: 20px;
            margin: 20px 0;
            justify-content: center;
            flex-wrap: wrap;
            align-items: center;
        `;
        
        // 返回按钮
        const backButton = document.createElement('button');
        backButton.style.cssText = `
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        `;
        backButton.textContent = '🔙 返回投票页面';
        backButton.addEventListener('click', handleBackButtonClick);
        
        actionButtons.appendChild(backButton);
        resultBars.appendChild(actionButtons);
        
        // 添加感谢信息
        const thankYouMsg = document.createElement('div');
        thankYouMsg.className = 'thank-you-msg';
        thankYouMsg.innerHTML = `
            <p>🎉 您的反馈已成功记录！</p>
            <p>我们会认真考虑您的意见，持续改进我们的服务。</p>
        `;
        resultBars.appendChild(thankYouMsg);
    }
    
    // 刷新按钮事件监听器
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            location.reload();
        });
    }
});
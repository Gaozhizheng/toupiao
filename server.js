/**
 * 投票系统后端服务器
 * 使用MySQL数据库存储数据
 */

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const DatabaseInitializer = require('./init-database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 数据库配置 - 优先使用环境变量
const dbConfig = {
    host: process.env.DB_HOST || 'mysql5.sqlpub.com',
    port: process.env.DB_PORT || 3310,
    user: process.env.DB_USER || 'shashixiong',
    password: process.env.DB_PASSWORD || 'b6WI06lTn3LtiS6n',
    database: process.env.DB_NAME || 'toupiaoshashixiong',
    charset: 'utf8mb4',
    timezone: '+08:00'
};

// 创建数据库连接池
const pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    timezone: dbConfig.timezone,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
});

// 初始化数据库表
async function initDatabase() {
    try {
        console.log('🔧 开始初始化数据库表结构...');
        
        const initializer = new DatabaseInitializer();
        const success = await initializer.initialize();
        
        if (success) {
            console.log('✅ 数据库表结构初始化成功');
        } else {
            throw new Error('数据库表结构初始化失败');
        }
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        throw error;
    }
}

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('数据库连接成功');
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error);
        return false;
    }
}

// API路由

// 测试连接
app.get('/api/test', async (req, res) => {
    try {
        const isConnected = await testConnection();
        if (isConnected) {
            res.json({ 
                success: true, 
                message: '数据库连接正常',
                database: dbConfig.database,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({ 
                success: false, 
                error: 'DATABASE_UNAVAILABLE',
                message: '数据库服务不可用，请使用本地存储模式',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 提交投票
app.post('/api/votes', async (req, res) => {
    const { username, selectedOptions } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    
    // 验证数据
    if (!username || !selectedOptions || !Array.isArray(selectedOptions) || selectedOptions.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: '数据格式错误：用户名和选项不能为空' 
        });
    }
    
    try {
        const connection = await pool.getConnection();
        
        try {
            // 开始事务
            await connection.beginTransaction();
            
            // 检查用户是否已投票
            const [existingVotes] = await connection.execute(
                'SELECT id FROM votes WHERE username = ?',
                [username]
            );
            
            if (existingVotes.length > 0) {
                await connection.rollback();
                return res.status(409).json({ 
                    success: false, 
                    error: '用户已投票，每个用户只能投票一次' 
                });
            }
            
            // 插入新投票（确保UTF-8编码）
            const selectedOptionsJson = JSON.stringify(selectedOptions, null, 0);
            console.log('存储的选项数据:', selectedOptionsJson);
            
            const [result] = await connection.execute(
                'INSERT INTO votes (username, selected_options, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [username, selectedOptionsJson, ipAddress, userAgent]
            );
            
            // 注意：vote_count统计由数据库触发器自动处理，无需手动更新
            
            // 提交事务
            await connection.commit();
            
            res.json({ 
                success: true, 
                id: result.insertId,
                message: '投票提交成功',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            // 回滚事务
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('提交投票失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 检查用户是否已投票
app.get('/api/votes/check/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            'SELECT id, selected_options, submit_time FROM votes WHERE username = ?',
            [username]
        );
        
        connection.release();
        
        if (rows.length > 0) {
            const vote = rows[0];
            res.json({
                hasVoted: true,
                vote: {
                    id: vote.id,
                    username: username,
                    selectedOptions: vote.selected_options,
                    submitTime: vote.submit_time
                }
            });
        } else {
            res.json({ hasVoted: false });
        }
        
    } catch (error) {
        console.error('检查投票状态失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 获取投票选项
app.get('/api/options', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            'SELECT id, option_text, option_order FROM vote_options WHERE is_active = 1 ORDER BY option_order ASC'
        );
        
        connection.release();
        
        const options = rows.map(row => ({
            id: row.id,
            text: row.option_text,
            order: row.option_order
        }));
        
        res.json({
            success: true,
            options: options,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取投票选项失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 获取投票统计
app.get('/api/statistics', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // 获取投票人数（不重复的用户数）
        const [voterCountResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM votes'
        );
        
        // 获取选项统计
        const [optionStats] = await connection.execute(
            'SELECT option_text, vote_count FROM vote_options ORDER BY vote_count DESC'
        );
        
        connection.release();
        
        const optionCounts = {};
        let totalVotes = 0;
        optionStats.forEach(row => {
            optionCounts[row.option_text] = row.vote_count;
            totalVotes += row.vote_count;
        });
        
        res.json({
            success: true,
            totalVotes: totalVotes, // 总投票数 = 所有选项统计的和
            voterCount: voterCountResult[0].total, // 投票人数
            optionCounts: optionCounts,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 调试接口：清除所有投票数据
app.delete('/api/debug/clear', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // 清除投票记录
            await connection.execute('DELETE FROM votes');
            
            // 重置选项计数
            await connection.execute('UPDATE vote_options SET vote_count = 0');
            
            await connection.commit();
            
            res.json({
                success: true,
                message: '所有投票数据已清除',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('清除数据失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '清除数据失败',
            timestamp: new Date().toISOString()
        });
    }
});

// 调试接口：查看vote_options表状态
app.get('/api/debug/options', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            'SELECT id, option_text, vote_count, option_order FROM vote_options ORDER BY option_order ASC'
        );
        
        connection.release();
        
        res.json({
            success: true,
            options: rows,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取选项状态失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用',
            timestamp: new Date().toISOString()
        });
    }
});

// 获取所有投票记录（管理员）
app.get('/api/votes', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT id, username, selected_options, submit_time, ip_address, user_agent, 
                    is_deleted, create_time, update_time 
             FROM votes 
             ORDER BY submit_time DESC`
        );
        
        connection.release();
        
        const votes = rows.map(row => ({
            id: row.id,
            username: row.username,
            selectedOptions: row.selected_options,
            submitTime: row.submit_time,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            isDeleted: row.is_deleted,
            createTime: row.create_time,
            updateTime: row.update_time
        }));
        
        res.json({
            success: true,
            votes: votes,
            total: votes.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取投票记录失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 删除投票记录（管理员）
app.delete('/api/votes/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // 获取要删除的投票记录
            const [voteRows] = await connection.execute(
                'SELECT selected_options FROM votes WHERE id = ?',
                [id]
            );
            
            if (voteRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ 
                    success: false, 
                    error: '投票记录不存在' 
                });
            }
            
            const selectedOptionsData = voteRows[0].selected_options;
            let selectedOptions = [];
            
            // 解析选项数据
            try {
                if (Array.isArray(selectedOptionsData)) {
                    // 如果已经是数组，直接使用
                    selectedOptions = selectedOptionsData;
                } else if (typeof selectedOptionsData === 'string' && selectedOptionsData.startsWith('[')) {
                    selectedOptions = JSON.parse(selectedOptionsData);
                } else if (typeof selectedOptionsData === 'string') {
                    // 处理非JSON格式的数据，按逗号分割
                    selectedOptions = selectedOptionsData.split(/[,，]/).map(opt => opt.trim()).filter(opt => opt);
                } else {
                    selectedOptions = [];
                }
            } catch (e) {
                console.error('解析删除记录的选项数据失败:', e);
                selectedOptions = [];
            }
            
            // 删除投票记录
            await connection.execute('DELETE FROM votes WHERE id = ?', [id]);
            
            // 更新选项统计
            for (const option of selectedOptions) {
                await connection.execute(
                    'UPDATE vote_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE option_text = ?',
                    [option]
                );
            }
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: '投票记录删除成功' 
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('删除投票记录失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 更新投票记录（管理员）
app.put('/api/votes/:id', async (req, res) => {
    const { id } = req.params;
    const { username, selectedOptions, status, submitTime } = req.body;
    
    // 验证数据
    if (!username || !selectedOptions) {
        return res.status(400).json({ 
            success: false, 
            error: '数据格式错误：用户名和选项不能为空' 
        });
    }
    
    try {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // 获取原投票记录
            const [oldVoteRows] = await connection.execute(
                'SELECT selected_options FROM votes WHERE id = ?',
                [id]
            );
            
            if (oldVoteRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ 
                    success: false, 
                    error: '投票记录不存在' 
                });
            }
            
            let oldSelectedOptions, newSelectedOptions;
            
            try {
                const oldData = oldVoteRows[0].selected_options;
                if (Array.isArray(oldData)) {
                    // 如果已经是数组，直接使用
                    oldSelectedOptions = oldData;
                } else if (typeof oldData === 'string' && oldData.startsWith('[')) {
                    oldSelectedOptions = JSON.parse(oldData);
                } else if (typeof oldData === 'string') {
                    // 处理非JSON格式的数据，按逗号分割
                    oldSelectedOptions = oldData.split(/[,，]/).map(opt => opt.trim()).filter(opt => opt);
                } else {
                    oldSelectedOptions = [];
                }
            } catch (e) {
                console.error('解析旧选项数据失败:', e);
                oldSelectedOptions = [];
            }
            
            try {
                if (typeof selectedOptions === 'string' && selectedOptions.startsWith('[')) {
                    newSelectedOptions = JSON.parse(selectedOptions);
                } else if (typeof selectedOptions === 'string') {
                    // 处理非JSON格式的数据，按逗号分割
                    newSelectedOptions = selectedOptions.split(/[,，]/).map(opt => opt.trim()).filter(opt => opt);
                    // 将处理后的数据转换为JSON格式存储
                    selectedOptions = JSON.stringify(newSelectedOptions);
                } else {
                    newSelectedOptions = [];
                }
            } catch (e) {
                console.error('解析新选项数据失败:', e, '原始数据:', selectedOptions);
                await connection.rollback();
                return res.status(400).json({ 
                    success: false, 
                    error: '选项数据格式错误，请检查是否包含特殊字符' 
                });
            }
            
            // 更新投票记录（不更新提交时间）
            const updateQuery = `
                UPDATE votes 
                SET username = ?, selected_options = ?, update_time = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            await connection.execute(updateQuery, [
                username, 
                selectedOptions, 
                id
            ]);
            
            // 更新选项统计：先减去旧选项，再加上新选项
            for (const option of oldSelectedOptions) {
                await connection.execute(
                    'UPDATE vote_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE option_text = ?',
                    [option]
                );
            }
            
            for (const option of newSelectedOptions) {
                await connection.execute(
                    'UPDATE vote_options SET vote_count = vote_count + 1 WHERE option_text = ? AND is_active = 1',
                    [option]
                );
            }
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: '投票记录更新成功' 
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('更新投票记录失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 数据备份
app.get('/api/backup', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [votes] = await connection.execute(
            'SELECT * FROM votes ORDER BY submit_time DESC'
        );
        
        connection.release();
        
        const backup = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            database: dbConfig.database,
            votes: votes.map(vote => ({
                id: vote.id,
                username: vote.username,
                selected_options: vote.selected_options,
                submit_time: vote.submit_time,
                ip_address: vote.ip_address,
                user_agent: vote.user_agent,
                is_deleted: vote.is_deleted,
                create_time: vote.create_time,
                update_time: vote.update_time
            }))
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
        res.send(JSON.stringify(backup, null, 2));
        
    } catch (error) {
        console.error('数据备份失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 数据恢复
app.post('/api/restore', async (req, res) => {
    try {
        const { votes } = req.body;
        
        if (!votes || !Array.isArray(votes)) {
            return res.status(400).json({
                success: false,
                error: '无效的备份数据格式：缺少votes数据'
            });
        }
        
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // 清空现有投票数据
            await connection.execute('DELETE FROM votes');
            
            // 恢复投票数据
            for (const vote of votes) {
                // 转换日期时间格式为MySQL兼容格式
                const formatDateTime = (dateStr) => {
                    if (!dateStr) return new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const date = new Date(dateStr);
                    return date.toISOString().slice(0, 19).replace('T', ' ');
                };
                
                await connection.execute(
                    `INSERT INTO votes (id, username, selected_options, submit_time, ip_address, user_agent, is_deleted, create_time, update_time) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        vote.id,
                        vote.username,
                        vote.selected_options,
                        formatDateTime(vote.submit_time),
                        vote.ip_address || null,
                        vote.user_agent || null,
                        vote.is_deleted || 0,
                        formatDateTime(vote.create_time || vote.submit_time),
                        formatDateTime(vote.update_time || vote.submit_time)
                    ]
                );
            }
            
            // 重新计算并更新投票选项统计
            // 先清空现有统计
            await connection.execute('UPDATE vote_options SET vote_count = 0');
            
            // 重新统计每个选项的投票数
            for (const vote of votes) {
                let selectedOptions = [];
                try {
                    const selectedOptionsData = vote.selected_options;
                    if (typeof selectedOptionsData === 'string' && selectedOptionsData.startsWith('[')) {
                        selectedOptions = JSON.parse(selectedOptionsData);
                    } else if (typeof selectedOptionsData === 'string') {
                        selectedOptions = selectedOptionsData.split(/[,，]/).map(opt => opt.trim()).filter(opt => opt);
                    }
                } catch (e) {
                    console.error('解析恢复数据的选项失败:', e);
                    continue;
                }
                
                // 更新每个选项的统计（只更新现有的预定义选项）
                for (const option of selectedOptions) {
                    await connection.execute(
                        'UPDATE vote_options SET vote_count = vote_count + 1 WHERE option_text = ? AND is_active = 1',
                        [option]
                    );
                }
            }
            
            await connection.commit();
            
            res.json({
                success: true,
                message: `成功恢复 ${votes.length} 条投票记录`
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('数据恢复失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用，请使用本地存储模式',
            timestamp: new Date().toISOString()
        });
    }
});

// 调试接口：检查vote_options表数据
app.get('/api/debug/vote-options', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [options] = await connection.execute(
            'SELECT * FROM vote_options ORDER BY id'
        );
        
        connection.release();
        
        res.json({
            success: true,
            options: options,
            count: options.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取vote_options数据失败:', error);
        res.status(503).json({ 
            success: false, 
            error: 'DATABASE_UNAVAILABLE',
            message: '数据库服务不可用',
            timestamp: new Date().toISOString()
        });
    }
});



// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: '接口不存在' 
    });
});

// 启动服务器
async function startServer() {
    let dbConnected = false;
    
    try {
        // 测试数据库连接
        const isConnected = await testConnection();
        if (isConnected) {
            // 初始化数据库
            await initDatabase();
            dbConnected = true;
            console.log('✅ 数据库连接成功');
        } else {
            console.warn('⚠️ 数据库连接失败，服务器将以只读模式启动');
        }
        
    } catch (error) {
        console.warn('⚠️ 数据库初始化失败:', error.message);
        console.warn('⚠️ 服务器将以只读模式启动');
    }
    
    // 无论数据库是否连接成功，都启动HTTP服务器
    app.listen(PORT, () => {
        console.log(`\n=================================`);
        console.log(`🚀 投票系统服务器启动成功!`);
        console.log(`📍 服务器地址: http://localhost:${PORT}`);
        console.log(`🗄️  数据库状态: ${dbConnected ? '✅ 已连接' : '❌ 未连接'}`);
        if (dbConnected) {
            console.log(`🌐 数据库: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
        } else {
            console.log(`💡 前端将自动切换到本地存储模式`);
        }
        console.log(`=================================\n`);
    });
}

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    await pool.end();
    console.log('数据库连接已关闭');
    process.exit(0);
});

// 启动服务器
startServer();
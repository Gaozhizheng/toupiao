/**
 * MySQL数据库初始化脚本
 * 根据前端数据库结构创建对应的MySQL表
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 导入数据库配置
const dbConfig = require('./mysql-config.js');

class DatabaseInitializer {
    constructor() {
        this.connection = null;
    }

    // 创建数据库连接
    async createConnection() {
        try {
            this.connection = await mysql.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.password,
                database: dbConfig.database,
                charset: dbConfig.charset,
                timezone: dbConfig.timezone
            });
            console.log('✅ 数据库连接成功');
            return true;
        } catch (error) {
            console.error('❌ 数据库连接失败:', error.message);
            return false;
        }
    }

    // 执行SQL文件
    async executeSQLFile(filePath) {
        try {
            const sqlContent = await fs.readFile(filePath, 'utf8');
            
            // 分割SQL语句（以分号和换行符为分隔符）
            const statements = sqlContent
                .split(/;\s*\n/)
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));

            console.log(`📄 开始执行SQL文件: ${path.basename(filePath)}`);
            console.log(`📊 共找到 ${statements.length} 条SQL语句`);

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.trim()) {
                    try {
                        await this.connection.execute(statement);
                        console.log(`✅ 执行成功 (${i + 1}/${statements.length}): ${statement.substring(0, 50)}...`);
                    } catch (error) {
                        // 忽略一些预期的错误（如表已存在等）
                        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
                            error.code === 'ER_DUP_KEYNAME' ||
                            error.code === 'ER_DUP_ENTRY') {
                            console.log(`⚠️ 跳过已存在项 (${i + 1}/${statements.length}): ${error.message}`);
                        } else {
                            console.error(`❌ 执行失败 (${i + 1}/${statements.length}):`, error.message);
                            console.error(`SQL: ${statement.substring(0, 100)}...`);
                        }
                    }
                }
            }

            console.log('✅ SQL文件执行完成');
            return true;
        } catch (error) {
            console.error('❌ 读取或执行SQL文件失败:', error.message);
            return false;
        }
    }

    // 检查表是否存在
    async checkTableExists(tableName) {
        try {
            const [rows] = await this.connection.execute(
                'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
                [dbConfig.database, tableName]
            );
            return rows[0].count > 0;
        } catch (error) {
            console.error(`检查表 ${tableName} 是否存在时出错:`, error.message);
            return false;
        }
    }

    // 检查数据库结构
    async checkDatabaseStructure() {
        const requiredTables = ['votes', 'vote_options', 'system_config'];
        const missingTables = [];

        console.log('🔍 检查数据库表结构...');

        for (const tableName of requiredTables) {
            const exists = await this.checkTableExists(tableName);
            if (exists) {
                console.log(`✅ 表 ${tableName} 已存在`);
            } else {
                console.log(`❌ 表 ${tableName} 不存在`);
                missingTables.push(tableName);
            }
        }

        return missingTables;
    }

    // 初始化数据库表结构
    async initializeTables() {
        try {
            const sqlFilePath = path.join(__dirname, 'mysql-tables.sql');
            
            // 检查SQL文件是否存在
            try {
                await fs.access(sqlFilePath);
            } catch (error) {
                console.error('❌ SQL文件不存在:', sqlFilePath);
                return false;
            }

            // 执行SQL文件
            const success = await this.executeSQLFile(sqlFilePath);
            
            if (success) {
                console.log('✅ 数据库表结构初始化完成');
                
                // 验证表结构
                const missingTables = await this.checkDatabaseStructure();
                if (missingTables.length === 0) {
                    console.log('✅ 所有必需的表都已创建');
                    return true;
                } else {
                    console.error('❌ 仍有表未创建:', missingTables);
                    return false;
                }
            } else {
                console.error('❌ 数据库表结构初始化失败');
                return false;
            }
        } catch (error) {
            console.error('❌ 初始化数据库表结构时出错:', error.message);
            return false;
        }
    }

    // 获取表信息
    async getTableInfo(tableName) {
        try {
            const [columns] = await this.connection.execute(
                'DESCRIBE ' + tableName
            );
            
            const [indexes] = await this.connection.execute(
                'SHOW INDEX FROM ' + tableName
            );

            return {
                columns: columns,
                indexes: indexes
            };
        } catch (error) {
            console.error(`获取表 ${tableName} 信息时出错:`, error.message);
            return null;
        }
    }

    // 显示数据库状态
    async showDatabaseStatus() {
        console.log('\n📊 数据库状态报告:');
        console.log('=' .repeat(50));
        
        const tables = ['votes', 'vote_options', 'system_config'];
        
        for (const tableName of tables) {
            try {
                const [countResult] = await this.connection.execute(
                    `SELECT COUNT(*) as count FROM ${tableName}`
                );
                
                const tableInfo = await this.getTableInfo(tableName);
                
                console.log(`\n📋 表: ${tableName}`);
                console.log(`   记录数: ${countResult[0].count}`);
                console.log(`   字段数: ${tableInfo ? tableInfo.columns.length : '未知'}`);
                console.log(`   索引数: ${tableInfo ? new Set(tableInfo.indexes.map(idx => idx.Key_name)).size : '未知'}`);
            } catch (error) {
                console.log(`\n❌ 表: ${tableName} - 错误: ${error.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(50));
    }

    // 关闭数据库连接
    async closeConnection() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 数据库连接已关闭');
        }
    }

    // 完整的初始化流程
    async initialize() {
        console.log('🚀 开始初始化MySQL数据库...');
        console.log('=' .repeat(60));
        
        try {
            // 1. 创建数据库连接
            const connected = await this.createConnection();
            if (!connected) {
                return false;
            }

            // 2. 检查当前数据库结构
            const missingTables = await this.checkDatabaseStructure();
            
            // 3. 如果有缺失的表，则初始化表结构
            if (missingTables.length > 0) {
                console.log('\n🔧 检测到缺失的表，开始初始化...');
                const success = await this.initializeTables();
                if (!success) {
                    return false;
                }
            } else {
                console.log('\n✅ 数据库表结构完整，无需初始化');
            }

            // 4. 显示数据库状态
            await this.showDatabaseStatus();

            console.log('\n🎉 数据库初始化完成！');
            return true;
        } catch (error) {
            console.error('❌ 数据库初始化过程中出错:', error.message);
            return false;
        } finally {
            // 5. 关闭连接
            await this.closeConnection();
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const initializer = new DatabaseInitializer();
    initializer.initialize().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ 初始化失败:', error);
        process.exit(1);
    });
}

module.exports = DatabaseInitializer;
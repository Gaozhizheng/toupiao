#!/usr/bin/env node
/**
 * 数据库管理脚本
 * 用于手动执行数据库初始化、备份、恢复等操作
 */

const DatabaseInitializer = require('./init-database.js');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const dbConfig = require('./mysql-config.js');

class DatabaseManager {
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
            return true;
        } catch (error) {
            console.error('❌ 数据库连接失败:', error.message);
            return false;
        }
    }

    // 关闭数据库连接
    async closeConnection() {
        if (this.connection) {
            await this.connection.end();
        }
    }

    // 初始化数据库
    async initializeDatabase() {
        console.log('🚀 开始初始化数据库...');
        const initializer = new DatabaseInitializer();
        const success = await initializer.initialize();
        return success;
    }

    // 清空所有表数据
    async clearAllData() {
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            console.log('🗑️  开始清空所有表数据...');
            
            // 禁用外键检查
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');
            
            // 清空表数据
            const tables = ['votes', 'vote_options', 'system_config'];
            for (const table of tables) {
                try {
                    await this.connection.execute(`TRUNCATE TABLE ${table}`);
                    console.log(`✅ 已清空表: ${table}`);
                } catch (error) {
                    console.log(`⚠️ 清空表 ${table} 失败: ${error.message}`);
                }
            }
            
            // 重新启用外键检查
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');
            
            console.log('✅ 所有表数据清空完成');
            return true;
        } catch (error) {
            console.error('❌ 清空数据失败:', error.message);
            return false;
        } finally {
            await this.closeConnection();
        }
    }

    // 删除所有表
    async dropAllTables() {
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            console.log('🗑️  开始删除所有表...');
            
            // 禁用外键检查
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');
            
            // 删除表
            const tables = ['votes', 'vote_options', 'system_config'];
            for (const table of tables) {
                try {
                    await this.connection.execute(`DROP TABLE IF EXISTS ${table}`);
                    console.log(`✅ 已删除表: ${table}`);
                } catch (error) {
                    console.log(`⚠️ 删除表 ${table} 失败: ${error.message}`);
                }
            }
            
            // 重新启用外键检查
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');
            
            console.log('✅ 所有表删除完成');
            return true;
        } catch (error) {
            console.error('❌ 删除表失败:', error.message);
            return false;
        } finally {
            await this.closeConnection();
        }
    }

    // 备份数据库
    async backupDatabase(outputPath) {
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            console.log('💾 开始备份数据库...');
            
            const backup = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                database: dbConfig.database,
                tables: {}
            };

            const tables = ['votes', 'vote_options', 'system_config'];
            
            for (const table of tables) {
                try {
                    const [rows] = await this.connection.execute(`SELECT * FROM ${table}`);
                    backup.tables[table] = rows;
                    console.log(`✅ 已备份表 ${table}: ${rows.length} 条记录`);
                } catch (error) {
                    console.log(`⚠️ 备份表 ${table} 失败: ${error.message}`);
                    backup.tables[table] = [];
                }
            }

            // 写入备份文件
            const backupFile = outputPath || `backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            await fs.writeFile(backupFile, JSON.stringify(backup, null, 2), 'utf8');
            
            console.log(`✅ 数据库备份完成: ${backupFile}`);
            return backupFile;
        } catch (error) {
            console.error('❌ 备份失败:', error.message);
            return false;
        } finally {
            await this.closeConnection();
        }
    }

    // 恢复数据库
    async restoreDatabase(backupPath) {
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            console.log('📥 开始恢复数据库...');
            
            // 读取备份文件
            const backupContent = await fs.readFile(backupPath, 'utf8');
            const backup = JSON.parse(backupContent);
            
            console.log(`📄 备份文件信息:`);
            console.log(`   时间: ${backup.timestamp}`);
            console.log(`   版本: ${backup.version}`);
            console.log(`   数据库: ${backup.database}`);
            
            // 禁用外键检查
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');
            
            // 恢复数据
            for (const [tableName, rows] of Object.entries(backup.tables)) {
                try {
                    // 清空现有数据
                    await this.connection.execute(`TRUNCATE TABLE ${tableName}`);
                    
                    if (rows.length > 0) {
                        // 获取表结构
                        const [columns] = await this.connection.execute(`DESCRIBE ${tableName}`);
                        const columnNames = columns.map(col => col.Field);
                        
                        // 构建插入语句
                        const placeholders = columnNames.map(() => '?').join(', ');
                        const insertSQL = `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${placeholders})`;
                        
                        // 插入数据
                        for (const row of rows) {
                            const values = columnNames.map(col => row[col]);
                            await this.connection.execute(insertSQL, values);
                        }
                    }
                    
                    console.log(`✅ 已恢复表 ${tableName}: ${rows.length} 条记录`);
                } catch (error) {
                    console.log(`⚠️ 恢复表 ${tableName} 失败: ${error.message}`);
                }
            }
            
            // 重新启用外键检查
            await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');
            
            console.log('✅ 数据库恢复完成');
            return true;
        } catch (error) {
            console.error('❌ 恢复失败:', error.message);
            return false;
        } finally {
            await this.closeConnection();
        }
    }

    // 显示数据库状态
    async showStatus() {
        try {
            const connected = await this.createConnection();
            if (!connected) return false;

            console.log('\n📊 数据库状态报告');
            console.log('=' .repeat(50));
            
            // 数据库信息
            console.log(`🗄️  数据库: ${dbConfig.database}`);
            console.log(`🌐 主机: ${dbConfig.host}:${dbConfig.port}`);
            console.log(`👤 用户: ${dbConfig.user}`);
            
            const tables = ['votes', 'vote_options', 'system_config'];
            
            for (const tableName of tables) {
                try {
                    const [countResult] = await this.connection.execute(
                        `SELECT COUNT(*) as count FROM ${tableName}`
                    );
                    
                    const [columns] = await this.connection.execute(
                        `DESCRIBE ${tableName}`
                    );
                    
                    console.log(`\n📋 表: ${tableName}`);
                    console.log(`   记录数: ${countResult[0].count}`);
                    console.log(`   字段数: ${columns.length}`);
                    console.log(`   字段: ${columns.map(col => col.Field).join(', ')}`);
                } catch (error) {
                    console.log(`\n❌ 表: ${tableName} - 错误: ${error.message}`);
                }
            }
            
            console.log('\n' + '='.repeat(50));
            return true;
        } catch (error) {
            console.error('❌ 获取状态失败:', error.message);
            return false;
        } finally {
            await this.closeConnection();
        }
    }
}

// 命令行接口
function showHelp() {
    console.log(`
📚 数据库管理工具使用说明:`);
    console.log('=' .repeat(50));
    console.log('node manage-database.js <命令> [参数]');
    console.log('');
    console.log('可用命令:');
    console.log('  init              - 初始化数据库表结构');
    console.log('  status            - 显示数据库状态');
    console.log('  clear             - 清空所有表数据');
    console.log('  drop              - 删除所有表');
    console.log('  backup [文件名]   - 备份数据库');
    console.log('  restore <文件名>  - 恢复数据库');
    console.log('  help              - 显示此帮助信息');
    console.log('');
    console.log('示例:');
    console.log('  node manage-database.js init');
    console.log('  node manage-database.js backup my-backup.json');
    console.log('  node manage-database.js restore my-backup.json');
    console.log('=' .repeat(50));
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command || command === 'help') {
        showHelp();
        return;
    }
    
    const manager = new DatabaseManager();
    
    try {
        switch (command) {
            case 'init':
                const initSuccess = await manager.initializeDatabase();
                process.exit(initSuccess ? 0 : 1);
                break;
                
            case 'status':
                const statusSuccess = await manager.showStatus();
                process.exit(statusSuccess ? 0 : 1);
                break;
                
            case 'clear':
                const clearSuccess = await manager.clearAllData();
                process.exit(clearSuccess ? 0 : 1);
                break;
                
            case 'drop':
                const dropSuccess = await manager.dropAllTables();
                process.exit(dropSuccess ? 0 : 1);
                break;
                
            case 'backup':
                const backupPath = args[1];
                const backupSuccess = await manager.backupDatabase(backupPath);
                process.exit(backupSuccess ? 0 : 1);
                break;
                
            case 'restore':
                const restorePath = args[1];
                if (!restorePath) {
                    console.error('❌ 请指定备份文件路径');
                    process.exit(1);
                }
                const restoreSuccess = await manager.restoreDatabase(restorePath);
                process.exit(restoreSuccess ? 0 : 1);
                break;
                
            default:
                console.error(`❌ 未知命令: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ 执行失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = DatabaseManager;
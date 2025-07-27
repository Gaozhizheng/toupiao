/**
 * MySQL数据库配置
 * 用于连接远程MySQL数据库
 */

// 数据库连接配置
const dbConfig = {
    host: 'mysql5.sqlpub.com',
    port: 3310,
    user: 'shashixiong',
    password: 'b6WI06lTn3LtiS6n',
    database: 'toupiaoshashixiong',
    charset: 'utf8mb4',
    timezone: '+08:00'
};

// 如果在Node.js环境中
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dbConfig;
}

// 如果在浏览器环境中
if (typeof window !== 'undefined') {
    window.dbConfig = dbConfig;
}

console.log('MySQL数据库配置已加载');
console.log('数据库名称:', dbConfig.database);
console.log('数据库主机:', dbConfig.host + ':' + dbConfig.port);
console.log('数据库用户:', dbConfig.user);
# Vercel 部署指南

## 部署前准备

### 1. 项目配置
项目已经配置了以下文件用于Vercel部署：
- `vercel.json` - Vercel部署配置
- `.vercelignore` - 忽略不需要部署的文件

### 2. 环境变量配置
在Vercel项目设置中需要配置以下环境变量：

```
DB_HOST=mysql5.sqlpub.com
DB_PORT=3310
DB_USER=shashixiong
DB_PASSWORD=b6WI06lTn3LtiS6n
DB_NAME=toupiaoshashixiong
NODE_ENV=production
```

## 部署步骤

### 方法一：通过Vercel CLI

1. 安装Vercel CLI（如果还没有安装）：
   ```bash
   npm install -g vercel
   ```

2. 登录Vercel：
   ```bash
   vercel login
   ```

3. 在项目根目录运行部署命令：
   ```bash
   vercel
   ```

4. 按照提示完成部署配置

### 方法二：通过GitHub集成

1. 将代码推送到GitHub仓库
2. 在Vercel控制台导入GitHub项目
3. 配置环境变量
4. 部署

## 部署后配置

### 1. 环境变量设置
在Vercel项目设置页面的Environment Variables部分添加数据库配置：

- `DB_HOST`: 数据库主机地址
- `DB_PORT`: 数据库端口
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称

### 2. 域名配置
部署完成后，Vercel会提供一个默认域名，你也可以配置自定义域名。

## 注意事项

1. **数据库连接**：确保数据库服务器允许来自Vercel的连接
2. **环境变量**：敏感信息（如数据库密码）必须通过环境变量配置，不要硬编码在代码中
3. **静态文件**：前端文件（HTML、CSS、JS）会被作为静态文件部署
4. **API路由**：后端API会通过Serverless Functions运行

## 可能遇到的问题

### 1. 数据库连接超时
- 检查数据库服务器是否允许外部连接
- 确认环境变量配置正确

### 2. 静态文件404
- 检查vercel.json中的路由配置
- 确认文件路径正确

### 3. API调用失败
- 检查API路由配置
- 确认server.js中的路由定义正确

## 测试部署

部署完成后，访问以下URL测试功能：
- `/` - 主页
- `/admin.html` - 管理后台
- `/database-admin.html` - 数据库管理
- `/api/test` - API连接测试

## 本地开发

如果需要在本地测试Vercel配置：
```bash
npm install -g vercel
vercel dev
```

这将启动本地开发服务器，模拟Vercel的运行环境。
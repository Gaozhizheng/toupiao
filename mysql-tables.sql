-- 抖音调查问卷系统 MySQL数据库表结构
-- 基于前端数据库结构创建对应的MySQL表

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库（如果不存在）
-- CREATE DATABASE IF NOT EXISTS `toupiaoshashixiong` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `toupiaoshashixiong`;

-- ====================================
-- 1. 用户投票记录表 (users -> votes)
-- ====================================
DROP TABLE IF EXISTS `votes`;
CREATE TABLE `votes` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `username` varchar(255) NOT NULL COMMENT '用户名',
  `selected_options` json NOT NULL COMMENT '选择的投票选项（JSON格式）',
  `submit_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  `ip_address` varchar(45) DEFAULT NULL COMMENT '用户IP地址',
  `user_agent` text DEFAULT NULL COMMENT '用户浏览器信息',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否删除（0:未删除, 1:已删除）',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`) COMMENT '用户名唯一索引',
  KEY `idx_submit_time` (`submit_time`) COMMENT '提交时间索引',
  KEY `idx_is_deleted` (`is_deleted`) COMMENT '删除状态索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户投票记录表';

-- ====================================
-- 2. 投票选项表 (vote_options)
-- ====================================
DROP TABLE IF EXISTS `vote_options`;
CREATE TABLE `vote_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `option_text` varchar(500) NOT NULL COMMENT '选项文本内容',
  `option_order` int(11) NOT NULL DEFAULT '0' COMMENT '选项排序',
  `vote_count` int(11) NOT NULL DEFAULT '0' COMMENT '投票数量',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用（0:禁用, 1:启用）',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_option_text` (`option_text`) COMMENT '选项文本唯一索引',
  KEY `idx_option_order` (`option_order`) COMMENT '选项排序索引',
  KEY `idx_is_active` (`is_active`) COMMENT '启用状态索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='投票选项表';

-- ====================================
-- 3. 系统配置表 (system_config)
-- ====================================
DROP TABLE IF EXISTS `system_config`;
CREATE TABLE `system_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key` varchar(100) NOT NULL COMMENT '配置键名',
  `config_value` text DEFAULT NULL COMMENT '配置值',
  `description` varchar(500) DEFAULT NULL COMMENT '配置描述',
  `config_type` varchar(50) DEFAULT 'string' COMMENT '配置类型（string, number, boolean, json）',
  `is_system` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否系统配置（0:用户配置, 1:系统配置）',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`) COMMENT '配置键名唯一索引',
  KEY `idx_config_type` (`config_type`) COMMENT '配置类型索引',
  KEY `idx_is_system` (`is_system`) COMMENT '系统配置索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- ====================================
-- 4. 投票统计视图 (vote_statistics)
-- ====================================
DROP VIEW IF EXISTS `vote_statistics`;
CREATE VIEW `vote_statistics` AS
SELECT 
    vo.id as option_id,
    vo.option_text,
    vo.option_order,
    COUNT(DISTINCT v.id) as vote_count,
    ROUND(COUNT(DISTINCT v.id) * 100.0 / (
        SELECT COUNT(*) FROM votes WHERE is_deleted = 0
    ), 2) as vote_percentage
FROM vote_options vo
LEFT JOIN votes v ON JSON_CONTAINS(v.selected_options, JSON_QUOTE(vo.option_text)) 
    AND v.is_deleted = 0
WHERE vo.is_active = 1
GROUP BY vo.id, vo.option_text, vo.option_order
ORDER BY vo.option_order ASC;

-- ====================================
-- 初始化投票选项数据
-- ====================================
INSERT INTO `vote_options` (`option_text`, `option_order`, `is_active`) VALUES
('不好意思露脸出镜', 1, 1),
('不会剪辑视频', 2, 1),
('不知道该发什么内容', 3, 1),
('词穷，不会写文案', 4, 1),
('没灵感，不会变视频脚本', 5, 1),
('不会拍摄', 6, 1),
('不能持续更新', 7, 1);

-- ====================================
-- 初始化系统配置数据
-- ====================================
INSERT INTO `system_config` (`config_key`, `config_value`, `description`, `config_type`, `is_system`) VALUES
('survey_title', '你认为做抖音最难的是哪方面？', '调查问卷标题', 'string', 1),
('max_selections', '7', '最大可选择数量', 'number', 1),
('allow_multiple_submissions', 'false', '是否允许重复提交', 'boolean', 1),
('survey_status', 'active', '调查状态（active:进行中, paused:暂停, closed:已结束）', 'string', 1),
('created_date', '2025-01-01', '系统创建日期', 'string', 1),
('version', '2.0.0', '系统版本号', 'string', 1);

-- ====================================
-- 创建存储过程和函数
-- ====================================

-- 获取投票统计的存储过程
DELIMITER //
DROP PROCEDURE IF EXISTS GetVoteStatistics//
CREATE PROCEDURE GetVoteStatistics()
BEGIN
    DECLARE total_votes INT DEFAULT 0;
    
    -- 获取总投票数
    SELECT COUNT(*) INTO total_votes FROM votes WHERE is_deleted = 0;
    
    -- 返回统计结果
    SELECT 
        vo.id as option_id,
        vo.option_text,
        vo.option_order,
        COUNT(DISTINCT v.id) as vote_count,
        CASE 
            WHEN total_votes > 0 THEN ROUND(COUNT(DISTINCT v.id) * 100.0 / total_votes, 2)
            ELSE 0
        END as vote_percentage,
        total_votes as total_votes
    FROM vote_options vo
    LEFT JOIN votes v ON JSON_CONTAINS(v.selected_options, JSON_QUOTE(vo.option_text)) 
        AND v.is_deleted = 0
    WHERE vo.is_active = 1
    GROUP BY vo.id, vo.option_text, vo.option_order
    ORDER BY vo.option_order ASC;
END//
DELIMITER ;

-- 检查用户是否已投票的函数
DELIMITER //
DROP FUNCTION IF EXISTS CheckUserVoted//
CREATE FUNCTION CheckUserVoted(user_name VARCHAR(255))
RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE vote_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO vote_count 
    FROM votes 
    WHERE username = user_name AND is_deleted = 0;
    
    RETURN vote_count > 0;
END//
DELIMITER ;

-- ====================================
-- 创建触发器
-- ====================================

-- 投票后更新选项计数的触发器
DELIMITER //
DROP TRIGGER IF EXISTS update_vote_count_after_insert//
CREATE TRIGGER update_vote_count_after_insert
AFTER INSERT ON votes
FOR EACH ROW
BEGIN
    -- 更新相关选项的投票计数
    UPDATE vote_options vo
    SET vote_count = (
        SELECT COUNT(DISTINCT v.id)
        FROM votes v
        WHERE JSON_CONTAINS(v.selected_options, JSON_QUOTE(vo.option_text))
        AND v.is_deleted = 0
    )
    WHERE vo.is_active = 1;
END//
DELIMITER ;

-- 删除投票后更新选项计数的触发器
DELIMITER //
DROP TRIGGER IF EXISTS update_vote_count_after_delete//
CREATE TRIGGER update_vote_count_after_delete
AFTER UPDATE ON votes
FOR EACH ROW
BEGIN
    -- 只有当is_deleted状态改变时才更新
    IF OLD.is_deleted != NEW.is_deleted THEN
        UPDATE vote_options vo
        SET vote_count = (
            SELECT COUNT(DISTINCT v.id)
            FROM votes v
            WHERE JSON_CONTAINS(v.selected_options, JSON_QUOTE(vo.option_text))
            AND v.is_deleted = 0
        )
        WHERE vo.is_active = 1;
    END IF;
END//
DELIMITER ;

-- ====================================
-- 创建索引优化查询性能
-- ====================================

-- 复合索引：用户名和删除状态
CREATE INDEX idx_username_deleted ON votes(username, is_deleted);

-- 复合索引：提交时间和删除状态
CREATE INDEX idx_submit_time_deleted ON votes(submit_time, is_deleted);

-- JSON字段索引（MySQL 5.7+支持）
-- ALTER TABLE votes ADD INDEX idx_selected_options ((CAST(selected_options AS CHAR(255))));

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================
-- 表结构说明
-- ====================================
/*
数据库表结构说明：

1. votes表（对应前端users表）：
   - 存储用户投票记录
   - username: 用户名（唯一）
   - selected_options: JSON格式存储选择的选项
   - submit_time: 提交时间
   - ip_address, user_agent: 新增字段，用于记录用户信息
   - is_deleted: 软删除标记

2. vote_options表：
   - 存储投票选项信息
   - option_text: 选项文本
   - option_order: 选项排序
   - vote_count: 投票数量（通过触发器自动更新）
   - is_active: 是否启用

3. system_config表：
   - 存储系统配置信息
   - config_key: 配置键名（唯一）
   - config_value: 配置值
   - config_type: 配置类型
   - is_system: 是否系统配置

4. vote_statistics视图：
   - 提供投票统计查询
   - 包含投票数量和百分比

5. 存储过程和函数：
   - GetVoteStatistics(): 获取投票统计
   - CheckUserVoted(): 检查用户是否已投票

6. 触发器：
   - 自动更新投票选项的计数
   - 保证数据一致性

7. 索引优化：
   - 提升查询性能
   - 支持高并发访问
*/
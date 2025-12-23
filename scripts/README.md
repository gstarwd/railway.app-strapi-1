# Cloudinary to Cloudflare R2 Migration Scripts

这些脚本用于将 Strapi Media Library 中的图片从 Cloudinary 迁移到 Cloudflare R2。

## 功能特性

- ✅ **多层备份机制**: 数据库 + JSON + CSV 三重备份
- ✅ **断点续传**: 可随时中断和恢复
- ✅ **事务保护**: 每个文件更新都是原子操作
- ✅ **并发控制**: 避免 API 限流
- ✅ **一键恢复**: 快速回滚到备份状态
- ✅ **详细日志**: 完整的迁移状态跟踪

## 前置要求

1. 已安装依赖包 (已完成)
2. 配置了 Cloudflare R2 环境变量
3. 有 Cloudinary 历史图片需要迁移

## 使用步骤

### 1. 备份 (必须!)

在迁移前,**必须**先运行备份脚本:

```bash
node scripts/backup-before-migration.js
```

这将创建:
- 数据库完整备份
- JSON 格式的文件元数据备份
- CSV 映射表
- 备份验证报告

### 2. 干运行 (推荐)

在正式迁移前,建议先进行干运行测试:

```bash
node scripts/migrate-to-r2.js --dry-run
```

干运行模式不会实际修改数据,只会模拟迁移过程。

### 3. 正式迁移

确认无误后,执行正式迁移:

```bash
node scripts/migrate-to-r2.js
```

迁移过程中:
- 自动保存进度到 `migration-state.json`
- 可随时 Ctrl+C 中断
- 重新运行会从上次中断的地方继续

### 4. 验证

迁移完成后:
1. 检查 `migration-state.json` 查看统计信息
2. 在 Strapi Media Library 中验证图片
3. 检查前端网站图片显示是否正常

### 5. 恢复 (如果需要)

如果迁移出现问题,可以一键恢复:

```bash
node scripts/restore-from-backup.js
```

脚本会列出所有可用备份,选择要恢复的版本即可。

## 生产环境

### 备份

```bash
node scripts/backup-before-migration.js --env=production
```

### 迁移

```bash
node scripts/migrate-to-r2.js --env=production
```

### 恢复

```bash
node scripts/restore-from-backup.js --env=production --backup=2025-12-23-10-00-00
```

## 文件说明

### 核心脚本

- **backup-before-migration.js**: 自动备份脚本
- **migrate-to-r2.js**: 主迁移脚本
- **restore-from-backup.js**: 恢复脚本

### 工具函数

- **utils/db-helper.js**: 数据库抽象层 (支持 SQLite/PostgreSQL)
- **utils/r2-uploader.js**: R2 上传封装
- **utils/backup-helper.js**: 备份工具函数
- **utils/logger.js**: 日志工具

### 状态文件

- **migration-state.json**: 迁移状态 (自动生成)

### 备份目录

- **backups/**: 存放所有备份文件

## 备份文件格式

### 数据库备份

- SQLite: `data.db.backup-YYYYMMDD-HHMMSS`
- PostgreSQL: `backup-YYYYMMDD-HHMMSS.sql`

### JSON 备份

```json
{
  "backup_metadata": {
    "backup_date": "2025-12-23T10:00:00Z",
    "total_files": 100
  },
  "files": [
    {
      "id": 1,
      "name": "example.webp",
      "url": "https://res.cloudinary.com/xxx/xxx.webp",
      ...
    }
  ]
}
```

### CSV 映射表

```csv
file_id,file_name,hash,original_url,new_url,status,migration_date,error_message
1,example.webp,abc123,https://cloudinary.com/...,https://r2.com/...,success,...
```

## 迁移状态文件

`migration-state.json` 包含:

- **migration_id**: 迁移唯一标识
- **statistics**: 成功/失败/跳过 统计
- **processed_files**: 成功迁移的文件列表
- **failed_files**: 失败文件列表 (包含错误信息)
- **skipped_files**: 跳过的文件列表 (如 Cloudinary 已删除)

## 常见问题

### Q: 迁移需要停机吗?

A: 不需要。迁移可以在 Strapi 运行时进行。

### Q: 迁移失败了怎么办?

A: 运行 `node scripts/restore-from-backup.js` 恢复到备份状态。

### Q: 可以部分迁移吗?

A: 可以。脚本支持断点续传,会跳过已处理的文件。

### Q: 缩略图会迁移吗?

A: 不会。只迁移原始文件,Strapi 会自动重新生成缩略图。

### Q: Cloudinary 什么时候可以删除?

A: 建议迁移后保留 30 天观察期,确认无问题再删除。

## 技术细节

### 并发控制

- 默认 3 个并发请求
- 避免 Cloudinary 和 R2 API 限流

### 重试机制

- 下载失败自动重试 3 次
- 使用指数退避策略

### 事务保护

- 每个文件更新使用数据库事务
- 失败自动回滚,不影响其他文件

### 大文件处理

- 超过 5MB 自动使用分块上传
- 支持最大 100MB 文件

## 支持

如有问题,请检查:
1. `migration-state.json` 中的错误信息
2. Strapi 服务器日志
3. Railway 部署日志

## 许可

MIT

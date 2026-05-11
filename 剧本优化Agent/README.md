# 剧本优化

独立的剧本优化工作台，聚焦节奏诊断、连续性检查、局部改写和资产联动。

## 本地开发

```bash
cd web
npm install
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web
```

默认访问 `http://localhost:4000`。

如果 4000 上残留了旧的 Next 进程，或需要避开旧 `.next` 锁，可用独立预览端口：

```bash
cd web
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web:preview
```

预览地址为 `http://localhost:4100/optimize`。

## 结构

| 目录 | 说明 |
|------|------|
| `web/` | 独立的 Next.js 优化工作台 |
| `agent/` | 优化相关提示词与模板 |
| `knowledge/`、`skills/` | 辅助知识与技能资源 |
| `data/` | 本地持久化数据 |

## 说明

- 这个目录从原工作台拆出，目标是把「剧本优化」作为单独项目维护。
- 首页只保留优化入口，其他历史入口不再作为主入口。
- API 设置仍通过右上角入口配置。

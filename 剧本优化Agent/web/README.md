This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

本项目本地预览固定使用 **Node 20 LTS**。`npm run dev:web` 会先检查 Node 版本、4000 端口和残留 Next 进程，并默认关闭 Next dev server source maps，避免多实例、Node 版本混用或大量 `.map` 文件读取导致预览无输出卡住。

开发环境（**端口 4000**）一条命令同时启动 Next 与 Wattpad 扒网文 API（需本机已安装 **Python 3**）：

```bash
npm install
npm run dev
```

仅启动前端（不拉 Wattpad API，扒网文不可用）：

```bash
npm run dev:web
```

若本机默认 Node 不是 20，可临时使用：

```bash
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web
```

如果 4000 上已有旧预览进程，使用独立端口和独立构建目录启动：

```bash
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run dev:web:preview
```

打开 [http://localhost:4100/optimize](http://localhost:4100/optimize)。

如果上次预览被中断，先按启动守卫提示终止残留 PID，再清理 `.next`。不要在 Next 进程仍运行时删除 `.next`。

Open [http://localhost:4000](http://localhost:4000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

The app uses system fonts to avoid external font fetching during local preview.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

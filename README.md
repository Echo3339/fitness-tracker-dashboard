# 量化·力量训练

个人健身记录与训练趋势网站，包含量化趋势、饮食源表、睡眠与身体参数展示，以及力量训练记录。

**在线演示：** [whatsup.bio](https://whatsup.bio)

<img width="1469" height="920" alt="iShot_2026-11-02_17 36 21" src="https://github.com/user-attachments/assets/8e5f2148-596e-480b-9237-f2ceebec7613" />
<img width="1469" height="921" alt="iShot_2026-11-02_17 36 33" src="https://github.com/user-attachments/assets/00ef196a-abb6-40c4-b771-699cedd6a894" />
<img width="1469" height="921" alt="iShot_2026-11-02_17 36 44" src="https://github.com/user-attachments/assets/819facbe-c7a8-4fb0-bf45-067f141d97cf" />


## 数据说明

本仓库包含我的健身与生活记录，包括工作簿、体重和身体参数、饮食、睡眠、训练及其他个人记录。数据快照来自 `whatsup.bio` 当前公开版本，截取日期为 2026-11-02。

这些记录不是虚构示例，也不是医疗建议。仓库公开后，任何人都可能下载、复制或保留副本。仓库内容按根目录 `LICENSE` 所列自定义个人非商用许可提供。

## 本地运行

需要 Node.js。可在项目根目录启动静态服务器：

```sh
python3 -m http.server 8000
```

然后打开 `http://localhost:8000`。网站使用根路径资源和数据文件，须从站点根目录访问。

## 构建与测试

```sh
node deploy/build-app.mjs --check
node --test training-data.test.mjs
```

如需重建前端 bundle：

```sh
node deploy/build-app.mjs --build
```

构建脚本会通过 npm 使用 `deploy/release-config.json` 中固定版本的 esbuild。个人 Excel 数据生成器和生产同步工具没有包含在本仓库中。

## 第三方资源

嵌入力训页面会从 Tailwind CSS CDN 和 Google Fonts 加载资源；这些服务及其内容受各自条款和许可证约束，不由本仓库的 `LICENSE` 重新许可。

## 许可

本项目使用自定义个人非商用许可，不是标准 OSI 开源许可。使用范围及限制以根目录 `LICENSE` 为准。

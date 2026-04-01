# AB 实验可视化看板

这是一个可直接静态托管的 AB 实验分析页面，上传 Excel / CSV 后即可完成：

- 智能识别实验字段、日期、组别、维度和指标
- 维度值筛选、实验组/对照组配置
- 自定义统计量与公式
- 折线图 / 柱状图 / 饼图切换
- 页面截图和汇总导出

## 线上访问地址

启用 GitHub Pages 后，默认访问地址会是：

[https://feefw3582-max.github.io/crmlirui/](https://feefw3582-max.github.io/crmlirui/)

## 启用方式

1. 进入仓库 `Settings`
2. 打开 `Pages`
3. 在 `Build and deployment` 中选择 `Deploy from a branch`
4. Branch 选择 `main`
5. Folder 选择 `/ (root)`
6. 点击 `Save`

通常几分钟后即可通过上面的链接访问。

## 仓库说明

- `index.html`：站点入口，自动跳转到看板页
- `ab-dashboard.html`：主页面
- `ab-dashboard.css`：样式
- `ab-dashboard.js`：核心逻辑
- `xlsx.full.min.js`：Excel 解析依赖
- `html2canvas.min.js`：截图依赖

## 本地预览

直接打开 `index.html` 或 `ab-dashboard.html` 即可使用。

如果要通过局域网分享，可使用项目里的本地静态服务脚本。

## 数据说明

上传的数据只在浏览器本地处理，不会自动上传到服务器。

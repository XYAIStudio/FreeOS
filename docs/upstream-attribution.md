# 上游归属、许可证与对外表述

FreeOS 是独立维护的下游项目。它在尊重上游开源许可证的前提下，将
[Octop](https://github.com/TencentCloud/Octop) 的多智能体运行基础与
[openXYOS](https://github.com/XYAIStudio/openXYOS) 的组织能力结合，并增加
FreeOS 自有的集成、治理、行业定制与独立代码导出能力。

本文件用于说明公开仓库、安装包、客户交付材料和社区宣传中应保留的事实。
它不是法律意见；涉及融资、重大客户合同、专利、跨境数据或商标授权时，应由
具备资质的法律顾问审阅实际交付物。

## 组件与许可证

| 组件 | 上游 | 许可证 | FreeOS 中的作用 |
| --- | --- | --- | --- |
| Octop | [TencentCloud/Octop](https://github.com/TencentCloud/Octop) | MIT | 多智能体运行时、Python / FastAPI 宿主、Dashboard、桌面与兼容层 |
| openXYOS | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS) | Apache-2.0 | 组织模型、智能体蓝图、治理与组织本机定制模块 |
| FreeOS | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS) | MIT + Apache-2.0 组件声明 | 集成桥接、产品流程、行业能力、治理、打包与导出 |

Octop 的 MIT 许可证允许商业使用、修改、分发、再授权与销售；再分发时必须保留
版权声明和许可证文本。openXYOS 的 Apache-2.0 组件必须连同其许可证、NOTICE
及适用的归属信息一并保留。权威文件见根目录
[LICENSE](../LICENSE)、[NOTICE](../NOTICE)、
[`modules/openxyos/LICENSE`](../modules/openxyos/LICENSE) 和
[`modules/openxyos/NOTICE`](../modules/openxyos/NOTICE)。

## 商标与身份边界

- FreeOS 不是 Octop 官方发行版，也不宣称获得腾讯云、Octop 官方的认可、认证、
  赞助或支持。
- `Octop` 仅作为上游项目名称和兼容性标识出现；不得将其用于暗示官方合作或产品认证。
- `openXYOS` / `XYOS` 仅用于准确说明来源和组件关系。涉及官方 Logo、官方发行标识、
  域名、官方支持或认证的使用，须遵循
  [`modules/openxyos/TRADEMARKS.md`](../modules/openxyos/TRADEMARKS.md) 并取得必要授权。
- 对外应使用 FreeOS 自己的产品名称、标志、网站和支持渠道，避免让用户误以为安装包
  来自上游官方。
- 产品意图（双身份、Node 只是桥、迁入宿主）见
  [产品契约](product-contract.zh-CN.md)，不要与本文件的许可证/商标边界混淆。

## 发行与交付清单

每一次源码、Docker 镜像、Windows 安装包、便携包或客户导出项目发布前，确认：

1. 随包包含 `LICENSE`、`NOTICE` 和适用的第三方许可证文本。
2. README、安装页和销售材料准确描述“基于 Octop 的 MIT 代码二次开发”及
   “包含 openXYOS Apache-2.0 组件”，不暗示官方背书。
3. 保留对上游仓库和本项目的链接，并记录本次 FreeOS 自主修改的范围。
4. 不在公开 Issue、安装包、镜像或演示资料中写入 API Key、访问令牌和真实客户数据。
5. 对新增依赖、模型服务、字体、图标和数据集执行许可证与来源检查。

## 社区交流建议

在 Octop 社区中，建议使用尊重且透明的描述：

> FreeOS 是基于 Octop MIT 开源基础的独立二次开发项目。我们保留了许可证、
> 版权声明和上游归属，并围绕本地 openXYOS 工作台、行业组织定制、知识加工、
> 治理与独立代码导出做了扩展。我们不宣称获得 Octop 或腾讯云的官方背书，
> 欢迎社区对兼容性、架构和开源治理提出建议。

仓库：[XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS)。

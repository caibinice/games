# 停车项目同款车模：赛车适配

## 来源与车型核验

输入只读来自 `E:/codes/3dSmartParking/public/models/vehicle-desktop-v3.glb` 与 `vehicle-mobile-v3.glb`，没有改动停车项目。原项目 README、`scripts/prepare-traffic.mjs` 和 `vehicle-rig-v3.json` 表明它是从用户原始外部车辆资源整理的通用精细车模，没有原作者、单独素材许可或小米 / SU7 的车型记录。

Blender 正后视图显示为**翼状车标的双门 GT 外形**，不是已核验的四门小米 SU7；因此这里仅称“停车项目同款车模”。`xiaomi-*` 是本次用户要求的集成文件名，不代表已取得品牌身份或官方授权证明。未添加/替换车标，也未伪造品牌。

## 输出

| 指标 | 桌面 | 手机 |
|---|---:|---:|
| 文件 | `../public/assets/xiaomi-desktop.glb` | `../public/assets/xiaomi-mobile.glb` |
| 文件字节 | 1,421,016 | 1,007,452 |
| 三角面 | 24,221 | 21,249 |
| Mesh / primitive | 5 / 14 | 5 / 14 |
| 嵌入贴图 | 4×1024² + 3×512² | 4×512² + 3×256² |
| 基级 RGBA 估算 | 19 MiB | 4.75 MiB |

全部图片自包含，使用常规 JPEG，无远程贴图、Draco、KTX2 或额外解码器。手机保留原 LOD 全部几何、UV、法线和轮毂细节，仅缩小贴图，基础纹理显存估算降低 75%；mipmap、驱动上传、阴影与后处理不计入此数值，不把该估算当成真实设备 FPS。

14 primitives 是单次颜色渲染提交的基准估计。Three.js 双面透明玻璃可能再分前后面绘制，阴影 / 深度 / 后处理也会增加调用。游戏若需进一步压缩成本，优先只让主车投影、交通车实例化并降低设备像素比，而不是继续破坏本车细节。

## 坐标、节点和材质接口

- glTF：**+Z 正前、+Y 向上**，车底 Y=0，XZ 居中。行进方向采用 -Z 时只需在外层 `rotateY(Math.PI)`。
- 世界包围盒 `min=(-1.0919928108,0,-2.5)`，`max=(1.0919928108,1.3581872299,2.5)`；宽 / 高 / 长约 `2.18399 / 1.35819 / 5`。
- 根节点 `vehicle-root`；四轮 `vehicle-wheel-0`、`vehicle-wheel-1` 为前轮，`vehicle-wheel-2`、`vehicle-wheel-3` 为后轮。车轮绕局部 X 转动，保持原层级与轮轴位置。
- 换色材质 **`xiaomi-paint`**，初始基色 `(.24,.62,.75,1)`，继承停车项目青蓝色规则；PBR 金属度 .68，粗糙度桌面 .30 / 手机 .38。原车漆贴图保留，换色可直接修改 `material.color`。
- 玻璃 **`xiaomi-glass`**：BLEND，alpha=.48，金属度 .08、粗糙度 .15。停车项目原运行时为 alpha=.35，本版稍深以保持追车视角层次。
- `xiaomi-rims` 为轮毂，`xiaomi-tyres` 为橡胶，其余保留 `xiaomi-vehicle-detail-*` 名称。
- 隐身效果需要遍历全部 Mesh 的材质并先记住各自原始 opacity / transparent / depthWrite；恢复时逐件还原，尤其玻璃原始 opacity 不是 1。不要只改车漆。

## 可复现与校验

利用原项目**已安装**的 glTF-Transform / sharp，只读加载模块，不修改任何依赖或 package：

```powershell
node games/racer/art/xiaomi-build.mjs --source-root E:/codes/3dSmartParking
```

脚本锁定输入 SHA256，逐 primitive 核验导出前后的索引、POSITION、NORMAL、UV 等数值完全不变，并重新读取实际输出以验证三角数、材质、纹理尺寸、包围盒与自包含性。完整哈希及指标在 `xiaomi-assets.json`。

独立 Blender 导入 / 正后视预览：

```powershell
& E:/Documents/AI/codex/apps/blender-4.5.14-windows-x64/blender.exe -b --python-exit-code 1 --python games/racer/art/xiaomi-preview.py -- E:/codes/games/games/racer/public/assets/xiaomi-mobile.glb E:/Documents/AI/codex/tmp/racer-upgrade-20261018/model
```

核验 PNG 和 Blender 审计 JSON 仅写到上述临时目录，未带进运行包。原 GLB / 贴图没有覆盖。仅新增本组模型、构建脚本、预览脚本与说明，没有改玩法、场景、UI 或 credits。

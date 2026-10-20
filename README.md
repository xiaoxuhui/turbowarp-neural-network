# 神经网络实验室

一个可以在 TurboWarp 中直接运行的原生积木作品。单个数字输入，单个数字输出；1–6–1 多层神经网络，包含真实反向传播，不是查表。

打开 **dist/neural-network.sb3**，点击绿旗开始。

- **重置**：清空样本、权重、轮次与预测，开始新一轮学习。
- **训练**：先输入 x，再输入希望得到的 y；网络会把本轮已有样本一起学习 600 轮。
- **测试**：输入 x，显示预测输出；不改变训练样本和权重。

也可以使用键盘 1 / 2 / 3 对应三个按钮。输入过程中其他操作会被忽略，先完成当前问题。

试一试：依次训练 `0 → 0`、`1 → 2`、`2 → 4`，然后测试 `1.5`，本版预测约 **3.0692**。预测是近似值，训练范围之外尤其不保证准确。测试值和训练数字均限定在 -1000～1000，支持负数、小数；最多保存 32 个不同输入，相同输入会更新目标输出。

**dist/neural-network-trained-example.sb3** 是已经训练上述样本的演示存档。导入后可直接点“测试”；点击绿旗或重置会清空本轮模型。

作品只用标准 Scratch 积木，无扩展、网络调用或外部模型；已在 TurboWarp 实测，Scratch 官网兼容性尚未单独测试。测试、指标、造型和网络计算都保存在 SB3 中。

## 本地构建与验证

```powershell
Set-Location 'D:\soft\turbowarp-neural-network'
node --test tests/*.test.mjs
node src/build-project.mjs
node scripts/test-editor.mjs
```

工具链复用已建立的 `D:\soft\turbowarp-codex-bridge` 环境；项目只有固定版本 JSZip 3.10.1。测试浏览器脚本只读复用兄弟工程的 Playwright 与 Chromium 配置，并使用独立浏览器上下文。本机 Windows 执行沙箱可能阻止 Chromium，需要批准单次在该执行沙箱外运行，仍保留 Chromium 自身沙箱。

数值基准在 src/network.mjs；实际作品计算由 src/build-project.mjs 生成的原生积木执行。测试会把二者的全部权重作数值比较。过程与证据见 doc/、evidence/。构建产物 manifest 包含 SHA-256，可重新生成与核对。

所有变更仅在本地 Git 保存；没有创建远端、推送或发布。

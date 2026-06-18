# 3Dキャラモデル（生成AIワークスペース）

`gen-ai-workspace` の 3D 表示は次の順で読み込みます。

1. `models/gen-ai-avatar-prototype.glb`（このフォルダに配置した独自 glTF/GLB）
2. Three.js サンプル `RobotExpressive.glb`（CDN / threejs.org）
3. 上記が失敗した場合は **プロシージャル顔**（コード生成）にフォールバック

## 推奨

- 形式: **glTF / GLB**
- **Blend Shape（モーフ）** があると口パク・表情が自然になります
  - 例: `mouthOpen`, `mouthSmile`, `eyesClosed`, `surprised`, `sad`

独自モデルを使う場合は `gen-ai-avatar-prototype.glb` として保存してください。

export const DEFAULT_DRAFT_PROMPT = `根据当前书籍项目生成剪映草稿：

1. 使用 create_draft 创建一个 1080:1920 的竖屏草稿。
2. 使用 add_videos 添加当前项目在第一步选择的片头视频，并以 60% 音量保留片头原声（volume 0.6）。
3. s0、s1 只添加字幕和旁白，画面使用片头视频，不添加配图；s2 从片头结束后开始，单独添加书籍主视觉图片并只朗读书名；然后按顺序添加 s3–s6。
4. 使用 add_keyframes 为每张配图随机组合缩放、横移、纵移和轻微旋转动画，每次生成使用不同组合。
5. 使用 add_captions 添加标题，标题为《书名》，从 s2 书名分镜第一帧开始并持续显示到视频结束：
border_color #000000
font 思源黑体
font_size 16
line_spacing 10
text_color #fff7e6
transform_y 1420
has_shadow true
shadow_color #000000
shadow_alpha 0.65
shadow_diffuse 8
shadow_distance 3
shadow_angle -45
6. 使用 add_captions 添加作者，作者同样从 s2 书名分镜第一帧开始并持续显示到视频结束；长作者信息自动缩小字号并在标点处均衡换行：
border_color #000000
font 思源黑体
font_size 9
line_spacing 10
text_color #ffe2a6
transform_y 1080
7. 使用 add_captions 按分镜顺序添加字幕。s0、s1 使用片头分配的时间范围，s2–s6 使用对应旁白的真实音频时间范围：
border_color #000000
font 思源黑体
font_size 10
line_spacing 6
text_color #ffffff
transform_y -1280
has_shadow true
shadow_color #000000
shadow_alpha 0.8
shadow_diffuse 6
shadow_distance 3
shadow_angle -45
8. 使用系统从本地音频读取的真实时长调用 add_audios；s0、s1 必须完整落在片头内，s2–s6 从片头结束后连续添加。
9. 使用 save_draft 保存并返回剪映草稿链接。

只能使用当前项目 ID 下的素材，不得使用其他书籍项目的内容。`;

export function upgradeDraftPrompt(value?: string) {
  if (!value) return DEFAULT_DRAFT_PROMPT;
  // Migrate only the old built-in preset. Custom user styling remains untouched.
  const oldBuiltInPreset = /font 江湖体\s*\nfont_size 22[\s\S]*?text_color #ffffff[\s\S]*?transform_y 1450[\s\S]*?font 江湖体\s*\nfont_size 12[\s\S]*?text_color #ffde00[\s\S]*?transform_y 1050[\s\S]*?font 江湖体\s*\nfont_size 12[\s\S]*?text_color #ffde00[\s\S]*?transform_y -1200/;
  if (oldBuiltInPreset.test(value)) return DEFAULT_DRAFT_PROMPT;
  const previousBuiltInPreset = /font 思源黑体\s*\nfont_size 16[\s\S]*?text_color #fff7e6[\s\S]*?transform_y 1420[\s\S]*?font 思源黑体\s*\nfont_size 9[\s\S]*?text_color #ffe2a6[\s\S]*?transform_y 1240[\s\S]*?font 思源黑体\s*\nfont_size 10[\s\S]*?text_color #ffffff[\s\S]*?transform_y -1280/;
  if (previousBuiltInPreset.test(value)) return DEFAULT_DRAFT_PROMPT;
  let prompt = value.replace(/(添加标题[\s\S]*?font_size\s+)15\b/, (_, prefix: string) => `${prefix}16`);
  prompt = prompt.replace(/(添加标题[\s\S]*?transform_y\s+)1369\b/, (_, prefix: string) => `${prefix}1420`);
  prompt = prompt.replace(/(添加作者[\s\S]*?transform_y\s+)1150\b/, (_, prefix: string) => `${prefix}1240`);
  const titleStart = prompt.indexOf("添加标题");
  const authorStart = prompt.indexOf("添加作者", titleStart + 1);
  const titleBlock = titleStart >= 0 ? prompt.slice(titleStart, authorStart > titleStart ? authorStart : undefined) : "";
  if (titleBlock && !/has_shadow\s+/i.test(titleBlock)) {
    prompt = prompt.replace("transform_y 1450", "transform_y 1450\nhas_shadow true\nshadow_color #000000\nshadow_alpha 0.9\nshadow_diffuse 15\nshadow_distance 5\nshadow_angle -45");
  }
  return prompt;
}

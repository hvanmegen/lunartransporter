// Render options UI to a canvas context.
export function renderOptions(ctx, optionsState, { width = ctx.canvas.width, height = ctx.canvas.height } = {}) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titleY = height * 0.22;
  const listY = height * 0.42;
  const lineHeight = 34;

  ctx.fillStyle = "#e6eef7";
  ctx.font = "600 34px system-ui";
  ctx.fillText(optionsState.title, width / 2, titleY);

  ctx.font = "500 18px system-ui";

  optionsState.items.forEach((item, index) => {
    const y = listY + index * lineHeight;
    const isSelected = index === optionsState.selectedIndex;

    if (item.type === "spacer") {
      return;
    }

    if (isSelected) {
      ctx.fillStyle = "#32404f";
      ctx.fillRect(width / 2 - 220, y - 14, 440, 28);
      ctx.fillStyle = "#f8fbff";
    } else {
      ctx.fillStyle = "#b8c4cf";
    }

    const text = item.value ? `${item.label}: ${item.value}` : item.label;
    ctx.fillText(text, width / 2, y);
  });

  renderControls(ctx, optionsState.controls, width, height);

  ctx.font = "400 14px system-ui";
  ctx.fillStyle = "#9fb1c2";
  ctx.fillText("Left/Right to adjust · Enter to apply · Esc to go back", width / 2, height * 0.78);

  if (optionsState.message) {
    ctx.font = "400 16px system-ui";
    ctx.fillStyle = "#f6c453";
    ctx.fillText(optionsState.message, width / 2, height * 0.84);
  }

  ctx.restore();
}

function renderControls(ctx, sections, width, height) {
  if (!sections || sections.length === 0) {
    return;
  }

  const startY = height * 0.62;
  let y = startY;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  sections.forEach((section, index) => {
    ctx.font = "600 14px system-ui";
    ctx.fillStyle = "#cfd8e3";
    ctx.fillText(section.label, width / 2, y);
    y += 18;

    ctx.font = "400 13px system-ui";
    ctx.fillStyle = "#aab7c4";

    section.items.forEach((line) => {
      ctx.fillText(line, width / 2, y);
      y += 16;
    });

    if (index < sections.length - 1) {
      y += 10;
    }
  });
}

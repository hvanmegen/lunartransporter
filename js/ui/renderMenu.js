// Render menu UI to a canvas context.
export function renderMenu(ctx, menuState, { width = ctx.canvas.width, height = ctx.canvas.height } = {}) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titleY = height * 0.25;
  const listY = height * 0.45;
  const lineHeight = 34;

  ctx.fillStyle = "#e6eef7";
  ctx.font = "600 36px system-ui";
  ctx.fillText(menuState.title, width / 2, titleY);

  menuState.items.forEach((item, index) => {
    const y = listY + index * lineHeight;
    const isSelected = index === menuState.selectedIndex;
    const isDisabled = Boolean(item.disabled);
    const isSpacer = item.type === "spacer";

    if (isSpacer) {
      return;
    }

    ctx.font = item.isActive ? "700 20px system-ui" : "500 20px system-ui";

    if (isSelected) {
      ctx.fillStyle = "#32404f";
      ctx.fillRect(width / 2 - 140, y - 14, 280, 28);
      ctx.fillStyle = "#f8fbff";
    } else {
      ctx.fillStyle = isDisabled ? "#6f7a86" : "#b8c4cf";
    }

    if (isDisabled) {
      ctx.globalAlpha = isSelected ? 0.6 : 0.45;
    }

    ctx.fillText(item.label, width / 2, y);

    if (isDisabled) {
      ctx.globalAlpha = 1;
    }
  });

  if (menuState.message) {
    ctx.font = "400 16px system-ui";
    ctx.fillStyle = "#f6c453";
    ctx.fillText(menuState.message, width / 2, height * 0.82);
  }

  const inputType = menuState.inputType === "gamepad" ? "gamepad" : "keyboard";
  ctx.font = "400 14px system-ui";
  ctx.fillStyle = "#9fb1c2";
  const hint =
    inputType === "gamepad"
      ? "D-pad/Stick to move · A select · B back"
      : "Up/Down to move · Enter select · Esc back";
  ctx.fillText(hint, width / 2, height * 0.75);

  ctx.restore();
}

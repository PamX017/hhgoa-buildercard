/**
 * Canvas compositing engine for HH Goa Builder ID Card.
 *
 * Output canvas: 2046 × 3076 px (matches frame asset native resolution)
 *
 * Photo cutout coordinates (% of canvas):
 *   x: 20.23% – 79.37%  →  px: 414 – 1624  (width: 1210)
 *   y: 32.38% – 56.57%  →  px: 996 – 1740  (height: 744)
 *
 * Layer order:
 *   1. User photo (behind frame)
 *   2. Frame PNG overlay (hh-goa-frame-FINAL.png)
 *   3. Dynamic text: Name, Role, Builder ID
 */

export const CANVAS_W = 2046;
export const CANVAS_H = 3076;

// Photo cutout as percentages (from spec)
const CUTOUT_X1_PCT = 0.2023;
const CUTOUT_X2_PCT = 0.7937;
const CUTOUT_Y1_PCT = 0.3238;
const CUTOUT_Y2_PCT = 0.5657;

// Computed pixel positions at native resolution
const CUTOUT_X = Math.round(CANVAS_W * CUTOUT_X1_PCT);
const CUTOUT_Y = Math.round(CANVAS_H * CUTOUT_Y1_PCT);
const CUTOUT_W = Math.round(CANVAS_W * (CUTOUT_X2_PCT - CUTOUT_X1_PCT));
const CUTOUT_H = Math.round(CANVAS_H * (CUTOUT_Y2_PCT - CUTOUT_Y1_PCT));

// Text placement Y positions (% of canvas height, tuned to the frame layout)
const NAME_Y_PCT = 0.615;       // In the scroll/banner area below "HACKER गोवा HOUSE"
const ROLE_Y_PCT = 0.685;       // Centered in the gold/mustard pill badge
const BUILDER_ID_Y_PCT = 0.755; // Next to "BUILDER ID:" label

/**
 * Render the full Builder ID card.
 *
 * @param {CanvasRenderingContext2D} ctx - The 2046x3076 canvas context
 * @param {Object} options
 * @param {HTMLImageElement|null} options.userImage - The user's uploaded photo
 * @param {{ scale: number, offsetX: number, offsetY: number }} options.cropState - Crop/pan/zoom state
 * @param {HTMLImageElement|null} options.frameImage - The loaded frame PNG
 * @param {string} options.name - User's name
 * @param {string} options.role - User's selected role
 * @param {string} options.builderId - e.g. "#HH-GOA-1234"
 */
export function renderCard(ctx, { userImage, cropState, frameImage, name, role, builderId }) {
  const { canvas } = ctx;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fill background with cream (so transparent areas look right)
  ctx.fillStyle = '#F2DAB1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Layer 1: User photo ---
  if (userImage && cropState) {
    ctx.save();

    // Clip to the cutout rectangle
    ctx.beginPath();
    ctx.rect(CUTOUT_X, CUTOUT_Y, CUTOUT_W, CUTOUT_H);
    ctx.clip();

    // Calculate photo placement
    const { scale, offsetX, offsetY } = cropState;

    // The photo is scaled to fill the cutout, then adjusted by user's pan/zoom
    const imgAspect = userImage.naturalWidth / userImage.naturalHeight;
    const cutoutAspect = CUTOUT_W / CUTOUT_H;

    let drawW, drawH;
    if (imgAspect > cutoutAspect) {
      // Photo is wider than cutout — fit height, overflow width
      drawH = CUTOUT_H * scale;
      drawW = drawH * imgAspect;
    } else {
      // Photo is taller — fit width, overflow height
      drawW = CUTOUT_W * scale;
      drawH = drawW / imgAspect;
    }

    // Center the photo in the cutout, then apply user offset
    const drawX = CUTOUT_X + (CUTOUT_W - drawW) / 2 + offsetX;
    const drawY = CUTOUT_Y + (CUTOUT_H - drawH) / 2 + offsetY;

    ctx.drawImage(userImage, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // --- Layer 2: Frame overlay ---
  if (frameImage) {
    ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  }

  // --- Layer 3: Dynamic text ---
  renderTextLayers(ctx, { name, role, builderId });
}

/**
 * Render dynamic text onto the card.
 */
function renderTextLayers(ctx, { name, role, builderId }) {
  const centerX = CANVAS_W / 2;

  // --- Name ---
  if (name && name.trim()) {
    const nameY = CANVAS_H * 0.735; // Moved down to clear "HACKER GOA HOUSE"
    const maxNameWidth = CANVAS_W * 0.75; // Wider allowance

    // Auto-size: start big, shrink to fit
    let fontSize = 160;
    ctx.font = `${fontSize}px 'Bevan', serif`;
    while (ctx.measureText(name.toUpperCase()).width > maxNameWidth && fontSize > 40) {
      fontSize -= 2;
      ctx.font = `${fontSize}px 'Bevan', serif`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark green text
    ctx.fillStyle = '#0A3A1E';
    ctx.fillText(name.toUpperCase(), centerX, nameY);
  }

  // --- Role ---
  if (role && role.trim()) {
    const roleY = CANVAS_H * 0.80; // Moved down to true center of yellow pill
    const maxRoleWidth = CANVAS_W * 0.42;

    let roleFontSize = 75;
    ctx.font = `${roleFontSize}px 'Bevan', serif`;
    while (ctx.measureText(role.toUpperCase()).width > maxRoleWidth && roleFontSize > 30) {
      roleFontSize -= 2;
      ctx.font = `${roleFontSize}px 'Bevan', serif`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Darker pink/red text to make it pop against yellow
    ctx.fillStyle = '#C91A4B'; 
    ctx.fillText(role.toUpperCase(), centerX, roleY);
  }

  // --- Builder ID ---
  if (builderId) {
    const idY = CANVAS_H * 0.915; // Moved down to center between bottom braces

    // Auto-size
    let idFontSize = 150;
    ctx.font = `${idFontSize}px 'Bevan', serif`;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0A3A1E';
    ctx.fillText(builderId, centerX, idY);
  }
}

/**
 * Export canvas to a downloadable PNG Blob.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Trigger a browser file download from a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Image Renderer Service
 * Generates 1-bit BMP images for TRMNL e-ink displays
 * 
 * Output: 800x480 monochrome BMP (1-bit depth)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas } from '@napi-rs/canvas';

const WIDTH = 800;
const HEIGHT = 480;

/**
 * Create a 1-bit BMP file from pixel data
 * @param {Uint8Array} pixels - 1-bit packed pixel data (0 = black, 1 = white)
 * @returns {Buffer} - Complete BMP file
 */
function createBMP(pixels) {
  const rowSize = Math.ceil(WIDTH / 32) * 4;
  const pixelDataSize = rowSize * HEIGHT;
  const fileSize = 62 + pixelDataSize;
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  buffer.write('BM', offset); offset += 2;
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  buffer.writeUInt16LE(0, offset); offset += 2;
  buffer.writeUInt16LE(0, offset); offset += 2;
  buffer.writeUInt32LE(62, offset); offset += 4;
  buffer.writeUInt32LE(40, offset); offset += 4;
  buffer.writeInt32LE(WIDTH, offset); offset += 4;
  buffer.writeInt32LE(-HEIGHT, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(pixelDataSize, offset); offset += 4;
  buffer.writeInt32LE(2835, offset); offset += 4;
  buffer.writeInt32LE(2835, offset); offset += 4;
  buffer.writeUInt32LE(2, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(0x00000000, offset); offset += 4;
  buffer.writeUInt32LE(0x00FFFFFF, offset); offset += 4;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x += 8) {
      let b = 0;
      for (let bit = 0; bit < 8 && (x + bit) < WIDTH; bit++) {
        if (pixels[y * WIDTH + x + bit]) b |= (0x80 >> bit);
      }
      buffer.writeUInt8(b, offset++);
    }
    const pad = rowSize - Math.ceil(WIDTH / 8);
    for (let p = 0; p < pad; p++) buffer.writeUInt8(0, offset++);
  }
  return buffer;
}

function canvasTo1Bit(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const pixels = new Uint8Array(WIDTH * HEIGHT);
  for (let i = 0; i < pixels.length; i++) {
    const lum = 0.299 * imageData.data[i * 4] + 0.587 * imageData.data[i * 4 + 1] + 0.114 * imageData.data[i * 4 + 2];
    pixels[i] = lum > 128 ? 1 : 0;
  }
  return pixels;
}

export function renderTestPattern() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PTV-TRMNL TEST', WIDTH / 2, HEIGHT / 2);
  return createBMP(canvasTo1Bit(canvas));
}

export function renderDashboard(data, prefs = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(data?.current_time || '--:--', 20, 80);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('TRAINS', 30, 160);
  ctx.fillText('TRAMS', 410, 160);
  ctx.font = '20px sans-serif';
  (data?.trains || []).slice(0,4).forEach((t, i) => {
    ctx.fillText(`${t.destination || 'City'} - ${t.minutes} min`, 30, 195 + i * 30);
  });
  (data?.trams || []).slice(0,4).forEach((t, i) => {
    ctx.fillText(`${t.destination || 'Route'} - ${t.minutes} min`, 410, 195 + i * 30);
  });
  ctx.fillRect(0, HEIGHT - 35, WIDTH, 35);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('PTV-TRMNL v5.28', 680, HEIGHT - 10);
  return createBMP(canvasTo1Bit(canvas));
}

export default { renderDashboard, renderTestPattern };

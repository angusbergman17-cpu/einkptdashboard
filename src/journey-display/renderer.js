/**
 * Journey Display Server-Side Renderer
 * Renders journey display to 800x480 bitmap for e-ink
 * Copyright (c) 2025 Angus Bergman - Licensed under CC BY-NC 4.0
 */

import { createCanvas } from 'canvas';
import { TransportMode, StepStatus, JourneyStatus, DisplayRegions } from './models.js';

const DISPLAY_WIDTH = 800, DISPLAY_HEIGHT = 480;
const BLACK = '#000000', WHITE = '#FFFFFF';
const HEADER_HEIGHT = 80, STATUS_BAR_HEIGHT = 30, STATUS_BAR_Y = 80;
const STEPS_START_Y = 110, STEP_HEIGHT = 66, FOOTER_Y = 445;

const ModeIcons = {
  [TransportMode.TRAIN]: (ctx, x, y, s) => { ctx.strokeRect(x, y, s, s*0.7); ctx.fillRect(x+2, y+s*0.75, s*0.2, s*0.2); ctx.fillRect(x+s-s*0.2-2, y+s*0.75, s*0.2, s*0.2); },
  [TransportMode.TRAM]: (ctx, x, y, s) => { ctx.strokeRect(x, y+4, s, s*0.6); ctx.beginPath(); ctx.moveTo(x+s/2, y); ctx.lineTo(x+s/2, y+4); ctx.stroke(); },
  [TransportMode.BUS]: (ctx, x, y, s) => { ctx.strokeRect(x, y, s, s*0.7); ctx.fillRect(x+2, y+s*0.75, s*0.25, s*0.2); ctx.fillRect(x+s-s*0.25-2, y+s*0.75, s*0.25, s*0.2); },
  [TransportMode.WALK]: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x+s/2, y+s*0.15, s*0.12, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x+s/2, y+s*0.3); ctx.lineTo(x+s/2, y+s*0.6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+s/2, y+s*0.6); ctx.lineTo(x+s*0.3, y+s*0.95); ctx.moveTo(x+s/2, y+s*0.6); ctx.lineTo(x+s*0.7, y+s*0.85); ctx.stroke(); },
  [TransportMode.COFFEE]: (ctx, x, y, s) => { ctx.strokeRect(x+s*0.15, y+s*0.3, s*0.5, s*0.55); ctx.beginPath(); ctx.arc(x+s*0.65+s*0.12, y+s*0.55, s*0.12, -Math.PI/2, Math.PI/2); ctx.stroke(); }
};

export class JourneyDisplayRenderer {
  constructor() { this.canvas = createCanvas(DISPLAY_WIDTH, DISPLAY_HEIGHT); this.ctx = this.canvas.getContext('2d'); }
  
  render(journey) {
    const ctx = this.ctx;
    ctx.fillStyle = WHITE; ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    ctx.fillStyle = BLACK; ctx.strokeStyle = BLACK; ctx.lineWidth = 2;
    this.renderHeader(journey); this.renderStatusBar(journey); this.renderSteps(journey); this.renderFooter(journey);
    return this.canvas.toBuffer('image/png');
  }
  
  renderHeader(journey) {
    const ctx = this.ctx;
    ctx.font = 'bold 14px sans-serif'; ctx.fillText(journey.originAddress.toUpperCase(), 20, 25);
    ctx.font = 'bold 64px sans-serif'; const timeStr = journey.currentTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: false }); ctx.fillText(timeStr, 20, 70);
    ctx.font = 'bold 20px sans-serif'; ctx.fillText(journey.currentTime.getHours() < 12 ? 'AM' : 'PM', 175, 70);
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(journey.dayOfWeek, DISPLAY_WIDTH/2, 45);
    ctx.font = '18px sans-serif'; ctx.fillText(journey.dateString, DISPLAY_WIDTH/2, 68); ctx.textAlign = 'left';
    this.renderWeatherBox(journey, DISPLAY_WIDTH-140, 10);
  }
  
  renderWeatherBox(journey, x, y) {
    const ctx = this.ctx, boxWidth = 120, boxHeight = 70;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    const weather = journey.getWeatherDisplay(); ctx.fillText(weather.temp, x+boxWidth/2, y+32);
    ctx.font = '12px sans-serif'; ctx.fillText(weather.condition, x+boxWidth/2, y+48);
    ctx.font = 'bold 11px sans-serif';
    if (weather.umbrella) { ctx.fillStyle = BLACK; ctx.fillRect(x+10, y+52, boxWidth-20, 14); ctx.fillStyle = WHITE; ctx.fillText('□ BRING UMBRELLA', x+boxWidth/2, y+63); }
    else { ctx.strokeRect(x+10, y+52, boxWidth-20, 14); ctx.fillStyle = BLACK; ctx.fillText('■ NO UMBRELLA', x+boxWidth/2, y+63); }
    ctx.textAlign = 'left'; ctx.fillStyle = BLACK;
  }
  
  renderStatusBar(journey) {
    const ctx = this.ctx, y = STATUS_BAR_Y;
    ctx.fillStyle = BLACK; ctx.fillRect(0, y, DISPLAY_WIDTH, STATUS_BAR_HEIGHT);
    ctx.fillStyle = WHITE; ctx.font = 'bold 16px sans-serif'; ctx.fillText(journey.getStatusBarText(), 20, y+20);
    ctx.textAlign = 'right'; ctx.fillText(`${journey.totalDuration} min`, DISPLAY_WIDTH-20, y+20);
    ctx.textAlign = 'left'; ctx.fillStyle = BLACK;
  }
  
  renderSteps(journey) {
    const maxSteps = 5; journey.steps.slice(0, maxSteps).forEach((step, i) => this.renderStep(step, STEPS_START_Y + i*STEP_HEIGHT, i < Math.min(journey.steps.length, maxSteps)-1));
  }
  
  renderStep(step, y, showConnector) {
    const ctx = this.ctx, stepHeight = STEP_HEIGHT - 6;
    const isDelayed = step.status === StepStatus.DELAYED, isCancelled = step.status === StepStatus.CANCELLED, isSkipped = step.status === StepStatus.SKIPPED;
    
    if (isCancelled) { this.renderHatchedBackground(20, y, DISPLAY_WIDTH-40, stepHeight); ctx.globalAlpha = 0.6; }
    else if (isSkipped) { ctx.setLineDash([5, 3]); ctx.strokeRect(20, y, DISPLAY_WIDTH-40, stepHeight); ctx.setLineDash([]); ctx.globalAlpha = 0.5; }
    else if (isDelayed) { ctx.setLineDash([8, 4]); ctx.strokeRect(20, y, DISPLAY_WIDTH-40, stepHeight); ctx.setLineDash([]); }
    
    const circleX = 45, circleY = y + stepHeight/2, circleRadius = 14;
    if (isCancelled) { ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✗', circleX, circleY+5); }
    else if (isSkipped) { ctx.beginPath(); ctx.setLineDash([3, 3]); ctx.arc(circleX, circleY, circleRadius, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(step.stepNumber.toString(), circleX, circleY+5); }
    else { ctx.beginPath(); ctx.arc(circleX, circleY, circleRadius, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = WHITE; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(step.stepNumber.toString(), circleX, circleY+5); ctx.fillStyle = BLACK; }
    ctx.textAlign = 'left';
    
    const iconSize = 24, iconX = 75, iconY = y + (stepHeight-iconSize)/2; ctx.lineWidth = 2;
    const iconDrawer = ModeIcons[step.mode]; if (iconDrawer) iconDrawer(ctx, iconX, iconY, iconSize);
    
    ctx.font = 'bold 18px sans-serif'; ctx.fillText(step.title, 115, y+25);
    ctx.font = '14px sans-serif'; ctx.fillText(step.subtitle, 115, y+45);
    
    if (isDelayed && step.delayMinutes > 0) {
      ctx.font = 'bold 12px sans-serif'; const badgeText = `+${step.delayMinutes} MIN`;
      const badgeX = 115 + ctx.measureText(step.title).width + 10;
      ctx.setLineDash([4, 2]); ctx.strokeRect(badgeX, y+10, ctx.measureText(badgeText).width+10, 18); ctx.setLineDash([]);
      ctx.fillText(badgeText, badgeX+5, y+23);
    }
    
    ctx.textAlign = 'right';
    if (isCancelled) { ctx.font = 'bold 14px sans-serif'; ctx.fillText('CANCELLED', DISPLAY_WIDTH-30, y+35); }
    else { ctx.font = 'bold 28px sans-serif'; ctx.fillText(`${step.status === StepStatus.EXTENDED ? '~' : ''}${step.getDurationDisplay()}`, DISPLAY_WIDTH-30, y+32); ctx.font = '10px sans-serif'; ctx.fillText(step.getDurationLabel(), DISPLAY_WIDTH-30, y+48); }
    ctx.textAlign = 'left'; ctx.globalAlpha = 1.0;
    
    if (showConnector && !isCancelled) {
      ctx.beginPath(); ctx.moveTo(circleX, y+stepHeight); ctx.lineTo(circleX, y+STEP_HEIGHT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(circleX-5, y+STEP_HEIGHT-8); ctx.lineTo(circleX, y+STEP_HEIGHT); ctx.lineTo(circleX+5, y+STEP_HEIGHT-8); ctx.stroke();
    }
  }
  
  renderHatchedBackground(x, y, width, height) {
    const ctx = this.ctx, spacing = 8;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip(); ctx.strokeStyle = BLACK; ctx.lineWidth = 1;
    for (let i = -height; i < width+height; i += spacing) { ctx.beginPath(); ctx.moveTo(x+i, y); ctx.lineTo(x+i+height, y+height); ctx.stroke(); }
    ctx.restore(); ctx.lineWidth = 2;
  }
  
  renderFooter(journey) {
    const ctx = this.ctx, y = FOOTER_Y;
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(DISPLAY_WIDTH-20, y); ctx.stroke();
    ctx.font = 'bold 16px sans-serif'; ctx.fillText(journey.isHomebound ? `HOME — ${journey.destinationAddress}` : journey.destinationAddress.toUpperCase(), 20, y+25);
    ctx.textAlign = 'right'; ctx.font = '14px sans-serif'; ctx.fillText('ARRIVE', DISPLAY_WIDTH-80, y+15);
    ctx.font = 'bold 24px sans-serif'; ctx.fillText(journey.arrivalTime ? journey.arrivalTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: false }) : '--:--', DISPLAY_WIDTH-20, y+30);
    ctx.textAlign = 'left';
  }
  
  renderBase64(journey) { return this.render(journey).toString('base64'); }
}

export default JourneyDisplayRenderer;

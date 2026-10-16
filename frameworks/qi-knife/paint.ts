import { PAL } from '../../components/paint/palette';

type C = CanvasRenderingContext2D;
export function grain(c: C, x: number, y: number, count: number, width = 90) {
  c.fillStyle = PAL.millet;
  for (let i = 0; i < count; i++) {
    const col = i % 9, row = Math.floor(i / 9);
    c.beginPath(); c.ellipse(x + (col - 4) * width / 10 + (row % 2) * 3, y - row * 6, 3.2, 1.8, -0.4, 0, Math.PI * 2); c.fill();
  }
}
export function person(c: C, x: number, y: number, scale = 1, robe: string = PAL.ochre) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  c.fillStyle = robe;
  c.beginPath(); c.moveTo(-9, -48); c.quadraticCurveTo(-21, -15, -25, 0); c.lineTo(23, 0); c.quadraticCurveTo(13, -30, 8, -48); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-6, -40); c.lineTo(-26, -20); c.lineTo(-2, -24); c.fill();
  c.fillStyle = PAL.silkDim; c.beginPath(); c.ellipse(1, -59, 8, 10, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = PAL.lacquer2; c.fillRect(-7, -72, 14, 8);
  c.restore();
}
export function sack(c: C, x: number, y: number, size = 1) {
  c.save(); c.translate(x, y); c.scale(size, size);
  c.fillStyle = PAL.ochre; c.strokeStyle = PAL.gold; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-18, -52); c.quadraticCurveTo(-5, -45, 17, -52); c.lineTo(12, -41); c.bezierCurveTo(45, -9, 28, 6, 0, 5); c.bezierCurveTo(-32, 4, -40, -15, -12, -41); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-17, -42); c.lineTo(15, -42); c.moveTo(-16, -29); c.lineTo(-10, -5); c.moveTo(14, -29); c.lineTo(19, -10); c.stroke();
  grain(c, 0, -5, 12, 28); c.restore();
}
export function knife(c: C, x: number, y: number, size = 1) {
  c.save(); c.translate(x, y); c.scale(size, size); c.strokeStyle = PAL.gold; c.fillStyle = PAL.bronze; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-8, 24); c.lineTo(-9, -34); c.quadraticCurveTo(-8, -57, 12, -69); c.quadraticCurveTo(7, -40, 7, 24); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.arc(0, 35, 12, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = PAL.lacquer; c.beginPath(); c.arc(0, 35, 6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-1, -37); c.lineTo(-1, 15); c.stroke(); c.restore();
}
export function gate(c: C, x: number, y: number, open: number) {
  c.save(); c.translate(x, y); c.fillStyle = PAL.umber; c.fillRect(-67, -112, 134, 116);
  c.fillStyle = PAL.lacquer; c.fillRect(-54, -99, 108, 103);
  c.fillStyle = PAL.cinnabar; c.strokeStyle = PAL.gold; c.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    const w = 51 * (1 - open * 0.84);
    c.fillRect(side < 0 ? -53 : 53 - w, -98, w, 102);
    c.strokeRect(side < 0 ? -53 : 53 - w, -98, w, 102);
  }
  c.fillStyle = PAL.ochre; c.beginPath(); c.moveTo(-86, -111); c.lineTo(0, -139); c.lineTo(86, -111); c.closePath(); c.fill(); c.restore();
}

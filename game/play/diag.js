// Display check (Daniel, 18.11.2026: „sieht alles unscharf und verwaschen aus“ on an iPad): game.html?camp&diag shows the real numbers of
// this device in a box at the top: window and visual viewport, pixel density, the canvas (pixels and size on screen), the game size,
// the camera zoom, the renderer and how tall Leyla is on screen. Updates twice a second; a tap on the box copies the text.
export function showDiag(game) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99;margin:0;padding:8px 12px;border-radius:8px;background:rgba(13,10,18,.88);color:#7ff6ff;font:13px/1.35 ui-monospace,monospace;pointer-events:auto;white-space:pre';
  document.body.append(box);
  const tick = () => {
    const c = game.canvas, r = c.getBoundingClientRect(), vv = window.visualViewport, s = game.scene.getScene('play'), cam = s?.cam || s?.cameras?.main, l = s?.leyla?.sprite;
    const lyH = l ? Math.round(l.displayHeight * (cam?.zoom || 1) * r.height / c.height) : null;
    box.textContent = [
      `Fenster ${innerWidth}×${innerHeight} · sichtbar ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} Zoom ${vv.scale.toFixed(2)}` : '–'} · Dichte ${devicePixelRatio}`,
      `Dokument ${document.documentElement.clientWidth}×${document.documentElement.clientHeight} · Scrollbreite ${document.documentElement.scrollWidth}`,
      `Leinwand ${c.width}×${c.height} Pixel · auf dem Schirm ${Math.round(r.width)}×${Math.round(r.height)} bei ${Math.round(r.left)},${Math.round(r.top)}`,
      `Spiel ${game.scale.width}×${game.scale.height} · Kamera-Zoom ${cam?.zoom ?? '–'} · ${game.renderer.type === 2 ? 'WebGL' : 'Canvas'} · Leyla ${lyH ?? '–'} px hoch auf dem Schirm`,
      `Daten: ${window.__nomadData?.commit ? `Repository ${window.__nomadData.commit.slice(0, 7)}` : 'ausgelieferte Dateien'}${window.__nomadData?.drafts?.length ? ` + lokale Werkstatt-Entwürfe: ${window.__nomadData.drafts.join(', ')}` : ''}`,
      navigator.userAgent.slice(0, 120),
    ].join('\n');
  };
  box.addEventListener('click', () => navigator.clipboard?.writeText(box.textContent));
  tick(); setInterval(tick, 500);
}

import type { Slider } from "@incantly/scene";

export function ScalarSliders({ sliders, playing, onChange, onPlay, onReset }: {
  sliders: readonly Slider[];
  playing: ReadonlySet<string>;
  onChange: (slider: Slider) => void;
  onPlay: (name: string) => void;
  onReset: (name: string) => void;
}) {
  return <>{sliders.map((slider) => <div className="slider-block" key={slider.name}>
    <div className="slider-label"><span>{slider.name}</span><output>{slider.value.toFixed(2)}</output></div>
    <div className="slider-actions"><button type="button" aria-label={`${playing.has(slider.name) ? "Pause" : "Play"} ${slider.name}`} onClick={() => onPlay(slider.name)}>{playing.has(slider.name) ? "Ⅱ" : "▶"}</button><button type="button" aria-label={`Reset ${slider.name}`} onClick={() => onReset(slider.name)}>↺</button></div>
    <input aria-label={`Slider ${slider.name}`} type="range" min={slider.min} max={slider.max} step={slider.step} value={slider.value} onChange={(event) => onChange({ ...slider, value: Number(event.target.value) })} />
    <div className="slider-limits"><input aria-label={`${slider.name} minimum`} type="number" step="any" value={slider.min} onChange={(event) => { const min = Number(event.target.value); if (Number.isFinite(min) && min < slider.max) onChange({ ...slider, min, value: Math.max(min, slider.value) }); }} /><span>≤ {slider.name} ≤</span><input aria-label={`${slider.name} maximum`} type="number" step="any" value={slider.max} onChange={(event) => { const max = Number(event.target.value); if (Number.isFinite(max) && max > slider.min) onChange({ ...slider, max, value: Math.min(max, slider.value) }); }} /></div>
    <label className="slider-step">Step <input aria-label={`${slider.name} step`} type="number" min="0.0001" step="any" value={slider.step} onChange={(event) => { const step = Number(event.target.value); if (Number.isFinite(step) && step > 0) onChange({ ...slider, step }); }} /></label>
    <label className="slider-step">Playback <select aria-label={`${slider.name} playback mode`} value={slider.mode} onChange={(event) => onChange({ ...slider, mode: event.target.value as Slider["mode"] })}><option value="pingPong">Loop forward and backward</option><option value="repeat">Repeat one direction</option><option value="once">Play once</option><option value="indefinite">Play indefinitely</option></select></label>
    <label className="slider-step">Speed <input aria-label={`${slider.name} speed`} type="number" min="0.01" max="100" step="0.1" value={slider.speed} onChange={(event) => { const speed = Number(event.target.value); if (Number.isFinite(speed) && speed > 0 && speed <= 100) onChange({ ...slider, speed }); }} /></label>
  </div>)}</>;
}

import type { AudioOutput } from "@incantly/scene";

/** Browser-only adapter. Construct from a user gesture; the portable SDK owns voice policy. */
export function createWebAudioOutput(): AudioOutput {
  const context = new AudioContext();
  const voices = new Map<string, { oscillator: OscillatorNode; gain: GainNode }>();
  let disposed = false;
  return {
    start(id, frequency, gain) {
      if (disposed || voices.has(id)) return;
      void context.resume();
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.frequency.value = frequency;
      volume.gain.value = gain;
      oscillator.connect(volume).connect(context.destination);
      oscillator.start();
      voices.set(id, { oscillator, gain: volume });
    },
    update(id, frequency, gain) {
      const voice = voices.get(id);
      if (!voice || disposed) return;
      voice.oscillator.frequency.setTargetAtTime(frequency, context.currentTime, 0.01);
      voice.gain.gain.setTargetAtTime(gain, context.currentTime, 0.01);
    },
    stop(id) {
      const voice = voices.get(id);
      if (!voice) return;
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.gain.disconnect();
      voices.delete(id);
    },
    dispose() {
      if (disposed) return;
      for (const id of [...voices.keys()]) this.stop(id);
      disposed = true;
      void context.close();
    },
  };
}

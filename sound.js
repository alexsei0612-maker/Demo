'use strict';

const iceSound = (() => {
  let audio;
  let noiseBuffer;
  let mix;
  let music;
  let musicStarted = false;
  const musicVolume = .31;

  function initialize() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;

    audio = new AudioContext();
    mix = audio.createGain();
    mix.gain.value = .66;
    mix.connect(audio.destination);
    music = audio.createGain();
    music.gain.value = musicVolume;
    music.connect(mix);
    noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .45), audio.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    return true;
  }

  function crack(at, duration, frequency, volume) {
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const envelope = audio.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = .84;
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(frequency * .5, at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .003);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(envelope).connect(mix);
    source.start(at, Math.random() * .08, duration);
  }

  function ring(at, frequency, endFrequency, duration, volume, attack = .007, output = mix) {
    const context = output.context;
    const source = context.createOscillator();
    const envelope = context.createGain();
    source.frequency.setValueAtTime(frequency, at);
    source.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(envelope).connect(output);
    source.start(at);
    source.stop(at + duration);
  }

  async function startMusic() {
    if (musicStarted) return;
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineContext) return;
    musicStarted = true;

    const beat = 60 / 114;
    const bars = [
      [[74, 78, 81, 78, 76], [50, 57, 62, 66]],
      [[74, 71, 74, 78, 81], [47, 54, 59, 62]],
      [[83, 81, 79, 74, 71], [43, 50, 55, 59]],
      [[73, 76, 81, 79, 76], [45, 52, 57, 61]],
      [[74, 78, 81, 86, 81], [50, 57, 62, 66]],
      [[83, 78, 76, 74, 71], [47, 54, 59, 62]],
      [[79, 76, 74, 73, 76], [43, 50, 55, 59]],
      [[81, 76, 73, 74], [45, 52, 57, 61]]
    ];
    const sampleRate = audio.sampleRate;
    const score = new OfflineContext(1, Math.round(bars.length * 4 * beat * sampleRate), sampleRate);
    const output = score.destination;
    const hz = note => 440 * 2 ** ((note - 69) / 12);
    bars.forEach(([melody, harmony], bar) => {
      const start = bar * 4 * beat;
      melody.forEach((note, index) => {
        const onset = start + [0, .75, 1.5, 2.5, 3.25][index] * beat;
        const pitch = hz(note);
        ring(onset, pitch, pitch, .34, index === 0 ? .30 : .23, .009, output);
        ring(onset, pitch * 2.01, pitch * 2, .16, .071, .004, output);
        ring(onset, pitch * 3.02, pitch * 3, .085, .033, .003, output);
      });
      harmony.forEach((note, index) => {
        const pitch = hz(note);
        ring(start + index * beat, pitch, pitch, .43, index === 0 ? .28 : .137, .024, output);
      });
    });

    const loop = audio.createBufferSource();
    loop.buffer = await score.startRendering();
    loop.loop = true;
    loop.connect(music);
    loop.start();
  }

  return {
    async hit(stage) {
      try {
        if (!audio && !initialize()) return;
        if (audio.state !== 'running') await audio.resume();
        void startMusic().catch(() => { musicStarted = false; });
        const at = audio.currentTime + .008;
        const release = stage === 4;
        crack(at, .07 + stage * .018, 4100 - stage * 470, .28 + stage * .09);
        ring(at, 225 - stage * 16, 82, .18, .041 + stage * .014);

        for (let i = 1; i < stage + 1; i++) {
          crack(at + .024 * i, .036 + i * .014, 4600 - i * 220, .23 / (1 + i * .34));
        }
        if (release) {
          music.gain.cancelScheduledValues(at);
          music.gain.setTargetAtTime(.10, at, .035);
          music.gain.setTargetAtTime(musicVolume, at + .63, .25);
          crack(at + .044, .31, 770, .33);
          ring(at + .045, 115, 47, .36, .16);
          [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
            const onset = at + .11 + index * .052;
            ring(onset, frequency, frequency, .67 - index * .045, .082, .023);
            ring(onset, frequency * 2.01, frequency * 2, .38, .032);
          });
        }
      } catch {
        // The banner remains interactive when the browser blocks or lacks audio.
      }
    }
  };
})();


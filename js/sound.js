// Sea and seagull sounds, all made live with the Web Audio API: no sound files to download.
// Rolling surf is shaped noise with waves that swell and wash out; wind rises during the dive from
// the clouds; gulls call now and then in the distance, close by as the bird reaches each island,
// and once more as it lands. Starts silent; the visitor turns it on with the sound button.

/** Creates the soundscape on an AudioContext that was created and resumed inside a tap (see main.js).
    Call update(film) every frame and setOn(true/false) from the button. */
export function createSound(ctx) {
  let master, surfGain, surfFilter, washGain, washFilter, windGain, windFilter;
  let on = false, nextWave = 0, nextDistant = 0, lastStop = -1, landed = false;

  /** Builds the audio graph. */
  function build() {
    // A gentle limiter keeps waves and calls from clipping on small phone speakers
    const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -10; limit.ratio.value = 6; limit.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(limit);
    // Four seconds of brown-ish noise, looped: the raw material for surf and wind
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.08; }
    }
    const noise = (rate) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    // Low, steady roar of the open sea
    surfFilter = ctx.createBiquadFilter(); surfFilter.type = 'lowpass'; surfFilter.frequency.value = 900;
    surfGain = ctx.createGain(); surfGain.gain.value = 0.55;
    noise(1).connect(surfFilter).connect(surfGain).connect(master);
    // Waves: a brighter wash that swells and fades on its own rhythm
    washFilter = ctx.createBiquadFilter(); washFilter.type = 'bandpass'; washFilter.frequency.value = 700; washFilter.Q.value = 0.6;
    washGain = ctx.createGain(); washGain.gain.value = 0.05;
    noise(0.83).connect(washFilter).connect(washGain).connect(master);
    // Wind rushing past during the dive
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 900; windFilter.Q.value = 1.2;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    noise(1.37).connect(windFilter).connect(windGain).connect(master);
  }

  /** One gull call ("kee-ow"): a rasping glide down in pitch, shaped like a voice. */
  function call(when, pitch, dur, level, pan) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), rasp = ctx.createOscillator(), raspAmt = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    [o1, o2].forEach((o, k) => {
      const f = o.frequency, p = pitch * (k ? 1.006 : 1);
      f.setValueAtTime(p * 0.8, when);
      f.linearRampToValueAtTime(p * 1.22, when + dur * 0.18);
      f.exponentialRampToValueAtTime(p * 0.7, when + dur);
    });
    rasp.frequency.value = 38 + Math.random() * 20; raspAmt.gain.value = pitch * 0.04;
    rasp.connect(raspAmt); raspAmt.connect(o1.frequency); raspAmt.connect(o2.frequency);
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    const formant = ctx.createBiquadFilter(); formant.type = 'bandpass'; formant.frequency.value = pitch * 2.1; formant.Q.value = 2.2;
    const air = ctx.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 2400 + level * 3000; // distant calls are duller
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(level, when + 0.03);
    env.gain.setValueAtTime(level, when + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o1.connect(mix); o2.connect(mix); mix.connect(formant).connect(air).connect(env);
    if (pn) { pn.pan.value = pan; env.connect(pn).connect(master); } else env.connect(master);
    [o1, o2, rasp].forEach((o) => { o.start(when); o.stop(when + dur + 0.05); });
  }
  /** A short burst of calls, the way gulls repeat themselves. */
  function calls(n, level, pan) {
    let t = ctx.currentTime + 0.05;
    const pitch = 900 + Math.random() * 350;
    for (let i = 0; i < n; i++) {
      const dur = i === 0 ? 0.5 + Math.random() * 0.15 : 0.26 + Math.random() * 0.12;
      call(t, pitch * (1 + (Math.random() - 0.5) * 0.06), dur, level, pan);
      t += dur + 0.06 + Math.random() * 0.08;
    }
  }

  /** Follows the film: surf louder near islands, wind in the dive, quieter at night, gulls at each stop. */
  function update(film) {
    if (!on) return;
    const now = ctx.currentTime;
    const night = Math.max(0, 1 - Math.abs(film - 6) * 1.5);
    const local = film - Math.floor(film);
    const nearShore = film >= 1 ? Math.max(0, 1 - Math.abs(local - 0.25) * 2.2) : 0;
    surfGain.gain.setTargetAtTime((0.6 + nearShore * 0.3) * (1 - night * 0.35), now, 0.5);
    windGain.gain.setTargetAtTime(film < 1 ? 0.5 * (1 - film) + 0.05 : 0.04, now, 0.4);
    windFilter.frequency.setTargetAtTime(film < 1 ? 700 + 900 * (1 - film) : 600, now, 0.5);
    if (now > nextWave) { // a wave builds, breaks and washes out
      const build = 1.8 + Math.random() * 1.2, peak = (0.45 + nearShore * 0.45) * (1 - night * 0.4);
      washGain.gain.cancelScheduledValues(now);
      washGain.gain.setValueAtTime(washGain.gain.value, now);
      washGain.gain.linearRampToValueAtTime(peak, now + build);
      washGain.gain.exponentialRampToValueAtTime(0.03, now + build + 3.5);
      washFilter.frequency.cancelScheduledValues(now);
      washFilter.frequency.setValueAtTime(650, now);
      washFilter.frequency.linearRampToValueAtTime(2200, now + build);
      washFilter.frequency.exponentialRampToValueAtTime(600, now + build + 3.5);
      nextWave = now + build + 2.6 + Math.random() * 3;
    }
    // Close calls on arriving at each island, and as the bird lands at Home Port
    const stop = Math.floor(film + 0.03);
    if (stop >= 1 && stop !== lastStop && local < 0.3) { lastStop = stop; if (night < 0.6) calls(2 + Math.floor(Math.random() * 3), 0.3, (Math.random() - 0.5) * 0.6); }
    if (film > 7.85 && !landed) { landed = true; calls(3, 0.34, 0.15); }
    if (film < 7.6) landed = false;
    // Other gulls, far off, every so often (not at night)
    if (now > nextDistant) {
      if (night < 0.4) calls(1 + Math.floor(Math.random() * 3), 0.07 + Math.random() * 0.05, Math.random() * 1.6 - 0.8);
      nextDistant = now + 7 + Math.random() * 10;
    }
  }

  /** Turns the sound on or off with a gentle fade. */
  function setOn(v) {
    on = v;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(v ? 1.8 : 0, now + (v ? 1.2 : 0.4));
    if (v) { nextWave = now + 0.3; nextDistant = now + 2.5; }
  }

  build();
  return { update, setOn };
}

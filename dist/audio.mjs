/* Original synthesized score and effects. No samples, recordings or remote requests. */
const PHASES = {
  receive: { beat: .34, chords: [[60,64,67,71],[57,60,64,67],[62,65,69,72],[55,59,62,65]], lead: [0,2,1,3], tone: 'triangle', cutoff: 1400 },
  trade:   { beat: .30, chords: [[57,60,64,67],[62,65,69,72],[55,59,62,65],[64,67,71,74]], lead: [2,0,3,1], tone: 'triangle', cutoff: 1250 },
  build:   { beat: .37, chords: [[60,64,67,69],[65,69,72,76],[62,65,69,72],[55,59,62,69]], lead: [0,1,2,1], tone: 'sine', cutoff: 1100 },
  income:  { beat: .31, chords: [[65,69,72,76],[67,71,74,77],[60,64,67,71],[60,64,67,72]], lead: [0,2,3,2], tone: 'triangle', cutoff: 1550 },
  ended:   { beat: .42, chords: [[60,64,67,71],[65,69,72,76],[62,65,69,72],[60,64,67,72]], lead: [3,2,1,0], tone: 'sine', cutoff: 1000 },
  bargain: { beat: .27, chords: [[57,60,64,67],[57,60,64,71],[53,57,60,64],[52,56,59,62]], lead: [2,1,3,0], tone: 'triangle', cutoff: 1750 }
};
const HZ = midi => 440 * 2 ** ((midi - 69) / 12);
const safeRead = key => { try { return globalThis.localStorage?.getItem(key) === 'on'; } catch { return false; } };
const safeWrite = (key, value) => { try { globalThis.localStorage?.setItem(key, value ? 'on' : 'off'); } catch {} };

export function createGameAudio({ onChange } = {}) {
  let sfx = safeRead('vietnamtown-sound'), music = safeRead('vietnamtown-music');
  let ctx, master, musicBus, effectsBus, noiseBuffer, timer = null;
  let phase = 'receive', trading = false, unlocked = false, destroyed = false;
  let step = 0, nextBeat = 0, previousTap = -1, transportGeneration = 0;
  const voices = new Set();
  const doc = globalThis.document;
  const visible = () => !doc?.hidden;
  const enabled = () => sfx || music;
  const settings = () => ({ sfx, music, phase, trading, available: Boolean(globalThis.AudioContext || globalThis.webkitAudioContext) });
  function notify() { try { onChange?.(settings()); } catch {} }
  function ensureContext() {
    if (ctx || !unlocked || destroyed) return !!ctx;
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return false;
    try {
      ctx = new Audio();
      master = ctx.createGain(); master.gain.value = .66; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = .28; musicBus.connect(master);
      effectsBus = ctx.createGain(); effectsBus.gain.value = .34; effectsBus.connect(master);
      noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .12), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      ctx.onstatechange = () => {
        if (ctx?.state !== 'running') stopTransport();
        else if (music && visible() && !destroyed) startTransport();
      };
      return true;
    } catch { ctx = null; return false; }
  }
  function release(voice) {
    voices.delete(voice);
    for (const node of voice.nodes || [voice.source, voice.gain, voice.filter]) {
      try { node.disconnect(); } catch {}
    }
  }
  function fadeVoice(voice, time = .06) {
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, time / 3);
      voice.source.stop(now + time);
    } catch {}
  }
  function stopMusicVoices() { for (const voice of voices) if (voice.music) fadeVoice(voice, .12); }
  function voice({ midi = 60, at = ctx.currentTime, duration = .25, volume = .2, type = 'sine', cutoff = 1700, isMusic = false, noise = false, slide }) {
    if (!ctx || destroyed) return;
    if (voices.size >= 96) { const oldest = voices.values().next().value; fadeVoice(oldest, .01); release(oldest); }
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    filter.type = noise ? 'highpass' : 'lowpass'; filter.frequency.value = cutoff;
    if (noise) source.buffer = noiseBuffer;
    else {
      source.type = type; source.frequency.setValueAtTime(HZ(midi), at);
      if (slide !== undefined) source.frequency.exponentialRampToValueAtTime(HZ(slide), at + duration * .7);
    }
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(isMusic ? musicBus : effectsBus);
    const item = { source, gain, filter, music: isMusic }; voices.add(item);
    source.onended = () => release(item);
    source.start(at); source.stop(at + duration + .03);
  }
  function scheduleBeat(index, at) {
    const score = PHASES[trading ? 'bargain' : phase];
    const chord = score.chords[Math.floor(index / 16) % 4], pos = index % 16;
    const shared = { at, isMusic: true };
    if (pos % 8 === 0) {
      chord.forEach((midi, i) => voice({ ...shared, at: at + i * .021, midi, duration: score.beat * 7.7, volume: .082, type: score.tone, cutoff: score.cutoff }));
      voice({ ...shared, midi: chord[0] - 24, duration: score.beat * 3.6, volume: .25, cutoff: 450 });
    }
    if (pos % 4 === 0) voice({ ...shared, midi: 43, slide: 25, duration: .13, volume: .23, cutoff: 240 });
    if (pos % 4 === 2) voice({ ...shared, noise: true, duration: .055, volume: .035, cutoff: 2400 });
    if (pos % 2 === 1) voice({ ...shared, noise: true, duration: .027, volume: .018, cutoff: 6500 });
    if (pos % (trading ? 2 : 4) === 1) {
      const note = chord[score.lead[Math.floor(pos / 4)]] + (trading ? 12 : 0);
      voice({ ...shared, midi: note, duration: trading ? .25 : .5, volume: trading ? .095 : .07, type: 'triangle', cutoff: 2200 });
    }
  }
  function tick() {
    if (!ctx || ctx.state !== 'running' || !music || !visible() || destroyed) return stopTransport();
    if (nextBeat < ctx.currentTime - .2) nextBeat = ctx.currentTime + .06;
    while (nextBeat < ctx.currentTime + .16) {
      scheduleBeat(step++, nextBeat);
      const swing = step % 2 ? 1.07 : .93;
      nextBeat += PHASES[trading ? 'bargain' : phase].beat * swing;
    }
  }
  function stopTransport() {
    if (timer !== null) globalThis.clearInterval(timer);
    timer = null;
  }
  function startTransport() {
    if (timer !== null || !ctx || ctx.state !== 'running' || !music || !visible() || destroyed) return;
    nextBeat = ctx.currentTime + .08;
    timer = globalThis.setInterval(tick, 90); tick();
  }
  function restartScore() {
    stopTransport(); stopMusicVoices(); step = 0;
    startTransport();
  }
  async function sync() {
    const generation = ++transportGeneration;
    if (destroyed) return;
    if (!unlocked || !visible() || !enabled()) {
      stopTransport();
      for (const item of voices) fadeVoice(item);
      if (ctx?.state === 'running') { try { await ctx.suspend(); } catch {} }
      return;
    }
    if (!ctx) return;
    try { if (ctx.state === 'suspended' || ctx.state === 'interrupted') await ctx.resume(); } catch {}
    if (destroyed || generation !== transportGeneration || !visible()) return;
    if (music) startTransport(); else { stopTransport(); stopMusicVoices(); }
  }
  function play(kind = 'tap') {
    if (!sfx || !unlocked || !visible() || destroyed || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (kind === 'tap' && now - previousTap < .045) return;
    if (kind === 'tap') previousTap = now;
    const effects = {
      tap: [[76,0,.06,.1]], place: [[67,0,.09,.16],[74,.065,.12,.12]],
      build: [[60,0,.13,.16],[64,.07,.16,.14],[67,.14,.24,.13]],
      phase: [[60,0,.18,.12],[67,.1,.25,.14],[72,.2,.4,.12]],
      'deal-open': [[57,0,.18,.14],[64,.1,.2,.12],[69,.2,.3,.11]],
      deal: [[64,0,.13,.14],[67,.08,.17,.13],[72,.16,.28,.14],[76,.24,.4,.11]],
      reject: [[64,0,.16,.1],[60,.1,.22,.1]],
      income: [[72,0,.18,.13],[76,.085,.2,.12],[79,.17,.26,.11],[84,.26,.45,.09]],
      year: [[60,0,.4,.12],[64,.09,.4,.1],[67,.18,.4,.1],[72,.3,.65,.13]]
    };
    (effects[kind] || effects.tap).forEach(([midi, offset, duration, volume]) => voice({ midi, at: now + offset, duration, volume, type: 'triangle', cutoff: 2700 }));
  }
  // A tiny vowel synthesizer: a voiced carrier through three moving formants.
  // These are expressive nonsense syllables, never recorded or spoken words.
  const VOWELS = { uh:[520,1190,2500], ah:[740,1250,2650], eh:[550,1850,2650], ee:[330,2250,3000], oo:[370,850,2350] };
  const SPEECH = {
    positive: [
      ['eh','ee',0,.11,0,4], ['ah','eh',.135,.12,2,6],
      ['eh','ee',.285,.16,4,9], ['oo','ee',.48,.18,7,10]
    ],
    negative: [
      ['uh','eh',0,.18,0,2], ['uh','oo',.255,.14,-1,-4],
      ['ah','uh',.455,.12,-2,-5], ['uh','oo',.615,.19,-4,-8]
    ],
    thinking: [['oo','uh',0,.18,-3,-1], ['uh','oo',.23,.22,-1,-4]]
  };
  function stopSpeech() {
    for (const item of voices) if (item.speech) fadeVoice(item, .025);
  }
  function duckMusic(until) {
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime, gain = musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(.09, now, .025);
    gain.setTargetAtTime(.28, until + .05, .12);
  }
  function syllable({ from, to, at, duration, base, pitchFrom, pitchTo, formantScale, emphasis }) {
    const source = ctx.createOscillator(), gain = ctx.createGain();
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.value = 3700 * formantScale; filter.Q.value = .45;
    source.type = 'sawtooth';
    source.frequency.setValueAtTime(HZ(base + pitchFrom), at);
    source.frequency.exponentialRampToValueAtTime(HZ(base + pitchTo), at + duration * .72);
    source.frequency.exponentialRampToValueAtTime(HZ(base + pitchTo - .7), at + duration);
    source.connect(filter);
    const nodes = [source, filter, gain];
    VOWELS[from].forEach((frequency, index) => {
      const formant = ctx.createBiquadFilter(), weight = ctx.createGain();
      formant.type = 'bandpass'; formant.Q.value = [4.5,6,8][index];
      formant.frequency.setValueAtTime(frequency * formantScale, at);
      formant.frequency.exponentialRampToValueAtTime(VOWELS[to][index] * formantScale, at + duration * .85);
      weight.gain.value = [1,.52,.23][index];
      filter.connect(formant); formant.connect(weight); weight.connect(gain);
      nodes.push(formant, weight);
    });
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(.64 * emphasis, at + .018);
    gain.gain.setTargetAtTime(.48 * emphasis, at + duration * .40, .025);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    gain.connect(effectsBus);
    const item = { source, gain, filter, nodes, music:false, speech:true };
    voices.add(item); source.onended = () => release(item);
    source.start(at); source.stop(at + duration + .02);
  }
  function speak(mood = 'positive', person = 1) {
    if (!sfx || !unlocked || !visible() || destroyed || !ctx || ctx.state !== 'running') return;
    stopSpeech();
    const phrase = SPEECH[mood] || SPEECH.thinking;
    // Linh is brighter, Minh lower, An softer. Stable voices support recognition.
    const persona = [ {base:56,scale:1.02}, {base:58,scale:1.12}, {base:51,scale:.90}, {base:55,scale:1.02} ];
    const {base,scale} = persona[person] || persona[1];
    const now = ctx.currentTime + .025;
    duckMusic(now + phrase.at(-1)[2] + phrase.at(-1)[3]);
    phrase.forEach(([from,to,offset,duration,pitchFrom,pitchTo],index) => {
      syllable({ from, to, at:now+offset, duration, base, pitchFrom, pitchTo,
        formantScale:scale, emphasis:index === 0 ? 1 : .85 });
    });
  }
  const visibilityChange = () => { void sync(); };
  doc?.addEventListener('visibilitychange', visibilityChange);
  return {
    async unlock() { if (destroyed) return false; unlocked = true; ensureContext(); await sync(); return ctx?.state === 'running'; },
    setSfx(value) { sfx = Boolean(value); safeWrite('vietnamtown-sound', sfx); if (!sfx) for (const item of voices) if (!item.music) fadeVoice(item); notify(); void sync(); },
    setMusic(value) { music = Boolean(value); safeWrite('vietnamtown-music', music); notify(); void sync(); },
    setPhase(value) { if (PHASES[value] && value !== 'bargain' && phase !== value) { phase = value; if (!trading) restartScore(); } },
    setTrading(value) { value = Boolean(value); if (trading !== value) { trading = value; restartScore(); } },
    play, speak, getSettings: settings,
    destroy() {
      if (destroyed) return;
      destroyed = true; transportGeneration++; stopTransport();
      doc?.removeEventListener('visibilitychange', visibilityChange);
      for (const item of voices) { try { item.source.stop(); } catch {} release(item); }
      if (ctx) { ctx.onstatechange = null; void ctx.close().catch(() => {}); }
    }
  };
}

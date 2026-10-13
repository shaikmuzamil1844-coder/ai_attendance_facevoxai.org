// services/audioRecorder.js — High-fidelity 16kHz PCM WAV audio recorder for biometric voice recognition
export class AudioRecorder {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.audioInput = null;
    this.samples = [];
    this.recording = false;
  }

  async start() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    this.audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.samples = [];
    this.recording = true;

    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.samples.push(new Float32Array(inputData));
    };

    this.audioInput.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    this.recording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (this.processor) {
      this.processor.disconnect();
    }
    if (this.audioInput) {
      this.audioInput.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    const totalLength = this.samples.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const sample of this.samples) {
      result.set(sample, offset);
      offset += sample.length;
    }

    return this.encodeWAV(result, 16000);
  }

  encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let idx = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      idx += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

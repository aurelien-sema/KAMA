// Le WAV envoyé au serveur doit être du PCM 16 bits, 16 kHz, mono (sinon 415), quel que soit le taux du micro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encoderWav, reechantillonner } from '../lib/wav.ts';

function sinus(taux, secondes) {
  const x = new Float32Array(Math.floor(taux * secondes));
  for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / taux);
  return x;
}

test("en-tête WAV : PCM, mono, 16 kHz, 16 bits, longueurs cohérentes", () => {
  const wav = encoderWav(sinus(48000, 1), 48000);
  const v = new DataView(wav.buffer);
  const t = (a, n) => String.fromCharCode(...wav.subarray(a, a + n));
  assert.equal(t(0, 4), 'RIFF');
  assert.equal(t(8, 4), 'WAVE');
  assert.equal(t(12, 4), 'fmt ');
  assert.equal(v.getUint16(20, true), 1); // PCM
  assert.equal(v.getUint16(22, true), 1); // mono
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(t(36, 4), 'data');
  assert.equal(v.getUint32(40, true), wav.length - 44);
  assert.equal(v.getUint32(4, true), wav.length - 8);
  assert.equal(wav.length - 44, 16000 * 2); // une seconde à 16 kHz, 2 octets par échantillon
});

test('le rééchantillonnage garde la durée', () => {
  assert.equal(reechantillonner(sinus(44100, 2), 44100).length, 32000);
  assert.equal(reechantillonner(sinus(16000, 1), 16000).length, 16000);
});

test('un signal trop fort est écrêté sans déborder', () => {
  const fort = new Float32Array([2, -2, 0.5]);
  const v = new DataView(encoderWav(fort, 16000).buffer);
  assert.equal(v.getInt16(44, true), 32767);
  assert.equal(v.getInt16(46, true), -32767);
});

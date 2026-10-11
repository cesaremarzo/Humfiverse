import json, re, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro, EspeakConfig
k = Kokoro('tts/kokoro-v1.0.onnx', 'tts/voices-v1.0.bin', espeak_config=EspeakConfig(lib_path='/opt/homebrew/lib/libespeak-ng.dylib', data_path='/opt/homebrew/share/espeak-ng-data'))
# Pronunciation fixes, applied on the phonemes (the spelling alone is not enough):
FIX = [
    ('hˈʌmfɪvˌɜːs', 'hˈʌmfɪvɜːs'),        # HUM-fiverse: one stress, on the first syllable
    ('ˌiːθɚɹˈiːəm', 'ɪθˈɪɹiəm'),          # e-THE-reum, not ethe-RE-um
    ('lˈaɪvz ˌɔntʃˈeɪn', 'lˈɪvz ˌɔntʃˈeɪn'),  # "lives on-chain": the verb, not the plural of life
]
def speak(text):
    parts = [p for p in re.split(r'(?<=[.?!:])\s+', text) if p.strip()]
    out = []
    for p in parts:
        ph = k.tokenizer.phonemize(p, 'en-us')
        for a, b in FIX: ph = ph.replace(a, b)
        s, sr = k.create(ph, voice='af_heart', speed=1.0, is_phonemes=True)
        out += [s, np.zeros(int(sr * (0.32 if p.endswith(('.', '?', '!')) else 0.18)), dtype=s.dtype)]
    return np.concatenate(out[:-1]), sr
for key, text in json.load(open('script.json')).items():
    samples, sr = speak(text)
    sf.write(f'audio/{key}.wav', samples, sr)
    print(key, round(len(samples) / sr, 1), 's')

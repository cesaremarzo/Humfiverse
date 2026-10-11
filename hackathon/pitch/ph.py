import sys
from kokoro_onnx import Kokoro, EspeakConfig
k = Kokoro('tts/kokoro-v1.0.onnx', 'tts/voices-v1.0.bin', espeak_config=EspeakConfig(lib_path='/opt/homebrew/lib/libespeak-ng.dylib', data_path='/opt/homebrew/share/espeak-ng-data'))
for t in sys.argv[1:]: print(repr(t), '->', k.tokenizer.phonemize(t, 'en-us'))

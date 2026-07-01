// [서비스] TTS(음성 변환) — Google Cloud Text-to-Speech API (리포트 읽어주기)
import axios from 'axios';

// 프론트에서 넘어오는 speedIdx (0=느리게, 1=보통, 2=빠르게) → Google speakingRate
const SPEED_MAP = { 0: 0.75, 1: 1.0, 2: 1.4 };

export const synthesize = async ({ text, speed = 1 }) => {
  const speakingRate = SPEED_MAP[Number(speed)] ?? 1.0;

  const { data } = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_CLOUD_TTS_KEY}`,
    {
      input: { text },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Wavenet-A', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate },
    }
  );

  // Google Cloud TTS는 base64 인코딩된 audioContent를 반환
  return Buffer.from(data.audioContent, 'base64');
};

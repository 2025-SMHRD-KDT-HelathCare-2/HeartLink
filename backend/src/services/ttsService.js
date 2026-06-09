const axios = require('axios');

exports.synthesize = async ({ text, outputPath }) => {
  // Google Cloud TTS REST API 사용
  const { data } = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_CLOUD_TTS_KEY}`,
    {
      input: { text },
      voice: { languageCode: 'ko-KR', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    }
  );

  // data.audioContent는 base64 인코딩된 mp3
  return data.audioContent;
};

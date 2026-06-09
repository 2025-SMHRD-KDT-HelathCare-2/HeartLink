const axios = require('axios');
const FormData = require('form-data');

exports.analyze = async ({ fileBuffer, fileName, userId }) => {
  const form = new FormData();
  form.append('file', fileBuffer, fileName);
  form.append('user_id', userId);

  const { data } = await axios.post(`${process.env.AI_SERVER_URL}/analyze`, form, {
    headers: form.getHeaders(),
    timeout: 60000,
  });

  return data;
};

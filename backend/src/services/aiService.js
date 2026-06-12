import axios from 'axios';
import FormData from 'form-data';

export const analyze = ({ fileBuffer, fileName, measurementId, userId }) => {
  const form = new FormData();
  form.append('file', fileBuffer, fileName);
  form.append('measurement_id', measurementId.toString());
  form.append('user_id', userId.toString());

  return axios.post(`${process.env.AI_SERVER_URL}/analyze`, form, {
    headers: form.getHeaders(),
    timeout: 10000,
  });
};

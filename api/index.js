import express from 'express';
import axios, { post } from 'axios';

const app = express();

app.use(express.json());

app.get('/api', (req, res) => {
  res.end('Hello!');
});

app.post('/api/audio/transcriptions', async (req, res) => {

  const audioUrl = req.body.url;
  const apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
  const payload = {
    model: 'whisper-1',
  };

  const response = await audioTranscription(audioUrl, apiUrl, payload);

  res.send({
    data: response,
  })
});

async function downloadFile(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
  } catch (error) {
    throw new Error(`Error downloading file: ${error.message}`);
  }
}

async function audioTranscription(audioUrl, apiUrl, payload) {
  const filename = getFilename(audioUrl);

  try {
    const fileData = await downloadFile(audioUrl);
    
    const formData = new FormData();
    formData.append('file', fileData, { filename: filename });
    for (const key in payload) {
      formData.append(key, payload[key]);
    }

    const response = await post(apiUrl, formData, {
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
}

function getFilename(url) {
  const url_components = url.split('/');
  const full_filename = url_components[(url_components.length - 1)];
  const clean_filename = full_filename.split('?')[0];
  
  return clean_filename;
}

export default app;
import express from 'express';
import axios, { post } from 'axios';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';

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

async function downloadFile(url, destinationPath) {
  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
    });

    const writer = createWriteStream(destinationPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Error downloading file: ${error.message}`);
  }
}

async function audioTranscription(audioUrl, apiUrl, payload) {
  const tempFilePath = join(__dirname, 'tempfile.txt');

  try {
    await downloadFile(audioUrl, tempFilePath);
    
    const formData = new FormData();
    formData.append('file', createReadStream(tempFilePath));
    for (const key in payload) {
      formData.append(key, payload[key]);
    }

    const response = await post(apiUrl, formData, {
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'multipart/form-data',
      },
    });

    unlinkSync(tempFilePath);

    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
}

export default app;
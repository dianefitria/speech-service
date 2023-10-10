import express from 'express';
import axios from 'axios';
import FormData from 'form-data';

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const key = req.get('API-KEY');

  if(key === process.env.API_KEY) {
    next();
  } else {
    res.status(401).send('Unauthorized')
  }
})

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
    formData.append('file', fileData, filename);
    for (const key in payload) {
      formData.append(key, payload[key]);
    }

    const response = await axios.post(apiUrl, formData, {
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
  
  return clean_filename + '.oga';
}

let accessToken = '';
const uiPathAuthUrl = 'https://account.uipath.com/oauth/token';
const uiPathBaseUrl = 'https://cloud.uipath.com/keyrehhrqarg/DefaultTenant/orchestrator_/odata';

async function uiPathAuth() {
  try {
    const response = await axios.post(uiPathAuthUrl, 
      {
        'grant_type': 'refresh_token',
        'client_id': process.env.UIPATH_CLIENT_ID,
        'refresh_token': process.env.UIPATH_USER_KEY
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if(response.data) {
      accessToken = response.data.access_token;
    }
  } catch (error) {
    throw new Error(`Error on uiPathAuth: ${error.message}`);
  }
}

async function uiPathStartJob() {

}

app.post('/api/sspp/reset-password', async (req, res) => {
  var input = {
    'username': req.body.username,
    'security': req.body.security_answer,
    'password': req.body.password
  }
  var payload = {
    'startInfo': {
      'ReleaseKey': process.env.UIPATH_RESET_KEY,
      'RobotIds': [1388861],
      'JobsCount': 0,
      'Strategy': 'Specific',
      'InputArguments': JSON.stringify(input)
    }
  }

  res.send(payload);
});

app.post('/api/sspp/unlock-account', async (req, res) => {
  var input = {
    'username': req.body.username,
    'security': req.body.security_answer,
    'password': req.body.password
  }
  var payload = {
    'startInfo': {
      'ReleaseKey': process.env.UIPATH_UNLOCK_KEY,
      'RobotIds': [1388861],
      'JobsCount': 0,
      'Strategy': 'Specific',
      'InputArguments': JSON.stringify(input)
    }
  }

  res.send(payload);
});

app.post('/api/sspp/send-otp', async (req, res) => {
  await uiPathAuth();

  const response = await axios.get(uiPathBaseUrl + '/QueueItems', {
    params: {
      '$filter': 'contains(Reference,\'' + req.body.username + '\') and Status eq \'New\''
    },
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
  });

  if(response.data) {
    for (let index = 0; index < response.data['@odata.count']; index++) {
      const element = response.data.value[index];
      const payload = {
        'Name': 'OTPQueue',
        'Priority': element['Priority'],
        'SpecificContent': {
            'username': element['SpecificContent']['username'],
            'otp': req.body.otp
        },
        'DeferDate': element['DeferDate'],
        'DueDate': element['DueDate'],
        'RiskSlaDate': element['RiskSlaDate'],
        'Reference': element['Reference'],
        'Progress': element['Progress']
      }

      await axios.put(uiPathBaseUrl + '/QueueItems(' + element['Id'] + ')', 
        payload, 
        {
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    res.send({
      status: 'Success'
    })
  } else {
    res.send({
      status: 'Failed'
    })
  }
});

export default app;
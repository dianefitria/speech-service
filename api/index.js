import express, { response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';

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
  await uiPathAuth();

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

  const response = await axios.post(uiPathBaseUrl + '/Jobs/UiPath.Server.Configuration.OData.StartJobs', 
    payload, 
    {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'X-UIPATH-OrganizationUnitId': 'FolderKey',
        'X-UIPATH-FolderKey': process.env.UIPATH_FOLDER_KEY
      },
    }
  );

  if(response.data) {
    res.send(response.data);
  } else {
    res.send({
      status: 'Failed'
    })
  }
});

app.post('/api/sspp/unlock-account', async (req, res) => {
  await uiPathAuth();
  
  var input = {
    'username': req.body.username,
    'security': req.body.security_answer
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

  const response = await axios.post(uiPathBaseUrl + '/Jobs/UiPath.Server.Configuration.OData.StartJobs', 
    payload, 
    {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'X-UIPATH-OrganizationUnitId': 'FolderKey',
        'X-UIPATH-FolderKey': process.env.UIPATH_FOLDER_KEY
      },
    }
  );

  if(response.data) {
    res.send(response.data);
  } else {
    res.send({
      status: 'Failed'
    })
  }
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
            'X-UIPATH-OrganizationUnitId': 'FolderKey',
            'X-UIPATH-FolderKey': process.env.UIPATH_FOLDER_KEY
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

import { get } from '@vercel/edge-config';

function formatDateToYYMMDD(date) {
  const year = date.getFullYear() % 100;
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

// Function to write data to the file
const writeDataToDB = async (data) => {
  try {
    const updateEdgeConfig = await fetch(
      `https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              operation: 'update',
              key: 'edvc_counter',
              value: data,
            },
          ],
        }),
      },
    );
    const result = await updateEdgeConfig.json();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
};


app.get('/api/edvc/counter', async (req, res) => {
  const initialData = await get('edvc_counter');

  let counter = initialData.counter;
  let currentDate = initialData.currentDate;
  // Check if the date has changed
  const today = formatDateToYYMMDD(new Date());
  if (today !== currentDate) {
    // If the date has changed, reset the counter and update the current date
    counter = 0;
    currentDate = today;
  }

  // Increment the counter
  counter++;

  // Write the updated data to the file
  await writeDataToDB({ counter, currentDate });

  const UID = `${currentDate}-${counter.toString().padStart(4, '0')}`
  // Send the updated counter as the response
  res.json({ UID });
});

export default app;
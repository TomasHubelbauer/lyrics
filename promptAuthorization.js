import fs from 'fs';
import electron from 'electron';

export default async function promptAuthorization(force = false) {
  /** @type {string} */
  let authorization;

  const path = `token.json`;
  if (force) {
    try {
      await fs.promises.unlink(path);
    }
    catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`Failed to delete bearer token: ${error}`);
      }
    }
  }

  try {
    await fs.promises.access(path);
    authorization = JSON.parse(await fs.promises.readFile(path));
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      console.log(`Failed to load bearer token: ${error}`);
    }

    console.log('Obtaining bearer token…');
    const window = new electron.BrowserWindow({ width: 1024, height: 800, webPreferences: { nodeIntegration: false, webSecurity: false } });
    window.loadURL('https://open.spotify.com/');

    authorization = await new Promise((resolve) => {
      electron.session.defaultSession.webRequest.onSendHeaders(
        { urls: ['https://gew4-spclient.spotify.com/*'] },
        (details) => {
          if (authorization) {
            return;
          }

          if (details.requestHeaders['authorization']) {
            resolve(details.requestHeaders['authorization']);
          }
        }
      );
    });

    window.close();
    await fs.promises.writeFile(path, JSON.stringify(authorization, null, 2));
    console.log('Obtained bearer token');
  }

  return authorization;
}

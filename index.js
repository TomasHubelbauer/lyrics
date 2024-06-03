import electron from 'electron';
import timers from 'timers/promises';
import fs from 'fs';
import askSpotify from './askSpotify.js';

electron.app.on('ready', async () => {
  /** @type {string} */
  let authorization;

  const path = `token.json`;
  try {
    await fs.promises.access(path);

    console.log('Loading bearer token…');
    authorization = JSON.parse(await fs.promises.readFile(path));
    console.log('Loaded bearer token');
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      console.log(`Failed to load bearer token: ${error}`);
    }

    console.log('Obtaining bearer token…');
    const window = new electron.BrowserWindow({ width: 800, height: 600 });
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

  // Hide the Dock icon for the application
  electron.app.dock.hide();

  const display = electron.screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const window = new electron.BrowserWindow({ width, height, frame: false, transparent: true });
  window.loadFile('index.html');

  // Make the window always stay on top
  window.setAlwaysOnTop(true);

  // Prevent minimizing and maximizing
  // Note that this is redundant with `frame: false` but I still like to keep it
  window.setMaximizable(false);
  window.setMinimizable(false);

  // Make the window click-through
  window.setIgnoreMouseEvents(true);

  /** @type {'playing' | 'paused'} */
  let state;
  let position = 0;
  let duration = 0;

  /** @typedef {{ timeTag: string; words: string; }} Line */

  /** @type {({ artist: string; song: string; } & ({ error: string; } | { syncType: 'LINE_SYNCED' | 'UNSYNCED'; lines: Line[]; })) | undefined} */
  let lyrics;

  /** @type {Line | undefined} */
  let line;

  // Render current lyrics line on a fast interval for smooth updates
  setInterval(
    async () => {
      if (lyrics?.error || state !== 'playing') {
        window.webContents.executeJavaScript(`document.querySelector('#lyricText').textContent = '';`);
        return;
      }

      switch (lyrics?.syncType) {
        case undefined: {
          window.webContents.executeJavaScript(`document.querySelector('#lyricText').textContent = '…';`);
          break;
        }
        case 'UNSYNCED': {
          const ratio = position / duration;
          const index = ~~(lyrics.lines.length * ratio);
          const _line = lyrics.lines[index];
          if (_line !== line) {
            line = _line;

            const text = line?.words?.replace(/'/g, '\\\'') ?? '';
            console.log(`Updated the unsynchronized lyric to: ${text}`);

            // Get rid of the lingering shadows/opacity (for the most part)
            window.reload();
            await window.webContents.executeJavaScript(`document.querySelector('#lyricText').textContent = '~ ${text}';`);
          }

          position += .1;
          break;
        }
        case 'LINE_SYNCED': {
          {
            const index = lyrics.lines.findIndex(line => line.startTimeMs >= position * 1000);
            const _line = lyrics.lines[index - 1];
            if (_line !== line) {
              line = _line;

              const text = line?.words?.replace(/'/g, '\\\'') ?? '';
              console.log(`Updated the synchronized lyric to: ${text}`);

              // Get rid of the lingering shadows/opacity (for the most part)
              window.reload();
              await window.webContents.executeJavaScript(`document.querySelector('#lyricText').textContent = '${text}';`);
            }

            position += .1;
            break;
          }
        }
        default: {
          window.webContents.executeJavaScript(`document.querySelector('#lyricText').textContent = 'Unknown sync type "${lyrics.syncType}"!';`);
        }
      }
    },
    100
  );

  // Check artist, song and time and fetch and update lyrics on slow interval
  while (true) {
    // Wait for 5 seconds between Spotify checks unless it is the first loop run
    if (lyrics) {
      await timers.setTimeout(5000);
    }

    /** @type {string} */
    let artist;
    try {
      artist = await askSpotify('artist of current track');
    }
    catch (error) {
      console.log('Failed to get Spotify artist: ' + error);
      continue;
    }

    /** @type {string} */
    let song;
    try {
      song = await askSpotify('name of current track');
    }
    catch (error) {
      console.log('Failed to get Spotify song: ' + error);
      continue;
    }

    // Download new lyrics if we don't already have them
    if (lyrics?.artist !== artist || lyrics?.song !== song) {
      const path = `lyrics/${artist} - ${song}.json`;
      try {
        await fs.promises.access(path);

        console.log(`Loading lyrics for ${artist} - ${song}…`);
        lyrics = JSON.parse(await fs.promises.readFile(path));
        console.log(`Loaded lyrics for ${artist} - ${song}`);
      }
      catch (error) {
        if (error.code !== 'ENOENT') {
          console.log(`Failed to load lyrics for ${artist} - ${song}: ${error}`);
        }

        /** @type {string} */
        let id;
        try {
          // E.g.: "ID spotify:track:…"
          id = (await askSpotify('id of the current track')).split(':').at(-1).trimEnd();
        }
        catch (error) {
          console.log('Failed to get Spotify ID: ' + error);
          continue;
        }

        console.log(`Downloading lyrics for ${artist} - ${song} (${id})…`);

        // Download LRC (timestamped) lyrics from the unofficial Spotify Lyrics API
        // Inspect the `open.spotify.com` developer tools `lyrics` network call to maintain this 
        const response = await fetch(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json`, { headers: { authorization, 'app-platform': 'WebPlayer' } });
        if (response.ok) {
          const data = await response.json();

          lyrics = { artist, song, ...data.lyrics };
          await fs.promises.writeFile(path, JSON.stringify(lyrics, null, 2));

          console.log(`Downloaded lyrics for ${artist} - ${song} (${id})`);
        }
        else {
          lyrics = { artist, song, error: response.statusText };
        }
      }

      if (lyrics.error) {
        console.log(`Lyrics error for ${artist} - ${song} (${id}): ${lyrics.error}`);
      }
    }

    try {
      const _state = await askSpotify('player state');
      if (_state !== 'playing' && _state !== 'paused') {
        throw new Error(`Unexpected player state '${_state}'!`);
      }

      if (state !== _state) {
        if (!state) {
          console.log(`Player state is '${_state}'${_state !== 'playing' ? ' - waiting for playback' : ''}`);
        }
        else {
          console.log(`Changed player state from '${state}' to '${_state}'`);
        }
      }

      state = _state;
    }
    catch (error) {
      console.log('Failed to get Spotify state: ' + error);
      continue;
    }

    try {
      position = Number(await askSpotify('player position'));
    }
    catch (error) {
      console.log('Failed to get Spotify position: ' + error);
      continue;
    }

    try {
      duration = Number(await askSpotify('duration of current track')) / 1000;
    }
    catch (error) {
      console.log('Failed to get Spotify duration: ' + error);
      continue;
    }
  }
});

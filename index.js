void async function () {
  // Get the "experimental feature" warning about `fetch` out of the way
  await fetch('https://example.com');

  const electron = await import('electron');
  const child_process = await import('child_process');
  const util = await import('util');
  const timers = await import('timers/promises');
  const fs = await import('fs');

  const exec = util.promisify(child_process.exec);

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

  /** @type {{ artist: string; song: string; error: boolean; message?: string; syncType: 'LINE_SYNCED' | 'UNSYNCED'; lines: Line[]; } | undefined} */
  let lyrics;

  /** @type {Line | undefined} */
  let line;

  // Render current lyrics line on a fast interval for smooth updates
  setInterval(
    async () => {
      if (lyrics?.error || state !== 'playing') {
        window.webContents.executeJavaScript(`document.body.textContent = '';`);
        return;
      }

      switch (lyrics?.syncType) {
        case undefined: {
          window.webContents.executeJavaScript(`document.body.textContent = '…';`);
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

            // Get rid of the lingering shadow issue (for the most part)
            window.reload();
            await window.webContents.executeJavaScript(`document.body.textContent = '~ ${text}';`);
          }

          position += .1;
          break;
        }
        case 'LINE_SYNCED': {
          {
            const stamp = `${(~~(position / 60)).toString().padStart('00'.length, '0')}:${(position % 60).toFixed(2).toString().padStart('00.00'.length, '0')}`;
            const index = lyrics.lines.findIndex(line => line.timeTag >= stamp);
            const _line = lyrics.lines[index - 1];
            if (_line !== line) {
              line = _line;

              const text = line?.words?.replace(/'/g, '\\\'') ?? '';
              console.log(`Updated the synchronized lyric to: ${text}`);

              // Get rid of the lingering shadow issue (for the most part)
              window.reload();
              await window.webContents.executeJavaScript(`document.body.textContent = '${text}';`);
            }

            position += .1;
            break;
          }
        }
        default: {
          window.webContents.executeJavaScript(`document.body.textContent = 'Unknown sync type "${lyrics.syncType}"!';`);
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
      const { stdout: artistStdout, stderr: artistStderr } = await exec(`osascript -e 'tell application "Spotify" to artist of current track'`);
      if (artistStderr) {
        throw new Error(artistStderr);
      }

      artist = artistStdout.trimEnd();
    }
    catch (error) {
      console.log('Failed to get Spotify artist: ' + error);
      continue;
    }

    /** @type {string} */
    let song;
    try {
      const { stdout: songStdout, stderr: songStderr } = await exec(`osascript -e 'tell application "Spotify" to name of current track'`);
      if (songStderr) {
        throw new Error(songStderr);
      }

      song = songStdout.trimEnd();
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

        console.log(`Downloading lyrics for ${artist} - ${song}…`);

        // Download the Google SRP for the artist & song query on `open.spotify.com`
        const srpUrl = `${'https://'/* Prevent broken syntax highlighting */}www.google.com/search?q=${artist.replace(' ', '+')}}+${song.replace(' ', '+')}+site:open.spotify.com`;
        const srpHtml = await fetch(srpUrl, { headers: { 'User-Agent': 'Firefox' } }).then(response => response.text());

        // Extract the Spotify track ID from the Google SRP
        const match = srpHtml.match(/https:\/\/open\.spotify\.com\/track\/(?<id>\w+)/);
        if (!match) {
          continue;
        }

        const id = match.groups.id;

        // Download LRC (timestamped) lyrics from the unofficial Spotify Lyrics API
        // See https://github.com/akashrchandran/spotify-lyrics-api
        const apiUrl = `https://spotify-lyric-api.herokuapp.com/?trackid=${id}&format=lrc`;
        const apiJson = await fetch(apiUrl, { headers: { 'User-Agent': 'Firefox' } }).then(response => response.json());

        lyrics = { artist, song, ...apiJson };
        await fs.promises.writeFile(path, JSON.stringify(lyrics, null, 2));

        console.log(`Downloaded lyrics for ${artist} - ${song}`);
      }

      if (lyrics.error) {
        console.log(`Lyrics error for ${artist} - ${song}: ${lyrics.message ?? 'unknown error'}`);
      }
    }

    try {
      const { stdout: stateStdout, stderr: stateStderr } = await exec(`osascript -e 'tell application "Spotify" to player state'`);
      if (stateStderr) {
        throw new Error(stateStderr);
      }

      if (stateStdout !== 'playing\n' && stateStdout !== 'paused\n') {
        throw new Error(`Unexpected player state '${stateStdout}'!`);
      }

      if (state !== stateStdout.trimEnd()) {
        console.log(`Changed player state from '${state}' to '${stateStdout.trimEnd()}'`);
      }

      state = stateStdout.trimEnd();
    }
    catch (error) {
      console.log('Failed to get Spotify state: ' + error);
      continue;
    }

    try {
      const { stdout: positionStdout, stderr: positionStderr } = await exec(`osascript -e 'tell application "Spotify" to player position'`);
      if (positionStderr) {
        throw new Error(positionStderr);
      }

      position = Number(positionStdout);
    }
    catch (error) {
      console.log('Failed to get Spotify position: ' + error);
      continue;
    }

    try {
      const { stdout: durationStdout, stderr: durationStderr } = await exec(`osascript -e 'tell application "Spotify" to duration of current track'`);
      if (durationStderr) {
        throw new Error(durationStderr);
      }

      duration = Number(durationStdout) / 1000;
    }
    catch (error) {
      console.log('Failed to get Spotify duration: ' + error);
      continue;
    }
  }
}();

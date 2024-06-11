import runAppleScript from './runAppleScript.js';

export default async function askSpotify(
  /** @type {string} */
  query
) {
  return await runAppleScript(`tell application "Spotify" to ${query}`);
}

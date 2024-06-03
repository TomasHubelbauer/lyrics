import child_process from 'child_process';
import util from 'util';

const exec = util.promisify(child_process.exec);

export default async function askSpotify(
  /** @type {string} */
  query
) {
  const { stdout, stderr } = await exec(`osascript -e 'tell application "Spotify" to ${query}'`);
  if (stderr) {
    throw new Error(stderr);
  }

  return stdout.trimEnd();
}

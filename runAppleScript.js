import child_process from 'child_process';
import util from 'util';

const exec = util.promisify(child_process.exec);

export default async function runAppleScript(
  /** @type {string} */
  query
) {
  if (query.includes('\'')) {
    throw new Error('The query cannot contain single quotes');
  }

  const { stdout, stderr } = await exec(`osascript -e '${query}'`);
  if (stderr) {
    throw new Error(stderr);
  }

  return stdout.trimEnd();
}

import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setBrowserExecutable('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
Config.setConcurrency(4);
if (!process.argv.includes('--codec=wav')) {
  Config.setCodec('h264');
  Config.setCrf(16);
}

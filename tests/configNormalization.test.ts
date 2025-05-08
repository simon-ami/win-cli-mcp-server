import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import { loadConfig } from '../src/utils/config.js';

describe('Validate allowedPaths normalization from config', () => {
  let tempDir: string;
  let CONFIG_PATH: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-cli-test-'));
    CONFIG_PATH = path.join(tempDir, `${randomBytes(8).toString('hex')}.json`);
    const content = {
      security: { allowedPaths: [
        'C:\\SomeFolder\\Test',
        '/c/other/PATH',
        'C:/Another/Folder',
        '/mnt/d/Incorrect/Path'
      ] }
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(content));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadConfig lower-cases and normalizes allowedPaths', () => {
    const cfg = loadConfig(CONFIG_PATH);
    const normalized = cfg.security.allowedPaths;
    expect(normalized).toEqual([
      path.normalize('c:\\somefolder\\test'),
      path.normalize('c:\\other\\path'),
      path.normalize('c:\\another\\folder'),
      path.normalize('c:\\mnt\\d\\incorrect\\path')
    ]);
  });
});

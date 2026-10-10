import process from 'node:process';
import { hashAdminPassword } from './password.mjs';

function readPassword() {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal to enter the password safely.');
  }

  return new Promise((resolve, reject) => {
    let password = '';
    const restoreTerminal = () => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          restoreTerminal();
          reject(new Error('Password entry cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          restoreTerminal();
          resolve(password);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          const characters = Array.from(password);
          if (characters.length > 0) {
            characters.pop();
            password = characters.join('');
            output.write('\b \b');
          }
          continue;
        }
        if (!/[\u0000-\u001f\u007f]/.test(character)) {
          password += character;
          output.write('*');
        }
      }
    };

    output.write('Admin password: ');
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    input.on('data', onData);
  });
}

try {
  const passwordHash = await hashAdminPassword(await readPassword());
  console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not create an admin password hash.');
  process.exitCode = 1;
}

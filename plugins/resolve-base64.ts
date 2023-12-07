import {Plugin} from 'vite';

function resolveBase64(): Plugin {
    return {
      name: 'resolve-base64',
      transform(src: string, id: string) {
        if (id.endsWith('?base64')) {
          return {
            code: `export default "${btoa(src)}";`,
            map: null,
          };
        }
      },
    }
  }

  export default resolveBase64;
  
import { openAPI, username } from 'better-auth/plugins';
import { BetterAuthOptions } from 'better-auth/types';

export const betterAuthCoreConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      bio: { type: 'string', required: false, input: false },
      defaultMood: { type: 'string', required: false, input: false },
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  plugins: [
    openAPI(),
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameNormalization: false,
    }),
  ],
};

import nextConfig from 'eslint-config-next';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

const eslintConfig = [
  ...nextConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      // Resetting chat state when the `session`/`chat` search param changes is
      // an intentional "new conversation" reset, not an effect that should be
      // restructured — same pattern as architect-multi-agent/frontend.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;

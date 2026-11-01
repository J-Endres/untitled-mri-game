/**
 * Connection settings for the MRX MCP gateway, read from Vite env variables
 * (see `.env.example`).
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  TEMPORARY - REMOVE BEFORE RELEASE  ⚠️                            ║
 * ║                                                                      ║
 * ║  VITE_MRX_API_KEY is compiled into the JavaScript bundle. Anyone who  ║
 * ║  opens the page can read it and use it. This is only acceptable for  ║
 * ║  local testing. Before any public deployment, replace it with the    ║
 * ║  OAuth login of the MRX server (which also gives us the user id for  ║
 * ║  leaderboard submissions) and revoke the test key.                   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
export const mrxConfig = {
  url: import.meta.env.VITE_MRX_URL || 'https://mrx-org--mcp-gateway-func.modal.run/mcp',
  apiKey: import.meta.env.VITE_MRX_API_KEY as string | undefined,
}

if (mrxConfig.apiKey) {
  console.warn('⚠️ MRX test API key is bundled into the app. Never deploy this build publicly.')
}

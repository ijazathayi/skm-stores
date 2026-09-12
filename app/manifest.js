export default function manifest() {
  return {
    name: 'SKM Stores',
    short_name: 'SKM Stores',
    description: 'Billing and inventory for SKM Stores',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF4D9',
    theme_color: '#D9466F',
    icons: [
      {
        src: '/skm-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
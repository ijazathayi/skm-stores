export default function manifest() {
  return {
    name: 'SKM Stores',
    short_name: 'SKM Stores',
    description: 'Billing and inventory for SKM Stores',
    start_url: '/',
    display: 'standalone',
    background_color: '#F1F0E4',
    theme_color: '#F1F0E4',
    icons: [
      {
        src: '/skm-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
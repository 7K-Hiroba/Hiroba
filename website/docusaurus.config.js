// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Hiroba',
  tagline: 'Open-source Kubernetes platform solutions by 7KGroup',
  favicon: 'img/favicon.ico',

  url: 'https://hiroba.7kgroup.org',
  baseUrl: '/docs/',

  organizationName: '7KGroup',
  projectName: 'hiroba',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../docs',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/7KGroup/hiroba/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Hiroba',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Documentation',
          },
          {
            to: '/docs/roadmap',
            label: 'Roadmap',
            position: 'left',
          },
          {
            href: 'https://github.com/7KGroup/hiroba',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/intro' },
              { label: 'Mission', to: '/docs/mission' },
              { label: 'Roadmap', to: '/docs/roadmap' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub Discussions', href: 'https://github.com/7KGroup/hiroba/discussions' },
              { label: 'Contributing', href: 'https://github.com/7KGroup/hiroba/blob/main/CONTRIBUTING.md' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: '7KGroup', href: 'https://github.com/7KGroup' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} 7KGroup. Built with Docusaurus.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['bash', 'yaml', 'docker', 'hcl'],
      },
    }),
};

module.exports = config;

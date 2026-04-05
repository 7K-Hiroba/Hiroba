/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    'mission',
    'roadmap',
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/base-vs-platform',
        'architecture/backstage-templates',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/getting-started',
        'guides/using-helm-templates',
        'guides/containerization',
        'guides/crossplane-compositions',
      ],
    },
    {
      type: 'category',
      label: 'Community',
      items: [
        'community/contributing',
        'community/governance',
      ],
    },
  ],
};

module.exports = sidebars;

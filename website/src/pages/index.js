import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary')} style={{ padding: '4rem 0' }}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div>
          <Link
            className="button button--secondary button--lg"
            to="/intro"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'Standardized Packaging',
    description:
      'Production-ready Helm charts and Kubernetes manifests following community best practices.',
  },
  {
    title: 'Secure Containers',
    description:
      'Well-maintained container images built with security-first principles — non-root, minimal base, pinned versions.',
  },
  {
    title: 'Community Driven',
    description:
      'Open governance, transparent roadmaps, and contributions welcome from everyone.',
  },
];

function Feature({ title, description }) {
  return (
    <div className={clsx('col col--4')} style={{ padding: '1rem' }}>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <section style={{ padding: '2rem 0' }}>
          <div className="container">
            <div className="row">
              {features.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

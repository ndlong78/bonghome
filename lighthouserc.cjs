module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: [
        'http://localhost/index.html',
        'http://localhost/parent.html',
        'http://localhost/game1.html'
      ],
      numberOfRuns: 2,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless=new'
      }
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.80 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['error', { minScore: 0.90 }],
        'service-worker': 'off',
        'installable-manifest': 'off'
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-report'
    }
  }
};

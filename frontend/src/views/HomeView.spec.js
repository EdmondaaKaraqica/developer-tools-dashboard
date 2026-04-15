import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeView from './HomeView.vue';

vi.mock('../api.js', () => ({
  fetchLinks: vi.fn(),
}));

import { fetchLinks } from '../api.js';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('HomeView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders items from API', async () => {
    fetchLinks.mockResolvedValue({
      items: [
        { id: '1', title: 'Grafana', url: 'https://grafana', icon: '📊', description: 'Metrics' },
      ],
      totalPages: 1,
    });

    const w = mount(HomeView);
    await flushPromises();
    await w.vm.$nextTick();

    expect(fetchLinks).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(w.text()).toContain('Grafana');
    expect(w.text()).toContain('https://grafana');
  });
});

